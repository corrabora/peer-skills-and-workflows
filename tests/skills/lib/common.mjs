// Small helpers shared by the skill-suite runner: hashing, JSON files, directory
// walks and the environment handed to subprocesses.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonical } from '../../../tools/lib/paths.mjs';

/** Canonical root of this checkout, found from tests/skills/lib. */
export const packageRoot = canonical(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..'));
/** The tests/skills directory itself. */
export const skillsTestRoot = path.join(packageRoot, 'tests', 'skills');

export function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

/** Relative POSIX paths of every file below `root`, sorted, skipping `skip` top-level names. */
export function walkFiles(root, { skip = [] } = {}) {
  const files = [];
  const visit = (dir, rel) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const relative = rel ? `${rel}/${entry.name}` : entry.name;
      if (!rel && skip.includes(entry.name)) continue;
      if (entry.isDirectory() && !entry.isSymbolicLink()) visit(path.join(dir, entry.name), relative);
      else files.push(relative);
    }
  };
  visit(root, '');
  return files.sort();
}

/** `{ relativePath: { sha256, bytes } }` for every file below `root`. */
export function manifestOf(root, options) {
  const manifest = {};
  for (const relative of walkFiles(root, options)) {
    const target = path.join(root, ...relative.split('/'));
    const stat = fs.lstatSync(target);
    if (stat.isSymbolicLink()) {
      manifest[relative] = { link: fs.readlinkSync(target) };
      continue;
    }
    const content = fs.readFileSync(target);
    manifest[relative] = { sha256: sha256(content), bytes: content.length };
  }
  return manifest;
}

/** One digest over a manifest: path, hash and size of every entry in order. */
export function digestOfManifest(manifest) {
  const hash = crypto.createHash('sha256');
  for (const relative of Object.keys(manifest).sort()) {
    const entry = manifest[relative];
    hash.update(`${relative}\0${entry.sha256 ?? `link:${entry.link}`}\0${entry.bytes ?? ''}\n`);
  }
  return hash.digest('hex');
}

/**
 * The environment for a subprocess run in `tmp`'s attempt: the caller's
 * environment without Git's checkout-specific variables (hooks export them and
 * they would point an engine's own Git at this checkout), with the temporary
 * directory variables pointed into the attempt.
 */
export function subprocessEnvironment(tmp, base = process.env) {
  const env = {};
  for (const [key, value] of Object.entries(base)) {
    if (key.startsWith('GIT_')) continue;
    env[key] = value;
  }
  env.TMPDIR = tmp;
  env.TMP = tmp;
  env.TEMP = tmp;
  return env;
}

/** Three-digit zero-padded ordinal, as the run records use. */
export function ordinal(n) {
  return String(n).padStart(3, '0');
}

export function isoNow(now = Date.now) {
  return new Date(now()).toISOString();
}
