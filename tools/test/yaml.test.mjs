// Expected values come from the YAML 1.2.2 specification (https://yaml.org/spec/1.2.2/,
// sections cited as §), the YAML 1.1 types at https://yaml.org/type/ and the
// plain-data model and compatibility boundary documented in tools/lib/yaml.mjs,
// never from running the adapter.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseYaml, YamlError } from '../lib/yaml.mjs';

const crlf = (text) => text.replace(/\n/g, '\r\n');

/** Assert `text`, and its CRLF form, read as `expected`. */
function reads(text, expected, message = JSON.stringify(text)) {
  assert.deepEqual(parseYaml(text), expected, message);
  assert.deepEqual(parseYaml(crlf(text)), expected, `${message} (CRLF)`);
}

/** Assert `text`, and its CRLF form, are refused with a message matching `pattern`. */
function refuses(text, pattern, message = JSON.stringify(text)) {
  for (const [form, source] of [['LF', text], ['CRLF', crlf(text)]]) {
    assert.throws(() => parseYaml(source), (error) => error instanceof YamlError && pattern.test(error.message),
      `${message} (${form})`);
  }
}

test('reads ordinary configuration and frontmatter values', () => {
  reads([
    '# comment',
    'name: plan-reviewer',
    'description: "Review one set: report findings"   # trailing comment',
    "quoted: 'it''s'",
    'count: 3',
    'ratio: 1.5',
    'version: 1.0.0',
    'flag: true',
    'empty:',
    'nested:',
    '  inner:',
    '    leaf: value # comment',
    'list:',
    '  - one',
    '  - "two"',
    'sameIndentList:',
    '- a',
    'literal: |',
    '  line one',
    '    kept indent',
    '',
    'folded: >-',
    '  joined',
    '  together',
    '',
    '  new paragraph',
    'escape: "tab\\tunicode\\u00e9"',
    '',
  ].join('\n'), {
    name: 'plan-reviewer',
    description: 'Review one set: report findings',
    quoted: "it's",
    count: 3,
    ratio: 1.5,
    version: '1.0.0',
    flag: true,
    empty: null,
    nested: { inner: { leaf: 'value' } },
    list: ['one', 'two'],
    sameIndentList: ['a'],
    literal: 'line one\n  kept indent\n',
    folded: 'joined together\nnew paragraph',
    escape: 'tab\tunicodeé',
  });
});

test('a source without a document reads as null', () => {
  for (const text of ['', '# only a comment\n', '\n\n']) assert.equal(parseYaml(text), null, JSON.stringify(text));
  assert.equal(parseYaml('---\n'), null, 'an explicit empty document is null (§9.1.4)');
});

// Flow collections, multi-line scalars, explicit keys and nested collections, read as YAML 1.2 defines them.
test('reads flow collections, multi-line scalars, explicit keys and nested collections', () => {
  reads('a: [b, c]\nd: {e: f, g: [1, 2]}\n', { a: ['b', 'c'], d: { e: 'f', g: [1, 2] } }); // §7.4
  reads('a: one\n  two\n\n  three\n', { a: 'one two\nthree' }); // §7.3.3 multi-line plain, §6.5 folding
  reads('a: "one\n  two"\nb: \'x\n\n  y\'\n', { a: 'one two', b: 'x\ny' }); // §7.3.1, §7.3.2
  reads('description:\n  continued text\n', { description: 'continued text' });
  reads('? a\n: b\n? "c d"\n: e\n', { a: 'b', 'c d': 'e' }); // §8.2.2 explicit scalar keys
  reads('a:\n  - - p\n    - q\n  - k: v\n    w: z\n', { a: [['p', 'q'], { k: 'v', w: 'z' }] }); // §8.2.1 compact collections
  reads('a: |2\n   x\n', { a: ' x\n' }); // §8.1.1.1 indentation indicator
});

test('block scalars keep exactly their spaces and line breaks', () => {
  const read = (text) => parseYaml(text).a;
  // Literal content keeps trailing spaces and spaces beyond the content indentation (§8.1.2).
  assert.equal(read('a: |\n  x  \n    \n  y\n'), 'x  \n  \ny\n');
  assert.equal(read('a: >\n  x  \n  y\n'), 'x   y\n');
  assert.equal(read('a: |\n  x\n  \nb: 1\n'), 'x\n', 'a blank line no deeper than the content is empty');
  // Leading empty lines may not be indented more than the first content line (§8.1.1.1).
  assert.throws(() => parseYaml('a: |\n      \n  x\n'), YamlError);
  // A more-indented folded line keeps the breaks around it, empty lines included (§8.1.3).
  assert.equal(read('a: >\n  first\n    code\n\n  last\n'), 'first\n  code\n\nlast\n');
  assert.equal(read('a: >\n  first\n\n    code\n  last\n'), 'first\n\n  code\nlast\n');
  assert.equal(read('a: >\n  x\n\n\n  y\n'), 'x\n\ny\n');
  assert.equal(read('a: >\n\n  x\n  y\n'), '\nx y\n');
  // Chomping counts the line breaks present, with or without a final one (§8.1.1.2).
  for (const [text, value] of [
    ['a: |+\n  x\n', 'x\n'], ['a: |+\n  x', 'x'], ['a: |\n  x', 'x'], ['a: |-\n  x', 'x'], ['a: >+\n  x\n  y', 'x y'],
    ['a: |+\n  x\n\n\n', 'x\n\n\n'], ['a: |\n  x\n\n', 'x\n'], ['a: |-\n  x\n\n', 'x'], ['a: |+\r\n  x\r\n\r\n', 'x\n\n'],
    ['a: |+\n  x\n\n\nb: 1\n', 'x\n\n\n'], ['a: |+\n\n\nb: 1\n', '\n\n'], ['a: |+\n', ''], ['a: |\n', ''],
  ]) assert.equal(read(text), value, JSON.stringify(text));
});

