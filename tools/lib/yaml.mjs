// Reads the YAML of workflow configuration files and SKILL.md frontmatter with
// the maintained `yaml` package shipped under tools/vendor, into a small
// plain-data model: mappings
// with text keys, sequences, null, booleans, text and finite numbers. Anything
// else is refused with a YamlError, and nothing partly read reaches a caller.
//
// - Files holding this YAML are UTF-8. `decodeUtf8` turns their bytes into
//   text and refuses bytes that are not UTF-8, rather than reading them as
//   U+FFFD replacement characters; a U+FFFD encoded in the file is text.
// - The source is read as YAML 1.2 with the Core schema, strictly, with unique
//   keys, no custom or extension tags and no merge keys. Every package error
//   and warning refuses it.
// - It holds exactly one document, which may open with `---` and close with
//   `...`. Directives (`%YAML`, `%TAG` and reserved ones) are refused, so the
//   source cannot change how it is read.
// - Keys are always text, written as they appear (`2:` is the key '2', `1.0:`
//   the key '1.0'); collection keys, keys that collide as text and a mapping
//   entry without a key are refused.
// - Numbers are read as JavaScript numbers. An integer form (`42`, `-7`,
//   `0x2A`) is read exactly and must be a safe integer, checked on the
//   package's exact integer before any conversion. Any other number is the
//   nearest binary64 double, an approximation (`0.05`, or `1.0000000000000001`,
//   which reads as 1): it must be finite, must not round to an integer beyond
//   the safe integers, and a nonzero number must not round to zero. `.inf` and
//   `.nan` are refused. A value whose exact text matters is quoted.
// - Anchors and aliases may repeat acyclic values, within the package's
//   `maxAliasCount` of 100; an alias inside the node it names, and the alias at
//   which expansion passes that count, are refused. Merge keys are not
//   supported: their fields are written out instead.
// - Characters YAML excludes from its source are refused: see the character
//   boundary below.
// - A block scalar whose last line ends the input without a line break gets
//   no final line break, as YAML 1.2 defines, where the package adds one.
// - The same source is also read with the package's YAML 1.1 schema, and any
//   difference in the values read is refused, so that loaders keeping YAML 1.1
//   rules read the same data. That schema departs from YAML 1.1 in a few known
//   places, which the compatibility boundary below refuses explicitly.
//
// This is not a claim that the package, or this reading of it, conforms to
// every part of either YAML version.

import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { revealTextSpaces } from './text-spaces.mjs';

const SOURCE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(import.meta.url);
// An explicit package directory prevents Node from falling back to ancestor dependencies.
const YAML_PACKAGE = path.join(SOURCE_ROOT, 'tools', 'vendor', 'node_modules', 'yaml');

const MAX_ALIAS_COUNT = 100;
const EXCESSIVE_ALIASES = 'Excessive alias count';
const COMMON = { prettyErrors: false, strict: true, uniqueKeys: true, stringKeys: true, intAsBigInt: true };
const YAML_12 = { ...COMMON, version: '1.2', schema: 'core', resolveKnownTags: false, merge: false };
const YAML_11 = { ...COMMON, version: '1.1', schema: 'yaml-1.1' };

/**
 * A refused source. `line` and `column` locate the cause: 1-based, the line
 * counted in the caller's file through `firstLine` and the column in UTF-16
 * code units from the start of that line; the message then starts with them.
 * They are undefined only when the package's nodes give the cause no source
 * position. A difference between the two readings below that lies inside an
 * alias's copy of its anchored value is located in the anchored value, where
 * it is written. Should no node hold the difference itself, it is located at
 * the deepest node on its way, and the message names the rest of the way.
 */
export class YamlError extends Error {
  constructor(message, line, column) {
    super(line ? `line ${line}, column ${column}: ${message}` : message);
    this.name = 'YamlError';
    this.line = line;
    this.column = column;
  }
}

/** The installed runtime payload is incomplete. */
export class MissingDependencyError extends Error {
  constructor() {
    super(`the 'yaml' runtime dependency is missing from ${path.join(SOURCE_ROOT, 'tools', 'vendor')}; `
      + 'reinstall the package or regenerate its vendored dependencies from the source checkout');
    this.name = 'MissingDependencyError';
  }
}

