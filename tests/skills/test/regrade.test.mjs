// Observe-only criteria and re-grading against a revised suite: an
// observe-only criterion is reported in its own place and never counts, a
// retained run is reported or reinspected against a revised suite only when
// its case ids, fixtures and prompts match the recorded suite, and the report
// then records both suite hashes and the criteria that changed.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { readJson, writeJson } from '../lib/common.mjs';
import { git } from '../lib/materialize.mjs';
import { reinspectRun } from '../lib/reinspect.mjs';
import { buildReport, loadJudgments, renderReport } from '../lib/report.mjs';
import { compareSuites, loadRevisedSuite } from '../lib/revise.mjs';
import { executeRun, planRun } from '../lib/run.mjs';
import { loadSuite } from '../lib/suite.mjs';
import { fakeExecutables, makeSource, makeSuite, temporaryDirectory } from '../test-support/fixtures.mjs';

const scratch = temporaryDirectory('regrade');
after(() => fs.rmSync(scratch, { recursive: true, force: true }));

const quiet = { info() {}, error() {} };
const runner = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'run.mjs');
const suitesRoot = path.join(scratch, 'suites');
const source = makeSource(path.join(scratch, 'source'));
const runDir = path.join(scratch, 'run');
const STANDING = ['claude', 'codex'];

// Two cases: `quiet` has a certifying intent criterion and an observe-only
// catch-all; `plain` has a deterministic rule a revision will tighten.
const CASES = [
  {
    id: 'quiet',
    directive: { readSkills: ['write-for-humans'], writes: [{ path: 'docs/out.md', text: 'draft\n' }], reply: 'Written docs/out.md. Should the cutoff apply all winter?' },
    files: { 'notes/source.md': 'facts\n' },
    deterministic: { exit: 0, skillReads: { 'write-for-humans': 'required', 'clarify-artifact': 'forbidden' }, premise: ['skillReads.write-for-humans'], writes: { allowed: ['docs/out.md'], required: ['docs/out.md'] } },
    semantic: [
      { id: 'no-intent-question', criterion: 'no question about reader, purpose or scope' },
      { id: 'no-question', criterion: 'asks the user nothing at all', observe: true },
    ],
  },
  {
    id: 'plain',
    directive: { readSkills: ['clarify-artifact'], listSkills: ['write-for-agents'], reply: 'Reader, purpose, constraints.' },
    deterministic: { exit: 0, skillReads: { 'clarify-artifact': 'required' }, premise: [], writes: { allowed: [] } },
    semantic: [],
  },
];
makeSuite(suitesRoot, 'scoped', CASES);

function run(engine, replicates = 1) {
  return executeRun(planRun({ suiteName: 'scoped', suitesRoot, engine, model: engine === 'claude' ? 'claude-opus-5-5' : 'gpt-6.1-sol', effort: 'high', replicates, source: { dir: source }, runDir, executables: fakeExecutables, timeoutSeconds: 60 }), { out: quiet });
}

function judgmentsFile(name, judgments) {
  const file = path.join(scratch, `${name}.json`);
  writeJson(file, { grader: 'test grader', graded: '2026-10-14', judgments });
  return loadJudgments(file);
}

/** A copy of the maintained suite under a new root, with `edit` applied to the copy's directory. */
function revision(label, edit) {
  const root = path.join(scratch, `revisions`, label);
  fs.mkdirSync(root, { recursive: true });
  fs.cpSync(path.join(suitesRoot, 'scoped'), path.join(root, 'scoped'), { recursive: true });
  edit(path.join(root, 'scoped'));
  return root;
}

function editCase(suiteDir, id, change) {
  const file = path.join(suiteDir, 'cases', id, 'case.json');
  const def = readJson(file);
  change(def);
  writeJson(file, def);
}

