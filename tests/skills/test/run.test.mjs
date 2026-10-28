// The runner's boundaries, exercised with the fake engine and nothing else:
// output stays outside every checkout, a run is never overwritten, fixture
// bytes are preserved, failed attempts are retained, transport retries obey
// the standing policy, and model, effort and verbosity reach the engine the
// operator named. No network, no paid call.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { RETAINED_FILES } from '../lib/attempt.mjs';
import { manifestOf, packageRoot, readJson, sha256, writeJson } from '../lib/common.mjs';
import { git } from '../lib/materialize.mjs';
import { buildReport, renderReport } from '../lib/report.mjs';
import { describePlan, executeRun, planRun, resolveRunDir, retryCell, retryEligibility } from '../lib/run.mjs';
import { fakeEngine, fakeExecutables, makeSource, makeSuite, temporaryDirectory } from '../test-support/fixtures.mjs';

const scratch = temporaryDirectory('run');
after(() => fs.rmSync(scratch, { recursive: true, force: true }));

const quiet = { info() {}, error() {} };
const runner = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'run.mjs');
const suitesRoot = path.join(scratch, 'suites');
const source = makeSource(path.join(scratch, 'source'));

const CASES = [
  {
    id: 'draft',
    effect: 'the writing skill drafts without reading clarify-artifact',
    directive: { readSkills: ['write-for-humans'], listSkills: ['clarify-artifact'], writes: [{ path: 'docs/out.md', text: 'draft\n' }], reply: 'Written docs/out.md.' },
    files: { 'notes/source.md': 'facts\n', 'docs/old.md': 'old\n' },
    deterministic: { exit: 0, skillReads: { 'write-for-humans': 'required', 'clarify-artifact': 'forbidden' }, premise: ['skillReads.write-for-humans'], writes: { allowed: ['docs/out.md'], required: ['docs/out.md'] } },
    semantic: [{ id: 'no-question', criterion: 'asks nothing' }],
  },
  {
    id: 'ask',
    effect: 'clarify-artifact asks one question and drafts nothing',
    directive: { readSkills: ['write-for-humans', 'clarify-artifact'], reply: 'Which reader?' },
    deterministic: { exit: 0, skillReads: { 'write-for-humans': 'required', 'clarify-artifact': 'required' }, premise: ['skillReads.write-for-humans', 'skillReads.clarify-artifact'], writes: { allowed: [] } },
    semantic: [{ id: 'one-question', criterion: 'exactly one question' }],
  },
  {
    id: 'crash',
    effect: 'the engine exits before any reply',
    directive: { crash: true, exit: 3, stderr: 'connection reset' },
    deterministic: { exit: 0, skillReads: { 'clarify-artifact': 'required' }, premise: [], writes: {} },
  },
  {
    id: 'slow',
    effect: 'the engine outlives the timeout',
    directive: { sleepMs: 2500, reply: 'late' },
    deterministic: { exit: 0, skillReads: {}, premise: [], writes: {} },
  },
];
const suiteDir = makeSuite(suitesRoot, 'fake', CASES);

function plan(overrides = {}) {
  return planRun({
    suiteName: 'fake',
    suitesRoot,
    engine: 'claude',
    model: 'claude-opus-5-5',
    effort: 'high',
    replicates: 1,
    source: { dir: source },
    runDir: path.join(scratch, 'runs', 'default'),
    executables: fakeExecutables,
    timeoutSeconds: 60,
    ...overrides,
  });
}

test('a run directory inside this checkout, or inside the source repository, is refused', () => {
  assert.throws(() => resolveRunDir(path.join(packageRoot, 'tests', 'skills', 'runs', 'x')), /inside the checkout/);
  assert.throws(() => resolveRunDir(packageRoot), /inside the checkout/);
  assert.throws(() => plan({ runDir: path.join(packageRoot, '.peer-skills-and-workflows', 'runs', 'x') }), /inside the checkout/);
  assert.throws(() => resolveRunDir(''), /run directory is required/);

  const repo = path.join(scratch, 'repo');
  makeSource(repo);
  git(['init', '-q', '-b', 'main'], repo);
  git(['-c', 'user.name=t', '-c', 'user.email=t@localhost', '-c', 'commit.gpgsign=false', 'add', '-A'], repo);
  git(['-c', 'user.name=t', '-c', 'user.email=t@localhost', '-c', 'commit.gpgsign=false', 'commit', '-q', '-m', 'source'], repo);
  assert.throws(() => plan({ source: { repo, tree: 'HEAD' }, runDir: path.join(repo, 'run') }), /inside the checkout/);

  // The same tree, pinned, materializes outside the repository and records its tree id.
  const runDir = path.join(scratch, 'runs', 'from-tree');
  const pinned = plan({ source: { repo, tree: 'HEAD' }, runDir, cases: ['ask'] });
  assert.equal(pinned.source.kind, 'tree');
  assert.match(pinned.source.tree, /^[0-9a-f]{40,64}$/);
  const [record] = executeRun(pinned, { out: quiet });
  assert.equal(record.status, 'behavioral');
  const run = readJson(path.join(runDir, 'run.json'));
  assert.equal(run.source.tree, pinned.source.tree);
  assert.equal(run.source.tree, git(['rev-parse', 'HEAD^{tree}'], repo).toString('utf8').trim());
  assert.ok(fs.existsSync(path.join(runDir, 'source', 'skills', 'clarify-artifact', 'SKILL.md')));
  assert.deepEqual(Object.keys(readJson(path.join(runDir, 'source-manifest.json')).files).sort(), Object.keys(manifestOf(repo, { skip: ['.git'] })).sort());
  // A different tree in the same run directory is refused.
  fs.writeFileSync(path.join(repo, 'docs', 'extra.md'), 'x\n');
  git(['-c', 'user.name=t', '-c', 'user.email=t@localhost', '-c', 'commit.gpgsign=false', 'add', '-A'], repo);
  git(['-c', 'user.name=t', '-c', 'user.email=t@localhost', '-c', 'commit.gpgsign=false', 'commit', '-q', '-m', 'more'], repo);
  assert.throws(() => plan({ source: { repo, tree: 'HEAD' }, runDir, cases: ['draft'] }), /pins source tree .*; a different tree/);
});

