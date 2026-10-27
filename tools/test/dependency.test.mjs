// The tools resolve their npm dependency beside their own source, installed by
// `npm ci` in the workflow source checkout, never from the shell's directory,
// and name that command when it is missing.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const scratch = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'aw dependency é-')));
after(() => fs.rmSync(scratch, { recursive: true, force: true }));

const run = (script, args, cwd) => spawnSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8' });

function emptyCheckout(name) {
  const dir = path.join(scratch, name);
  fs.mkdirSync(path.join(dir, '.git'), { recursive: true });
  return dir;
}

test('the tools find their dependency from another working directory', () => {
  const elsewhere = emptyCheckout('elsewhere');
  const validate = run(path.join(packageRoot, 'tools', 'validate.mjs'), [], elsewhere);
  assert.equal(validate.status, 0, validate.stderr);
  const resolve = run(path.join(packageRoot, 'tools', 'resolve.mjs'), ['--repo', elsewhere], elsewhere);
  assert.equal(resolve.status, 0, resolve.stderr);
  assert.equal(JSON.parse(resolve.stdout).workflowSource, fs.realpathSync.native(packageRoot));
});

test('a missing dependency is reported with the command that installs it', (t) => {
  // A copy of the tools without node_modules, run from this checkout, which has them.
  const copy = path.join(scratch, 'uninstalled');
  for (const entry of ['tools', 'skills', 'defaults.yaml']) {
    fs.cpSync(path.join(packageRoot, entry), path.join(copy, entry), { recursive: true });
  }
  try {
    createRequire(path.join(copy, 'tools', 'lib', 'yaml.mjs')).resolve('yaml');
    t.skip('a yaml package above the temporary directory is visible to the copy');
    return;
  } catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND') throw error;
  }
  const message = `the 'yaml' package the workflow tools need is not installed in ${copy}; run 'npm ci' in that directory\n`;
  const validate = run(path.join(copy, 'tools', 'validate.mjs'), [], packageRoot);
  assert.equal(validate.status, 1);
  assert.equal(validate.stdout, '');
  assert.equal(validate.stderr, `validate: ${message}`);
  const resolve = run(path.join(copy, 'tools', 'resolve.mjs'), ['--repo', emptyCheckout('target')], packageRoot);
  assert.equal(resolve.status, 1);
  assert.equal(resolve.stdout, '');
  assert.equal(resolve.stderr, `resolve: ${message}`);
});

test('binding reports a missing direct Ajv dependency and preserves installed-package load failures', (t) => {
  const copy = path.join(scratch, 'uninstalled-bind');
  fs.cpSync(path.join(packageRoot, 'tools'), path.join(copy, 'tools'), { recursive: true });
  try {
    createRequire(path.join(copy, 'tools/lib/bind.mjs')).resolve('ajv');
    t.skip('an ajv package above the temporary directory is visible to the copy');
    return;
  } catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND') throw error;
  }
  for (const command of ['inspect', 'exclude', 'sources']) {
    const args = [command, '--repo', packageRoot, ...(command === 'sources' ? ['README.md'] : [])];
    const result = run(path.join(copy, 'tools/bind.mjs'), args, packageRoot);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.equal(result.stderr, `bind: the 'ajv' package the workflow tools need is not installed in ${copy}; run 'npm ci' in that directory\n`);
  }
  const installed = path.join(copy, 'node_modules/ajv');
  fs.mkdirSync(installed, { recursive: true });
  fs.writeFileSync(path.join(installed, 'package.json'), JSON.stringify({ main: 'missing-entry.js' }));
  const invalidMain = run(path.join(copy, 'tools/bind.mjs'), ['inspect', '--repo', packageRoot], packageRoot);
  assert.equal(invalidMain.status, 1);
  assert.match(invalidMain.stderr, /missing-entry.js/);
  assert.doesNotMatch(invalidMain.stderr, /run 'npm ci'/);
  fs.writeFileSync(path.join(installed, 'package.json'), JSON.stringify({ main: 'index.js' }));
  fs.writeFileSync(path.join(installed, 'index.js'), "require('absent-ajv-transitive-control');\n");
  const broken = run(path.join(copy, 'tools/bind.mjs'), ['inspect', '--repo', packageRoot], packageRoot);
  assert.equal(broken.status, 1);
  assert.match(broken.stderr, /Cannot find module 'absent-ajv-transitive-control'/);
  assert.doesNotMatch(broken.stderr, /run 'npm ci'/);
});
