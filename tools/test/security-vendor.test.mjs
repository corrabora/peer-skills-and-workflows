import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { vendorManifest } from '../lib/vendor.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));
const scratch = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'peer security vendor é-')));
after(() => fs.rmSync(scratch, { recursive: true, force: true }));

async function load() {
  const file = new URL('../lib/security-vendor.mjs', import.meta.url);
  assert.ok(fs.existsSync(file), 'the isolated vendor security reviewer is delivered');
  const implementation = await import(file);
  assert.equal(typeof implementation.reviewVendor, 'function');
  return implementation;
}

function fixture(name) {
  const sourceRoot = path.join(scratch, name);
  fs.mkdirSync(sourceRoot);
  fs.copyFileSync(path.join(root, 'package.json'), path.join(sourceRoot, 'package.json'));
  fs.cpSync(path.join(root, 'tools/vendor'), path.join(sourceRoot, 'tools/vendor'), { recursive: true });
  const scratchRoot = path.join(scratch, `${name}-staging`);
  fs.mkdirSync(scratchRoot);
  return { sourceRoot, scratchRoot, vendor: path.join(sourceRoot, 'tools/vendor') };
}

function npmFixture({ vendor, sourceRoot, scratchRoot }, calls, { drift = false } = {}) {
  return async (command, args, { cwd }) => {
    calls.push({ command, args, cwd });
    assert.equal(command, 'npm');
    assert.ok(cwd.startsWith(`${scratchRoot}${path.sep}`), 'npm stays in the assigned isolated staging directory');
    assert.ok(!cwd.startsWith(`${sourceRoot}${path.sep}`), 'npm never runs inside the committed vendor tree');
    let stdout = '';
    if (args[0] === 'ci') {
      for (const flag of ['--ignore-scripts', '--no-bin-links', '--no-audit', '--no-fund']) {
        assert.ok(args.includes(flag), flag);
      }
      for (const file of ['package.json', 'package-lock.json']) {
        assert.deepEqual(fs.readFileSync(path.join(cwd, file)), fs.readFileSync(path.join(vendor, file)));
      }
      fs.cpSync(path.join(vendor, 'node_modules'), path.join(cwd, 'node_modules'), { recursive: true });
      const hidden = JSON.parse(fs.readFileSync(path.join(cwd, 'package-lock.json'), 'utf8'));
      delete hidden.packages[''];
      fs.writeFileSync(path.join(cwd, 'node_modules/.package-lock.json'), JSON.stringify(hidden));
      if (drift) fs.appendFileSync(path.join(cwd, 'node_modules/yaml/dist/index.js'), '\n// altered install\n');
    } else if (args.includes('--version')) stdout = '11.16.0\n';
    else if (args[0] === 'config') stdout = 'https://registry.npmjs.org/\n';
    else if (args.includes('signatures')) {
      assert.ok(
        fs.existsSync(path.join(cwd, 'node_modules/.package-lock.json')),
        'the hidden lock survives until scanning',
      );
      stdout = JSON.stringify({ invalid: [], missing: [], verified: [] });
    } else if (args[0] === 'audit') {
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

test('runtime security installs an isolated graph, reproduces vendor bytes and scans with its hidden lock', async () => {
  const { reviewVendor } = await load();
  const state = fixture('reproduced');
  const before = vendorManifest(state.vendor);
  const calls = [];
  const result = await reviewVendor({ ...state, run: npmFixture(state, calls) });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.reproduction.status, 'passed');
  assert.equal(result.signatures.status, 'passed');
  assert.equal(result.signatures.coverage.complete, true);
  const bytes = fs.readFileSync(path.join(state.vendor, 'package-lock.json'));
  assert.equal(result.lockfileHash, `sha256:${createHash('sha256').update(bytes).digest('hex')}`);
  assert.equal(calls.filter(({ args }) => args[0] === 'ci').length, 1);
  assert.equal(calls.filter(({ args }) => args[0] === 'audit').length, 2);
  assert.deepEqual(vendorManifest(state.vendor), before, 'the committed vendor inputs and bytes stay unchanged');
  assert.equal(fs.existsSync(calls[0].cwd), false, 'the staging directory is cleaned after scanning');
});

test('runtime security refuses reproduced-byte drift before running either audit', async () => {
  const { reviewVendor } = await load();
  const state = fixture('drifted');
  const before = vendorManifest(state.vendor);
  const calls = [];
  const result = await reviewVendor({ ...state, run: npmFixture(state, calls, { drift: true }) });
  assert.equal(result.ok, false);
  assert.equal(result.reproduction.status, 'mismatch');
  const bytes = fs.readFileSync(path.join(state.vendor, 'package-lock.json'));
  assert.equal(result.lockfileHash, `sha256:${createHash('sha256').update(bytes).digest('hex')}`);
  assert.match(JSON.stringify(result.reproduction), /yaml\/dist\/index\.js/);
  assert.equal(
    calls.filter(({ args }) => args[0] === 'audit').length,
    0,
    'mismatched bytes are not scanned as shipped',
  );
  assert.deepEqual(vendorManifest(state.vendor), before);
  assert.equal(fs.existsSync(calls[0].cwd), false, 'the rejected install is cleaned up');
});
