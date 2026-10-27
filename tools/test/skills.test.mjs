import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { PACKAGE_SKILLS } from '../lib/install.mjs';
import { splitFrontmatter, validateSkill } from '../lib/skills.mjs';
import { parseYaml } from '../lib/yaml.mjs';

// Canonical, like the validator's own source root, so the exact output comparison
// below holds when the tests are started through a symlink or case-variant path.
const packageRoot = fs.realpathSync.native(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..'));
const validator = path.join(packageRoot, 'tools', 'validate.mjs');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'aw skills é-'));
after(() => fs.rmSync(scratch, { recursive: true, force: true }));

function skill(name, content, dirName = name) {
  const dir = path.join(scratch, `${Object.keys(fixtures).indexOf(name)}-case`, dirName);
  fs.mkdirSync(dir, { recursive: true });
  if (content !== null) fs.writeFileSync(path.join(dir, 'SKILL.md'), content);
  return dir;
}

const body = '\n# Title\n\nInstructions.\n';
const fm = (lines) => `---\n${lines.join('\n')}\n---\n${body}`;
const longName = 'a'.repeat(65);

// name -> [SKILL.md content or null, expected problem pattern, directory name]
const fixtures = {
  'no-skill-file': [null, /SKILL\.md not found/],
  'no-frontmatter': ['# Title\n', /No YAML frontmatter/],
  'unclosed-frontmatter': ['---\nname: unclosed-frontmatter\n', /no closing ---/],
  'malformed-yaml': [fm(['name: malformed-yaml', 'description: [unclosed']), /Invalid YAML/],
  'not-a-mapping': [fm(['- a', '- b']), /must be a YAML mapping/],
  'unexpected-key': [fm(['name: unexpected-key', 'description: d', 'compatibility: x']), /Unexpected key\(s\).*compatibility/],
  'missing-name': [fm(['description: d']), /Missing 'name'/],
  'numeric-name': [fm(['name: 123', 'description: d']), /Name must be a string, got number/, '123'],
  'Upper-Case': [fm(['name: Upper-Case', 'description: d']), /hyphen-case/],
  'double--hyphen': [fm(['name: double--hyphen', 'description: d']), /consecutive hyphens/],
  [longName]: [fm([`name: ${longName}`, 'description: d']), /Name is too long \(65/],
  'wrong-dir': [fm(['name: other-name', 'description: d']), /does not match its directory 'wrong-dir'/],
  'missing-description': [fm(['name: missing-description']), /Missing 'description'/],
  'empty-description': [fm(['name: empty-description', 'description: ""']), /Description must not be empty/],
  'angle-brackets': [fm(['name: angle-brackets', 'description: use <tag>']), /angle brackets/],
  'long-description': [fm(['name: long-description', `description: ${'d'.repeat(1025)}`]), /Description is too long \(1025/],
  'todo-description': [fm(['name: todo-description', 'description: "[TODO: describe]"']), /unfinished TODO placeholder/],
  'todo-body': [`---\nname: todo-body\ndescription: d\n---\n\n[TODO: write instructions]\n`, /instructions contain an unfinished TODO/],
  'todo-after-fence': [`---\nname: todo-after-fence\ndescription: d\n---\n\n\`\`\`md\nx\n\`\`\`\n[TODO: real]\n`, /unfinished TODO/],
  'bad-metadata': [fm(['name: bad-metadata', 'description: d', 'metadata: text']), /metadata must be a mapping/],
  // 0x10 is the integer 16 in YAML 1.2 Core and in YAML 1.1 (yaml.org/type/int), so it is not text.
  'hex-description': [fm(['name: hex-description', 'description: 0x10']), /Description must be a string, got number/],
  'yes-description': [fm(['name: yes-description', 'description: yes']), /line 3, column 14: YAML 1\.2 reads the text "yes" here and YAML 1\.1 reads the boolean true/],
  'proto-key': [fm(['name: proto-key', 'description: d', '__proto__:', '  license: MIT']), /Unexpected key\(s\) in frontmatter: __proto__/],
  'proto-only': [fm(['__proto__:', '  name: proto-only', '  description: d']), /Missing 'name'/],
  'proto-metadata': [fm(['name: proto-metadata', 'description: d', 'metadata:', '  __proto__: 1']), /metadata must be a mapping of string/],
  // A mapping used as a key cannot become text without losing its structure.
  'explicit-key': [fm(['name: explicit-key', 'description: d', '? owner: me']), /line 4, column \d+: With stringKeys, all keys must be strings/],
  'tab-explicit-key': [fm(['name: tab-explicit-key', 'description: d', 'metadata:', '  ?\towner: me']), /line 5, column \d+: Tabs are not allowed as indentation/],
  'keyless-value': [fm(['name: keyless-value', 'description: d', 'metadata:', '  : owner: me']), /line 5, column \d+: /],
  'empty-key': [fm(['name: empty-key', 'description: d', ': me']), /line 4, column 1: a mapping entry needs a key/],
  'duplicate-key': [fm(['name: duplicate-key', 'description: d', 'name: again']), /line 4, column 1: Map keys must be unique/],
  'second-document': [fm(['name: second-document', 'description: d', '...', 'license: MIT']), /line 5, column 1: a second document starts here/],
  'nel-description': [fm(['name: nel-description', 'description: a\u0085b']), /line 3, column 15: U\+0085 is a line break in YAML 1\.1/],
  'nbsp-key': [fm(['name\u00A0: nbsp-key', 'description: d']),
    /Unexpected key\(s\) in frontmatter: 'name\\u00A0' \(U\+00A0 written as \\uXXXX\)\. Allowed/],
  'nbsp-hash-description': [fm(['name: nbsp-hash-description', `description: x\u00A0#${'y'.repeat(1100)}`]),
    /Description is too long \(1103 characters\)/],
  'tab-nbsp-description': [fm(['name: tab-nbsp-description', 'description: |', '\t\u00A0', '  x']),
    /line 4, column 1: Block scalar values in collections must be indented \(BAD_INDENT\); the line is "\t\\u00A0"/],
  'tab-emsp-key': [fm(['name: tab-emsp-key', 'description: d', '\t\u2003: x']),
    /line 4, column 1: Tabs are not allowed as indentation \(TAB_AS_INDENT\); the line is "\t\\u2003: x"/],
  'merge-key': [fm(['name: merge-key', 'description: d', 'metadata:', '  <<: owner']),
    /^Invalid YAML in frontmatter: line 5, column 3: a plain '<<' key is the YAML 1\.1 merge key, not text/],
  'tagged-merge-key': [fm(['name: tagged-merge-key', 'description: d', 'metadata:', '  !!str <<: {owner: me}']),
    /^Invalid YAML in frontmatter: line 5, column 9: a plain '<<' key is the YAML 1\.1 merge key/],
  'alias-expansion': [fm(['name: alias-expansion', 'description: d', `a: &a [${Array(10).fill('x')}]`,
    `b: &b [${Array(10).fill('*a')}]`, `c: &c [${Array(10).fill('*b')}]`, `d: [${Array(10).fill('*c')}]`]),
    /^Invalid YAML in frontmatter: line 6, column \d+: alias \*b takes alias expansion past the package's maxAliasCount of 100/],
  'control-description': [fm(['name: control-description', 'description: a\u0001b']),
    /^Invalid YAML in frontmatter: line 3, column 15: U\+0001 is a control character/],
  'quoted-control-description': [fm(['name: quoted-control-description', 'description: "a\u0007b"']),
    /^Invalid YAML in frontmatter: line 3, column 16: U\+0007 is a control character/],
  'del-description': [fm(['name: del-description', 'description: a\u007Fb']),
    /^Invalid YAML in frontmatter: line 3, column 15: U\+007F is not a printable character/],
  'c1-comment': [fm(['name: c1-comment # \u0090', 'description: d']), /^Invalid YAML in frontmatter: line 2, column 20: U\+0090 /],
};

for (const [name, [content, pattern, dirName]] of Object.entries(fixtures)) {
  test(`rejects ${name.length > 40 ? 'an over-long name' : name}`, () => {
    const problems = validateSkill(skill(name, content, dirName));
    assert.ok(problems.some((p) => pattern.test(p)), `expected ${pattern}, got ${JSON.stringify(problems)}`);
  });
}

test('accepts every installable package skill', () => {
  for (const skill of PACKAGE_SKILLS) {
    assert.deepEqual(validateSkill(path.join(packageRoot, 'skills', skill)), [], skill);
  }
});

test('ignores placeholders inside fenced examples and accepts CRLF and optional keys', () => {
  const dir = path.join(scratch, 'valid', 'fenced-example');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'SKILL.md'), [
    '---',
    'name: fenced-example',
    'description: A complete skill whose examples show placeholders.',
    'license: MIT',
    'allowed-tools:',
    '  - Read',
    'metadata:',
    '  owner: me',
    '---',
    '',
    '````markdown',
    '[TODO: inside a longer fence]',
    '```',
    '[TODO: still inside, the inner fence is shorter]',
    '````',
    '- ~~~text',
    '  [TODO: list-item fence]',
    '  ~~~',
    '',
  ].join('\r\n'));
  assert.deepEqual(validateSkill(dir), []);
});

test('frontmatter may continue a value on later lines and use flow collections', () => {
  const dir = path.join(scratch, 'valid', 'multi-line');
  fs.mkdirSync(dir, { recursive: true });
  // A plain value continued on more-indented lines is folded into one line (YAML 1.2 §7.3.3).
  fs.writeFileSync(path.join(dir, 'SKILL.md'), fm(['name: multi-line', 'description:', '  on the next line', '  and one more',
    'allowed-tools: [Read, Grep]', 'metadata: {owner: me}']));
  assert.deepEqual(validateSkill(dir), []);
  const too = path.join(scratch, 'valid', 'too-long', 'too-long');
  fs.mkdirSync(too, { recursive: true });
  fs.writeFileSync(path.join(too, 'SKILL.md'), fm(['name: too-long', 'description:', `  ${'d'.repeat(600)}`, `  ${'d'.repeat(600)}`]));
  assert.deepEqual(validateSkill(too), ['Description is too long (1201 characters). Maximum is 1024.'], 'the folded value is checked');
});

test('quoted forms of refused plain values are text', () => {
  const dir = path.join(scratch, 'valid', 'quoted-values');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'SKILL.md'), fm(['name: quoted-values', 'description: "0x10"', "license: '2026-10-05'",
    'metadata: {"<<": me}']));
  assert.deepEqual(validateSkill(dir), []);
});