const UTF8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

/**
 * The text of a file's bytes, read as UTF-8; null when they are not UTF-8, so
 * no replaced or partial text is read. A leading byte order mark is kept for
 * the caller. Not checked here: whether the text is YAML.
 */
export function decodeUtf8(bytes) {
  try {
    return UTF8.decode(bytes);
  } catch (error) {
    if (error.code === 'ERR_ENCODING_INVALID_ENCODED_DATA') return null;
    throw error;
  }
}

let yaml;

/** Load the package, resolved beside this module whatever the working directory. */
function loadYaml() {
  if (yaml) return yaml;
  try {
    yaml = require(YAML_PACKAGE);
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND' && error.message.startsWith(`Cannot find module '${YAML_PACKAGE}'`)) {
      throw new MissingDependencyError();
    }
    throw error;
  }
  return yaml;
}

/**
 * Read one YAML document into plain data; null when the source holds no
 * document. `firstLine` is the 1-based line number of the first line of `text`
 * in its file, used for error messages.
 */
export function parseYaml(text, { firstLine = 1 } = {}) {
  const { CST, parseAllDocuments, Parser } = loadYaml();
  const source = { text, firstLine };
  const fail = (message, offset) => { throw located(source, message, offset); };

  const tokens = [...new Parser().parse(text)];
  refuseCharacters(text, tokens, fail);
  for (const token of tokens) {
    if (token.type === 'directive') {
      fail('directives such as %YAML and %TAG are not accepted; remove the line', token.offset);
    }
  }
  const unbroken = unbrokenBlockScalars(tokens, CST);
  const documents = parseAllDocuments(text, YAML_12);
  refuseProblems(documents, '', fail);
  if (documents.length === 0) return null;
  if (documents.length > 1) {
    fail('a second document starts here; the file holds exactly one YAML document', documents[1].range[0]);
  }
  const [document] = documents;
  removeAddedBreaks(document, unbroken);
  checkPlainData(document, fail);
  const value = decode(document, fail);

  const yaml11 = parseAllDocuments(text, YAML_11);
  refuseProblems(yaml11, 'read with YAML 1.1 rules, ', fail);
  removeAddedBreaks(yaml11[0], unbroken);
  const compared = decode(yaml11[0], fail);
  if (!isDeepStrictEqual(value, compared)) {
    const difference = firstDifference(value, compared, []);
    const { node, rest } = nodeAt(document, difference.path);
    const where = rest.length ? `at ${rest.map(describeStep).join(', ')} inside the value here` : 'here';
    fail(`YAML 1.2 reads ${describe(difference.a)} ${where} and YAML 1.1 reads ${describe(difference.b)}; `
      + 'write it so both read the same, for example by quoting a value meant as text', node?.range?.[0]);
  }
  return value;
}

function refuseProblems(documents, prefix, fail) {
  for (const document of documents) {
    for (const problem of [...document.errors, ...document.warnings]) {
      fail(`${prefix}${problem.message} (${problem.code})`, problem.pos[0]);
    }
  }
}

// yaml 2.9.1 ends a clip (`|`, `>`) or keep (`|+`, `>+`) block scalar with a
// line break even when its last line, at the end of the input, has none, where
// YAML 1.2.2 (§8.1.1.2) keeps only the line breaks present. The package's own
// tokens find such a scalar: its source ends without a line break, and its last
// line is content, or for keep the only line. Content means a character other
// than a space, or more spaces than the content indentation, which follows the
// package's rule (the indentation indicator, or the first content line). The
// break the package added is then removed from the parsed scalar.
function unbrokenBlockScalars(tokens, CST) {
  const offsets = new Set();
  const check = (token) => {
    if (token?.type !== 'block-scalar' || !token.source || /[\n\r]$/.test(token.source)) return;
    const header = token.props[0].source;
    if (header.includes('-')) return;
    const lines = token.source.split('\n').map((line) => line.replace(/\r$/, ''));
    const first = lines.find((line) => /[^ ]/.test(line));
    const last = lines.at(-1);
    if (first === undefined) {
      if (header.includes('+') && lines.length === 1) offsets.add(token.offset);
      return;
    }
    const indicator = /[1-9]/.exec(header);
    const indent = indicator ? token.indent + Number(indicator[0]) : /^ */.exec(first)[0].length;
    if (/[^ ]/.test(last) || last.length > indent) offsets.add(token.offset);
  };
  for (const token of tokens) {
    if (token.type === 'document') CST.visit(token, (item) => { check(item.key); check(item.value); });
  }
  return offsets;
}

