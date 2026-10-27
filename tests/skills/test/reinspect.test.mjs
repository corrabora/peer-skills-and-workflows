// Recomputing inspections over a retained run: `inspect` reads the retained
// trace and workspace of every attempt, launches nothing, keeps the earlier
// inspection.json and attempt.json beside the new pair with the classifier
// that produced them, changes the verdict where the classifier disagrees, and
// the report then judges by the latest inspection and names both.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { readJson, writeJson } from '../lib/common.mjs';
import { CLASSIFIER } from '../lib/inspect.mjs';
import { listAttempts, reinspectRun } from '../lib/reinspect.mjs';
import { buildReport, renderReport } from '../lib/report.mjs';
import { executeRun, planRun } from '../lib/run.mjs';
import { fakeExecutables, makeSource, makeSuite, temporaryDirectory } from '../test-support/fixtures.mjs';

const scratch = temporaryDirectory('reinspect');
after(() => fs.rmSync(scratch, { recursive: true, force: true }));

const quiet = { info() {}, error() {} };
const runner = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'run.mjs');
const suitesRoot = path.join(scratch, 'suites');
const source = makeSource(path.join(scratch, 'source'));
const runDir = path.join(scratch, 'run');

// index-settles in miniature: clarify-artifact must be read, neither writing
// skill may be. The fake engine reads clarify-artifact, then runs the
// baseline's exclusion listing (no skill body returned), then replies.
makeSuite(suitesRoot, 'recompute', [
  {
    id: 'settles',
    directive: { shellReadSkills: ['clarify-artifact'], excludedListing: true, reply: 'Reader, purpose, constraints.' },
    deterministic: { exit: 0, skillReads: { 'clarify-artifact': 'required', 'write-for-humans': 'forbidden', 'write-for-agents': 'forbidden' }, premise: ['skillReads.clarify-artifact'], writes: { allowed: [] } },
    semantic: [],
  },
  {
    id: 'exit-load',
    directive: { shellReadSkills: ['clarify-artifact', 'write-for-humans'], excludedListing: true, reply: 'Reader, purpose, constraints.' },
    deterministic: { exit: 0, skillReads: { 'clarify-artifact': 'required', 'write-for-humans': 'forbidden', 'write-for-agents': 'forbidden' }, premise: ['skillReads.clarify-artifact'], writes: { allowed: [] } },
    semantic: [],
  },
]);

function run(engine) {
  return executeRun(planRun({ suiteName: 'recompute', suitesRoot, engine, model: engine === 'claude' ? 'claude-opus-5-5' : 'gpt-6.1-sol', effort: 'high', replicates: 1, source: { dir: source }, runDir, executables: fakeExecutables, timeoutSeconds: 60 }), { out: quiet });
}

/** Rewrite a cell's inspection and attempt as the classifier before version 2 would have left them: the exclusion listing counted as a body read of every skill. */
function ageCell(cellDir) {
  const inspection = readJson(path.join(cellDir, 'inspection.json'));
  delete inspection.classifier;
  for (const skill of ['write-for-humans', 'write-for-agents']) {
    inspection.skillReads[skill] = { body: true, invoked: false, partial: false, listing: false, how: ['command: rg --files --hidden -g \'!.agents/skills/**\'; cat README.md (wildcard over every skill)'] };
    const check = inspection.checks.find((entry) => entry.id === `skillReads.${skill}`);
    check.pass = false;
    check.detail = `${skill}: body read`;
  }
  inspection.verdict = 'fail';
  writeJson(path.join(cellDir, 'inspection.json'), inspection);
  const attempt = readJson(path.join(cellDir, 'attempt.json'));
  delete attempt.classifier;
  attempt.verdict = 'fail';
  writeJson(path.join(cellDir, 'attempt.json'), attempt);
  return { inspection: fs.readFileSync(path.join(cellDir, 'inspection.json')), attempt: fs.readFileSync(path.join(cellDir, 'attempt.json')) };
}

test('a fresh run already judges the exclusion listing as no read, on both engines', () => {
  const claude = run('claude');
  const codex = run('codex');
  assert.deepEqual(claude.map((record) => [record.case, record.verdict]), [['settles', 'pass'], ['exit-load', 'fail']]);
  assert.deepEqual(codex.map((record) => [record.case, record.verdict]), [['settles', 'pass'], ['exit-load', 'fail']]);
  const inspection = readJson(path.join(runDir, 'attempts', 'settles', 'codex', '001', 'inspection.json'));
  assert.equal(inspection.classifier.version, CLASSIFIER.version);
  assert.equal(inspection.skillReads['write-for-agents'].body, false);
  assert.equal(inspection.skillReads['write-for-agents'].evidence.some((entry) => entry.basis === 'exclusion-only'), true, 'the exclusion is recorded for the grader');
  assert.equal(inspection.skillReads['clarify-artifact'].body, true);
  assert.equal(inspection.skillReads['clarify-artifact'].evidence[0].basis, 'output-signature');
  assert.equal(claude.map((record) => record.classifier.version).every((version) => version === CLASSIFIER.version), true);
});

