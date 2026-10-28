// An installed plugin is a copy of this package without `.git` or developer
// dependencies. Its tools must run their YAML and Ajv operations from what the
// package itself ships.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const scratch = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'aw relocated é-')));
after(() => fs.rmSync(scratch, { recursive: true, force: true }));
// A commit hook exports Git paths for the checkout being committed. The fixture
// and installed tools must discover their own repositories instead.
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
env.GIT_CONFIG_GLOBAL = path.join(scratch, 'no-global-gitconfig');
env.GIT_CONFIG_NOSYSTEM = '1';

test('a relocated copy without .git or root node_modules runs YAML and Ajv operations', () => {
  const copy = path.join(scratch, 'installed');
  fs.cpSync(packageRoot, copy, {
    recursive: true,
    filter: (source) => !['.git', 'node_modules'].includes(path.basename(source)) || path.dirname(source) !== packageRoot,
  });
  const target = path.join(scratch, 'target');
  fs.mkdirSync(target);
  assert.equal(spawnSync('git', ['init', '-q', target], { env }).status, 0);
  const run = (script, args) => spawnSync(process.execPath, [path.join(copy, 'tools', script), ...args], { cwd: target, env, encoding: 'utf8' });
  const resolve = run('resolve.mjs', ['--repo', target]);
  assert.equal(resolve.status, 0, resolve.stderr);
  assert.equal(JSON.parse(resolve.stdout).workflowSource, copy);
  const inspect = run('bind.mjs', ['inspect', '--repo', target]);
  assert.equal(inspect.status, 0, inspect.stderr);
});
