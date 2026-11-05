// A graph scan rejects unsupported input before npm can turn an incomplete graph
// into a clean verdict, while retaining available identity and exact input hashes.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';

const scratch = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'peer security é-')));
after(() => fs.rmSync(scratch, { recursive: true, force: true }));
const observedAudit = JSON.parse(fs.readFileSync(new URL('./fixtures/npm-audit-v2.json', import.meta.url), 'utf8'));

async function load() {
  const file = new URL('../lib/security-review.mjs', import.meta.url);
  assert.ok(fs.existsSync(file), 'the graph security reviewer is delivered');
  const implementation = await import(file);
  assert.equal(typeof implementation.reviewSecurity, 'function', 'reviewSecurity is available');
  return implementation;
}

function identityOnly(calls) {
  return async (command, args) => {
    calls.push({ command, args });
    assert.equal(command, 'npm');
    assert.notEqual(args[0], 'audit', 'unsupported input is refused before either audit');
    const stdout = args.includes('--version') ? '11.16.0\n' : 'https://registry.npmjs.org/\n';
    return { status: 0, signal: null, stdout, stderr: '' };
  };
}

test('unsupported lock input refuses both verdicts and retains exact input and scanner identity', async () => {
  const { reviewSecurity } = await load();
  for (const [name, bytes] of [
    ['malformed-json', '{'],
    ['old-lock', JSON.stringify({ lockfileVersion: 2, packages: { '': {} } })],
    ['missing-packages', JSON.stringify({ lockfileVersion: 3 })],
    ['missing-root', JSON.stringify({ lockfileVersion: 3, packages: {} })],
    ['unsafe-location', JSON.stringify({ lockfileVersion: 3, packages: { '': {}, '../outside': {} } })],
    [
      'linked-package',
      JSON.stringify({ lockfileVersion: 3, packages: { '': {}, 'node_modules/pkg': { link: true } } }),
    ],
  ]) {
    const cwd = path.join(scratch, name);
    fs.mkdirSync(cwd);
    const file = path.join(cwd, 'package-lock.json');
    fs.writeFileSync(file, bytes);
    const calls = [];
    const result = await reviewSecurity({ cwd, run: identityOnly(calls) });
    assert.equal(result.ok, false, name);
    assert.equal(result.vulnerabilities.status, 'input-failure', name);
    assert.equal(result.signatures.status, 'input-failure', name);
    assert.equal(result.lockfileHash, `sha256:${createHash('sha256').update(bytes).digest('hex')}`, name);
    assert.equal(result.nodeVersion, process.version, name);
    assert.equal(result.npmVersion, '11.16.0', name);
    assert.ok(Number.isFinite(Date.parse(result.scannedAt)), name);
    assert.match(JSON.stringify(result), /lock|package|location|JSON/i);
    assert.equal(fs.readFileSync(file, 'utf8'), bytes, 'the graph input stays unchanged');
    assert.ok(
      calls.some(({ args }) => args.includes('--version')),
      'npm identity is actually probed',
    );
    assert.ok(
      calls.every(({ args }) => args[0] !== 'audit'),
      'neither audit accepts an unsupported graph',
    );
  }
});

test('unreadable lock input has no hash and preserves the OS cause and available identity', async () => {
  const { reviewSecurity } = await load();
  const cwd = path.join(scratch, 'missing-lock');
  fs.mkdirSync(cwd);
  const result = await reviewSecurity({ cwd, run: identityOnly([]) });
  assert.equal(result.ok, false);
  assert.equal(result.vulnerabilities.status, 'input-failure');
  assert.equal(result.signatures.status, 'input-failure');
  assert.equal(result.lockfileHash, null);
  assert.equal(result.nodeVersion, process.version);
  assert.equal(result.npmVersion, '11.16.0');
  assert.match(JSON.stringify(result), /ENOENT/);
});

// A small supported graph: `runtime` is reached from dependencies, `devtool`
// from devDependencies, and `shared` from both (runtime depends on it).
function graph(name) {
  const cwd = path.join(scratch, name);
  fs.mkdirSync(cwd);
  const entry = (pkg, extra = {}) => ({
    version: '1.0.0',
    resolved: `https://registry.npmjs.org/${pkg}/-/${pkg}-1.0.0.tgz`,
    integrity: `sha512-${pkg}`,
    ...extra,
  });
  const lock = {
    name: 'graph',
    lockfileVersion: 3,
    requires: true,
    packages: {
      '': { name: 'graph', dependencies: { runtime: '1.0.0' }, devDependencies: { devtool: '1.0.0', shared: '1.0.0' } },
      'node_modules/runtime': entry('runtime', { dependencies: { shared: '1.0.0' } }),
      'node_modules/devtool': entry('devtool', { dev: true }),
      'node_modules/shared': entry('shared'),
    },
  };
  fs.writeFileSync(path.join(cwd, 'package-lock.json'), `${JSON.stringify(lock, null, 2)}\n`);
  return cwd;
}