test('inspect recomputes every retained attempt from its trace, keeps the earlier pair beside the new one and changes the verdict', () => {
  const codexCell = path.join(runDir, 'attempts', 'settles', 'codex', '001');
  const claudeCell = path.join(runDir, 'attempts', 'settles', 'claude', '001');
  const agedCodex = ageCell(codexCell);
  const agedClaude = ageCell(claudeCell);
  assert.equal(readJson(path.join(codexCell, 'attempt.json')).verdict, 'fail', 'the aged cell reads as the first classifier left it');
  assert.equal(listAttempts(runDir).length, 4);

  const before = fs.readdirSync(codexCell).sort();
  const { outcomes } = reinspectRun({ runDir, out: quiet, now: () => Date.parse('2026-10-14T20:00:00Z') });
  assert.equal(outcomes.length, 4);
  assert.equal(outcomes.every((outcome) => outcome.ok), true, JSON.stringify(outcomes));
  const settlesCodex = outcomes.find((outcome) => outcome.attempt === 'settles/codex/001');
  assert.deepEqual(settlesCodex.before, { status: 'behavioral', verdict: 'fail' });
  assert.deepEqual(settlesCodex.after, { status: 'behavioral', verdict: 'pass' });
  assert.deepEqual(settlesCodex.kept, { inspection: 'inspection.001.json', attempt: 'attempt.001.json' });
  const exitLoad = outcomes.find((outcome) => outcome.attempt === 'exit-load/codex/001');
  assert.deepEqual([exitLoad.before.verdict, exitLoad.after.verdict], ['fail', 'fail'], 'a real forbidden read stays a fail');

  for (const [cellDir, aged] of [[codexCell, agedCodex], [claudeCell, agedClaude]]) {
    assert.deepEqual(fs.readFileSync(path.join(cellDir, 'inspection.001.json')), aged.inspection, 'the earlier inspection is kept byte for byte');
    assert.deepEqual(fs.readFileSync(path.join(cellDir, 'attempt.001.json')), aged.attempt, 'the earlier attempt record is kept byte for byte');
    const inspection = readJson(path.join(cellDir, 'inspection.json'));
    assert.equal(inspection.verdict, 'pass');
    assert.equal(inspection.classifier.version, CLASSIFIER.version);
    assert.equal(inspection.classifier.inspectedAt, '2026-10-14T20:00:00.000Z');
    assert.deepEqual(inspection.previous, [{ file: 'inspection.001.json', classifier: { version: 1, rule: inspection.previous[0].classifier.rule }, suiteHash: readJson(path.join(runDir, 'run.json')).suite.hash, verdict: 'fail' }]);
    assert.deepEqual(inspection.suite, { hash: readJson(path.join(runDir, 'run.json')).suite.hash, recorded: readJson(path.join(runDir, 'run.json')).suite.hash }, 'judged under the recorded suite');
    assert.match(inspection.previous[0].classifier.rule, /reading verb/);
    const attempt = readJson(path.join(cellDir, 'attempt.json'));
    assert.equal(attempt.verdict, 'pass');
    assert.equal(attempt.status, 'behavioral');
    assert.equal(attempt.reinspectedAt, '2026-10-14T20:00:00.000Z');
    assert.deepEqual(attempt.previous, [{ file: 'attempt.001.json', status: 'behavioral', verdict: 'fail', classifier: { version: 1 } }]);
    for (const name of ['prompt.md', 'command.json', 'trace.jsonl', 'stderr.txt', 'exit.json', 'fixture-manifest.json']) assert.ok(fs.existsSync(path.join(cellDir, name)), `${name} untouched`);
  }
  assert.deepEqual(fs.readdirSync(codexCell).sort(), [...before, 'attempt.001.json', 'inspection.001.json'].sort(), 'only the kept pair was added');

  // Reinspecting again keeps the version-2 pair as 002 and leaves the verdict alone.
  const again = reinspectRun({ runDir, cells: ['settles/codex/001'], out: quiet });
  assert.equal(again.outcomes.length, 1);
  assert.deepEqual(again.outcomes[0].kept, { inspection: 'inspection.002.json', attempt: 'attempt.002.json' });
  const twice = readJson(path.join(codexCell, 'inspection.json'));
  assert.equal(twice.previous.length, 2);
  assert.equal(twice.previous[1].classifier.version, CLASSIFIER.version);
  assert.equal(twice.previous[1].verdict, 'pass');
  assert.throws(() => reinspectRun({ runDir, cells: ['settles/codex/009'], out: quiet }), /no attempt for cell settles\/codex\/009/);
});

