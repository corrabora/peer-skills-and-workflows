// Deterministic facts for binding the workflow to one checkout: Git identity
// of the checkout and of the workflow source, local storage under the ignored
// `.peer-skills-and-workflows/` directory, candidate guidance sources, the installed
// quality-profile selection and content identities that detect changed or
// missing sources, uncommitted edits included. Judgment about what the facts
// mean stays with the bind-agent-workflow skill (workflow/BINDING.md).
//
// Every Git call is argument-based through tools/lib/git.mjs. Source, member
// and lookup paths inside a checkout are reported relative to it with `/`
// separators, as Git prints them. Diagnostic locations, such as the occupied
// local directory, a canonical quality location or an enumeration failure's
// path, are absolute host paths.
// Every ordering here is by UTF-16 code unit, never by locale, so an identity
// computed on one host compares with one computed on another.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { git, gitPaths } from './git.mjs';
import { canonical, canonicalLocation, isWithin, LOCAL_DIRECTORY, pathFor } from './paths.mjs';

// Resolve only the direct dependency under this guard. Errors while loading
// an installed package (including missing transitive dependencies) propagate.
const require = createRequire(import.meta.url);
const SOURCE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
// An explicit package directory prevents Node from falling back to ancestor dependencies.
const AJV_PACKAGE = path.join(SOURCE_ROOT, 'tools', 'vendor', 'node_modules', 'ajv');
let ajvPath;
try {
  ajvPath = require.resolve(AJV_PACKAGE);
} catch (error) {
  if (error.code !== 'MODULE_NOT_FOUND' || !error.message.startsWith(`Cannot find module '${AJV_PACKAGE}'`)) throw error;
  throw Object.assign(new Error(`the 'ajv' runtime dependency is missing from ${path.join(SOURCE_ROOT, 'tools', 'vendor')}; reinstall the package or regenerate its vendored dependencies from the source checkout`), { name: 'MissingDependencyError' });
}
const Ajv = require(ajvPath);

export { LOCAL_DIRECTORY };
export const EXCLUDE_RULE = `/${LOCAL_DIRECTORY}/`;
export const BINDING_FILE = 'binding.md';
export const SOURCES_FILE = 'binding-sources.json';

/**
 * Format marker and version of the persisted source manifest
 * (`binding-sources.json`). A reader accepts exactly this format at this
 * version, ignores additional top-level or entry fields (additive evolution),
 * and reports any other format or version as unusable instead of comparing it
 * (workflow/BINDING.md, The binding file).
 */
export const MANIFEST_FORMAT = 'agent-workflow/binding-sources';
export const MANIFEST_VERSION = 1;

/**
 * Files under the workflow source whose content identifies the loaded
 * instructions: the package parts, shared writing guide and three required
 * record format/adoption references, not the rest of `docs/`.
 */
const SOURCE_PARTS = [
  'workflow', 'skills', 'tools', 'defaults.yaml', 'README.md', 'package.json',
  'hooks', '.codex-plugin/plugin.json', '.claude-plugin/plugin.json',
  '.agents/plugins/marketplace.json', '.claude-plugin/marketplace.json',
  'docs/writing-guidance.md', 'docs/guidance/adr-format.md',
  'docs/guidance/glossary-format.md', 'docs/guidance/record-format-adoption.md',
];

/**
 * Representative local paths probed to report partial ignore effects when the
 * directory itself is not excluded: the binding, its manifest and a run record.
 */
const LOCAL_PROBES = [`${LOCAL_DIRECTORY}/binding.md`, `${LOCAL_DIRECTORY}/binding-sources.json`, `${LOCAL_DIRECTORY}/runs/run/report.md`];

// Candidate guidance sources, by category, matched against every tracked and
// untracked (not ignored) path of the checkout. The list is deliberately
// broad and bounded: it finds newly added guidance by name, and the skill
// decides what each file governs.
const CANDIDATES = [
  ['instructions', /^(?:.*\/)?(?:AGENTS|CLAUDE)\.md$/i],
  ['instructions', /^\.(?:claude|codex|agents)\/.+/],
  ['guidance', /^(?:README|CONTRIBUTING|CONTRIBUTORS|DEVELOPMENT|DEVELOPING|MAINTAINERS|SECURITY|SUPPORT)(?:\.[^/]+)?$/i],
  ['guidance', /^docs?\/.+\.(?:md|markdown|txt|rst)$/i],
  ['quality', /^\.quality\/config\.json$/],
  ['quality', /^\.quality\/profiles\/[^/]+\/_manifest\/profile\.json$/],
  ['quality', /^\.quality\/profiles\/[^/]+\/README\.md$/],
  ['verification', /^\.github\/.+/],
  ['verification', /^\.gitlab-ci\.yml$/],
  ['verification', /^(?:package\.json|Makefile|GNUmakefile|justfile|Justfile|Taskfile\.ya?ml|\.pre-commit-config\.yaml)$/],
  ['verification', /^\.githooks\/.+/],
];

/**
 * `git` in one checkout. Options pass through to `git()`: only with
 * `allowMissing` is an absent result (exit status 1 with nothing on stdout or
 * stderr) null; without it, that exit throws like any other failure.
 */
function gitIn(cwd) {
  return (args, options = {}) => git(args, { cwd, ...options });
}

/**
 * The fixed cause for a path name Git lists that is not valid UTF-8. Git keeps
 * a name's bytes as stored, but these tools represent paths as Unicode text,
 * and decoding such a name would substitute U+FFFD, possibly merging it with
 * another name. It is reported with its bytes escaped (escapedName) and is
 * never looked up (workflow/BINDING.md, Path names).
 */
const UNSUPPORTED_NAME = 'path name is not valid UTF-8; such names are not supported';

/**
 * NUL-terminated records from Git output bytes: `records` decoded as UTF-8
 * text, and `invalid` holding the bytes of each record that is not UTF-8,
 * undecoded. Literal U+FFFD in a name is valid text.
 */
function gitRecords(bytes) {
  const records = [];
  const invalid = [];
  for (let start = 0; start < bytes.length;) {
    const found = bytes.indexOf(0, start);
    const end = found === -1 ? bytes.length : found;
    const record = bytes.subarray(start, end);
    if (record.length) {
      try { records.push(strictUtf8.decode(record)); } catch { invalid.push(record); }
    }
    start = end + 1;
  }
  return { records, invalid };
}

/** Bytes as ASCII text: printable characters as themselves, `\` doubled and every other byte as `\xHH`. */
function escapedName(bytes) {
  return [...bytes].map((byte) => (byte === 0x5c ? '\\\\' : byte >= 0x20 && byte < 0x7f ? String.fromCharCode(byte) : `\\x${byte.toString(16).padStart(2, '0')}`)).join('');
}

/**
 * The reported member for an escaped Git name (escapedName) that the
 * repository at `owner` lists, relative to `root`, which is `owner` or
 * contains it: the owner's `/`-separated location under `root`, then the
 * escaped name. Only the owner, an actual location, goes through host path
 * functions. The escaped name stays opaque text, because Windows path
 * functions would read each `\` in it as a separator. Exported so tests can
 * check Windows path semantics on any host.
 */
export function escapedMember(root, owner, escaped, platform = process.platform) {
  const p = pathFor(platform);
  const prefix = p.relative(root, owner).split(p.sep).join('/');
  return prefix ? `${prefix}/${escaped}` : escaped;
}

