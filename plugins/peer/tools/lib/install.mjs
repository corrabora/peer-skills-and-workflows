// Installation of the package's skills into each engine's personal skill
// directory as links to this checkout, and the checks that the package's
// documents and installed links resolve. Link also repairs dangling links to
// the same skills in a former checkout; unlink removes only this checkout's links.

import fs from 'node:fs';
import path from 'node:path';
import { linesOutsideFences } from './markdown.mjs';
import { canonical, isWithin, pathFor } from './paths.mjs';
import { WRITING_REFERENCES, referenceProblem, REGENERATE_REFERENCES } from './writing-references.mjs';

export const ROLE_SKILLS = ['plan-coordinator', 'plan-responsible-party', 'plan-reviewer', 'review-adjudicator'];
// Binding and on-demand peer skills are entry points, not worker-profile roles.
// Installing them with the supervised roles does not require their callers to
// enter the plan workflow.
export const WORKFLOW_SKILLS = ['bind-agent-workflow', ...ROLE_SKILLS, 'peer-review', 'peer-decision-making', 'peer-implementation', 'successor'];
export const WRITING_SKILLS = ['clarify-artifact', 'write-for-humans', 'write-for-agents', 'maintain-glossary', 'record-decision', 'write-issue', 'write-pr'];
/** The published ADR and glossary formats and their adoption rules, in `docs/guidance/`, read by the vocabulary and decision skills. */
export const RECORD_FORMATS = ['adr-format.md', 'glossary-format.md', 'record-format-adoption.md'];

/**
 * The installable skill sets, each with the package files the set needs,
 * checked through each installed skill's link, relative to the package root. A
 * set is installed and checked with its dependencies. Removal covers only
 * the explicitly selected sets, leaving independently useful dependencies.
 *
 * `link`, `unlink` and `checkLinks` take `sets` as an array of these names
 * and select every set when it is omitted. An unknown name makes them throw
 * when they process their first scope, before any skill link is created,
 * removed or checked; `link` may already have created that scope's directory.
 */
export const SKILL_SETS = {
  workflow: {
    skills: WORKFLOW_SKILLS,
    dependencies: ['writing'],
    references: [
      ['workflow', 'PROCESS.md'], ['workflow', 'ORCA.md'], ['workflow', 'RECORDS.md'], ['workflow', 'BINDING.md'], ['workflow', 'templates', 'binding.md'],
      ['defaults.yaml'], ['tools', 'resolve.mjs'], ['tools', 'bind.mjs'],
      ['tools', 'peer-records.mjs'], ['tools', 'lib', 'peer-records.mjs'],
      ['tools', 'lib', 'paths.mjs'], ['tools', 'lib', 'cli.mjs'],
      ['tools', 'lib', 'bind.mjs'], ['tools', 'lib', 'git.mjs'],
      ['package.json'],
      ['tools', 'successor.mjs'], ['tools', 'lib', 'successor.mjs'],
      ['tools', 'lib', 'successor-instructions.mjs'],
      ['tools', 'lib', 'successor-recovery.mjs'],
      ['tools', 'succession.mjs'], ['tools', 'lib', 'succession.mjs'],
      ['skills', 'successor', 'references', 'mechanics.md'],
      ['skills', 'successor', 'references', 'coordinator.md'],
      ['skills', 'successor', 'references', 'recovery.md'],
    ],
  },
  writing: {
    skills: WRITING_SKILLS,
    references: [
      ['docs', 'writing-guidance.md'],
      ...RECORD_FORMATS.map((file) => ['docs', 'guidance', file]),
      ...WRITING_SKILLS.map((skill) => ['skills', skill, 'SKILL.md']),
    ],
  },
};

/** Every skill the installer manages, in installation order. */
export const PACKAGE_SKILLS = Object.values(SKILL_SETS).flatMap((set) => set.skills);

/** Resolve selected sets once, optionally including their dependencies. */
function selectedSets(sets = Object.keys(SKILL_SETS), dependencies = true) {
  const names = new Set();
  function add(name) {
    // An own-property test, so that inherited names such as `constructor` are unknown too.
    if (!Object.hasOwn(SKILL_SETS, name)) throw new Error(`unknown skill set '${name}'; the sets are ${Object.keys(SKILL_SETS).join(', ')}`);
    if (names.has(name)) return;
    names.add(name);
    if (dependencies) for (const dependency of SKILL_SETS[name].dependencies ?? []) add(dependency);
  }
  for (const name of sets) add(name);
  return [...names];
}