function removeAddedBreaks(document, offsets) {
  if (!offsets.size) return;
  yaml.visit(document, {
    Scalar(_, node) {
      if (offsets.has(node.range[0]) && typeof node.value === 'string' && node.value.endsWith('\n')) {
        node.value = node.value.slice(0, -1);
      }
    },
  });
}

// Mappings, sequences and the scalars of the plain-data model, checked before
// any conversion that could lose information.
function checkPlainData(document, fail) {
  const { isAlias, isMap, isPair, isScalar, isSeq } = yaml;
  const state = new Map(); // node -> 'open' while its content is checked, then 'done'
  const visit = (node) => {
    if (node === null || node === undefined) return;
    if (isAlias(node)) {
      const target = node.resolve(document);
      if (!target) fail(`alias *${node.source} has no anchor before it`, node.range[0]);
      if (state.get(target) === 'open') {
        fail(`alias *${node.source} is inside the node it names; cyclic data is not accepted`, node.range[0]);
      }
      if (!state.has(target)) visit(target);
      return;
    }
    state.set(node, 'open');
    if (isScalar(node)) checkScalar(node, fail);
    else if (isMap(node) || isSeq(node)) {
      for (const item of node.items) {
        if (isPair(item)) {
          checkKey(item.key, document, fail);
          visit(item.value);
        } else visit(item);
      }
    } else fail('this kind of YAML node is not accepted', node.range?.[0]);
    state.set(node, 'done');
  };
  visit(document.contents);
}

function checkKey(key, document, fail) {
  const { isAlias, isScalar } = yaml;
  const node = isAlias(key) ? key.resolve(document) : key;
  if (!isScalar(node) || typeof node.value !== 'string') {
    fail('a mapping key must be text, not a collection', key?.range?.[0]);
  }
  if (node.value === '' && node.type === 'PLAIN' && !node.tag) {
    fail('a mapping entry needs a key; write an empty key as ""', key.range[0]);
  }
  // The package's YAML 1.1 schema takes any plain `<<` key, tagged or not, as
  // its merge key (yaml.org/type/merge), which YAML 1.2 reads as the text '<<'.
  if (isScalar(key) && key.type === 'PLAIN' && key.value === '<<') {
    fail("a plain '<<' key is the YAML 1.1 merge key, not text, and merge keys are not supported; "
      + 'write the fields to merge into this mapping instead, or quote it if it is text', key.range[0]);
  }
}

function checkScalar(node, fail) {
  const { value } = node;
  const written = `'${node.source}'`;
  if (typeof value === 'bigint') {
    if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < -BigInt(Number.MAX_SAFE_INTEGER)) {
      fail(`${written} is too large to read exactly; quote it if it is text`, node.range[0]);
    }
  } else if (typeof value === 'number') {
    // Not an integer form, so the nearest double, within the bounds above.
    if (!Number.isFinite(value)) fail(`${written} is not a finite number; quote it if it is text`, node.range[0]);
    if (Number.isInteger(value) && !Number.isSafeInteger(value)) {
      fail(`${written} rounds to ${value}, beyond the safe integers; quote it if it is text`, node.range[0]);
    }
    if (value === 0 && /[1-9]/.test(String(node.source).split(/[eE]/)[0])) {
      fail(`${written} is too small and rounds to 0; quote it if it is text`, node.range[0]);
    }
  } else if (value !== null && typeof value !== 'string' && typeof value !== 'boolean') {
    fail('this value is not text, a number, a boolean or null', node.range[0]);
  }
  if (node.type === 'PLAIN' && !node.tag) checkBoundaryPlain(node, fail);
}