/** npm 11's audit-report toJSON shape for the graph above, with the given entries. */
function audit(entries = []) {
  const vulnerabilities = { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 };
  for (const { severity } of entries) {
    vulnerabilities[severity] += 1;
    vulnerabilities.total += 1;
  }
  return {
    ...structuredClone(observedAudit),
    vulnerabilities: Object.fromEntries(entries.map((entry) => [entry.name, entry])),
    metadata: {
      vulnerabilities,
      dependencies: { prod: 2, dev: 1, optional: 0, peer: 0, peerOptional: 0, total: 3 },
    },
  };
}

function finding(name, severity) {
  const advisory = {
    source: 1244012,
    name,
    dependency: name,
    title: `${name} has a denial of service`,
    url: 'https://github.com/advisories/GHSA-g3hv-75wg-m249',
    severity,
    cwe: ['CWE-405'],
    cvss: { score: 0, vectorString: null },
    range: '<2.0.0',
  };
  return {
    name,
    severity,
    isDirect: false,
    via: [advisory],
    effects: [],
    range: '<2.0.0',
    nodes: [`node_modules/${name}`],
    fixAvailable: false,
  };
}

/** npm stand-in: identity replies, the given audit report, and npm's exit status at --audit-level=info. */
function scanner(report, calls = []) {
  return async (command, args, options) => {
    calls.push({ command, args, options });
    if (args.includes('--version')) return { status: 0, signal: null, stdout: '11.16.0\n', stderr: '' };
    if (args[0] === 'config') return { status: 0, signal: null, stdout: 'https://registry.npmjs.org/\n', stderr: '' };
    if (args.includes('signatures')) {
      return {
        status: 0,
        signal: null,
        stdout: JSON.stringify({ invalid: [], missing: [], verified: [] }),
        stderr: '',
      };
    }
    const status = report.metadata.vulnerabilities.total > 0 ? 1 : 0;
    return { status, signal: null, stdout: JSON.stringify(report), stderr: '' };
  };
}

test('a clean lock-only audit passes the vulnerability verdict with scope-pinning arguments', async () => {
  const { reviewSecurity } = await load();
  const cwd = graph('clean-audit');
  const calls = [];
  const report = audit();
  const result = await reviewSecurity({ cwd, run: scanner(report, calls) });
  assert.equal(result.vulnerabilities.status, 'passed');
  assert.deepEqual(result.vulnerabilities.report, report);
  assert.deepEqual(result.vulnerabilities.findings, []);
  const scan = calls.find(({ args }) => args[0] === 'audit' && !args.includes('signatures'));
  assert.ok(scan, 'the vulnerability audit runs');
  for (const flag of [
    '--json',
    '--package-lock-only',
    '--audit-level=info',
    '--include=dev',
    '--include=optional',
    '--include=peer',
    '--offline=false',
    '--ignore-scripts',
    '--registry=https://registry.npmjs.org/',
  ]) {
    assert.ok(scan.args.includes(flag), flag);
  }
  assert.equal(scan.options.cwd, cwd);
  assert.ok(!scan.args.includes('fix'));
});

/** Install only manifest evidence into the disposable graph; no npm or network is involved. */
function installGraph(cwd) {
  const lock = JSON.parse(fs.readFileSync(path.join(cwd, 'package-lock.json'), 'utf8'));
  const hidden = structuredClone(lock);
  delete hidden.packages[''];
  for (const [location, entry] of Object.entries(hidden.packages)) {
    const target = path.join(cwd, location, 'package.json');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, JSON.stringify({ name: location.split('node_modules/').at(-1), version: entry.version }));
  }
  fs.writeFileSync(path.join(cwd, 'node_modules/.package-lock.json'), JSON.stringify(hidden));
  return { lock, hidden };
}

function signatureScanner(signatureResult, calls = []) {
  const base = scanner(audit(), calls);
  return async (command, args, options) => {
    if (args.includes('signatures')) {
      calls.push({ command, args, options });
      return signatureResult;
    }
    return base(command, args, options);
  };
}

