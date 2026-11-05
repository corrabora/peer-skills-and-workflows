import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { LINT_INSTALL } from '../lib/lint.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));
const scratch = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'peer lint gate é-')));
after(() => fs.rmSync(scratch, { recursive: true, force: true }));

function withoutToolchain(name) {
  const fixture = path.join(scratch, name);
  fs.mkdirSync(fixture);
  fs.copyFileSync(path.join(root, 'package.json'), path.join(fixture, 'package.json'));
  fs.cpSync(path.join(root, 'tools'), path.join(fixture, 'tools'), {
    recursive: true,
    filter(source) {
      const relative = path.relative(path.join(root, 'tools'), source).split(path.sep).join('/');
      return !['test', 'test-support'].some((excluded) => relative === excluded || relative.startsWith(`${excluded}/`));
    },
  });
  return fixture;
}

function run(fixture, file) {
  const env = { ...process.env, GIT_OPTIONAL_LOCKS: '0' };
  delete env.NODE_TEST_CONTEXT;
  return spawnSync(process.execPath, [path.join(fixture, 'tools', file)], {
    cwd: fixture,
    env,
    encoding: 'utf8',
  });
}

test('the lint CLI fails visibly with the installation command when the toolchain is missing', () => {
  const fixture = withoutToolchain('lint-cli');
  const result = run(fixture, 'lint.mjs');
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stderr, /authoring toolchain/);
  assert.ok(result.stderr.includes(LINT_INSTALL), result.stderr);
  assert.equal(fs.existsSync(path.join(fixture, 'node_modules')), false, 'lint never installs tools');
});

test('verify runs lint first and stops before the existing checks when tools are missing', () => {
  const fixture = withoutToolchain('verify');
  const result = run(fixture, 'verify.mjs');
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.equal(result.stdout.trim(), 'verify: lint', 'no existing gate step runs before or after the failed lint');
  assert.match(result.stderr, /authoring toolchain/);
  assert.ok(result.stderr.includes(LINT_INSTALL), result.stderr);
  assert.equal(fs.existsSync(path.join(fixture, 'node_modules')), false, 'verify never installs tools');
});
