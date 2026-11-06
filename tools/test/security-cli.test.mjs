// `node tools/security-review.mjs` prints the complete JSON evidence on stdout,
// a verdict summary on stderr, and exits 1 unless both graphs pass. A fake npm
// placed first on PATH stands in for the registry.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fs.realpathSync.native(fileURLToPath(new URL('../..', import.meta.url)));
const scratch = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'peer security cli é-')));
after(() => fs.rmSync(scratch, { recursive: true, force: true }));

const FAKE_NPM = `import fs from 'node:fs';
import path from 'node:path';
const args = process.argv.slice(2);
const cwd = process.cwd();
const finding = process.env.FAKE_NPM_FINDING;
if (args[0] === 'ci') {
  fs.cpSync(path.join(process.env.FAKE_NPM_SOURCE, 'tools/vendor/node_modules'), path.join(cwd, 'node_modules'), { recursive: true });
  const hidden = JSON.parse(fs.readFileSync(path.join(cwd, 'package-lock.json'), 'utf8'));
  delete hidden.packages[''];
  fs.writeFileSync(path.join(cwd, 'node_modules/.package-lock.json'), JSON.stringify(hidden));
} else if (args.includes('--version')) process.stdout.write('11.16.0\\n');
else if (args[0] === 'config') process.stdout.write('https://registry.npmjs.org/\\n');
else if (args.includes('signatures')) process.stdout.write(JSON.stringify({ invalid: [], missing: [], verified: [] }));
else if (args[0] === 'audit') {
  const lock = JSON.parse(fs.readFileSync(path.join(cwd, 'package-lock.json'), 'utf8'));
  const total = Object.keys(lock.packages).length - 1;
  const counts = { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 };
  const vulnerabilities = {};
  if (finding && lock.packages['node_modules/' + finding]) {
    counts.high = 1;
    counts.total = 1;
    vulnerabilities[finding] = { name: finding, severity: 'high', isDirect: false, effects: [], range: '*',
      nodes: ['node_modules/' + finding], fixAvailable: false,
      via: [{ source: 1, name: finding, dependency: finding, title: 'fixture advisory', url: 'https://github.com/advisories/GHSA-0000-0000-0000', severity: 'high', range: '*' }] };
  }
  process.stdout.write(JSON.stringify({ auditReportVersion: 2, vulnerabilities, metadata: { vulnerabilities: counts,
    dependencies: { prod: total, dev: 0, optional: 0, peer: 0, peerOptional: 0, total } } }));
  process.exitCode = counts.total ? 1 : 0;
} else { process.stderr.write('unexpected npm ' + args.join(' ')); process.exitCode = 9; }
`;

function fakeNpm() {
  const bin = path.join(scratch, 'bin');
  fs.mkdirSync(bin, { recursive: true });
  fs.writeFileSync(path.join(bin, 'fake-npm.mjs'), FAKE_NPM);
  fs.writeFileSync(path.join(bin, 'npm'), `#!/bin/sh\nexec "${process.execPath}" "${bin}/fake-npm.mjs" "$@"\n`, {
    mode: 0o755,
  });
  return bin;
}

function cli(args = [], extraEnv = {}) {
  const tmp = path.join(scratch, `tmp-${Math.random().toString(36).slice(2)}`);
  fs.mkdirSync(tmp);
  const env = { ...process.env, PATH: `${fakeNpm()}${path.delimiter}${process.env.PATH}`, TMPDIR: tmp };
  Object.assign(env, { FAKE_NPM_SOURCE: root }, extraEnv);
  delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, [path.join(root, 'tools/security-review.mjs'), ...args], {
    cwd: root,
    env,
    encoding: 'utf8',
  });
  return { ...result, tmp };
}

test('the security command checks its arguments', () => {
  const result = cli(['--unexpected']);
  assert.equal(result.status, 2, result.stdout + result.stderr);
  assert.match(result.stderr, /usage: node tools\/security-review\.mjs/);
});

test('a clean review prints both graph verdicts as JSON and exits 0', () => {
  const result = cli();
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, true);
  assert.deepEqual(report.preflight, { vendor: true, payload: true });
  assert.equal(report.graphs.development.vulnerabilities.status, 'passed');
  assert.equal(report.graphs.runtime.reproduction.status, 'passed');
  assert.match(result.stderr, /development: vulnerabilities passed; signatures passed/);
  assert.match(result.stderr, /runtime: reproduction passed; vulnerabilities passed; signatures passed/);
  assert.deepEqual(fs.readdirSync(result.tmp), [], 'runtime staging is removed');
});

test('a finding in either graph fails the command and names the package and graph', () => {
  const result = cli([], { FAKE_NPM_FINDING: 'yaml' });
  assert.equal(result.status, 1, result.stdout + result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, false);
  assert.equal(report.graphs.runtime.vulnerabilities.status, 'vulnerable');
  assert.match(result.stderr, /runtime: yaml: high \(runtime\)/);
});
