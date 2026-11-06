// The plugin payload is a byte copy of linted sources: generation refuses to
// copy JavaScript that fails lint, and the gate proves every shipped
// JavaScript source is a lint target.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { WITHOUT_GIT } from '../test-support/git-environment.mjs';
import { LINT_INSTALL } from '../lib/lint.mjs';
import { PAYLOAD_DIRECTORY, PAYLOAD_PARTS } from '../lib/plugin-payload.mjs';

const root = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const scratch = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'peer payload lint é-')));
after(() => fs.rmSync(scratch, { recursive: true, force: true }));

const env = { ...WITHOUT_GIT, GIT_OPTIONAL_LOCKS: '0' };
delete env.NODE_TEST_CONTEXT;

function git(cwd, ...args) {
  const result = spawnSync('git', args, { cwd, env, encoding: 'utf8' });
  assert.equal(result.status, 0, `git ${args.join(' ')}: ${result.stderr}`);
}

/** A Git checkout holding the payload sources and generator, without the installed authoring toolchain. */
function source(name, { toolchain = false } = {}) {
  const dir = path.join(scratch, name);
  for (const part of [
    ...PAYLOAD_PARTS,
    '.prettierrc.json',
    'eslint.config.mjs',
    'tools/generate-plugin.mjs',
    'tools/lib/plugin-payload.mjs',
  ]) {
    fs.cpSync(path.join(root, part), path.join(dir, part), { recursive: true });
  }
  if (toolchain) fs.symlinkSync(path.join(root, 'node_modules'), path.join(dir, 'node_modules'), 'dir');
  git(dir, 'init', '-q');
  fs.appendFileSync(path.join(dir, '.gitignore'), '/node_modules\n');
  return dir;
}

function generate(dir) {
  return spawnSync(process.execPath, [path.join(dir, 'tools/generate-plugin.mjs')], {
    cwd: dir,
    env,
    encoding: 'utf8',
  });
}

test('the gate reports a shipped JavaScript source that lint does not cover', async () => {
  const payload = await import('../lib/plugin-payload.mjs');
  assert.equal(typeof payload.checkPayloadLintCoverage, 'function', 'the payload needs a lint coverage check');
  assert.match(
    fs.readFileSync(path.join(root, 'tools/verify.mjs'), 'utf8'),
    /checkPayloadLintCoverage\(/,
    'verify runs the coverage check',
  );
  const dir = source('coverage');
  fs.appendFileSync(path.join(dir, '.gitignore'), 'skills/hidden.mjs\n');
  fs.writeFileSync(path.join(dir, 'skills/hidden.mjs'), 'export {};\n');
  git(dir, 'add', '-A');
  const errors = [];
  const out = { info() {}, error: (line) => errors.push(line) };
  assert.equal(
    payload.checkPayloadLintCoverage({ sourceRoot: dir, out }),
    false,
    'an ignored shipped source is uncovered',
  );
  assert.ok(
    errors.some((line) => line.includes('skills/hidden.mjs')),
    `the diagnostic names the file: ${errors.join('\n')}`,
  );
  fs.rmSync(path.join(dir, 'skills/hidden.mjs'));
  errors.length = 0;
  assert.equal(
    payload.checkPayloadLintCoverage({ sourceRoot: dir, out }),
    true,
    `every other shipped source, apart from vendored packages, is covered: ${errors.join('\n')}`,
  );
});

test('generation refuses to copy sources when the authoring toolchain is missing', () => {
  const dir = source('missing-toolchain');
  const result = generate(dir);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.ok(result.stderr.includes(LINT_INSTALL), result.stderr);
  assert.equal(fs.existsSync(path.join(dir, PAYLOAD_DIRECTORY)), false, 'nothing is generated');
});

test('generation refuses to copy JavaScript that fails lint', () => {
  const dir = source('lint-failure', { toolchain: true });
  fs.writeFileSync(path.join(dir, 'skills/dirty.mjs'), 'const unused = 1;\n');
  const result = generate(dir);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout + result.stderr, /skills\/dirty\.mjs/);
  assert.match(result.stdout + result.stderr, /no-unused-vars/);
  assert.equal(fs.existsSync(path.join(dir, PAYLOAD_DIRECTORY)), false, 'nothing is generated');
});
