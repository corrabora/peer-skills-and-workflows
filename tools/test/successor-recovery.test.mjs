import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { hook, initialize, readChain, report, titles, update } from '../lib/successor.mjs';
import { readRecovery } from '../lib/successor-recovery.mjs';
import { readSources } from '../lib/successor-instructions.mjs';

// A commit hook exports its repository and index. Keep this test worker and
// the helper's Git subprocesses confined to the temporary fixture repositories.
for (const key of Object.keys(process.env)) if (key.startsWith('GIT_')) delete process.env[key];

const scratch = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'successor-recovery-')));
after(() => fs.rmSync(scratch, { recursive: true, force: true }));
const helper = fileURLToPath(new URL('../successor.mjs', import.meta.url));
function message(c, id, text) {
  return c.engine === 'claude' ? { type: 'user', sessionId: c.session, uuid: id, parentUuid: id === 'initial' ? null : 'initial', message: { content: text } }
    : { type: 'response_item', payload: { type: 'message', role: 'user', id, content: [{ type: 'input_text', text }] } };
}
function session(f, engine) {
  const c = { engine, session: crypto.randomUUID() };
  c.log = path.join(f.dir, engine === 'claude' ? `${c.session}.jsonl` : `rollout-recovery-${c.session}.jsonl`);
  const rows = engine === 'codex' ? [{ type: 'session_meta', payload: { id: c.session, source: 'cli' } },
    { type: 'event_msg', payload: { type: 'task_started', turn_id: 'turn-1' } }] : [];
  rows.push(message(c, 'initial', 'Keep the task read-only across every successor.'));
  fs.writeFileSync(c.log, rows.map(JSON.stringify).join('\n') + '\n'); return c;
}
function fixture(engine = 'codex', phase = 'yielded', coordinator = false) {
  const dir = fs.mkdtempSync(path.join(scratch, 'case-')); const home = path.join(dir, 'home');
  fs.mkdirSync(home); const workspace = path.join(dir, 'work'); fs.mkdirSync(workspace);
  const f = { dir, workspace, host: { platform: process.platform, home, env: { LOCALAPPDATA: path.join(home, 'AppData') } } };
  f.old = session(f, engine); f.next = session(f, engine === 'claude' ? 'codex' : 'claude');
  let runRoot;
  if (coordinator) {
    assert.equal(spawnSync('git', ['init', '-q', workspace]).status, 0);
    fs.appendFileSync(path.join(workspace, '.git', 'info', 'exclude'), '\n/.agent-workflow/\n');
    runRoot = path.join(workspace, '.agent-workflow', 'runs', 'run-recovery');
    fs.mkdirSync(runRoot, { recursive: true });
  }
  let s = initialize({ caller: f.old, workspace, task: 'Recovery', host: f.host, runRoot });
  update(s.root, f.old, 'capture', { fromLine: 1, scope: 'This session contains only this task.' }, f.host);
  fs.writeFileSync(path.join(s.root, 'continuation.md'), 'Read-only task; wait for the operator.');
  s = update(s.root, f.old, 'prepare', {}, f.host); f.root = s.root; f.nonce = s.transfer.nonce;
  if (phase !== 'prepared') s = update(s.root, f.old, 'yield', { nonce: f.nonce }, f.host);
  if (phase === 'confirmed') {
    fs.writeFileSync(path.join(path.dirname(s.transfer.handoff), 'confirmation.md'), `Continue read-only. ${s.transfer.instructions.sha256}`);
    s = update(s.root, f.next, 'accept', { nonce: f.nonce }, f.host);
  }
  return { ...f, s };
}
const id = (c) => ({ engine: c.engine, session: c.session });
function record(f, action, verdict = 'exited', operator = false) {
  const s = readChain(f.root); const current = titles(s);
  const r = { version: 1, action, chain: s.id, nonce: f.nonce, generation: s.generation,
    reporter: id(action === 'finish-transfer' ? f.next : f.old),
    predecessor: { ...id(f.old), handle: 'term_old' },
    successor: verdict === 'not-launched' ? null : { ...id(f.next), handle: 'term_next' },
    runtime: { id: 'synthetic-runtime', host: 'synthetic-host' }, observation: { verdict, at: new Date().toISOString() },
    assessment: 'Synthetic test evidence; original task authority remains read-only.',
    launchEvidence: 'launch', runtimeEvidence: 'runtime', evidence: [] };
  for (const name of ['launch', 'runtime', 'operator', 'old-ui', 'next-ui']) {
    const file = path.join(f.dir, `${action}-${name}.txt`);
    fs.writeFileSync(file, `Synthetic ${name} for ${s.id}/${f.nonce}.\n`);
    r.evidence.push({ id: name, path: file });
  }
  if (operator) r.decision = { kind: 'operator-decision', action, chain: s.id, nonce: f.nonce,
    predecessor: id(f.old), successor: r.successor, authorizedOwner: id(action === 'finish-transfer' ? f.next : f.old),
    quote: fs.readFileSync(r.evidence.find(e => e.id === 'operator').path, 'utf8').trim(), evidence: 'operator' };
  if (action !== 'cancel-transfer') r.ui = {
    predecessor: { handle: 'term_old', state: 'visible', title: action === 'finish-transfer' ? current.retired : current.current, evidence: 'old-ui' },
    successor: r.successor ? { handle: 'term_next', state: 'visible', title: action === 'finish-transfer' ? current.successor : current.cancelledSuccessor, evidence: 'next-ui' } : null };
  return r;
}
function run(f, action, r, caller = action === 'finish-transfer' ? f.next : f.old, extra = {}) {
  const file = path.join(f.dir, `${action}.json`); fs.writeFileSync(file, JSON.stringify(r));
  return update(f.root, caller, action, { nonce: f.nonce, recordFile: file, retiredTitle: titles(readChain(f.root)).retired, ...extra }, f.host);
}
function unchanged(f, fn, pattern) {
  const before = fs.readFileSync(path.join(f.root, 'state.json'));
  assert.throws(fn, pattern); assert.ok(fs.readFileSync(path.join(f.root, 'state.json')).equals(before));
}

