// Orca provisions the root development package; plugin installation receives
// only the derived runtime manifest and committed vendored dependencies.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { LINT_INSTALL } from '../lib/lint.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));
const json = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const PINS = {
  '@eslint/js': '10.0.1',
  eslint: '10.14.0',
  'eslint-config-prettier': '10.1.8',
  'eslint-plugin-n': '18.5.0',
  'eslint-plugin-prettier': '5.5.7',
  prettier: '3.9.10',
};

test('the root package owns the exact development toolchain and lint-first npm aliases', () => {
  const manifest = json('package.json');
  assert.deepEqual(manifest.devDependencies, PINS);
  assert.equal(manifest.dependencies, undefined, 'runtime dependencies remain vendored');
  assert.equal(manifest.engines.node, '>=22', 'the derived runtime keeps its Node floor');
  assert.equal(manifest.scripts.lint, 'node tools/lint.mjs');
  assert.equal(manifest.scripts.verify, 'node tools/verify.mjs');
  assert.match(manifest.scripts.test, /(?:npm run lint|node tools\/lint\.mjs)\s*&&\s*node --test/);
});

test('the real root lock describes only the development graph and never ships in the payload', () => {
  const lock = json('package-lock.json');
  assert.equal(lock.lockfileVersion, 3);
  assert.deepEqual(lock.packages[''].devDependencies, PINS);
  const packages = Object.entries(lock.packages).filter(([location]) => location !== '');
  assert.ok(packages.length > 0, 'the stub root lock has been replaced');
  for (const [location, entry] of packages) assert.equal(entry.dev, true, `${location} is development-only`);
  assert.equal(fs.existsSync(path.join(root, 'plugins/peer/package-lock.json')), false);
  const payload = json('plugins/peer/package.json');
  for (const field of ['dependencies', 'devDependencies', 'scripts', 'overrides', 'devEngines']) {
    assert.equal(payload[field], undefined, `${field} never ships`);
  }
});

test('root installation and configuration replace the tools/dev package', () => {
  assert.equal(LINT_INSTALL, 'npm ci --ignore-scripts');
  assert.ok(fs.existsSync(path.join(root, 'eslint.config.mjs')), 'ESLint configuration is at the development root');
  assert.equal(fs.existsSync(path.join(root, 'tools/dev')), false, 'the obsolete development package is removed');
});
