// Certification report for a run: every cell's deterministic verdict joined
// with a named grader's judgments of the semantic criteria, rolled up per case
// and engine, and certified only at the standing bar: every case passes every
// replicate on every standing engine, with every certifying criterion graded.
// Observe-only criteria are reported beside the result and never count. A
// retained run may be reported against a revised suite whose fixtures and
// prompts match the recorded one (revise.mjs); the report then names both.

import fs from 'node:fs';
import path from 'node:path';
import { ordinal, readJson, writeJson } from './common.mjs';
import { ENGINE_DEFAULT_VERBOSITY } from './engines.mjs';
import { loadSuite } from './suite.mjs';
import { cellAttempts, resolveRunDir } from './run.mjs';
import { CLASSIFIER_BEFORE_RECORDS } from './inspect.mjs';
import { loadRevisedSuite } from './revise.mjs';

/**
 * Parse and validate a judgments file; a grader must be named. Each criterion
 * verdict is `{ "pass": true|false, "note" }`, or `{ "applicable": false,
 * "note" }` for a criterion whose condition the attempt never reached (a
 * criterion about a file the case permits but the engine did not write): it
 * is reported as `not-applicable`, which neither fails the cell nor leaves it
 * ungraded, and is never a pass.
 */
export function loadJudgments(file) {
  const data = readJson(file);
  if (typeof data.grader !== 'string' || !data.grader.trim()) throw new Error(`${file}: judgments must name their grader ("grader")`);
  if (!data.judgments || typeof data.judgments !== 'object') throw new Error(`${file}: judgments must hold a "judgments" object keyed by <case>/<engine>/<replicate>`);
  for (const [cell, entry] of Object.entries(data.judgments)) {
    if (!/^[a-z0-9-]+\/[a-z]+\/\d{3}$/.test(cell)) throw new Error(`${file}: judgment key '${cell}' is not <case>/<engine>/<replicate>`);
    if (!entry.criteria || typeof entry.criteria !== 'object') throw new Error(`${file}: judgment for ${cell} needs a "criteria" object`);
    for (const [id, verdict] of Object.entries(entry.criteria)) {
      if (verdict?.applicable === false) {
        if (verdict.pass !== undefined && verdict.pass !== null) throw new Error(`${file}: criterion ${id} of ${cell} is marked not applicable and cannot also carry a "pass"`);
        continue;
      }
      if (typeof verdict?.pass !== 'boolean') throw new Error(`${file}: criterion ${id} of ${cell} needs a boolean "pass", or "applicable": false when the criterion does not apply to this attempt`);
    }
  }
  return { grader: data.grader, graded: data.graded ?? null, judgments: data.judgments, file };
}

/**
 * The grader's verdicts on one cell: `criteria` are the certifying ones and
 * decide `status`; `observed` are the observe-only ones, reported and never
 * counted, graded or not. A `not-applicable` verdict is reported as such and
 * leaves `status` alone: it is neither a pass, a fail nor a missing grade.
 */
function semanticResult(caseDef, cellKey, effective, judgments) {
  const criteria = {};
  const observed = {};
  let status = 'pass';
  const entry = judgments?.judgments?.[cellKey] ?? null;
  const wrongAttempt = entry && entry.attempt !== undefined && entry.attempt !== effective.id;
  for (const criterion of caseDef.semantic) {
    const verdict = !entry || wrongAttempt ? undefined : entry.criteria[criterion.id];
    const result = verdict === undefined
      ? { result: 'ungraded', note: wrongAttempt ? `judgment names attempt ${entry.attempt}, effective attempt is ${effective.id}` : null }
      : verdict.applicable === false
        ? { result: 'not-applicable', note: verdict.note ?? null }
        : { result: verdict.pass ? 'pass' : 'fail', note: verdict.note ?? null };
    if (criterion.observe === true) { observed[criterion.id] = result; continue; }
    criteria[criterion.id] = result;
    if (result.result === 'fail') status = 'fail';
    else if (result.result === 'ungraded' && status === 'pass') status = 'ungraded';
  }
  return { status, criteria, observed };
}