for (const engine of ['claude', 'codex']) {
  for (const verdict of ['not-launched', 'exited', 'live', 'unverifiable']) {
    test(`${engine}: ${verdict} cancellation invalidates before UI reconciliation and preserves source/count history`, () => {
      const f = fixture(engine, verdict === 'not-launched' ? 'prepared' : 'yielded');
      const before = report(f.s).countsReport.turns.count; const frozen = fs.readFileSync(f.s.transfer.instructions.file);
      const cancel = record(f, 'cancel-transfer', verdict, ['live', 'unverifiable'].includes(verdict));
      const s = run(f, 'cancel-transfer', cancel);
      assert.equal(s.transfer.phase, 'cancelled'); assert.equal(s.status, 'transferring'); assert.equal(s.owner.session, f.old.session);
      unchanged(f, () => update(f.root, f.next, 'accept', { nonce: f.nonce }, f.host), /yielded/);
      unchanged(f, () => update(f.root, f.old, 'observe', {}, f.host), /transferring/);
      const resume = record(f, 'resume-cancelled', verdict);
      const bad = structuredClone(resume); bad.ui.predecessor.title = 'idle';
      unchanged(f, () => run(f, 'resume-cancelled', bad), /UI evidence/);
      fs.appendFileSync(f.old.log, JSON.stringify(message(f.old, 'new-instruction', 'Later correction: retain the original restriction.')) + '\n');
      const done = run(f, 'resume-cancelled', resume);
      assert.equal(done.generation, 1); assert.equal(done.owner.session, f.old.session); assert.equal(done.transfer, null);
      assert.ok(report(done).countsReport.turns.count >= before);
      assert.ok(readSources(done).packet.segments[0].entries.some((e) => e.texts.includes('Later correction: retain the original restriction.')));
      assert.ok(fs.readFileSync(f.s.transfer.instructions.file).equals(frozen));
      assert.equal(done.recoveries.length, 2);
      const bundle = readRecovery(done, done.recoveries[0].record);
      fs.unlinkSync(cancel.evidence[0].path); assert.ok(bundle.evidence[0].text.includes(f.nonce));
      assert.equal(readRecovery(done, done.recoveries[0].record).record.nonce, f.nonce);
      assert.equal(update(f.root, f.old, 'resume-cancelled', { nonce: f.nonce }, f.host).generation, 1);
      unchanged(f, () => update(f.root, f.next, 'accept', { nonce: f.nonce }, f.host), /yielded/);
      const next = update(f.root, f.old, 'prepare', {}, f.host); assert.notEqual(next.transfer.nonce, f.nonce);
      update(f.root, f.old, 'yield', { nonce: next.transfer.nonce }, f.host);
      if (verdict !== 'not-launched') unchanged(f, () => update(f.root, f.next, 'accept', { nonce: next.transfer.nonce }, f.host), /cancelled successor/);
    });
  }
  test(`${engine}: only designated successor finishes an operator-authorized confirmed transfer`, () => {
    const f = fixture(engine, 'confirmed'); const r = record(f, 'finish-transfer', 'unverifiable', true);
    unchanged(f, () => run(f, 'cancel-transfer', record(f, 'cancel-transfer')), /confirmed transfers/);
    unchanged(f, () => run(f, 'finish-transfer', r, f.old), /caller/);
    const noDecision = structuredClone(r); delete noDecision.decision;
    unchanged(f, () => run(f, 'finish-transfer', noDecision), /operator decision/);
    const done = run(f, 'finish-transfer', r);
    assert.equal(done.owner.session, f.next.session); assert.equal(done.generation, 2); assert.equal(done.retired.length, 1);
    assert.equal(done.lastRetirement.recovery.reporter.session, f.next.session);
    assert.equal(report(done).countsReport.session, f.next.session);
    const receipt = path.join(f.root, 'handoffs', f.nonce, 'retirement.json'); fs.unlinkSync(receipt);
    fs.appendFileSync(f.next.log, '{');
    const retry = update(f.root, f.next, 'finish-transfer', { nonce: f.nonce, retiredTitle: done.lastRetirement.title }, f.host);
    assert.equal(retry.generation, 2); assert.equal(retry.recoveries.length, 1);
    assert.deepEqual(JSON.parse(fs.readFileSync(receipt)), done.lastRetirement);
  });
}

