// Lint covers every JavaScript source this repository authors and ships, and
// nothing it copies or vendors from elsewhere.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { WITHOUT_GIT } from '../test-support/git-environment.mjs';

const scratch = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'peer lint é-')));
after(() => fs.rmSync(scratch, { recursive: true, force: true }));

function git(cwd, ...args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', env: { ...WITHOUT_GIT, GIT_OPTIONAL_LOCKS: '0' } });
  assert.equal(result.status, 0, `git ${args.join(' ')}: ${result.stderr}`);
}

function write(root, files) {
  for (const [relative, content] of Object.entries(files)) {
    const file = path.join(root, ...relative.split('/'));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }
}

test('lint targets are tracked and unignored authored JavaScript plus the commit hook', async () => {
  const { lintTargets } = await import('../lib/lint.mjs');
  const root = path.join(scratch, 'targets');
  fs.mkdirSync(root);
  git(root, 'init', '-q');
  write(root, {
    '.gitignore': 'ignored.mjs\n/node_modules/\n',
    '.githooks/commit-msg': "#!/usr/bin/env node\nrequire('node:path');\n",
    'README.md': '# not JavaScript\n',
    'tools/a.mjs': 'export {};\n',
    'tools/b.js': 'export {};\n',
    'tools/c.cjs': 'module.exports = {};\n',
    'eslint.config.mjs': 'export default [];\n',
    'plugins/peer/tools/a.mjs': 'export {};\n',
    'tools/vendor/node_modules/ajv/index.js': 'module.exports = {};\n',
    'tests/fixture/node_modules/pkg/index.mjs': 'export {};\n',
  });
  git(root, 'add', '-A');
  write(root, {
    'tools/untracked.mjs': 'export {};\n',
    'ignored.mjs': 'export {};\n',
    'node_modules/eslint/lib/api.js': 'module.exports = {};\n',
  });
  assert.deepEqual(lintTargets(root), [
    '.githooks/commit-msg',
    'eslint.config.mjs',
    'tools/a.mjs',
    'tools/b.js',
    'tools/c.cjs',
    'tools/untracked.mjs',
  ]);
});

const repositoryRoot = fileURLToPath(new URL('../..', import.meta.url));
const config = path.join(repositoryRoot, 'eslint.config.mjs');
const requireDev = createRequire(new URL('../../package.json', import.meta.url));

async function configuredLint(text, { file = 'tools/lib/lint-vector.mjs', overrideConfig } = {}) {
  assert.ok(fs.existsSync(config), 'the agreed explicit ESLint configuration exists');
  const { ESLint } = requireDev('eslint');
  return new ESLint({ cwd: repositoryRoot, overrideConfigFile: config, overrideConfig }).lintText(text, {
    filePath: path.join(repositoryRoot, file),
  });
}

const messages = (results) => results.flatMap((result) => result.messages);

test('a real warning-only ESLint result fails the lint outcome', async () => {
  const implementation = await import('../lib/lint.mjs');
  assert.equal(typeof implementation.lintOutcome, 'function', 'lintOutcome is available');
  const results = await configuredLint("console.log('x');\n", { overrideConfig: { rules: { 'no-console': 'warn' } } });
  assert.deepEqual(
    messages(results).map(({ ruleId, severity }) => [ruleId, severity]),
    [['no-console', 1]],
  );
  assert.deepEqual(implementation.lintOutcome(results), { ok: false, errors: 0, warnings: 1, files: 1 });
  const clean = await configuredLint("export const x = 'x';\n");
  assert.deepEqual(implementation.lintOutcome(clean), { ok: true, errors: 0, warnings: 0, files: 1 });
});

test('the configured JavaScript, Node >=22 and Prettier rules enforce source conformance', async () => {
  for (const [text, rule] of [
    ['const unused = 1;\n', 'no-unused-vars'],
    ['if (import.meta.main) {\n}\n', 'n/no-unsupported-features/node-builtins'],
    ['export const x = "x"\n', 'prettier/prettier'],
  ]) {
    const results = await configuredLint(text);
    assert.ok(
      messages(results).some(({ ruleId, severity }) => ruleId === rule && severity === 2),
      rule,
    );
  }
});

test('inline suppression cannot bypass a configured rule', async () => {
  const results = await configuredLint('// eslint-disable-next-line no-unused-vars\nconst unused = 1;\n');
  assert.ok(messages(results).some(({ ruleId, severity }) => ruleId === 'no-unused-vars' && severity === 2));
});

test('the extensionless commit hook uses CommonJS parsing and globals', async () => {
  const results = await configuredLint(
    "#!/usr/bin/env node\nconst path = require('node:path');\nmodule.exports = path;\n",
    {
      file: '.githooks/commit-msg',
    },
  );
  assert.deepEqual(messages(results), []);
});

test('lint() lints a checkout with the repository configuration and reports each failing file', async () => {
  const { lint } = await import('../lib/lint.mjs');
  assert.equal(typeof lint, 'function', 'lint is available');
  const root = path.join(scratch, 'runner');
  fs.mkdirSync(root);
  git(root, 'init', '-q');
  fs.copyFileSync(path.join(repositoryRoot, '.prettierrc.json'), path.join(root, '.prettierrc.json'));
  write(root, { 'tools/clean.mjs': "export const x = 'x';\n" });
  const clean = await lint({ root });
  assert.deepEqual([clean.ok, clean.files, clean.errors, clean.warnings], [true, 1, 0, 0], clean.report);
  write(root, { 'tools/dirty.mjs': 'const unused = 1;\n' });
  const dirty = await lint({ root });
  assert.deepEqual([dirty.ok, dirty.files], [false, 2], dirty.report);
  assert.ok(dirty.errors >= 1);
  assert.match(dirty.report, /tools\/dirty\.mjs/);
  assert.match(dirty.report, /no-unused-vars/);
});

test('lint() fails with the install command when the authoring toolchain is missing', async () => {
  const { lint, LINT_INSTALL } = await import('../lib/lint.mjs');
  assert.equal(LINT_INSTALL, 'npm ci --ignore-scripts');
  const devRoot = path.join(scratch, 'no-toolchain');
  fs.mkdirSync(devRoot);
  fs.writeFileSync(path.join(devRoot, 'package.json'), '{}\n');
  await assert.rejects(lint({ root: repositoryRoot, devRoot }), (error) => {
    assert.match(error.message, /authoring toolchain/);
    assert.ok(error.message.includes(LINT_INSTALL), error.message);
    return true;
  });
});

test('lint target selection keeps its repository root despite inherited Git routing variables', async () => {
  const { lintTargets } = await import('../lib/lint.mjs');
  const wanted = path.join(scratch, 'routing-wanted');
  const foreign = path.join(scratch, 'routing-foreign');
  for (const [root, file] of [
    [wanted, 'authored.mjs'],
    [foreign, 'foreign.mjs'],
  ]) {
    fs.mkdirSync(root);
    git(root, 'init', '-q');
    write(root, { [file]: 'export {};\n' });
    git(root, 'add', '-A');
  }
  const routing = {
    GIT_DIR: path.join(foreign, '.git'),
    GIT_COMMON_DIR: path.join(foreign, '.git'),
    GIT_WORK_TREE: foreign,
    GIT_INDEX_FILE: path.join(foreign, '.git/index'),
  };
  const saved = Object.fromEntries(Object.keys(routing).map((key) => [key, process.env[key]]));
  try {
    Object.assign(process.env, routing);
    assert.deepEqual(lintTargets(wanted), ['authored.mjs']);
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