// The package adds a final line break to a clip or keep block scalar whose last
// line ends the input without one; the adapter removes it (§8.1.1.2 keeps only
// the breaks present), leaving every other value as the package reads it.
test('a block scalar ending the input without a line break gets none', () => {
  for (const [text, value] of [
    ['a: |\n  x', 'x'], ['a: >\n  x\n  y', 'x y'], ['a: |+\n  x', 'x'], ['a: >+\n  x\n\n  y', 'x\ny'],
    ['a: |\n  x  ', 'x  '], // trailing spaces are content
    ['a: |\n  x\n    ', 'x\n  '], ['a: |+\n  x\n    ', 'x\n  '], // spaces beyond the indentation are content
    ['a: |2\n   x', ' x'], ['a: |2\n  x\n   ', 'x\n '], // indentation indicator
    ['a: &x !!str >+\n  y', 'y'], // an anchor and a tag before the header
    ['a: |+\n  x\n  ', 'x\n'], ['a: |+\n  x\n\n  ', 'x\n\n'], ['a: |\n  x\n  ', 'x\n'], // a last line of indentation is empty
    ['a: |-\n  x', 'x'], ['a: |\n  ', ''], ['a: |+\n  ', ''], ['a: |+\n\n  ', '\n'], ['a: |', ''], // strip and empty blocks
  ]) {
    assert.equal(parseYaml(text).a, value, JSON.stringify(text));
    assert.equal(parseYaml(crlf(text)).a, value, `${JSON.stringify(text)} (CRLF)`);
  }
  assert.equal(parseYaml('|\n x'), 'x', 'at the document root');
  assert.deepEqual(parseYaml('a:\n  - |\n    x'), { a: ['x'] }, 'in a sequence');
  assert.deepEqual(parseYaml('? |\n  k'), { k: null }, 'as an explicit key');
  assert.deepEqual(parseYaml('a: |\n  x\nb: |+\n  y'), { a: 'x\n', b: 'y' }, 'only the scalar ending the input');
});

test('malformed scalars and entries are refused', () => {
  refuses('a: "b\n', /^line \d+, column \d+: .*\(MISSING_CHAR\)/); // unterminated quote (§7.3.1)
  refuses('a: "\\q"\n', /^line 1, column \d+: .*\(BAD_DQ_ESCAPE\)/); // \q is no escape (§5.7)
  refuses('a: b: c\n', /^line 1, column 4: /); // a block mapping cannot start on its key's line (§8.2.2)
  refuses('a: - b\n', /^line 1, column 4: /);
  refuses('a: ]b\n', /^line 1, column 4: /); // ']' cannot start a plain scalar (§7.3.3)
  reads('?a: 1\n:b: 2\n-c: 3\n', { '?a': 1, ':b': 2, '-c': 3 }, 'an indicator not followed by white space is text');
});

test('a document may open with --- and close with ...', () => {
  reads('---\na: 1\n...\n', { a: 1 }); // §9.1.4
  reads('--- # start\na: 1\n... # end\n', { a: 1 });
});

test('exactly one document is read', () => {
  refuses('a: 1\n---\nb: 2\n', /^line 2, column 1: a second document starts here/);
  refuses('a: 1\n...\nb: 2\n', /^line 3, column 1: a second document starts here/);
  refuses('a: 1\n---\n', /^line 2, column 1: a second document starts here/);
});

// Directives would change the YAML version or tag shorthands the source is
// read with, so the adapter refuses them as an application boundary.
test('directives are refused', () => {
  for (const text of ['%YAML 1.2\n---\na: 1\n', '%YAML 1.1\n---\na: yes\n', '%TAG ! tag:example.com,2000:\n---\na: 1\n',
    '%FOO bar\n---\na: 1\n', '%YAML 1.2\n']) {
    refuses(text, /^line 1, column 1: directives such as %YAML and %TAG are not accepted/);
  }
});

test('marker-like text is text; only a marker followed by a space or a line end is one', () => {
  reads('---x: 1\n...x: 2\n', { '---x': 1, '...x': 2 }); // §9.1.3: a marker needs white space or a break after it
  reads('a: ---\nb: "---"\n"...": c\n', { a: '---', b: '---', '...': 'c' });
  reads('a: |\n  ---\n  ...\n', { a: '---\n...\n' }); // indented, so block scalar content
  refuses('--- : x\n', /^line 1, column 5: .*\(MISSING_CHAR\)/); // a block mapping cannot start on the marker line
  refuses('--- x: y\n', /^line 1, column 5: .*\(MISSING_CHAR\)/);
  for (const space of ['\u00A0', '\u2003']) {
    // A text space is no white space, so `---` followed by one starts plain text, not a marker.
    reads(`---${space}x: v\n`, { [`---${space}x`]: 'v' }, `U+${space.charCodeAt(0).toString(16)} after ---`);
  }
});