/** The selected skills, with their owning set and shared references. */
function selected(sets, dependencies = true) {
  return selectedSets(sets, dependencies).flatMap((name) => {
    const set = SKILL_SETS[name];
    return set.skills.map((skill) => ({ set: name, skill, references: set.references }));
  });
}

/** Directory symlink on POSIX; junction on Windows, which needs no special privilege. */
function linkType(platform) {
  return platform === 'win32' ? 'junction' : 'dir';
}

// Only Windows treats a backslash as a separator or knows the `\\?\` prefix; on
// POSIX a backslash is an ordinary file-name character, so a name ending in one
// is a different entry.
function comparable(target, platform) {
  if (platform !== 'win32') return target.length > 1 ? target.replace(/\/+$/, '') : target;
  let value = target.replace(/^\\\\\?\\/, '');
  value = value.length > 1 ? value.replace(/[\\/]+$/, '') : value;
  return value.toLowerCase();
}

/**
 * True when link text `linkText`, read from a link in `linkDir`, names
 * `expected` under `platform` path rules: resolved against the link's
 * directory, without trailing separators, and on Windows also without a `\\?\`
 * prefix and case-insensitively. Pure; exported for tests, not a stable API.
 */
export function sameLinkTarget(linkDir, linkText, expected, platform) {
  const literal = pathFor(platform).resolve(linkDir, linkText);
  return comparable(literal, platform) === comparable(expected, platform);
}

/** True when `dest` is a link (or junction) to `expected` in this checkout. */
export function isOwnedLink(dest, expected, platform = process.platform) {
  let stat;
  try {
    stat = fs.lstatSync(dest);
  } catch {
    return false;
  }
  if (!stat.isSymbolicLink()) return false;
  if (sameLinkTarget(path.dirname(dest), fs.readlinkSync(dest), expected, platform)) return true;
  try {
    const resolved = canonical(dest);
    return resolved !== null && resolved === canonical(expected);
  } catch {
    return false; // a link that cannot be resolved (for example a loop) is not this checkout's
  }
}

/** True for the errors that show a path does not exist, as opposed to failing to resolve it. */
function absent(error) {
  return error.code === 'ENOENT' || error.code === 'ENOTDIR';
}

/** A dangling link to skills/<skill>, as left by a moved or deleted checkout. */
function staleSkillLink(dest, skill, platform) {
  try {
    if (!fs.lstatSync(dest).isSymbolicLink()) return false;
    const p = pathFor(platform);
    const target = p.resolve(p.dirname(dest), fs.readlinkSync(dest));
    if (comparable(p.basename(target), platform) !== comparable(skill, platform)
        || comparable(p.basename(p.dirname(target)), platform) !== 'skills') return false;
    try {
      fs.statSync(dest);
      return false;
    } catch (error) {
      return absent(error);
    }
  } catch {
    return false; // inaccessible links and loops are not evidence of a missing target
  }
}

/**
 * Why `dest`, which is not this checkout's link, is left alone, or null when
 * nothing is there. An entry that cannot be inspected is reported with its
 * error code as occupied: it may be anything, including this checkout's link,
 * so it is neither replaced nor taken as absent.
 */
function occupant(dest) {
  try {
    fs.lstatSync(dest);
  } catch (error) {
    if (absent(error)) return null;
    return `an entry that cannot be inspected (${error.code}), so whether it is this checkout's link is unknown`;
  }
  return `${describeOccupant(dest)}, not this checkout's link`;
}

/**
 * What occupies `dest`, for messages: a file, a directory, or a link and its
 * target. Lookup failures become part of the description with their error
 * code, so one entry that cannot be inspected never stops the rest of a run.
 */
function describeOccupant(dest) {
  let stat;
  try {
    stat = fs.lstatSync(dest);
  } catch (error) {
    return absent(error) ? 'nothing' : `an entry that cannot be inspected (${error.code})`;
  }
  if (stat.isSymbolicLink()) {
    let target;
    try {
      target = fs.readlinkSync(dest);
    } catch (error) {
      return `a link whose target cannot be read (${error.code})`;
    }
    try {
      fs.statSync(dest);
      return `a link to ${target}`;
    } catch (error) {
      return absent(error)
        ? `a link to ${target}, which does not exist`
        : `a link to ${target}, which cannot be resolved (${error.code})`;
    }
  }
  if (stat.isDirectory()) return 'a directory';
  if (stat.isFile()) return 'a file';
  return 'another kind of entry';
}

/**
 * The CLI command for `verb` over the selected sets, as the user would type
 * it: without a set name when `sets` is omitted, otherwise one command per
 * named set. Callers expand dependencies when the advised operation needs them.
 */
