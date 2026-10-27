import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readChain, titles, update } from '../lib/successor.mjs';
const root = fileURLToPath(new URL('../../tests/skills/suites/successor/cases/', import.meta.url));
const source = fileURLToPath(new URL('../../tests/skills/fixtures/successor-recovery/runtime.mjs', import.meta.url));
const helper = fileURLToPath(new URL('../successor.mjs', import.meta.url));
const scratch = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'recovery-fixture-')));
after(() => fs.rmSync(scratch, { recursive: true, force: true }));
const scenarios = ['cancel-exited', 'cancel-uncertain', 'cancel-authorized', 'finish-authorized', 'finish-unapproved'];
function runtime(cwd, ...args) {
  const r = spawnSync(process.execPath, [source, ...args], { cwd, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr); return JSON.parse(r.stdout);
}
for (const engine of ['claude', 'codex']) for (const scenario of scenarios) {
  test(`${engine}: recovery fixture ${scenario} establishes the intended phase, authority and UI ordering`, () => {
    const dir = fs.mkdtempSync(path.join(scratch, 'case-'));
    fs.cpSync(path.join(root, scenario, 'workspace'), dir, { recursive: true });
    assert.ok(fs.readFileSync(path.join(dir, 'runtime.mjs')).equals(fs.readFileSync(source)));
    const before = Object.fromEntries(['draft.md', 'notes.md', 'checks.txt'].map(n => [n, fs.readFileSync(path.join(dir, n))]));
    const c = runtime(dir, 'setup', helper, engine); const s = readChain(c.root);
    const host = { platform: process.platform, home: path.join(dir, 'application-home'), env: { LOCALAPPDATA: path.join(dir, 'application-home', 'AppData') } };
    const finishing = scenario.startsWith('finish-');
    assert.equal(s.transfer.phase, finishing ? 'confirmed' : 'yielded');
    assert.equal(c.caller.session, finishing ? c.successor.session : c.predecessor.session);
    const obs = runtime(dir, 'inspect');
    assert.equal(obs.successor.verdict, scenario === 'cancel-exited' ? 'exited' : finishing ? 'live' : 'unverifiable');
    assert.equal(Boolean(c.operatorDecision), scenario.endsWith('-authorized'));
    assert.equal(fs.existsSync(path.join(dir, 'operator-messages.json')), false);
    const snapshot = Object.fromEntries([c.predecessor.log, c.successor.log, c.launchReceipt, ...(c.operatorDecision ? [c.operatorDecision] : [])].map(p => [p, fs.readFileSync(p)]));
    const writeProof = (action) => {
      const state = readChain(c.root); const o = runtime(dir, 'inspect');
      const observed = path.join(dir, `${action}-runtime.json`); fs.writeFileSync(observed, JSON.stringify(o));
      const old = { engine, session: c.predecessor.session, handle: c.oldHandle };
      const next = { engine, session: c.successor.session, handle: c.nextHandle };
      const record = { version: 1, action, chain: state.id, nonce: c.nonce, generation: state.generation,
        reporter: c.caller, predecessor: old, successor: next, runtime: o.runtime,
        observation: { at: o.at, verdict: finishing ? o.predecessor.verdict : o.successor.verdict },
        assessment: 'Synthetic fixture validation; task remains read-only.', launchEvidence: 'launch', runtimeEvidence: 'runtime',
        evidence: [{ id: 'launch', path: c.launchReceipt }, { id: 'runtime', path: observed }] };
      if (c.operatorDecision) {
        record.evidence.push({ id: 'operator', path: c.operatorDecision });
        record.decision = { kind: 'operator-decision', action, chain: state.id, nonce: c.nonce, predecessor: old, successor: next,
          authorizedOwner: c.caller, quote: fs.readFileSync(c.operatorDecision, 'utf8'), evidence: 'operator' };
      }
      if (action !== 'cancel-transfer') record.ui = {
        predecessor: { handle: c.oldHandle, state: 'visible', title: o.predecessor.title, evidence: 'runtime' },
        successor: { handle: c.nextHandle, state: 'visible', title: o.successor.title, evidence: 'runtime' } };
      const recordFile = path.join(dir, `${action}.json`); fs.writeFileSync(recordFile, JSON.stringify(record));
      return { nonce: c.nonce, recordFile, retiredTitle: titles(state).retired };
    };
    if (scenario === 'cancel-uncertain' || scenario === 'finish-unapproved') {
      const action = finishing ? 'finish-transfer' : 'cancel-transfer';
      assert.throws(() => update(c.root, c.caller, action, writeProof(action), host), /operator decision/);
      assert.equal(readChain(c.root).owner.session, c.predecessor.session);
    } else if (finishing) {
      const bad = spawnSync(process.execPath, [source, 'terminal', 'rename', '--terminal', c.nextHandle, '--title', 'CURRENT wrong'], { cwd: dir });
      assert.equal(bad.status, 1);
      runtime(dir, 'terminal', 'rename', '--terminal', c.oldHandle, '--title', titles(s).retired);
      update(c.root, c.caller, 'finish-transfer', writeProof('finish-transfer'), host);
      runtime(dir, 'terminal', 'rename', '--terminal', c.nextHandle, '--title', titles(readChain(c.root)).current);
      assert.equal(readChain(c.root).owner.session, c.successor.session);
    } else {
      const held = update(c.root, c.caller, 'cancel-transfer', writeProof('cancel-transfer'), host);
      assert.throws(() => update(c.root, c.successor, 'accept', { nonce: c.nonce }, host), /yielded/);
      runtime(dir, 'terminal', 'rename', '--terminal', c.nextHandle, '--title', titles(held).cancelledSuccessor);
      runtime(dir, 'terminal', 'rename', '--terminal', c.oldHandle, '--title', titles(held).current);
      const done = update(c.root, c.caller, 'resume-cancelled', writeProof('resume-cancelled'), host);
      assert.equal(done.status, 'active'); assert.equal(done.generation, 1);
    }
    for (const [name, bytes] of Object.entries(before)) assert.ok(fs.readFileSync(path.join(dir, name)).equals(bytes));
    for (const [name, bytes] of Object.entries(snapshot)) assert.ok(fs.readFileSync(name).equals(bytes));
    assert.equal(runtime(dir, 'setup', helper, engine).root, c.root);
  });
}
