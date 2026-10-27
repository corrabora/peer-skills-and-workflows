import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { currentSession, hook, hookConfig, initialize, lookup, readChain, register, report, sessionPointer, titles, update } from '../lib/successor.mjs';

// A commit hook exports its repository and index. Keep this test worker and
// the helper's Git subprocesses confined to the temporary fixture repositories.
for (const key of Object.keys(process.env)) if (key.startsWith('GIT_')) delete process.env[key];

const scratch = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'aw-successor-')));
after(() => fs.rmSync(scratch, { recursive: true, force: true }));
const helper = fileURLToPath(new URL('../successor.mjs', import.meta.url));
function fixture() {
  const dir = fs.mkdtempSync(path.join(scratch, 'case-'));
  const workspace = path.join(dir, 'workspace'); fs.mkdirSync(workspace);
  const home = path.join(dir, 'home'); fs.mkdirSync(home);
  return { dir, workspace, host: { platform: process.platform, home, env: { LOCALAPPDATA: path.join(home, 'AppData', 'Local') } } };
}
function session(f, engine = 'codex', n = 2) {
  const id = crypto.randomUUID();
  const log = path.join(f.dir, engine === 'codex' ? `rollout-test-${id}.jsonl` : `${id}.jsonl`);
  const entries = engine === 'codex'
    ? [{ type: 'session_meta', payload: { id, source: 'cli' } }, ...Array.from({ length: n }, (_, i) => [{ type: 'event_msg', payload: { type: 'task_started', turn_id: `t-${i}` } }, { type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: `prompt ${i}` }] } }]).flat()]
    : Array.from({ length: n }, (_, i) => ({ type: 'user', sessionId: id, uuid: `u-${i}`, parentUuid: i ? `u-${i - 1}` : null, message: { content: `prompt ${i}` } }));
  fs.writeFileSync(log, entries.map((e) => JSON.stringify(e)).join('\n') + '\n');
  return currentSession({ engine, session: id, log, host: f.host });
}
function init(f, caller, extra = {}) { return initialize({ caller, workspace: f.workspace, task: 'Preserve corrections', host: f.host, ...extra }); }
function git(f, ...args) { const r = spawnSync('git', ['-C', f.workspace, ...args], { encoding: 'utf8' }); assert.equal(r.status, 0, r.stderr); return r.stdout; }
function local(f) {
  git(f, 'init', '-q');
  fs.mkdirSync(path.join(f.workspace, '.agent-workflow'));
  fs.appendFileSync(path.join(f.workspace, '.git', 'info', 'exclude'), '\n/.agent-workflow/\n');
}
function prepare(f, s) {
  update(s.root, s.owner, 'capture', { fromLine: 1, scope: 'This synthetic root session contains only the test task.' }, f.host);
  fs.writeFileSync(path.join(s.root, 'continuation.md'), 'The user authorized edits, not publication. Continue the unfinished parser fix.\n');
  return update(s.root, s.owner, 'prepare', {}, f.host);
}
function confirmed() {
  const f = fixture(); const old = session(f, 'codex', 4); const next = session(f, 'claude', 1);
  let s = prepare(f, init(f, old)); const nonce = s.transfer.nonce;
  s = update(s.root, old, 'yield', { nonce }, f.host);
  fs.writeFileSync(path.join(path.dirname(s.transfer.handoff), 'confirmation.md'), `Verified successor and handoff. ${s.transfer.instructions.sha256}\n`);
  s = update(s.root, next, 'accept', { nonce }, f.host);
  return { f, old, next, s, options: { nonce, retiredTitle: titles(s).retired },
    receipt: path.join(path.dirname(s.transfer.handoff), 'retirement.json') };
}