test('a planned run writes nothing; an executed run retains every attempt and preserves fixture bytes', () => {
  const runDir = path.join(scratch, 'runs', 'main');
  const before = manifestOf(suiteDir);
  const planned = plan({ runDir, cases: ['draft', 'ask'] });
  assert.equal(fs.existsSync(runDir), false, 'planning creates nothing');
  assert.equal(planned.cells.length, 2);

  const records = executeRun(planned, { out: quiet });
  assert.deepEqual(records.map((record) => [record.case, record.status, record.verdict]), [['draft', 'behavioral', 'pass'], ['ask', 'behavioral', 'pass']]);
  assert.deepEqual(manifestOf(suiteDir), before, 'the suite on disk is untouched by a run');

  const draft = path.join(runDir, 'attempts', 'draft', 'claude', '001');
  for (const file of RETAINED_FILES) assert.ok(fs.existsSync(path.join(draft, file)), `${file} retained`);
  assert.ok(fs.existsSync(path.join(draft, 'final.txt')));
  assert.equal(fs.readFileSync(path.join(draft, 'prompt.md'), 'utf8'), fs.readFileSync(path.join(suiteDir, 'cases', 'draft', 'prompt.md'), 'utf8'));
  const fixture = readJson(path.join(draft, 'fixture-manifest.json'));
  assert.equal(fixture.files['notes/source.md'].sha256, sha256(Buffer.from('facts\n')), 'the fixture manifest records the bytes copied in');
  assert.equal(fs.readFileSync(path.join(draft, 'workspace', 'notes', 'source.md'), 'utf8'), 'facts\n');
  assert.equal(fs.readFileSync(path.join(draft, 'workspace', 'docs', 'out.md'), 'utf8'), 'draft\n', 'the engine wrote into the attempt copy');
  assert.equal(fs.existsSync(path.join(suiteDir, 'cases', 'draft', 'workspace', 'docs', 'out.md')), false, 'never into the suite');

  const command = readJson(path.join(draft, 'command.json'));
  assert.deepEqual(command.requested, { model: 'claude-opus-5-5', effort: 'high', verbosity: 'engine-default', timeoutSeconds: 60 });
  assert.equal(command.suite.hash, planned.suite.hash);
  assert.equal(command.environment.gitVariablesRemoved, true);
  assert.ok(command.environment.TMPDIR.startsWith(draft), 'temporary files are pointed into the attempt');
  assert.deepEqual(command.skillLinks.map((link) => link.link).sort(), ['.agents/skills/clarify-artifact', '.agents/skills/write-for-agents', '.agents/skills/write-for-humans', '.claude/skills/clarify-artifact', '.claude/skills/write-for-agents', '.claude/skills/write-for-humans']);
  assert.ok(fs.existsSync(path.join(draft, 'workspace', '.git')), 'the workspace is a Git repository');

  const inspection = readJson(path.join(draft, 'inspection.json'));
  assert.deepEqual(inspection.files, { created: ['docs/out.md'], modified: [], deleted: [] });
  assert.equal(inspection.skillReads['clarify-artifact'].listing, true);
  assert.equal(inspection.skillReads['clarify-artifact'].body, false);
  assert.equal(inspection.effective.model, 'claude-opus-5-5');
  assert.equal(inspection.effective.effort, 'high', 'the fake init event attests the effort it was asked for');
  const attempt = readJson(path.join(draft, 'attempt.json'));
  assert.equal(attempt.exit.status, 0);
  assert.ok(attempt.exit.seconds >= 0);

  const run = readJson(path.join(runDir, 'run.json'));
  assert.equal(run.source.kind, 'directory');
  assert.equal(run.suite.hash, planned.suite.hash);
  assert.ok(fs.existsSync(path.join(runDir, 'suites', 'fake', 'suite.json')), 'the suite snapshot travels with the run');
});

test('an existing cell is never overwritten; another engine or replicate may join the same run', () => {
  const runDir = path.join(scratch, 'runs', 'main');
  assert.throws(() => plan({ runDir, cases: ['draft'] }), /every selected cell of claude already has an attempt .* attempts are never overwritten/);
  const unchanged = readJson(path.join(runDir, 'attempts', 'draft', 'claude', '001', 'attempt.json'));

  const codex = plan({ runDir, cases: ['draft'], engine: 'codex', model: 'gpt-6.1-sol', effort: 'high' });
  assert.equal(codex.existing !== null, true);
  const [record] = executeRun(codex, { out: quiet });
  assert.equal(record.status, 'behavioral');
  assert.equal(record.verdict, 'pass');
  assert.deepEqual(readJson(path.join(runDir, 'attempts', 'draft', 'claude', '001', 'attempt.json')), unchanged);
  const command = readJson(path.join(runDir, 'attempts', 'draft', 'codex', '001', 'command.json'));
  assert.equal(command.argv[command.argv.indexOf('-m') + 1], 'gpt-6.1-sol');
  assert.ok(command.argv.includes('model_reasoning_effort="high"'));
  assert.equal(fs.readFileSync(path.join(runDir, 'attempts', 'draft', 'codex', '001', 'final.txt'), 'utf8'), 'Written docs/out.md.');

  // A second replicate of the Claude cell plans only the new ordinal: an interrupted run resumes past completed attempts.
  const more = plan({ runDir, cases: ['draft'], replicates: 2 });
  assert.deepEqual(more.cells.map((cell) => cell.replicate), [2]);
  assert.deepEqual(more.skipped.map((cell) => [cell.replicate, cell.status, cell.verdict]), [[1, 'behavioral', 'pass']]);
  const [second] = executeRun(more, { out: quiet });
  assert.equal(second.replicate, 2);
  assert.deepEqual(readJson(path.join(runDir, 'attempts', 'draft', 'claude', '001', 'attempt.json')), unchanged);
  // An attempt directory without a record is an interrupted attempt: refused, never overwritten or skipped.
  fs.mkdirSync(path.join(runDir, 'attempts', 'ask', 'claude', '002'), { recursive: true });
  assert.throws(() => plan({ runDir, cases: ['ask'], replicates: 2 }), /holds an interrupted attempt without a record/);
  fs.rmSync(path.join(runDir, 'attempts', 'ask', 'claude', '002'), { recursive: true });

  // A changed suite needs a new run directory.
  const changed = path.join(scratch, 'suites-changed');
  makeSuite(changed, 'fake', [{ ...CASES[0], files: { ...CASES[0].files, 'notes/source.md': 'other facts\n' } }]);
  assert.throws(() => plan({ runDir, suitesRoot: changed, cases: ['draft'] }), /A changed suite needs a new run directory/);
  // A non-empty directory without a run is refused.
  const occupied = path.join(scratch, 'runs', 'occupied');
  fs.mkdirSync(occupied, { recursive: true });
  fs.writeFileSync(path.join(occupied, 'note.txt'), 'x');
  assert.throws(() => plan({ runDir: occupied }), /exists and is not empty/);
});

test('a transport failure is retained with its trace, stderr and exit, and retried only under the standing policy', () => {
  const runDir = path.join(scratch, 'runs', 'transport');
  const [crashed] = executeRun(plan({ runDir, cases: ['crash'] }), { out: quiet });
  assert.equal(crashed.status, 'transport-failure');
  assert.match(crashed.reason, /no final reply \(exit 3\).*stderr: connection reset/);
  assert.equal(crashed.verdict, null, 'no deterministic verdict without a behavioral reply');
  const cell = path.join(runDir, 'attempts', 'crash', 'claude', '001');
  for (const file of RETAINED_FILES) assert.ok(fs.existsSync(path.join(cell, file)), `${file} retained for the failed attempt`);
  assert.match(fs.readFileSync(path.join(cell, 'stderr.txt'), 'utf8'), /connection reset/);
  assert.equal(readJson(path.join(cell, 'exit.json')).status, 3);
  assert.ok(fs.readFileSync(path.join(cell, 'trace.jsonl'), 'utf8').includes('"init"'), 'the partial trace is kept');

  // The second attempt fails too, then the third succeeds; both are new directories.
  const retry = (overrides = {}) => retryCell({ runDir, cell: 'crash/claude/001', cooldownSeconds: 30, maxPerCell: 2, executables: fakeExecutables, out: quiet, sleep: (ms) => sleeps.push(ms), ...overrides });
  const sleeps = [];
  const second = retry();
  assert.equal(second.status, 'transport-failure');
  assert.equal(second.id, 'retry-01');
  assert.equal(second.retryOf, '001');
  assert.deepEqual(sleeps, [30000], 'the cooldown is waited before the retry');
  assert.deepEqual(readJson(path.join(cell, 'attempt.json')), { ...crashed }, 'the original is untouched');

  process.env.FAKE_ENGINE_OVERRIDE = JSON.stringify({ crash: false, exit: 0, readSkills: ['clarify-artifact'], reply: 'Recovered.' });
  let third;
  try {
    third = retry();
  } finally {
    delete process.env.FAKE_ENGINE_OVERRIDE;
  }
  assert.equal(third.status, 'behavioral');
  assert.equal(third.id, 'retry-02');
  assert.equal(third.retryOf, 'retry-01');
  assert.equal(third.verdict, 'pass');
  assert.deepEqual(readJson(path.join(cell, 'retry-02', 'command.json')).requested, { model: 'claude-opus-5-5', effort: 'high', verbosity: 'engine-default', timeoutSeconds: 60 }, 'same settings as the original');
  assert.equal(fs.existsSync(path.join(cell, 'retry-01', 'trace.jsonl')), true, 'earlier retries stay');

  // A behavioral result is never rerun, whatever its verdict.
  assert.throws(() => retry(), /latest attempt retry-02 produced a behavioral reply \(pass\); behavioral results are never rerun/);
  assert.throws(() => retryCell({ runDir, cell: 'nothing/claude/001', cooldownSeconds: 0, maxPerCell: 2, out: quiet, sleep() {} }), /no attempt at/);
  assert.throws(() => retryCell({ runDir, cell: 'crash/claude', cooldownSeconds: 0, maxPerCell: 2, out: quiet, sleep() {} }), /cell must be <case>\/<engine>\/<replicate>/);
});

