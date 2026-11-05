// The repository security review covers both dependency graphs, development
// (the root package) and shipped runtime (tools/vendor), after the offline vendor and
// payload integrity checks that tie the runtime graph to the shipped plugin.

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { generatePluginPayload, PAYLOAD_DIRECTORY, PAYLOAD_PARTS } from '../lib/plugin-payload.mjs';

const root = fs.realpathSync.native(fileURLToPath(new URL('../..', import.meta.url)));
const scratch = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'peer security repository é-')));
after(() => fs.rmSync(scratch, { recursive: true, force: true }));

async function load() {
  const file = new URL('../lib/security-repository.mjs', import.meta.url);
  assert.ok(fs.existsSync(file), 'the repository security review is delivered');
  const implementation = await import(file);
  assert.equal(typeof implementation.reviewRepository, 'function');
  return implementation;
}

/** npm stand-in: a staged `ci` installs the committed vendor bytes; audits are clean for the graph in `cwd`. */
function npm(sourceRoot, calls) {
  return async (command, args, { cwd }) => {
    calls.push({ args, cwd });
    let stdout = '';
    if (args[0] === 'ci') {
      fs.cpSync(path.join(sourceRoot, 'tools/vendor/node_modules'), path.join(cwd, 'node_modules'), {
        recursive: true,
      });
      const hidden = JSON.parse(fs.readFileSync(path.join(cwd, 'package-lock.json'), 'utf8'));
      delete hidden.packages[''];
      fs.writeFileSync(path.join(cwd, 'node_modules/.package-lock.json'), JSON.stringify(hidden));
    } else if (args.includes('--version')) stdout = '11.16.0\n';
    else if (args[0] === 'config') stdout = 'https://registry.npmjs.org/\n';
    else if (args.includes('signatures')) stdout = JSON.stringify({ invalid: [], missing: [], verified: [] });
    else if (args[0] === 'audit') {
      const lock = JSON.parse(fs.readFileSync(path.join(cwd, 'package-lock.json'), 'utf8'));
      const total = Object.keys(lock.packages).length - 1;
      stdout = JSON.stringify({
        auditReportVersion: 2,
        vulnerabilities: {},
        metadata: {
          vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 },
          dependencies: { prod: total, dev: 0, optional: 0, peer: 0, peerOptional: 0, total },
        },
      });
    } else assert.fail(`unexpected npm command: ${args.join(' ')}`);
    return { status: 0, signal: null, stdout, stderr: '' };
  };
}

const sha256 = (file) => `sha256:${createHash('sha256').update(fs.readFileSync(file)).digest('hex')}`;

test('a clean review reports both named graphs and the integrity checks it ran first', async () => {
  const { reviewRepository } = await load();
  const calls = [];
  const errors = [];
  const out = { info() {}, error: (line) => errors.push(line) };
  const result = await reviewRepository({
    sourceRoot: root,
    scratchRoot: path.join(scratch, 'clean'),
    run: npm(root, calls),
    out,
  });
  assert.equal(result.ok, true, `${JSON.stringify(result, null, 2)}\n${errors.join('\n')}`);
  assert.deepEqual(result.preflight, { vendor: true, payload: true });
  const { development, runtime } = result.graphs;
  assert.equal(development.ok, true);
  assert.equal(development.lockfileHash, sha256(path.join(root, 'package-lock.json')));
  assert.equal(runtime.ok, true);
  assert.equal(runtime.reproduction.status, 'passed');
  assert.equal(runtime.lockfileHash, sha256(path.join(root, 'tools/vendor/package-lock.json')));
  const audits = calls.filter(({ args }) => args[0] === 'audit');
  assert.ok(
    audits.some(({ cwd }) => cwd === root),
    'the development graph is scanned in place',
  );
  assert.ok(
    audits.every(({ cwd }) => cwd === root || !cwd.startsWith(root)),
    'the runtime graph is scanned only in isolated staging',
  );
});