function command(verb, sets) {
  const names = sets === undefined ? [''] : sets.map((name) => ` ${name}`);
  return names.map((name) => `\`node tools/install.mjs ${verb}${name}\``).join(' and ');
}

/** Recovery advice for destinations left alone, scoped to the selected sets. */
function occupiedHelp(sets) {
  return 'help    The installer never changes entries it does not own or cannot inspect, except that link repairs dangling links to the same skills/<name> in a former checkout. Inspect each '
    + 'one above: restore access to one that cannot be inspected; if one is stale, remove it yourself, or run '
    + `${command('unlink', sets === undefined ? undefined : selectedSets(sets))} from the checkout it links to while that checkout still exists. Then run `
    + `${command('link', sets)} again.`;
}

/** `a`, `a and b`, or `a, b and c`. */
function listed(items) {
  return items.length < 3 ? items.join(' and ') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}

/**
 * Recovery when a check over several sets finds no skill of `set` in
 * the scopes `dirs`, while every skill of each `present` set is this
 * checkout's link there: install the absent set too, or check only the
 * installed sets when they do not depend on it. The check still fails for the
 * absent set; the scopes are named because another scope may be in a different
 * state. Installed means every link is in place, not that each one resolves or reaches its files;
 * those failures have their own lines, and checking an installed set alone
 * still reports them.
 */
function absentSetHelp({ set, present, dirs }) {
  const several = present.length > 1;
  const installed = `the ${listed(present)} set${several ? 's' : ''}`;
  const dependents = present.filter((name) => selectedSets([name]).includes(set));
  if (dependents.length) {
    return `help    The ${listed(dependents)} set requires the absent ${set} set in ${listed(dirs)}; run ${command('link', [set])} from this checkout. Checking ${listed(dependents)} alone also checks this dependency.`;
  }
  return `help    No skill of the ${set} set is installed in ${listed(dirs)}, where ${installed} ${several ? 'are' : 'is'}. `
    + `To install it too, run ${command('link', [set])}; if only ${installed} ${several ? 'were' : 'was'} intended, run `
    + `${command('check', present)} to check ${several ? 'those sets' : 'that set'} alone.`;
}

/**
 * Why `file`, which an installed skill reads through its link and calls
 * `name`, is not a readable regular file for this process: `missing` when it
 * does not exist, otherwise the cause for the check's message, or null when
 * it is usable. Links on the way are followed, so a linked file passes. The
 * check is structural: it says nothing about what an engine permits a session
 * to read, about the file's content, or about changes after the check.
 */
function unusable(file, name) {
  let stat;
  try {
    stat = fs.statSync(file);
  } catch (error) {
    return absent(error) ? 'missing' : `cannot resolve ${name} (${error.code})`;
  }
  if (!stat.isFile()) return `finds ${stat.isDirectory() ? 'a directory' : 'another kind of entry'}, not a regular file, at ${name}`;
  try {
    fs.accessSync(file, fs.constants.R_OK);
  } catch (error) {
    return `cannot read ${name} (${error.code})`;
  }
  return null;
}

/**
 * Remove a link or junction at `dest` without touching its target. Windows
 * reports EPERM or EISDIR when unlinking a directory link or junction and
 * removes it with rmdir instead; any other failure is rethrown. `ops` stands
 * in for the filesystem in tests. Exported for tests, not a stable API.
 */
export function removeLink(dest, platform, ops = fs) {
  try {
    ops.unlinkSync(dest);
  } catch (error) {
    if (platform === 'win32' && (error.code === 'EPERM' || error.code === 'EISDIR')) ops.rmdirSync(dest);
    else throw error;
  }
}

/**
 * Link each skill of the selected sets into every scope, creating scope
 * directories as needed. Existing links into this checkout are kept; dangling
 * links to the same skill in a former checkout are repaired. Anything else
 * at a destination, including an entry that cannot be inspected, is
 * reported and skipped. Returns false when any destination was skipped. Other
 * filesystem errors throw. `SKILL_SETS` describes `sets` and its unknown-name
 * throw.
 */