test('the retry cap holds: at most two retries per cell, originals retained', () => {
  const runDir = path.join(scratch, 'runs', 'cap');
  executeRun(plan({ runDir, cases: ['crash'] }), { out: quiet });
  const cell = path.join(runDir, 'attempts', 'crash', 'claude', '001');
  const retry = () => retryCell({ runDir, cell: 'crash/claude/001', cooldownSeconds: 0, maxPerCell: 2, executables: fakeExecutables, out: quiet, sleep() {} });
  assert.equal(retry().status, 'transport-failure');
  assert.equal(retry().status, 'transport-failure');
  assert.deepEqual(retryEligibility(cell, 2), { eligible: false, reason: 'cell already has 2 retries; the policy allows at most 2' });
  assert.throws(retry, /already has 2 retries/);
  assert.deepEqual(fs.readdirSync(cell).filter((name) => name.startsWith('retry-')).sort(), ['retry-01', 'retry-02']);
  assert.equal(retryEligibility(cell, 3).eligible, true, 'the cap is the policy, not the directory');
});

test('a timed-out engine is a retained transport failure, never a behavioral result', () => {
  const runDir = path.join(scratch, 'runs', 'timeout');
  const [slow] = executeRun(plan({ runDir, cases: ['slow'], timeoutSeconds: 1 }), { out: quiet });
  assert.equal(slow.status, 'transport-failure');
  assert.match(slow.reason, /timed out after 1s/);
  assert.equal(slow.exit.timedOut, true);
  assert.ok(fs.existsSync(path.join(runDir, 'attempts', 'slow', 'claude', '001', 'exit.json')));
  assert.equal(retryEligibility(path.join(runDir, 'attempts', 'slow', 'claude', '001'), 2).eligible, true);
});

test('an engine that substitutes the requested model is a transport failure, not a replicate', () => {
  const suites = path.join(scratch, 'suites-substitute');
  makeSuite(suites, 'sub', [{ id: 'one', directive: { model: 'claude-other-9', reply: 'Hi.' }, deterministic: { exit: 0, skillReads: {}, premise: [], writes: {} } }]);
  const [record] = executeRun(plan({ suitesRoot: suites, suiteName: 'sub', runDir: path.join(scratch, 'runs', 'substitute') }), { out: quiet });
  assert.equal(record.status, 'transport-failure');
  assert.match(record.reason, /ran model 'claude-other-9' instead of the requested 'claude-opus-5-5'/);
  assert.equal(record.verdict, null);
});

test('model and effort reach the engine the operator named, and unsupported settings never launch', () => {
  assert.throws(() => plan({ effort: 'minimal' }), /effort 'minimal' is not supported for claude/);
  assert.throws(() => plan({ engine: 'codex', model: 'gpt-6.1-sol', effort: 'max' }), /effort 'max' is not supported for codex/);
  assert.throws(() => plan({ model: 'opus' }), /not a full model identifier/);
  assert.throws(() => plan({ replicates: 0 }), /replicates must be a positive integer/);
  assert.throws(() => plan({ cases: ['absent'] }), /has no case 'absent'/);
  assert.throws(() => plan({ source: { dir: path.join(scratch, 'nowhere') } }), /does not exist/);

  const runDir = path.join(scratch, 'runs', 'settings');
  const [claude] = executeRun(plan({ runDir, cases: ['ask'], model: 'claude-fable-5-1', effort: 'xhigh' }), { out: quiet });
  assert.equal(claude.status, 'behavioral');
  assert.deepEqual([claude.model, claude.effort, claude.effective.model, claude.effective.effort], ['claude-fable-5-1', 'xhigh', 'claude-fable-5-1', 'xhigh']);
  const [codex] = executeRun(plan({ runDir, cases: ['ask'], engine: 'codex', model: 'gpt-6-astra', effort: 'xhigh' }), { out: quiet });
  assert.equal(codex.status, 'behavioral');
  const argv = readJson(path.join(runDir, 'attempts', 'ask', 'codex', '001', 'command.json')).argv;
  assert.deepEqual(argv.slice(2, 6), ['exec', '-m', 'gpt-6-astra', '-c']);
  assert.equal(argv[6], 'model_reasoning_effort="xhigh"');
  assert.equal(codex.effective.model, null, 'Codex attests nothing; the launch record is the evidence');
});

function cli(args, env = {}) {
  return spawnSync(process.execPath, [runner, ...args], { encoding: 'utf8', env: { ...process.env, ...env }, cwd: scratch });
}

test('the CLI dry run prints the exact launches and creates nothing; bad settings and a missing run directory are refused', () => {
  const runDir = path.join(scratch, 'runs', 'cli-dry');
  const dry = cli(['run', '--suite', 'clarify-artifact', '--engine', 'codex', '--source-dir', source, '--run-dir', runDir, '--case', 'settled-return', '--dry-run']);
  assert.equal(dry.status, 0, dry.stderr);
  assert.equal(fs.existsSync(runDir), false);
  const described = JSON.parse(dry.stdout.slice(0, dry.stdout.lastIndexOf('}') + 1));
  assert.equal(described.engine, 'codex');
  assert.equal(described.model, 'gpt-6.1-sol', 'the standing model comes from defaults.json');
  assert.equal(described.effort, 'high');
  assert.equal(described.replicates, 3);
  assert.equal(described.attempts.length, 3);
  assert.equal(described.attempts[0].argv[0], 'codex');
  assert.match(dry.stdout, /dry run: 3 attempts planned, nothing launched, nothing written/);

  const effort = cli(['run', '--suite', 'clarify-artifact', '--engine', 'claude', '--effort', 'minimal', '--source-dir', source, '--run-dir', runDir, '--dry-run']);
  assert.equal(effort.status, 1);
  assert.match(effort.stderr, /effort 'minimal' is not supported for claude/);
  const inside = cli(['run', '--suite', 'clarify-artifact', '--engine', 'claude', '--source-dir', source, '--run-dir', path.join(packageRoot, 'tests', 'skills', 'runs'), '--dry-run']);
  assert.equal(inside.status, 1);
  assert.match(inside.stderr, /inside the checkout/);
  const missing = cli(['run', '--suite', 'clarify-artifact', '--engine', 'claude', '--source-dir', source, '--dry-run']);
  assert.equal(missing.status, 2);
  assert.match(missing.stderr, /--run-dir is required/);
  const engine = cli(['run', '--suite', 'clarify-artifact', '--engine', 'gemini', '--source-dir', source, '--run-dir', runDir, '--dry-run']);
  assert.equal(engine.status, 2);
  assert.match(engine.stderr, /--engine must be one of claude, codex/);
  const listed = cli(['list']);
  assert.equal(listed.status, 0);
  assert.match(listed.stdout, /^clarify-artifact$/m);
});