test('quoted DEL and C1 text, escaped controls and supplementary characters pass validation', () => {
  const dir = path.join(scratch, 'valid', 'quoted-characters');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'SKILL.md'), fm(['name: quoted-characters', 'description: "a\u007F\u0090b \\a\\x01"',
    "license: 'c\u009Fd'", 'metadata:', '  emoji: \u{1F600} plain # \u{1F600}']));
  assert.deepEqual(validateSkill(dir), []);
});

test('the command exits 0 for valid skills and 1 for invalid ones', () => {
  const valid = spawnSync(process.execPath, [validator], { encoding: 'utf8' });
  assert.equal(valid.status, 0, valid.stderr);
  const packageSkills = fs.readdirSync(path.join(packageRoot, 'skills'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(packageRoot, 'skills', entry.name))
    .sort();
  assert.deepEqual(valid.stdout.trim().split('\n'), packageSkills.map((dir) => `ok      ${dir}`));
  // The validator enumerates `skills/*`; the installer uses PACKAGE_SKILLS. A valid skill directory
  // outside every installable set would pass validation and never be installed, and a registered
  // skill without a directory would never validate, so the two inventories must have the same
  // members, not merely the same count.
  assert.deepEqual(packageSkills.map((dir) => path.basename(dir)).sort(), [...PACKAGE_SKILLS].sort(),
    'every skill directory belongs to an installable set and every registered skill has a directory');

  const invalidDir = skill('malformed-yaml', fixtures['malformed-yaml'][0]);
  const invalid = spawnSync(process.execPath, [validator, invalidDir], { encoding: 'utf8' });
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /FAIL .*Invalid YAML/);
  for (const [name, pattern] of [['explicit-key', /line 4, column \d+: With stringKeys/], ['nbsp-hash-description', /too long \(1103/]]) {
    const result = spawnSync(process.execPath, [validator, skill(name, fixtures[name][0])], { encoding: 'utf8' });
    assert.equal(result.status, 1, name);
    assert.match(result.stderr, pattern, name);
  }

  // Every refusal is a located problem of its skill; the skills after it are still validated.
  const refused = ['tagged-merge-key', 'alias-expansion', 'del-description'].map((name) => skill(name, fixtures[name][0]));
  const continued = spawnSync(process.execPath, [validator, ...refused, path.join(packageRoot, 'skills', PACKAGE_SKILLS[0])], { encoding: 'utf8' });
  assert.equal(continued.status, 1);
  assert.deepEqual(continued.stderr.trim().split('\n').map((line) => line.replace(/^FAIL {4}.*?: Invalid YAML in frontmatter: (line \d+), .*$/, '$1')),
    ['line 5', 'line 6', 'line 3'], continued.stderr);
  assert.equal(continued.stdout, `ok      ${path.join(packageRoot, 'skills', PACKAGE_SKILLS[0])}\n`);

  for (const option of ['-h', '--help', '--bogus']) {
    const help = spawnSync(process.execPath, [validator, option], { encoding: 'utf8' });
    assert.equal(help.status, 2, option);
    assert.match(help.stderr, /^usage: node tools\/validate\.mjs/, option);
  }
});

// SKILL.md is UTF-8 (yaml.mjs): bytes that are not UTF-8 are a problem of
// their skill instead of U+FFFD in its metadata, and the skills after it are
// still validated; a leading byte order mark and an encoded U+FFFD are read.
test('a SKILL.md that is not UTF-8 is a problem of its skill, and valid UTF-8 is read as written', () => {
  const notUtf8 = ['SKILL.md is not valid UTF-8; save it as UTF-8'];
  const dirs = [];
  for (const [name, bytes] of [
    ['latin-1', [0xE9]], ['cp1252-quote', [0x93]], ['overlong', [0xC0, 0xAF]], ['surrogate', [0xED, 0xA0, 0x80]], ['truncated', [0xE2, 0x82]],
  ]) {
    const dir = path.join(scratch, 'utf8', name, 'not-utf8');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'SKILL.md'),
      Buffer.concat([Buffer.from('---\nname: not-utf8\ndescription: caf'), Buffer.from(bytes), Buffer.from(`\n---\n${body}`)]));
    assert.deepEqual(validateSkill(dir), notUtf8, name);
    dirs.push(dir);
  }
  const valid = path.join(scratch, 'utf8', 'valid', 'valid-utf8');
  fs.mkdirSync(valid, { recursive: true });
  fs.writeFileSync(path.join(valid, 'SKILL.md'), Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]),
    Buffer.from(`---\nname: valid-utf8\ndescription: caf\u00E9 \uFFFD "\uFFFD"\n---\n${body}`, 'utf8')]));
  assert.deepEqual(validateSkill(valid), []);
  const { yaml } = splitFrontmatter(fs.readFileSync(path.join(valid, 'SKILL.md'), 'utf8').replace(/^\uFEFF/, ''));
  assert.equal(parseYaml(yaml).description, 'caf\u00E9 \uFFFD "\uFFFD"', 'an encoded U+FFFD is text');

  const continued = spawnSync(process.execPath, [validator, dirs[0], valid], { encoding: 'utf8' });
  assert.equal(continued.status, 1);
  assert.equal(continued.stderr, `FAIL    ${dirs[0]}: ${notUtf8[0]}\n`);
  assert.equal(continued.stdout, `ok      ${valid}\n`);
});