export function link({ sourceRoot, scopes, sets, platform = process.platform, out }) {
  let ok = true;
  for (const { dir } of scopes) {
    fs.mkdirSync(dir, { recursive: true });
    for (const { skill } of selected(sets)) {
      const dest = path.join(dir, skill);
      const expected = path.join(sourceRoot, 'skills', skill);
      if (isOwnedLink(dest, expected, platform)) {
        out.info(`ok      ${dest}`);
        continue;
      }
      if (staleSkillLink(dest, skill, platform)) {
        const problem = unusable(path.join(expected, 'SKILL.md'), 'SKILL.md');
        if (problem) {
          out.error(`skipped ${dest}: replacement ${expected}: ${problem}`);
          ok = false;
          continue;
        }
        removeLink(dest, platform);
        fs.symlinkSync(expected, dest, linkType(platform));
        out.info(`relinked ${dest} -> ${expected} (previous target missing)`);
        continue;
      }
      const found = occupant(dest);
      if (found) {
        out.error(`skipped ${dest}: ${found}`);
        ok = false;
      } else {
        fs.symlinkSync(expected, dest, linkType(platform));
        out.info(`linked  ${dest}`);
      }
    }
  }
  if (!ok) out.error(occupiedHelp(sets));
  return ok;
}

/**
 * Remove every link of the selected sets into this checkout. Other entries at
 * skill destinations, including entries that cannot be inspected, are reported
 * and kept. Returns true on normal completion, even when entries were kept;
 * other filesystem errors throw. `SKILL_SETS` describes `sets` and its
 * unknown-name throw.
 */
export function unlink({ sourceRoot, scopes, sets, platform = process.platform, out }) {
  for (const { dir } of scopes) {
    for (const { skill } of selected(sets, false)) {
      const dest = path.join(dir, skill);
      if (isOwnedLink(dest, path.join(sourceRoot, 'skills', skill), platform)) {
        removeLink(dest, platform);
        out.info(`removed ${dest}`);
        continue;
      }
      const found = occupant(dest);
      if (found) out.error(`kept    ${dest}: ${found}`);
    }
  }
  return true;
}

/**
 * Check that each skill of the selected sets is installed in every scope as a
 * link into this checkout that resolves, and that the files it reads through
 * that link, its own SKILL.md and its set's shared references, are readable
 * regular files there for this process (links followed). A missing, wrong-kind,
 * unreadable or unresolvable file is named with its cause. Returns false when
 * any destination fails. When several sets are checked and a scope holds no
 * skill of one set while every skill of another is this checkout's link there,
 * the failure is followed by help naming the absent set, that scope and the
 * recovery: link the absent set, or check only an independent installed set. A
 * partly linked set with only absent destinations gets scoped relink advice;
 * it is never offered as fully installed. Occupied destinations retain their
 * separate recovery advice. Missing skills still fail one by one. `SKILL_SETS`
 * describes `sets` and its unknown-name throw.
 */
export function checkLinks({ sourceRoot, scopes, sets, platform = process.platform, out }) {
  let ok = true;
  let foreign = false;
  const helpGroups = new Map(); // absent set and the sets wholly linked beside it -> the scopes in that state
  const partialGroups = new Map(); // missing-only partial set -> affected scopes
  for (const { dir } of scopes) {
    const tally = {}; // set -> how many of its skills are missing from, or this checkout's links in, this scope
    for (const { set, skill, references } of selected(sets)) {
      const counts = tally[set] ??= { nothing: 0, owned: 0, total: 0 };
      counts.total += 1;
      const dest = path.join(dir, skill);
      const expected = path.join(sourceRoot, 'skills', skill);
      if (!isOwnedLink(dest, expected, platform)) {
        const found = describeOccupant(dest);
        out.error(`FAIL    ${dest} is not linked to ${expected} (found ${found})`);
        if (found === 'nothing') counts.nothing += 1;
        else foreign = true;
        ok = false;
        continue;
      }
      counts.owned += 1;
      let real;
      try {
        real = canonical(dest);
      } catch (error) {
        out.error(`FAIL    ${dest}: ${error.message}`);
        ok = false;
        continue;
      }
      if (real === null) {
        out.error(`FAIL    ${dest} links to ${expected}, which does not exist`);
        ok = false;
        continue;
      }
      const missing = [];
      const problems = [];
      for (const parts of [['SKILL.md'], ...references.map((parts) => ['..', '..', ...parts])]) {
        const name = path.join(...parts);
        const why = unusable(path.join(real, ...parts), name);
        if (why === 'missing') missing.push(name);
        else if (why !== null) problems.push(why);
      }
      if (missing.length) problems.unshift(`cannot reach ${missing.join(', ')}`);
      if (problems.length === 0) {
        for (const reference of WRITING_REFERENCES.filter((entry) => entry.skill === skill)) {
          const local = path.join('references', reference.name);
          const problem = referenceProblem(sourceRoot, reference, path.join(dest, local));
          if (problem) problems.push(`${local}: ${problem}; run ${REGENERATE_REFERENCES}`);
        }
      }
      if (problems.length === 0) {
        out.info(`ok      ${dest} -> ${real} (SKILL.md and shared references readable)`);
      } else {
        out.error(`FAIL    ${dest} resolves to ${real}, which ${problems.join('; ')}`);
        ok = false;
      }
    }
    const present = Object.keys(tally).filter((set) => tally[set].owned === tally[set].total);
    for (const set of Object.keys(tally)) {
      const counts = tally[set];
      if (counts.owned > 0 && counts.nothing > 0 && counts.owned + counts.nothing === counts.total) {
        if (!partialGroups.has(set)) partialGroups.set(set, []);
        partialGroups.get(set).push(dir);
      }
      if (tally[set].nothing !== tally[set].total || present.length === 0) continue;
      const key = [set, ...present].join(' ');
      if (!helpGroups.has(key)) helpGroups.set(key, { set, present, dirs: [] });
      helpGroups.get(key).dirs.push(dir);
    }
  }
  for (const group of helpGroups.values()) out.error(absentSetHelp(group));
  for (const [set, dirs] of partialGroups) {
    out.error(`help    The ${set} set is partly linked in ${listed(dirs)}; run ${command('link', [set])} from this checkout to add the missing links.`);
  }
  if (foreign) out.error(occupiedHelp(sets));
  return ok;
}