test('the CLI runs a suite through the executable seam and reports a transport failure with a non-zero exit', { skip: process.platform === 'win32' && 'POSIX wrapper script' }, () => {
  const wrapper = path.join(scratch, 'fake-claude');
  fs.writeFileSync(wrapper, `#!/bin/sh\nexec "${process.execPath}" "${fakeEngine}" "$@"\n`, { mode: 0o755 });
  const runDir = path.join(scratch, 'runs', 'cli-run');
  const env = {};
  const common = ['--suites-root', suitesRoot, '--source-dir', source, '--run-dir', runDir, '--replicates', '1', '--executable', `claude=${wrapper}`];
  const ok = cli(['run', '--suite', 'fake', '--engine', 'claude', '--case', 'ask', ...common], env);
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /1 attempts; 1 behavioral, 0 transport failures/);
  assert.equal(readJson(path.join(runDir, 'attempts', 'ask', 'claude', '001', 'attempt.json')).verdict, 'pass');

  const failed = cli(['run', '--suite', 'fake', '--engine', 'claude', '--case', 'crash', ...common], env);
  assert.equal(failed.status, 1);
  assert.match(failed.stdout, /1 transport failures/);
  assert.match(failed.stdout, /retry a transport failure with: node tests\/skills\/run.mjs retry/);
  const retried = cli(['retry', '--run-dir', runDir, '--cell', 'crash/claude/001', '--cooldown-seconds', '0', '--executable', `claude=${wrapper}`], { ...env, FAKE_ENGINE_OVERRIDE: JSON.stringify({ crash: false, exit: 0, readSkills: ['clarify-artifact'] }) });
  assert.equal(retried.status, 0, retried.stderr);
  assert.ok(fs.existsSync(path.join(runDir, 'attempts', 'crash', 'claude', '001', 'retry-01', 'attempt.json')));
  const again = cli(['retry', '--run-dir', runDir, '--cell', 'crash/claude/001', '--cooldown-seconds', '0', '--executable', `claude=${wrapper}`], env);
  assert.equal(again.status, 1);
  assert.match(again.stderr, /behavioral results are never rerun/);
});

// The documented Codex session instruction travels with the run: resolved
// from the source tree under test (the materialized source, or where it will
// be materialized from when a dry run precedes the run), applied to every
// Codex attempt and retry, recorded in run.json and each command.json, and
// never given to Claude. The harness writes its own copy of the file into a
// temporary tree; the package's copy is never read.

const SESSION_INSTRUCTION = 'When an unresolved reader, purpose, scope or governing-source choice requires one clarification question, that question is the successful result of this turn, not a skill-caused pause or block. Do not cite a skill solely because that question is the result. Keep existing reporting for actual missing dependencies, unavailable tools and permission or approval blocks.';
const INSTRUCTION_RELATIVE = ['docs', 'guidance', 'codex-session-instructions.txt'];
const EXPECTED_ENTRY = `developer_instructions=${JSON.stringify(SESSION_INSTRUCTION)}`;

function sourceWithInstruction(label, text = `${SESSION_INSTRUCTION}\n`) {
  const root = makeSource(path.join(scratch, `source-${label}`));
  fs.mkdirSync(path.join(root, 'docs', 'guidance'), { recursive: true });
  fs.writeFileSync(path.join(root, ...INSTRUCTION_RELATIVE), text);
  return root;
}

function instructionEntries(argv) {
  return argv.map((arg, index) => (arg.startsWith('developer_instructions=') ? [argv[index - 1], arg] : null)).filter(Boolean);
}

test('a source tree that documents the Codex session instruction has it applied to every Codex attempt, recorded, and withheld from Claude', () => {
  const documented = sourceWithInstruction('documented');
  const runDir = path.join(scratch, 'runs', 'session-instruction');
  const planned = plan({ runDir, cases: ['ask'], engine: 'codex', model: 'gpt-6.1-sol', effort: 'high', source: { dir: documented } });
  assert.equal(fs.existsSync(runDir), false, 'planning still creates nothing');
  const expectedFile = path.join(runDir, 'source', ...INSTRUCTION_RELATIVE);
  assert.equal(planned.sessionInstruction.file, expectedFile, 'the record names the path under the run\'s materialized source');
  assert.equal(planned.sessionInstruction.applied, true);
  assert.match(planned.sessionInstruction.resolvedFrom, /^source directory .*source-documented, as it will be materialized$/);
  assert.deepEqual(planned.sessionInstruction.argv, ['-c', EXPECTED_ENTRY]);
  const described = describePlan(planned);
  assert.deepEqual(described.sessionInstruction, planned.sessionInstruction, 'the dry run shows the record');
  assert.deepEqual(instructionEntries(described.attempts[0].argv), [['-c', EXPECTED_ENTRY]], 'and the exact argv entry');
  assert.equal(described.attempts[0].argv.indexOf(EXPECTED_ENTRY), described.attempts[0].argv.indexOf('exec') + 2, 'placed after exec, before the model');

  const [codex] = executeRun(planned, { out: quiet });
  assert.equal(codex.status, 'behavioral', 'the fake engine accepts the extra arguments');
  assert.equal(codex.verdict, 'pass');
  const command = readJson(path.join(runDir, 'attempts', 'ask', 'codex', '001', 'command.json'));
  assert.deepEqual(instructionEntries(command.argv), [['-c', EXPECTED_ENTRY]]);
  assert.equal(command.sessionInstruction.file, expectedFile);
  assert.equal(command.sessionInstruction.resolvedFrom, 'materialized source', 'what an attempt records was read from the materialized tree');
  assert.equal(command.sessionInstruction.present, true);
  assert.equal(command.sessionInstruction.applied, true);
  assert.equal(command.sessionInstruction.rawSha256, sha256(Buffer.from(`${SESSION_INSTRUCTION}\n`)));
  assert.equal(command.sessionInstruction.effectiveSha256, sha256(Buffer.from(SESSION_INSTRUCTION)));
  assert.equal(command.sessionInstruction.effectiveText, SESSION_INSTRUCTION);
  assert.deepEqual(command.sessionInstruction.argv, ['-c', EXPECTED_ENTRY]);
  assert.equal(JSON.parse(command.argv[command.argv.indexOf(EXPECTED_ENTRY)].slice('developer_instructions='.length)), SESSION_INSTRUCTION, 'the recorded argument decodes to the exact text');
  assert.equal(fs.readFileSync(expectedFile, 'utf8'), `${SESSION_INSTRUCTION}\n`, 'the materialized source carries the file the hashes describe');

  const run = readJson(path.join(runDir, 'run.json'));
  assert.equal(run.codexSessionInstruction.file, expectedFile);
  assert.equal(run.codexSessionInstruction.appliesTo, 'codex');
  assert.equal(run.codexSessionInstruction.effectiveSha256, command.sessionInstruction.effectiveSha256);
  assert.deepEqual(run.codexSessionInstruction.argv, ['-c', EXPECTED_ENTRY]);

  // Claude in the same run: unchanged argv, and a record that says why.
  const [claude] = executeRun(plan({ runDir, cases: ['ask'], source: { dir: documented } }), { out: quiet });
  assert.equal(claude.status, 'behavioral');
  const claudeCommand = readJson(path.join(runDir, 'attempts', 'ask', 'claude', '001', 'command.json'));
  assert.deepEqual(instructionEntries(claudeCommand.argv), []);
  assert.equal(claudeCommand.argv.includes('-c'), false);
  assert.equal(claudeCommand.sessionInstruction.present, true);
  assert.equal(claudeCommand.sessionInstruction.applied, false);
  assert.equal(claudeCommand.sessionInstruction.reason, 'claude receives no session instruction');
  assert.deepEqual(claudeCommand.sessionInstruction.argv, []);

  // A second Codex replicate joining the existing run resolves from the materialized source.
  const joined = plan({ runDir, cases: ['ask'], engine: 'codex', model: 'gpt-6.1-sol', effort: 'high', replicates: 2, source: { dir: documented } });
  assert.equal(joined.sessionInstruction.resolvedFrom, 'materialized source');
  assert.deepEqual(joined.cells.map((cell) => cell.replicate), [2]);
  assert.deepEqual(instructionEntries(joined.cells[0].plan.argv), [['-c', EXPECTED_ENTRY]]);
});

