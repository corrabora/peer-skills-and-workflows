// Exercise the public installer in disposable homes, never the operator's settings.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { hookConfig } from '../lib/successor.mjs';
import { supportHookScopes } from '../lib/paths.mjs';

const root = fs.realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const scratch = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'aw support é-')));
after(() => fs.rmSync(scratch, { recursive: true, force: true }));
const receiptName = '.peer-skills-and-workflows-successor-hooks.json';
const write = (file, value) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n'); };
const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const settings = (home) => [path.join(home, '.codex/hooks.json'), path.join(home, '.claude/settings.json')];
function run(home, action, set = 'workflow', overrides = {}) {
  const env = { ...process.env, HOME: home, USERPROFILE: home, CODEX_HOME: '', CLAUDE_CONFIG_DIR: '', ...overrides };
  return spawnSync(process.execPath, [path.join(root, 'tools/install.mjs'), action, ...(set ? [set] : [])], { env, encoding: 'utf8' });
}
const success = (result) => assert.equal(result.status, 0, result.stderr);
const foreignGroup = { matcher: '*', hooks: [{ type: 'command', command: 'echo unrelated' }] };

test('workflow installs user hooks, preserves other settings and uninstalls only its entries', () => {
  const home = path.join(scratch, 'merge');
  const originals = settings(home).map((file) => {
    const config = { description: 'user metadata', permissions: { allow: ['Read'] }, hooks: { Stop: [foreignGroup] } };
    write(file, config); return config;
  });
  const toml = path.join(home, '.codex/config.toml');
  fs.writeFileSync(toml, '# existing trust and settings\n');
  const linked = run(home, 'link'); success(linked); assert.match(linked.stdout, /open \/hooks/);
  for (const [index, file] of settings(home).entries()) {
    const config = read(file);
    assert.deepEqual(config.permissions, originals[index].permissions);
    assert.equal(config.description, originals[index].description);
    const expected = hookConfig(index === 0 ? 'codex' : 'claude', path.join(root, 'tools/successor.mjs')).hooks;
    for (const [event, groups] of Object.entries(expected)) assert.ok(config.hooks[event].some((g) => JSON.stringify(g) === JSON.stringify(groups[0])));
    // A later user hook after the managed group stays in that position on relink.
    config.hooks.Stop.push({ hooks: [{ type: 'command', command: 'echo added-later' }] });
    write(file, config);
  }
  const before = settings(home).map((f) => fs.readFileSync(f, 'utf8'));
  success(run(home, 'link')); success(run(home, 'check'));
  assert.deepEqual(settings(home).map((f) => fs.readFileSync(f, 'utf8')), before, 'idempotent install does not reorder or rewrite settings');
  success(run(home, 'unlink'));
  for (const [index, file] of settings(home).entries()) {
    const expected = structuredClone(originals[index]);
    expected.hooks.Stop.push({ hooks: [{ type: 'command', command: 'echo added-later' }] });
    assert.deepEqual(read(file), expected);
    assert.equal(fs.existsSync(path.join(path.dirname(file), receiptName)), false);
  }
  assert.equal(fs.readFileSync(toml, 'utf8'), '# existing trust and settings\n');
});

test('writing-only operations neither install nor check or remove workflow hooks', () => {
  const home = path.join(scratch, 'writing');
  success(run(home, 'link', 'writing')); success(run(home, 'check', 'writing')); success(run(home, 'unlink', 'writing'));
  for (const file of settings(home)) assert.equal(fs.existsSync(file), false);
  success(run(home, 'link'));
  const before = settings(home).map((f) => fs.readFileSync(f, 'utf8'));
  success(run(home, 'unlink', 'writing'));
  assert.deepEqual(settings(home).map((f) => fs.readFileSync(f, 'utf8')), before);
});

test('check is read-only and catches missing hooks; link repairs a removed definition', () => {
  const home = path.join(scratch, 'repair'); success(run(home, 'link'));
  const file = settings(home)[0]; const config = read(file); delete config.hooks.Stop; write(file, config);
  const before = fs.readFileSync(file, 'utf8'); const checked = run(home, 'check');
  assert.equal(checked.status, 1); assert.match(checked.stderr, /Stop: missing/);
  assert.equal(fs.readFileSync(file, 'utf8'), before);
  success(run(home, 'link')); success(run(home, 'check'));
});

test('edited and duplicate hook definitions are reported without overwriting them', () => {
  for (const kind of ['edited', 'duplicate']) {
    const home = path.join(scratch, kind); success(run(home, 'link'));
    const file = settings(home)[0]; const config = read(file);
    if (kind === 'edited') config.hooks.Stop[0].hooks[0].async = true;
    else config.hooks.Stop.push(structuredClone(config.hooks.Stop[0]));
    write(file, config); const before = fs.readFileSync(file, 'utf8');
    for (const action of ['check', 'link', 'unlink']) {
      const result = run(home, action); assert.equal(result.status, 1, `${action}: ${result.stderr}`);
      assert.equal(fs.readFileSync(file, 'utf8'), before);
    }
    assert.ok(fs.existsSync(path.join(home, '.agents/skills/successor')), 'failed hook removal keeps skill links');
  }
});

