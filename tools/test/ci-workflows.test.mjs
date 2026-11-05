// CI runs the same complete gate as a commit, so it installs the authoring
// toolchain that the gate's first check, lint, requires.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { LINT_INSTALL } from '../lib/lint.mjs';
import { parseYaml } from '../lib/yaml.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));
const workflow = (name) => parseYaml(fs.readFileSync(path.join(root, '.github/workflows', name), 'utf8'));

test('the CI gate installs the authoring toolchain before running the complete gate', () => {
  const steps = workflow('gate.yml').jobs.gate.steps;
  const install = steps.findIndex((step) => step.run?.trim() === LINT_INSTALL);
  const verify = steps.findIndex((step) => step.run?.trim() === 'node tools/verify.mjs');
  assert.ok(install >= 0, `a gate step runs exactly: ${LINT_INSTALL}`);
  assert.ok(verify > install, 'verification runs after the toolchain is installed');
});

test('a separate least-privilege workflow runs only the live security review', () => {
  const security = workflow('security.yml');
  assert.ok(security.on.schedule?.length, 'a schedule catches newly published advisories');
  assert.ok('workflow_dispatch' in security.on, 'the review can be started manually');
  const paths = security.on.pull_request?.paths ?? [];
  for (const file of [
    'package.json',
    'package-lock.json',
    '.npmrc',
    'tools/vendor/package.json',
    'tools/vendor/package-lock.json',
    'tools/security-review.mjs',
    'tools/lib/security-*.mjs',
    'tools/test/security-*.test.mjs',
    '.github/workflows/security.yml',
  ]) {
    assert.ok(paths.includes(file), `pull requests changing ${file} run the review`);
  }
  assert.deepEqual(security.permissions, { contents: 'read' });
  const { steps } = security.jobs.security;
  const gateUses = workflow('gate.yml')
    .jobs.gate.steps.map((step) => step.uses)
    .filter(Boolean);
  assert.deepEqual(steps.map((step) => step.uses).filter(Boolean), gateUses, 'the same pinned actions as the gate');
  const runs = steps.map((step) => step.run?.trim()).filter(Boolean);
  assert.ok(runs.includes(LINT_INSTALL), 'the development graph is installed for its signature scan');
  assert.equal(runs.at(-1), 'node tools/security-review.mjs');
  assert.ok(!runs.some((run) => run.includes('verify.mjs') || run.includes('--test')), 'the offline gate is not rerun');
  assert.ok(
    !JSON.stringify(workflow('gate.yml')).includes('security-review'),
    'security stays out of the offline gate',
  );
});

/** Repository files the security command loads, following relative imports from its entry point. */
function importClosure(entry) {
  const seen = new Set();
  const visit = (file) => {
    const relative = path.relative(root, file).split(path.sep).join('/');
    if (seen.has(relative)) return;
    seen.add(relative);
    const text = fs.readFileSync(file, 'utf8');
    for (const [, specifier] of text.matchAll(/^import[^'"]*['"](\.{1,2}\/[^'"]+)['"]/gm)) {
      visit(path.resolve(path.dirname(file), specifier));
    }
  };
  visit(path.join(root, entry));
  return [...seen].sort();
}

const matchesFilter = (file, pattern) =>
  new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*')}$`).test(file);

test('pull requests changing any module the security command loads run the review', () => {
  const paths = workflow('security.yml').on.pull_request.paths;
  const closure = importClosure('tools/security-review.mjs');
  assert.ok(closure.includes('tools/lib/vendor.mjs') && closure.includes('tools/lib/plugin-payload.mjs'));
  const uncovered = closure.filter((file) => !paths.some((pattern) => matchesFilter(file, pattern)));
  assert.deepEqual(uncovered, [], 'every loaded module is a security workflow trigger');
});