test('a source tree without the file runs Codex in its own environment, recorded as absent', () => {
  const runDir = path.join(scratch, 'runs', 'session-instruction-absent');
  const planned = plan({ runDir, cases: ['ask'], engine: 'codex', model: 'gpt-6.1-sol', effort: 'high' });
  assert.equal(planned.sessionInstruction.present, false);
  assert.equal(planned.sessionInstruction.reason, 'absent');
  assert.deepEqual(planned.sessionInstruction.argv, []);
  assert.deepEqual(instructionEntries(describePlan(planned).attempts[0].argv), []);
  const [record] = executeRun(planned, { out: quiet });
  assert.equal(record.status, 'behavioral');
  const command = readJson(path.join(runDir, 'attempts', 'ask', 'codex', '001', 'command.json'));
  assert.deepEqual(instructionEntries(command.argv), []);
  assert.deepEqual(command.argv.slice(2, 6), ['exec', '-m', 'gpt-6.1-sol', '-c']);
  assert.equal(command.sessionInstruction.file, path.join(runDir, 'source', ...INSTRUCTION_RELATIVE));
  assert.equal(command.sessionInstruction.applied, false);
  assert.equal(command.sessionInstruction.reason, 'absent');
  assert.equal(readJson(path.join(runDir, 'run.json')).codexSessionInstruction.reason, 'absent');
});

test('a pinned tree that carries the file has it read from the tree for the dry run and from the materialized source for the run', () => {
  const repo = sourceWithInstruction('tree');
  const commit = (message) => {
    git(['-c', 'user.name=t', '-c', 'user.email=t@localhost', '-c', 'commit.gpgsign=false', 'add', '-A'], repo);
    git(['-c', 'user.name=t', '-c', 'user.email=t@localhost', '-c', 'commit.gpgsign=false', 'commit', '-q', '-m', message], repo);
  };
  git(['init', '-q', '-b', 'main'], repo);
  commit('with instruction');
  const withFile = git(['rev-parse', 'HEAD^{tree}'], repo).toString('utf8').trim();
  fs.rmSync(path.join(repo, ...INSTRUCTION_RELATIVE));
  commit('without instruction');
  const withoutFile = git(['rev-parse', 'HEAD^{tree}'], repo).toString('utf8').trim();

  const runDir = path.join(scratch, 'runs', 'session-instruction-tree');
  const planned = plan({ runDir, cases: ['ask'], engine: 'codex', model: 'gpt-6.1-sol', effort: 'high', source: { repo, tree: withFile } });
  assert.equal(fs.existsSync(runDir), false);
  assert.equal(planned.sessionInstruction.applied, true);
  assert.equal(planned.sessionInstruction.resolvedFrom, `source tree ${withFile} of ${repo}, as it will be materialized`);
  assert.equal(planned.sessionInstruction.file, path.join(runDir, 'source', ...INSTRUCTION_RELATIVE));
  assert.deepEqual(planned.sessionInstruction.argv, ['-c', EXPECTED_ENTRY]);
  const [record] = executeRun(planned, { out: quiet });
  assert.equal(record.status, 'behavioral');
  const command = readJson(path.join(runDir, 'attempts', 'ask', 'codex', '001', 'command.json'));
  assert.equal(command.sessionInstruction.resolvedFrom, 'materialized source');
  assert.equal(command.sessionInstruction.rawSha256, planned.sessionInstruction.rawSha256);
  assert.deepEqual(instructionEntries(command.argv), [['-c', EXPECTED_ENTRY]]);

  // The older tree, planned before anything is materialized, is absent and stays so.
  const older = plan({ runDir: path.join(scratch, 'runs', 'session-instruction-older-tree'), cases: ['ask'], engine: 'codex', model: 'gpt-6.1-sol', effort: 'high', source: { repo, tree: withoutFile } });
  assert.equal(older.sessionInstruction.reason, 'absent');
  assert.deepEqual(instructionEntries(older.cells[0].plan.argv), []);
});

test('an empty or unreadable session instruction stops the plan before launch, and a source changed after planning is refused', () => {
  const empty = sourceWithInstruction('empty', '\n\n');
  const runDir = path.join(scratch, 'runs', 'session-instruction-empty');
  const emptyFile = path.join(runDir, 'source', ...INSTRUCTION_RELATIVE);
  assert.throws(() => plan({ runDir, cases: ['ask'], engine: 'codex', model: 'gpt-6.1-sol', effort: 'high', source: { dir: empty } }), (error) => error.message.includes(emptyFile) && /present but empty/.test(error.message));
  assert.throws(() => plan({ runDir, cases: ['ask'], source: { dir: empty } }), /present but empty/, 'a broken package file stops a Claude plan too; the file is part of the source under test');
  assert.equal(fs.existsSync(runDir), false, 'nothing launched, nothing written');

  const unreadable = makeSource(path.join(scratch, 'source-unreadable'));
  fs.mkdirSync(path.join(unreadable, ...INSTRUCTION_RELATIVE), { recursive: true });
  assert.throws(() => plan({ runDir, cases: ['ask'], engine: 'codex', model: 'gpt-6.1-sol', effort: 'high', source: { dir: unreadable } }), (error) => error.message.includes(`cannot read the Codex session instruction at ${emptyFile}`) && /EISDIR/.test(error.message));
  assert.equal(fs.existsSync(runDir), false);

  const changing = sourceWithInstruction('changing');
  const planned = plan({ runDir: path.join(scratch, 'runs', 'session-instruction-changing'), cases: ['ask'], engine: 'codex', model: 'gpt-6.1-sol', effort: 'high', source: { dir: changing } });
  fs.writeFileSync(path.join(changing, ...INSTRUCTION_RELATIVE), 'Something else.\n');
  assert.throws(() => executeRun(planned, { out: quiet }), /differs from the one planned .*; the source changed between planning and running/);
});