test('tags other than the Core schema tags are refused', () => {
  for (const text of ['a: !foo x\n', 'a: !!binary aGk=\n', 'a: !!set {x}\n', 'a: !!timestamp 2020-01-01\n', 'a: !!omap [b: 1]\n']) {
    refuses(text, /^line 1, column 4: Unresolved tag: .*\(TAG_RESOLVE_FAILED\)/);
  }
  reads('a: !!str 012\nb: !!int 12\n', { a: '012', b: 12 }); // §10.3.2 explicit Core tags
});

test('keys are text, written as they appear', () => {
  reads('2: a\n1.0: b\n02: c\nyes: d\nnull: e\n~: f\ntrue: g\n"": h\n',
    { 2: 'a', '1.0': 'b', '02': 'c', yes: 'd', null: 'e', '~': 'f', true: 'g', '': 'h' });
});

test('duplicate keys, keys that collide as text, collection keys and missing keys are refused', () => {
  refuses('a: 1\na: 2\n', /^line 2, column 1: Map keys must be unique \(DUPLICATE_KEY\)/); // §3.2.1.3
  refuses('"2": x\n2: y\n', /^line 2, column 1: Map keys must be unique/);
  refuses("'a': 1\na: 2\n", /^line 2, column 1: Map keys must be unique/);
  refuses('__proto__: 1\n__proto__: 2\n', /^line 2, column 1: Map keys must be unique/);
  for (const text of ['[a]: 1\n', '? [a]\n: 1\n', '{a: 1}: x\n', '? owner: me\n']) {
    refuses(text, /^line 1, column \d+: With stringKeys, all keys must be strings \(NON_STRING_KEY\)/);
  }
  refuses(': x\n', /^line 1, column 1: a mapping entry needs a key; write an empty key as ""/);
  refuses('? \n: x\n', /^line 1, column 3: a mapping entry needs a key/);
});

test('mapping keys are own properties, including __proto__ and constructor', () => {
  const value = parseYaml('__proto__:\n  injected: x\nconstructor: c\nplain: p\n');
  assert.deepEqual(Object.keys(value), ['__proto__', 'constructor', 'plain']);
  assert.equal(Object.getPrototypeOf(value), Object.prototype);
  assert.equal(value.injected, undefined);
  assert.deepEqual(Object.getOwnPropertyDescriptor(value, '__proto__').value, { injected: 'x' });
  assert.equal(value.constructor, 'c');
  assert.equal(Object.hasOwn(parseYaml('a: 1\n'), 'constructor'), false);
});

// Plain forms YAML 1.2 Core (§10.3.2) and YAML 1.1 (yaml.org/type) both read
// as the same value.
test('reads the numbers, booleans and nulls both YAML versions agree on', () => {
  const read = (plain) => parseYaml(`a: ${plain}\n`).a;
  for (const [plain, value] of [
    ['0', 0], ['-0', 0], ['+1', 1], ['42', 42], ['1.5', 1.5], ['1.', 1], ['.5', 0.5], ['-.5', -0.5],
    ['1.5e+3', 1500], ['.5E-1', 0.05], ['0x10', 16], ['9007199254740991', 9007199254740991],
    ['-9007199254740991', -9007199254740991], ['true', true], ['False', false], ['TRUE', true],
    ['~', null], ['null', null], ['Null', null], ['', null],
  ]) assert.equal(read(plain), value, plain);
  for (const text of ['1.0.0', 'v1', '0x', '_1', '1-2', '1a', 'claude-opus-5-5', '-text', '?text', 'x,y']) {
    assert.equal(read(text), text);
  }
  // yaml.org/type/timestamp needs a time after a date with one-digit parts, so
  // both versions read this as text; the package's YAML 1.1 schema reads it as a
  // timestamp, so it is refused, which errs on the side of not reading a value.
  refuses('a: 2026-1-5\n', /^line 1, column 4: YAML 1\.2 reads the text "2026-1-5" here and YAML 1\.1 reads a timestamp/);
});

test('plain values the two YAML versions read differently are refused at their line', () => {
  // [plain, what YAML 1.2 Core reads, what YAML 1.1 reads]
  for (const [plain, pattern] of [
    ['yes', /YAML 1\.2 reads the text "yes" here and YAML 1\.1 reads the boolean true/],
    ['No', /YAML 1\.2 reads the text "No" here and YAML 1\.1 reads the boolean false/],
    ['on', /YAML 1\.2 reads the text "on" here and YAML 1\.1 reads the boolean true/],
    ['y', /YAML 1\.2 reads the text "y" here and YAML 1\.1 reads the boolean true/],
    ['012', /YAML 1\.2 reads the number 12 here and YAML 1\.1 reads the number 10/], // 1.1 octal
    ['1_000', /YAML 1\.2 reads the text "1_000" here and YAML 1\.1 reads the number 1000/],
    ['0b101', /YAML 1\.2 reads the text "0b101" here and YAML 1\.1 reads the number 5/],
    ['1:30', /YAML 1\.2 reads the text "1:30" here and YAML 1\.1 reads the number 90/], // 1.1 sexagesimal
    ['0o17', /YAML 1\.2 reads the number 15 here and YAML 1\.1 reads the text "0o17"/], // 1.1 has no 0o form
    ['2026-10-05', /YAML 1\.2 reads the text "2026-10-05" here and YAML 1\.1 reads a timestamp/],
    ['2026-10-05T12:00:00Z', /YAML 1\.2 reads the text "2026-10-05T12:00:00Z" here and YAML 1\.1 reads a timestamp/],
  ]) {
    refuses(`ok: 1\na: ${plain}\n`, new RegExp(`^line 2, column 4: ${pattern.source}`), plain);
    assert.equal(parseYaml(`a: "${plain}"\n`).a, plain, 'its quoted form is text');
  }
});