test('unknown/live successor, scope mismatch, wrong caller and missing evidence never authorize cancellation', () => {
  const f = fixture();
  for (const verdict of ['live', 'unverifiable']) unchanged(f, () => run(f, 'cancel-transfer', record(f, 'cancel-transfer', verdict)), /operator decision/);
  const base = record(f, 'cancel-transfer', 'unverifiable', true);
  for (const change of [r => r.chain = 'other', r => r.nonce = 'stale', r => r.generation = 9,
    r => r.reporter.session = 'foreign', r => r.predecessor.session = 'foreign', r => r.successor.handle = '',
    r => r.launchEvidence = 'missing', r => r.runtimeEvidence = 'missing', r => r.decision.evidence = 'missing',
    r => r.decision.authorizedOwner.session = 'foreign', r => r.decision.nonce = 'stale', r => r.decision.quote = '',
    r => r.observation.verdict = 'timeout', r => r.evidence[0].path = '/nonexistent/evidence']) {
    const r = structuredClone(base); change(r); unchanged(f, () => run(f, 'cancel-transfer', r));
  }
  unchanged(f, () => run(f, 'cancel-transfer', base, f.next), /current owner/);
});

test('resume retains identity, requires operator disposition if exit becomes uncertain, and detects damaged proof', () => {
  const f = fixture(); run(f, 'cancel-transfer', record(f, 'cancel-transfer'));
  unchanged(f, () => run(f, 'resume-cancelled', record(f, 'resume-cancelled', 'unverifiable')), /operator decision/);
  for (const change of [r => r.runtime.id = 'other', r => r.successor.handle = 'other', r => r.ui.successor.title = 'CURRENT',
    r => r.ui.predecessor.evidence = 'missing']) {
    const r = record(f, 'resume-cancelled'); change(r); unchanged(f, () => run(f, 'resume-cancelled', r));
  }
  const s = readChain(f.root); fs.appendFileSync(s.transfer.cancellation.record.file, ' ');
  unchanged(f, () => run(f, 'resume-cancelled', record(f, 'resume-cancelled')), /evidence changed/);
});

test('a new operator disposition can resolve changed liveness while already cancelled', () => {
  const f = fixture(); run(f, 'cancel-transfer', record(f, 'cancel-transfer'));
  const r = record(f, 'resume-cancelled', 'unverifiable', true);
  assert.equal(run(f, 'resume-cancelled', r).owner.session, f.old.session);
});

