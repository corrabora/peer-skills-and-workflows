// Mapping tests inject a platform, environment and home, so they check the
// rules for every host without running on it; simulated mappings are not a
// run on that host. Only the filesystem tests touch the machine running the suite.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import {
  canonical, canonicalLocation, isWithin, localDirectory, machineBase, repositoryKey, runRoot, scratchRoot, skillScopes,
} from '../lib/paths.mjs';

test('run roots sit in the checkout\'s local workflow directory, per host path rules', () => {
  assert.equal(localDirectory('/work/repo', 'linux'), '/work/repo/.agent-workflow');
  assert.equal(runRoot('/work/repo', 'run_021a27881b97', 'linux'), '/work/repo/.agent-workflow/runs/run_021a27881b97');
  assert.equal(runRoot('/Users/Ada Lovelace/src/repo', 'run_1', 'darwin'), '/Users/Ada Lovelace/src/repo/.agent-workflow/runs/run_1');
  assert.equal(localDirectory('C:\\Users\\Zoë Q\\src\\repo', 'win32'), 'C:\\Users\\Zoë Q\\src\\repo\\.agent-workflow');
  assert.equal(runRoot('C:\\src\\repo', 'run_1', 'win32'), 'C:\\src\\repo\\.agent-workflow\\runs\\run_1');
});

test('run roots keep same-named checkouts and distinct runs apart', () => {
  const one = runRoot('/work/one/repo', 'run_1', 'linux');
  assert.notEqual(one, runRoot('/work/two/repo', 'run_1', 'linux'));
  assert.notEqual(one, runRoot('/work/one/repo', 'run_2', 'linux'));
});

test('run ids are single plain names', () => {
  for (const good of ['run_021a27881b97', 'r1', 'A.b-c_d']) {
    assert.equal(path.posix.basename(runRoot('/r', good, 'linux')), good);
  }
  for (const bad of ['../x', 'a/b', 'a\\b', '..', 'a..b', '.hidden', '-x', '', 'C:x', 'run 1']) {
    assert.throws(() => runRoot('/r', bad, 'linux'), /run id/, bad);
    assert.throws(() => runRoot('C:\\r', bad, 'win32'), /run id/, bad);
  }
  for (const bad of ['a..b', '.x', '-x', '']) {
    assert.throws(() => runRoot('/r', bad, 'linux'),
      /must start with a letter or digit, contain only letters, digits, '\.', '_' or '-', and not contain '\.\.'$/, bad);
  }
});

test('simulated skill scopes per engine, honouring an absolute CLAUDE_CONFIG_DIR', () => {
  assert.deepEqual(skillScopes({ platform: 'win32', env: {}, home: 'C:\\Users\\a' }).map((s) => s.dir), [
    'C:\\Users\\a\\.agents\\skills',
    'C:\\Users\\a\\.claude\\skills',
  ]);
  assert.deepEqual(skillScopes({ platform: 'linux', env: { CLAUDE_CONFIG_DIR: '/cfg/claude' }, home: '/home/a' }).map((s) => s.dir), [
    '/home/a/.agents/skills',
    '/cfg/claude/skills',
  ]);
});

test('simulated machine-local bases per host, refusing a missing or relative root', () => {
  assert.equal(machineBase({ platform: 'darwin', env: {}, home: '/Users/a' }), '/Users/a/Library/Application Support/AgentWorkflow');
  assert.equal(machineBase({ platform: 'win32', env: { LOCALAPPDATA: 'C:\\Users\\a\\AppData\\Local' }, home: 'C:\\Users\\a' }),
    'C:\\Users\\a\\AppData\\Local\\AgentWorkflow');
  assert.equal(machineBase({ platform: 'linux', env: {}, home: '/home/a' }), '/home/a/.local/state/agent-workflow');
  assert.equal(machineBase({ platform: 'linux', env: { XDG_STATE_HOME: '/state' }, home: '/home/a' }), '/state/agent-workflow');
  assert.equal(machineBase({ platform: 'linux', env: { XDG_STATE_HOME: 'state' }, home: '/home/a' }),
    '/home/a/.local/state/agent-workflow', 'a relative XDG_STATE_HOME is ignored');
  for (const env of [{}, { LOCALAPPDATA: 'AppData\\Local' }]) {
    assert.throws(() => machineBase({ platform: 'win32', env, home: 'C:\\Users\\a' }), /LOCALAPPDATA/);
  }
  assert.throws(() => machineBase({ platform: 'darwin', env: {}, home: '' }), /home directory is unknown/);
});