// The package's YAML 1.1 schema reads these as YAML 1.2 does, while YAML 1.1
// (yaml.org/type/int and /float) reads them as text or as indicators, so the
// compatibility boundary refuses them.
test('the compatibility boundary refuses the plain forms YAML 1.1 reads otherwise', () => {
  // A leading-zero decimal containing 8 or 9 is no YAML 1.1 int (octal needs 0-7, decimal no leading 0).
  // A YAML 1.1 float needs a '.' and, with an exponent, a signed one.
  for (const plain of ['08', '-09', '0189', '1e3', '1E3', '1e+3', '1.5e3', '.5e3']) {
    refuses(`a: ${plain}\n`, new RegExp(`^line 1, column 4: '${plain.replace(/[.+]/g, '\\$&')}' is a number in YAML 1\\.2 but text in YAML 1\\.1`), plain);
    assert.equal(parseYaml(`a: '${plain}'\n`).a, plain, 'its quoted form is text');
  }
  refuses('a:\n  - 1\n  - 08\n', /^line 3, column 5: '08' is a number in YAML 1\.2 but text in YAML 1\.1/);
  reads('a: 1.5e+3\nb: 08.5\nc: 0.5E-1\nd: !!str 08\n', { a: 1500, b: 8.5, c: 0.05, d: '08' }, 'forms both read alike');
  for (const plain of ['=', '<<']) {
    refuses(`a: ${plain}\n`, new RegExp(`^line 1, column 4: a plain '${plain}' is a YAML 1\\.1 indicator`), plain);
    refuses(`a: [x, ${plain}]\n`, new RegExp(`^line 1, column 8: a plain '${plain}' is a YAML 1\\.1 indicator`), `${plain} in a sequence`);
    assert.equal(parseYaml(`a: "${plain}"\n`).a, plain);
  }
  reads('"=": a\n', { '=': 'a' }, 'keys are text, so an = key is the text =');
});

// YAML 1.1 reads a plain '<<' key, tagged or not, as its merge key
// (yaml.org/type/merge), and the package's YAML 1.1 schema then merges it or,
// when its value is no mapping or sequence of mappings, cannot read the source
// at all. YAML 1.2 reads the text '<<'. The boundary refuses the key where it
// is written, before either reading converts it; a quoted '<<' key is text.
test('a plain << key is refused at its position as the YAML 1.1 merge key', () => {
  const merge = new RegExp(/a plain '<<' key is the YAML 1\.1 merge key, not text, and merge keys are not supported; /.source
    + /write the fields to merge into this mapping instead, or quote it if it is text$/.source);
  for (const [text, line, column] of [
    ['<<: x\n', 1, 1], ['<<:\n', 1, 1], ['<<: [1, 2]\n', 1, 1], ['a:\n  <<: [x]\n', 2, 3], ['a: &s x\nb:\n  <<: *s\n', 3, 3],
    ['<<: {a: 1}\n', 1, 1], ['a: &m {k: v}\nb:\n  <<: *m\n', 3, 3], // merges YAML 1.1 can read, still not text
    ['!!str <<: x\n', 1, 7], ['!!str <<: {a: 1}\n', 1, 7], // a tag does not stop YAML 1.1 merging (the key is plain)
    ['{<<: x}\n', 1, 2], ['- [<<: x]\n', 1, 4], ['? <<\n: x\n', 1, 3], ['ok: 1\n<<: x\n', 2, 1],
  ]) {
    refuses(text, new RegExp(`^line ${line}, column ${column}: ${merge.source}`), JSON.stringify(text));
  }
  reads('"<<": x\n', { '<<': 'x' }, 'a quoted << key is text');
  reads("a:\n  '<<': {k: v}\n", { a: { '<<': { k: 'v' } } }, 'a quoted << key with a mapping value is not merged');
});

// Integer forms are read exactly, within the safe integers. Other numbers are
// read as the nearest binary64 double: an approximation that is accepted when
// it is finite, is not an integer beyond the safe integers and is not 0 for a
// nonzero number. Exact decimal text is not kept; quoting keeps it.
test('integer forms are exact within the safe integers and other numbers are bounded approximations', () => {
  const read = (plain) => parseYaml(`a: ${plain}\n`).a;
  for (const [plain, value] of [
    ['9007199254740991', 9007199254740991], ['-9007199254740991', -9007199254740991], ['0x1FFFFFFFFFFFFF', 9007199254740991],
  ]) assert.equal(read(plain), value, `${plain} is an exact integer`);
  for (const [plain, value] of [
    ['0.05', 0.05], ['0.1', 0.1], ['5.0e-2', 0.05], ['.5E-1', 0.05], // no double equals 0.05 or 0.1; these are the nearest
    ['1.0000000000000001', 1], ['9007199254740991.1', 9007199254740991], // rounding within range is accepted
    ['1.5e+3', 1500], ['1.0e+15', 1e15], ['9.007199254740991e+15', 9007199254740991],
    ['4.9e-324', 5e-324], ['-4.9e-324', -5e-324], // the smallest nonzero double, not 0
    ['0.0e+5', 0], ['0.000', 0], // zero written as zero
  ]) assert.equal(read(plain), value, `${plain} reads as the nearest double`);
  assert.equal(parseYaml('a: "0.05"\nb: "1.0000000000000001"\n').b, '1.0000000000000001', 'quoting keeps the exact text');
  for (const [plain, problem] of [
    ['.inf', 'is not a finite number'], ['-.Inf', 'is not a finite number'], ['.nan', 'is not a finite number'],
    ['1.0e+400', 'is not a finite number'],
    ['9007199254740992', 'is too large to read exactly'], ['-9007199254740992', 'is too large to read exactly'],
    ['12345678901234567890', 'is too large to read exactly'], ['0x20000000000000', 'is too large to read exactly'],
    ['9007199254740993.0', 'rounds to 9007199254740992, beyond the safe integers'],
    ['9007199254740991.9', 'rounds to 9007199254740992, beyond the safe integers'],
    ['1.0e+16', 'rounds to 10000000000000000, beyond the safe integers'],
    ['1.0e-400', 'is too small and rounds to 0'], ['-1.0e-400', 'is too small and rounds to 0'],
    ['2.0e-324', 'is too small and rounds to 0'], // below half the smallest nonzero double
  ]) refuses(`a: ${plain}\n`, new RegExp(`^line 1, column 4: '${plain.replace(/[.+]/g, '\\$&')}' ${problem}; quote it if it is text`), plain);
});

