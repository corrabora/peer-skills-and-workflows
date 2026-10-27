// Deterministic inspection of one attempt: which files the engine created,
// changed or deleted; which skill bodies it read, invoked, searched or merely
// listed; how the final reply looks; and the pass, fail or premise-not-met
// verdict on the case's deterministic expectations. Semantic criteria are not
// decided here; they need a grader (see report.mjs).
//
// A skill counts as read only on positive evidence: a `Read` tool call whose
// path is that skill's SKILL.md, a `Skill` tool invocation naming it, or a
// shell command whose returned output contains the skill's body (its
// frontmatter `name:` line together with its first heading). What a command
// names in its arguments decides only the weaker records, `partial` and
// `listing`, and a path that appears only in an exclusion (`-g '!...'`,
// `--exclude`, `:!pathspec` and the like) never counts for anything.
//
// A source file named by a case's `sourceReads` (a shared reference such as
// docs/writing-guidance.md) counts as read on the same kind of evidence: a
// `Read` whose path ends with the file's source-relative path, through an
// installed skill link or the materialized source alike, and whose recorded
// output shows the file (its first and last non-empty lines, taken from the
// materialized source), or a shell command whose output shows it. A read
// that returned an error or only part of the file is `partial`; the outputs
// of several partial reads are judged together, so a file read in chunks
// still counts. A skill may carry its own copy of a source file as
// `skills/<skill>/references/<basename>` (a regular file in the materialized
// source whose body, after an optional generated-from header line, equals
// the canonical file's, or equals it after the link rewrites the generator
// registers for that copy in tools/lib/writing-references.mjs); a read of
// that copy, through the installed link or the materialized source, counts
// like a read of the canonical path and is recorded as `skill-local` with
// the skill. A copy whose body differs is a `stale-alias`: a read of it is
// recorded and never counts. A source path whose rule is `observed` is
// classified and recorded like the others but yields no check. An `edits`
// expectation confines an engine's change to one passage: the bytes before
// and after it must equal the fixture's. A `writes` entry may carry `*`
// within one path segment, so a case can require a file whose number or
// slug the engine chooses.
//
// The final reply's claims about files are checked against what the engine
// actually wrote (`claimedArtifacts`, on for every case unless it says
// otherwise): a path-like token in a sentence of the final reply whose verb
// says it was written, saved, created, updated, added, put or placed (or a
// location line, "is at" / "is in") must name a file the attempt created or
// modified, or at least one that exists; a claimed path with no such file
// fails the attempt. Detection is conservative: a question, or a negation
// before the path, is never a claim, a claim verb governs only the paths in
// its own clause and claims only when that clause's subject is the author,
// absent (a receipt's bare verb) or the thing produced in the passive (what
// the assistant, the recipient or a step of the brief does is no claim), and
// a path that exists never fails.

import fs from 'node:fs';
import path from 'node:path';
import { manifestOf } from './common.mjs';
import { WRITING_REFERENCES } from '../../../tools/lib/writing-references.mjs';

export const WORKSPACE_SKIP = ['.git', '.claude', '.agents'];

/** Identity of the classification rule, recorded in every inspection so a report can say which classifier judged a cell. */
export const CLASSIFIER = {
  version: 9,
  rule: 'body: Read of the skill\'s SKILL.md, a Skill invocation, or a shell command whose returned output contains the skill\'s frontmatter name line and first heading; arguments decide only partial and listing; exclusion globs and pathspecs never count',
  sourceReadRule: 'a source file is read when a Read whose path ends with its source-relative path or with a declared skill-local alias of it (skills/<skill>/references/<basename>), or any shell command, returned output showing the canonical file\'s first and last non-empty lines; partial outputs are judged together; a path named without such output is partial or listing',
  sourceAliasRule: 'an alias of a source file is a regular file skills/<skill>/references/<basename> in the materialized source whose body, after an optional header line, equals the canonical body, or equals the canonical body after the Markdown link rewrites the generator registers for that copy (tools/lib/writing-references.mjs), the rewrites that made the match recorded; a read of an alias whose body differs otherwise is stale-alias and never counts',
  writeRule: 'a writes.allowed or writes.required entry matches a workspace path literally, or as a pattern when it carries `*`, which matches any run of characters other than a slash within its segment',
  editRule: 'an edit is confined to a passage when the bytes before its `after` marker line and from its `before` marker line onward equal the fixture\'s',
  claimRule: 'a path-like token (a slash and a file extension, or a .md, .txt, .json or .csv name) in a statement of the final reply whose verb is wrote, written, saved, created, updated, added, put or placed, or that locates it with "is at" or "is in", is a claimed artifact unless a negation or a modal precedes it or the sentence is a question; a claim verb governs only the paths in its own clause (clauses end at a semicolon, at a colon once the clause names a path or a subject pronoun follows, before a connector that introduces a new subject or a modal, and before a subordinator such as before, after, once, if or when, whose clause ends at the next comma) and claims only when its clause\'s subject is the author (I, we), absent (a receipt\'s bare verb or a "written:" label) or the thing produced in the passive (is, was, has been); a clause whose subject is anyone or anything else, such as the assistant, the recipient or a step of the brief, never claims; Markdown destinations retain encoded spaces, Unicode and parentheses in directory and file names; bare and code-span paths containing whitespace remain heuristically tokenized; a claimed path fails only when no created, modified or existing file matches it',
};
/** The classifier that produced an inspection carrying no `classifier` record (the runner before version 2). */
export const CLASSIFIER_BEFORE_RECORDS = {
  version: 1,
  rule: 'body: a reading verb in the command text with a path or wildcard naming the skill or every skill, exclusions included',
};

const SEARCH_VERBS = new Set(['rg', 'grep', 'egrep', 'fgrep', 'ag', 'ack', 'Select-String', 'git-grep']);
const SHELLS = new Set(['sh', 'bash', 'zsh', 'dash', 'ksh', 'fish']);
const WRAPPERS = new Set(['sudo', 'env', 'command', 'time', 'nice', 'exec', 'nohup', 'timeout']);
const OPERATORS = new Set([';', '|', '&', '(', ')', '\n']);

/**
 * Split shell text into words and operators the way a POSIX shell would read
 * it: single quotes literal, double quotes with backslash escapes, backslash
 * escapes outside quotes, and `;`, `|`, `&`, `(`, `)` and newlines as
 * operators. Returns `{ word }` and `{ op }` tokens in order.
 */