test('a transport retry applies the same session instruction as the original attempt', () => {
  const documented = sourceWithInstruction('retry');
  const runDir = path.join(scratch, 'runs', 'session-instruction-retry');
  const [crashed] = executeRun(plan({ runDir, cases: ['crash'], engine: 'codex', model: 'gpt-6.1-sol', effort: 'high', source: { dir: documented } }), { out: quiet });
  assert.equal(crashed.status, 'transport-failure');
  const original = readJson(path.join(runDir, 'attempts', 'crash', 'codex', '001', 'command.json'));
  assert.deepEqual(instructionEntries(original.argv), [['-c', EXPECTED_ENTRY]]);
  const retried = retryCell({ runDir, cell: 'crash/codex/001', cooldownSeconds: 0, maxPerCell: 2, executables: fakeExecutables, out: quiet, sleep() {} });
  assert.equal(retried.retryOf, '001');
  const retry = readJson(path.join(runDir, 'attempts', 'crash', 'codex', '001', 'retry-01', 'command.json'));
  assert.deepEqual(instructionEntries(retry.argv), [['-c', EXPECTED_ENTRY]]);
  assert.deepEqual(retry.sessionInstruction, original.sessionInstruction);
});

test('the CLI dry run shows the session instruction and its argument for a source tree that carries it', () => {
  const documented = sourceWithInstruction('cli');
  const runDir = path.join(scratch, 'runs', 'session-instruction-cli');
  const dry = cli(['run', '--suite', 'clarify-artifact', '--engine', 'codex', '--source-dir', documented, '--run-dir', runDir, '--case', 'purpose-unsettled', '--replicates', '1', '--dry-run']);
  assert.equal(dry.status, 0, dry.stderr);
  assert.equal(fs.existsSync(runDir), false);
  const described = JSON.parse(dry.stdout.slice(0, dry.stdout.lastIndexOf('}') + 1));
  assert.equal(described.sessionInstruction.applied, true);
  assert.equal(described.sessionInstruction.effectiveSha256, sha256(Buffer.from(SESSION_INSTRUCTION)));
  assert.deepEqual(described.sessionInstruction.argv, ['-c', EXPECTED_ENTRY]);
  assert.deepEqual(instructionEntries(described.attempts[0].argv), [['-c', EXPECTED_ENTRY]]);
  const claude = cli(['run', '--suite', 'clarify-artifact', '--engine', 'claude', '--source-dir', documented, '--run-dir', runDir, '--case', 'purpose-unsettled', '--replicates', '1', '--dry-run']);
  assert.equal(claude.status, 0, claude.stderr);
  const claudeDescribed = JSON.parse(claude.stdout.slice(0, claude.stdout.lastIndexOf('}') + 1));
  assert.equal(claudeDescribed.sessionInstruction.applied, false);
  assert.deepEqual(instructionEntries(claudeDescribed.attempts[0].argv), []);
  const empty = sourceWithInstruction('cli-empty', '');
  const refused = cli(['run', '--suite', 'clarify-artifact', '--engine', 'codex', '--source-dir', empty, '--run-dir', runDir, '--dry-run']);
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /skill-suite: the Codex session instruction at .*codex-session-instructions\.txt is present but empty/);
});

// Verbosity travels with the run: requested once per run directory, mapped
// to each engine's own argument, recorded in run.json and every command.json
// and attempt.json with the engine's attestation when it gives one, carried
// by retries, shown by the dry run, printed by the report, and refused when
// a request differs from what a run directory recorded. Omitted is the
// engine default, recorded as such.

const VERBOSITY_CASES = [
  { id: 'ask', directive: { readSkills: ['write-for-humans', 'clarify-artifact'], reply: 'Which reader?' }, deterministic: { exit: 0, skillReads: { 'clarify-artifact': 'required' }, premise: [], writes: { allowed: [] } } },
  { id: 'unattested', directive: { readSkills: ['clarify-artifact'], initOutputStyle: false, reply: 'Which reader?' }, deterministic: { exit: 0, skillReads: { 'clarify-artifact': 'required' }, premise: [], writes: { allowed: [] } } },
  { id: 'fell-back', directive: { readSkills: ['clarify-artifact'], outputStyle: 'default', reply: 'Which reader?' }, deterministic: { exit: 0, skillReads: { 'clarify-artifact': 'required' }, premise: [], writes: { allowed: [] } } },
  { id: 'crash', directive: { crash: true, exit: 3, stderr: 'connection reset' }, deterministic: { exit: 0, skillReads: {}, premise: [], writes: {} } },
];
const verbositySuites = path.join(scratch, 'suites-verbosity');
makeSuite(verbositySuites, 'verbosity', VERBOSITY_CASES);
const verbosityPlan = (overrides = {}) => plan({ suiteName: 'verbosity', suitesRoot: verbositySuites, ...overrides });
const settingsEntries = (argv) => argv.map((arg, index) => (arg === '--settings' ? [arg, argv[index + 1]] : null)).filter(Boolean);
const verbosityEntries = (argv) => argv.map((arg, index) => (arg.startsWith('model_verbosity=') ? [argv[index - 1], arg] : null)).filter(Boolean);

