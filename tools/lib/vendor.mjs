// The runtime dependency payload under tools/vendor: its offline check and its
// regeneration from the vendor lockfile. tools/vendor/package-lock.json owns the
// pinned versions and their npm provenance; manifest.json records the SHA-256 of
// both inputs and every installed file, so the offline gate detects drift
// without npm.

import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { canonical, canonicalLocation, isWithin } from './paths.mjs';

export const VENDOR = path.join('tools', 'vendor');
const INPUTS = ['package.json', 'package-lock.json'];
const MANIFEST_FORMAT = 'peer-skills-and-workflows/vendor-manifest';
const MANIFEST_VERSION = 1;
export const REGENERATE_VENDOR = "'node tools/generate-vendor.mjs'";
const NPM_ARGS = ['ci', '--ignore-scripts', '--no-bin-links', '--no-audit', '--no-fund'];

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha256 = (file) => `sha256:${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}`;

/** Every entry under `dir` as sorted '/'-separated relative paths; links are refused. */
function payloadFiles(dir, relative = '') {
  const files = [];
  for (const entry of fs.readdirSync(path.join(dir, relative), { withFileTypes: true })) {
    const name = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...payloadFiles(dir, name));
    else if (entry.isFile()) files.push(name);
    else throw new Error(`${path.join(dir, name)} is not a regular file or directory`);
  }
  return files.sort();
}

/** Lockfile-style keys (`node_modules/a`, `node_modules/@s/b/node_modules/c`) of installed packages. */
function installedPackages(dir, prefix = 'node_modules') {
  const keys = [];
  if (!fs.existsSync(dir)) return keys;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const names = entry.name.startsWith('@')
      ? fs.readdirSync(path.join(dir, entry.name), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => `${entry.name}/${e.name}`)
      : [entry.name];
    for (const name of names) {
      keys.push(`${prefix}/${name}`);
      keys.push(...installedPackages(path.join(dir, ...name.split('/'), 'node_modules'), `${prefix}/${name}/node_modules`));
    }
  }
  return keys.sort();
}

/** The manifest for a vendor directory's inputs and an installed node_modules tree. */
export function vendorManifest(vendor, nodeModules = path.join(vendor, 'node_modules')) {
  const inputs = Object.fromEntries(INPUTS.map((file) => [file, sha256(path.join(vendor, file))]));
  const files = {};
  for (const file of payloadFiles(nodeModules)) files[file] = sha256(path.join(nodeModules, ...file.split('/')));
  return { format: MANIFEST_FORMAT, version: MANIFEST_VERSION, inputs, files };
}

/** Differences between two path → hash maps, as diagnostic lines. */
function differences(expected = {}, actual = {}) {
  const problems = [];
  for (const [file, hash] of Object.entries(expected)) {
    if (!Object.hasOwn(actual, file)) problems.push(`missing ${file}`);
    else if (actual[file] !== hash) problems.push(`changed ${file}`);
  }
  for (const file of Object.keys(actual)) if (!Object.hasOwn(expected, file)) problems.push(`unexpected ${file}`);
  return problems;
}

/** Problems with the payload under `vendor` (a tools/vendor directory). */
function vendorProblems(sourceRoot, vendor) {
  const problems = [];
  const nodeModules = path.join(vendor, 'node_modules');
  if (readJson(path.join(sourceRoot, 'package.json')).dependencies !== undefined) {
    problems.push('package.json declares dependencies; runtime dependencies belong in tools/vendor/package.json');
  }
  const declared = readJson(path.join(vendor, 'package.json')).dependencies ?? {};
  const lock = readJson(path.join(vendor, 'package-lock.json'));
  const lockedRoot = lock.packages?.['']?.dependencies ?? {};
  if (JSON.stringify(Object.entries(declared).sort()) !== JSON.stringify(Object.entries(lockedRoot).sort())) {
    problems.push('tools/vendor/package-lock.json does not lock the dependencies tools/vendor/package.json declares');
  }
  const locked = Object.entries(lock.packages ?? {}).filter(([key]) => key.startsWith('node_modules/'));
  const lockedKeys = locked.map(([key]) => key).sort();
  const installedKeys = installedPackages(nodeModules);
  for (const key of installedKeys) if (!lockedKeys.includes(key)) problems.push(`tools/vendor/${key} is installed but not locked`);
  for (const [key, entry] of locked) {
    const name = key.slice(key.lastIndexOf('node_modules/') + 'node_modules/'.length);
    const where = `tools/vendor/${key}`;
    if (!/^https:\/\//.test(entry.resolved ?? '') || !/^sha512-/.test(entry.integrity ?? '')) {
      problems.push(`${key}: the lockfile lacks its npm source or sha512 integrity`);
    }
    if (!installedKeys.includes(key)) { problems.push(`${where} is missing`); continue; }
    const installed = readJson(path.join(vendor, ...key.split('/'), 'package.json'));
    if (installed.name !== name || installed.version !== entry.version) {
      problems.push(`${where} is ${installed.name}@${installed.version}, but the lockfile pins ${name}@${entry.version}`);
    }
    if (!fs.readdirSync(path.join(vendor, ...key.split('/'))).some((file) => /^licen[cs]e/i.test(file))) {
      problems.push(`${where} has no license file`);
    }
  }
  const recorded = readJson(path.join(vendor, 'manifest.json'));
  if (recorded.format !== MANIFEST_FORMAT || recorded.version !== MANIFEST_VERSION) {
    problems.push(`tools/vendor/manifest.json is not a ${MANIFEST_FORMAT} version ${MANIFEST_VERSION} manifest`);
  } else {
    const current = vendorManifest(vendor);
    problems.push(...differences(recorded.inputs, current.inputs).map((p) => `${p} (tools/vendor inputs)`));
    problems.push(...differences(recorded.files, current.files).map((p) => `${p} (tools/vendor/node_modules)`));
  }
  return problems;
}