export function shellTokens(text) {
  const tokens = [];
  let word = null;
  const push = () => { if (word !== null) tokens.push({ word }); word = null; };
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === "'") {
      const end = text.indexOf("'", i + 1);
      word = (word ?? '') + text.slice(i + 1, end < 0 ? text.length : end);
      i = end < 0 ? text.length : end + 1;
    } else if (ch === '"') {
      let j = i + 1;
      let value = '';
      while (j < text.length && text[j] !== '"') {
        if (text[j] === '\\' && j + 1 < text.length && '"\\$`'.includes(text[j + 1])) { value += text[j + 1]; j += 2; } else { value += text[j]; j += 1; }
      }
      word = (word ?? '') + value;
      i = j + 1;
    } else if (ch === '\\') {
      if (i + 1 < text.length) word = (word ?? '') + text[i + 1];
      i += 2;
    } else if (/\s/.test(ch) && ch !== '\n') {
      push();
      i += 1;
    } else if (OPERATORS.has(ch)) {
      push();
      const two = text.slice(i, i + 2);
      if (two === '&&' || two === '||') { tokens.push({ op: two }); i += 2; } else { tokens.push({ op: ch }); i += 1; }
    } else {
      word = (word ?? '') + ch;
      i += 1;
    }
  }
  push();
  return tokens;
}

/**
 * The simple commands of shell text, each as its words, with a shell wrapper
 * such as `/bin/zsh -lc "<script>"` unwrapped and leading variable
 * assignments and command wrappers (`env`, `sudo`, `time`) dropped.
 */
export function simpleCommands(text) {
  const tokens = shellTokens(text);
  const words = tokens.filter((token) => token.word !== undefined).map((token) => token.word);
  if (words.length >= 3 && SHELLS.has(path.basename(words[0])) && /^-[a-zA-Z]*c[a-zA-Z]*$/.test(words[1])) return simpleCommands(words[2]);
  const commands = [];
  let current = [];
  for (const token of tokens) {
    if (token.op !== undefined) { if (current.length) commands.push(current); current = []; } else current.push(token.word);
  }
  if (current.length) commands.push(current);
  return commands.map((command) => {
    let start = 0;
    while (start < command.length && (/^[A-Za-z_][A-Za-z0-9_]*=/.test(command[start]) || WRAPPERS.has(path.basename(command[start])))) start += 1;
    return command.slice(start);
  }).filter((command) => command.length > 0);
}

// Options whose value excludes paths from a search or listing, whatever the value.
const EXCLUDING_OPTIONS = /^--?(exclude(-dir|-from|-per-directory|-standard)?|ignore(-dir|-file)?|type-not|T|prune-path)$/;
// Options whose value is a glob: positive unless it begins with `!`.
const GLOB_OPTIONS = new Set(['-g', '--glob', '--iglob', '--glob-case-insensitive']);
// find(1) tests whose value names a path.
const FIND_PATH_TESTS = new Set(['-path', '-ipath', '-wholename', '-iwholename', '-name', '-iname', '-regex', '-iregex']);

/**
 * The positive path arguments of one simple command (its words after the
 * verb), and the arguments that only exclude. An exclusion is a `-g`,
 * `--glob` or `--iglob` value beginning with `!`, any `--exclude*`,
 * `--ignore*` or `--type-not` value, a `find` test negated with `-not` or
 * `!` or followed by `-prune`, a Git pathspec `:!…`, `:^…` or
 * `:(exclude)…`, or any word beginning with `!`.
 */
export function pathArguments(words) {
  const positive = [];
  const excluded = [];
  const args = words.slice(1);
  for (let i = 0; i < args.length; i += 1) {
    const word = args[i];
    const equals = word.indexOf('=');
    const option = word.startsWith('-') && equals > 0 ? word.slice(0, equals) : word;
    const inlineValue = word.startsWith('-') && equals > 0 ? word.slice(equals + 1) : undefined;
    if (GLOB_OPTIONS.has(option)) {
      const value = inlineValue ?? args[i + 1];
      if (inlineValue === undefined) i += 1;
      if (value === undefined) continue;
      if (value.startsWith('!')) excluded.push(value); else positive.push(value);
      continue;
    }
    if (EXCLUDING_OPTIONS.test(option)) {
      const value = inlineValue ?? args[i + 1];
      if (inlineValue === undefined) i += 1;
      if (value !== undefined) excluded.push(value);
      continue;
    }
    if ((word === '-not' || word === '!') && FIND_PATH_TESTS.has(args[i + 1] ?? '') && args[i + 2] !== undefined) {
      excluded.push(args[i + 2]);
      i += 2;
      continue;
    }
    if (FIND_PATH_TESTS.has(word) && args[i + 1] !== undefined) {
      if (args[i + 2] === '-prune') { excluded.push(args[i + 1]); i += 2; } else { positive.push(args[i + 1]); i += 1; }
      continue;
    }
    if (/^:(!|\^|\(exclude[,)])/.test(word) || word.startsWith('!')) { excluded.push(word); continue; }
    if (word.startsWith('-') && word !== '-') continue;
    positive.push(word);
  }
  return { positive, excluded };
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * The distinctive signature of one SKILL.md: its frontmatter `name:` line
 * and its first heading, or null when the file is missing. Either part may
 * be null when the file lacks it.
 */
export function skillSignature(skillFile) {
  if (!fs.existsSync(skillFile)) return null;
  const lines = fs.readFileSync(skillFile, 'utf8').split(/\r?\n/);
  let name = null;
  let heading = null;
  let index = 0;
  if (lines[0]?.trim() === '---') {
    index = 1;
    while (index < lines.length && lines[index].trim() !== '---') {
      const match = /^name:\s*(.+?)\s*$/.exec(lines[index]);
      if (match && name === null) name = match[1];
      index += 1;
    }
    index += 1;
  }
  for (; index < lines.length; index += 1) {
    const match = /^#{1,6}\s+(\S.*?)\s*$/.exec(lines[index]);
    if (match) { heading = match[1]; break; }
  }
  return { name, heading };
}

/** Signatures of every skill under `sourceRoot/skills/<skill>/SKILL.md`. */
export function skillSignatures(sourceRoot, skills) {
  return Object.fromEntries(skills.map((skill) => [skill, skillSignature(path.join(sourceRoot, 'skills', skill, 'SKILL.md'))]));
}

// A line of output, allowing the line-number prefix `cat -n` or an engine's
// file reader puts before it (a number followed by whitespace or an arrow).
const LINE_PREFIX = '(^|\\n)[ \\t]*(\\d+[ \\t→]+)?';

/** True when `output` shows the skill's body: its name line and, when the file has one, its first heading. */
export function outputShowsBody(output, signature) {
  if (typeof output !== 'string' || !signature || (signature.name === null && signature.heading === null)) return false;
  if (signature.name !== null && !new RegExp(`${LINE_PREFIX}name:[ \\t]*${escapeRegExp(signature.name)}[ \\t]*\\r?(\\n|$)`).test(output)) return false;
  if (signature.heading !== null && !new RegExp(`${LINE_PREFIX}#{1,6}[ \\t]+${escapeRegExp(signature.heading)}[ \\t]*\\r?(\\n|$)`).test(output)) return false;
  return true;
}

/**
 * The signature of one source file: its first and last non-empty lines,
 * trimmed, or null when the file is missing. Both lines in recorded output
 * show the whole file was returned; a truncated read shows only the first.
 */
export function fileSignature(file) {
  if (!fs.existsSync(file)) return null;
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).map((line) => line.trim()).filter((line) => line !== '');
  if (lines.length === 0) return { first: null, last: null };
  return { first: lines[0], last: lines[lines.length - 1] };
}