function processResult(value, status = 0) {
  return { status, signal: null, stdout: JSON.stringify(value), stderr: '' };
}

test('a clean signature verdict requires the full installed graph and preserves the independent audit', async () => {
  const { reviewSecurity } = await load();
  const cwd = graph('clean-signatures');
  installGraph(cwd);
  const calls = [];
  const report = { invalid: [], missing: [], verified: [] };
  const result = await reviewSecurity({ cwd, run: signatureScanner(processResult(report), calls) });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.vulnerabilities.status, 'passed');
  assert.equal(result.signatures.status, 'passed');
  assert.deepEqual(result.signatures.report, report);
  assert.equal(result.signatures.coverage.complete, true);
  const scan = calls.find(({ args }) => args.includes('signatures'));
  assert.ok(scan, 'signature verification actually runs');
  assert.equal(scan.options.cwd, cwd);
  for (const flag of ['--json', '--include-attestations', '--include=dev', '--include=optional', '--include=peer']) {
    assert.ok(scan.args.includes(flag), flag);
  }
});

test('missing and invalid signatures fail even with a complete installed graph', async () => {
  const { reviewSecurity } = await load();
  const cwd = graph('signature-findings');
  installGraph(cwd);
  const item = {
    name: 'devtool',
    version: '1.0.0',
    location: 'node_modules/devtool',
    registry: 'https://registry.npmjs.org/',
  };
  for (const key of ['missing', 'invalid']) {
    const report = { invalid: [], missing: [], verified: [], [key]: [item] };
    const result = await reviewSecurity({ cwd, run: signatureScanner(processResult(report, 1)) });
    assert.equal(result.ok, false, key);
    assert.equal(result.vulnerabilities.status, 'passed', key);
    assert.equal(result.signatures.status, 'signature-problems', key);
    assert.deepEqual(result.signatures.report, report, key);
  }
});

test('clean signature output cannot pass when a locked package or hidden lock evidence is missing', async () => {
  const { reviewSecurity } = await load();
  for (const fault of ['missing-package', 'wrong-version', 'hidden-integrity', 'missing-hidden-lock']) {
    const cwd = graph(`coverage-${fault}`);
    const { hidden } = installGraph(cwd);
    if (fault === 'missing-package') fs.rmSync(path.join(cwd, 'node_modules/devtool'), { recursive: true });
    if (fault === 'wrong-version')
      fs.writeFileSync(path.join(cwd, 'node_modules/devtool/package.json'), '{"version":"0.0.0"}');
    if (fault === 'hidden-integrity') {
      hidden.packages['node_modules/devtool'].integrity = 'sha512-different';
      fs.writeFileSync(path.join(cwd, 'node_modules/.package-lock.json'), JSON.stringify(hidden));
    }
    if (fault === 'missing-hidden-lock') fs.rmSync(path.join(cwd, 'node_modules/.package-lock.json'));
    const result = await reviewSecurity({
      cwd,
      run: signatureScanner(processResult({ invalid: [], missing: [], verified: [] })),
    });
    assert.equal(result.ok, false, fault);
    assert.equal(result.vulnerabilities.status, 'passed', fault);
    assert.equal(result.signatures.status, 'incomplete-coverage', fault);
    assert.equal(result.signatures.coverage.complete, false, fault);
  }
});

test('malformed verified-attestation entries from npm never pass', async () => {
  const { reviewSecurity } = await load();
  const cwd = graph('malformed-attestations');
  installGraph(cwd);
  const observed = JSON.parse(
    fs.readFileSync(new URL('./fixtures/npm-signatures-verified.json', import.meta.url), 'utf8'),
  );
  for (const field of ['attestations', 'attestationBundles', 'registry']) {
    const report = structuredClone(observed);
    delete report.verified[0][field];
    const result = await reviewSecurity({ cwd, run: signatureScanner(processResult(report)) });
    assert.equal(result.ok, false, field);
    assert.equal(result.signatures.status, 'malformed-report', field);
  }
});

test('a finding at any severity fails the vulnerability verdict with its advisory details', async () => {
  const { reviewSecurity } = await load();
  const cwd = graph('any-severity');
  for (const severity of ['info', 'low', 'moderate', 'high', 'critical']) {
    const entry = finding('devtool', severity);
    const result = await reviewSecurity({ cwd, run: scanner(audit([entry])) });
    assert.equal(result.ok, false, severity);
    assert.equal(result.vulnerabilities.status, 'vulnerable', severity);
    assert.equal(result.vulnerabilities.findings.length, 1, severity);
    const [reported] = result.vulnerabilities.findings;
    assert.equal(reported.name, 'devtool', severity);
    assert.equal(reported.severity, severity);
    assert.deepEqual(reported.advisories, entry.via, severity);
  }
});