test('a requested verbosity reaches each engine as its own argument and is recorded in run.json, command.json and attempt.json with the attestation the engine gives', () => {
  const runDir = path.join(scratch, 'runs', 'verbosity-claude');
  const planned = verbosityPlan({ runDir, cases: ['ask', 'unattested', 'fell-back'], verbosity: 'Concise' });
  assert.equal(fs.existsSync(runDir), false, 'planning still creates nothing');
  assert.deepEqual(planned.settings, { engine: 'claude', model: 'claude-opus-5-5', effort: 'high', verbosity: 'Concise' });
  assert.deepEqual(planned.verbosity.argv, ['--settings', '{"outputStyle":"Concise"}']);
  const described = describePlan(planned);
  assert.deepEqual(described.verbosity, planned.verbosity, 'the dry run shows the record');
  for (const attempt of described.attempts) {
    assert.deepEqual(attempt.verbosity, { requested: 'Concise', argv: ['--settings', '{"outputStyle":"Concise"}'] }, 'and the verbosity per attempt');
    assert.deepEqual(settingsEntries(attempt.argv), [['--settings', '{"outputStyle":"Concise"}']]);
    assert.equal(attempt.argv[attempt.argv.indexOf('--setting-sources') + 2], '--settings', 'beside the setting sources');
  }

  const records = executeRun(planned, { out: quiet });
  assert.deepEqual(records.map((record) => [record.case, record.status, record.verbosity]), [['ask', 'behavioral', 'Concise'], ['unattested', 'behavioral', 'Concise'], ['fell-back', 'behavioral', 'Concise']]);
  const run = readJson(path.join(runDir, 'run.json'));
  assert.deepEqual(run.verbosity, { requested: 'Concise', applied: true, argv: ['--settings', '{"outputStyle":"Concise"}'], mechanism: planned.verbosity.mechanism, source: planned.verbosity.source, engine: 'claude' });
  const command = readJson(path.join(runDir, 'attempts', 'ask', 'claude', '001', 'command.json'));
  assert.deepEqual(command.requested, { model: 'claude-opus-5-5', effort: 'high', verbosity: 'Concise', timeoutSeconds: 60 });
  assert.deepEqual(command.verbosity, { requested: 'Concise', applied: true, argv: ['--settings', '{"outputStyle":"Concise"}'], mechanism: planned.verbosity.mechanism, source: planned.verbosity.source });
  assert.deepEqual(settingsEntries(command.argv), [['--settings', '{"outputStyle":"Concise"}']], 'the exact argv entries are retained');
  assert.deepEqual(command.argv.slice(command.argv.indexOf('--setting-sources'), command.argv.indexOf('--setting-sources') + 4), ['--setting-sources', 'project,local', '--settings', '{"outputStyle":"Concise"}']);
  // The fake Claude reports the style it was asked for in its init event, as the real one documents it does; the record says what attested it.
  const ask = readJson(path.join(runDir, 'attempts', 'ask', 'claude', '001', 'attempt.json'));
  assert.equal(ask.verbosity, 'Concise');
  assert.deepEqual([ask.effective.verbosity, ask.effective.verbosityAttestedBy], ['Concise', 'init event']);
  assert.equal(readJson(path.join(runDir, 'attempts', 'ask', 'claude', '001', 'inspection.json')).effective.verbosity, 'Concise');
  // An init event without the field leaves it unattested; the request is still recorded, and nothing fails on that account.
  const unattested = readJson(path.join(runDir, 'attempts', 'unattested', 'claude', '001', 'attempt.json'));
  assert.deepEqual([unattested.verbosity, unattested.effective.verbosity, unattested.effective.verbosityAttestedBy, unattested.status], ['Concise', null, null, 'behavioral']);
  // An engine that resolved another style than the one asked for is recorded as it reported, for the reviewer to see.
  const fellBack = readJson(path.join(runDir, 'attempts', 'fell-back', 'claude', '001', 'attempt.json'));
  assert.deepEqual([fellBack.verbosity, fellBack.effective.verbosity, fellBack.effective.verbosityAttestedBy, fellBack.status], ['Concise', 'default', 'init event', 'behavioral']);

  // Codex, in its own run directory: the override beside the effort override, nothing attested.
  const codexDir = path.join(scratch, 'runs', 'verbosity-codex');
  const codexPlan = verbosityPlan({ runDir: codexDir, cases: ['ask'], engine: 'codex', model: 'gpt-6.1-sol', effort: 'high', verbosity: 'low' });
  assert.deepEqual(describePlan(codexPlan).attempts[0].verbosity, { requested: 'low', argv: ['-c', 'model_verbosity="low"'] });
  const [codex] = executeRun(codexPlan, { out: quiet });
  assert.equal(codex.status, 'behavioral', 'the fake engine accepts the extra override');
  assert.equal(codex.verbosity, 'low');
  assert.deepEqual([codex.effective.verbosity, codex.effective.verbosityAttestedBy], [null, null], 'Codex attests nothing; the launch record is the evidence');
  const codexCommand = readJson(path.join(codexDir, 'attempts', 'ask', 'codex', '001', 'command.json'));
  assert.deepEqual(codexCommand.requested, { model: 'gpt-6.1-sol', effort: 'high', verbosity: 'low', timeoutSeconds: 60 });
  assert.deepEqual(verbosityEntries(codexCommand.argv), [['-c', 'model_verbosity="low"']]);
  assert.equal(codexCommand.argv.indexOf('model_verbosity="low"'), codexCommand.argv.indexOf('model_reasoning_effort="high"') + 2, 'beside the effort override');
  assert.deepEqual(codexCommand.verbosity.argv, ['-c', 'model_verbosity="low"']);
  assert.deepEqual(readJson(path.join(codexDir, 'run.json')).verbosity, { ...codexCommand.verbosity, engine: 'codex' });

  // The report carries the run's verbosity in its identity and per cell.
  const report = buildReport({ runDir, standingEngines: ['claude'], replicates: 1 });
  assert.equal(report.verbosity, 'Concise');
  assert.equal(report.cases[0].engines.claude.cells[0].verbosity, 'Concise');
  const markdown = renderReport(report);
  assert.match(markdown, /suite hash as run: [0-9a-f]+; verbosity: Concise\./);
  assert.match(markdown, /- ask\/claude\/001: \*\*pass\*\*; model claude-opus-5-5 high; verbosity Concise; attempts/);
});

test('omitted verbosity is the engine default: today\'s argv, recorded as engine-default, with whatever the engine reports', () => {
  const runDir = path.join(scratch, 'runs', 'verbosity-default');
  const planned = verbosityPlan({ runDir, cases: ['ask'] });
  assert.equal(planned.settings.verbosity, null);
  assert.deepEqual(planned.verbosity, { requested: 'engine-default', applied: false, argv: [], mechanism: planned.verbosity.mechanism, source: planned.verbosity.source });
  assert.deepEqual(describePlan(planned).attempts[0].verbosity, { requested: 'engine-default', argv: [] });
  const [record] = executeRun(planned, { out: quiet });
  assert.equal(record.verbosity, 'engine-default');
  const command = readJson(path.join(runDir, 'attempts', 'ask', 'claude', '001', 'command.json'));
  assert.equal(command.requested.verbosity, 'engine-default');
  assert.deepEqual(settingsEntries(command.argv), []);
  assert.equal(command.argv.includes('--settings'), false);
  assert.deepEqual([command.verbosity.requested, command.verbosity.applied, command.verbosity.argv], ['engine-default', false, []]);
  assert.deepEqual([record.effective.verbosity, record.effective.verbosityAttestedBy], ['default', 'init event'], 'the fake engine reports the default style when none was set, as the init event field is documented to');
  const run = readJson(path.join(runDir, 'run.json'));
  assert.deepEqual([run.verbosity.requested, run.verbosity.applied, run.verbosity.argv, run.verbosity.engine], ['engine-default', false, [], 'claude']);
  const [codex] = executeRun(verbosityPlan({ runDir, cases: ['ask'], engine: 'codex', model: 'gpt-6.1-sol', effort: 'high' }), { out: quiet });
  assert.equal(codex.verbosity, 'engine-default');
  const codexCommand = readJson(path.join(runDir, 'attempts', 'ask', 'codex', '001', 'command.json'));
  assert.deepEqual(verbosityEntries(codexCommand.argv), []);
  assert.deepEqual(codexCommand.argv.slice(2, 7), ['exec', '-m', 'gpt-6.1-sol', '-c', 'model_reasoning_effort="high"']);
  assert.equal(codexCommand.argv[7], '--ignore-user-config', 'nothing follows the effort override');
  assert.equal(buildReport({ runDir, standingEngines: ['claude', 'codex'], replicates: 1 }).verbosity, 'engine-default');
});