test('pre-existing identical hooks are used without duplication or claiming their ownership', () => {
  const home = path.join(scratch, 'pre-existing');
  for (const [i, file] of settings(home).entries()) write(file, hookConfig(i === 0 ? 'codex' : 'claude', path.join(root, 'tools/successor.mjs')));
  const before = settings(home).map((f) => fs.readFileSync(f, 'utf8'));
  success(run(home, 'link')); success(run(home, 'check')); success(run(home, 'unlink'));
  assert.deepEqual(settings(home).map((f) => fs.readFileSync(f, 'utf8')), before);
});

test('invalid settings, ownership receipts and file symlinks are preserved', (t) => {
  for (const kind of ['invalid-json', 'invalid-hooks', 'receipt', 'symlink']) {
    const home = path.join(scratch, kind); const file = settings(home)[0];
    fs.mkdirSync(path.dirname(file), { recursive: true });
    if (kind === 'invalid-json') fs.writeFileSync(file, '{ broken');
    if (kind === 'invalid-hooks') write(file, { hooks: { Stop: 'broken' } });
    if (kind === 'receipt') { write(file, {}); write(path.join(path.dirname(file), receiptName), { version: 999 }); }
    if (kind === 'symlink') {
      const target = path.join(home, 'foreign.json'); write(target, { keep: true });
      try { fs.symlinkSync(target, file); }
      catch (error) { if (error.code === 'EPERM') { t.diagnostic('file symlink unavailable; other preservation cases exercised'); continue; } throw error; }
    }
    const before = fs.readFileSync(file, 'utf8');
    const result = run(home, 'link'); assert.equal(result.status, 1, kind); assert.match(result.stderr, /hooks FAIL/);
    assert.equal(fs.readFileSync(file, 'utf8'), before);
  }
});

test('configuration-directory overrides affect hooks without relocating Codex skill discovery', () => {
  const home = path.join(scratch, 'override home');
  const env = { CODEX_HOME: path.join(scratch, 'custom codex'), CLAUDE_CONFIG_DIR: path.join(scratch, 'custom claude') };
  success(run(home, 'link', 'workflow', env)); success(run(home, 'check', 'workflow', env));
  assert.ok(fs.existsSync(path.join(env.CODEX_HOME, 'hooks.json')));
  assert.ok(fs.existsSync(path.join(env.CLAUDE_CONFIG_DIR, 'settings.json')));
  assert.ok(fs.existsSync(path.join(home, '.agents/skills/successor')));
  for (const file of settings(home)) assert.equal(fs.existsSync(file), false);
  success(run(home, 'unlink', 'workflow', env));
});

test('installer lock refuses overlap without modifying settings or removing the other lock', () => {
  const home = path.join(scratch, 'locked'); success(run(home, 'link'));
  const file = settings(home)[0]; const lock = path.join(path.dirname(file), receiptName + '.lock');
  const before = fs.readFileSync(file, 'utf8'); fs.writeFileSync(lock, 'another installer');
  const result = run(home, 'link'); assert.equal(result.status, 1); assert.match(result.stderr, /EEXIST/);
  assert.equal(fs.readFileSync(file, 'utf8'), before); assert.equal(fs.readFileSync(lock, 'utf8'), 'another installer');
});

test('installed command works outside the source repository and stays inert for an unregistered session', () => {
  const home = path.join(scratch, 'portable'); success(run(home, 'link', undefined));
  const elsewhere = path.join(scratch, 'another repo'); fs.mkdirSync(elsewhere);
  for (const file of settings(home)) {
    const command = read(file).hooks.UserPromptSubmit[0].hooks[0].command;
    const result = spawnSync(command, { shell: true, cwd: elsewhere, input: JSON.stringify({ hook_event_name: 'UserPromptSubmit', session_id: 'installer-unregistered-probe', cwd: elsewhere }), env: { ...process.env, HOME: home, USERPROFILE: home, CODEX_HOME: '', CLAUDE_CONFIG_DIR: '' }, encoding: 'utf8' });
    success(result); assert.deepEqual(JSON.parse(result.stdout), {}); assert.equal(result.stderr, '');
  }
});

test('user hook destinations follow native platform rules and explicit config homes', () => {
  assert.deepEqual(supportHookScopes({ platform: 'win32', home: 'C:\\Users\\Ada', env: {} }), [
    { engine: 'codex', file: 'C:\\Users\\Ada\\.codex\\hooks.json' },
    { engine: 'claude', file: 'C:\\Users\\Ada\\.claude\\settings.json' },
  ]);
  assert.deepEqual(supportHookScopes({ platform: 'linux', home: '/home/a', env: { CODEX_HOME: '/cfg/codex', CLAUDE_CONFIG_DIR: '/cfg/claude' } }), [
    { engine: 'codex', file: '/cfg/codex/hooks.json' }, { engine: 'claude', file: '/cfg/claude/settings.json' },
  ]);
  assert.throws(() => supportHookScopes({ platform: 'linux', home: '/home/a', env: { CODEX_HOME: 'relative' } }), /must be absolute/);
});