/**
 * Offline check of the vendored payload against its lockfile and manifest.
 * Reports each problem through `out.error` and returns whether all passed.
 */
export function checkVendor({ sourceRoot, out }) {
  let problems;
  try {
    problems = vendorProblems(sourceRoot, path.join(sourceRoot, VENDOR));
  } catch (error) {
    problems = [error.message];
  }
  for (const problem of problems) out.error(`FAIL    ${problem}; run ${REGENERATE_VENDOR} from the source checkout`);
  if (!problems.length) out.info('ok      vendored dependencies match their lockfile and manifest');
  return !problems.length;
}

/**
 * The canonical tools/vendor directory, after refusing locations where npm's
 * writes could reach the inputs: a linked vendor directory or ancestor, or a
 * cache overlapping the package.
 */
function safeVendor(sourceRoot, cache) {
  const root = canonical(sourceRoot);
  if (root === null) throw new Error(`${sourceRoot} does not exist`);
  const vendor = path.join(root, VENDOR);
  if (canonical(vendor) !== vendor) throw new Error(`${vendor} is a link or lies beneath one; regenerate in a plain checkout`);
  if (cache !== undefined) {
    const location = canonicalLocation(cache);
    if (isWithin(root, location) || isWithin(location, root)) throw new Error(`npm cache ${cache} overlaps the package; choose a cache outside it`);
  }
  return vendor;
}

/**
 * Install the locked dependencies into a fresh staging directory outside the
 * package, with an isolated npm cache, and run `use` on the result. npm's hidden
 * lockfile is removed so the payload holds only package content. The staging
 * directory is removed afterwards, whether or not installation succeeded.
 */
function withStaged(root, vendor, cache, use) {
  const staging = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'peer-vendor-stage-')));
  try {
    if (isWithin(root, staging)) throw new Error(`staging directory ${staging} lies inside the package; set TMPDIR elsewhere`);
    for (const file of INPUTS) fs.copyFileSync(path.join(vendor, file), path.join(staging, file));
    const npm = spawnSync('npm', NPM_ARGS, {
      cwd: staging, encoding: 'utf8', env: { ...process.env, npm_config_cache: cache ?? path.join(staging, '.npm-cache') },
    });
    if (npm.status !== 0) throw new Error(`npm ${NPM_ARGS.join(' ')} failed (${npm.status ?? npm.error?.code}): ${(npm.stderr ?? '').trim()}`);
    const staged = path.join(staging, 'node_modules');
    fs.rmSync(path.join(staged, '.package-lock.json'), { force: true });
    return use(staged, staging);
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
}

/** Replace `file` by renaming a sibling, so a link at `file` is replaced, not written through. */
function publish(file, text) {
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, text, { flag: 'wx' });
  fs.renameSync(temporary, file);
}

/**
 * Regenerate tools/vendor/node_modules and manifest.json from the lockfile, or
 * with `check` verify the current payload offline and compare a fresh
 * regeneration with it, changing nothing. `cache` names a populated npm cache
 * outside the package to use instead of a new one. Returns whether the payload
 * is (now) current.
 */
export function generateVendor({ sourceRoot, out, check = false, cache }) {
  const vendor = safeVendor(sourceRoot, cache);
  const root = path.dirname(path.dirname(vendor));
  if (check) {
    const currentOk = checkVendor({ sourceRoot: root, out });
    const regeneratedOk = withStaged(root, vendor, cache, (staged) => {
      const recorded = readJson(path.join(vendor, 'manifest.json'));
      const problems = differences(recorded.files, vendorManifest(vendor, staged).files);
      for (const problem of problems) out.error(`FAIL    regeneration: ${problem}`);
      if (!problems.length) out.info(`ok      regeneration reproduces the manifest (${Object.keys(recorded.files).length} files)`);
      return !problems.length;
    });
    return currentOk && regeneratedOk;
  }
  return withStaged(root, vendor, cache, (staged) => {
    const manifest = vendorManifest(vendor, staged);
    const target = path.join(vendor, 'node_modules');
    // Copy beside the target first, so a failed copy leaves the old payload in place.
    const incoming = `${target}.incoming`;
    fs.rmSync(incoming, { recursive: true, force: true });
    fs.cpSync(staged, incoming, { recursive: true });
    fs.rmSync(target, { recursive: true, force: true });
    fs.renameSync(incoming, target);
    publish(path.join(vendor, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    out.info(`generated tools/vendor/node_modules and manifest.json (${Object.keys(manifest.files).length} files)`);
    return true;
  });
}