test('an observe-only criterion is reported in its own place and never counts, graded or not', () => {
  run('claude');
  run('codex');
  const judgments = judgmentsFile('observe', {
    'quiet/claude/001': { criteria: { 'no-intent-question': { pass: true }, 'no-question': { pass: false, note: 'asks about the cutoff' } } },
    'quiet/codex/001': { criteria: { 'no-intent-question': { pass: true } } },
  });
  const report = buildReport({ runDir, judgments, standingEngines: STANDING, replicates: 1 });
  const quietCase = report.cases.find((caseDef) => caseDef.id === 'quiet');
  assert.equal(quietCase.engines.claude.status, 'certified', 'a failed observe-only criterion leaves the case certified');
  assert.equal(quietCase.engines.codex.status, 'certified', 'an ungraded observe-only criterion leaves the case certified');
  assert.equal(quietCase.certified, true);
  const claudeCell = quietCase.engines.claude.cells[0];
  assert.deepEqual(claudeCell.semantic.criteria, { 'no-intent-question': { result: 'pass', note: null } });
  assert.deepEqual(claudeCell.semantic.observed, { 'no-question': { result: 'fail', note: 'asks about the cutoff' } });
  assert.deepEqual(quietCase.engines.claude.observed, { 'no-question': { pass: 0, fail: 1, ungraded: 0, 'not-applicable': 0 } });
  assert.deepEqual(quietCase.engines.codex.observed, { 'no-question': { pass: 0, fail: 0, ungraded: 1, 'not-applicable': 0 } });
  assert.equal(report.certified, true);
  assert.equal(report.suite.revised, null);

  const markdown = renderReport(report);
  assert.match(markdown, /\| Case \| claude \| codex \| Certified \| claude observe-only \| codex observe-only \|/);
  assert.match(markdown, /\| quiet \| certified 1\/1 \| certified 1\/1 \| yes \| no-question: 0 pass, 1 fail, 0 ungraded \| no-question: 0 pass, 0 fail, 1 ungraded \|/);
  assert.match(markdown, /\| plain \| certified 1\/1 \| certified 1\/1 \| yes \| none \| none \|/);
  assert.match(markdown, /- observe-only no-question: fail; asks about the cutoff/);
  assert.match(markdown, /observe-only criteria are reported but never counted/);

  // A failed certifying criterion still makes the case unstable.
  const failing = judgmentsFile('failing', { 'quiet/claude/001': { criteria: { 'no-intent-question': { pass: false }, 'no-question': { pass: false } } } });
  assert.equal(buildReport({ runDir, judgments: failing, standingEngines: STANDING, replicates: 1 }).cases.find((caseDef) => caseDef.id === 'quiet').engines.claude.status, 'unstable');
  assert.throws(() => loadSuite('scoped', revision('bad-observe', (dir) => editCase(dir, 'quiet', (def) => { def.semantic[1].observe = 'yes'; }))), /observe must be true or false/);
});

test('a revised suite with a changed fixture, prompt, case set or skill list is refused', () => {
  const existing = readJson(path.join(runDir, 'run.json'));
  const recorded = loadSuite('scoped', path.join(runDir, 'suites'));
  const fixture = revision('fixture', (dir) => fs.appendFileSync(path.join(dir, 'cases', 'quiet', 'workspace', 'notes', 'source.md'), 'more\n'));
  assert.throws(() => loadRevisedSuite(runDir, existing, fixture), /case quiet: fixture differs/);
  const prompt = revision('prompt', (dir) => fs.appendFileSync(path.join(dir, 'cases', 'quiet', 'prompt.md'), 'Also mention the ford.\n'));
  assert.throws(() => loadRevisedSuite(runDir, existing, prompt), /case quiet: prompt differs/);
  const dropped = revision('dropped', (dir) => { const def = readJson(path.join(dir, 'suite.json')); def.cases = ['quiet']; writeJson(path.join(dir, 'suite.json'), def); });
  assert.throws(() => loadRevisedSuite(runDir, existing, dropped), /case plain missing from the revised suite/);
  const skills = revision('skills', (dir) => { const def = readJson(path.join(dir, 'suite.json')); def.skills = def.skills.slice(0, 2); writeJson(path.join(dir, 'suite.json'), def); });
  assert.throws(() => loadRevisedSuite(runDir, existing, skills), /installed skills/);
  assert.throws(() => compareSuites(recorded, loadSuite('scoped', fixture)), /only expectations and criteria may change/);
  assert.throws(() => loadRevisedSuite(runDir, existing, path.join(scratch, 'nowhere')), /neither a directory nor a tree-ish/);
  assert.throws(() => buildReport({ runDir, standingEngines: STANDING, replicates: 1, suite: fixture }), /fixture differs/);
  assert.throws(() => reinspectRun({ runDir, out: quiet, suite: prompt }), /prompt differs/);
  assert.equal(fs.readdirSync(path.join(runDir, 'suites-revised')).length, 0, 'a refused revision is not retained');
  assert.equal(fs.existsSync(path.join(runDir, 'attempts', 'quiet', 'claude', '001', 'inspection.001.json')), false, 'a refused reinspect changes nothing');
});