function cellStatus(caseDef, engine, replicate, cellDir, judgments) {
  const attempts = cellAttempts(cellDir);
  const cellKey = `${caseDef.id}/${engine}/${ordinal(replicate)}`;
  const behavioral = attempts.filter((attempt) => attempt.status === 'behavioral').at(-1) ?? null;
  // An attempt recorded before the verbosity dimension existed ran at the engine default.
  const base = { cell: cellKey, attempts: attempts.map((attempt) => ({ id: attempt.id, status: attempt.status, reason: attempt.reason, verdict: attempt.verdict })), effective: behavioral?.id ?? null, model: attempts[0]?.model ?? null, effort: attempts[0]?.effort ?? null, verbosity: attempts.length ? attempts[0].verbosity ?? ENGINE_DEFAULT_VERBOSITY : null };
  if (attempts.length === 0) return { ...base, status: 'missing', deterministic: null, semantic: null };
  if (!behavioral) return { ...base, status: 'transport-failure', deterministic: null, semantic: null };
  // The latest inspection judges the cell; earlier ones stay beside it as
  // inspection.NNN.json (see reinspect.mjs) and are named here for the audit.
  const inspection = readJson(path.join(cellDir, behavioral.id === attempts[0].id ? '' : behavioral.id, 'inspection.json'));
  const classifier = inspection.classifier ?? CLASSIFIER_BEFORE_RECORDS;
  const deterministic = {
    verdict: inspection.verdict,
    checks: inspection.checks,
    suiteHash: inspection.suite?.hash ?? null,
    classifier: { version: classifier.version, inspectedAt: classifier.inspectedAt ?? null },
    previous: (inspection.previous ?? []).map((entry) => ({ file: entry.file, classifier: entry.classifier?.version ?? null, verdict: entry.verdict })),
  };
  if (inspection.verdict === 'premise-not-met') return { ...base, status: 'premise-not-met', deterministic, semantic: null };
  const semantic = semanticResult(caseDef, cellKey, behavioral, judgments);
  if (inspection.verdict === 'fail') return { ...base, status: 'fail', deterministic, semantic };
  return { ...base, status: semantic.status === 'pass' ? 'pass' : semantic.status === 'fail' ? 'fail' : 'ungraded', deterministic, semantic };
}

/**
 * One case on one engine: `certified` only when at least `replicates` cells
 * exist and every one of them passes with every criterion graded. A failed
 * cell makes the case `unstable`. A cell with no result yet (premise not met,
 * transport failure with no behavioral retry, or missing) is neither a pass
 * nor a fail: it leaves the case `blocked` until resolved in a new cell or
 * run. `ungraded` means a grader is still needed; `incomplete` means fewer
 * cells than the bar asks for.
 */
function rollup(cells, replicates) {
  const counts = {};
  for (const cell of cells) counts[cell.status] = (counts[cell.status] ?? 0) + 1;
  const passed = counts.pass ?? 0;
  const unresolved = (counts['premise-not-met'] ?? 0) + (counts['transport-failure'] ?? 0) + (counts.missing ?? 0);
  let status;
  if ((counts.fail ?? 0) > 0) status = 'unstable';
  else if (unresolved > 0) status = 'blocked';
  else if ((counts.ungraded ?? 0) > 0) status = 'ungraded';
  else if (passed < replicates) status = 'incomplete';
  else status = 'certified';
  return { status, passed, replicates, counts };
}

/** Observe-only results of an engine's cells, counted per criterion. */
function observedCounts(cells) {
  const counts = {};
  for (const cell of cells) {
    for (const [id, verdict] of Object.entries(cell.semantic?.observed ?? {})) {
      counts[id] ??= { pass: 0, fail: 0, ungraded: 0, 'not-applicable': 0 };
      counts[id][verdict.result] += 1;
    }
  }
  return counts;
}

/**
 * Build the report for the run at `runDir`. `standingEngines` and
 * `replicates` define the bar; `judgments` is a loaded judgments file or
 * null (every semantic criterion is then ungraded). `suite`, when given,
 * names a revised suite (directory or tree-ish, see revise.mjs) to report
 * against instead of the recorded one; its fixtures and prompts must match.
 */
