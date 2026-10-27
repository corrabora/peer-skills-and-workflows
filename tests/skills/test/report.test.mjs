// Certification: a case certifies only at the standing bar, every replicate
// passing on every standing engine with every semantic criterion graded by a
// named grader. An ungraded criterion never passes; a failed replicate makes
// the case unstable; a replicate without a result (premise not met, transport
// failure) blocks certification until it is resolved.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, test } from 'node:test';
import { readJson, writeJson } from '../lib/common.mjs';
import { buildReport, loadJudgments, renderReport, writeReport } from '../lib/report.mjs';
import { executeRun, planRun } from '../lib/run.mjs';
import { fakeExecutables, makeSource, makeSuite, temporaryDirectory } from '../test-support/fixtures.mjs';

const scratch = temporaryDirectory('report');
after(() => fs.rmSync(scratch, { recursive: true, force: true }));

const quiet = { info() {}, error() {} };
const suitesRoot = path.join(scratch, 'suites');
const source = makeSource(path.join(scratch, 'source'));
const runDir = path.join(scratch, 'run');
const STANDING = ['claude', 'codex'];

makeSuite(suitesRoot, 'cert', [
  {
    id: 'good',
    directive: { readSkills: ['write-for-humans', 'clarify-artifact'], reply: 'Which reader?' },
    deterministic: { exit: 0, skillReads: { 'write-for-humans': 'required', 'clarify-artifact': 'required' }, premise: ['skillReads.write-for-humans'], writes: { allowed: [] } },
    semantic: [{ id: 'one-question', criterion: 'exactly one question' }, { id: 'premise-stated', criterion: 'the premise is stated' }],
  },
  {
    id: 'plain',
    directive: { readSkills: ['clarify-artifact'], reply: 'Reader, purpose, constraints.' },
    deterministic: { exit: 0, skillReads: { 'clarify-artifact': 'required' }, premise: [], writes: { allowed: [] } },
    semantic: [],
  },
  {
    id: 'stray-write',
    directive: { readSkills: ['clarify-artifact'], writes: [{ path: 'docs/draft.md', text: 'x' }], reply: 'Drafted.' },
    deterministic: { exit: 0, skillReads: { 'clarify-artifact': 'required' }, premise: [], writes: { allowed: [] } },
    semantic: [{ id: 'no-draft', criterion: 'nothing drafted' }],
  },
  {
    id: 'no-premise',
    directive: { listSkills: ['write-for-humans'], reply: 'Done.' },
    deterministic: { exit: 0, skillReads: { 'write-for-humans': 'required' }, premise: ['skillReads.write-for-humans'], writes: {} },
    semantic: [{ id: 'anything', criterion: 'anything' }],
  },
  {
    id: 'crash',
    directive: { crash: true, exit: 2 },
    deterministic: { exit: 0, skillReads: {}, premise: [], writes: {} },
    semantic: [],
  },
]);

function run(engine, cases, replicates = 3) {
  const settings = engine === 'claude' ? { model: 'claude-opus-5-5', effort: 'high' } : { model: 'gpt-6.1-sol', effort: 'high' };
  return executeRun(planRun({ suiteName: 'cert', suitesRoot, engine, ...settings, replicates, cases, source: { dir: source }, runDir, executables: fakeExecutables, timeoutSeconds: 60 }), { out: quiet });
}

const report = (judgments = null, replicates = 3, standingEngines = STANDING) => buildReport({ runDir, judgments, standingEngines, replicates, now: () => 0 });
const status = (built, id, engine) => built.cases.find((caseDef) => caseDef.id === id).engines[engine].status;

function judgmentsFile(name, judgments, extra = {}) {
  const file = path.join(scratch, `${name}.json`);
  writeJson(file, { grader: 'test grader', graded: '2026-10-14', judgments, ...extra });
  return loadJudgments(file);
}

function allPass(cases, engines = STANDING, replicates = 3) {
  const judgments = {};
  for (const [id, criteria] of Object.entries(cases)) {
    for (const engine of engines) {
      for (let replicate = 1; replicate <= replicates; replicate += 1) {
        judgments[`${id}/${engine}/${String(replicate).padStart(3, '0')}`] = { criteria: Object.fromEntries(criteria.map((criterion) => [criterion, { pass: true }])) };
      }
    }
  }
  return judgments;
}