// Anchor and alias names, byte order marks and differences reached through an
// alias, located in the SKILL.md file (its YAML starts on line 2).
test('frontmatter anchors, aliases, byte order marks and alias copies are refused at their line, LF and CRLF', () => {
  const printable = (code) => `U\\+${code} is not a printable character, which YAML accepts only inside quotes; `;
  const bom = 'U\\+FEFF is a byte order mark, which YAML accepts only at the start of its source or inside quotes; ';
  for (const [name, lines, line, column, problem] of [
    ['del-anchor', ['name: del-anchor', 'description: &d\u007F d'], 3, 16, `${printable('007F')}remove it from the anchor name`],
    ['c1-alias', ['name: c1-alias', 'description: &d d', 'license: *d\u0090'], 4, 12, `${printable('0090')}remove it from the alias name`],
    ['bom-alias', ['name: bom-alias', 'description: &d d', 'license: *d\uFEFF'], 4, 12, `${bom}remove it from the alias name`],
    ['bom-plain', ['name: bom-plain', 'description: a\uFEFFb'], 3, 15, `${bom}remove it, or quote the text that holds it`],
    ['bom-block', ['name: bom-block', 'description: |', '  a\uFEFFb'], 4, 4, `${bom}remove it, or quote the text that holds it`],
    ['bom-comment', ['name: bom-comment # \uFEFF', 'description: d'], 2, 21, `${bom}remove it from the comment`],
    ['alias-difference', ['name: alias-difference', 'description: d', 'metadata: &m [yes]', '0: *m'], 4, 15,
      'YAML 1\\.2 reads the text "yes" here and YAML 1\\.1 reads the boolean true; write it so both read the same'],
  ]) {
    for (const [form, content] of [['LF', fm(lines)], ['CRLF', fm(lines).replace(/\n/g, '\r\n')]]) {
      const dir = path.join(scratch, 'located', form, name);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'SKILL.md'), content);
      const problems = validateSkill(dir);
      assert.equal(problems.length, 1, `${name} (${form}): ${JSON.stringify(problems)}`);
      assert.match(problems[0], new RegExp(`^Invalid YAML in frontmatter: line ${line}, column ${column}: ${problem}`), `${name} (${form})`);
    }
  }
});