export function buildReport({ runDir, judgments = null, standingEngines, replicates, now = Date.now, suite: revision = null, repo = null }) {
  const { location, existing } = resolveRunDir(runDir);
  if (!existing) throw new Error(`${location} holds no run`);
  let suite = loadSuite(existing.suite.name, path.join(location, 'suites'));
  if (suite.hash !== existing.suite.hash) throw new Error(`the run's suite snapshot no longer matches its recorded hash ${existing.suite.hash}; the run directory was altered`);
  let revised = null;
  if (revision !== null) {
    revised = loadRevisedSuite(location, existing, revision, { repo });
    suite = revised.suite;
  }
  const attemptsRoot = path.join(location, 'attempts');
  const enginesSeen = new Set();
  const cases = [];
  for (const caseDef of suite.cases) {
    const caseDir = path.join(attemptsRoot, caseDef.id);
    const engines = {};
    const present = fs.existsSync(caseDir) ? fs.readdirSync(caseDir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name) : [];
    for (const engine of new Set([...standingEngines, ...present])) {
      enginesSeen.add(engine);
      const engineDir = path.join(caseDir, engine);
      const cellNames = fs.existsSync(engineDir) ? fs.readdirSync(engineDir, { withFileTypes: true }).filter((entry) => entry.isDirectory() && /^\d{3}$/.test(entry.name)).map((entry) => entry.name).sort() : [];
      const cells = cellNames.map((name) => cellStatus(caseDef, engine, Number(name), path.join(engineDir, name), judgments));
      engines[engine] = { ...rollup(cells, replicates), observed: observedCounts(cells), cells };
    }
    const certified = standingEngines.every((engine) => engines[engine]?.status === 'certified');
    cases.push({ id: caseDef.id, effect: caseDef.effect, certified, engines });
  }
  const certified = cases.every((caseDef) => caseDef.certified);
  if (revised) {
    // Deterministic expectations are judged by `inspect`; a revision that changes them must have been inspected under before it is reported.
    const stale = [];
    for (const entry of revised.diff.filter((change) => change.deterministic)) {
      const caseDef = cases.find((candidate) => candidate.id === entry.case);
      for (const summary of Object.values(caseDef.engines)) {
        for (const cell of summary.cells) if (cell.deterministic && (cell.deterministic.suiteHash ?? existing.suite.hash) !== revised.hash) stale.push(cell.cell);
      }
    }
    if (stale.length) throw new Error(`the revised suite changes deterministic expectations of ${revised.diff.filter((change) => change.deterministic).map((change) => change.case).join(', ')}, but these cells were inspected under another suite: ${stale.join(', ')}. Run inspect --suite first`);
  }
  return {
    generated: new Date(now()).toISOString(),
    runDir: location,
    suite: { ...existing.suite, revised: revised ? { hash: revised.hash, source: revised.source, retained: revised.retained, diff: revised.diff } : null },
    source: existing.source,
    // A run created before the verbosity dimension existed ran at the engine default.
    verbosity: existing.verbosity?.requested ?? ENGINE_DEFAULT_VERBOSITY,
    bar: { standingEngines, replicates, rule: `every case passes ${replicates}/${replicates} replicates on every standing engine with every certifying semantic criterion graded; a failed replicate is unstable, a replicate without a result (premise not met, transport failure) blocks certification until resolved, and observe-only criteria are reported but never counted` },
    grader: judgments ? { name: judgments.grader, graded: judgments.graded, file: judgments.file } : null,
    certified,
    cases,
    enginesSeen: [...enginesSeen].sort(),
  };
}

