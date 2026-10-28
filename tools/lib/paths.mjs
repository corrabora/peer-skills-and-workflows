// Locations used by the workflow tools. The mapping functions take their
// platform (and, for per-user locations, environment and home directory) as
// inputs, so the rules for other hosts can be checked without running there.
// hostContext(), canonical() and canonicalLocation() read the real host.

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function hostContext() {
  return { platform: process.platform, env: process.env, home: os.homedir() };
}

/** The path module whose semantics match `platform`. */
export function pathFor(platform) {
  return platform === 'win32' ? path.win32 : path.posix;
}

/** Personal skill directories each engine discovers. */
export function skillScopes({ platform, env, home }) {
  const p = pathFor(platform);
  requireHome(home, p);
  const claudeConfig = env.CLAUDE_CONFIG_DIR && p.isAbsolute(env.CLAUDE_CONFIG_DIR)
    ? env.CLAUDE_CONFIG_DIR
    : p.join(home, '.claude');
  return [
    { engine: 'codex', dir: p.join(home, '.agents', 'skills') },
    { engine: 'claude', dir: p.join(claudeConfig, 'skills') },
  ];
}

/** User hook settings, available to sessions in every repository. */
export function supportHookScopes(host) {
  const { platform, env, home } = host;
  const p = pathFor(platform);
  requireHome(home, p);
  if (env.CODEX_HOME && !p.isAbsolute(env.CODEX_HOME)) {
    throw new Error('CODEX_HOME must be absolute to install user hooks independently of the working directory');
  }
  const claude = skillScopes(host).find((scope) => scope.engine === 'claude');
  return [
    { engine: 'codex', file: p.join(env.CODEX_HOME || p.join(home, '.codex'), 'hooks.json') },
    { engine: 'claude', file: p.join(p.dirname(claude.dir), 'settings.json') },
  ];
}

function requireHome(home, p) {
  if (!home || !p.isAbsolute(home)) {
    throw new Error('the user home directory is unknown; cannot locate per-user directories');
  }
}

/** A checkout's local directory name, which the repository ignores. */
export const LOCAL_DIRECTORY = '.peer-skills-and-workflows';

/**
 * The per-user, machine-local base for workflow files kept off every checkout:
 * - macOS: ~/Library/Application Support/PeerSkillsAndWorkflows
 * - Windows: %LOCALAPPDATA%\PeerSkillsAndWorkflows
 * - Linux and others: $XDG_STATE_HOME/peer-skills-and-workflows, else
 *   ~/.local/state/peer-skills-and-workflows
 * A missing required root is an error; the base is never guessed from a user
 * name or placed in the current directory.
 */
export function machineBase({ platform, env, home }) {
  const p = pathFor(platform);
  if (platform === 'win32') {
    const local = env.LOCALAPPDATA;
    if (!local || !p.isAbsolute(local)) {
      throw new Error('LOCALAPPDATA is not set to an absolute path; cannot locate the machine-local workflow directory');
    }
    return p.join(local, 'PeerSkillsAndWorkflows');
  }
  requireHome(home, p);
  if (platform === 'darwin') return p.join(home, 'Library', 'Application Support', 'PeerSkillsAndWorkflows');
  const xdg = env.XDG_STATE_HOME;
  // The XDG specification says relative values are invalid and must be ignored.
  return p.join(xdg && p.isAbsolute(xdg) ? xdg : p.join(home, '.local', 'state'), 'peer-skills-and-workflows');
}

/**
 * A checkout's key on this machine: its folder name plus the first 16 hex
 * digits of the SHA-256 of its canonical path, so same-named checkouts stay
 * apart. Pass the canonical checkout so every alias of it gets the same key.
 */
export function repositoryKey(checkout, platform = process.platform) {
  const name = pathFor(platform).basename(checkout).normalize('NFC').replace(/[^\p{L}\p{N}._-]+/gu, '-') || 'repository';
  const digest = crypto.createHash('sha256').update(checkout, 'utf8').digest('hex').slice(0, 16);
  return `${name}-${digest}`;
}

/**
 * A checkout's local workflow directory, which the repository ignores: local
 * configuration at its top and run records under `runs/`. Pass the canonical
 * checkout so every alias of it names the same directory.
 */
export function localDirectory(checkout, platform = process.platform) {
  return pathFor(platform).join(checkout, LOCAL_DIRECTORY);
}

const RUN_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/**
 * Absolute run root for one Orca run, inside the checkout's local workflow
 * directory. The run id must be a single plain name, so the root can never
 * leave `runs/`. Computes the path only; creates nothing.
 */
export function runRoot(checkout, runId, platform = process.platform) {
  checkRunId(runId);
  return pathFor(platform).join(localDirectory(checkout, platform), 'runs', runId);
}

/**
 * Absolute scratch root for one run of one checkout, kept off the checkout:
 * `<machine base>/scratch/repositories/<repository key>/runs/<run id>`.
 * Scratch has its own namespace under the base, apart from anything else kept
 * there. Pass the canonical checkout. Computes the path only; creates nothing.
 */
export function scratchRoot(host, checkout, runId) {
  checkRunId(runId);
  return pathFor(host.platform).join(machineBase(host), 'scratch', 'repositories',
    repositoryKey(checkout, host.platform), 'runs', runId);
}

export function checkRunId(runId, label = 'run id') {
  if (typeof runId !== 'string' || !RUN_ID.test(runId) || runId.includes('..')) {
    throw new Error(`${label} '${runId}' must start with a letter or digit, contain only letters, digits, '.', '_' `
      + "or '-', and not contain '..'");
  }
}

/** True when `candidate` is `root` or lies inside it (both already canonical). */
export function isWithin(root, candidate, platform = process.platform) {
  const p = pathFor(platform);
  const relative = p.relative(root, candidate);
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${p.sep}`) && !p.isAbsolute(relative));
}

/**
 * Canonical path with symlinks and junctions resolved, or null if it does not
 * exist. Any other failure, such as a link loop or denied access, throws an
 * error naming the path and carrying the system error code.
 */
export function canonical(target) {
  try {
    return fs.realpathSync.native(target);
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return null;
    throw Object.assign(new Error(`cannot resolve ${target} (${error.code ?? error.message})`), { code: error.code });
  }
}

/**
 * Canonical form of a path that need not exist yet: its deepest existing
 * ancestor with links resolved, followed by the remaining names. Failures
 * other than absence throw as canonical() does.
 */
export function canonicalLocation(target) {
  const rest = [];
  let current = path.resolve(target);
  for (;;) {
    const real = canonical(current);
    if (real !== null) return path.join(real, ...rest.reverse());
    const parent = path.dirname(current);
    if (parent === current) return path.join(current, ...rest.reverse());
    rest.push(path.basename(current));
    current = parent;
  }
}