test('each finding names whether runtime, development or both dependency paths reach it', async () => {
  const { reviewSecurity } = await load();
  const cwd = graph('exposure');
  const entries = ['runtime', 'devtool', 'shared'].map((name) => finding(name, 'high'));
  const result = await reviewSecurity({ cwd, run: scanner(audit(entries)) });
  const exposure = Object.fromEntries(result.vulnerabilities.findings.map(({ name, exposure }) => [name, exposure]));
  assert.deepEqual(exposure, {
    runtime: ['runtime'],
    devtool: ['development'],
    shared: ['runtime', 'development'],
  });
});

test('the real process runner bounds time and output and reports how a scan ended', async () => {
  const { runProcess } = await load();
  assert.equal(typeof runProcess, 'function', 'the reviewer delivers its own bounded process runner');
  const node = (code, limits = {}) =>
    runProcess(process.execPath, ['-e', code], { cwd: scratch, timeoutMs: 5000, maxOutputBytes: 1 << 16, ...limits });

  const completed = await node('process.stdout.write("{}"); process.stderr.write("note"); process.exitCode = 3;');
  assert.deepEqual(
    { status: completed.status, signal: completed.signal, stdout: completed.stdout, stderr: completed.stderr },
    { status: 3, signal: null, stdout: '{}', stderr: 'note' },
  );
  assert.ok(!completed.timedOut && !completed.outputLimitExceeded && !completed.unavailable);

  const slow = await node('setTimeout(() => {}, 60000);', { timeoutMs: 200 });
  assert.equal(slow.timedOut, true, 'a hung scan is stopped and reported as timed out');
  assert.equal(slow.status, null);

  const flood = await node('const s = "x".repeat(1 << 16); setInterval(() => process.stdout.write(s), 1);');
  assert.equal(flood.outputLimitExceeded, true, 'unbounded output is stopped, not accepted as a partial report');
  assert.ok(flood.stdout.length <= 1 << 16, 'retained output stays within the limit');

  const killed = await node('process.kill(process.pid, "SIGTERM"); setTimeout(() => {}, 60000);');
  assert.equal(killed.signal, 'SIGTERM');
  assert.ok(!killed.timedOut);

  const missing = await runProcess(path.join(scratch, 'no-such-npm'), [], {
    cwd: scratch,
    timeoutMs: 5000,
    maxOutputBytes: 1024,
  });
  assert.equal(missing.unavailable, true, 'a missing tool resolves as unavailable instead of throwing');
  assert.match(missing.stderr, /ENOENT/);
});

test('without an injected runner the review scans through the bounded process runner', async () => {
  const { reviewSecurity } = await load();
  const cwd = path.join(scratch, 'default-runner');
  fs.mkdirSync(cwd);
  fs.writeFileSync(path.join(cwd, 'package-lock.json'), '{');
  const result = await reviewSecurity({ cwd });
  assert.equal(result.vulnerabilities.status, 'input-failure');
  assert.match(
    String(result.npmVersion),
    /^\d+\.\d+\.\d+/,
    `the real npm identity probe ran: ${JSON.stringify(result.identityFailures)}`,
  );
});

test('audit process and report failures remain distinct while signature verification still runs', async () => {
  const { reviewSecurity } = await load();
  const cwd = graph('audit-failure-matrix');
  installGraph(cwd);
  const partial = audit();
  partial.metadata.dependencies.total -= 1;
  const contradictory = audit();
  contradictory.metadata.vulnerabilities.total = 1;
  for (const [input, expected] of [
    [{ ...processResult({}), stdout: '{' }, 'malformed-report'],
    [processResult({}), 'malformed-report'],
    [processResult(contradictory), 'malformed-report'],
    [processResult(partial), 'incomplete-coverage'],
    [
      processResult({ message: 'registry unavailable', uri: 'https://registry.npmjs.org/', statusCode: 503 }, 1),
      'service-failure',
    ],
    [processResult(audit(), 7), 'tool-failure'],
    [{ ...processResult(audit()), timedOut: true }, 'timeout'],
    [{ ...processResult(audit()), outputLimitExceeded: true }, 'output-limit'],
    [{ ...processResult(audit()), status: null, signal: 'SIGTERM' }, 'interrupted'],
    [new Error('spawn npm ENOENT'), 'tool-unavailable'],
  ]) {
    const base = scanner(audit());
    const calls = [];
    const run = async (command, args, options) => {
      calls.push(args);
      if (args[0] === 'audit' && !args.includes('signatures')) {
        if (input instanceof Error) throw input;
        return input;
      }
      return base(command, args, options);
    };
    const result = await reviewSecurity({ cwd, run });
    assert.equal(result.ok, false, expected);
    assert.equal(result.vulnerabilities.status, expected);
    assert.equal(result.signatures.status, 'passed', 'the independent result remains visible');
    assert.equal(calls.filter((args) => args[0] === 'audit').length, 2);
  }
});

