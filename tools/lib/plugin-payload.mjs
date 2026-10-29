// Generation of the self-contained plugin payload that both marketplace
// catalogs install. Codex fingerprints every file of an installed plugin for
// hook trust, so the payload is a copy of the runtime package without the
// authoring checkout's Git metadata, tests or authoring-only tools.
import fs from 'node:fs';
import path from 'node:path';

/** Payload directory, relative to the authoring checkout; both catalogs select it. */
export const PAYLOAD_DIRECTORY = 'plugins/peer';

/** Authoring paths copied into the payload, with their relative layout preserved. */
export const PAYLOAD_PARTS = [
  'LICENSE', 'README.md', 'package.json', 'defaults.yaml',
  '.claude-plugin/plugin.json', '.codex-plugin/plugin.json', 'hooks',
  'skills', 'workflow', 'tools',
  'docs/installation.md', 'docs/writing-guidance.md', 'docs/guidance/adr-format.md',
  'docs/guidance/glossary-format.md', 'docs/guidance/record-format-adoption.md',
];

/**
 * Paths under `PAYLOAD_PARTS` left out: tests, which `node --test` would
 * discover twice, and authoring-only tools, including this generator, which
 * must not copy itself into its own output.
 */
export const PAYLOAD_EXCLUSIONS = [
  'tools/test', 'tools/test-support', 'tools/verify.mjs', 'tools/commit-verify.mjs',
  'tools/install-hooks.mjs', 'tools/generate-plugin.mjs', 'tools/lib/plugin-package.mjs',
  'tools/lib/plugin-payload.mjs',
];

const byCodeUnit = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Throw unless each component of the POSIX path `relative` below `root` is a
 * real directory, so that no link redirects a read or write out of the
 * checkout. With `allowMissing`, an absent component ends the check.
 */
function requireRealDirectories(root, relative, { allowMissing = false } = {}) {
  let current = root;
  for (const name of relative.split('/')) {
    current = path.join(current, name);
    let stat;
    try {
      stat = fs.lstatSync(current);
    } catch (error) {
      if (allowMissing && error.code === 'ENOENT') return;
      throw error;
    }
    if (!stat.isDirectory()) throw new Error(`${path.relative(root, current)} is a link or not a directory; the plugin payload neither follows nor replaces links`);
  }
}

/**
 * Throw unless the payload directory and its ancestors are absent or real
 * directories and every existing payload entry is a regular file or directory.
 */
function requireUnlinkedOutput(sourceRoot) {
  requireRealDirectories(sourceRoot, PAYLOAD_DIRECTORY, { allowMissing: true });
  const target = path.join(sourceRoot, ...PAYLOAD_DIRECTORY.split('/'));
  if (!fs.existsSync(target)) return;
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (!entry.isFile()) throw new Error(`${path.relative(sourceRoot, full)} is not a regular file or directory; the plugin payload neither follows nor replaces links`);
    }
  };
  visit(target);
}

/**
 * The payload's files as sorted POSIX paths relative to both roots. Every
 * selected entry must be a regular file or directory; anything else throws
 * before the caller writes.
 */
export function payloadFiles(sourceRoot) {
  const files = [];
  const visit = (relative) => {
    if (PAYLOAD_EXCLUSIONS.includes(relative)) return;
    const full = path.join(sourceRoot, ...relative.split('/'));
    const stat = fs.lstatSync(full);
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(full).sort(byCodeUnit)) visit(`${relative}/${name}`);
    } else if (stat.isFile()) {
      files.push(relative);
    } else {
      throw new Error(`${relative} is not a regular file or directory; the plugin payload copies neither links nor special files`);
    }
  };
  for (const part of PAYLOAD_PARTS) {
    const parent = path.posix.dirname(part);
    if (parent !== '.') requireRealDirectories(sourceRoot, parent);
    visit(part);
  }
  return files.sort(byCodeUnit);
}

/**
 * Replace the payload directory with a fresh copy of the selected files.
 * Links among the selected sources or the existing output throw before any write.
 */
export function generatePluginPayload(sourceRoot) {
  const files = payloadFiles(sourceRoot);
  requireUnlinkedOutput(sourceRoot);
  const target = path.join(sourceRoot, ...PAYLOAD_DIRECTORY.split('/'));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const staging = fs.mkdtempSync(path.join(path.dirname(target), '.peer-'));
  try {
    for (const relative of files) {
      const destination = path.join(staging, ...relative.split('/'));
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(path.join(sourceRoot, ...relative.split('/')), destination);
    }
    fs.rmSync(target, { recursive: true, force: true });
    fs.renameSync(staging, target);
  } catch (error) {
    fs.rmSync(staging, { recursive: true, force: true });
    throw error;
  }
  return files;
}

/** Read-only byte, membership and executable-mode parity with the authoring sources. */
export function checkPluginPayload({ sourceRoot, out }) {
  try {
    const expected = payloadFiles(sourceRoot);
    requireUnlinkedOutput(sourceRoot);
    const target = path.join(sourceRoot, ...PAYLOAD_DIRECTORY.split('/'));
    const directories = new Set(['']);
    for (const file of expected) {
      let parent = path.posix.dirname(file);
      while (parent !== '.') {
        directories.add(parent);
        parent = path.posix.dirname(parent);
      }
    }
    const actual = [];
    const visit = (relative) => {
      const full = path.join(target, relative);
      const stat = fs.lstatSync(full);
      if (stat.isDirectory()) {
        if (!directories.has(relative)) throw new Error(`unexpected directory ${relative}`);
        for (const name of fs.readdirSync(full).sort(byCodeUnit)) visit(relative ? `${relative}/${name}` : name);
      } else if (stat.isFile()) actual.push(relative);
      else throw new Error(`non-regular entry ${relative}`);
    };
    visit('');
    const actualSet = new Set(actual);
    const expectedSet = new Set(expected);
    for (const file of actual) if (!expectedSet.has(file)) throw new Error(`unexpected file ${file}`);
    for (const file of expected) {
      if (!actualSet.has(file)) throw new Error(`missing file ${file}`);
      const original = path.join(sourceRoot, file);
      const copy = path.join(target, file);
      if (!fs.readFileSync(original).equals(fs.readFileSync(copy))) throw new Error(`content differs: ${file}`);
      if ((fs.statSync(original).mode & 0o111) !== (fs.statSync(copy).mode & 0o111)) {
        throw new Error(`executable mode differs: ${file}`);
      }
    }
    out.info(`ok      ${PAYLOAD_DIRECTORY} matches its authoring sources (${expected.length} files)`);
    return true;
  } catch (error) {
    out.error(`FAIL    ${PAYLOAD_DIRECTORY}: ${error.message}; run node tools/generate-plugin.mjs`);
    return false;
  }
}
