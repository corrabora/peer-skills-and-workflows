// Recompute the inspection and verdict of every retained attempt in a run
// from its retained trace, workspace and exit record, launching nothing. The
// previous inspection.json and attempt.json are kept beside the new ones as
// the next numbered pair (inspection.001.json, attempt.001.json, ...), each
// still carrying the classifier that produced it, so a report can say which
// classifier judged each cell and the earlier judgment stays auditable.

import fs from 'node:fs';
import path from 'node:path';
import { isoNow, ordinal, readJson, writeJson } from './common.mjs';
import { ENGINE_DEFAULT_VERBOSITY, engineFor } from './engines.mjs';
import { CLASSIFIER_BEFORE_RECORDS, inspectAttempt, skillSignatures } from './inspect.mjs';
import { attemptRecord, readAttempt } from './attempt.mjs';
import { loadRevisedSuite } from './revise.mjs';
import { resolveRunDir } from './run.mjs';
import { loadSuite } from './suite.mjs';

/** Every attempt directory of a run, originals and retries, as `{ cell, attemptDir }` in order. */
export function listAttempts(runDir) {
  const attemptsRoot = path.join(runDir, 'attempts');
  const found = [];
  if (!fs.existsSync(attemptsRoot)) return found;
  const directories = (dir) => fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort() : [];
  for (const caseId of directories(attemptsRoot)) {
    for (const engine of directories(path.join(attemptsRoot, caseId))) {
      for (const replicate of directories(path.join(attemptsRoot, caseId, engine)).filter((name) => /^\d{3}$/.test(name))) {
        const cellDir = path.join(attemptsRoot, caseId, engine, replicate);
        const cell = `${caseId}/${engine}/${replicate}`;
        found.push({ cell, attemptDir: cellDir });
        for (const retry of directories(cellDir).filter((name) => /^retry-\d{2}$/.test(name))) found.push({ cell, attemptDir: path.join(cellDir, retry) });
      }
    }
  }
  return found;
}

/** Copy `attemptDir/<name>.json` to the next free `<name>.NNN.json`; returns that file's name, or null when there was nothing to keep. */
function keepPrevious(attemptDir, name) {
  const current = path.join(attemptDir, `${name}.json`);
  if (!fs.existsSync(current)) return null;
  const taken = fs.readdirSync(attemptDir).filter((entry) => new RegExp(`^${name}\\.\\d{3}\\.json$`).test(entry)).length;
  const kept = `${name}.${ordinal(taken + 1)}.json`;
  fs.copyFileSync(current, path.join(attemptDir, kept), fs.constants.COPYFILE_EXCL);
  return kept;
}

/**
 * Recompute one retained attempt. Returns `{ previous, record, inspection,
 * kept }`: the record before, the record after, the new inspection and the
 * names of the files the earlier pair was kept under.
 */
export function reinspectAttempt({ attemptDir, suite, skills, signatures, sourceRoot = null, suiteHash, recordedSuiteHash, now = Date.now }) {
  const previous = readAttempt(attemptDir);
  if (!previous) throw new Error(`${attemptDir} holds no attempt record`);
  for (const name of ['command.json', 'trace.jsonl', 'exit.json', 'fixture-manifest.json']) {
    if (!fs.existsSync(path.join(attemptDir, name))) throw new Error(`${attemptDir} lacks ${name}; the attempt cannot be reinspected`);
  }
  const workspace = path.join(attemptDir, 'workspace');
  if (!fs.existsSync(workspace)) throw new Error(`${attemptDir} has no workspace/; file changes cannot be recomputed`);
  const command = readJson(path.join(attemptDir, 'command.json'));
  const caseDef = suite.cases.find((candidate) => candidate.id === command.case);
  if (!caseDef) throw new Error(`${attemptDir}: case '${command.case}' is not in the run's suite snapshot`);
  const engine = engineFor(command.engine);
  const exit = readJson(path.join(attemptDir, 'exit.json'));
  const fixtureManifest = readJson(path.join(attemptDir, 'fixture-manifest.json')).files;
  const events = engine.events(fs.readFileSync(path.join(attemptDir, 'trace.jsonl'), 'utf8'));
  const finalReply = engine.finalReply(attemptDir, events);
  const effective = engine.effectiveSettings(events);
  const stderrFile = path.join(attemptDir, 'stderr.txt');
  const stderr = fs.existsSync(stderrFile) ? fs.readFileSync(stderrFile, 'utf8') : '';

  const earlier = readJson(path.join(attemptDir, 'inspection.json'));
  const inspection = inspectAttempt({ caseDef, skills, events, finalReply, workspace, fixtureManifest, exit, effective, signatures, sourceRoot, now });
  inspection.suite = { hash: suiteHash, recorded: recordedSuiteHash };
  const kept = { inspection: keepPrevious(attemptDir, 'inspection'), attempt: keepPrevious(attemptDir, 'attempt') };
  inspection.previous = [
    ...(earlier.previous ?? []),
    { file: kept.inspection, classifier: earlier.classifier ?? CLASSIFIER_BEFORE_RECORDS, suiteHash: earlier.suite?.hash ?? recordedSuiteHash, verdict: earlier.verdict ?? null },
  ];
  writeJson(path.join(attemptDir, 'inspection.json'), inspection);
  const record = attemptRecord({
    attemptDir,
    caseDef,
    engine: command.engine,
    model: previous.model,
    effort: previous.effort,
    // An attempt recorded before the verbosity dimension existed ran at the engine default.
    verbosity: previous.verbosity ?? command.requested?.verbosity ?? ENGINE_DEFAULT_VERBOSITY,
    replicate: previous.replicate,
    retryOf: previous.retryOf ?? null,
    timeoutSeconds: command.requested?.timeoutSeconds ?? null,
    exit,
    finalReply,
    effective,
    inspection,
    stderr,
    startedAt: previous.startedAt ?? exit.startedAt ?? null,
  });
  record.reinspectedAt = isoNow(now);
  record.previous = [...(previous.previous ?? []), { file: kept.attempt, status: previous.status, verdict: previous.verdict ?? null, classifier: previous.classifier ?? { version: CLASSIFIER_BEFORE_RECORDS.version } }];
  writeJson(path.join(attemptDir, 'attempt.json'), record);
  return { previous, record, inspection, kept };
}