test('a revision that changes only criteria is accepted: the report carries both hashes and the changes, and the revised suite is retained', () => {
  const existing = readJson(path.join(runDir, 'run.json'));
  const criteria = revision('criteria', (dir) => editCase(dir, 'quiet', (def) => {
    def.semantic = [
      { id: 'no-intent-question', criterion: 'no question about the reader, the purpose or the scope of docs/out.md' },
      { id: 'no-question', criterion: 'asks the user nothing at all', observe: true },
      { id: 'no-invented-facts', criterion: 'nothing beyond notes/source.md' },
    ];
  }));
  const revised = loadRevisedSuite(runDir, existing, criteria);
  assert.notEqual(revised.hash, existing.suite.hash);
  assert.equal(revised.recordedHash, existing.suite.hash);
  assert.deepEqual(revised.diff, [{ case: 'quiet', effect: false, deterministic: false, semantic: { added: ['no-invented-facts'], removed: [], changed: ['no-intent-question'] } }]);
  assert.equal(revised.retained, path.join(runDir, 'suites-revised', revised.hash, 'scoped'));
  assert.equal(loadSuite('scoped', path.dirname(revised.retained)).hash, revised.hash, 'the retained copy hashes as the revision');
  assert.deepEqual(revised.source, { kind: 'directory', path: path.join(criteria, 'scoped') });

  const judgments = judgmentsFile('revised', {
    'quiet/claude/001': { criteria: { 'no-intent-question': { pass: true }, 'no-question': { pass: false }, 'no-invented-facts': { pass: true } } },
    'quiet/codex/001': { criteria: { 'no-intent-question': { pass: true }, 'no-question': { pass: true }, 'no-invented-facts': { pass: true } } },
  });
  const report = buildReport({ runDir, judgments, standingEngines: STANDING, replicates: 1, suite: criteria });
  assert.equal(report.suite.hash, existing.suite.hash, 'the hash as run');
  assert.equal(report.suite.revised.hash, revised.hash);
  assert.deepEqual(report.suite.revised.diff, revised.diff);
  assert.equal(report.suite.revised.retained, revised.retained);
  const quietCase = report.cases.find((caseDef) => caseDef.id === 'quiet');
  assert.deepEqual(Object.keys(quietCase.engines.claude.cells[0].semantic.criteria), ['no-intent-question', 'no-invented-facts'], 'graded against the revised criteria');
  assert.equal(quietCase.certified, true);
  const markdown = renderReport(report);
  assert.match(markdown, new RegExp(`suite hash as run: ${existing.suite.hash}`));
  assert.match(markdown, new RegExp(`Graded against revised suite ${revised.hash} \\(.*; retained at .*suites-revised.*\\); fixtures and prompts identical to the run's; changes: quiet \\(criteria added: no-invented-facts; criteria changed: no-intent-question\\)`));

  // Passing the suite directory itself, or the same revision twice, resolves to the same retained copy.
  assert.equal(loadRevisedSuite(runDir, existing, path.join(criteria, 'scoped')).retained, revised.retained);
  assert.deepEqual(fs.readdirSync(path.join(runDir, 'suites-revised')), [revised.hash], 'retained once, no staging leftovers');
  // The recorded suite itself is accepted with no changes.
  assert.deepEqual(loadRevisedSuite(runDir, existing, path.join(runDir, 'suites')).diff, []);
});