test('a malformed plain start in frontmatter fails validation with its line', () => {
  for (const [index, value] of ['- text', ']text', '?'].entries()) {
    const dir = path.join(scratch, 'malformed-start', String(index), 'malformed-start');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'SKILL.md'), fm(['name: malformed-start', `description: ${value}`]));
    const problems = validateSkill(dir);
    assert.ok(problems.some((p) => /^Invalid YAML in frontmatter: line 3, column 14: /.test(p)),
      `${value}: ${JSON.stringify(problems)}`);
  }
});

test('text spaces in descriptions are text, while space and tab still start comments', () => {
  const problems = (name, description) => {
    const dir = path.join(scratch, 'text-spaces', name, name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'SKILL.md'), fm([`name: ${name}`, `description: ${description}`]));
    return validateSkill(dir);
  };
  const tail = 'y'.repeat(1100);
  assert.deepEqual(problems('quoted-hash', `"x\u00A0#${tail}"`), ['Description is too long (1103 characters). Maximum is 1024.']);
  assert.deepEqual(problems('space-comment', `x #${tail}`), [], 'a real comment is not description text');
  assert.deepEqual(problems('tab-comment', `x\t#${tail}`), []);
  assert.deepEqual(problems('question-nbsp', '?\u00A0marks a question'), []);
  assert.deepEqual(problems('dash-ideographic', '-\u3000a dash'), []);
});

test('a block scalar ending the frontmatter keeps its real final line break', () => {
  const read = (lines, eol = '\n') => parseYaml(splitFrontmatter(`---${eol}${lines.join(eol)}${eol}---${eol}body${eol}`).yaml).d;
  assert.equal(read(['d: |', '  text']), 'text\n');
  assert.equal(read(['d: |-', '  text']), 'text');
  assert.equal(read(['d: |+', '  text', '']), 'text\n\n');
  assert.equal(read(['d: >', '  a', '  b'], '\r\n'), 'a b\n');
  assert.equal(splitFrontmatter('---\nd: x\n---\nbody\n').body, 'body\n');

  const dir = path.join(scratch, 'valid', 'block-description');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'SKILL.md'), fm(['name: block-description', 'description: |', '  Text on its own line.']));
  assert.deepEqual(validateSkill(dir), []);
});