test('verified closure is an exited-successor alternative, never an inference from missing UI', () => {
  const f = fixture(); run(f, 'cancel-transfer', record(f, 'cancel-transfer'));
  const r = record(f, 'resume-cancelled'); r.ui.successor = { handle: 'term_next', state: 'closed', evidence: 'next-ui' };
  assert.equal(run(f, 'resume-cancelled', r).status, 'active');
  const g = fixture(); run(g, 'cancel-transfer', record(g, 'cancel-transfer', 'unverifiable', true));
  const bad = record(g, 'resume-cancelled', 'unverifiable'); bad.ui.successor.state = 'closed';
  unchanged(g, () => run(g, 'resume-cancelled', bad), /UI evidence/);
});

test('finishing does not waive fresh source, confirmation or exact visible participant checks', () => {
  for (const mutate of [f => fs.appendFileSync(f.old.log, JSON.stringify(message(f.old, 'late', 'Stop; new scope.')) + '\n'),
    f => fs.appendFileSync(f.s.transfer.confirmation, ' edited'), f => fs.appendFileSync(f.s.transfer.handoff, ' edited')]) {
    const f = fixture('codex', 'confirmed'); const r = record(f, 'finish-transfer', 'exited', true); mutate(f);
    unchanged(f, () => run(f, 'finish-transfer', r), /changed|new input/);
  }
  for (const mutate of [r => r.ui.predecessor.title = 'CURRENT', r => r.ui.successor.handle = 'foreign',
    r => r.decision.successor.session = 'foreign', r => r.observation.verdict = 'live']) {
    const f = fixture('codex', 'confirmed'); const r = record(f, 'finish-transfer', 'exited', true); mutate(r);
    unchanged(f, () => run(f, 'finish-transfer', r));
  }
});

for (const stage of ['counts', 'state', 'receipt']) {
  test(`recovery ${stage} publication failure leaves one committed owner and retries exactly once`, () => {
    const f = fixture('codex', 'confirmed'); const r = record(f, 'finish-transfer', 'exited', true);
    const destination = { counts: f.s.counts, state: path.join(f.root, 'state.json'), receipt: path.join(f.root, 'handoffs', f.nonce, 'retirement.json') }[stage];
    const rename = fs.renameSync;
    fs.renameSync = (from, to) => { if (to === destination) throw new Error('injected publication failure'); return rename(from, to); };
    try { assert.throws(() => run(f, 'finish-transfer', r), /injected/); } finally { fs.renameSync = rename; }
    const held = readChain(f.root); assert.equal(held.owner.session, stage === 'receipt' ? f.next.session : f.old.session);
    assert.equal(report(held).countsReport.session, held.owner.session);
    const done = run(f, 'finish-transfer', r, f.next, { retiredTitle: titles(f.s).retired });
    assert.equal(done.generation, 2); assert.equal(done.recoveries.length, 1);
  });
}

test('CLI recovery uses the actual caller and preserves JSON reporting and exit semantics', () => {
  const f = fixture(); const r = record(f, 'cancel-transfer'); const file = path.join(f.dir, 'cli-record.json');
  fs.writeFileSync(file, JSON.stringify(r));
  const result = spawnSync(process.execPath, [helper, 'cancel-transfer', '--root', f.root, '--engine', f.old.engine,
    '--session', f.old.session, '--nonce', f.nonce, '--record-file', file], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr); assert.equal(JSON.parse(result.stdout).transfer.phase, 'cancelled');
  assert.match(JSON.parse(result.stdout).titles.cancelledSuccessor, /RETIRED.*cancelled/);
});


test('operator decisions require a quote in their dedicated source', () => {
  const f = fixture(); const base = record(f, 'cancel-transfer', 'unverifiable', true);
  for (const change of [r => r.decision.quote = 'Not in the operator source.',
    r => { r.decision.evidence = 'runtime'; r.decision.quote = fs.readFileSync(r.evidence.find(e => e.id === 'runtime').path, 'utf8').trim(); }]) {
    const r = structuredClone(base); change(r); unchanged(f, () => run(f, 'cancel-transfer', r), /quote is absent|dedicated/);
  }
});