/** Signatures of the source files at `relativePaths` under `sourceRoot`; every entry null when there is no source root. */
export function sourceSignatures(sourceRoot, relativePaths) {
  return Object.fromEntries(relativePaths.map((relative) => [relative, sourceRoot ? fileSignature(path.join(sourceRoot, ...relative.split('/'))) : null]));
}

/** True when `output` shows the whole source file: its first and its last non-empty line, each on a line of its own. */
export function outputShowsFile(output, signature) {
  if (typeof output !== 'string' || !signature || signature.first === null) return false;
  const line = (text) => new RegExp(`${LINE_PREFIX}[ \\t]*${escapeRegExp(text)}[ \\t]*\\r?(\\n|$)`);
  return line(signature.first).test(output) && line(signature.last).test(output);
}

/** A text with its line endings normalized and trailing whitespace at the end removed, for comparing file bodies. */
function normalizedBody(text) {
  return text.replace(/\r\n/g, '\n').trimEnd();
}

/**
 * The body of a skill-local copy with its optional first-line header
 * removed: `{ header, body }`, where `header` is null when the copy starts
 * with the canonical text's first line or has no second line.
 */
function splitHeader(copy) {
  const lines = copy.split('\n');
  if (lines.length < 2) return { header: null, body: copy };
  let index = 1;
  while (index < lines.length && lines[index].trim() === '') index += 1;
  return { header: lines[0], body: lines.slice(index).join('\n') };
}

/**
 * The Markdown link rewrites the generator registers for the skill-local
 * copy at `aliasPath` (`skills/<skill>/references/<basename>`) of the
 * canonical file at `relative`, read from the generator's own table so the
 * two never diverge: `[{ from, to }]`, empty when the copy is not a generated
 * reference of that owner.
 */
export function registeredRewrites(relative, aliasPath, references = WRITING_REFERENCES) {
  const reference = references.find((entry) => entry.file === aliasPath && entry.source === relative);
  return reference ? Object.entries(reference.rewrites ?? {}).map(([from, to]) => ({ from, to })) : [];
}

/**
 * How a skill-local copy relates to the canonical body: `{ status: 'alias',
 * header }` when the copy equals the canonical text, or equals it after its
 * first line (a generated-from header, recorded) and any blank lines that
 * follow it; `{ status: 'alias', header, rewrites }` when it equals the
 * canonical text, with or without that header, only after the given link
 * rewrites (`[{ from, to }]`, each applied as `](from)` to `](to)`), listing
 * the rewrites that occurred in the canonical text and so made the match;
 * `{ status: 'stale-alias', header: null }` otherwise.
 */
export function aliasBodyMatch(canonicalText, aliasText, rewrites = []) {
  const canonical = normalizedBody(canonicalText);
  const copy = normalizedBody(aliasText);
  const { header, body } = splitHeader(copy);
  if (copy === canonical) return { status: 'alias', header: null };
  if (header !== null && body === canonical) return { status: 'alias', header };
  if (rewrites.length > 0) {
    let rewritten = canonical;
    const applied = [];
    for (const { from, to } of rewrites) {
      if (!rewritten.includes(`](${from})`)) continue;
      rewritten = rewritten.replaceAll(`](${from})`, `](${to})`);
      applied.push({ from, to });
    }
    if (applied.length > 0) {
      if (copy === rewritten) return { status: 'alias', header: null, rewrites: applied };
      if (header !== null && body === rewritten) return { status: 'alias', header, rewrites: applied };
    }
  }
  return { status: 'stale-alias', header: null };
}

/**
 * The declared skill-local copies of each source file at `relativePaths`
 * under `sourceRoot`: every regular file `skills/<skill>/references/<basename>`
 * in the source tree, as `{ skill, path, status, header }` with `status`
 * `alias` (its body equals the canonical body after an optional header line,
 * or after the link rewrites the generator registers for that copy, in which
 * case `rewrites` lists the ones that made the match) or `stale-alias` (it
 * differs), in skill order. Empty for every path when there is no source
 * root, no canonical file or no such copy; nothing is guessed from a path
 * that does not exist in the tree.
 */