test('without judgments every semantic criterion is ungraded and nothing with a semantic criterion certifies', () => {
  run('claude', ['good', 'plain']);
  run('codex', ['good', 'plain']);
  const built = report();
  assert.equal(built.certified, false);
  assert.equal(status(built, 'good', 'claude'), 'ungraded');
  assert.equal(status(built, 'good', 'codex'), 'ungraded');
  const cell = built.cases.find((caseDef) => caseDef.id === 'good').engines.claude.cells[0];
  assert.equal(cell.status, 'ungraded');
  assert.deepEqual(cell.semantic.criteria, { 'one-question': { result: 'ungraded', note: null }, 'premise-stated': { result: 'ungraded', note: null } });
  assert.equal(cell.deterministic.verdict, 'pass');
  // A case with no semantic criteria certifies on its deterministic checks alone.
  assert.equal(status(built, 'plain', 'claude'), 'certified');
  assert.equal(status(built, 'plain', 'codex'), 'certified');
  assert.equal(built.cases.find((caseDef) => caseDef.id === 'plain').certified, true);
  assert.equal(built.grader, null);
});

test('a partially graded cell stays ungraded; a judgment naming another attempt does not count', () => {
  const partial = judgmentsFile('partial', { ...allPass({ good: ['one-question'] }) });
  const built = report(partial);
  assert.equal(status(built, 'good', 'claude'), 'ungraded');
  const cell = built.cases.find((caseDef) => caseDef.id === 'good').engines.claude.cells[0];
  assert.equal(cell.semantic.criteria['premise-stated'].result, 'ungraded');

  const stale = judgmentsFile('stale', { 'good/claude/001': { attempt: 'retry-01', criteria: { 'one-question': { pass: true }, 'premise-stated': { pass: true } } } });
  const staleCell = report(stale).cases.find((caseDef) => caseDef.id === 'good').engines.claude.cells[0];
  assert.equal(staleCell.status, 'ungraded');
  assert.match(staleCell.semantic.criteria['one-question'].note, /judgment names attempt retry-01, effective attempt is 001/);
});

test('fully graded passes certify at the bar; one failed criterion makes the case unstable', () => {
  const graded = judgmentsFile('graded', allPass({ good: ['one-question', 'premise-stated'] }));
  const built = report(graded);
  assert.equal(built.cases.find((caseDef) => caseDef.id === 'good').certified, true);
  assert.equal(status(built, 'good', 'claude'), 'certified');
  assert.equal(built.cases.find((caseDef) => caseDef.id === 'good').engines.claude.passed, 3);
  assert.deepEqual(built.grader, { name: 'test grader', graded: '2026-10-14', file: graded.file });
  // The run also holds cases with no attempts yet, so the suite is not certified.
  assert.equal(built.certified, false);
  assert.equal(status(built, 'stray-write', 'claude'), 'incomplete');
  assert.deepEqual(built.cases.find((caseDef) => caseDef.id === 'stray-write').engines.claude.counts, {});

  const oneFail = allPass({ good: ['one-question', 'premise-stated'] });
  oneFail['good/codex/002'].criteria['premise-stated'] = { pass: false, note: 'no premise given' };
  const unstable = report(judgmentsFile('one-fail', oneFail));
  assert.equal(status(unstable, 'good', 'claude'), 'certified');
  assert.equal(status(unstable, 'good', 'codex'), 'unstable');
  assert.equal(unstable.cases.find((caseDef) => caseDef.id === 'good').certified, false, '2/3 on one engine is unstable, not certified');
  assert.equal(unstable.cases.find((caseDef) => caseDef.id === 'good').engines.codex.passed, 2);

  // The bar is per standing engine: a run on one engine alone never certifies.
  assert.equal(report(graded, 3, ['claude']).cases.find((caseDef) => caseDef.id === 'good').certified, true);
  assert.equal(report(graded, 3, ['claude', 'other']).cases.find((caseDef) => caseDef.id === 'good').certified, false);
  // Fewer replicates than the bar is incomplete.
  assert.equal(status(report(graded, 4), 'good', 'claude'), 'incomplete');
});