test('a failed integrity check fails the review without hiding either graph verdict', async () => {
  const { reviewRepository } = await load();
  const sourceRoot = path.join(scratch, 'drifted-source');
  for (const part of [...PAYLOAD_PARTS, 'package-lock.json', 'tools/lib/plugin-payload.mjs']) {
    fs.cpSync(path.join(root, part), path.join(sourceRoot, part), { recursive: true });
  }
  fs.symlinkSync(path.join(root, 'node_modules'), path.join(sourceRoot, 'node_modules'), 'dir');
  generatePluginPayload(sourceRoot);
  fs.appendFileSync(path.join(sourceRoot, PAYLOAD_DIRECTORY, 'skills/peer-review/SKILL.md'), ' ');
  const errors = [];
  const result = await reviewRepository({
    sourceRoot,
    scratchRoot: path.join(scratch, 'drifted'),
    run: npm(sourceRoot, []),
    out: { info() {}, error: (line) => errors.push(line) },
  });
  assert.equal(result.ok, false);
  assert.deepEqual(result.preflight, { vendor: true, payload: false });
  assert.ok(
    errors.some((line) => line.includes(PAYLOAD_DIRECTORY)),
    `the payload diagnostic is reported: ${errors.join('\n')}`,
  );
  assert.equal(result.graphs.development.ok, true, 'the development verdict is still reported');
  assert.equal(result.graphs.runtime.reproduction.status, 'passed', 'the runtime verdict is still reported');
});

test('runtime install failure retains its input hash and the independent development verdict', async () => {
  const { reviewRepository } = await load();
  const base = npm(root, []);
  const result = await reviewRepository({
    sourceRoot: root,
    scratchRoot: path.join(scratch, 'failed-install'),
    out: { info() {}, error() {} },
    run: async (command, args, options) => {
      if (args[0] === 'ci') return { status: 1, signal: null, stdout: '', stderr: 'registry install failed' };
      return base(command, args, options);
    },
  });
  assert.equal(result.ok, false);
  assert.equal(result.graphs.development.ok, true);
  assert.equal(result.graphs.runtime.reproduction.status, 'install-failure');
  assert.equal(result.graphs.runtime.lockfileHash, sha256(path.join(root, 'tools/vendor/package-lock.json')));
  assert.equal(result.graphs.runtime.vulnerabilities.status, 'not-run');
  assert.equal(result.graphs.runtime.signatures.status, 'not-run');
  assert.match(JSON.stringify(result.graphs.runtime), /registry install failed/);
});

test('an unavailable runtime installer remains a report with both graph verdicts and its OS cause', async () => {
  const { reviewRepository } = await load();
  const base = npm(root, []);
  const stagingRoot = path.join(scratch, 'missing-installer');
  const result = await reviewRepository({
    sourceRoot: root,
    scratchRoot: stagingRoot,
    out: { info() {}, error() {} },
    run: async (command, args, options) => {
      if (args[0] === 'ci') throw Object.assign(new Error('spawn npm ENOENT'), { code: 'ENOENT' });
      return base(command, args, options);
    },
  });
  assert.equal(result.ok, false);
  assert.equal(result.graphs.development.ok, true);
  assert.equal(result.graphs.runtime.reproduction.status, 'install-failure');
  assert.equal(result.graphs.runtime.reproduction.unavailable, true);
  assert.equal(result.graphs.runtime.lockfileHash, sha256(path.join(root, 'tools/vendor/package-lock.json')));
  assert.match(JSON.stringify(result.graphs.runtime), /ENOENT/);
  assert.deepEqual(fs.readdirSync(stagingRoot), [], 'failed installer staging is cleaned');
});

test('an unexpected error in one graph review is reported without discarding the other graph', async () => {
  const { reviewRepository } = await load();
  const sourceRoot = path.join(scratch, 'missing-vendor-lock');
  for (const part of [...PAYLOAD_PARTS, 'package-lock.json']) {
    fs.cpSync(path.join(root, part), path.join(sourceRoot, part), { recursive: true });
  }
  fs.symlinkSync(path.join(root, 'node_modules'), path.join(sourceRoot, 'node_modules'), 'dir');
  fs.rmSync(path.join(sourceRoot, 'tools/vendor/package-lock.json'));
  const result = await reviewRepository({
    sourceRoot,
    scratchRoot: path.join(scratch, 'missing-vendor-lock-staging'),
    run: npm(root, []),
    out: { info() {}, error() {} },
  });
  assert.equal(result.ok, false);
  assert.equal(result.preflight.vendor, false);
  assert.equal(result.graphs.development.ok, true, 'the development verdict survives');
  assert.equal(result.graphs.runtime.ok, false);
  assert.equal(result.graphs.runtime.status, 'incomplete');
  assert.match(result.graphs.runtime.error, /ENOENT|package-lock\.json/);
});