export function sourceAliases(sourceRoot, relativePaths, { references = WRITING_REFERENCES } = {}) {
  const aliases = Object.fromEntries(relativePaths.map((relative) => [relative, []]));
  if (!sourceRoot) return aliases;
  const skillsDir = path.join(sourceRoot, 'skills');
  if (!fs.existsSync(skillsDir)) return aliases;
  const skills = fs.readdirSync(skillsDir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  for (const relative of relativePaths) {
    const canonicalFile = path.join(sourceRoot, ...relative.split('/'));
    if (!fs.existsSync(canonicalFile) || !fs.lstatSync(canonicalFile).isFile()) continue;
    const basename = relative.slice(relative.lastIndexOf('/') + 1);
    const canonicalText = fs.readFileSync(canonicalFile, 'utf8');
    for (const skill of skills) {
      const copy = path.join(skillsDir, skill, 'references', basename);
      if (!fs.existsSync(copy) || !fs.lstatSync(copy).isFile()) continue;
      const aliasPath = `skills/${skill}/references/${basename}`;
      const match = aliasBodyMatch(canonicalText, fs.readFileSync(copy, 'utf8'), registeredRewrites(relative, aliasPath, references));
      aliases[relative].push({ skill, path: aliasPath, status: match.status, header: match.header, ...(match.rewrites ? { rewrites: match.rewrites } : {}) });
    }
  }
  return aliases;
}

/**
 * True when the workspace path `relative` matches a `writes` entry: equal to
 * it, or, when the entry carries `*`, matched by it with each `*` standing
 * for any run of characters other than a slash. Anything else in the entry
 * is literal.
 */
export function writeMatches(entry, relative) {
  if (!entry.includes('*')) return entry === relative;
  const pattern = entry.split('*').map((part) => escapeRegExp(part)).join('[^/]*');
  return new RegExp(`^${pattern}$`).test(relative);
}

/** True when a normalized path equals `relative` or ends with it after a separator. */
function endsWithPath(normalized, relative) {
  return normalized === relative || normalized.endsWith(`/${relative}`);
}

/**
 * How a path argument names the source file at `relative`: `{ form:
 * 'canonical' }` when it equals or ends with the source-relative path;
 * `{ form: 'skill-local', skill, status }` when it ends with one of the
 * file's declared aliases (`skills/<skill>/references/<basename>`, reached
 * through `.claude/skills`, `.agents/skills` or the materialized source
 * alike); null otherwise.
 */
function namesFile(word, relative, aliases = []) {
  const normalized = word.replace(/\\/g, '/');
  if (endsWithPath(normalized, relative)) return { form: 'canonical', skill: null, status: 'canonical' };
  for (const alias of aliases) if (endsWithPath(normalized, alias.path)) return { form: 'skill-local', skill: alias.skill, status: alias.status };
  return null;
}

/**
 * Classify what each source file at `paths` (source-relative) saw: `body`
 * (its whole text returned to the engine: a `Read` of a path ending with it
 * or with one of its declared aliases whose output shows the file, or a
 * shell command whose output shows it; several partial outputs that together
 * show it), `partial` (a read or command naming it returned output without
 * the whole file: an error, or a truncated read), `listing` (named, nothing
 * returned) or `staleAlias` (a read or command naming only a stale alias:
 * recorded, never a read). `forms` lists the path forms (`canonical`,
 * `skill-local`) the reads with content went through and `skillLocal` the
 * skill directories of the skill-local ones. `how` and `evidence` are kept
 * as for skill reads. Without a signature for a file, no output can
 * establish its body; a `Read` naming it with no recorded output still
 * counts, as it does for skills. `aliases` maps each path to its declared
 * aliases (see `sourceAliases`); without them only the canonical path names
 * the file, as before.
 */
export function classifySourceReads(events, paths, { signatures = {}, aliases = {} } = {}) {
  const reads = Object.fromEntries(paths.map((relative) => [relative, { body: false, partial: false, listing: false, staleAlias: false, forms: [], skillLocal: [], how: [], evidence: [] }]));
  const outputs = Object.fromEntries(paths.map((relative) => [relative, []]));
  const note = (relative, field, line, evidence) => {
    reads[relative][field] = true;
    if (reads[relative].how.length < 20) reads[relative].how.push(line);
    if (reads[relative].evidence.length < 20) reads[relative].evidence.push({ ...evidence, result: field === 'staleAlias' ? 'stale-alias' : field });
  };
  const noteForms = (relative, named) => {
    for (const match of named) {
      if (match.status === 'stale-alias') continue;
      if (!reads[relative].forms.includes(match.form)) reads[relative].forms.push(match.form);
      if (match.skill !== null && !reads[relative].skillLocal.includes(match.skill)) reads[relative].skillLocal.push(match.skill);
    }
    reads[relative].forms.sort();
    reads[relative].skillLocal.sort();
  };
  for (const event of events) {
    const entry = toolText(event);
    if (!entry || entry.tool === 'Skill') continue;
    const { tool, text, output } = entry;
    const line = `${tool}: ${excerpt(text)}`;
    const shell = tool === 'Bash' || tool === 'command';
    let positive = [];
    const excluded = [];
    if (shell) {
      for (const command of simpleCommands(text)) {
        const args = pathArguments(command);
        positive.push(...args.positive);
        excluded.push(...args.excluded);
      }
    } else {
      positive = text.split(/\s+/).filter(Boolean);
    }
    for (const relative of paths) {
      const signature = signatures[relative] ?? null;
      const declared = aliases[relative] ?? [];
      const matches = positive.map((word) => namesFile(word, relative, declared)).filter(Boolean);
      const usable = matches.filter((match) => match.status !== 'stale-alias');
      const named = usable.length > 0;
      const staleOnly = matches.length > 0 && !named;
      const evidence = { tool, command: excerpt(text), paths: positive.slice(0, 20), excluded: excluded.slice(0, 20), form: usable[0]?.form ?? null, skill: usable.find((match) => match.skill !== null)?.skill ?? null };
      if (staleOnly) {
        note(relative, 'staleAlias', `${line} (names a stale skill-local copy of ${relative} under skills/${matches[0].skill}; not a read)`, { ...evidence, basis: 'stale-alias', skill: matches[0].skill, form: 'skill-local' });
        continue;
      }
      if (tool === 'Read') {
        if (!named) continue;
        noteForms(relative, usable);
        if (output === null) note(relative, 'body', `${line} (no output recorded)`, { ...evidence, basis: 'read-path' });
        else if (outputShowsFile(output, signature)) note(relative, 'body', line, { ...evidence, basis: 'read-path' });
        else {
          outputs[relative].push(output);
          note(relative, 'partial', `${line} (output lacks the file's first or last line)`, { ...evidence, basis: 'read-path' });
        }
        continue;
      }
      if (shell && outputShowsFile(output, signature)) {
        noteForms(relative, usable);
        note(relative, 'body', `${line} (file in output)`, { ...evidence, basis: 'output-signature' });
      } else if (named && shell && output !== null) {
        noteForms(relative, usable);
        outputs[relative].push(output);
        note(relative, 'partial', `${line} (output lacks the file's first or last line)`, { ...evidence, basis: 'argument' });
      } else if (named) {
        note(relative, 'listing', shell ? `${line} (names the file, no output recorded)` : line, { ...evidence, basis: 'argument' });
      } else if (excluded.some((word) => namesFile(word.replace(/^(:\(exclude\)|:!|:\^|!)/, ''), relative, declared) !== null)) {
        if (reads[relative].evidence.length < 20) reads[relative].evidence.push({ ...evidence, basis: 'exclusion-only', result: null });
      }
    }
  }
  for (const relative of paths) {
    if (reads[relative].body || outputs[relative].length < 2) continue;
    if (outputShowsFile(outputs[relative].join('\n'), signatures[relative] ?? null)) {
      note(relative, 'body', `${outputs[relative].length} partial outputs together show the file`, { tool: 'several', basis: 'chunked-output', command: '', paths: [relative], excluded: [], form: null, skill: null });
    }
  }
  return reads;
}

/**
 * The character bounds of the passage in `text` that follows the line equal
 * to `after` and ends before the line equal to `before` (the end of the text
 * when `before` is undefined). Throws when a marker is absent, occurs more
 * than once, or `before` does not follow `after`.
 */
export function passageBounds(text, { after, before }) {
  const occurrences = (marker) => {
    const found = [];
    let offset = 0;
    for (const raw of text.split('\n')) {
      if (raw.replace(/\r$/, '') === marker) found.push({ start: offset, end: Math.min(offset + raw.length + 1, text.length) });
      offset += raw.length + 1;
    }
    return found;
  };
  const once = (marker, name) => {
    if (typeof marker !== 'string') throw new Error(`${name} must be the text of one line`);
    const found = occurrences(marker);
    if (found.length !== 1) throw new Error(`${name} line '${marker}' occurs ${found.length} times; it must occur exactly once`);
    return found[0];
  };
  const start = once(after, 'after').end;
  if (before === undefined) return { start, end: text.length };
  const end = once(before, 'before').start;
  if (end < start) throw new Error(`before line '${before}' precedes after line '${after}'`);
  return { start, end };
}

/**
 * Whether `current` differs from `fixture` only inside the passage the
 * markers bound: the text before the passage and the text from the `before`
 * line onward must be unchanged, byte for byte.
 */
export function editConfinement(fixture, current, markers) {
  const { start, end } = passageBounds(fixture, markers);
  const prefix = fixture.slice(0, start);
  const suffix = fixture.slice(end);
  const prefixKept = current.startsWith(prefix);
  const suffixKept = current.length >= prefix.length + suffix.length && current.endsWith(suffix);
  return { prefixKept, suffixKept, confined: prefixKept && suffixKept };
}

function mentionsSkill(text, skill) {
  return new RegExp(`skills[\\\\/]${escapeRegExp(skill)}([\\\\/:\\s'"]|$)`).test(text) || new RegExp(`[\\\\/]${escapeRegExp(skill)}[\\\\/]SKILL\\.md`).test(text);
}

function isSkillBody(text, skill) {
  return new RegExp(`(skills[\\\\/]${escapeRegExp(skill)}[\\\\/]SKILL\\.md)|([\\\\/]${escapeRegExp(skill)}[\\\\/]SKILL\\.md)`).test(text);
}

/** True when `output` lists `skill` as a bare name, as `ls` over the skills directory prints it. */
function outputListsName(output, skill) {
  return new RegExp(`(^|[\\s/])${escapeRegExp(skill)}([\\s/]|$)`).test(output);
}

function mentionsSkillsDirectory(text) {
  return /(^|[\\/\s'"=])skills([\\/]|\s|$|['"])/.test(text) || /(^|[\\/\s'"=])\.(claude|agents)([\\/]|\s|$|['"])/.test(text);
}

/** Searchable text, tool name and recorded output of a trace event, or null for events that are not tool use. */
function toolText(event) {
  const output = typeof event.output === 'string' ? event.output : null;
  if (event.kind === 'tool') {
    const input = event.input ?? {};
    if (event.tool === 'Bash') return { tool: 'Bash', text: String(input.command ?? ''), output };
    if (event.tool === 'Skill') return { tool: 'Skill', text: JSON.stringify(input), output };
    if (event.tool === 'Read' || event.tool === 'Edit' || event.tool === 'Write' || event.tool === 'MultiEdit') return { tool: event.tool, text: String(input.file_path ?? input.path ?? ''), output };
    if (event.tool === 'Glob') return { tool: 'Glob', text: `${input.path ?? ''} ${input.pattern ?? ''}`, output };
    if (event.tool === 'Grep') return { tool: 'Grep', text: `${input.path ?? ''} ${input.glob ?? ''} ${input.pattern ?? ''}`, output };
    return { tool: event.tool, text: JSON.stringify(input), output };
  }
  if (event.kind === 'command') return { tool: 'command', text: String(event.text ?? ''), output };
  return null;
}

function excerpt(text) {
  return text.length > 160 ? `${text.slice(0, 160)}…` : text;
}

/**
 * Classify what each skill's SKILL.md saw: `body` (its body returned to the
 * engine: a `Read` of the file, or a shell command whose output shows the
 * body), `invoked` (an engine Skill tool call naming it), `partial` (a search
 * whose arguments or results name it, so some of its text may have been
 * seen) or `listing` (its name or path listed, nothing read). `how` keeps
 * one line of evidence per event; `evidence` keeps the basis and the
 * command's positive path arguments. `signatures` maps each skill to its
 * SKILL.md signature (see `skillSignatures`); without one, no shell output
 * can establish a body read of that skill.
 */
export function classifySkillReads(events, skills, { signatures = {} } = {}) {
  const reads = Object.fromEntries(skills.map((skill) => [skill, { body: false, invoked: false, partial: false, listing: false, how: [], evidence: [] }]));
  const note = (skill, field, line, evidence) => {
    reads[skill][field] = true;
    if (reads[skill].how.length < 20) reads[skill].how.push(line);
    if (reads[skill].evidence.length < 20) reads[skill].evidence.push({ ...evidence, result: field });
  };
  for (const event of events) {
    const entry = toolText(event);
    if (!entry) continue;
    const { tool, text, output } = entry;
    const line = `${tool}: ${excerpt(text)}`;
    if (tool === 'Skill') {
      for (const skill of skills) if (text.includes(skill)) note(skill, 'invoked', line, { tool, basis: 'skill-tool', command: excerpt(text) });
      continue;
    }
    if (tool === 'Read') {
      for (const skill of skills) {
        if (isSkillBody(text, skill)) note(skill, 'body', line, { tool, basis: 'read-path', command: excerpt(text), paths: [text] });
        else if (mentionsSkill(text, skill)) note(skill, 'listing', line, { tool, basis: 'argument', command: excerpt(text), paths: [text] });
      }
      continue;
    }
    const shell = tool === 'Bash' || tool === 'command';
    let positive = [];
    const excluded = [];
    let searching = tool === 'Grep';
    if (shell) {
      for (const command of simpleCommands(text)) {
        if (SEARCH_VERBS.has(path.basename(command[0])) || (path.basename(command[0]) === 'git' && command[1] === 'grep')) searching = true;
        const args = pathArguments(command);
        positive.push(...args.positive);
        excluded.push(...args.excluded);
      }
    } else {
      positive = [text];
    }
    const positiveText = positive.join(' ');
    // A search over the whole skills directory whose results were not recorded may have shown lines of every skill.
    const searchesSkillsDirectory = searching && output === null && mentionsSkillsDirectory(positiveText) && !skills.some((skill) => mentionsSkill(positiveText, skill));
    for (const skill of skills) {
      const signature = signatures[skill] ?? null;
      const namedPaths = positive.filter((word) => mentionsSkill(word, skill));
      const listsDirectory = mentionsSkillsDirectory(positiveText);
      const named = namedPaths.length > 0 || (output !== null && (mentionsSkill(output, skill) || (listsDirectory && outputListsName(output, skill))));
      const evidence = { tool, command: excerpt(text), paths: positive.slice(0, 20), excluded: excluded.slice(0, 20) };
      if (shell && outputShowsBody(output, signature)) {
        note(skill, 'body', `${line} (body in output)`, { ...evidence, basis: 'output-signature' });
      } else if (searchesSkillsDirectory) {
        note(skill, 'partial', `${line} (search over the skills directory, output not recorded)`, { ...evidence, basis: 'argument' });
      } else if (named && searching) {
        note(skill, 'partial', line, { ...evidence, basis: namedPaths.length ? 'argument' : 'output-path' });
      } else if (named) {
        const unread = shell && output === null && namedPaths.some((word) => isSkillBody(word, skill));
        note(skill, 'listing', unread ? `${line} (names SKILL.md, no output recorded)` : line, { ...evidence, basis: namedPaths.length ? 'argument' : 'output-path' });
      } else if (excluded.some((word) => mentionsSkill(word, skill) || mentionsSkillsDirectory(word))) {
        // Named only in an exclusion: recorded for the grader, never a read.
        if (reads[skill].evidence.length < 20) reads[skill].evidence.push({ ...evidence, basis: 'exclusion-only', result: null });
      }
    }
  }
  return reads;
}

/** Created, modified and deleted files of the workspace against the fixture copied into it. */
export function fileChanges(workspace, fixtureManifest) {
  const after = manifestOf(workspace, { skip: WORKSPACE_SKIP });
  const created = [];
  const modified = [];
  const deleted = [];
  for (const relative of Object.keys(after)) {
    if (!(relative in fixtureManifest)) created.push(relative);
    else if (after[relative].sha256 !== fixtureManifest[relative].sha256) modified.push(relative);
  }
  for (const relative of Object.keys(fixtureManifest)) if (!(relative in after)) deleted.push(relative);
  return { created: created.sort(), modified: modified.sort(), deleted: deleted.sort() };
}


// Verbs of a sentence that claim a file was produced, and the two location
// phrases of a receipt's first line. A modal or negation before the verb, or
// a negation before the path, withdraws the claim; a question never claims.
// A verb governs only the paths in its own clause (see `claimClauses`) and
// claims only when the clause's subject is the author, absent or the thing
// produced in the passive (see `claimSubject`).
const CLAIM_VERBS = /\b(wrote|written|saved|created|updated|added|put|placed)\b|\bis (?:at|in)\b/gi;
const NEGATIONS = /\b(not|no|never|without|nor|neither|unwritten|unsaved)\b|n't\b/i;
const MODALS = /\b(will|would|could|should|can|cannot|may|might|shall|must|to)\b|'ll\b/i;
const PATH_EXTENSIONS = /\.(md|txt|json|csv)$/i;
// A colon or semicolon that may end a clause; a connector that opens one when
// a subject pronoun or a modal follows it (a new subject and verb); a
// subordinator that always opens one ("before anything is written, the
// assistant copies ..."), which the next comma ends.
const CLAUSE_PUNCTUATION = /[:;](?=\s)/g;
const CLAUSE_COMMA = /,(?=\s)/g;
const CLAUSE_SUBORDINATOR = /\b(?:before|after|once|until|unless|if|when|whenever|while|because|although|though)\b(?=\s)/gi;
// Quoted or bracketed text is a title or an aside ("Checks before publishing",
// a parenthesis): a subordinator or comma inside it opens or ends no clause.
const QUOTED = /“[^”]*”|"[^"]*"|`[^`]*`|\[[^\]]*\]|\([^)]*\)/g;
const SUBJECT = /^(?:I|we|you|they|he|she|it|this|that|these|those|there|who|which|what)(?:'(?:ve|ll|d|m|s|re))?\b/i;
const CLAUSE_CONNECTOR = /\b(?:and|but|or|nor|so|yet|then|that|which|where|while|whereas|because|although|though|since|once|after|before|until|unless|if|when)\s+(?=(?:I|we|you|they|he|she|it|this|that|these|those|there|who|which|what)(?:'(?:ve|ll|d|m|s|re))?\b|(?:will|would|could|should|can|cannot|may|might|shall|must|need|needs)\b)/gi;
// What stands before a claim verb in its clause: a list marker or Markdown
// emphasis is not a subject and a trailing adverb is skipped; the author is a
// first-person pronoun; the thing produced is named by a form of "be" just
// before the participle ("the page is saved as", "it's written to", "has
// been added"). Anything else (the assistant, the recipient, a step) is not
// the author claiming.
const LIST_MARKER = /^(?:[-*+•]|\d+[.)])\s+/;
const FIRST_PERSON = /^(?:I|we)(?:['’](?:ve|d|m|re))?$/i;
const BE_FORM = /^(?:am|is|are|was|were|be|been|being)$|['’](?:s|re)$/i;
const ADVERB = /^(?:now|then|already|also|just|first|again|too)$|ly$/i;

/** Sentences of a reply: lines split at a period, exclamation or question mark, or semicolon, followed by whitespace. */
export function replySentences(reply) {
  const sentences = [];
  for (const line of reply.split(/\r?\n/)) {
    for (const part of line.split(/(?<=[.!?;])\s+/)) if (part.trim()) sentences.push(part.trim());
  }
  return sentences;
}

/** Open Markdown links, protecting destination characters from prose tokenization. */
function openLinks(text) {
  return text.replace(/\[([^\]]*)\]\((?:<([^>\r\n]*)>|([^)\s]*))\)/g,
    (_, label, angleTarget, target) => `${label} ${(angleTarget ?? target).replace(/[^A-Za-z0-9._~\/%#:-]/gu,
      (character) => encodeURIComponent(character).replace(/[!'()*]/g, (punctuation) => `%${punctuation.charCodeAt(0).toString(16).toUpperCase()}`))}`);
}

/** The path a token names, cleaned of quotes, brackets, link anchors and trailing punctuation, or null when it is not path-like. */
export function pathToken(raw) {
  let token = raw.replace(/^[`'"“”‘’*_([{<]+|[`'"“”‘’*_)\]}>.,;:!?]+$/g, '');
  const anchor = token.indexOf('#');
  if (anchor >= 0) token = token.slice(0, anchor);
  token = token.replace(/\\/g, '/');
  if (!token || token.includes('://') || !/^[A-Za-z0-9._~\-/%]+$/.test(token)) return null;
  try { token = decodeURIComponent(token); } catch { /* keep it as written */ }
  if (token.includes('://') || /[\x00-\x1f\x7f]/.test(token)) return null;
  const last = token.slice(token.lastIndexOf('/') + 1);
  // The raw-token guard above remains conservative; decoded Markdown destinations
  // may contain legitimate filename characters that prose tokens cannot.
  if (!/^[^\s./\\][^/\\]*\.[A-Za-z0-9]+$/u.test(last)) return null;
  return token.includes('/') || PATH_EXTENSIONS.test(last) ? token : null;
}

/** The path-like tokens of a stretch of text, in order, with the offset each starts at. */
function pathTokensIn(text, base = 0) {
  const found = [];
  let offset = 0;
  for (const word of text.split(/\s+/)) {
    if (!word) continue;
    const start = text.indexOf(word, offset);
    offset = start + word.length;
    const claimed = pathToken(word);
    if (claimed !== null) found.push({ path: claimed, start: base + start });
  }
  return found;
}

/**
 * The clauses of a sentence, as `[start, end)` spans. A clause ends at a
 * semicolon; at a colon once the clause already names a path or when a
 * subject pronoun opens what follows (a receipt's "Written: docs/x.md" stays
 * one clause, "put this in a.md for them: they need to file b.md" does not);
 * before a connector that introduces a new subject or a modal ("and I",
 * "so they", "and will"); and before a subordinator (before, after, once,
 * until, unless, if, when, while, because, although), whose own clause ends
 * at the next comma ("before anything is written, the assistant copies a.csv
 * to b.csv" is three clauses: the label, the subordinate clause, the main
 * one). A comma ends no other clause, and neither a subordinator nor a comma
 * inside quotes or brackets (the heading "Checks before publishing") counts.
 * A claim verb governs only its own clause's paths.
 */
export function claimClauses(sentence) {
  const breaks = [];
  const quoted = [...sentence.matchAll(QUOTED)].map((match) => [match.index, match.index + match[0].length]);
  const inQuotes = (at) => quoted.some(([start, end]) => at > start && at < end);
  for (const match of sentence.matchAll(CLAUSE_PUNCTUATION)) breaks.push({ at: match.index, after: match.index + 1, kind: match[0] });
  for (const match of sentence.matchAll(CLAUSE_COMMA)) if (!inQuotes(match.index)) breaks.push({ at: match.index, after: match.index + 1, kind: ',' });
  for (const match of sentence.matchAll(CLAUSE_SUBORDINATOR)) if (!inQuotes(match.index)) breaks.push({ at: match.index, after: match.index, kind: 'subordinator' });
  for (const match of sentence.matchAll(CLAUSE_CONNECTOR)) breaks.push({ at: match.index, after: match.index, kind: 'connector' });
  breaks.sort((a, b) => a.at - b.at);
  const clauses = [];
  let start = 0;
  let subordinate = false;
  for (const candidate of breaks) {
    if (candidate.at < start) continue;
    if (candidate.at === start) {
      if (candidate.kind === 'subordinator') subordinate = true;
      continue;
    }
    if (candidate.kind === ',' && !subordinate) continue;
    if (candidate.kind === ':') {
      const rest = sentence.slice(candidate.after).trimStart();
      const named = pathTokensIn(sentence.slice(start, candidate.at)).length > 0;
      if (!named && !SUBJECT.test(rest)) continue;
    }
    clauses.push([start, candidate.at]);
    start = candidate.after;
    subordinate = candidate.kind === 'subordinator';
  }
  if (start < sentence.length) clauses.push([start, sentence.length]);
  return clauses;
}

/**
 * Who a claim verb's clause says did the producing, from the stretch between
 * the clause's start and the verb: `author` when a first-person pronoun
 * stands there ("I've", "we"); `receipt` when nothing does but a list
 * marker, emphasis or an adverb ("Saved docs/x.md", "- **Written:**", "Also
 * created"); `passive` when a form of "be" ends it, so the subject is the
 * thing produced ("The page is saved as", "It's written to", "has been
 * added"); otherwise `other`: a third party, a future actor or a step
 * ("the assistant put", "the brief has the assistant put", "Step 2: put",
 * "the committee files"), which is never the author claiming.
 */
export function claimSubject(stretch) {
  const words = stretch.replace(LIST_MARKER, '').replace(/[*_`]/g, '').split(/\s+/)
    .map((word) => word.replace(/^[^A-Za-z'’]+|[^A-Za-z'’]+$/g, ''))
    .filter(Boolean);
  if (words.some((word) => FIRST_PERSON.test(word))) return 'author';
  while (words.length > 0 && ADVERB.test(words.at(-1))) words.pop();
  if (words.length === 0) return 'receipt';
  if (BE_FORM.test(words.at(-1))) return 'passive';
  return 'other';
}

/**
 * The paths a reply claims to have produced: for each sentence that is not a
 * question, each claim verb not preceded by a modal or a negation whose
 * clause's subject is the author, absent or the thing produced (a "written:"
 * label counts as a receipt whatever precedes it; "is at" and "is in" locate
 * whatever their subject), and each path-like token in the verb's own clause
 * (after the phrase, for "is at" and "is in") with no negation between the
 * sentence's start and the token. Returns `{ path, verb, sentence }` per
 * claim, one per path and sentence.
 */
export function claimedPaths(reply) {
  const claims = [];
  if (typeof reply !== 'string') return claims;
  for (const sentence of replySentences(openLinks(reply))) {
    if (sentence.endsWith('?')) continue;
    const seen = new Set();
    const clauses = claimClauses(sentence);
    for (const match of sentence.matchAll(CLAIM_VERBS)) {
      const before = sentence.slice(0, match.index);
      if (MODALS.test(before) || NEGATIONS.test(before)) continue;
      const verb = match[0].toLowerCase();
      const [clauseStart, clauseEnd] = clauses.find(([start, end]) => match.index >= start && match.index < end) ?? [0, sentence.length];
      const label = /^\s*:/.test(sentence.slice(match.index + match[0].length));
      if (!verb.startsWith('is ') && !label && claimSubject(sentence.slice(clauseStart, match.index)) === 'other') continue;
      const from = verb.startsWith('is ') ? match.index + match[0].length : clauseStart;
      for (const { path: claimed, start } of pathTokensIn(sentence.slice(from, clauseEnd), from)) {
        if (seen.has(claimed)) continue;
        if (NEGATIONS.test(sentence.slice(0, start))) continue;
        seen.add(claimed);
        claims.push({ path: claimed, verb, sentence: excerpt(sentence) });
      }
    }
  }
  return claims;
}

/**
 * Match each claimed path against the attempt: `created` or `modified` when
 * the path, or a file ending with it, is among the files the engine changed;
 * `unchanged` when it names a fixture file or anything else present in the
 * workspace (a file that exists never fails, whatever the verb); `outside`
 * when an absolute path exists elsewhere; `absent` otherwise.
 */
export function matchClaims(claims, { files, workspace = null, fixtureManifest = {} }) {
  const endsWith = (candidate, relative) => candidate === relative || candidate.endsWith(`/${relative}`) || relative.endsWith(`/${candidate}`);
  return claims.map((claim) => {
    const cleaned = claim.path.replace(/^\.\//, '').replace(/\/+/g, '/');
    const absolute = cleaned.startsWith('/') || cleaned.startsWith('~/');
    const find = (list) => list.find((relative) => absolute ? cleaned.endsWith(`/${relative}`) : endsWith(cleaned, relative)) ?? null;
    const created = find(files.created);
    if (created) return { ...claim, outcome: 'created', matched: created };
    const modified = find(files.modified);
    if (modified) return { ...claim, outcome: 'modified', matched: modified };
    const fixture = find(Object.keys(fixtureManifest));
    if (fixture) return { ...claim, outcome: 'unchanged', matched: fixture };
    if (!absolute && workspace !== null && fs.existsSync(path.join(workspace, ...cleaned.split('/')))) return { ...claim, outcome: 'unchanged', matched: cleaned };
    if (absolute && workspace !== null && cleaned.startsWith(`${workspace}/`) && fs.existsSync(cleaned)) return { ...claim, outcome: 'unchanged', matched: cleaned.slice(workspace.length + 1) };
    if (absolute && fs.existsSync(cleaned)) return { ...claim, outcome: 'outside', matched: cleaned };
    return { ...claim, outcome: 'absent', matched: null };
  });
}

/** The claimed-artifact record of a reply: its claims with their outcomes, and whether any claimed path is absent. */
export function claimedArtifacts(finalReply, context) {
  const claims = matchClaims(claimedPaths(finalReply), context);
  return { claims, absent: claims.filter((claim) => claim.outcome === 'absent').map((claim) => claim.path) };
}

function evaluate(caseDef, { exit, files, reads, sourceReads = {}, workspace = null, claimed = null }) {
  const det = caseDef.deterministic;
  const premises = new Set(det.premise);
  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, kind: premises.has(id) ? 'premise' : 'criterion', pass, detail });

  if (exit.timedOut) add('exit', false, `timed out after ${exit.seconds}s`);
  else if (exit.signal) add('exit', false, `terminated by ${exit.signal}`);
  else add('exit', exit.status === det.exit, `exit ${exit.status}, expected ${det.exit}`);

  // Only a body read or a Skill invocation counts as reading a skill. Its name
  // in a listing, or a search that may have shown lines of it, is recorded in
  // the detail but neither satisfies a required read nor breaks a forbidden one.
  for (const [skill, rule] of Object.entries(det.skillReads)) {
    const read = reads[skill] ?? { body: false, invoked: false, partial: false, listing: false, how: [] };
    const seen = [read.body && 'body read', read.invoked && 'invoked', read.partial && 'searched', read.listing && 'listed'].filter(Boolean).join(', ') || 'not mentioned';
    const loaded = read.body || read.invoked;
    add(`skillReads.${skill}`, rule === 'required' ? loaded : !loaded, `${skill}: ${seen}`);
  }

  // A source file counts as read only when its whole text came back. An
  // `observed` file is classified and recorded for the grader but yields no check.
  for (const [relative, rule] of Object.entries(det.sourceReads ?? {})) {
    if (rule === 'observed') continue;
    const read = sourceReads[relative] ?? { body: false, partial: false, listing: false, staleAlias: false, forms: [], skillLocal: [] };
    const through = read.forms?.length ? ` through ${read.forms.map((form) => (form === 'skill-local' ? `skill-local copy (${read.skillLocal.join(', ')})` : form)).join(' and ')}` : '';
    const seen = [read.body && `read${through}`, read.partial && `partly returned${read.body ? '' : through}`, read.listing && 'named', read.staleAlias && 'stale skill-local copy named'].filter(Boolean).join(', ') || 'not mentioned';
    add(`sourceReads.${relative}`, rule === 'required' ? read.body : !read.body, `${relative}: ${seen}`);
  }

  // An edit confined to one passage leaves the bytes around it as the fixture had them.
  for (const [relative, markers] of Object.entries(det.edits ?? {})) {
    const id = `edits.${relative}`;
    const currentFile = workspace === null ? null : path.join(workspace, ...relative.split('/'));
    const fixtureFile = caseDef.workspace ? path.join(caseDef.workspace, ...relative.split('/')) : null;
    if (currentFile === null || !fs.existsSync(currentFile)) { add(id, false, `${relative}: missing from the workspace`); continue; }
    if (fixtureFile === null || !fs.existsSync(fixtureFile)) { add(id, false, `${relative}: fixture copy not available for comparison`); continue; }
    try {
      const result = editConfinement(fs.readFileSync(fixtureFile, 'utf8'), fs.readFileSync(currentFile, 'utf8'), markers);
      const passage = `the passage after '${markers.after}'${markers.before === undefined ? '' : ` and before '${markers.before}'`}`;
      const detail = result.confined ? `changes confined to ${passage}` : `changed outside ${passage}: ${[!result.prefixKept && 'text before it', !result.suffixKept && 'text after it'].filter(Boolean).join(' and ')}`;
      add(id, result.confined, detail);
    } catch (error) {
      add(id, false, `${relative}: ${error.message}`);
    }
  }

  // A `writes` entry matches a path literally or, with `*`, as a pattern within one segment.
  const touched = [...files.created, ...files.modified, ...files.deleted];
  if (det.writes.allowed !== undefined) {
    const outside = touched.filter((relative) => !det.writes.allowed.some((entry) => writeMatches(entry, relative)));
    add('writes.allowed', outside.length === 0, outside.length ? `changed outside the allowed set: ${outside.join(', ')}` : touched.length ? `changed: ${touched.join(', ')}` : 'nothing changed');
  }
  if (det.writes.required?.length) {
    const written = [...files.created, ...files.modified];
    const matched = det.writes.required.map((entry) => ({ entry, files: written.filter((relative) => writeMatches(entry, relative)) }));
    const missing = matched.filter(({ files: found }) => found.length === 0).map(({ entry }) => entry);
    add('writes.required', missing.length === 0, missing.length ? `not written: ${missing.join(', ')}` : `written: ${matched.map(({ entry, files: found }) => (entry.includes('*') ? `${entry} (${found.join(', ')})` : entry)).join(', ')}`);
  }

  // What the reply says it produced must exist: a claimed path with no created, modified or existing file fails.
  if (det.claimedArtifacts !== false && claimed !== null) {
    const described = claimed.claims.map((claim) => `${claim.path} (${claim.verb}): ${claim.outcome}`).join('; ');
    add('claimedArtifacts', claimed.absent.length === 0, claimed.absent.length ? `claimed but no such file: ${claimed.absent.join(', ')}; claims: ${described}` : claimed.claims.length ? `claims: ${described}` : 'no path claimed in the final reply');
  }
  return checks;
}

/**
 * Inspect an attempt. `events` are the engine adapter's normalized trace
 * events; `finalReply` is the reply text or null; `exit` is the attempt's
 * exit record; `signatures` are the installed skills' SKILL.md signatures;
 * `sourceRoot` is the materialized source, from which the signatures of the
 * case's `sourceReads` files and their declared skill-local aliases are
 * taken (without it, no output can establish such a read and no alias is
 * known). The final reply's claimed artifacts are matched against the
 * workspace and recorded as `claimedArtifacts` (null without a reply).
 * Returns the inspection, including the verdict on the deterministic
 * expectations: `pass`, `fail` or `premise-not-met`.
 */
export function inspectAttempt({ caseDef, skills, events, finalReply, workspace, fixtureManifest, exit, effective, signatures = {}, sourceRoot = null, now = Date.now }) {
  const files = fileChanges(workspace, fixtureManifest);
  const reads = classifySkillReads(events, skills, { signatures });
  const sourcePaths = Object.keys(caseDef.deterministic.sourceReads ?? {});
  const fileSignatures = sourceSignatures(sourceRoot, sourcePaths);
  const aliases = sourceAliases(sourceRoot, sourcePaths);
  const sourceReads = classifySourceReads(events, sourcePaths, { signatures: fileSignatures, aliases });
  const claimed = finalReply === null ? null : claimedArtifacts(finalReply, { files, workspace, fixtureManifest });
  const checks = evaluate(caseDef, { exit, files, reads, sourceReads, workspace, claimed });
  const premiseFailed = checks.some((check) => check.kind === 'premise' && !check.pass);
  const criterionFailed = checks.some((check) => check.kind === 'criterion' && !check.pass);
  const verdict = premiseFailed ? 'premise-not-met' : criterionFailed ? 'fail' : 'pass';
  return {
    classifier: { ...CLASSIFIER, inspectedAt: new Date(now()).toISOString(), signatures: Object.fromEntries(skills.map((skill) => [skill, signatures[skill] ?? null])), sourceSignatures: fileSignatures, sourceAliases: aliases },
    files,
    skillReads: reads,
    sourceReads,
    claimedArtifacts: claimed,
    skillToolCalls: events.filter((event) => event.kind === 'tool' && event.tool === 'Skill').map((event) => JSON.stringify(event.input)),
    toolCalls: events.filter((event) => event.kind === 'tool' || event.kind === 'command').length,
    permissionDenials: events.filter((event) => event.kind === 'denial').length,
    engineErrors: events.filter((event) => event.kind === 'error').map((event) => event.message),
    finalReply: finalReply === null ? null : { chars: finalReply.length, questionMarks: (finalReply.match(/\?/g) ?? []).length },
    effective,
    checks,
    verdict,
  };
}