test('scratch roots sit in their own namespace, keyed by checkout and run', () => {
  const linux = { platform: 'linux', env: {}, home: '/home/a' };
  const key = repositoryKey('/work/one/repo', 'linux');
  assert.equal(key, 'repo-85ffe18bd00acaa6', 'keys stay stable, so a run keeps finding its scratch');
  assert.equal(scratchRoot(linux, '/work/one/repo', 'run_1'),
    `/home/a/.local/state/agent-workflow/scratch/repositories/${key}/runs/run_1`);
  assert.notEqual(key, repositoryKey('/work/two/repo', 'linux'), 'same-named checkouts stay apart');
  assert.notEqual(scratchRoot(linux, '/work/one/repo', 'run_1'), scratchRoot(linux, '/work/one/repo', 'run_2'));
  assert.match(repositoryKey('C:\\src\\my repo', 'win32'), /^my-repo-[0-9a-f]{16}$/);
  assert.equal(scratchRoot({ platform: 'win32', env: { LOCALAPPDATA: 'C:\\L' }, home: 'C:\\Users\\a' }, 'C:\\src\\repo', 'run_1'),
    `C:\\L\\AgentWorkflow\\scratch\\repositories\\${repositoryKey('C:\\src\\repo', 'win32')}\\runs\\run_1`);
  for (const bad of ['../x', 'a/b', '..', '']) {
    assert.throws(() => scratchRoot(linux, '/work/one/repo', bad), /run id/, bad);
  }
});

test('containment follows each platform path semantics', () => {
  assert.ok(isWithin('/pkg', '/pkg/a/b', 'linux'));
  assert.ok(isWithin('/pkg', '/pkg', 'linux'));
  assert.ok(!isWithin('/pkg', '/pkg-other/a', 'linux'));
  assert.ok(!isWithin('/pkg', '/a', 'linux'));
  assert.ok(isWithin('C:\\pkg', 'C:\\pkg\\a', 'win32'));
  assert.ok(!isWithin('C:\\pkg', 'D:\\pkg\\a', 'win32'));
  assert.ok(!isWithin('C:\\pkg', 'C:\\pkgx', 'win32'));
});

const scratch = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'aw paths é-')));
after(() => fs.rmSync(scratch, { recursive: true, force: true }));

/** Create a symlink, or skip the test where the host forbids it. */
function trySymlink(t, target, dest, type = 'junction') {
  try {
    fs.symlinkSync(target, dest, type);
    return true;
  } catch (error) {
    if (error.code === 'EPERM') { t.skip(`symlinks not permitted on this host: ${error.message}`); return false; }
    throw error;
  }
}

test('canonical: absence is null, other failures name the path and code', (t) => {
  fs.writeFileSync(path.join(scratch, 'file'), 'x');
  assert.equal(canonical(path.join(scratch, 'missing')), null);
  assert.equal(canonical(path.join(scratch, 'file', 'child')), null, 'ENOTDIR is absence');
  if (!trySymlink(t, path.join(scratch, 'loop-b'), path.join(scratch, 'loop-a'), 'file')) return;
  trySymlink(t, path.join(scratch, 'loop-a'), path.join(scratch, 'loop-b'), 'file');
  assert.throws(() => canonical(path.join(scratch, 'loop-a')), (error) => error.code === 'ELOOP' && /cannot resolve .*loop-a \(ELOOP\)/.test(error.message));
});

test('canonicalLocation resolves the deepest existing ancestor of a path that does not exist yet', (t) => {
  fs.mkdirSync(path.join(scratch, 'real'));
  assert.equal(canonicalLocation(path.join(scratch, 'real', 'not', 'yet')), path.join(scratch, 'real', 'not', 'yet'));
  if (!trySymlink(t, path.join(scratch, 'real'), path.join(scratch, 'alias'))) return;
  assert.equal(canonicalLocation(path.join(scratch, 'alias', 'not', 'yet')), path.join(scratch, 'real', 'not', 'yet'));
});