test('a failed deterministic check is unstable even when the grader passes it; premise not met and transport failures block', () => {
  run('claude', ['stray-write', 'no-premise', 'crash'], 1);
  const judgments = judgmentsFile('all', allPass({ 'stray-write': ['no-draft'], 'no-premise': ['anything'] }, ['claude'], 1));
  const built = report(judgments, 1, ['claude']);
  assert.equal(status(built, 'stray-write', 'claude'), 'unstable');
  const stray = built.cases.find((caseDef) => caseDef.id === 'stray-write').engines.claude.cells[0];
  assert.equal(stray.status, 'fail');
  assert.equal(stray.deterministic.verdict, 'fail');
  assert.equal(stray.semantic.criteria['no-draft'].result, 'pass', 'the grader\'s verdict is reported, not used to rescue the cell');

  assert.equal(status(built, 'no-premise', 'claude'), 'blocked');
  const premise = built.cases.find((caseDef) => caseDef.id === 'no-premise').engines.claude.cells[0];
  assert.equal(premise.status, 'premise-not-met');
  assert.equal(premise.semantic, null, 'nothing is graded when the premise failed');

  assert.equal(status(built, 'crash', 'claude'), 'blocked');
  const crash = built.cases.find((caseDef) => caseDef.id === 'crash').engines.claude.cells[0];
  assert.equal(crash.status, 'transport-failure');
  assert.equal(crash.effective, null);
  assert.deepEqual(crash.attempts.map((attempt) => attempt.status), ['transport-failure']);
  assert.equal(built.certified, false);
});

test('judgments must name a grader and use the cell key shape', () => {
  const unnamed = path.join(scratch, 'unnamed.json');
  writeJson(unnamed, { judgments: {} });
  assert.throws(() => loadJudgments(unnamed), /judgments must name their grader/);
  const badKey = path.join(scratch, 'bad-key.json');
  writeJson(badKey, { grader: 'g', judgments: { 'good/claude/1': { criteria: {} } } });
  assert.throws(() => loadJudgments(badKey), /is not <case>\/<engine>\/<replicate>/);
  const badPass = path.join(scratch, 'bad-pass.json');
  writeJson(badPass, { grader: 'g', judgments: { 'good/claude/001': { criteria: { 'one-question': { pass: 'yes' } } } } });
  assert.throws(() => loadJudgments(badPass), /needs a boolean "pass"/);
});

test('reports are written as numbered pairs and the rendering carries the bar, the grader and every check', () => {
  const graded = judgmentsFile('render', allPass({ good: ['one-question', 'premise-stated'] }));
  const built = report(graded);
  const first = writeReport(runDir, built);
  const second = writeReport(runDir, built);
  assert.equal(path.basename(first.json), '001-report.json');
  assert.equal(path.basename(second.markdown), '002-report.md');
  assert.deepEqual(readJson(first.json).bar.standingEngines, STANDING);
  const markdown = renderReport(built);
  assert.match(markdown, /Result: \*\*not certified\*\*/);
  assert.match(markdown, /Grader: test grader \(2026-10-14\)/);
  assert.match(markdown, /\| good \| certified 3\/3 \| certified 3\/3 \| yes \|/);
  assert.match(markdown, /\| stray-write \| unstable 0\/3 \| incomplete 0\/3 \| no \|/);
  assert.match(markdown, /\| no-premise \| blocked 0\/3 \| incomplete 0\/3 \| no \|/);
  assert.match(markdown, /\| crash \| blocked 0\/3 \| incomplete 0\/3 \| no \|/);
  assert.match(markdown, /premise skillReads.write-for-humans: pass/);
  assert.match(markdown, /semantic one-question: pass/);
  assert.match(markdown, /a replicate without a result \(premise not met, transport failure\) blocks certification/);
});

test('a run directory whose suite snapshot was altered is refused', () => {
  const altered = path.join(scratch, 'altered');
  fs.cpSync(runDir, altered, { recursive: true });
  fs.appendFileSync(path.join(altered, 'suites', 'cert', 'cases', 'good', 'prompt.md'), 'edited\n');
  assert.throws(() => buildReport({ runDir: altered, judgments: null, standingEngines: STANDING, replicates: 3 }), /no longer matches its recorded hash/);
  assert.throws(() => buildReport({ runDir: path.join(scratch, 'none'), judgments: null, standingEngines: STANDING, replicates: 3 }), /holds no run/);
});