/** Code-unit string order, independent of the process locale. */
function byCodeUnit(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Git facts for a checkout: canonical top, Git directory, common directory
 * (differs in a linked worktree), HEAD commit and branch (null when absent).
 * Only Git's own answer that no working tree contains the path is reported
 * as such; an unsupported Git or another Git failure keeps its own cause.
 */
export function checkoutFacts(checkout) {
  const top = canonical(checkout);
  if (top === null) throw new Error(`${checkout} does not exist`);
  const run = gitIn(top);
  let lines;
  try {
    lines = gitPaths(['--show-toplevel', '--git-dir', '--git-common-dir'], { cwd: top });
  } catch (error) {
    if (/^git rev-parse failed: fatal: (?:not a git repository|this operation must be run in a work tree)/.test(error.message)) {
      throw new Error(`${checkout} is not inside a Git working tree (${error.message})`);
    }
    throw error;
  }
  const toplevel = canonical(lines[0]);
  if (toplevel !== top) throw new Error(`${checkout} is not the top of its Git working tree (${toplevel})`);
  const gitDir = canonical(lines[1]) ?? lines[1];
  const commonDir = canonical(lines[2]) ?? lines[2];
  const head = run(['rev-parse', '-q', '--verify', 'HEAD'], { allowMissing: true })?.trim() ?? null;
  const branch = run(['symbolic-ref', '-q', '--short', 'HEAD'], { allowMissing: true })?.trim() ?? null;
  return { checkout: top, gitDir, commonDir, linkedWorktree: gitDir !== commonDir, head, branch };
}

/** Tracked paths under the local directory; adoption needs this empty. */
export function trackedLocalPaths(checkout) {
  return gitIn(checkout)(['ls-files', '-z', '--', LOCAL_DIRECTORY]).split('\0').filter(Boolean);
}

/** One `check-ignore -v` answer for a path: the matching rule, or null when none matches. */
function checkIgnore(checkout, probe) {
  const output = gitIn(checkout)(['check-ignore', '-v', '--', probe], { allowMissing: true });
  if (output === null) return null;
  const match = /^(.*?):(\d+):(.*?)\t/.exec(output);
  const pattern = match ? match[3] : output.trim();
  return {
    source: match ? match[1] : 'unknown',
    line: match ? Number(match[2]) : null,
    pattern,
    negated: pattern.startsWith('!'),
  };
}

/**
 * What occupies the local directory path, decided with `lstat` so a link is
 * never taken for the directory it points to: `directory`, `absent`, or an
 * occupant local storage cannot use: `file`, `link` (with its own target
 * text), `other` (a socket or device, for example) or `unreadable` (the entry
 * cannot be inspected; `error` carries the code). Only a plain directory is
 * local storage; linked local storage is not supported.
 */
export function localPathState(checkout) {
  const local = path.join(checkout, LOCAL_DIRECTORY);
  let stat;
  try {
    stat = fs.lstatSync(local);
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return { kind: 'absent' };
    return { kind: 'unreadable', error: error.code ?? error.message };
  }
  if (stat.isDirectory()) return { kind: 'directory' };
  if (stat.isSymbolicLink()) {
    let target = null;
    try {
      target = fs.readlinkSync(local, 'utf8');
    } catch { /* target unreadable; the kind alone names the conflict */ }
    return { kind: 'link', target };
  }
  return { kind: stat.isFile() ? 'file' : 'other' };
}

/** Binding children are plain files; links are occupied entries, never adoption targets. */
export function bindingFileState(file) {
  try {
    const stat = fs.lstatSync(file);
    if (stat.isSymbolicLink()) {
      try { return { kind: 'link', present: true, target: fs.readlinkSync(file, 'utf8') }; }
      catch (error) { return { kind: 'link', present: true, target: null, error: error.code ?? error.message }; }
    }
    return { kind: stat.isFile() ? 'file' : stat.isDirectory() ? 'directory' : 'other', present: true };
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return { kind: 'absent', present: false };
    return { kind: 'unavailable', present: null, error: error.code ?? error.message };
  }
}

/**
 * The occupied-path conflict for a local directory path that holds something
 * other than a plain directory: the path, what occupies it and the operator's
 * resolution. Nothing is unlinked, overwritten or repaired.
 */
function occupiedConflict(checkout, state) {
  const local = path.join(checkout, LOCAL_DIRECTORY);
  const what = state.kind === 'link' ? `a link to ${state.target ?? 'an unreadable target'}` : state.kind === 'unreadable' ? `an entry that cannot be inspected (${state.error})` : `a ${state.kind}`;
  return {
    path: local,
    kind: state.kind,
    ...(state.kind === 'link' ? { target: state.target } : {}),
    ...(state.kind === 'unreadable' ? { error: state.error } : {}),
    resolution: `${local} is ${what}, not a directory; move or remove it yourself (or restore access to it), then repeat. Nothing was written, unlinked or overwritten.`,
  };
}

/**
 * Whether Git excludes the local directory itself, decided with Git on the
 * directory: `ignored` is true only for a positive rule matching
 * `.peer-skills-and-workflows` as a directory, which excludes everything beneath it (a
 * negation inside an excluded directory cannot re-include anything). A rule
 * that matches only some children, such as `*.md`, `/.peer-skills-and-workflows/*` or a
 * file-specific rule, and a negation matching the directory are not coverage;
 * `match` names a covering rule, `negatedBy` a negation of the directory and
 * `children` the representative probes with the rule each one hits, so partial
 * effects are reported truthfully (`partial` is true when a child is ignored
 * while the directory is not). Git evaluates a directory rule only for a
 * directory that exists, so `directoryPresent: false` is reported with
 * `ignored: false`; `exclude` creates the empty directory before deciding,
 * `inspect` only reports. The path's kind is inspected before any probe: when
 * a file, link or other entry occupies it, `occupied` names the conflict with
 * `reason: 'path occupied'`, no probe runs (Git cannot look beyond a link)
 * and nothing is ignored.
 */
export function ignoreCoverage(checkout) {
  const state = localPathState(checkout);
  if (state.kind !== 'directory' && state.kind !== 'absent') {
    return { directoryPresent: false, ignored: false, reason: 'path occupied', occupied: occupiedConflict(checkout, state), match: null, negatedBy: null, partial: false, children: [] };
  }
  const directoryPresent = state.kind === 'directory';
  const children = LOCAL_PROBES.map((probe) => {
    const rule = checkIgnore(checkout, probe);
    return { path: probe, ignored: rule !== null && !rule.negated, ...(rule ? { source: rule.source, line: rule.line, pattern: rule.pattern, negated: rule.negated } : {}) };
  });
  const directory = directoryPresent ? checkIgnore(checkout, LOCAL_DIRECTORY) : null;
  const ignored = directory !== null && !directory.negated;
  const match = ignored ? { source: directory.source, line: directory.line, pattern: directory.pattern } : null;
  const negatedBy = directory?.negated ? { source: directory.source, line: directory.line, pattern: directory.pattern } : null;
  return {
    directoryPresent,
    ignored,
    ...(directoryPresent ? {} : { reason: 'directory absent' }),
    match,
    negatedBy,
    partial: !ignored && children.some((child) => child.ignored),
    children,
  };
}

/** Git's local exclude file for this repository, shared by all its worktrees. */
export function excludeFile(checkout) {
  return gitPaths([['--git-path', 'info/exclude']], { cwd: checkout })[0];
}

/** True when `text` already holds the exact narrow rule on a line of its own. */
export function hasExcludeRule(text) {
  return text.split(/\r?\n/).some((line) => line.trimEnd() === EXCLUDE_RULE);
}

/**
 * Establish local storage: nothing under `.peer-skills-and-workflows/` tracked, and the
 * directory itself excluded by Git, adding `/.peer-skills-and-workflows/` to the local
 * exclude file only when no rule covers the directory and the exact rule is
 * not already there. Creates the empty local directory when absent, so Git can
 * evaluate the directory rule; preserves every existing exclude entry and
 * changes nothing on sequential repeat, in every state. Concurrent setup is
 * uncoordinated and can append identical rules (workflow/BINDING.md).
 * Returns the outcome without
 * throwing for the conflicts the operator must resolve: `tracked` (paths
 * listed), `occupied` (a file, link or other entry holds the path; `occupied`
 * names it with the operator's resolution, decided before any probe and
 * without appending the rule), `unverified` (the rule is in the exclude file,
 * written now or earlier, and Git still does not exclude the directory;
 * `overriddenBy` names a higher-precedence negation when there is one and
 * `children` the partial effects) and `unwritable` (the exclude file cannot
 * be written; `error` carries the code). Status `ignored` means a rule
 * already covered the directory and `added` that one was written and
 * verified. `changed` is true only when this call wrote the rule.
 */
export function establishLocalStorage(checkout) {
  const tracked = trackedLocalPaths(checkout);
  if (tracked.length) return { status: 'tracked', tracked, changed: false };
  const local = path.join(checkout, LOCAL_DIRECTORY);
  const state = localPathState(checkout);
  if (state.kind !== 'directory' && state.kind !== 'absent') {
    return { status: 'occupied', localDirectory: local, occupied: occupiedConflict(checkout, state), changed: false };
  }
  let directoryCreated = false;
  if (state.kind === 'absent') {
    try {
      fs.mkdirSync(local);
      directoryCreated = true;
    } catch (error) {
      if (error.code !== 'EEXIST') return { status: 'unwritable', localDirectory: local, error: error.code ?? error.message, changed: false };
      // Another setup may have created it after our first inspection. Never
      // treat EEXIST itself as proof that the occupant is safe to use.
      const collided = localPathState(checkout);
      if (collided.kind === 'absent') return { status: 'unwritable', localDirectory: local, error: error.code, changed: false };
      if (collided.kind !== 'directory') {
        return { status: 'occupied', localDirectory: local, occupied: occupiedConflict(checkout, collided), changed: false };
      }
    }
  }
  const file = excludeFile(checkout);
  const before = ignoreCoverage(checkout);
  const coverage = (state) => ({ match: state.match, negatedBy: state.negatedBy, partial: state.partial, children: state.children });
  if (before.ignored) return { status: 'ignored', ...coverage(before), excludeFile: file, directoryCreated, changed: false };
  let existing = '';
  try {
    existing = fs.readFileSync(file, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') return { status: 'unwritable', excludeFile: file, error: error.code ?? error.message, directoryCreated, changed: false };
  }
  if (hasExcludeRule(existing)) {
    const current = ignoreCoverage(checkout);
    if (current.ignored) return { status: 'ignored', ...coverage(current), excludeFile: file, directoryCreated, changed: false };
    return {
      status: 'unverified', ...coverage(current), excludeFile: file, pattern: EXCLUDE_RULE, rulePresent: true, overriddenBy: current.negatedBy, directoryCreated, changed: false,
    };
  }
  const separator = existing.length && !existing.endsWith('\n') ? '\n' : '';
  const addition = `${separator}# Local peer-skills-and-workflows binding and run records (workflow/BINDING.md); never tracked.\n${EXCLUDE_RULE}\n`;
  // One append; existing entries are never rewritten. An interruption during
  // it can leave a partial line, which a retry does not diagnose or delete
  // (workflow/BINDING.md, Local storage).
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, addition);
  } catch (error) {
    return { status: 'unwritable', excludeFile: file, error: error.code ?? error.message, directoryCreated, changed: false };
  }
  const after = ignoreCoverage(checkout);
  if (!after.ignored) {
    return {
      status: 'unverified', ...coverage(after), excludeFile: file, pattern: EXCLUDE_RULE, rulePresent: true, overriddenBy: after.negatedBy, directoryCreated, changed: true,
    };
  }
  return { status: 'added', ...coverage(after), excludeFile: file, pattern: EXCLUDE_RULE, directoryCreated, changed: true };
}

/**
 * Git enumeration warnings make nonignored membership unverified. Each warning
 * keeps its raw `message`. Git's two known forms, an unreadable ignore file
 * (`unable to access`) and an unreadable directory (`could not open
 * directory`), name the affected path relative to the checkout: `path` is it
 * resolved against the checkout and `error` the cause. Any other warning has
 * `path: null`, since its location is unknown, and the whole line as `error`.
 * A listed name that is not UTF-8 is not enumerated either: its error has
 * the checkout as `path`, the escaped name, relative to it, as `name`
 * (opaque text, never resolved to a host path or looked up) and the fixed
 * UNSUPPORTED_NAME cause.
 */
function visiblePaths(checkout) {
  const errors = [];
  const listed = gitRecords(gitIn(checkout)(['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
    bytes: true,
    onStderr: (message) => {
      for (const line of message.trim().split('\n')) {
        const known = /^warning: (?:unable to access|could not open directory) '(.*)': (.*)$/.exec(line);
        errors.push({ path: known ? path.resolve(checkout, known[1]) : null, error: known?.[2] ?? line, message: line });
      }
    },
  }));
  for (const name of new Set(listed.invalid.map(escapedName))) {
    errors.push({ path: checkout, name, error: UNSUPPORTED_NAME, message: `git ls-files listed ${name}: ${UNSUPPORTED_NAME}` });
  }
  return { paths: [...new Set(listed.records)].sort(byCodeUnit), errors };
}