test('signature service, report and unexplained-exit failures never pass', async () => {
  const { reviewSecurity } = await load();
  const cwd = graph('signature-failure-matrix');
  installGraph(cwd);
  for (const [input, expected] of [
    [processResult({}), 'malformed-report'],
    [processResult({ invalid: {}, missing: [], verified: [] }), 'malformed-report'],
    [processResult({ error: { summary: 'found no installed dependencies to audit' } }, 1), 'verification-unavailable'],
    [processResult({ error: { code: 'ENOTFOUND', summary: 'registry unavailable' } }, 1), 'service-failure'],
    [processResult({ error: { code: 'EUSAGE', summary: 'unknown option' } }, 1), 'tool-failure'],
    [processResult({ invalid: [], missing: [], verified: [] }, 1), 'tool-failure'],
  ]) {
    const result = await reviewSecurity({ cwd, run: signatureScanner(input) });
    assert.equal(result.ok, false, expected);
    assert.equal(result.vulnerabilities.status, 'passed');
    assert.equal(result.signatures.status, expected);
  }
});

test('identity failures retain their evidence and cannot pass after timeout or output overflow', async () => {
  const { reviewSecurity } = await load();
  const cwd = graph('identity-failures');
  installGraph(cwd);
  for (const probe of ['version', 'registry']) {
    for (const fault of ['malformed', 'nonzero', 'timedOut', 'outputLimitExceeded', 'unavailable']) {
      const base = scanner(audit());
      const result = await reviewSecurity({
        cwd,
        run: async (command, args, options) => {
          const output = await base(command, args, options);
          if ((probe === 'version' && args.includes('--version')) || (probe === 'registry' && args[0] === 'config')) {
            if (fault === 'unavailable') throw new Error('identity-ENOENT');
            if (fault === 'malformed') return { ...output, stdout: 'malformed-identity' };
            if (fault === 'nonzero') return { ...output, status: 7, stderr: 'identity-failed' };
            return { ...output, [fault]: true };
          }
          return output;
        },
      });
      assert.equal(result.ok, false, `${probe}: ${fault}`);
      assert.ok(Object.keys(result.identityFailures).length > 0, `${probe}: ${fault}`);
    }
  }
});

test('scope registries are pinned and unsupported locked sources cannot receive complete coverage', async () => {
  const { reviewSecurity } = await load();
  const cwd = graph('registry-scope');
  const lockFile = path.join(cwd, 'package-lock.json');
  const lock = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
  lock.packages[''].devDependencies['@scope/pkg'] = '1.0.0';
  lock.packages['node_modules/@scope/pkg'] = {
    version: '1.0.0',
    resolved: 'https://registry.npmjs.org/@scope/pkg/-/pkg-1.0.0.tgz',
    integrity: 'sha512-scoped',
  };
  fs.writeFileSync(lockFile, JSON.stringify(lock));
  installGraph(cwd);
  const report = audit();
  report.metadata.dependencies.dev += 1;
  report.metadata.dependencies.total += 1;
  for (const resolved of [undefined, 'git+ssh://git@example.test/pkg', 'https://registry.example.test/pkg.tgz']) {
    const calls = [];
    lock.packages['node_modules/devtool'].resolved = resolved;
    fs.writeFileSync(lockFile, JSON.stringify(lock));
    installGraph(cwd);
    const result = await reviewSecurity({ cwd, run: scanner(report, calls) });
    assert.equal(result.ok, false);
    assert.equal(result.signatures.status, 'incomplete-coverage');
    assert.ok(result.signatures.coverage.gaps.some(({ location }) => location === 'node_modules/devtool'));
    for (const { args } of calls.filter(({ args }) => args[0] === 'audit')) {
      for (const flag of [
        '--package-lock=true',
        '--global=false',
        '--workspaces=false',
        '--@scope:registry=https://registry.npmjs.org/',
      ]) {
        assert.ok(args.includes(flag), flag);
      }
    }
  }
});