/**
 * Recompute every retained attempt of the run at `runDir` (or only `cells`,
 * as `<case>/<engine>/<replicate>` keys, when given). Nothing is launched and
 * no attempt is removed. `suite`, when given, names a revised suite
 * (directory or tree-ish, see revise.mjs) whose deterministic expectations
 * judge the attempts instead of the recorded suite's; its fixtures and
 * prompts must match. Returns the per-attempt outcomes; an attempt that
 * cannot be reinspected is reported with its error and the others proceed.
 */
export function reinspectRun({ runDir, cells = null, out = console, now = Date.now, suite: revision = null, repo = null }) {
  const { location, existing } = resolveRunDir(runDir);
  if (!existing) throw new Error(`${location} holds no run`);
  let suite = loadSuite(existing.suite.name, path.join(location, 'suites'));
  if (suite.hash !== existing.suite.hash) throw new Error(`the run's suite snapshot no longer matches its recorded hash ${existing.suite.hash}; the run directory was altered`);
  let revised = null;
  if (revision !== null) {
    revised = loadRevisedSuite(location, existing, revision, { repo });
    suite = revised.suite;
    out.info?.(`judging against revised suite ${revised.hash} (recorded ${existing.suite.hash}); deterministic expectations changed in: ${revised.diff.filter((entry) => entry.deterministic).map((entry) => entry.case).join(', ') || 'no case'}`);
  }
  const skills = existing.skills ?? suite.skills;
  const signatures = skillSignatures(path.join(location, 'source'), skills);
  for (const skill of skills) {
    if (!signatures[skill]) throw new Error(`the run's source at ${path.join(location, 'source')} has no skills/${skill}/SKILL.md; the run directory was altered`);
  }
  const selected = listAttempts(location).filter((entry) => cells === null || cells.includes(entry.cell));
  if (cells !== null) {
    for (const cell of cells) if (!selected.some((entry) => entry.cell === cell)) throw new Error(`run ${location} has no attempt for cell ${cell}`);
  }
  const outcomes = [];
  for (const entry of selected) {
    const label = path.relative(path.join(location, 'attempts'), entry.attemptDir).split(path.sep).join('/');
    try {
      const { previous, record, kept } = reinspectAttempt({ attemptDir: entry.attemptDir, suite, skills, signatures, sourceRoot: path.join(location, 'source'), suiteHash: suite.hash, recordedSuiteHash: existing.suite.hash, now });
      const change = previous.verdict === record.verdict && previous.status === record.status ? 'unchanged' : `was ${previous.status}${previous.verdict ? ` ${previous.verdict}` : ''}`;
      out.info?.(`${label}: ${record.status}${record.verdict ? ` ${record.verdict}` : ''} (${change}; earlier files kept as ${kept.inspection}, ${kept.attempt})`);
      outcomes.push({ attempt: label, ok: true, before: { status: previous.status, verdict: previous.verdict }, after: { status: record.status, verdict: record.verdict }, kept });
    } catch (error) {
      out.error?.(`${label}: not reinspected: ${error.message}`);
      outcomes.push({ attempt: label, ok: false, error: error.message });
    }
  }
  return { runDir: location, suite: { recorded: existing.suite.hash, judged: suite.hash, revised: revised ? { hash: revised.hash, source: revised.source, retained: revised.retained, diff: revised.diff } : null }, outcomes };
}