/** Candidate guidance and enumeration completeness; errors prevent trusting discovery coverage. */
export function discoverCandidates(checkout) {
  const tracked = new Set(gitRecords(gitIn(checkout)(['ls-files', '-z'], { bytes: true })).records);
  const { paths, errors } = visiblePaths(checkout);
  const found = [];
  for (const file of paths) {
    const category = CANDIDATES.find(([, pattern]) => pattern.test(file))?.[0];
    if (category) found.push({ path: file, category, tracked: tracked.has(file) });
  }
  return { candidates: found, complete: errors.length === 0, errors };
}

/**
 * The installed quality-profile selection: `.quality/config.json` and each
 * selected profile's manifest with the profiles it inherits (obligations) and
 * requires (reference), followed to their installed manifests. The config
 * selects the repository's obligations, so it is canonicalized before it is
 * read under the same checkout guard as profile locations: one that resolves
 * outside the checkout is not read and is reported `present: false` with
 * `error: 'outside the checkout'`, its canonical `location` and no selection;
 * one read through an alias inside the checkout names its canonical origin as
 * checkout-relative `resolved`. A config the
 * quality tool would refuse is reported `present: false` with its structural
 * reason and selects nothing (readQualityConfig). Reports what
 * is missing or unreadable, including expected lookup access errors with
 * their location; unrelated lookup failures propagate. An inherited or
 * required ID that no readable manifest or fallback folder resolves while some
 * candidate manifest could not be read or decoded is `error: 'unresolved'`,
 * with those candidates in `inaccessible`, not `not installed` (locateProfile). A configured profile
 * location is canonicalized (`..` segments
 * and links in its ancestors resolved) before it is read: one that leaves the
 * checkout is not read at all and is reported `present: false` with
 * `error: 'outside the checkout'` and its canonical `location`, because an
 * installed profile the candidate does not own cannot establish repository
 * obligations; a configured location elsewhere inside the checkout is read.
 */
export function qualitySelection(checkout) {
  const named = path.join(checkout, '.quality', 'config.json');
  const contained = containedLocation(checkout, named);
  if (contained.error) {
    return { present: false, config: '.quality/config.json', error: contained.error, ...(contained.location ? { location: contained.location } : {}), profiles: [] };
  }
  const origin = contained.location === named ? {} : { resolved: relativeLookup(checkout, contained.location) };
  const config = readQualityConfig(contained.location);
  if (config.error) return { present: false, config: '.quality/config.json', ...origin, error: config.error, profiles: [] };
  const profiles = [];
  const blocked = new Map();
  const seen = new Set();
  const related = (list, relation) => (Array.isArray(list) ? list : []).map((item) => ({
    profileId: item?.profileId ?? null, versionRequirement: item?.versionRequirement ?? null, relation,
  }));
  const visit = (profileId, profilePath, selectedBy) => {
    const relative = typeof profilePath === 'string' ? path.posix.normalize(profilePath) : null;
    const manifest = relative
      ? containedJson(checkout, path.resolve(checkout, '.quality', relative, '_manifest', 'profile.json'))
      : profilePath?.error ? profilePath : { error: 'not installed' };
    const entry = { profileId: profileId ?? manifest.data?.profileId ?? null, path: relative ? `.quality/${relative}` : null, selectedBy };
    if (manifest.error) {
      profiles.push({
        ...entry, present: false, error: manifest.error,
        ...(manifest.location ? { location: manifest.location } : {}), ...(manifest.inaccessible ? { inaccessible: manifest.inaccessible } : {}),
      });
      return;
    }
    const inherits = related(manifest.data.inherits, 'inherits');
    const requires = related(manifest.data.requires, 'requires');
    profiles.push({ ...entry, present: true, version: manifest.data.version ?? null, inherits, requires });
    for (const next of [...inherits, ...requires]) {
      if (!next.profileId || seen.has(next.profileId)) continue;
      seen.add(next.profileId);
      visit(next.profileId, locateProfile(checkout, next.profileId, blocked), `${entry.profileId} ${next.relation}`);
    }
  };
  for (const selection of config.data.profiles) {
    seen.add(selection.profileId);
    visit(selection.profileId, selection.path, 'config');
  }
  return { present: true, config: '.quality/config.json', ...origin, profiles, ...(blocked.size ? { blockedLocations: [...blocked.values()] } : {}) };
}

const validateQualityConfig = new Ajv({ coerceTypes: false, useDefaults: false, removeAdditional: false }).compile({
  type: 'object', required: ['profiles'], additionalProperties: false,
  properties: {
    profiles: {
      type: 'array', minItems: 1,
      items: {
        type: 'object', required: ['profileId', 'path'], additionalProperties: false,
        properties: { profileId: { type: 'string', minLength: 1 }, path: { type: 'string' } },
      },
    },
  },
});

/** The member names the quality config admits; diagnostics name no others. */
const CONFIG_MEMBERS = new Set(['profiles', 'profileId', 'path']);

/** Fatal on malformed UTF-8; a byte order mark is kept, so JSON.parse refuses it. */
const strictUtf8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

/**
 * True when every string and member name in decoded JSON is well-formed
 * Unicode (no unpaired surrogate escape). Nested values are visited from a
 * work list rather than by recursion, so however deeply valid input nests,
 * checking it does not exhaust the call stack.
 */
function wellFormed(data) {
  const pending = [data];
  while (pending.length) {
    const value = pending.pop();
    if (typeof value === 'string') {
      if (!value.isWellFormed()) return false;
    } else if (value !== null && typeof value === 'object') {
      for (const [name, item] of Object.entries(value)) {
        if (!name.isWellFormed()) return false;
        pending.push(item);
      }
    }
  }
  return true;
}

/**
 * Decode JSON bytes strictly: `{ data, text }`, or `{ error }` with a fixed
 * cause that repeats no file content: `invalid JSON: not UTF-8` for malformed
 * UTF-8, `invalid JSON` for text that does not parse (`syntax` keeps the
 * parser's message for callers that report it), or `invalid JSON: unpaired
 * surrogate` when a string or member name holds an unpaired surrogate escape.
 * Nothing is replaced or reinterpreted. A byte order mark is kept and so does
 * not parse; supplementary characters, raw or as escaped surrogate pairs, are
 * ordinary text.
 */
function decodeJson(bytes) {
  let text;
  try {
    text = strictUtf8.decode(bytes);
  } catch {
    return { error: 'invalid JSON: not UTF-8' };
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    return { error: 'invalid JSON', syntax: error.message };
  }
  if (!wellFormed(data)) return { error: 'invalid JSON: unpaired surrogate' };
  return { data, text };
}

/**
 * Read `.quality/config.json`, which belongs to the quality tool: its decoder
 * accepts UTF-8 text without a byte order mark holding one object whose only
 * member is `profiles`, an array of at least one object whose only members
 * are the strings `profileId` and `path`, with nonempty, distinct IDs, and
 * refuses malformed UTF-8, unpaired surrogate escapes, and unknown and
 * duplicate members at every depth. Any other encoding is refused here before
 * lookup, so no partial, replaced or reinterpreted selection is reported:
 * `{ error }` is the read code, `invalid JSON` (`invalid JSON: not UTF-8`,
 * `invalid JSON: unpaired surrogate`), or `invalid structure:` with the member
 * location, worded from fixed names and indices only, never from repository
 * text. Supplementary characters, raw or as escaped surrogate pairs, are
 * ordinary text. Size and count limits, path syntax and profile contents stay
 * the quality tool's own checks.
 */
function readQualityConfig(file) {
  let bytes;
  try {
    bytes = fs.readFileSync(file);
  } catch (error) {
    return { error: error.code ?? error.message };
  }
  const decoded = decodeJson(bytes);
  if (decoded.error) return { error: decoded.error };
  const { data, text } = decoded;
  const duplicate = duplicateMember(text);
  if (duplicate) return { error: `invalid structure: ${memberLocation(duplicate)} is a duplicate member` };
  if (!validateQualityConfig(data)) {
    const [error] = validateQualityConfig.errors;
    const steps = error.instancePath.split('/').slice(1).map((step) => (/^\d+$/.test(step) ? Number(step) : step));
    return { error: `invalid structure: ${memberLocation(steps)} ${error.message}` };
  }
  const ids = new Map();
  for (const [index, { profileId }] of data.profiles.entries()) {
    if (ids.has(profileId)) return { error: `invalid structure: profiles[${index}].profileId repeats profiles[${ids.get(profileId)}].profileId` };
    ids.set(profileId, index);
  }
  return { data };
}

/** `profiles[0].path` style location of decoded steps; other member names are not repeated. */
function memberLocation(steps) {
  if (!steps.length) return 'the document';
  return steps.map((step, index) => (typeof step === 'number' ? `[${step}]`
    : `${index ? '.' : ''}${CONFIG_MEMBERS.has(step) ? step : '(unknown member)'}`)).join('');
}

/**
 * The location of the first repeated member name in valid JSON text, as
 * decoded steps ending with that name, or null. Names compare decoded, so
 * `"path"` and `"\u0070ath"` are one member. JSON.parse keeps only the last
 * of repeated members, so this reads the text itself.
 */
function duplicateMember(text) {
  const stack = [];
  let expectName = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === '"') {
      let end = index + 1;
      while (text[end] !== '"') end += text[end] === '\\' ? 2 : 1;
      if (expectName) {
        const frame = stack.at(-1);
        const name = JSON.parse(text.slice(index, end + 1));
        if (frame.names.has(name)) return [...stack.slice(0, -1).map((outer) => outer.step), name];
        frame.names.add(name);
        frame.step = name;
        expectName = false;
      }
      index = end;
    } else if (char === '{') {
      stack.push({ names: new Set(), step: null });
      expectName = true;
    } else if (char === '[') {
      stack.push({ names: null, step: 0 });
    } else if (char === '}' || char === ']') {
      stack.pop();
      expectName = false;
    } else if (char === ',') {
      const frame = stack.at(-1);
      if (frame.names) expectName = true;
      else frame.step += 1;
    }
  }
  return null;
}