/** Markdown rendering of a report, for people. */
export function renderReport(report) {
  const lines = [];
  lines.push(`# Skill suite report: ${report.suite.name}`, '');
  lines.push(`Result: **${report.certified ? 'certified' : 'not certified'}** at the bar ${report.bar.rule}.`, '');
  lines.push(`Source tree: ${report.source.tree ?? 'none (directory source)'}; source digest: ${report.source.digest}; suite hash as run: ${report.suite.hash}; verbosity: ${report.verbosity}.`);
  if (report.suite.revised) {
    const changes = report.suite.revised.diff.map((entry) => {
      const parts = [];
      if (entry.effect) parts.push('effect');
      if (entry.deterministic) parts.push('deterministic expectations');
      for (const kind of ['added', 'removed', 'changed']) if (entry.semantic[kind].length) parts.push(`criteria ${kind}: ${entry.semantic[kind].join(', ')}`);
      return `${entry.case} (${parts.join('; ')})`;
    });
    lines.push(`Graded against revised suite ${report.suite.revised.hash} (${report.suite.revised.source.kind === 'tree' ? `tree ${report.suite.revised.source.tree}` : report.suite.revised.source.path}; retained at ${report.suite.revised.retained}); fixtures and prompts identical to the run's; changes: ${changes.length ? changes.join('; ') : 'none'}.`);
  }
  lines.push(`Grader: ${report.grader ? `${report.grader.name}${report.grader.graded ? ` (${report.grader.graded})` : ''}` : 'none; every semantic criterion is ungraded'}.`, '');
  const engines = report.bar.standingEngines;
  lines.push(`| Case | ${engines.join(' | ')} | Certified | ${engines.map((engine) => `${engine} observe-only`).join(' | ')} |`);
  lines.push(`| --- | ${engines.map(() => '---').join(' | ')} | --- | ${engines.map(() => '---').join(' | ')} |`);
  for (const caseDef of report.cases) {
    const cellsText = engines.map((engine) => {
      const summary = caseDef.engines[engine];
      return summary ? `${summary.status} ${summary.passed}/${summary.replicates}` : 'missing';
    });
    const observedText = engines.map((engine) => {
      const counts = Object.entries(caseDef.engines[engine]?.observed ?? {});
      return counts.length ? counts.map(([id, count]) => `${id}: ${count.pass} pass, ${count.fail} fail, ${count.ungraded} ungraded${count['not-applicable'] ? `, ${count['not-applicable']} not applicable` : ''}`).join('; ') : 'none';
    });
    lines.push(`| ${caseDef.id} | ${cellsText.join(' | ')} | ${caseDef.certified ? 'yes' : 'no'} | ${observedText.join(' | ')} |`);
  }
  lines.push('');
  for (const caseDef of report.cases) {
    lines.push(`## ${caseDef.id}`, '', caseDef.effect, '');
    for (const [engine, summary] of Object.entries(caseDef.engines)) {
      lines.push(`### ${engine}: ${summary.status} (${summary.passed}/${summary.replicates})`, '');
      for (const cell of summary.cells) {
        const attempts = cell.attempts.map((attempt) => `${attempt.id} ${attempt.status}${attempt.reason ? ` (${attempt.reason})` : ''}`).join('; ');
        lines.push(`- ${cell.cell}: **${cell.status}**; model ${cell.model} ${cell.effort}; verbosity ${cell.verbosity}; attempts: ${attempts}`);
        if (cell.deterministic) {
          const earlier = cell.deterministic.previous.length ? `; earlier: ${cell.deterministic.previous.map((entry) => `${entry.file} (classifier ${entry.classifier ?? 'unrecorded'}, ${entry.verdict ?? 'no verdict'})`).join(', ')}` : '';
          lines.push(`  - classifier ${cell.deterministic.classifier.version}${earlier}`);
        }
        for (const check of cell.deterministic?.checks ?? []) lines.push(`  - ${check.kind} ${check.id}: ${check.pass ? 'pass' : 'FAIL'}; ${check.detail}`);
        for (const [id, verdict] of Object.entries(cell.semantic?.criteria ?? {})) lines.push(`  - semantic ${id}: ${verdict.result}${verdict.note ? `; ${verdict.note}` : ''}`);
        for (const [id, verdict] of Object.entries(cell.semantic?.observed ?? {})) lines.push(`  - observe-only ${id}: ${verdict.result}${verdict.note ? `; ${verdict.note}` : ''}`);
      }
      lines.push('');
    }
  }
  return `${lines.join('\n')}\n`;
}

/** Write the report as the next numbered pair under `<run>/reports/`; returns the paths. */
export function writeReport(runDir, report) {
  const dir = path.join(runDir, 'reports');
  fs.mkdirSync(dir, { recursive: true });
  const existing = fs.readdirSync(dir).filter((name) => /^\d{3}-report\.json$/.test(name)).length;
  const base = path.join(dir, `${ordinal(existing + 1)}-report`);
  writeJson(`${base}.json`, report);
  fs.writeFileSync(`${base}.md`, renderReport(report));
  return { json: `${base}.json`, markdown: `${base}.md` };
}