test('late-discovered successor stays fenced until a new explicit disposition and cannot be reused', () => {
  const f = fixture('codex', 'prepared'); const cancel = record(f, 'cancel-transfer', 'not-launched');
  run(f, 'cancel-transfer', cancel);
  assert.equal(run(f, 'cancel-transfer', cancel).transfer.phase, 'cancelled');
  const changed = structuredClone(cancel); changed.assessment += ' Changed facts.';
  unchanged(f, () => run(f, 'cancel-transfer', changed), /different record/);
  unchanged(f, () => run(f, 'resume-cancelled', record(f, 'resume-cancelled', 'exited')), /operator decision/);
  unchanged(f, () => update(f.root, f.next, 'accept', { nonce: f.nonce }, f.host), /yielded/);
  const done = run(f, 'resume-cancelled', record(f, 'resume-cancelled', 'exited', true));
  assert.equal(done.recoveries[0].successor, null);
  assert.equal(done.recoveries[1].successor.session, f.next.session);
  const fresh = update(f.root, f.old, 'prepare', {}, f.host);
  update(f.root, f.old, 'yield', { nonce: fresh.transfer.nonce }, f.host);
  unchanged(f, () => update(f.root, f.next, 'accept', { nonce: fresh.transfer.nonce }, f.host), /cancelled successor/);
});

test('cancelled hook restores the resumption action without granting task work', () => {
  const f = fixture(); run(f, 'cancel-transfer', record(f, 'cancel-transfer'));
  const output = hook(f.old.engine, { hook_event_name: 'SessionStart', session_id: f.old.session }, { host: f.host, skill: '/skill' });
  assert.match(output.hookSpecificOutput.additionalContext, /resume-cancelled/);
  assert.equal(readChain(f.root).status, 'transferring');
});

for (const action of ['resume-cancelled', 'finish-transfer']) {
  test(`Run-backed ${action} requires evidence of the correct coordinator owner`, () => {
    const f = fixture('codex', action === 'finish-transfer' ? 'confirmed' : 'yielded', true);
    if (action === 'resume-cancelled') run(f, 'cancel-transfer', record(f, 'cancel-transfer'));
    const r = record(f, action, 'exited', action === 'finish-transfer');
    unchanged(f, () => run(f, action, r), /actual Run owner/);
    r.coordinator = { runId: 'run-recovery', ownerHandle: 'wrong', consumerGeneration: 2, evidence: 'runtime' };
    unchanged(f, () => run(f, action, r), /actual Run owner/);
    r.coordinator.ownerHandle = action === 'finish-transfer' ? 'term_next' : 'term_old';
    r.coordinator.evidence = 'missing';
    unchanged(f, () => run(f, action, r), /missing evidence/);
    r.coordinator.evidence = 'runtime';
    assert.equal(run(f, action, r).status, 'active');
  });
}


test('decoded multiline decision preserves its original reply and exact committed retries', () => {
  const f = fixture(); const r = record(f, 'cancel-transfer', 'live', true);
  const body = 'Settle "this successor".\nResume the predecessor — only this task.';
  const raw = path.join(f.dir, 'original-reply.json'); fs.writeFileSync(raw, JSON.stringify({ body }));
  const decoded = r.evidence.find(e => e.id === 'operator').path;
  fs.writeFileSync(decoded, JSON.parse(fs.readFileSync(raw)).body);
  r.evidence.push({ id: 'original-reply', path: raw }); r.decision.quote = body;
  run(f, 'cancel-transfer', r);
  const resume = record(f, 'resume-cancelled', 'live');
  const done = run(f, 'resume-cancelled', resume);
  assert.equal(run(f, 'resume-cancelled', resume).generation, done.generation);
  resume.assessment += ' Changed.';
  unchanged(f, () => run(f, 'resume-cancelled', resume), /different record/);
  const g = fixture('codex', 'confirmed'); const finish = record(g, 'finish-transfer', 'exited', true);
  const title = titles(g.s).retired; run(g, 'finish-transfer', finish);
  assert.equal(run(g, 'finish-transfer', finish, g.next, { retiredTitle: title }).generation, 2);
  finish.assessment += ' Changed.';
  unchanged(g, () => run(g, 'finish-transfer', finish, g.next, { retiredTitle: title }), /different record/);
});