/**
 * Find an installed profile by ID: its `.quality`-relative path, null when a
 * complete search finds none, or a lookup error. The profiles directory's own
 * expected access error carries its location. A readable manifest declaring
 * the ID wins, and the fallback folder named after the ID still resolves it;
 * when neither does and some candidate manifest could not be read for an
 * expected access reason or decoded (decodeJson: malformed UTF-8, an unpaired
 * surrogate escape or invalid JSON), the lookup is `unresolved`
 * rather than absent, listing each such candidate's path, location and cause
 * (the access code, or the fixed `invalid JSON`) in `inaccessible` (and in
 * blockedLocations), since unread or undecodable bytes may or may not declare
 * the ID. A decoded manifest declaring another ID is not a match. Containment
 * is checked before every read; locations outside the checkout are not read
 * and stay blocked lookups. Unrelated failures throw.
 */
function locateProfile(checkout, profileId, blocked) {
  const match = /^profile:([^/]+)\/(.+)$/.exec(profileId ?? '');
  const profiles = path.join(checkout, '.quality', 'profiles');
  if (!match) return null;
  const guard = (file) => {
    const result = containedLocation(checkout, file);
    if (result.error) blocked.set(file, { path: relativeLookup(checkout, file), ...result });
    return result;
  };
  const root = guard(profiles);
  if (root.error) return root.error === 'outside the checkout' ? null : { ...root, location: root.location ?? profiles };
  const expected = `${match[1]}-${match[2]}`;
  let entries;
  try { entries = readSource(root.location, () => fs.readdirSync(root.location, { withFileTypes: true })); }
  catch (error) {
    if (!(error instanceof SourceAccessError)) throw error;
    if (error.cause.code === 'ENOENT') return null;
    return { error: error.cause.code, location: error.cause.path ?? error.member };
  }
  const inaccessible = new Map();
  for (const entry of entries) {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
    const file = path.join(profiles, entry.name, '_manifest', 'profile.json');
    const location = guard(file);
    if (location.error) {
      if (location.error !== 'outside the checkout') inaccessible.set(file, { path: relativeLookup(checkout, file), error: location.error });
      continue;
    }
    let bytes;
    try { bytes = readSource(location.location, () => fs.readFileSync(location.location)); }
    catch (error) {
      if (!(error instanceof SourceAccessError)) throw error;
      // A directory without a manifest is not an installed profile.
      if (!['ENOENT', 'ENOTDIR'].includes(error.cause.code)) {
        inaccessible.set(file, { path: relativeLookup(checkout, file), location: location.location, error: error.cause.code ?? error.cause.message });
      }
      continue;
    }
    // Undecodable bytes (malformed UTF-8, an unpaired surrogate escape or
    // invalid JSON) neither declare nor rule out the ID. The fixed cause keeps
    // parser text, which can quote file content, out of the report.
    const manifest = decodeJson(bytes);
    if (manifest.error) {
      inaccessible.set(file, { path: relativeLookup(checkout, file), location: location.location, error: 'invalid JSON' });
      continue;
    }
    if (manifest.data?.profileId === profileId) return `profiles/${entry.name}`;
  }
  const fallback = guard(path.join(profiles, expected));
  if (!fallback.error && fs.existsSync(fallback.location)) return `profiles/${expected}`;
  if (!inaccessible.size) return null;
  for (const [file, item] of inaccessible) blocked.set(file, item);
  return { error: 'unresolved', inaccessible: [...inaccessible.values()] };
}

/**
 * A configured or fallback profile manifest: `{ data }`, or `{ error }` with
 * the read code or the decoding cause (decodeJson), so malformed UTF-8 and an
 * unpaired surrogate escape are refused with their fixed causes rather than
 * read as replaced text. Text that does not parse keeps the parser's message.
 */
function readJson(file) {
  let bytes;
  try {
    bytes = fs.readFileSync(file);
  } catch (error) {
    return { error: error.code ?? `invalid JSON: ${error.message}` };
  }
  const decoded = decodeJson(bytes);
  if (decoded.syntax !== undefined) return { error: `invalid JSON: ${decoded.syntax}` };
  return decoded.error ? { error: decoded.error } : { data: decoded.data };
}

/**
 * Resolve a location only when its canonical path, with `..` segments and
 * links in its ancestors and itself resolved, lies inside the checkout;
 * otherwise report `outside the checkout` with that location before any read.
 */
function containedLocation(checkout, file) {
  let location;
  try {
    location = canonicalLocation(file);
  } catch (error) {
    return { error: error.code ?? error.message };
  }
  if (!isWithin(checkout, location)) return { error: 'outside the checkout', location };
  return { location };
}

function containedJson(checkout, file) {
  const result = containedLocation(checkout, file);
  return result.error ? result : readJson(result.location);
}

/** The lexical, `/`-separated location of `absolute` inside the checkout; `.` for the root. */
function relativeLookup(checkout, absolute) {
  return toPosix(path.relative(checkout, absolute)) || '.';
}

/** The key a recorded lookup path compares under: `.` segments and a trailing `/` removed, nothing resolved. */
function lookupKey(recorded) {
  const normalized = path.posix.normalize(recorded);
  return normalized.length > 1 ? normalized.replace(/\/+$/, '') : normalized;
}

/** Expected content-access failures carry their actual cause and affected member. */
class SourceAccessError extends Error {
  constructor(member, cause) {
    super(cause.message, { cause });
    this.member = member;
  }
}

function readSource(member, read) {
  try {
    return read();
  } catch (error) {
    if (['EACCES', 'EPERM', 'EIO', 'ELOOP', 'ENOENT', 'ENOTDIR', 'EISDIR', 'ESTALE', 'EMFILE', 'ENFILE', 'EBUSY', 'ETIMEDOUT', 'ENAMETOOLONG'].includes(error.code)
      || error.message.startsWith('git hash-object failed:')) throw new SourceAccessError(member, error);
    throw error;
  }
}

/**
 * An unavailable child or unsupported member: `member` is the affected
 * member. A listed name that is not UTF-8 has no host location of its own:
 * `repository` is the repository that lists it and `escaped` the name
 * relative to it (escapedName), kept apart so that only the repository's
 * location is ever treated as a host path.
 */
class UnsupportedSourceError extends Error {
  constructor(message, { member, repository, escaped }) {
    super(message);
    this.member = member;
    this.repository = repository;
    this.escaped = escaped;
  }
}

function incompleteIdentity(error, root) {
  if (!(error instanceof SourceAccessError) && !(error instanceof UnsupportedSourceError)) throw error;
  const cause = error.cause ?? error;
  return {
    kind: error instanceof UnsupportedSourceError ? 'unsupported' : 'unreadable',
    error: cause.code ?? cause.message, message: cause.message,
    member: error.escaped ? escapedMember(root, error.repository, error.escaped) : isWithin(root, error.member) ? relativeLookup(root, error.member) : error.member,
  };
}

function incomplete(entry) {
  return entry?.kind === 'unreadable' || entry?.kind === 'unsupported';
}

/** Stat absence is genuine deletion; access failures are never missing content. */
function memberStat(file, { follow = true } = {}) {
  try {
    return follow ? fs.statSync(file) : fs.lstatSync(file);
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return null;
    return readSource(file, () => { throw error; });
  }
}

/**
 * Index gitlinks are boundaries even when their working checkout is absent. A
 * gitlink whose name is not UTF-8 is unsupported (UNSUPPORTED_NAME), never
 * recorded under a substituted name.
 */
function childPins(root, paths, { exact = false } = {}) {
  const pins = new Map();
  const selected = paths.map((item) => `:(top,literal)${item === '.' ? '' : item}`);
  // A literal path includes descendants by default. Ancestor lookups need
  // only the entry itself; subtree readers deliberately retain descendants.
  if (exact) selected.push(...paths.map((item) => `:(top,exclude,glob)${item.replace(/[\\*?\[\]]/g, '\\$&')}/**`));
  const listed = gitRecords(gitIn(root)(['ls-files', '-s', '-z', '--', ...selected], { bytes: true }));
  const gitlink = listed.invalid.find((record) => record.subarray(0, 7).toString('latin1') === '160000 ');
  if (gitlink) throw new UnsupportedSourceError(UNSUPPORTED_NAME, { repository: root, escaped: escapedName(gitlink.subarray(gitlink.indexOf(0x09) + 1)) });
  for (const record of listed.records) {
    if (!record.startsWith('160000 ')) continue;
    const metadata = record.slice(0, record.indexOf('\t'));
    const name = record.slice(record.indexOf('\t') + 1);
    const [, pin, stage] = metadata.split(' ');
    pins.set(name, stage === '0' ? pin : 'unmerged');
  }
  return pins;
}

/**
 * Git-visible members of `paths`. Git can exit zero after warning that a
 * directory could not be opened, and a listed name that is not UTF-8 cannot be
 * looked up: either leaves `error`, which makes the enumeration incomplete.
 * The warning keeps precedence; otherwise the first such name is the
 * unsupported member, with its bytes escaped (UNSUPPORTED_NAME).
 */
function contentPaths(root, paths) {
  try {
    let warning = null;
    const listed = gitRecords(gitIn(root)(['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', ...paths.map((item) => `:(literal)${item}`)], {
      bytes: true, onStderr: (message) => { warning = message.trim(); },
    }));
    const error = warning ? new SourceAccessError(root, new Error(`git ls-files: ${warning}`))
      : listed.invalid.length ? new UnsupportedSourceError(UNSUPPORTED_NAME, { repository: root, escaped: escapedName(listed.invalid[0]) }) : null;
    return { files: listed.records, error };
  } catch (error) {
    if (error.message.startsWith('git ls-files failed:')) throw new SourceAccessError(root, error);
    throw error;
  }
}