test('a revision that changes deterministic expectations must be inspected under before it is reported; inspect --suite does that and records both hashes', () => {
  const existing = readJson(path.join(runDir, 'run.json'));
  // `plain` listed write-for-agents; the revision forbids reading it (still a pass) and requires nothing new.
  const tightened = revision('tightened', (dir) => editCase(dir, 'plain', (def) => { def.deterministic.skillReads['write-for-agents'] = 'forbidden'; }));
  assert.throws(() => buildReport({ runDir, standingEngines: STANDING, replicates: 1, suite: tightened }), /changes deterministic expectations of plain, but these cells were inspected under another suite: plain\/claude\/001, plain\/codex\/001\. Run inspect --suite first/);

  const result = reinspectRun({ runDir, out: quiet, suite: tightened, cells: ['plain/claude/001', 'plain/codex/001'] });
  assert.equal(result.suite.recorded, existing.suite.hash);
  assert.notEqual(result.suite.judged, existing.suite.hash);
  assert.equal(result.suite.revised.hash, result.suite.judged);
  assert.deepEqual(result.suite.revised.diff, [{ case: 'plain', effect: false, deterministic: true, semantic: { added: [], removed: [], changed: [] } }]);
  assert.equal(result.outcomes.every((outcome) => outcome.ok && outcome.after.verdict === 'pass'), true, JSON.stringify(result.outcomes));
  const inspection = readJson(path.join(runDir, 'attempts', 'plain', 'claude', '001', 'inspection.json'));
  assert.deepEqual(inspection.suite, { hash: result.suite.judged, recorded: existing.suite.hash });
  assert.equal(inspection.checks.some((check) => check.id === 'skillReads.write-for-agents' && check.pass), true, 'judged by the revised expectations');
  assert.equal(inspection.previous[0].suiteHash, existing.suite.hash, 'the kept inspection was judged under the recorded suite');

  const report = buildReport({ runDir, standingEngines: STANDING, replicates: 1, suite: tightened });
  assert.equal(report.cases.find((caseDef) => caseDef.id === 'plain').certified, true);
  assert.equal(report.cases.find((caseDef) => caseDef.id === 'plain').engines.claude.cells[0].deterministic.suiteHash, result.suite.judged);
});

test('a revision may be named by a tree-ish of a repository holding tests/skills/suites/<name>', () => {
  const repo = path.join(scratch, 'repo');
  fs.mkdirSync(path.join(repo, 'tests', 'skills', 'suites'), { recursive: true });
  fs.cpSync(path.join(suitesRoot, 'scoped'), path.join(repo, 'tests', 'skills', 'suites', 'scoped'), { recursive: true });
  editCase(path.join(repo, 'tests', 'skills', 'suites', 'scoped'), 'quiet', (def) => { def.effect = 'revised effect'; });
  git(['init', '-q', '-b', 'main'], repo);
  git(['-c', 'user.name=t', '-c', 'user.email=t@localhost', '-c', 'commit.gpgsign=false', 'add', '-A'], repo);
  git(['-c', 'user.name=t', '-c', 'user.email=t@localhost', '-c', 'commit.gpgsign=false', 'commit', '-q', '-m', 'revised'], repo);
  const existing = readJson(path.join(runDir, 'run.json'));
  const revised = loadRevisedSuite(runDir, existing, 'HEAD', { repo });
  assert.equal(revised.source.kind, 'tree');
  assert.equal(revised.source.repo, fs.realpathSync.native(repo));
  assert.match(revised.source.tree, /^[0-9a-f]{40,64}$/);
  assert.deepEqual(revised.diff, [{ case: 'quiet', effect: true, deterministic: false, semantic: { added: [], removed: [], changed: [] } }]);
  assert.ok(fs.existsSync(path.join(revised.retained, 'suite.json')));
  assert.throws(() => loadRevisedSuite(runDir, existing, 'no-such-ref', { repo }), /neither a directory nor a tree-ish/);

  const cli = spawnSync(process.execPath, [runner, 'report', '--run-dir', runDir, '--suite', 'HEAD', '--repo', repo, '--replicates', '1'], { encoding: 'utf8', cwd: scratch });
  assert.equal(cli.status, 0, cli.stderr);
  assert.match(cli.stdout, new RegExp(`graded against revised suite ${revised.hash} \\(run recorded ${existing.suite.hash}\\)`));
  const reports = fs.readdirSync(path.join(runDir, 'reports')).filter((name) => name.endsWith('.json')).sort();
  assert.equal(readJson(path.join(runDir, 'reports', reports.at(-1))).suite.revised.hash, revised.hash);
  const noRepo = spawnSync(process.execPath, [runner, 'report', '--run-dir', runDir, '--repo', repo], { encoding: 'utf8', cwd: scratch });
  assert.equal(noRepo.status, 2);
  assert.match(noRepo.stderr, /--repo applies only with --suite/);
});