test('partial successor observation publishes no retirement and the same transfer can retry', () => {
  const { f, old, next, s, options, receipt } = confirmed();
  const before = fs.readFileSync(path.join(s.root, 'state.json'), 'utf8');
  const log = fs.readFileSync(next.log, 'utf8');
  fs.appendFileSync(next.log, '{');
  assert.throws(() => update(s.root, old, 'retire', options, f.host), /unterminated/);
  assert.equal(fs.readFileSync(path.join(s.root, 'state.json'), 'utf8'), before);
  assert.equal(fs.existsSync(receipt), false);
  fs.writeFileSync(next.log, log);
  assert.equal(update(s.root, old, 'retire', options, f.host).owner.session, next.session);
});

test('a later succession preserves history and cannot be undone by an older receipt retry', () => {
  const { f, old, next, s, options } = confirmed();
  let current = update(s.root, old, 'retire', options, f.host);
  const third = session(f, 'codex', 2);
  current = prepare(f, current);
  const nonce = current.transfer.nonce;
  const retiredTitle = titles(current).retired;
  update(s.root, next, 'yield', { nonce }, f.host);
  fs.writeFileSync(path.join(path.dirname(current.transfer.handoff), 'confirmation.md'), `Third context verified. ${current.transfer.instructions.sha256}\n`);
  update(s.root, third, 'accept', { nonce }, f.host);
  current = update(s.root, next, 'retire', { nonce, retiredTitle }, f.host);
  assert.equal(current.generation, 3);
  assert.equal(current.lastRetirement.nonce, nonce);
  assert.equal(current.owner.session, third.session);
  assert.deepEqual(current.retired.map((v) => v.session), [old.session, next.session]);
  assert.equal(report(current).countsReport.turns.count, 2);
  assert.throws(() => update(s.root, old, 'retire', options, f.host), /current owner/);
  assert.equal(readChain(s.root).owner.session, third.session);
});

for (const stage of ['counts', 'state', 'receipt']) {
  test(`retirement ${stage} publication failure preserves one committed owner and permits retry`, () => {
    const { f, old, next, s, options, receipt } = confirmed();
    const destination = { counts: s.counts, state: path.join(s.root, 'state.json'), receipt }[stage];
    const rename = fs.renameSync;
    fs.renameSync = (from, to) => {
      if (to === destination) throw new Error(`injected ${stage} publication failure`);
      return rename(from, to);
    };
    try { assert.throws(() => update(s.root, old, 'retire', options, f.host), /injected/); }
    finally { fs.renameSync = rename; }
    const held = readChain(s.root);
    const committed = stage === 'receipt';
    assert.equal(held.owner.session, committed ? next.session : old.session);
    assert.equal(held.generation, committed ? 2 : 1);
    assert.equal(held.transfer?.phase ?? null, committed ? null : 'confirmed');
    assert.equal(report(held).countsReport.session, held.owner.session);
    assert.equal(report(held).countsReport.earlierSessions.some((v) => v.session === next.session), false);
    assert.equal(fs.existsSync(receipt), false);
    if (stage === 'state') assert.equal(JSON.parse(fs.readFileSync(s.counts)).current, next.session);
    const done = update(s.root, old, 'retire', options, f.host);
    assert.equal(done.owner.session, next.session);
    assert.equal(done.generation, 2);
    assert.equal(done.retired.length, 1);
    assert.deepEqual(JSON.parse(fs.readFileSync(receipt)), done.lastRetirement);
    const stateBytes = fs.readFileSync(path.join(s.root, 'state.json'), 'utf8');
    const countsBytes = fs.readFileSync(s.counts, 'utf8');
    fs.appendFileSync(next.log, '{'); // A committed receipt retry needs no fresh observation.
    update(s.root, old, 'retire', options, f.host);
    assert.equal(fs.readFileSync(path.join(s.root, 'state.json'), 'utf8'), stateBytes);
    assert.equal(fs.readFileSync(s.counts, 'utf8'), countsBytes);
    assert.throws(() => update(s.root, next, 'retire', options, f.host), /committed predecessor/);
    assert.throws(() => update(s.root, old, 'retire', { ...options, retiredTitle: 'other' }, f.host), /committed RETIRED title/);
    assert.throws(() => update(s.root, old, 'retire', { ...options, nonce: 'other' }, f.host), /current owner/);
  });

  test(`process exit after ${stage} publication can be reconciled without a second transfer`, () => {
    const { f, old, next, s, options, receipt } = confirmed();
    const destination = { counts: s.counts, state: path.join(s.root, 'state.json'), receipt }[stage];
    const moduleUrl = new URL('../lib/successor.mjs', import.meta.url).href;
    const code = `import fs from 'node:fs';
      import { update } from ${JSON.stringify(moduleUrl)};
      const rename = fs.renameSync;
      fs.renameSync = (from, to) => { rename(from, to); if (to === ${JSON.stringify(destination)}) process.exit(73); };
      update(${JSON.stringify(s.root)}, ${JSON.stringify(old)}, 'retire', ${JSON.stringify(options)}, ${JSON.stringify(f.host)});`;
    const r = spawnSync(process.execPath, ['--input-type=module', '-e', code], { encoding: 'utf8' });
    assert.equal(r.status, 73, r.stderr);
    const held = readChain(s.root);
    assert.equal(held.owner.session, stage === 'counts' ? old.session : next.session);
    assert.equal(report(held).countsReport.session, held.owner.session);
    assert.equal(fs.existsSync(receipt), stage === 'receipt');
    const lock = path.join(s.root, '.lock');
    assert.equal(Number(fs.readFileSync(lock, 'utf8')), r.pid);
    // This child is positively known to have exited on this host; recover its lock.
    fs.unlinkSync(lock);
    const done = update(s.root, old, 'retire', options, f.host);
    assert.equal(done.generation, 2);
    assert.equal(done.retired.length, 1);
    assert.deepEqual(JSON.parse(fs.readFileSync(receipt)), done.lastRetirement);
  });
}