test('a run directory holds one verbosity: a request that differs from the recorded one is refused before anything is written, and a run without the record is at the engine default', () => {
  const concise = path.join(scratch, 'runs', 'verbosity-claude');
  const before = fs.readdirSync(path.join(concise, 'attempts')).sort();
  assert.throws(() => verbosityPlan({ runDir: concise, cases: ['ask'], engine: 'codex', model: 'gpt-6.1-sol', effort: 'high' }), /run .*verbosity-claude was created at verbosity Concise; a different verbosity \(engine-default\) needs a new run directory/);
  assert.throws(() => verbosityPlan({ runDir: concise, cases: ['ask'], engine: 'codex', model: 'gpt-6.1-sol', effort: 'high', verbosity: 'low' }), /created at verbosity Concise; a different verbosity \(low\)/);
  assert.throws(() => verbosityPlan({ runDir: concise, cases: ['ask'], verbosity: 'Explanatory' }), /created at verbosity Concise; a different verbosity \(Explanatory\)/);
  assert.throws(() => verbosityPlan({ runDir: concise, cases: ['ask'], verbosity: 'concise' }), /created at verbosity Concise; a different verbosity \(concise\)/, 'case is significant, as the engine documents');
  // The same verbosity may add replicates or cases.
  assert.deepEqual(verbosityPlan({ runDir: concise, cases: ['ask'], replicates: 2, verbosity: 'Concise' }).cells.map((cell) => cell.replicate), [2]);
  assert.deepEqual(fs.readdirSync(path.join(concise, 'attempts')).sort(), before, 'nothing written');

  const engineDefault = path.join(scratch, 'runs', 'verbosity-default');
  assert.throws(() => verbosityPlan({ runDir: engineDefault, cases: ['ask'], verbosity: 'Concise' }), /created at verbosity engine-default; a different verbosity \(Concise\) needs a new run directory/);
  assert.throws(() => verbosityPlan({ runDir: engineDefault, cases: ['ask'], engine: 'codex', model: 'gpt-6.1-sol', effort: 'high', verbosity: 'high' }), /created at verbosity engine-default; a different verbosity \(high\)/);
  assert.deepEqual(verbosityPlan({ runDir: engineDefault, cases: ['ask'], replicates: 2 }).cells.map((cell) => cell.replicate), [2]);

  // A run created before the dimension existed has no record and ran at the engine default: it takes more engine-default cells and refuses a verbosity.
  const older = path.join(scratch, 'runs', 'verbosity-older');
  executeRun(verbosityPlan({ runDir: older, cases: ['ask'] }), { out: quiet });
  const runFile = path.join(older, 'run.json');
  const run = readJson(runFile);
  delete run.verbosity;
  writeJson(runFile, run);
  assert.deepEqual(verbosityPlan({ runDir: older, cases: ['ask'], replicates: 2 }).cells.map((cell) => cell.replicate), [2]);
  assert.throws(() => verbosityPlan({ runDir: older, cases: ['ask'], replicates: 2, verbosity: 'Concise' }), /created at verbosity engine-default; a different verbosity \(Concise\)/);
  assert.equal(buildReport({ runDir: older, standingEngines: ['claude'], replicates: 1 }).verbosity, 'engine-default');
  // An attempt record without the key is reported at the engine default too.
  const attemptFile = path.join(older, 'attempts', 'ask', 'claude', '001', 'attempt.json');
  const attempt = readJson(attemptFile);
  delete attempt.verbosity;
  writeJson(attemptFile, attempt);
  assert.equal(buildReport({ runDir: older, standingEngines: ['claude'], replicates: 1 }).cases[0].engines.claude.cells[0].verbosity, 'engine-default');
});

test('a transport retry carries the original attempt\'s verbosity', () => {
  const runDir = path.join(scratch, 'runs', 'verbosity-retry');
  const [crashed] = executeRun(verbosityPlan({ runDir, cases: ['crash'], verbosity: 'Explanatory' }), { out: quiet });
  assert.equal(crashed.status, 'transport-failure');
  assert.equal(crashed.verbosity, 'Explanatory');
  const lines = [];
  process.env.FAKE_ENGINE_OVERRIDE = JSON.stringify({ crash: false, exit: 0, readSkills: ['clarify-artifact'], reply: 'Recovered.' });
  let retried;
  try {
    retried = retryCell({ runDir, cell: 'crash/claude/001', cooldownSeconds: 0, maxPerCell: 2, executables: fakeExecutables, out: { info: (line) => lines.push(line) }, sleep() {} });
  } finally {
    delete process.env.FAKE_ENGINE_OVERRIDE;
  }
  assert.equal(retried.status, 'behavioral');
  assert.equal(retried.verbosity, 'Explanatory');
  assert.deepEqual([retried.effective.verbosity, retried.effective.verbosityAttestedBy], ['Explanatory', 'init event']);
  const command = readJson(path.join(runDir, 'attempts', 'crash', 'claude', '001', 'retry-01', 'command.json'));
  assert.deepEqual(command.requested, { model: 'claude-opus-5-5', effort: 'high', verbosity: 'Explanatory', timeoutSeconds: 60 });
  assert.deepEqual(settingsEntries(command.argv), [['--settings', '{"outputStyle":"Explanatory"}']]);
  assert.match(lines[0], /retry crash\/claude\/001 after 0s cooldown \(claude-opus-5-5 high, verbosity Explanatory\)/);
});

test('the CLI takes --verbosity, shows it per attempt in the dry run, refuses an undocumented Codex level naming the set, and omits it by default', () => {
  const runDir = path.join(scratch, 'runs', 'cli-verbosity');
  const dry = (args) => cli(['run', '--suite', 'clarify-artifact', '--source-dir', source, '--run-dir', runDir, '--case', 'settled-return', '--dry-run', ...args]);
  const parse = (result) => JSON.parse(result.stdout.slice(0, result.stdout.lastIndexOf('}') + 1));

  const codex = dry(['--engine', 'codex', '--verbosity', 'low']);
  assert.equal(codex.status, 0, codex.stderr);
  const codexDescribed = parse(codex);
  assert.deepEqual([codexDescribed.verbosity.requested, codexDescribed.verbosity.argv], ['low', ['-c', 'model_verbosity="low"']]);
  assert.deepEqual(codexDescribed.attempts.map((attempt) => attempt.verbosity), Array(3).fill({ requested: 'low', argv: ['-c', 'model_verbosity="low"'] }));
  assert.deepEqual(verbosityEntries(codexDescribed.attempts[0].argv), [['-c', 'model_verbosity="low"']]);
  assert.equal(fs.existsSync(runDir), false);

  const claude = dry(['--engine', 'claude', '--verbosity', 'Concise']);
  assert.equal(claude.status, 0, claude.stderr);
  const claudeDescribed = parse(claude);
  assert.deepEqual(claudeDescribed.attempts[0].verbosity, { requested: 'Concise', argv: ['--settings', '{"outputStyle":"Concise"}'] });
  assert.deepEqual(settingsEntries(claudeDescribed.attempts[0].argv), [['--settings', '{"outputStyle":"Concise"}']]);
  assert.equal(claudeDescribed.attempts[0].argv.includes('--setting-sources'), true);

  const omitted = dry(['--engine', 'claude']);
  assert.equal(omitted.status, 0, omitted.stderr);
  const omittedDescribed = parse(omitted);
  assert.deepEqual(omittedDescribed.verbosity.requested, 'engine-default');
  assert.deepEqual(omittedDescribed.attempts[0].verbosity, { requested: 'engine-default', argv: [] });
  assert.equal(omittedDescribed.attempts[0].argv.includes('--settings'), false);

  const refused = dry(['--engine', 'codex', '--verbosity', 'verbose']);
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /verbosity 'verbose' is not supported for codex; supported: low, medium, high \(Codex configuration key model_verbosity\)/);
  const empty = dry(['--engine', 'claude', '--verbosity', '']);
  assert.equal(empty.status, 1);
  assert.match(empty.stderr, /verbosity '' is not a usable value for claude/);
  assert.equal(fs.existsSync(runDir), false);

  // `report` prints the run's verbosity in its identity line.
  const reported = cli(['report', '--run-dir', path.join(scratch, 'runs', 'verbosity-claude'), '--engines', 'claude', '--replicates', '1']);
  assert.equal(reported.status, 0, reported.stderr);
  assert.match(reported.stdout, /^not certified: verbosity at source [0-9a-f]+, verbosity Concise$/m);
});