/**
 * The package's conversion, within its alias limit, with integers as numbers.
 * Aliases are checked before it, so the one conversion failure expected from
 * the input is the package's refusal of an alias whose expansion passes the
 * limit; any other exception is not a property of the input and propagates.
 */
function decode(document, fail) {
  // The package raises that refusal without the alias, so each alias of this
  // document notes itself as the first to raise it, which is the alias whose
  // resolution passed the limit (aliases inside its target resolve first).
  let raisedAt;
  yaml.visit(document, {
    Alias(_, alias) {
      const { resolve } = alias;
      alias.resolve = function resolveNoting(...args) {
        try {
          return resolve.apply(this, args);
        } catch (error) {
          raisedAt ??= this;
          throw error;
        }
      };
    },
  });
  let value;
  try {
    value = document.toJS({ maxAliasCount: MAX_ALIAS_COUNT });
  } catch (error) {
    if (!(error instanceof ReferenceError && error.message.startsWith(EXCESSIVE_ALIASES) && raisedAt)) throw error;
    fail(`alias *${raisedAt.source} takes alias expansion past the package's maxAliasCount of ${MAX_ALIAS_COUNT} `
      + `(${error.message})`, raisedAt.range[0]);
  }
  return integersAsNumbers(value);
}

function integersAsNumbers(value) {
  if (typeof value === 'bigint') {
    return value <= BigInt(Number.MAX_SAFE_INTEGER) && value >= -BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : value;
  }
  if (Array.isArray(value)) value.forEach((item, index) => { value[index] = integersAsNumbers(item); });
  else if (isPlainObject(value)) for (const key of Object.keys(value)) value[key] = integersAsNumbers(value[key]);
  return value;
}

function firstDifference(a, b, path) {
  if (Array.isArray(a) && Array.isArray(b) && a.length === b.length) {
    const index = a.findIndex((item, i) => !isDeepStrictEqual(item, b[i]));
    return firstDifference(a[index], b[index], [...path, index]);
  }
  if (isPlainObject(a) && isPlainObject(b) && isDeepStrictEqual(Object.keys(a).sort(), Object.keys(b).sort())) {
    const key = Object.keys(a).find((k) => !isDeepStrictEqual(a[k], b[k]));
    return firstDifference(a[key], b[key], [...path, key]);
  }
  return { path, a, b };
}

/**
 * The node of the YAML 1.2 document at a path of the value read from it,
 * descending through each alias on the way into the node it names, which
 * holds the written source. Should no node hold the next step, it stops at the
 * deepest node reached and returns the steps left (keys that are not text were
 * refused before this). Each step resolves at most one alias, since an alias
 * names a scalar or collection, never another alias, so the walk is no longer
 * than the path; cyclic aliases were refused before it.
 */
function nodeAt(document, path) {
  const { isAlias, isCollection } = yaml;
  let node = document.contents;
  for (const [index, step] of path.entries()) {
    const named = isAlias(node) ? node.resolve(document) : node;
    const next = isCollection(named) ? named.get(step, true) : undefined;
    if (next === undefined || next === null) return { node, rest: path.slice(index) };
    node = next;
  }
  return { node, rest: [] };
}

function describeStep(step) {
  return typeof step === 'number' ? `item ${step}` : `key ${quote(step)}`;
}

function describe(value) {
  if (value === null) return 'null';
  if (typeof value === 'string') return `the text ${quote(value)}`;
  if (typeof value === 'boolean') return `the boolean ${value}`;
  if (typeof value === 'number' || typeof value === 'bigint') return `the number ${value}`;
  if (Array.isArray(value)) return `a sequence of ${value.length}`;
  if (value instanceof Date) return 'a timestamp';
  if (isPlainObject(value)) {
    const keys = Object.keys(value);
    return keys.length ? `a mapping with the keys ${keys.map(quote).join(', ')}` : 'an empty mapping';
  }
  return `a value of type ${value?.constructor?.name ?? typeof value}`;
}

function quote(text) {
  const json = JSON.stringify(text);
  return revealTextSpaces(json)?.shown ?? json;
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype;
}