test('late activation observes existing history; reactivation does not reset policy or counts', () => {
  const f = fixture(); const c = session(f, 'codex', 4);
  const s = init(f, c, { turns: 3 });
  assert.equal(report(s).countsReport.due, true);
  assert.equal(report(s).countsReport.turns.count, 4);
  assert.equal(init(f, c, { turns: 99 }).thresholds['turn-threshold'], 3);
  assert.equal(lookup(c.engine, c.session, f.host).id, s.id);
  assert.ok(!fs.existsSync(path.join(f.workspace, '.agent-workflow')));
  assert.ok(!s.root.includes(`${path.sep}scratch${path.sep}`));
  assert.equal(report(update(s.root, c, 'observe', {}, f.host)).countsReport.turns.count, 4);
});

test('local and Run storage reuse established locations; explicit external storage leaves the checkout alone', () => {
  const f = fixture(); local(f);
  const s = init(f, session(f));
  assert.equal(s.root, path.join(f.workspace, '.agent-workflow', 'successions', s.id));
  const external = init(f, session(f), { storage: 'external' });
  assert.ok(!external.root.startsWith(f.workspace));
  const runRoot = path.join(f.workspace, '.agent-workflow', 'runs', 'run-existing'); fs.mkdirSync(runRoot, { recursive: true });
  const run = init(f, session(f), { runRoot });
  assert.equal(run.root, path.join(runRoot, 'control', 'successor'));
  assert.equal(run.counts, path.join(runRoot, 'control', 'coordinator-counts.json'));
  assert.throws(() => init(f, session(f), { runRoot }), /already exists/);
});

test('conflicting local storage and symlinks are refused before records are written', () => {
  const f = fixture(); git(f, 'init', '-q');
  fs.mkdirSync(path.join(f.workspace, '.agent-workflow'));
  assert.throws(() => init(f, session(f)), /wholly untracked/);
  fs.writeFileSync(path.join(f.workspace, '.agent-workflow', 'tracked'), 'owned by repository');
  git(f, 'add', '.agent-workflow/tracked');
  fs.appendFileSync(path.join(f.workspace, '.git', 'info', 'exclude'), '\n/.agent-workflow/\n');
  assert.throws(() => init(f, session(f)), /wholly untracked/);
  assert.deepEqual(fs.readdirSync(path.join(f.workspace, '.agent-workflow')), ['tracked']);
});