/** A child must be an available working tree rooted here, never its parent's fallback. */
function childRepository(parent, full, pin, repositories, reportRoot) {
  if (pin === 'unmerged') throw new UnsupportedSourceError('unmerged submodule index entry', { member: full });
  const own = memberStat(full, { follow: false });
  if (!own?.isDirectory()) throw new UnsupportedSourceError('child checkout unavailable: expected a plain working-tree directory', { member: full });
  const marker = memberStat(path.join(full, '.git'), { follow: false });
  if (!marker) throw new UnsupportedSourceError('child checkout unavailable or uninitialized: .git entry absent', { member: full });
  const run = gitIn(full);
  let top, head;
  try {
    [top] = gitPaths(['--show-toplevel'], { cwd: full });
    head = run(['rev-parse', '-q', '--verify', 'HEAD'], { allowMissing: true })?.trim() ?? null;
  } catch (error) {
    // These queries address a known child, so their failure means its working
    // content cannot be established. Keep Git's actual diagnostic; an
    // unsupported Git is a prerequisite failure, not inaccessible content.
    if (error.name === 'UnsupportedGitError') throw error;
    throw new SourceAccessError(full, error);
  }
  if (readSource(full, () => canonical(top)) !== readSource(full, () => canonical(full))) {
    throw new UnsupportedSourceError('child checkout unavailable: Git resolved another working-tree root', { member: full });
  }
  const kind = pin ? 'submodule' : 'nested';
  const fact = { path: relativeLookup(reportRoot, full), kind, head };
  if (pin) {
    const relative = relativeLookup(parent, full);
    const parentRun = gitIn(parent);
    const parentHead = parentRun(['rev-parse', '-q', '--verify', 'HEAD'], { allowMissing: true });
    const headPin = parentHead ? parentRun(['ls-tree', '-z', 'HEAD', '--', `:(literal)${relative}`]) : null;
    const record = headPin?.split('\0').find((entry) => entry.startsWith('160000 '));
    Object.assign(fact, { indexPin: pin, headPin: record ? record.split(/\s+/)[2] : null });
    fact.indexPinMatchesChild = head === null ? null : pin === head;
    fact.headPinMatchesChild = fact.headPin === null || head === null ? null : fact.headPin === head;
  }
  if (!repositories.some((entry) => entry.path === fact.path)) repositories.push(fact);
  return kind;
}

/** Resolve explicitly named sources to their owning child without asking parent Git to cross a gitlink. */
function sourceRepository(root, absolute, repositories) {
  let owner = root;
  let current = root;
  for (const segment of path.relative(root, absolute).split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    const relative = relativeLookup(owner, current);
    let pin;
    try { pin = childPins(owner, [relative], { exact: true }).get(relative); } catch (error) {
      if (owner !== root && error.message.startsWith('git ')) throw new SourceAccessError(owner, error);
      throw error;
    }
    const own = memberStat(current, { follow: false });
    if (pin || (own?.isDirectory() && memberStat(path.join(current, '.git'), { follow: false }))) {
      if (!pin && !gitIn(owner)(['ls-files', '-z', '--', `:(literal)${relativeLookup(owner, current)}`])
        && gitIn(owner)(['check-ignore', '-q', '--', relativeLookup(owner, current)], { allowMissing: true }) !== null) return owner;
      childRepository(owner, current, pin, repositories, root);
      owner = current;
    }
    // A missing intermediate directory can still contain an indexed gitlink
    // farther along the named path. Keep checking those index boundaries.
    if (own && !own.isDirectory()) break;
  }
  return owner;
}

/** A name folded the way a case-insensitive filesystem may compare it: it selects candidate spellings, and decides only where foldsCase holds. */
function foldName(name) {
  return name.normalize('NFD').toUpperCase().toLowerCase();
}

/**
 * Whether the filesystem holding `dir` treats names that differ only by case
 * as one entry. The nearest existing directory, or failing an ASCII letter in
 * its name the next ancestor, is looked up in its parent under another ASCII
 * case spelling: a directory cannot have a second hard link, so reaching the
 * same device and inode means the parent folds case, and absence or another
 * entry means it does not. Throws when no ancestor decides.
 */
function foldsCase(dir) {
  let current = dir;
  while (!memberStat(current, { follow: false }) && path.dirname(current) !== current) current = path.dirname(current);
  for (; path.dirname(current) !== current; current = path.dirname(current)) {
    const name = path.basename(current);
    const variant = /[a-z]/.test(name) ? name.replace(/[a-z]+/g, (letters) => letters.toUpperCase()) : name.replace(/[A-Z]+/g, (letters) => letters.toLowerCase());
    if (variant === name) continue;
    const own = memberStat(current, { follow: false });
    const other = memberStat(path.join(path.dirname(current), variant), { follow: false });
    return other !== null && other.dev === own.dev && other.ino === own.ino;
  }
  throw new Error(`cannot establish whether the filesystem holding ${dir} folds case`);
}

/**
 * Whether `name` in `dir` designates the same entry as `reserved` there, as
 * the filesystem decides rather than by spelling, so a case or normalization
 * variant on a case-insensitive volume is recognized, the spelling the entry
 * is actually stored under included, while a distinct case-sensitive neighbor
 * and a separately listed hard link stay distinct. When either name exists,
 * `lstat` identity decides without following a link: names that do not both
 * reach the same device and inode are distinct. A shared inode alone does not
 * make two names one entry, since hard links share it; the names are one entry
 * when they have a stored name in common. A spelling's stored name is itself
 * when the directory lists it, otherwise each listed name of that inode that
 * folds to it (foldName); a hard link is listed under a name of its own.
 * When no stored name is found for a spelling, the filesystem folds beyond
 * foldName, and the spelling is taken as the entry. When neither exists, a
 * spelling that folds to the reserved name is the entry only where the
 * filesystem folds case (foldsCase). Failures other than absence throw.
 */
function sameEntryName(dir, name, reserved) {
  if (name === reserved) return true;
  const own = memberStat(path.join(dir, reserved), { follow: false });
  const other = memberStat(path.join(dir, name), { follow: false });
  if (own || other) {
    if (!own || !other || own.dev !== other.dev || own.ino !== other.ino) return false;
    const listed = readSource(dir, () => fs.readdirSync(dir));
    const stored = (spelling) => (listed.includes(spelling) ? [spelling] : listed.filter((entry) => {
      if (foldName(entry) !== foldName(spelling)) return false;
      const stat = memberStat(path.join(dir, entry), { follow: false });
      return stat?.dev === own.dev && stat?.ino === own.ino;
    }));
    const named = stored(name);
    const entry = stored(reserved);
    return !named.length || !entry.length || named.some((spelling) => entry.includes(spelling));
  }
  return foldName(name) === foldName(reserved) && foldsCase(dir);
}

/**
 * The requested path as a path beneath the checkout's named local storage, or
 * null when it names none: `<checkout>/.peer-skills-and-workflows/<rest>` when a
 * component designates the checkout's `.peer-skills-and-workflows` entry under any
 * spelling the filesystem treats as that entry (sameEntryName) and its parent
 * resolves to the checkout, however the checkout is spelled (an alias of it or
 * of an ancestor included). Only components whose name folds to
 * `.peer-skills-and-workflows` are considered, so other paths are not resolved here.
 * Components are tried from the root down, and only the ancestors above the
 * storage entry are resolved, never the entry itself, so an occupant is
 * inspected rather than followed. Resolution failures throw.
 */
function namedLocalPath(checkout, out) {
  const requested = path.resolve(out);
  const components = [];
  for (let current = requested; path.dirname(current) !== current; current = path.dirname(current)) {
    if (foldName(path.basename(current)) === foldName(LOCAL_DIRECTORY)) components.unshift(current);
  }
  for (const component of components) {
    const parent = path.dirname(component);
    if (canonicalLocation(parent) === checkout && sameEntryName(checkout, path.basename(component), LOCAL_DIRECTORY)) {
      return path.join(checkout, LOCAL_DIRECTORY, path.relative(component, requested));
    }
  }
  return null;
}

/**
 * The binding child of local storage that `file` designates, as its canonical
 * path, or null: `file` must lie directly in `<checkout>/.peer-skills-and-workflows`, and
 * its name must be `binding.md` or `binding-sources.json` under any spelling
 * the filesystem treats as that entry, present or absent (sameEntryName).
 * Call it only for a plain or absent storage directory, never through an
 * occupant. Failures other than absence throw.
 */
export function localStorageChild(checkout, file) {
  const storage = path.join(checkout, LOCAL_DIRECTORY);
  if (typeof file !== 'string' || path.dirname(file) !== storage) return null;
  const child = [BINDING_FILE, SOURCES_FILE].find((name) => sameEntryName(storage, path.basename(file), name));
  return child ? path.join(storage, child) : null;
}

/** The occupied-path conflict of local storage, or null for a plain or absent directory. */
function storageOccupant(checkout) {
  const state = localPathState(checkout);
  return ['directory', 'absent'].includes(state.kind) ? null : occupiedConflict(checkout, state);
}

/**
 * The occupied-path conflict when `file` names the checkout's local storage
 * (namedLocalPath) and something other than a plain directory occupies it;
 * null otherwise. Decided before anything follows or reads through the
 * occupant. Resolution failures throw.
 */
export function namedStorageOccupant(checkout, file) {
  return namedLocalPath(checkout, file) === null ? null : storageOccupant(checkout);
}

/**
 * Refuse explicit exports into checkout/owning-child administration or tracked
 * files. Inspect only ancestors relevant to the named destination, including
 * ignored nested repositories; external exports do not adopt an external repo.
 * Actual Git/common directories cover linked worktrees and separate Git dirs.
 * Unavailable child boundaries are a refusal, never permission to overwrite.
 * A destination naming local storage under any spelling the filesystem treats
 * as it (namedLocalPath) is refused while that path is occupied, before
 * anything follows the occupant, and the binding file is reserved under its
 * named and its resolved spelling alike, including a filesystem-equivalent
 * name for a binding file that does not exist yet (localStorageChild).
 */
