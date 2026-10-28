// Runtime dependencies come from the shipped vendor tree, including in link
// mode. Missing payloads never fall back to root or ambient node_modules.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
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

test('missing YAML is reported without falling back to a root dependency', () => {
  const copy = path.join(scratch, 'uninstalled');
  for (const entry of ['tools', 'skills', 'defaults.yaml']) {
    fs.cpSync(path.join(packageRoot, entry), path.join(copy, entry), { recursive: true });
  }
  fs.rmSync(path.join(copy, 'tools/vendor/node_modules/yaml'), { recursive: true });
  fakePackage(copy, 'node_modules/yaml', "throw new Error('root fallback must not run');\n");
  const message = missing(copy, 'yaml');
  const validate = run(path.join(copy, 'tools', 'validate.mjs'), [], packageRoot);
  assert.equal(validate.status, 1);
  assert.equal(validate.stdout, '');
  assert.equal(validate.stderr, `validate: ${message}`);
  const resolve = run(path.join(copy, 'tools', 'resolve.mjs'), ['--repo', emptyCheckout('target')], packageRoot);
  assert.equal(resolve.status, 1);
  assert.equal(resolve.stdout, '');
  assert.equal(resolve.stderr, `resolve: ${message}`);
});

test('binding reports missing Ajv without falling back to a root dependency', () => {
  const copy = path.join(scratch, 'uninstalled-bind');
  fs.cpSync(path.join(packageRoot, 'tools'), path.join(copy, 'tools'), { recursive: true });
  fs.rmSync(path.join(copy, 'tools/vendor/node_modules/ajv'), { recursive: true });
  fakePackage(copy, 'node_modules/ajv', "throw new Error('root fallback must not run');\n");
  for (const command of ['inspect', 'exclude', 'sources']) {
    const args = [command, '--repo', packageRoot, ...(command === 'sources' ? ['README.md'] : [])];
    const result = run(path.join(copy, 'tools/bind.mjs'), args, packageRoot);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.equal(result.stderr, `bind: ${missing(copy, 'ajv')}`);
  }
});

function missing(copy, name) {
  return `the '${name}' runtime dependency is missing from ${path.join(copy, 'tools/vendor')}; reinstall the package or regenerate its vendored dependencies from the source checkout\n`;
}

function fakePackage(copy, relative, code, main = 'index.js') {
  const directory = path.join(copy, relative);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'package.json'), JSON.stringify({ main }));
  if (main === 'index.js') fs.writeFileSync(path.join(directory, 'index.js'), code);
}

for (const name of ['yaml', 'ajv']) {
  test(`${name} preserves broken entry-point and transitive dependency errors`, () => {
    const copy = path.join(scratch, `broken-${name}`);
    fs.cpSync(path.join(packageRoot, 'tools'), path.join(copy, 'tools'), { recursive: true });
    fs.cpSync(path.join(packageRoot, 'skills'), path.join(copy, 'skills'), { recursive: true });
    const relative = `tools/vendor/node_modules/${name}`;
    fs.rmSync(path.join(copy, relative), { recursive: true });
    const script = path.join(copy, name === 'yaml' ? 'tools/validate.mjs' : 'tools/bind.mjs');
    const args = name === 'yaml' ? [] : ['inspect', '--repo', packageRoot];
    fakePackage(copy, relative, '', 'missing-entry.js');
    const invalidMain = run(script, args, packageRoot);
    assert.equal(invalidMain.status, 1);
    assert.match(invalidMain.stderr, /missing-entry.js/);
    assert.doesNotMatch(invalidMain.stderr, /runtime dependency is missing/);
    fakePackage(copy, relative, `require('absent-${name}-transitive-control');\n`);
    const broken = run(script, args, packageRoot);
    assert.equal(broken.status, 1);
    assert.match(broken.stderr, new RegExp(`Cannot find module 'absent-${name}-transitive-control'`));
    assert.doesNotMatch(broken.stderr, /runtime dependency is missing/);
  });
}
