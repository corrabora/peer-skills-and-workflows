// Exercise the controlled runtime itself offline. These are mechanical tests,
// not evidence that an agent followed the skill or that live Orca titles work.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { after, test } from 'node:test';
const source = fileURLToPath(new URL('../../tests/skills/fixtures/successor/runtime.mjs', import.meta.url));
const helper = fileURLToPath(new URL('../successor.mjs', import.meta.url));
const scratch = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'successor-fixtures-')));
after(() => fs.rmSync(scratch, { recursive: true, force: true }));
function run(cwd, file, ...args) {
  const r = spawnSync(process.execPath, [file, ...args], { cwd, encoding: 'utf8' });
  assert.ok([0, 3].includes(r.status), r.stderr);
  return JSON.parse(r.stdout);
}
test('command help never executes a fixture mutation', () => {
  const cwd = fs.mkdtempSync(path.join(scratch, 'help-'));
  const before = run(cwd, source, 'setup', helper, 'codex');
  for (const args of [['agent', 'launch'], ['terminal', 'rename'], ['terminal', 'set-pane-title'], ['terminal', 'show']]) {
    const r = spawnSync(process.execPath, [source, ...args, '--help'], { cwd, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /Fixture commands:/);
  }
  const after = JSON.parse(fs.readFileSync(path.join(cwd, 'fixture.json')));
  assert.equal(after.calls.length, 4);
  assert.deepEqual({ ...after, calls: [] }, before);
});

test('parallel guide discovery retains every call without losing fixture state', async () => {
  const cwd = fs.mkdtempSync(path.join(scratch, 'parallel-'));
  const before = run(cwd, source, 'setup', helper, 'claude');
  const requests = Array.from({ length: 20 }, (_, i) => ['skills', 'get', `guide-${i}`]);
  await Promise.all(requests.map((args) => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [source, ...args], { cwd, stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => stderr += chunk);
    child.on('error', reject);
    child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`fixture exited ${code}: ${stderr}`)));
  })));
  const after = JSON.parse(fs.readFileSync(path.join(cwd, 'fixture.json')));
  assert.deepEqual(after.calls.map(JSON.stringify).sort(), requests.map(JSON.stringify).sort());
  assert.deepEqual({ ...after, calls: [] }, before);
});
for (const engine of ['codex', 'claude']) for (const missing of [false, true]) {
  test(`controlled ${engine} fixture: ${missing ? 'missing confirmation holds' : 'confirmed predecessor retires'}`, () => {
    const cwd = fs.mkdtempSync(path.join(scratch, `${engine}-`));
    fs.copyFileSync(source, path.join(cwd, 'runtime.mjs'));
    if (missing) fs.writeFileSync(path.join(cwd, 'block-confirmation'), 'hold');
    const f = run(cwd, 'runtime.mjs', 'setup', helper, engine);
    const common = ['--root', f.root, '--engine', engine, '--session', f.caller.session];
    fs.writeFileSync(path.join(f.root, 'continuation.md'), 'Retain drafting-only authority and the open pricing question.');
    run(cwd, helper, 'capture', ...common, '--from-line', '1', '--scope', 'Only this test task is in the synthetic session.');
    let s = run(cwd, helper, 'prepare', ...common);
    const nonce = s.transfer.nonce;
    const launch = run(cwd, 'runtime.mjs', 'agent', 'launch', '--agent', engine, '--model', 'fixture-model-1', '--effort', 'high', '--prompt', `Root ${f.root}, nonce ${nonce}`);
    const next = launch.result.launch.outcome.handle;
    run(cwd, 'runtime.mjs', 'terminal', 'rename', '--terminal', next, '--title', s.titles.successor);
    assert.equal(run(cwd, 'runtime.mjs', 'terminal', 'show', '--terminal', next).result.terminal.title, s.titles.successor);
    run(cwd, helper, 'yield', ...common, '--nonce', nonce);
    run(cwd, 'runtime.mjs', 'terminal', 'show', '--terminal', next);
    s = run(cwd, helper, 'status', '--root', f.root);
    if (missing) {
      assert.equal(s.transfer.phase, 'yielded');
      const r = spawnSync(process.execPath, [helper, 'retire', ...common, '--nonce', nonce, '--retired-title', s.titles.retired], { cwd, encoding: 'utf8' });
      assert.equal(r.status, 1); assert.match(r.stderr, /confirmation/);
      assert.equal(run(cwd, 'runtime.mjs', 'terminal', 'show', '--terminal', f.oldHandle).result.terminal.title, s.titles.current);
    } else {
      assert.equal(s.transfer.phase, 'confirmed');
      run(cwd, 'runtime.mjs', 'terminal', 'rename', '--terminal', f.oldHandle, '--title', s.titles.retired);
      assert.equal(run(cwd, 'runtime.mjs', 'terminal', 'show', '--terminal', f.oldHandle).result.terminal.title, s.titles.retired);
      const retired = run(cwd, helper, 'retire', ...common, '--nonce', nonce, '--retired-title', s.titles.retired);
      assert.equal(retired.generation, 2); assert.equal(retired.status, 'active');
      assert.equal(retired.countsReport.turns.count, 1);
    }
  });
}