export function outputDestinationProblem(facts, out) {
  let resolved;
  try {
    const named = namedLocalPath(facts.checkout, out);
    const occupied = named === null ? null : storageOccupant(facts.checkout);
    if (occupied) return { reason: 'local storage path occupied', occupied };
    resolved = canonicalLocation(out);
    if ([named, resolved].some((file) => localStorageChild(facts.checkout, file) === path.join(facts.checkout, LOCAL_DIRECTORY, BINDING_FILE))) {
      return { reason: 'binding.md holds operator choices; write the factual manifest to binding-sources.json instead', resolved };
    }
    const administrative = (owner) => {
      const administrativePath = [owner.gitDir, owner.commonDir].find((dir) => isWithin(dir, resolved));
      return administrativePath ? { reason: 'the destination resolves to Git administration', resolved, administrativePath, repository: owner.checkout } : null;
    };
    const parentAdmin = administrative(facts);
    if (parentAdmin) return parentAdmin;
    const owners = new Map([[facts.checkout, facts]]);
    for (const named of new Set([path.resolve(out), resolved])) {
      if (!isWithin(facts.checkout, named)) continue;
      let owner = facts;
      let current = facts.checkout;
      for (const segment of path.relative(facts.checkout, named).split(path.sep).filter(Boolean)) {
        current = path.join(current, segment);
        if (segment === '.git') return { reason: 'the destination names Git administration', resolved, administrativePath: current, repository: owner.checkout };
        const relative = relativeLookup(owner.checkout, current);
        const pin = childPins(owner.checkout, [relative], { exact: true }).get(relative);
        const stat = memberStat(current, { follow: false });
        if (pin || (stat?.isDirectory() && memberStat(path.join(current, '.git'), { follow: false }))) {
          if (pin === 'unmerged' || !stat?.isDirectory() || !memberStat(path.join(current, '.git'), { follow: false })) {
            return { reason: 'destination child checkout unavailable or unmerged; restore it before exporting', resolved, repository: current };
          }
          owner = checkoutFacts(current);
          owners.set(owner.checkout, owner);
          const childAdmin = administrative(owner);
          if (childAdmin) return childAdmin;
        }
        if (stat && !stat.isDirectory()) break;
      }
    }
    for (const owner of owners.values()) {
      if (!isWithin(owner.checkout, resolved)) continue;
      const relative = relativeLookup(owner.checkout, resolved);
      const tracked = gitIn(owner.checkout)(['ls-files', '-z', '--', `:(top,literal)${relative}`]).split('\0');
      if (tracked.includes(relative)) return { reason: 'the destination resolves to a file tracked by the checkout or owning child', resolved, trackedPath: relative, repository: owner.checkout };
    }
    return null;
  } catch (error) {
    return { reason: 'destination protection could not be established; resolve the reported cause before exporting', ...(resolved ? { resolved } : {}), error: error.cause?.code ?? error.code ?? error.message };
  }
}

/** Current child working contents and link identities; never traverse directory-link members. */
function gitMemberEntries(root, paths, hashFile, { omitMissing = false, repositories = [], reportRoot = root } = {}) {
  const pins = childPins(root, paths);
  const listedPaths = contentPaths(root, paths);
  const files = [...new Set(listedPaths.files.map(lookupKey))].sort(byCodeUnit);
  const entries = [];
  const visitedChildren = new Set();
  for (const listed of files) {
    if ([...visitedChildren].some((child) => listed === child || listed.startsWith(`${child}/`))) continue;
    let file = listed;
    // Parent-tracked paths may now lie in a nested repository. Its own Git
    // membership wins for the child, just as for a directory entry from Git.
    const parts = file.split('/');
    for (let count = 1; count < parts.length; count++) {
      const ancestor = parts.slice(0, count).join('/');
      const full = path.join(root, ancestor);
      const ancestorStat = memberStat(full, { follow: false });
      if (ancestorStat?.isSymbolicLink() || (ancestorStat?.isDirectory() && memberStat(path.join(full, '.git'), { follow: false }))) {
        file = ancestor;
        break;
      }
    }
    const full = path.join(root, file);
    if (isGitAdministrativeContent(full)) continue;
    const own = memberStat(full, { follow: false });
    if (pins.has(file) || (own?.isDirectory() && memberStat(path.join(full, '.git'), { follow: false }))) {
      const kind = childRepository(root, full, pins.get(file), repositories, reportRoot);
      visitedChildren.add(file);
      let children;
      try {
        children = gitMemberEntries(full, ['.'], hashFile, { omitMissing, repositories, reportRoot });
      } catch (error) {
        if (!(error instanceof SourceAccessError) && error.message.startsWith('git ')) throw new SourceAccessError(full, error);
        throw error;
      }
      entries.push(`${file}\0${JSON.stringify(['repository', kind])}\n`);
      entries.push(...children.map((entry) => `${file}/${entry}`));
    } else if (own?.isSymbolicLink()) {
      visitedChildren.add(file);
      const target = readSource(full, () => fs.readlinkSync(full, 'utf8'));
      const followed = memberStat(full);
      const type = !followed ? 'missing' : followed.isFile() ? 'file' : followed.isDirectory() ? 'directory' : 'other';
      entries.push(`${file}\0${JSON.stringify(['link', target, type, type === 'file' ? hashFile(full) : null])}\n`);
    } else {
      const stat = own ? memberStat(full) : null;
      if (stat?.isFile()) entries.push(`${file}\0${hashFile(full)}\n`);
      else if (!omitMissing) entries.push(`${file}\0missing\n`);
    }
  }
  // Read known members first for precise filesystem causes; even when they
  // all succeed, a Git warning means enumeration did not establish coverage.
  if (listedPaths.error) throw listedPaths.error;
  return entries.sort(byCodeUnit);
}

/** Git administrative entries are never content, whether files or directories. */
function isGitAdministrative(file) {
  return toPosix(file).split('/').includes('.git');
}

/** A differently named alias cannot bring administrative target content into a digest. */
function isGitAdministrativeContent(file) {
  return isGitAdministrative(file) || isGitAdministrative(readSource(file, () => canonicalLocation(file)));
}

/**
 * Content identity of one source for change detection. `path` is the
 * normalized lookup path the caller named (relative to the checkout, or
 * absolute for a personal file outside it), never a resolved target, so a
 * source that is a link keeps its name across checks and is resolved afresh
 * each time: `link` records the link's own target text and `resolved` the
 * canonical location the lookup reaches when it differs. Inside the checkout
 * a file has the working-tree blob id of its effective content beside its
 * index and HEAD blob ids, so an uncommitted edit shows. That id is of the
 * raw bytes and stays the compared identity; `modified` compares the content
 * as Git would store it with HEAD, so a checkout Git converted (end of line,
 * for example) and reports clean is not modified, and it is `'unknown'` where
 * a filter attribute or a failed conversion leaves that undetermined
 * (storedModified). For a link, `linkBlob` is what Git stores and `modified`
 * compares that. A directory
 * has a digest over working blobs and current link target/type identities
 * of its Git-visible members, recursively including child repositories;
 * `repositories` reports child revisions and parent pins separately
 * (`digestScope: 'git-visible'`), or, when Git ignores the directory and
 * tracks nothing beneath it, over the names and contents of its regular files
 * (`state: 'ignored'`, `digestScope: 'all-files'`; links are not followed),
 * so edits inside ignored local storage still show. A source outside the
 * checkout gets a SHA-256 of its content. `kind` is file, directory, missing
 * (a broken link included), excluded (Git administration), unsupported
 * (unavailable child checkout or unsupported member), or unreadable;
 * `state` is tracked, untracked,
 * ignored or external. A resolution failure such as a link loop (ELOOP) is
 * returned as that entry's `unreadable` result with its error code and link
 * metadata. Expected content-access failures retain the cause and member;
 * unrelated failures still throw. Unreadable entries make the check incomplete.
 *
 * Git cannot look up a path beneath a directory link, so Git queries for a
 * file use the lookup with its ancestors resolved, keeping the entry itself
 * unresolved: a direct link keeps its index, HEAD and link-blob semantics,
 * and a file beneath a directory alias is classified at the location its
 * ancestors reach. When that location is outside the checkout the file is
 * identified by content with `state: 'external'`.
 */