/** Maintained package documents whose links must resolve inside the package. */
export function packageDocuments(sourceRoot) {
  const files = ['README.md'].map((name) => path.join(sourceRoot, name)).filter((f) => fs.existsSync(f));
  for (const dir of ['docs', 'skills', 'workflow']) {
    if (!fs.existsSync(path.join(sourceRoot, dir))) continue;
    const walk = (current) => {
      for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.isFile() && entry.name.endsWith('.md')) files.push(full);
      }
    };
    walk(path.join(sourceRoot, dir));
  }
  return files;
}

const INLINE_LINK = /\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const NAMED_PATH = /`((?:workflow|tools|skills)\/[^`\s]*|defaults\.yaml)`/g;
const SCHEME = /^[A-Za-z][A-Za-z0-9+.-]+:/;

/** Relative link targets and backticked package paths outside fenced blocks. */
export function referencesIn(text) {
  const links = [];
  const named = [];
  for (const { line, number } of linesOutsideFences(text)) {
    for (const match of line.matchAll(INLINE_LINK)) links.push({ target: match[1], line: number });
    for (const match of line.matchAll(NAMED_PATH)) named.push({ target: match[1], line: number });
  }
  return { links, named };
}

/**
 * Every relative link must name an existing file whose canonical path, with
 * symlinks resolved, lies inside the canonical package root. Backticked
 * package paths must also exist inside the package.
 */
export function checkReferences({ sourceRoot, files = packageDocuments(sourceRoot), out }) {
  const root = canonical(sourceRoot);
  let ok = true;
  const fail = (file, line, message) => {
    out.error(`FAIL    ${path.relative(sourceRoot, file)}:${line}: ${message}`);
    ok = false;
  };
  const contained = (file, line, base, target, label) => {
    let decoded;
    try {
      decoded = decodeURIComponent(target);
    } catch {
      fail(file, line, `${label} ${target} is not a valid URI path`);
      return;
    }
    if (path.isAbsolute(decoded) || /^([A-Za-z]:|[\\/])/.test(decoded)) {
      fail(file, line, `${label} ${target} is absolute; use a path relative to the document`);
      return;
    }
    let resolved;
    try {
      resolved = canonical(path.resolve(base, decoded));
    } catch (error) {
      fail(file, line, `${label} ${target} cannot be resolved (${error.code ?? error.message})`);
      return;
    }
    if (resolved === null) fail(file, line, `missing ${label} ${target}`);
    else if (!isWithin(root, resolved)) fail(file, line, `${label} ${target} resolves outside the package to ${resolved}`);
  };
  for (const file of files) {
    const { links, named } = referencesIn(fs.readFileSync(file, 'utf8'));
    for (const { target, line } of links) {
      if (target.startsWith('#') || target.startsWith('<')) continue;
      if (SCHEME.test(target)) continue; // URLs; a one-letter drive prefix is not a scheme
      const pathPart = target.replace(/[#?].*$/, '');
      if (!pathPart) continue;
      contained(file, line, path.dirname(file), pathPart, 'link target');
    }
    for (const { target, line } of named) {
      if (/[<>*]/.test(target)) continue;
      contained(file, line, sourceRoot, target, 'named path');
    }
  }
  if (ok) out.info(`ok      all relative links and named package paths resolve inside ${root}`);
  return ok;
}