// Compatibility boundary: what YAML 1.1 (https://yaml.org/spec/1.1/ and the
// types at https://yaml.org/type/) reads differently from YAML 1.2 although the
// package's YAML 1.1 schema reads it as YAML 1.2 does, so the comparison above
// cannot see the difference. U+0085, U+2028 and U+2029 are line breaks in YAML
// 1.1 and text in YAML 1.2; inside a double-quoted value their escapes are read
// the same by both. Among untagged plain values, YAML 1.1 reads a leading-zero
// decimal containing 8 or 9 (`08`) as text, and an exponent number without a
// '.' or with an unsigned exponent (`1e3`, `1.5e3`) as text, since its floats
// need both; `=` and `<<` are its value and merge indicators, not text, and a
// plain `<<` key, tagged or not, is its merge key (checked with the keys). The
// boundary covers only these known departures: the YAML 1.2 escape `\/`, for
// example, which YAML 1.1 lacks, is still read as '/'.
const ONE_VERSION_LINE_BREAKS = { '\u0085': '\\N', '\u2028': '\\L', '\u2029': '\\P' };
const LEADING_ZERO_DECIMAL = /^[-+]?0[0-9]*[89][0-9]*$/;
const EXPONENT_NUMBER = /^[-+]?(\.[0-9]+|[0-9]+(\.[0-9]*)?)[eE][-+]?[0-9]+$/;

// Character boundary: the package reads characters that YAML excludes from its
// source (§5.1, c-printable) as text. A C0 control other than tab, line feed
// and carriage return is excluded everywhere, quoted scalars included (§7.3,
// nb-json), and is refused wherever it appears. DEL, the C1 controls other
// than U+0085, U+FFFE, U+FFFF and an unpaired surrogate are excluded except
// inside a quoted scalar, which admits them as text. U+FEFF, the byte order
// mark, may open the source (§5.2), where the package reads it as no content;
// elsewhere only a quoted scalar admits it as text (§5.4, nb-char). These are
// refused in the checked spans: plain scalars (keys included), block scalars
// (header and content), comments, and anchor and alias names (§6.9.2,
// ns-anchor-char), located by the package's own tokens. Elsewhere outside
// quotes they are not checked (a tag holding one is no Core schema tag, so it
// is refused as such). A double-quoted escape (`\a`, `\x7F`, `\uFFFE`,
// `\uFEFF`) is not one of these characters in the source and is read as the
// package reads it. U+0085, U+2028 and U+2029 are refused everywhere, as the
// compatibility boundary above describes.
const CHECKED_CHARACTERS = /[\0-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F\u2028\u2029\uFEFF\uFFFE\uFFFF\uD800-\uDFFF]/gu;
const C0_CONTROL = /^[\0-\x1F]$/;
const UNPAIRED_SURROGATE = /^[\uD800-\uDFFF]$/u;
const BYTE_ORDER_MARK = '\uFEFF';
// What to do about a refused character, by the kind of checked span holding it.
const REMEDY = {
  scalar: 'remove it, or quote the text that holds it',
  comment: 'remove it from the comment',
  anchor: 'remove it from the anchor name',
  alias: 'remove it from the alias name',
};

function refuseCharacters(text, tokens, fail) {
  let checkedSpanAt;
  for (const match of text.matchAll(CHECKED_CHARACTERS)) {
    const [character] = match;
    const code = character.codePointAt(0).toString(16).toUpperCase().padStart(4, '0');
    if (ONE_VERSION_LINE_BREAKS[character]) {
      fail(`U+${code} is a line break in YAML 1.1 but text in YAML 1.2, so the two read this differently; `
        + `inside a double-quoted value write it as ${ONE_VERSION_LINE_BREAKS[character]} or \\u${code}, elsewhere remove it`, match.index);
    }
    if (C0_CONTROL.test(character)) {
      fail(`U+${code} is a control character, which YAML does not accept anywhere in its source; `
        + `remove it, or inside a double-quoted value write it as \\u${code}`, match.index);
    }
    checkedSpanAt ??= spanLookup(checkedSpans(tokens));
    const span = checkedSpanAt(match.index);
    if (!span) continue;
    if (UNPAIRED_SURROGATE.test(character)) {
      fail(`U+${code} is half of a surrogate pair without its other half, which is not a character; remove it`, match.index);
    }
    fail(character === BYTE_ORDER_MARK
      ? `U+${code} is a byte order mark, which YAML accepts only at the start of its source or inside quotes; `
        + REMEDY[span.kind]
      : `U+${code} is not a printable character, which YAML accepts only inside quotes; ${REMEDY[span.kind]}`,
    match.index);
  }
}