export function sourceIdentity(checkout, source) {
  const absolute = path.resolve(checkout, source);
  let lookupAbsolute = absolute;
  let inside = isWithin(checkout, absolute);
  if (!inside) {
    // Named through an alias of the checkout path: resolve the ancestors, never the entry itself.
    let viaParent;
    try {
      viaParent = path.join(canonicalLocation(path.dirname(absolute)), path.basename(absolute));
    } catch (error) {
      return { path: absolute, scope: 'external', kind: 'unreadable', error: error.code ?? error.message };
    }
    if (isWithin(checkout, viaParent)) {
      lookupAbsolute = viaParent;
      inside = true;
    }
  }
  const lookup = inside ? relativeLookup(checkout, lookupAbsolute) : lookupAbsolute;
  const base = { path: lookup, scope: inside ? 'checkout' : 'external' };
  if (isGitAdministrative(lookupAbsolute)) return { ...base, kind: 'excluded', reason: 'Git administrative entry' };
  let owner = checkout;
  const repositories = [];
  // Check ancestor gitlinks before absence: an uninitialized child does not
  // establish that a named file beneath it was deleted.
  if (inside) {
    try {
      // A gitlink replaced by an alias is unavailable, even if following that
      // alias would reach readable content outside the child boundary.
      owner = sourceRepository(checkout, lookupAbsolute, repositories);
      const candidate = readSource(lookupAbsolute, () => path.join(canonicalLocation(path.dirname(lookupAbsolute)), path.basename(lookupAbsolute)));
      if (candidate !== lookupAbsolute && isWithin(checkout, candidate) && !isGitAdministrative(candidate)) {
        owner = sourceRepository(checkout, candidate, repositories);
      }
    } catch (error) {
      return { ...base, ...(repositories.length ? { repositories } : {}), ...incompleteIdentity(error, checkout) };
    }
  }
  if (repositories.length) base.repositories = repositories;
  let lstat;
  try {
    lstat = fs.lstatSync(lookupAbsolute);
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return { ...base, kind: 'missing' };
    return { ...base, kind: 'unreadable', error: error.code };
  }
  let link = null;
  if (lstat.isSymbolicLink()) {
    try {
      link = { target: fs.readlinkSync(lookupAbsolute, 'utf8') };
    } catch (error) {
      return { ...base, kind: 'unreadable', error: error.code ?? error.message };
    }
  }
  let located;
  try {
    located = canonical(lookupAbsolute);
  } catch (error) {
    return { ...base, ...(link ? { link } : {}), kind: 'unreadable', error: error.code ?? error.message };
  }
  if (located === null) return { ...base, kind: 'missing', link };
  const resolved = located === lookupAbsolute ? null : isWithin(checkout, located) ? relativeLookup(checkout, located) : located;
  const alias = { ...(link ? { link } : {}), ...(resolved !== null ? { resolved } : {}) };
  if (isGitAdministrative(located)) return { ...base, ...alias, kind: 'excluded', reason: 'Git administrative entry' };
  let stat;
  try {
    stat = fs.statSync(located);
  } catch (error) {
    return { ...base, ...alias, kind: 'unreadable', error: error.code };
  }
  try {
    if (!inside) {
      if (stat.isDirectory()) return { ...base, ...alias, kind: 'directory', digest: externalTreeDigest(located) };
      return { ...base, ...alias, kind: 'file', digest: contentDigest(located), bytes: stat.size };
    }
    const run = gitIn(owner);
    if (stat.isDirectory()) {
      if (!isWithin(checkout, located)) return { ...base, ...alias, kind: 'directory', digest: externalTreeDigest(located) };
      owner = sourceRepository(checkout, located, repositories);
      const directoryRun = gitIn(owner);
      const relative = relativeLookup(owner, located);
      const listedPaths = contentPaths(owner, [relative]);
      const files = listedPaths.files.filter((file) => !isGitAdministrative(file));
      if (!files.length && listedPaths.error) throw listedPaths.error;
      if (!files.length && directoryRun(['check-ignore', '-q', '--', relative], { allowMissing: true }) !== null) {
        const regular = regularFiles(located);
        return { ...base, ...alias, kind: 'directory', state: 'ignored', digestScope: 'all-files', files: regular.length, digest: digestFiles(located, regular) };
      }
      const ownerKind = repositories.find((entry) => entry.path === relativeLookup(checkout, owner))?.kind;
      const entries = gitMemberEntries(owner, [relative], (full) => readSource(full, () => directoryRun(['hash-object', '--no-filters', '--', full]).trim()), { repositories, reportRoot: checkout });
      if (ownerKind) entries.unshift(`.\0${JSON.stringify(['repository', ownerKind])}\n`);
      return { ...base, ...alias, ...(repositories.length ? { repositories } : {}), kind: 'directory', digestScope: 'git-visible', files: entries.length, digest: sha256(entries.join('')) };
    }
    // The path Git is asked about: ancestors resolved, the entry itself kept.
    let gitAbsolute;
    try {
      gitAbsolute = path.join(canonicalLocation(path.dirname(lookupAbsolute)), path.basename(lookupAbsolute));
    } catch (error) {
      return { ...base, ...alias, kind: 'unreadable', error: error.code ?? error.message };
    }
    if (!isWithin(checkout, gitAbsolute)) {
      return { ...base, ...alias, kind: 'file', state: 'external', digest: contentDigest(located), bytes: stat.size };
    }
    const gitPath = relativeLookup(owner, gitAbsolute);
    const blob = readSource(located, () => run(['hash-object', '--no-filters', '--', located]).trim());
    const linkBlob = link ? run(['hash-object', '--stdin'], { input: link.target }).trim() : null;
    const staged = run(['ls-files', '-s', '-z', '--', `:(top,literal)${gitPath}`]).split('\0')
      .find((record) => record.slice(record.indexOf('\t') + 1) === gitPath);
    const indexBlob = staged ? staged.split(/\s+/)[1] : null;
    const headBlob = run(['rev-parse', '-q', '--verify', `HEAD:${gitPath}`], { allowMissing: true })?.trim() ?? null;
    const ignored = indexBlob ? false : run(['check-ignore', '-q', '--', gitPath], { allowMissing: true }) !== null;
    const modified = headBlob === null ? { modified: null }
      : linkBlob ? { modified: linkBlob !== headBlob } : storedModified(run, gitPath, located, blob, headBlob);
    return {
      ...base,
      ...alias,
      kind: 'file',
      state: indexBlob ? 'tracked' : ignored ? 'ignored' : 'untracked',
      blob,
      ...(linkBlob ? { linkBlob } : {}),
      indexBlob,
      headBlob,
      ...modified,
      bytes: stat.size,
    };
  } catch (error) {
    if (owner !== checkout && !(error instanceof SourceAccessError) && error.message.startsWith('git ')) error = new SourceAccessError(owner, error);
    return { ...base, ...alias, ...(repositories.length ? { repositories } : {}), ...incompleteIdentity(error, checkout) };
  }
}

/**
 * Whether a committed regular file's content differs from its HEAD blob as Git
 * would store it, without running a configured filter driver. `blob`, the id
 * of the raw working bytes, stays the compared identity, but Git's built-in
 * conversions (end of line, `ident`, working-tree-encoding) can make it differ
 * from the stored blob of a file Git reports clean. So raw bytes equal to HEAD
 * are unmodified, unless a `working-tree-encoding` attribute applies: Git
 * would then re-encode those bytes, so they can differ from HEAD once stored,
 * or fail to convert. Otherwise the content is hashed as Git would store it
 * under those conversions (`hash-object --path`, writing nothing). Where a
 * `filter` attribute applies, only its driver could establish the stored
 * content, and where Git fails or reports a problem applying its conversions
 * there is no stored content to compare: `modified` is then `'unknown'`, with
 * a fixed reason.
 */
function storedModified(run, gitPath, located, blob, headBlob) {
  // `-z` output is a path, attribute and value triple for each queried attribute.
  const fields = run(['check-attr', '-z', 'filter', 'working-tree-encoding', '--', gitPath]).split('\0');
  const values = new Map();
  for (let index = 0; index + 2 < fields.length; index += 3) values.set(fields[index + 1], fields[index + 2]);
  const applies = (attribute) => !['unspecified', 'unset'].includes(values.get(attribute));
  if (applies('filter')) {
    return { modified: 'unknown', modifiedUnknown: 'a filter attribute applies to the path; its driver is not run' };
  }
  if (blob === headBlob && !applies('working-tree-encoding')) return { modified: false };
  // Git reports a conversion it cannot apply on stderr and may still hash the
  // unconverted bytes, which are not what it would store.
  let stored;
  let reported = false;
  try {
    stored = run(['hash-object', `--path=${gitPath}`, '--', located], { onStderr: () => { reported = true; } }).trim();
  } catch (error) {
    if (!error.message.startsWith('git hash-object failed:')) throw error;
    reported = true;
  }
  if (reported) return { modified: 'unknown', modifiedUnknown: 'Git could not apply its built-in conversions to the working content' };
  return { modified: stored !== headBlob };
}

/** Every regular file under `dir`, as `/`-separated paths relative to it, in code-unit order. Links are not followed. */
function regularFiles(dir) {
  const found = [];
  const walk = (current, prefix) => {
    for (const entry of readSource(current, () => fs.readdirSync(current, { withFileTypes: true }))) {
      if (entry.name === '.git') continue;
      const name = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(path.join(current, entry.name), name);
      else if (entry.isFile()) found.push(name);
    }
  };
  walk(dir, '');
  return found.sort(byCodeUnit);
}

/** Digest of `name\0sha256(content)\n` lines for `files` (relative to `root`), in the order given. */
function digestFiles(root, files) {
  return sha256(files.filter((file) => !isGitAdministrative(file)).map((file) => {
    const full = path.join(root, file);
    return `${file}\0${sha256(readSource(full, () => fs.readFileSync(full)))}\n`;
  }).join(''));
}

function externalTreeDigest(dir) {
  return digestFiles(dir, regularFiles(dir));
}

const validateRepositories = new Ajv({ coerceTypes: false, useDefaults: false, removeAdditional: false }).compile({
  type: 'array',
  items: {
    type: 'object', required: ['path', 'kind'],
    properties: { path: { type: 'string' }, kind: { type: 'string' } },
    additionalProperties: true,
  },
});

function repositoriesProblem(entry, location) {
  if (!Object.hasOwn(entry, 'repositories') || validateRepositories(entry.repositories)) return null;
  const error = validateRepositories.errors[0];
  const steps = error.instancePath.split('/').slice(1).map((step) => step.replace(/~1/g, '/').replace(/~0/g, '~'));
  const suffix = steps.map((step) => /^\d+$/.test(step) ? `[${step}]` : `.${step}`).join('');
  return `invalid structure: ${location}.repositories${suffix} ${error.message}`;
}

/**
 * Validate a parsed manifest's structure; returns a reason string, or null
 * when usable. The structure includes one entry per normalized lookup path:
 * two entries whose paths normalize to the same key (`docs` and `docs/`
 * included) make the manifest unusable, naming both entries, because a
 * comparison could otherwise depend on which of them comes last. Distinct
 * aliases (`docs` beside `guides`) and additional fields are accepted.
 */
export function manifestProblem(data) {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) return 'not a JSON object';
  if (data.format !== MANIFEST_FORMAT) return `unsupported format: ${data.format === undefined ? 'no format marker' : JSON.stringify(data.format)}`;
  if (data.version !== MANIFEST_VERSION) return `unsupported version: ${JSON.stringify(data.version ?? null)} (this reader supports ${MANIFEST_VERSION})`;
  if (!Array.isArray(data.sources)) return 'invalid structure: sources is not an array';
  const keys = new Map();
  for (const [index, entry] of data.sources.entries()) {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) return `invalid structure: sources[${index}] is not an object`;
    if (typeof entry.path !== 'string' || !entry.path) return `invalid structure: sources[${index}] has no path`;
    if (typeof entry.kind !== 'string') return `invalid structure: sources[${index}] has no kind`;
    const problem = repositoriesProblem(entry, `sources[${index}]`);
    if (problem) return problem;
    const key = lookupKey(entry.path);
    if (keys.has(key)) return `invalid structure: duplicate path ${JSON.stringify(entry.path)} (sources[${keys.get(key)}] and sources[${index}])`;
    keys.set(key, index);
  }
  if (data.workflowSource !== undefined) {
    if (data.workflowSource === null || typeof data.workflowSource !== 'object' || Array.isArray(data.workflowSource)) return 'invalid structure: workflowSource is not an object';
    const problem = repositoriesProblem(data.workflowSource, 'workflowSource');
    if (problem) return problem;
  }
  return null;
}