test('policy changes check current history and reject invalid limits without overwriting state', () => {
  const f = fixture(); const c = session(f); const s = init(f, c);
  assert.equal(report(update(s.root, c, 'policy', { turns: 1 }, f.host)).countsReport.due, true);
  const before = fs.readFileSync(path.join(s.root, 'state.json'), 'utf8');
  for (const turns of [0, -1, 1.5, NaN, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => update(s.root, c, 'policy', { turns }, f.host), /positive/);
  assert.equal(fs.readFileSync(path.join(s.root, 'state.json'), 'utf8'), before);
});

test('transfer requires yield, fresh identity, confirmation and RETIRED title; one owner resumes with new counts', () => {
  const f = fixture(); const old = session(f, 'codex', 4); const next = session(f, 'claude', 1);
  let s = prepare(f, init(f, old)); const nonce = s.transfer.nonce;
  assert.match(titles(s).successor, /STARTING.*#2$/);
  assert.throws(() => update(s.root, next, 'accept', { nonce }, f.host), /yielded/);
  s = update(s.root, old, 'yield', { nonce }, f.host);
  assert.throws(() => update(s.root, old, 'observe', {}, f.host), /transferring/);
  assert.throws(() => update(s.root, old, 'retire', { nonce }, f.host), /confirmation/);
  assert.throws(() => update(s.root, old, 'accept', { nonce }, f.host), /fresh session/);
  assert.throws(() => update(s.root, next, 'accept', { nonce: 'wrong' }, f.host), /matching nonce/);
  fs.writeFileSync(path.join(path.dirname(s.transfer.handoff), 'confirmation.md'), `Verified nonce, settings, ownership, and STARTING title through the isolated runtime. ${s.transfer.instructions.sha256}\n`);
  s = update(s.root, next, 'accept', { nonce }, f.host);
  assert.equal(s.owner.session, old.session);
  assert.throws(() => update(s.root, old, 'retire', { nonce, retiredTitle: 'idle' }, f.host), /RETIRED title/);
  s = update(s.root, old, 'retire', { nonce, retiredTitle: titles(s).retired }, f.host);
  assert.equal(s.owner.session, next.session);
  assert.equal(s.generation, 2);
  assert.equal(report(s).countsReport.turns.count, 1);
  assert.equal(report(s).countsReport.earlierSessions[0].turns, 4);
  assert.match(titles(s).current, /CURRENT.*#2$/);
  assert.throws(() => update(s.root, old, 'prepare', {}, f.host), /current owner/);
  assert.equal(lookup(next.engine, next.session, f.host).owner.session, next.session);
  assert.ok(fs.existsSync(path.join(s.root, 'handoffs', nonce, 'retirement.json')));
  assert.match(hook(old.engine, { hook_event_name: 'SessionStart', session_id: old.session }, { host: f.host, skill: '/skill' }).hookSpecificOutput.additionalContext, /retired/);
});

test('historical DEAD receipts remain readable and retryable, but new retirements require RETIRED', () => {
  const { f, old, next, s, options } = confirmed();
  const legacyTitle = options.retiredTitle.replace(/^RETIRED — /, 'DEAD — ');
  assert.throws(() => update(s.root, old, 'retire', { ...options, retiredTitle: legacyTitle }, f.host), /exact RETIRED title/);
  const committed = update(s.root, old, 'retire', options, f.host);
  committed.lastRetirement.title = legacyTitle;
  fs.writeFileSync(path.join(s.root, 'state.json'), JSON.stringify(committed));
  assert.equal(readChain(s.root).lastRetirement.title, legacyTitle);
  const replay = update(s.root, old, 'retire', { ...options, retiredTitle: legacyTitle }, f.host);
  assert.equal(replay.owner.session, next.session);
  assert.equal(replay.generation, 2);
  assert.equal(replay.lastRetirement.title, legacyTitle);
  assert.match(titles(replay).retired, /^RETIRED — /);
});

test('both engine hooks restore context, deduplicate observations, guard Stop loops and deactivate on completion', () => {
  for (const engine of ['claude', 'codex']) {
    const f = fixture(); const c = session(f, engine); const s = init(f, c, { turns: 2 });
    const options = { host: f.host, skill: '/skills/successor/SKILL.md' };
    const input = { hook_event_name: 'SessionStart', source: 'compact', session_id: c.session, transcript_path: c.log };
    for (let i = 0; i < 2; i++) assert.match(hook(engine, input, options).hookSpecificOutput.additionalContext, /2\/2 turns/);
    assert.equal(hook(engine, { ...input, hook_event_name: 'Stop' }, options).decision, 'block');
    assert.deepEqual(hook(engine, { ...input, hook_event_name: 'Stop', stop_hook_active: true }, options), {});
    update(s.root, c, 'complete', {}, f.host);
    assert.deepEqual(hook(engine, input, options), {});
    assert.ok(fs.existsSync(path.join(s.root, 'counts.json')));
    assert.deepEqual(hook(engine, { ...input, session_id: crypto.randomUUID() }, options), {});
  }
});

test('recorded compaction events are observed; corrupt or truncated observations remain unverified', () => {
  const f = fixture(); const c = session(f); const s = init(f, c, { compactions: 1 });
  fs.appendFileSync(c.log, JSON.stringify({ type: 'compacted', payload: { compaction_response_id: 'compact-1' } }) + '\n');
  const event = { hook_event_name: 'SessionStart', session_id: c.session };
  const options = { host: f.host, skill: '/skill' };
  assert.match(hook(c.engine, event, options).hookSpecificOutput.additionalContext, /1\/1 compactions/);
  const before = fs.readFileSync(s.counts, 'utf8');
  fs.appendFileSync(c.log, '{');
  assert.match(hook(c.engine, event, options).hookSpecificOutput.additionalContext, /unverified/);
  assert.equal(fs.readFileSync(s.counts, 'utf8'), before);
});

test('pre-persistence hook delivery requests a checkpoint without inventing or replaying event counts', () => {
  for (const engine of ['claude', 'codex']) for (const hookName of ['UserPromptSubmit', 'SessionStart']) {
    const f = fixture(); const c = session(f, engine); const s = init(f, c, { turns: 3, compactions: 1 });
    const options = { host: f.host, skill: '/skills/successor/SKILL.md' };
    const event = { hook_event_name: hookName, source: 'compact', session_id: c.session, transcript_path: c.log };
    for (let i = 0; i < 2; i++) {
      const reminder = hook(engine, event, options).hookSpecificOutput.additionalContext;
      assert.match(reminder, /observed in the session log: 0\/1 compactions, 2\/3 turns/);
      assert.match(reminder, /observe check in this session before task work/);
      assert.doesNotMatch(reminder, /Continue the task/);
    }
    const record = hookName === 'SessionStart'
      ? engine === 'claude' ? { type: 'system', subtype: 'compact_boundary', sessionId: c.session, uuid: 'compact', parentUuid: null, logicalParentUuid: 'u-1' }
        : { type: 'compacted', payload: { compaction_response_id: 'compact' } }
      : engine === 'claude' ? { type: 'user', sessionId: c.session, uuid: 'u-2', parentUuid: 'u-1', message: { content: 'Next task prompt.' } }
        : { type: 'event_msg', payload: { type: 'task_started', turn_id: 'next-turn' } };
    fs.appendFileSync(c.log, JSON.stringify(record) + '\n');
    const observed = update(s.root, c, 'observe', {}, f.host);
    assert.equal(report(observed).countsReport.due, true);
    for (let i = 0; i < 2; i++) assert.match(hook(engine, event, options).hookSpecificOutput.additionalContext, /Succession is due/);
    const counts = report(readChain(s.root)).countsReport;
    assert.equal(counts.turns.count, hookName === 'SessionStart' ? 2 : 3);
    assert.equal(counts.compactions.count, hookName === 'SessionStart' ? 1 : 0);
    assert.equal(hook(engine, { ...event, hook_event_name: 'Stop' }, options).decision, 'block');
    assert.deepEqual(hook(engine, { ...event, hook_event_name: 'Stop', stop_hook_active: true }, options), {});
  }
});

test('state corruption, unsupported versions and concurrent writes never reset records', () => {
  const f = fixture(); const c = session(f); const s = init(f, c);
  const file = path.join(s.root, 'state.json'); const before = fs.readFileSync(file, 'utf8');
  for (const change of [(v) => v.version = 2, (v) => v.owner = {}, (v) => v.thresholds = {}, (v) => v.counts = '/other/counts.json', (v) => v.status = 'invented']) {
    const value = JSON.parse(before); change(value); fs.writeFileSync(file, JSON.stringify(value));
    const bad = fs.readFileSync(file, 'utf8'); assert.throws(() => readChain(s.root));
    assert.throws(() => update(s.root, c, 'observe', {}, f.host));
    assert.equal(fs.readFileSync(file, 'utf8'), bad);
  }
  fs.writeFileSync(file, before); fs.writeFileSync(path.join(s.root, '.lock'), 'unknown');
  assert.throws(() => update(s.root, c, 'observe', {}, f.host), /another state update/);
  assert.equal(fs.readFileSync(file, 'utf8'), before);
});

test('missing session pointer can be repaired without losing chain history', () => {
  const f = fixture(); const c = session(f); const s = init(f, c);
  fs.unlinkSync(sessionPointer(c.engine, c.session, f.host));
  register(s, c, f.host);
  assert.equal(lookup(c.engine, c.session, f.host).id, s.id);
  assert.equal(report(s).countsReport.turns.count, 2);
});

test('re-enabling the same disabled task preserves its chain, policy and observations', () => {
  const f = fixture(); const c = session(f); const s = init(f, c, { turns: 12 });
  update(s.root, c, 'disable', {}, f.host);
  const resumed = init(f, c);
  assert.equal(resumed.id, s.id);
  assert.equal(resumed.status, 'active');
  assert.equal(resumed.thresholds['turn-threshold'], 12);
  assert.equal(report(resumed).countsReport.turns.count, 2);
});

test('foreign and native subagent logs cannot establish the current context', () => {
  const f = fixture(); const c = session(f);
  assert.throws(() => currentSession({ ...c, session: crypto.randomUUID(), host: f.host }), /cannot establish/);
  const lines = fs.readFileSync(c.log, 'utf8').trim().split('\n');
  lines[0] = JSON.stringify({ type: 'session_meta', payload: { id: c.session, parent_thread_id: crypto.randomUUID(), source: { subagent: 'review' } } });
  fs.writeFileSync(c.log, lines.join('\n') + '\n');
  assert.throws(() => currentSession({ ...c, host: f.host }), /cannot establish/);
});

test('hook configuration quotes paths, produces parseable protocol output and rejects unsafe Windows paths', () => {
  const config = hookConfig('codex', "/path/it's $(unsafe)/helper.mjs", '/node path/node', 'darwin');
  assert.equal(Object.keys(config.hooks).length, 3);
  assert.match(config.hooks.Stop[0].hooks[0].command, /'\\''/);
  assert.throws(() => hookConfig('codex', 'C:\\a%PATH%\\helper.mjs', 'C:\\node.exe', 'win32'), /metacharacters/);
  const r = spawnSync(process.execPath, [helper, 'hook-config', '--engine', 'claude'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr); assert.ok(JSON.parse(r.stdout).hooks.SessionStart);
  const h = spawnSync(process.execPath, [helper, 'hook', '--engine', 'codex'], { encoding: 'utf8', input: JSON.stringify({ session_id: crypto.randomUUID(), hook_event_name: 'SessionStart' }) });
  assert.equal(h.status, 0, h.stderr); assert.deepEqual(JSON.parse(h.stdout), {});
});
