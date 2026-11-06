// Dependency security review of one npm dependency graph: a committed
// lockfile v3 and, for signatures, its installed tree. Adapted from the
// quality-profiles scanner; tools/security-review.mjs reviews both graphs.
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join, posix } from 'node:path';

/** The supported scope: packages, advisories and signing keys from the public npm registry. */
export const publicRegistry = 'https://registry.npmjs.org/';

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

function parse(text) {
  try {
    return { value: JSON.parse(text) };
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Arguments that keep caller configuration from silently narrowing or redirecting
 * a scan: an `omit` setting or NODE_ENV=production, `offline`, global or workspace
 * selection, lifecycle scripts, and registry overrides, including per-scope ones,
 * since signature verification picks each package's registry by its scope.
 */
function scopeArgs(lock) {
  const scopes = new Set(
    Object.keys(lock.packages)
      .map((location) => location.split('node_modules/').at(-1).split('/')[0])
      .filter((name) => name.startsWith('@')),
  );
  return [
    '--package-lock=true',
    '--global=false',
    '--workspaces=false',
    '--ignore-scripts',
    '--offline=false',
    '--include=dev',
    '--include=optional',
    '--include=peer',
    `--registry=${publicRegistry}`,
    ...[...scopes].sort().map((scope) => `--${scope}:registry=${publicRegistry}`),
  ];
}

/**
 * Run a scanner without a shell, retaining at most maxOutputBytes across both
 * streams. Timeout/overflow terminate its process group on supported POSIX hosts;
 * after a short grace period SIGKILL prevents an uncooperative child from hanging
 * verification. Partial output remains evidence and never counts as a report.
 * @param {string} command
 * @param {string[]} args
 * @param {{cwd: string, timeoutMs?: number, maxOutputBytes?: number}} options
 */
export function runProcess(command, args, { cwd, timeoutMs = 120000, maxOutputBytes = 8 * 1024 * 1024 }) {
  return new Promise((resolve) => {
    const chunks = { stdout: [], stderr: [] };
    let retained = 0;
    let timedOut = false;
    let outputLimitExceeded = false;
    let unavailable = false;
    let termination;
    let deadline;
    let settled = false;
    const child = spawn(command, args, {
      cwd,
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const finish = (status, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      clearTimeout(termination);
      resolve({
        status,
        signal,
        stdout: Buffer.concat(chunks.stdout).toString('utf8'),
        stderr: Buffer.concat(chunks.stderr).toString('utf8'),
        timedOut,
        outputLimitExceeded,
        unavailable,
      });
    };
    const stop = () => {
      if (termination) return;
      const kill = (signal) => {
        try {
          if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, signal);
          else child.kill(signal);
        } catch (error) {
          if (error.code !== 'ESRCH') unavailable = true;
        }
      };
      kill('SIGTERM');
      termination = setTimeout(() => kill('SIGKILL'), 250);
    };
    const capture = (stream, bytes) => {
      if (settled) return;
      const remaining = Math.max(0, maxOutputBytes - retained);
      if (remaining > 0) chunks[stream].push(bytes.subarray(0, remaining));
      retained += Math.min(bytes.length, remaining);
      if (bytes.length > remaining) {
        outputLimitExceeded = true;
        stop();
      }
    };
    child.stdout.on('data', (bytes) => capture('stdout', bytes));
    child.stderr.on('data', (bytes) => capture('stderr', bytes));
    child.on('error', (error) => {
      unavailable = true;
      capture('stderr', Buffer.from(`${command}: ${error.code ?? error.message}\n`));
      finish(null, null);
    });
    child.on('close', finish);
    deadline = setTimeout(() => {
      timedOut = true;
      stop();
    }, timeoutMs);
  });
}

/** Classify a process outcome that prevents any report from being trusted. */
function processFailure(result) {
  if (result.unavailable) return 'tool-unavailable';
  if (result.timedOut) return 'timeout';
  if (result.outputLimitExceeded) return 'output-limit';
  if (result.signal) return 'interrupted';
  return undefined;
}

/** Run one npm command, recording a spawn failure as an unavailable tool. */
async function attempt(run, args, cwd) {
  try {
    return await run('npm', args, { cwd });
  } catch (error) {
    return { status: null, signal: null, stdout: '', stderr: String(error.message), unavailable: true };
  }
}

/** A command's trimmed output when it completed and matches `pattern`, otherwise null. */
async function identity(run, args, cwd, pattern) {
  const result = await attempt(run, args, cwd);
  const value = result.stdout?.trim() ?? '';
  if (!processFailure(result) && result.status === 0 && !result.signal && pattern.test(value)) return { value };
  return { value: null, failure: { args, ...result, reason: 'unexpected or failed output' } };
}

/** One `node_modules/<name>` or `node_modules/@scope/<name>` step, repeated for nesting. */
function isInstallLocation(location) {
  const segments = location.split('/');
  for (let i = 0; i < segments.length;) {
    if (segments[i] !== 'node_modules') return false;
    const scoped = segments[i + 1]?.startsWith('@');
    const name = segments.slice(i + 1, i + (scoped ? 3 : 2));
    if (name.length !== (scoped ? 2 : 1) || name.some((part) => !part || part === '.' || part === '..')) return false;
    i += scoped ? 3 : 2;
  }
  return segments.length > 1;
}

/**
 * Supported input: a lockfile v3 graph rooted at `""`, whose other entries are
 * installed package locations inside node_modules. Links and workspaces would
 * leave packages outside both scans, so they are refused rather than skipped.
 */
function lockProblem(bytes, readError) {
  if (readError) return { reason: `package-lock.json cannot be read: ${readError.code ?? readError.message}` };
  const { value: lock, error } = parse(bytes.toString('utf8'));
  if (error !== undefined) return { reason: `package-lock.json is not JSON: ${error}` };
  if (!isObject(lock) || lock.lockfileVersion !== 3) return { reason: 'package-lock.json is not lockfileVersion 3' };
  if (!isObject(lock.packages) || !isObject(lock.packages[''])) {
    return { reason: 'package-lock.json has no packages graph with a root entry' };
  }
  for (const [location, entry] of Object.entries(lock.packages)) {
    if (location === '') continue;
    if (!isInstallLocation(location)) return { reason: 'unsupported package location', location };
    if (!isObject(entry)) return { reason: 'package entry is not an object', location };
    if (entry.link) return { reason: 'linked package is outside the supported scan scope', location };
  }
  return { lock };
}

// A lock entry's `dev` flag means development-only; false does not distinguish
// runtime-only from shared. Trace both root graphs to retain that distinction.
function dependencyExposure(lock) {
  const exposure = new Map();
  const resolve = (from, name) => {
    let parent = from;
    for (;;) {
      const location = parent ? `${parent}/node_modules/${name}` : `node_modules/${name}`;
      if (lock.packages[location]) return location;
      if (!parent) return undefined;
      parent = posix.dirname(parent);
      if (parent === '.') parent = '';
    }
  };
  const visit = (from, dependencies, kind) => {
    for (const name of Object.keys(dependencies)) {
      const location = resolve(from, name);
      if (!location) continue;
      const kinds = exposure.get(location) ?? new Set();
      if (kinds.has(kind)) continue;
      kinds.add(kind);
      exposure.set(location, kinds);
      const entry = lock.packages[location];
      visit(location, { ...entry.dependencies, ...entry.optionalDependencies, ...entry.peerDependencies }, kind);
    }
  };
  const root = lock.packages[''];
  visit('', { ...root.dependencies, ...root.optionalDependencies, ...root.peerDependencies }, 'runtime');
  visit('', root.devDependencies ?? {}, 'development');
  return exposure;
}

const severities = ['info', 'low', 'moderate', 'high', 'critical'];

/** Codes npm's error-message.js reports as network connectivity failures, plus ECONNREFUSED/EAI_AGAIN. */
const networkCodes = new Set([
  'ECONNRESET',
  'ENOTFOUND',
  'ETIMEDOUT',
  'ERR_SOCKET_TIMEOUT',
  'EAI_FAIL',
  'EAI_AGAIN',
  'ECONNREFUSED',
]);

/** verify-signatures.js throws these when nothing installed could be checked against registry keys. */
const unverifiable = [
  'found no installed dependencies to audit',
  'found no dependencies to audit that were installed from a supported registry',
];

/**
 * Classify npm's JSON failure output, or return undefined for other output.
 * audit-error.js prints the registry response (`message`, `uri`, `statusCode`)
 * for a failed advisory request; output-error.js prints `{error: {code, summary,
 * detail}}` for any other thrown error.
 */
function npmFailure(value) {
  if (!isObject(value)) return undefined;
  if (typeof value.message === 'string' && 'uri' in value) return 'service-failure';
  if (!isObject(value.error)) return undefined;
  const { code, summary } = value.error;
  if (unverifiable.includes(String(summary).trim())) return 'verification-unavailable';
  if (networkCodes.has(code) || /^E\d{3}$/.test(String(code))) return 'service-failure';
  return 'tool-failure';
}

const dependencyClasses = ['prod', 'dev', 'optional', 'peer', 'peerOptional', 'total'];

/**
 * The audit-report.js toJSON shape: version 2, vulnerability entries whose
 * per-severity counts match the metadata, each naming locked node locations, and
 * dependency counts for the audited tree.
 */
function isAuditReport(report, lock) {
  if (!isObject(report) || report.auditReportVersion !== 2 || !isObject(report.vulnerabilities)) return false;
  const counts = report.metadata?.vulnerabilities;
  const dependencies = report.metadata?.dependencies;
  if (!isObject(counts) || !isObject(dependencies)) return false;
  if (![...severities, 'total'].every((key) => Number.isInteger(counts[key]))) return false;
  if (!dependencyClasses.every((key) => Number.isInteger(dependencies[key]))) return false;
  const entries = Object.values(report.vulnerabilities);
  if (counts.total !== entries.length) return false;
  if (!severities.every((severity) => counts[severity] === entries.filter((e) => e?.severity === severity).length)) {
    return false;
  }
  return entries.every(
    (entry) =>
      isObject(entry) &&
      typeof entry.name === 'string' &&
      severities.includes(entry.severity) &&
      Array.isArray(entry.via) &&
      Array.isArray(entry.nodes) &&
      entry.nodes.length > 0 &&
      entry.nodes.every((location) => location !== '' && isObject(lock.packages[location])),
  );
}

/**
 * Shared interpretation: a report counts only when the process completed, its
 * output has the supported shape, and a nonzero exit is explained by findings.
 */
function interpret(result, { isReport, incomplete = () => false, problems, problemStatus }) {
  const evidence = { exitStatus: result.status, signal: result.signal, stderr: result.stderr };
  const failure = processFailure(result);
  if (failure) return { status: failure, ...evidence, stdout: result.stdout };
  const parsed = parse(result.stdout);
  if (parsed.error !== undefined) return { status: 'malformed-report', ...evidence, stdout: result.stdout };
  const npmStatus = npmFailure(parsed.value);
  if (npmStatus) return { status: npmStatus, ...evidence, report: parsed.value };
  if (!isReport(parsed.value)) return { status: 'malformed-report', ...evidence, report: parsed.value };
  if (incomplete(parsed.value)) return { status: 'incomplete-coverage', ...evidence, report: parsed.value };
  // With --audit-level=info, npm exits 1 exactly when it reports a finding.
  const found = problems(parsed.value);
  if (result.status !== (found ? 1 : 0)) return { status: 'tool-failure', ...evidence, report: parsed.value };
  return { status: found ? problemStatus : 'passed', ...evidence, report: parsed.value };
}

function interpretAudit(result, lock) {
  const outcome = interpret(result, {
    isReport: (report) => isAuditReport(report, lock),
    // metadata.dependencies.total counts the audited tree without its root.
    incomplete: (report) => report.metadata.dependencies.total !== Object.keys(lock.packages).length - 1,
    problems: (report) => Object.keys(report.vulnerabilities).length > 0,
    problemStatus: 'vulnerable',
  });
  if (!outcome.report || !['passed', 'vulnerable'].includes(outcome.status)) return outcome;
  const exposure = dependencyExposure(lock);
  const findings = Object.values(outcome.report.vulnerabilities).map((entry) => ({
    name: entry.name,
    severity: entry.severity,
    advisories: entry.via,
    exposure: ['runtime', 'development'].filter((kind) =>
      entry.nodes.some((location) => exposure.get(location)?.has(kind)),
    ),
    packages: entry.nodes.map((location) => ({
      location,
      version: lock.packages[location]?.version,
      exposure: ['runtime', 'development'].filter((kind) => exposure.get(location)?.has(kind)),
    })),
  }));
  return { ...outcome, findings };
}

/** verify-signatures.js items name the package, version, installed location and registry. */
const isPackageItem = (item) =>
  isObject(item) && ['name', 'version', 'location', 'registry'].every((key) => typeof item[key] === 'string');

/** A verified entry exists only for an attestation npm checked, with its bundles. */
const isVerifiedItem = (item) =>
  isPackageItem(item) && isObject(item.attestations) && Array.isArray(item.attestationBundles);

const isSignatureReport = (report) =>
  isObject(report) &&
  ['invalid', 'missing', 'verified'].every((key) => Array.isArray(report[key])) &&
  report.invalid.every(isPackageItem) &&
  report.missing.every(isPackageItem) &&
  report.verified.every(isVerifiedItem);

function interpretSignatures(result) {
  return interpret(result, {
    isReport: isSignatureReport,
    problems: (report) => report.invalid.length > 0 || report.missing.length > 0,
    problemStatus: 'signature-problems',
  });
}

/**
 * Compare every committed lock entry with the installed package and npm's hidden
 * lockfile. `npm audit signatures` verifies only what is installed and silently
 * skips missing non-production packages, so a gap here means its clean report
 * does not cover the committed graph.
 */
async function installedCoverage(cwd, lock) {
  const gaps = [];
  const hidden = parse(await readFile(join(cwd, 'node_modules/.package-lock.json'), 'utf8').catch(() => '')).value;
  if (!isObject(hidden?.packages)) gaps.push({ location: 'node_modules/.package-lock.json', reason: 'missing' });
  for (const [location, entry] of Object.entries(lock.packages)) {
    if (location === '') continue;
    let source;
    try {
      source = new URL(entry.resolved);
    } catch {
      // Missing, relative and non-URL resolutions are not public-registry proof.
    }
    if (!source || `${source.origin}/` !== publicRegistry || source.username || source.password) {
      gaps.push({ location, reason: 'source is outside the supported public registry', resolved: entry.resolved });
      continue;
    }
    const manifest = parse(await readFile(join(cwd, location, 'package.json'), 'utf8').catch(() => '')).value;
    if (!isObject(manifest)) gaps.push({ location, reason: 'not installed' });
    else if (manifest.version !== entry.version) {
      gaps.push({ location, reason: 'installed version differs', locked: entry.version, installed: manifest.version });
    } else if (isObject(hidden?.packages)) {
      const record = hidden.packages[location];
      if (!['version', 'resolved', 'integrity'].every((key) => record?.[key] === entry[key])) {
        gaps.push({ location, reason: 'installed lock record differs' });
      }
    }
  }
  return { complete: gaps.length === 0, lockedPackages: Object.keys(lock.packages).length - 1, gaps };
}

/**
 * Review one graph's committed lockfile and installed packages with native npm.
 * @param {{cwd: string, run: (command: string, args: string[], options: {cwd: string}) =>
 *   Promise<{status: number | null, signal: string | null, stdout: string, stderr: string}>}} options
 */
export async function reviewSecurity({ cwd, run = runProcess }) {
  let lockfile = null;
  let readError;
  try {
    lockfile = await readFile(join(cwd, 'package-lock.json'));
  } catch (error) {
    readError = error;
  }
  const lockfileHash = lockfile && `sha256:${createHash('sha256').update(lockfile).digest('hex')}`;
  const scannedAt = new Date().toISOString();
  const input = lockProblem(lockfile, readError);
  const npmVersion = await identity(run, ['--version'], cwd, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
  const scope = scopeArgs(input.lock ?? { packages: {} });
  const registry = await identity(run, ['config', 'get', 'registry', ...scope], cwd, /^https?:\/\/\S+$/);
  if (registry.value !== null && registry.value !== publicRegistry) {
    registry.failure = { reason: `registry is not the supported ${publicRegistry}`, observed: registry.value };
  }
  const scanIdentity = {
    scannedAt,
    lockfileHash,
    nodeVersion: process.version,
    npmVersion: npmVersion.value,
    registry: registry.value,
  };
  const identityFailures = Object.fromEntries(
    Object.entries({ npmVersion, registry }).flatMap(([key, { failure }]) => (failure ? [[key, failure]] : [])),
  );
  if (!input.lock) {
    const refused = { status: 'input-failure', input: { file: 'package-lock.json', ...input } };
    return { ok: false, ...scanIdentity, identityFailures, vulnerabilities: refused, signatures: refused };
  }
  const { lock } = input;
  const vulnerabilities = interpretAudit(
    await attempt(run, ['audit', '--json', '--package-lock-only', '--audit-level=info', ...scope], cwd),
    lock,
  );
  const scan = interpretSignatures(
    await attempt(run, ['audit', 'signatures', '--json', '--include-attestations', ...scope], cwd),
  );
  const coverage = await installedCoverage(cwd, lock);
  const signatures = {
    ...scan,
    status: scan.status === 'passed' && !coverage.complete ? 'incomplete-coverage' : scan.status,
    coverage,
  };
  return {
    ok:
      vulnerabilities.status === 'passed' &&
      signatures.status === 'passed' &&
      Object.keys(identityFailures).length === 0,
    ...scanIdentity,
    identityFailures,
    vulnerabilities,
    signatures,
  };
}