/**
 * Read a persisted manifest without throwing: `{ manifest }` when the file
 * holds a supported, structurally valid manifest with an evaluable workflow
 * computation digest; otherwise `{ error }` with
 * the file's path and the reason (`absent`, an unreadable code, invalid JSON,
 * an unsupported format or version, or the invalid structure found). The
 * bytes are decoded strictly (decodeJson), so malformed UTF-8 and an unpaired
 * surrogate escape are refused with their fixed causes rather than compared
 * as replaced text; text that does not parse keeps the parser's message. An
 * unusable manifest is never compared; the skill rebuilds it with `sources
 * --out`, which rewrites only this factual record.
 */
export function readManifest(file) {
  const state = bindingFileState(file);
  if (state.kind === 'link') return { error: { path: file, reason: 'linked manifest is a conflict; resolve the entry before reading or refreshing', target: state.target } };
  let bytes;
  try {
    bytes = fs.readFileSync(file);
  } catch (error) {
    return { error: { path: file, reason: error.code === 'ENOENT' ? 'absent' : `unreadable: ${error.code ?? error.message}`, code: error.code ?? null } };
  }
  const decoded = decodeJson(bytes);
  if (decoded.error) return { error: { path: file, reason: decoded.syntax === undefined ? decoded.error : `invalid JSON: ${decoded.syntax}` } };
  const { data } = decoded;
  const problem = manifestProblem(data);
  if (problem) return { error: { path: file, reason: problem } };
  if (typeof data.workflowSource?.digest !== 'string' || !/^sha256:[0-9a-f]{64}$/.test(data.workflowSource.digest) || incomplete(data.workflowSource)) {
    return { error: { path: file, reason: 'workflowSource has no evaluable computation identity (a complete sha256 digest is required); refresh with sources --out after resolving source failures' } };
  }
  return { manifest: data };
}

/**
 * A manifest of source identities for `sources`, with the checkout's HEAD at
 * the time. Lookup paths are normalized before deduplication (`docs`,
 * `./docs` and `docs/` are one entry; distinct aliases stay distinct), and the
 * manifest carries its format marker and version.
 */
export function sourceManifest(checkout, sources, { workflowSource } = {}) {
  const facts = checkoutFacts(checkout);
  const byPath = new Map();
  for (const source of sources) {
    const entry = sourceIdentity(facts.checkout, source);
    if (!byPath.has(entry.path)) byPath.set(entry.path, entry);
  }
  const workflow = workflowSource ? workflowSourceIdentity(workflowSource) : null;
  return {
    format: MANIFEST_FORMAT,
    version: MANIFEST_VERSION,
    checkout: facts.checkout,
    head: facts.head,
    branch: facts.branch,
    generated: new Date().toISOString(),
    complete: ![...byPath.values(), workflow].some(incomplete),
    ...(workflow ? { workflowSource: workflow } : {}),
    sources: [...byPath.values()],
  };
}

/**
 * The identity used to compare two entries: digest or working blob, with kind,
 * state, the link's own target and the resolved location, so a lookup that
 * comes to resolve elsewhere (an ancestor alias retargeted, for example) is a
 * change even when the content it reaches is byte-identical.
 */
function identityOf(entry) {
  return JSON.stringify([entry.kind, entry.state ?? null, entry.digest ?? entry.blob ?? null, entry.link?.target ?? null, entry.resolved ?? null]);
}

/**
 * Compare a previously recorded manifest with the current one: `changed`,
 * `missing` (recorded and currently absent, even when absent before, or
 * not listed in the current manifest at all, which is why a
 * comparison against a shorter list reports the omitted recorded paths as
 * missing), `added` (current only) and `unchanged` paths. `current` is true
 * only when both sets are complete, nothing changed, went missing or was added and the workflow
 * source is the same; it speaks for the paths the two manifests list, not
 * for sources neither of them records. Both inputs must already be usable
 * (readManifest or sourceManifest output).
 */
export function compareManifests(previous, current) {
  const entriesByPath = (manifest) => new Map((manifest?.sources ?? []).map((entry) => {
    const key = lookupKey(entry.path);
    return [key, { ...entry, path: key }];
  }));
  const before = entriesByPath(previous);
  const after = entriesByPath(current);
  const result = { changed: [], missing: [], added: [], unchanged: [] };
  result.unreadable = [...after.values()].filter(incomplete);
  if (incomplete(current?.workflowSource)) result.unreadable.push(current.workflowSource);
  result.complete = previous?.complete !== false && current?.complete !== false
    && !result.unreadable.length && ![...before.values(), previous?.workflowSource].some(incomplete);
  for (const [key, entry] of before) {
    const now = after.get(key);
    if (!now) continue;
    if (incomplete(now)) continue;
    if (now.kind === 'missing') result.missing.push(key);
    else if (identityOf(now) !== identityOf(entry)) result.changed.push(key);
    else result.unchanged.push(key);
  }
  for (const key of before.keys()) if (!after.has(key)) result.missing.push(key);
  for (const key of after.keys()) if (!before.has(key)) result.added.push(key);
  const workflowBefore = previous?.workflowSource?.digest ?? null;
  const workflowAfter = current?.workflowSource?.digest ?? null;
  result.workflowSourceChanged = workflowBefore !== null && workflowAfter !== null && workflowBefore !== workflowAfter;
  // Revision and parent-pin facts are observable separately from working
  // content. Neither a new commit of the same bytes nor pin disagreement
  // alone means that the covered text changed.
  const repositoryFacts = (manifest) => [...entriesByPath(manifest).values(), ...(manifest?.workflowSource ? [{ ...manifest.workflowSource, path: null }] : [])]
    .flatMap((entry) => (entry.repositories ?? []).map((repository) => ({ ...repository, source: entry.path })))
    .sort((a, b) => byCodeUnit(JSON.stringify([a.source, a.path]), JSON.stringify([b.source, b.path])));
  result.repositories = repositoryFacts(current);
  const oldRepositories = new Map(repositoryFacts(previous).map((entry) => [JSON.stringify([entry.source, entry.path]), entry]));
  const newRepositories = new Map(result.repositories.map((entry) => [JSON.stringify([entry.source, entry.path]), entry]));
  result.repositoryChanges = [...new Set([...oldRepositories.keys(), ...newRepositories.keys()])].sort(byCodeUnit)
    .filter((key) => !sameRepositoryFacts(oldRepositories.get(key), newRepositories.get(key)))
    .map((key) => ({ before: oldRepositories.get(key) ?? null, after: newRepositories.get(key) ?? null }));
  result.current = result.complete && !result.changed.length && !result.missing.length && !result.added.length && !result.workflowSourceChanged;
  return result;
}

/** Compare declared revision/pin facts, preserving but ignoring additive fields. */
function sameRepositoryFacts(before, after) {
  if (!before || !after) return before === after;
  return ['source', 'path', 'kind', 'head', 'indexPin', 'headPin', 'indexPinMatchesChild', 'headPinMatchesChild']
    .every((key) => isDeepStrictEqual(before[key], after[key]));
}

/**
 * Identity of the workflow source: its commit and branch when it is a Git
 * checkout, Git-reported instruction-scope status paths in `dirty` (a rename
 * is reported as its two paths), and a content digest of the
 * instruction parts. `digestScope` names what the digest covers: for a Git
 * checkout the Git-visible files under the parts (tracked, and untracked but
 * not ignored, so incidental ignored files do not change it); for a copied
 * source every regular file under them. Entries are ordered by code unit,
 * so the digest does not depend on the computing process's locale.
 * Under access failure `dirty` is unverified and potentially incomplete:
 * inaccessible content is established neither edited nor unchanged, including
 * members of a denied directory; empty or absent status does not prove clean.
 */
export function workflowSourceIdentity(sourceRoot) {
  let root = path.resolve(sourceRoot);
  let head = null;
  let branch = null;
  let dirty = null;
  let gitVisible = false;
  const repositories = [];
  try {
    root = readSource(root, () => canonical(root));
    if (root === null) throw new Error(`workflow source ${sourceRoot} does not exist`);
    const run = gitIn(root);
    let top = null;
    try {
      [top] = gitPaths(['--show-toplevel'], { cwd: root });
    } catch (error) {
      // Only a non-repository selects the copied-source policy. Other Git
      // failures must not silently broaden the content scope.
      if (!error.message.startsWith('git rev-parse failed: fatal: not a git repository')) throw error;
    }
    gitVisible = top !== null && readSource(top, () => canonical(top)) === root;
    if (gitVisible) {
      head = run(['rev-parse', '-q', '--verify', 'HEAD'], { allowMissing: true })?.trim() ?? null;
      branch = run(['symbolic-ref', '-q', '--short', 'HEAD'], { allowMissing: true })?.trim() ?? null;
      dirty = run(['status', '--porcelain', '-z', '--no-renames', '--', ...SOURCE_PARTS]).split('\0').filter(Boolean).map((record) => record.slice(3));
      const entries = gitMemberEntries(root, SOURCE_PARTS, (full) => sha256(readSource(full, () => fs.readFileSync(full))), { omitMissing: true, repositories });
      return { path: root, head, branch, dirty, ...(repositories.length ? { repositories } : {}), digestScope: 'git-visible', files: entries.length, digest: sha256(entries.join('')) };
    }
    const files = SOURCE_PARTS.flatMap((part) => {
      const full = path.join(root, part);
      if (isGitAdministrativeContent(full)) return [];
      const stat = memberStat(full);
      if (!stat) return [];
      return stat.isDirectory() ? regularFiles(full).map((file) => `${part}/${file}`) : [part];
    }).sort(byCodeUnit);
    return { path: root, head, branch, dirty, digestScope: 'all-files', files: files.length, digest: digestFiles(root, files) };
  } catch (error) {
    return { path: root ?? path.resolve(sourceRoot), head, branch, dirty, ...(repositories.length ? { repositories } : {}), digestScope: gitVisible ? 'git-visible' : 'all-files', ...incompleteIdentity(error, root ?? path.resolve(sourceRoot)) };
  }
}

/** SHA-256 of a file's content, or of a directory's file names and contents. */
function contentDigest(target) {
  return readSource(target, () => fs.statSync(target)).isDirectory() ? externalTreeDigest(target) : sha256(readSource(target, () => fs.readFileSync(target)));
}

function toPosix(relative) {
  return relative.split(path.sep).join('/');
}

function sha256(content) {
  return `sha256:${crypto.createHash('sha256').update(content).digest('hex')}`;
}