test('aliases repeat acyclic values within the alias limit', () => {
  reads('a: &x [1, 2]\nb: *x\nc: &y {k: v}\nd: *y\ne: &z text\nf: *z\n',
    { a: [1, 2], b: [1, 2], c: { k: 'v' }, d: { k: 'v' }, e: 'text', f: 'text' }); // §7.1
  refuses('a: &a\n  - *a\n', /^line 2, column 5: alias \*a is inside the node it names; cyclic data is not accepted/);
  refuses('a: &a {b: *a}\n', /^line 1, column 11: alias \*a is inside the node it names/);
  refuses('a: *nope\n', /^line 1, column 4: alias \*nope has no anchor before it/);
  const ten = (alias) => `[${Array(10).fill(alias).join(', ')}]`;
  const bomb = `a: &a ${ten('x')}\nb: &b ${ten('*a')}\nc: &c ${ten('*b')}\nd: ${ten('*c')}\n`;
  refuses(bomb, /^line 3, column \d+: alias \*b takes alias expansion past the package's maxAliasCount of 100 \(Excessive alias count/);
  // The package counts an anchored node and each alias of it; the product with
  // the nodes it holds (1 for a scalar) may reach 100. So 99 aliases of a scalar
  // read, and the 100th is refused at its own position.
  const many = (count) => `a: &a x\nb: [${Array(count).fill('*a').join(', ')}]\n`;
  assert.deepEqual(parseYaml(many(99)).b, Array(99).fill('x'));
  refuses(many(100), /^line 2, column 401: alias \*a takes alias expansion past the package's maxAliasCount of 100/);
  refuses(`ok: 1\n${many(100)}`, /^line 3, column 401: alias \*a /, 'located in the file, not the first line');
});

// A difference between the two readings inside an alias's copy is located in
// the anchored value, where it is written. Integer-like keys come first in a
// JavaScript object, so the copy under `0:` is compared before its anchor.
test('a difference reached through an alias is located where its value is written', () => {
  const differs = (text) => new RegExp(`^${text}: YAML 1\\.2 reads the text "yes" here and YAML 1\\.1 reads the boolean true; `);
  refuses('a: &x [yes]\n0: *x\n', differs('line 1, column 8'));
  refuses('z: &a [&b [yes]]\n1: *a\n', differs('line 1, column 12'), 'through nested anchors');
  refuses('a:\n  shared: &x {roles: {R1: yes}}\n  1: *x\n', differs('line 2, column 27'), 'in a mapping');
  refuses('b: &x yes\n1: *x\n', differs('line 2, column 4'), 'an alias of the value itself is located at the alias');
  for (const text of ['a: &x [yes]\n0: *x\n', crlf('a: &x [yes]\n0: *x\n')]) {
    assert.throws(() => parseYaml(text, { firstLine: 5 }), (error) => error instanceof YamlError
      && error.line === 5 && error.column === 8 && differs('line 5, column 8').test(error.message), JSON.stringify(text));
  }
});

// YAML separates only with space and tab (§5.5, s-white); the other
// Unicode spaces are ordinary text characters wherever they appear.
const TEXT_SPACES = ['\u00A0', '\u2003'];
const hex = (ch) => ch.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0');

test('a Unicode text space next to a key or its colon is part of the text', () => {
  for (const space of TEXT_SPACES) {
    reads(`a${space}: x\n`, { [`a${space}`]: 'x' }, `U+${hex(space)} before ':'`);
    reads(`${space}a: x\n`, { [`${space}a`]: 'x' }, `U+${hex(space)} starting a key`);
    // ':' followed by a text space does not indicate a value (§7.3.3), so the line is one plain scalar.
    reads(`a:${space}x\n`, `a:${space}x`, `U+${hex(space)} after ':'`);
  }
});

test('a Unicode text space after a quoted scalar or in a block scalar header is refused', () => {
  for (const space of TEXT_SPACES) {
    // Only white space and a comment may follow a quoted scalar (§7.3), or a block header (§8.1.1).
    refuses(`a: "x"${space}\n`, new RegExp(`^line 1, column 7: .*\\(UNEXPECTED_TOKEN\\); the line is "a: "x"\\\\u${hex(space)}" `
      + `with U\\+${hex(space)} written as \\\\uXXXX`), `quoted U+${hex(space)}`);
    refuses(`a: 'x'${space}\n`, /^line 1, column 7: .*UNEXPECTED_TOKEN/);
    refuses('a: "x" y\n', /^line 1, column 8: .*UNEXPECTED_TOKEN/, 'ordinary text after a quoted scalar');
    refuses(`a: |${space}\n  x\n`, /^line 1, column 5: Block scalar header includes extra characters/);
    refuses(`a: >-${space}\n  x\n`, /^line 1, column 6: Block scalar header includes extra characters/);
  }
});

test('a folded line starting with a Unicode text space is folded like any text line', () => {
  // Only lines starting with white space are more indented (§8.1.3, §6.5).
  for (const space of TEXT_SPACES) {
    reads(`a: >\n  x\n  ${space}y\n  z\n`, { a: `x ${space}y z\n` }, `U+${hex(space)}`);
  }
  reads('a: >\n  x\n   y\n  z\n', { a: 'x\n y\nz\n' }, 'a line starting with a space is more indented');
});

test('Unicode text spaces stay part of plain values, before # as well', () => {
  for (const space of TEXT_SPACES) {
    for (const [value, expected] of [
      [`x${space}#y`, `x${space}#y`], // '#' starts a comment only after white space (§6.6)
      [`x${space} # comment`, `x${space}`],
      [`x${space}`, `x${space}`],
      [`${space}x`, `${space}x`],
      [`-${space}x`, `-${space}x`], // an indicator followed by a text space starts plain text (§7.3.3)
      [`?${space}x`, `?${space}x`],
    ]) reads(`a: ${value}\nb:\n  - ${value}\n`, { a: expected, b: [expected] }, JSON.stringify(value));
  }
  reads('a: x #y\nb: x\t#y\nc:   x   \n', { a: 'x', b: 'x', c: 'x' });
});

test('characters YAML 1.1 reads as line breaks are refused, while their escapes are read', () => {
  for (const [ch, escape] of [['\u0085', 'N'], ['\u2028', 'L'], ['\u2029', 'P']]) {
    const message = new RegExp(`^line 1, column 5: U\\+${hex(ch)} is a line break in YAML 1\\.1 but text in YAML 1\\.2.*`
      + `write it as \\\\${escape} or \\\\u${hex(ch)}`);
    refuses(`a: x${ch}y\n`, message, `plain U+${hex(ch)}`);
    refuses(`a: "${ch}"\n`, message, `quoted U+${hex(ch)}`);
    // \N, \L and \P are escapes in YAML 1.1 (§5.6) and 1.2 (§5.7) alike.
    reads(`a: "x\\${escape}y"\nb: "x\\u${hex(ch)}y"\n`, { a: `x${ch}y`, b: `x${ch}y` }, `escaped U+${hex(ch)}`);
  }
  refuses('a: 1 # x\u0085\n', /^line 1, column 9: U\+0085 is a line break in YAML 1\.1/, 'in a comment');
});

// YAML admits only printable characters in its source (§5.1, c-printable). A
// C0 control other than tab, line feed and carriage return is excluded even
// inside quotes (§7.3, nb-json), so it is refused wherever it appears. DEL,
// the C1 controls other than U+0085, U+FFFE, U+FFFF and an unpaired surrogate
// are admitted only inside quotes, and refused in plain scalars, block
// scalars, comments and anchor and alias names (§6.9.2, ns-anchor-char). An
// escape is not such a character in the source (§5.7). The advice for a
// refused character fits the place it is in.
const C0 = ['\u0000', '\u0001', '\u0007', '\u0008', '\u000B', '\u000C', '\u000E', '\u001B', '\u001F'];
const QUOTED_ONLY = ['\u007F', '\u0080', '\u0084', '\u0086', '\u009F', '\uFFFE', '\uFFFF'];
const SURROGATES = ['\uD800', '\uDBFF', '\uDC00', '\uDFFF'];
const REMEDY = {
  value: 'remove it, or quote the text that holds it',
  comment: 'remove it from the comment',
  anchor: 'remove it from the anchor name',
  alias: 'remove it from the alias name',
};

// [text with X where the character goes, line, column, the place's remedy]
const CHECKED_PLACES = [
  ['a: xXy\n', 1, 5, 'value'], ['kX: v\n', 1, 2, 'value'], ['a: [p, qX]\n', 1, 9, 'value'], ['a: x\n  yX\n', 2, 4, 'value'], // plain values and keys
  ['a: |\n  xX\n', 2, 4, 'value'], ['a: >\n  x\n  yX\n', 3, 4, 'value'], ['a: |-\n  x\n\n   X\n', 4, 4, 'value'], // block scalar content
  ['a: 1 # X\n', 1, 8, 'comment'], ['# X\na: 1\n', 1, 3, 'comment'], ['a: | # X\n  x\n', 1, 8, 'comment'], // comments
  ['a: [x, # X\n  y]\n', 1, 10, 'comment'], ['a: 1\n... # X\n', 2, 7, 'comment'],
  ['a: &nX v\n', 1, 6, 'anchor'], ['&kX k: v\n', 1, 3, 'anchor'], ['a: [&nX 1]\n', 1, 7, 'anchor'], ['a: &nX |\n  x\n', 1, 6, 'anchor'],
  ['a: &n v\nb: *nX\n', 2, 6, 'alias'], ['a: &n v\nb: [*nX]\n', 2, 7, 'alias'], // anchor and alias names
];

test('C0 controls other than tab, line feed and carriage return are refused everywhere, quoted text included', () => {
  for (const ch of C0) {
    const message = new RegExp(`U\\+${hex(ch)} is a control character, which YAML does not accept anywhere in its source; `
      + `remove it, or inside a double-quoted value write it as \\\\u${hex(ch)}$`);
    for (const [text, line, column] of [
      ...CHECKED_PLACES, ['a: "xX"\n', 1, 6], ["a: 'xX'\n", 1, 6], ['a: "x\n  yX"\n', 2, 4], ['"kX": v\n', 1, 3],
    ]) {
      refuses(text.replace('X', ch), new RegExp(`^line ${line}, column ${column}: ${message.source}`), `U+${hex(ch)} in ${JSON.stringify(text)}`);
    }
  }
});

test('DEL, C1 controls, U+FFFE, U+FFFF and unpaired surrogates are refused outside quotes, with advice for the place', () => {
  for (const ch of QUOTED_ONLY) {
    for (const [text, line, column, place] of CHECKED_PLACES) {
      const message = `U\\+${hex(ch)} is not a printable character, which YAML accepts only inside quotes; ${REMEDY[place]}$`;
      refuses(text.replace('X', ch), new RegExp(`^line ${line}, column ${column}: ${message}`), `U+${hex(ch)} in ${JSON.stringify(text)}`);
    }
  }
  for (const ch of SURROGATES) {
    for (const [text, line, column] of CHECKED_PLACES) {
      refuses(text.replace('X', ch), new RegExp(`^line ${line}, column ${column}: U\\+${hex(ch)} is half of a surrogate pair without its other half, `
        + 'which is not a character; remove it$'), `U+${hex(ch)} in ${JSON.stringify(text)}`);
    }
  }
  refuses('a: x\u007Fy\u0001\n', /^line 1, column 5: U\+007F /, 'the first refused character is reported');
  refuses('a: x\u0085\u007F\n', /^line 1, column 5: U\+0085 is a line break in YAML 1\.1/, 'U+0085 keeps its own refusal');
});

// A byte order mark may open the source (§5.2); elsewhere YAML admits it only
// inside quotes (§5.4, nb-char), and it is refused where the characters above
// are, as a byte order mark, which is printable but misplaced.
test('a byte order mark is read at the start of the source and in quotes, and refused elsewhere', () => {
  for (const [text, line, column, place] of CHECKED_PLACES) {
    refuses(text.replace('X', '\uFEFF'), new RegExp(`^line ${line}, column ${column}: U\\+FEFF is a byte order mark, which YAML accepts only `
      + `at the start of its source or inside quotes; ${REMEDY[place]}$`), `U+FEFF in ${JSON.stringify(text)}`);
  }
  refuses('\uFEFF\uFEFFa: 1\n', /^line 1, column 2: U\+FEFF is a byte order mark/, 'only the first opens the source');
  reads('\uFEFFa: 1\n', { a: 1 }, 'a leading byte order mark');
  reads('\uFEFF# c\na: |\n  x\n', { a: 'x\n' }, 'a leading byte order mark before a comment');
  reads('a: "x\uFEFF"\nb: \'\uFEFFy\'\n"k\uFEFF": v\nc: "\\uFEFF"\n', { a: 'x\uFEFF', b: '\uFEFFy', 'k\uFEFF': 'v', c: '\uFEFF' },
    'quoted and escaped byte order marks are text');
});

test('quoted text, escapes, supplementary characters, tabs and anchor names stay readable', () => {
  for (const ch of QUOTED_ONLY) {
    reads(`a: "x${ch}"\nb: 'y${ch}'\n"k${ch}": v\n`, { a: `x${ch}`, b: `y${ch}`, [`k${ch}`]: 'v' }, `quoted U+${hex(ch)}`);
  }
  reads('a: "\\0\\a\\e\\x01\\x7F\\u0080\\u009F\\uFFFE\\uFFFF\\U0001F600\\uD83D\\uDE00"\n',
    { a: '\u0000\u0007\u001B\u0001\u007F\u0080\u009F\uFFFE\uFFFF\u{1F600}\u{1F600}' }, 'escapes are read');
  const supplementary = '\u{1F600}\u{10FFFF}\u{1FFFE}';
  reads(`a: x${supplementary}\nb: |\n  ${supplementary}\nc: "${supplementary}" # ${supplementary}\n`,
    { a: `x${supplementary}`, b: `${supplementary}\n`, c: supplementary }, 'surrogate pairs are characters');
  reads('a: x\ty\nb: "x\ty"\nc: |\n  x\ty\n# \t comment\n', { a: 'x\ty', b: 'x\ty', c: 'x\ty\n' }, 'tab is printable');
  reads('a: x\u00A0\uD7FF\uE000\uFFFD\n', { a: 'x\u00A0\uD7FF\uE000\uFFFD' }, 'printable characters next to the refused ranges');
  reads(`a: &n.1-é${supplementary} x\nb: *n.1-é${supplementary}\nc: [&q "y\u0080", *q]\n`,
    { a: 'x', b: 'x', c: ['y\u0080', 'y\u0080'] }, 'anchor and alias names of printable characters');
});

// The checked spans are found in source order, also where one holds another
// (a block scalar's span holds the comment after its header), and quoted text
// between them stays readable however many spans there are; the first refused
// character is the one reported.
test('refused characters are found among nested and many spans, the first one reported', () => {
  const refused = (line, column, place) => new RegExp(`^line ${line}, column ${column}: U\\+007F is not a printable character, `
    + `which YAML accepts only inside quotes; ${REMEDY[place]}$`);
  refuses('a: | # c\n  x\u007Fy\n', refused(2, 4, 'value'), 'block content after a header comment');
  refuses('a: | # c\u007F\n  x\n', refused(1, 9, 'comment'), 'in the header comment');
  refuses('a: | # c\n  x\nb: "\u007F"\nc: y\u007F\n', refused(4, 5, 'value'), 'after the block, past quoted text');
  refuses('a: [x, # c\n  y\u007F]\n', refused(2, 4, 'value'), 'a later item after a flow comment');
  refuses('a: [x, # c\u007F\n  y]\n', refused(1, 11, 'comment'), 'in a flow comment');
  reads('a: [x, # c\n  "y\u007F", z]\n', { a: ['x', 'y\u007F', 'z'] }, 'quoted text after a flow comment');
  refuses('a: | # c\u0080\n  x\u007F\n', /^line 1, column 9: U\+0080 /, 'the comment before the content');
  refuses('a: x\u007F\nb: | # \u0080\n  y\u0081\n', /^line 1, column 5: U\+007F /, 'the value before the block');

  const count = 300;
  const lines = Array.from({ length: count }, (_, i) => `k${i}: "\u0080v${i}\u007F" # c${i}`);
  const many = `${lines.join('\n')}\n`;
  reads(many, Object.fromEntries(lines.map((_, i) => [`k${i}`, `\u0080v${i}\u007F`])), 'quoted text between many spans');
  refuses(many.replace('k0', 'k\u007F0'), refused(1, 2, 'value'), 'in the first span');
  refuses(`${many}last: z\u007F\n`, refused(count + 1, 8, 'value'), 'at the end of the last span');
  refuses(`${many}# c\u007F\n`, refused(count + 1, 4, 'comment'), 'in a last comment');
  refuses(`${many}b: | # c\n  x\u007Fy\n`, refused(count + 2, 4, 'value'), 'in a last block after its header comment');
  reads(`${many}last: "z\u007F"\n`, { ...parseYaml(many), last: 'z\u007F' }, 'quoted after the last span');
});

test('errors carry the line and column in the file and show text spaces on the refused line', () => {
  assert.throws(() => parseYaml('a: 1\na: 2\n', { firstLine: 2 }), /^YamlError: line 3, column 1: Map keys must be unique/);
  let error;
  try { parseYaml('a: 1\n\u00A0\u2003\u00A0\nb: 2\n'); } catch (caught) { error = caught; }
  assert.ok(error instanceof YamlError);
  assert.deepEqual([error.line, error.column], [2, 1]);
  assert.match(error.message, /the line is "\\u00A0\\u2003\\u00A0" with U\+00A0 and U\+2003 written as \\uXXXX: they look like spaces /);
  assert.throws(() => parseYaml('a: 1\n b: 2\n'), (e) => e instanceof YamlError && !/the line is/.test(e.message),
    'a line without text spaces keeps the plain message');
});

// A tab separates but never indents (§6.1). A line of spaces and tabs alone is
// blank between entries (§6.6, l-comment), but a line holding a text space is
// not blank, so a tab before it is indentation and the line is refused (with
// the text space written out); spaces before a text space indent it as content.
test('tabs separate but never indent', () => {
  reads('a:\tb\nc: x\t# comment\n', { a: 'b', c: 'x' });
  refuses('a:\n\tb: c\n', /^line 2, column 1: Tabs are not allowed as indentation \(TAB_AS_INDENT\)$/);
  for (const space of TEXT_SPACES) {
    const shown = `the line is "\\t\\\\u${hex(space)}" with U\\+${hex(space)} written as \\\\uXXXX: it looks like a space`;
    refuses(`a: 1\n\t${space}\nb: 2\n`, new RegExp(`^line 2, column 1: Tabs are not allowed as indentation \\(TAB_AS_INDENT\\); ${shown}`),
      `mapping U+${hex(space)}`);
    refuses(`a: |\n\t${space}\n  x\n`,
      new RegExp(`^line 2, column 1: Block scalar values in collections must be indented \\(BAD_INDENT\\); ${shown}`), `block U+${hex(space)}`);
    refuses(`a: >\n  x\n\t${space}\n  y\n`, new RegExp(`^line 3, column 1: .*; ${shown}`), `folded U+${hex(space)} after content`);
    reads(`a: |\n  ${space}x\nb: >\n  ${space}y\n`, { a: `${space}x\n`, b: `${space}y\n` }, `space-indented U+${hex(space)} is content`);
  }
  reads('a: 1\n\t\nb: 2\n \t \nc: 3\n', { a: 1, b: 2, c: 3 }, 'tab-only and space-tab-space lines between entries are blank');
  reads('a: |\n  x\n\n  y\nb: >\n  x\n \n  y\nc: |\n  x\n  \t\n  y\n', { a: 'x\n\ny\n', b: 'x\ny\n', c: 'x\n\t\ny\n' },
    'empty lines of spaces stay empty and a tab after the content indentation is content');
  // Intentionally refused, not read as an empty line: inside a block scalar an
  // empty line may hold only spaces, at most the content indentation (§8.1.1.1,
  // l-empty with s-indent(<=n)), and a content line starts with that
  // indentation in spaces (§8.1.2, §8.1.3). A tab-only line less indented than
  // the content is neither, in literal and folded scalars alike.
  for (const header of ['|', '>']) {
    refuses(`a: ${header}\n  x\n\t\n  y\n`, /^line 3, column 1: Block scalar lines must not be less indented than their first line \(BAD_INDENT\)$/,
      `under-indented tab-only line in ${header}`);
  }
});