test('the report judges by the latest inspection and names the classifier of each cell and of the kept earlier ones', () => {
  const report = buildReport({ runDir, standingEngines: ['claude', 'codex'], replicates: 1 });
  const settles = report.cases.find((caseDef) => caseDef.id === 'settles');
  assert.equal(settles.engines.codex.status, 'certified');
  assert.equal(settles.engines.claude.status, 'certified');
  const cell = settles.engines.codex.cells[0];
  assert.equal(cell.deterministic.verdict, 'pass');
  assert.equal(cell.deterministic.classifier.version, CLASSIFIER.version);
  assert.deepEqual(cell.deterministic.previous.map((entry) => [entry.file, entry.classifier, entry.verdict]), [['inspection.001.json', 1, 'fail'], ['inspection.002.json', CLASSIFIER.version, 'pass']]);
  const exitLoad = report.cases.find((caseDef) => caseDef.id === 'exit-load');
  assert.equal(exitLoad.engines.codex.status, 'unstable', 'the forbidden write-for-humans read is a real fail');
  assert.deepEqual(exitLoad.engines.codex.cells[0].deterministic.previous.map((entry) => [entry.file, entry.classifier, entry.verdict]), [['inspection.001.json', CLASSIFIER.version, 'fail']], 'an unchanged verdict still keeps the earlier pair');
  const markdown = renderReport(report);
  assert.match(markdown, /- settles\/codex\/001: \*\*pass\*\*/);
  assert.match(markdown, new RegExp(`classifier ${CLASSIFIER.version}; earlier: inspection\\.001\\.json \\(classifier 1, fail\\), inspection\\.002\\.json \\(classifier ${CLASSIFIER.version}, pass\\)`));
});

test('the CLI inspect command recomputes without launching and reports the changed verdicts', () => {
  const cell = path.join(runDir, 'attempts', 'settles', 'claude', '001');
  ageCell(cell);
  const result = spawnSync(process.execPath, [runner, 'inspect', '--run-dir', runDir, '--cell', 'settles/claude/001'], { encoding: 'utf8', cwd: scratch });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /settles\/claude\/001: behavioral pass \(was behavioral fail; earlier files kept as inspection\.002\.json, attempt\.002\.json\)/);
  assert.match(result.stdout, /1 attempts reinspected, 1 verdicts changed, 0 not reinspected/);
  assert.equal(readJson(path.join(cell, 'attempt.json')).verdict, 'pass');

  const missing = spawnSync(process.execPath, [runner, 'inspect'], { encoding: 'utf8', cwd: scratch });
  assert.equal(missing.status, 2);
  assert.match(missing.stderr, /--run-dir is required/);
  const noRun = spawnSync(process.execPath, [runner, 'inspect', '--run-dir', path.join(scratch, 'nowhere')], { encoding: 'utf8', cwd: scratch });
  assert.equal(noRun.status, 1);
  assert.match(noRun.stderr, /holds no run/);
});

test('an attempt without its workspace or trace is reported and the others still proceed', () => {
  const cell = path.join(runDir, 'attempts', 'exit-load', 'claude', '001');
  fs.renameSync(path.join(cell, 'workspace'), path.join(cell, 'workspace-moved'));
  const { outcomes } = reinspectRun({ runDir, out: quiet });
  const broken = outcomes.find((outcome) => outcome.attempt === 'exit-load/claude/001');
  assert.equal(broken.ok, false);
  assert.match(broken.error, /has no workspace/);
  assert.equal(outcomes.filter((outcome) => outcome.ok).length, 3);
  assert.equal(readJson(path.join(cell, 'attempt.json')).verdict, 'fail', 'the broken attempt keeps its last record');
  fs.renameSync(path.join(cell, 'workspace-moved'), path.join(cell, 'workspace'));
  const cli = spawnSync(process.execPath, [runner, 'inspect', '--run-dir', runDir, '--cell', 'exit-load/claude/001'], { encoding: 'utf8', cwd: scratch });
  assert.equal(cli.status, 0, cli.stderr);
});