/**
 * The checked spans: [start, end) source offsets of every plain scalar, block
 * scalar (from its header), comment, anchor and alias token, with its kind,
 * sorted by start and, at one start, longest first. Spans can overlap: a block
 * scalar's span holds the comment after its header.
 */
function checkedSpans(tokens) {
  const spans = [];
  const add = (kind, start, end) => spans.push({ kind, start, end });
  const walk = (token) => {
    if (token === null || typeof token !== 'object') return;
    if (Array.isArray(token)) {
      token.forEach(walk);
      return;
    }
    if (token.type === 'scalar') add('scalar', token.offset, token.offset + token.source.length);
    else if (token.type === 'comment' || token.type === 'anchor' || token.type === 'alias') {
      add(token.type, token.offset, token.offset + token.source.length);
    } else if (token.type === 'block-scalar') {
      // The content follows the scalar's props: its header and the rest of that line.
      const last = token.props.at(-1);
      add('scalar', token.offset, (last ? last.offset + last.source.length : token.offset) + token.source.length);
    }
    Object.values(token).forEach(walk);
  };
  walk(tokens);
  return spans.sort((a, b) => a.start - b.start || b.end - a.end);
}

/**
 * A lookup of the innermost span holding each offset (of the sorted spans
 * holding it, the last), or undefined outside them all, for offsets asked in
 * increasing order, as the character matches come. It pushes the spans that
 * have started onto a stack, in sorted order, then drops spans that have ended
 * from its top. A span holding the offset ends after every offset asked so
 * far, so it was never dropped; the top left, which holds the offset, is
 * therefore the last span holding it, and an empty stack means none does. This
 * holds whatever the spans' overlaps. Each span is pushed and dropped at most
 * once, so all lookups together take time linear in the spans and the offsets,
 * after the walk and the sort that build the spans.
 */
function spanLookup(spans) {
  const started = [];
  let next = 0;
  return (offset) => {
    while (next < spans.length && spans[next].start <= offset) started.push(spans[next++]);
    while (started.length && started.at(-1).end <= offset) started.pop();
    return started.at(-1);
  };
}

function checkBoundaryPlain(node, fail) {
  const { value, source } = node;
  const exponentText = EXPONENT_NUMBER.test(source) && (!source.includes('.') || /[eE][0-9]/.test(source));
  if (LEADING_ZERO_DECIMAL.test(source) || exponentText) {
    fail(`'${source}' is a number in YAML 1.2 but text in YAML 1.1; quote it if it is text, `
      + 'or write it in a form both read as the same number', node.range[0]);
  }
  if (value === '=' || value === '<<') {
    fail(`a plain '${value}' is a YAML 1.1 indicator, not text; quote it if it is text`, node.range[0]);
  }
}

// Errors carry the file's line and column. A Unicode text space looks like an
// ordinary space or like nothing, so a refused line holding one is shown with
// it written out; it need not be the cause, so the advice is conditional.
function located(source, message, offset) {
  if (offset === undefined) return new YamlError(message);
  const before = source.text.slice(0, offset);
  const line = before.split('\n').length;
  const column = offset - before.lastIndexOf('\n');
  const content = source.text.split('\n')[line - 1].replace(/\r$/, '');
  const spaces = revealTextSpaces(content);
  if (spaces) {
    const [it, looks] = spaces.plural ? ['them', 'they look like spaces'] : ['it', 'it looks like a space'];
    message = `${message}; the line is "${spaces.shown}" with ${spaces.named} written as \\uXXXX: ${looks} `
      + `but YAML reads ${it} as text, not as blank space or separation (if blank space is meant there, delete ${it} `
      + `or replace ${it} with an ordinary space)`;
  }
  return new YamlError(message, line + source.firstLine - 1, column);
}
