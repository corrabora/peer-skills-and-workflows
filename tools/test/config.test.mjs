import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { checkLayer, operatorLayer, resolveConfiguration, ROLES, SEATS } from '../lib/config.mjs';
import { machineBase, repositoryKey } from '../lib/paths.mjs';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const resolver = path.join(packageRoot, 'tools', 'resolve.mjs');
const scratch = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'aw config é-')));
after(() => fs.rmSync(scratch, { recursive: true, force: true }));

function checkout(name, files = {}) {
  const dir = path.join(scratch, name);
  fs.mkdirSync(path.join(dir, '.git'), { recursive: true });
  for (const [file, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), text);
  }
  return dir;
}

function resolve(args, cwd = scratch, env = process.env) {
  const result = spawnSync(process.execPath, [resolver, ...args], { cwd, env, encoding: 'utf8' });
  return { ...result, json: result.status === 0 ? JSON.parse(result.stdout) : null };
}

test('shared defaults assign every role and seat to a complete profile', () => {
  const { json, status, stderr } = resolve(['--repo', checkout('plain')]);
  assert.equal(status, 0, stderr);
  for (const key of [...ROLES, ...SEATS]) {
    assert.equal(json.assignments[key].assignedBy, 'shared');
    for (const field of ['agent', 'model', 'effort']) assert.ok(json.assignments[key][field]);
  }
  assert.deepEqual(new Set(Object.values(json.assignments).map((a) => a.agent)), new Set(['claude', 'codex']));
});

test('precedence: shared < repository < plan < phase < operator', () => {
  const repo = checkout('layered', {
    '.peer-skills-and-workflows/config.yaml': [
      'profiles:',
      '  repo-profile:',
      '    agent: claude',
      '    model: repo-model',
      '    effort: medium',
      'roles:',
      '  responsible-party: repo-profile',
      '  investigator: repo-profile',
      'review-seats:',
      '  R1: repo-profile',
      '  R2: repo-profile',
    ].join('\n'),
    '.peer-skills-and-workflows/plans/plan-a.yaml': [
      'profiles:',
      '  repo-profile:          # replaces the repository definition whole',
      '    agent: codex',
      '    model: plan-model',
      '    effort: low',
      'review-seats:',
      '  R2: fable-high',
      'phases:',
      '  2:',
      '    review-seats:',
      '      R3: repo-profile',
    ].join('\n'),
  });
  const { json, status, stderr } = resolve([
    '--repo', repo, '--plan', 'plan-a', '--phase', '2',
    '--profile', 'opus-high=claude,claude-opus-5-5,high', '--assign', 'responsible-party=opus-high',
  ]);
  assert.equal(status, 0, stderr);
  const a = json.assignments;
  assert.deepEqual(
    [a['responsible-party'].model, a['responsible-party'].assignedBy],
    ['claude-opus-5-5', 'operator'],
  );
  assert.deepEqual([a.investigator.model, a.investigator.assignedBy, a.investigator.profileFrom], ['plan-model', 'repository', 'plan']);
  assert.deepEqual([a.R1.agent, a.R1.effort], ['codex', 'low']);
  assert.deepEqual([a.R2.profile, a.R2.assignedBy], ['fable-high', 'plan']);
  assert.deepEqual([a.R3.profile, a.R3.assignedBy], ['repo-profile', 'phase']);
  assert.deepEqual([a.R4.assignedBy, a['adjudicator-2'].assignedBy], ['shared', 'shared']);
  assert.deepEqual(json.layers.map((l) => [l.layer, l.present]), [
    ['shared', true], ['repository', true], ['plan', true], ['phase', true], ['operator', true],
  ]);
});

test('the run root lies in the canonical checkout\'s ignored local directory and is only computed', () => {
  const one = checkout(path.join('one', 'same-name'));
  const two = checkout(path.join('two', 'same-name'));
  const first = resolve(['--repo', one, '--run', 'run_1']);
  assert.equal(first.status, 0, first.stderr);
  assert.equal(first.json.checkout, one);
  assert.equal(first.json.localDirectory, path.join(one, '.peer-skills-and-workflows'));
  assert.equal(first.json.runRoot, path.join(one, '.peer-skills-and-workflows', 'runs', 'run_1'));
  assert.equal(resolve(['--repo', two, '--run', 'run_1']).json.runRoot, path.join(two, '.peer-skills-and-workflows', 'runs', 'run_1'));
  assert.equal(resolve(['--repo', one, '--run', 'run_2']).json.runRoot, path.join(one, '.peer-skills-and-workflows', 'runs', 'run_2'));
  assert.equal(resolve(['--repo', one]).json.runRoot, undefined);
  assert.equal(resolve(['--repo', one, '--run', 'run_1'], two).stdout, first.stdout, 'the shell directory does not matter');
  assert.ok(!fs.existsSync(path.join(one, '.peer-skills-and-workflows')), 'resolution creates nothing');
});

/** An environment whose per-user locations all start at `home`. */
function homeAt(home) {
  return { ...process.env, HOME: home, USERPROFILE: home, LOCALAPPDATA: home, XDG_STATE_HOME: '' };
}

test('the scratch root lies outside the checkout, keyed by checkout and run, and is only computed', () => {
  const repo = checkout('scratch-outside');
  const home = path.join(scratch, 'home-outside');
  fs.mkdirSync(home);
  const env = homeAt(home);
  const result = resolve(['--repo', repo, '--run', 'run_1'], scratch, env);
  assert.equal(result.status, 0, result.stderr);
  const base = machineBase({ platform: process.platform, env, home });
  assert.equal(result.json.scratchRoot, path.join(base, 'scratch', 'repositories', repositoryKey(repo), 'runs', 'run_1'));
  assert.equal(resolve(['--repo', repo], scratch, env).json.scratchRoot, undefined);
  assert.deepEqual(fs.readdirSync(home), [], 'resolution creates nothing');
});

test('a scratch root that would fall inside the checkout is refused, also through an alias', (t) => {
  const repo = checkout('scratch-inside');
  const inside = resolve(['--repo', repo, '--run', 'run_1'], scratch, homeAt(path.join(repo, 'home')));
  assert.equal(inside.status, 1);
  assert.match(inside.stderr, /^resolve: scratch root .* lies inside the checkout .*; scratch must stay outside it$/m);
  assert.deepEqual(fs.readdirSync(repo), ['.git'], 'refusal creates nothing');
  const alias = path.join(scratch, 'scratch-inside-alias');
  if (!trySymlink(t, repo, alias)) return;
  const aliased = resolve(['--repo', repo, '--run', 'run_1'], scratch, homeAt(path.join(alias, 'home')));
  assert.equal(aliased.status, 1, 'a home reached through a link into the checkout is still inside it');
  assert.match(aliased.stderr, /lies inside the checkout/);
});

test('run ids that are not one plain name are refused', () => {
  const repo = checkout('run-ids');
  for (const bad of ['../escape', 'a/b', 'a\\b', '..', '.hidden']) {
    const result = resolve(['--repo', repo, '--run', bad]);
    assert.equal(result.status, 1, bad);
    assert.match(result.stderr, /^resolve: run id /, bad);
  }
  assert.deepEqual(fs.readdirSync(repo), ['.git'], 'refusal creates nothing');
});

test('invalid configuration fails with status 1 instead of being ignored', () => {
  const cases = {
    'malformed yaml': 'roles:\n  responsible-party: [a, b\n',
    'list instead of a profile name': 'roles:\n  responsible-party: [a, b]\n',
    'second document': 'roles:\n  investigator: fable-high\n---\nroles: {}\n',
    directive: '%YAML 1.2\n---\nroles: {}\n',
    'unknown role': 'roles:\n  reviewer: fable-high\n',
    'undefined profile': 'roles:\n  responsible-party: nowhere\n',
    'incomplete profile': 'profiles:\n  p:\n    agent: claude\n    model: m\n',
    'unknown section': 'engines:\n  claude: {}\n',
    'phases outside a plan file': 'phases:\n  1:\n    roles:\n      investigator: fable-high\n',
    'malformed plain start': 'profiles:\n  p:\n    agent: claude\n    model: - m\n    effort: high\n',
  };
  for (const [name, text] of Object.entries(cases)) {
    const repo = checkout(`bad-${name.replace(/\s+/g, '-')}`, { '.peer-skills-and-workflows/config.yaml': text });
    const result = resolve(['--repo', repo]);
    assert.equal(result.status, 1, `${name}: ${result.stdout}`);
    assert.match(result.stderr, /^resolve: /, name);
  }
});

test('an empty --run or --plan is refused, not taken as omitted', () => {
  const repo = checkout('empty-options');
  for (const args of [['--run', ''], ['--run='], ['--plan', ''], ['--plan=']]) {
    const result = resolve(['--repo', repo, ...args]);
    assert.equal(result.status, 1, args.join(' '));
    assert.equal(result.stdout, '', args.join(' '));
    const expected = args[0].startsWith('--run') ? /^resolve: run id '' must start with a letter or digit/
      : /^resolve: plan name '' must be a simple file name/;
    assert.match(result.stderr, expected, args.join(' '));
  }
  const omitted = resolve(['--repo', repo]);
  assert.equal(omitted.status, 0, omitted.stderr);
  assert.equal(omitted.json.runRoot, undefined);
  assert.deepEqual(omitted.json.layers.map(({ layer }) => layer), ['shared', 'repository']);
  const valid = resolve(['--repo', repo, '--run', 'run_1', '--plan', 'p1']);
  assert.equal(valid.status, 0, valid.stderr);
  assert.equal(valid.json.runRoot, path.join(repo, '.peer-skills-and-workflows', 'runs', 'run_1'));
  assert.deepEqual(valid.json.layers.at(-1), { layer: 'plan', path: path.join(repo, '.peer-skills-and-workflows', 'plans', 'p1.yaml'), present: false });
  assert.equal(resolve(['--repo', repo, '--run=a..b']).status, 1);
  assert.deepEqual(fs.readdirSync(repo), ['.git'], 'nothing is created');
});

test('arguments are checked', () => {
  assert.equal(resolve([]).status, 2);
  assert.equal(resolve(['--repo', checkout('args'), '--phase', '1']).status, 2);
  assert.equal(resolve(['--repo', checkout('args2'), '--unknown']).status, 2);
  assert.equal(resolve(['--repo', path.join(scratch, 'not-a-checkout')]).status, 1);
  assert.equal(resolve(['--repo', checkout('args3'), '--run', '../escape']).status, 1);
  assert.equal(resolve(['--repo', checkout('args4'), '--plan', '../x']).status, 1);
});

test('operator layer parsing', () => {
  const layer = operatorLayer(['p=codex,gpt-x,high'], ['R2=p', 'adjudicator-1=p']);
  assert.deepEqual(layer.profiles.p, { agent: 'codex', model: 'gpt-x', effort: 'high' });
  assert.equal(layer['review-seats'].R2, 'p');
  assert.equal(layer.roles['adjudicator-1'], 'p');
  assert.throws(() => operatorLayer(['p=codex,gpt-x'], []), /name=agent,model,effort/);
  assert.throws(() => resolveConfiguration([{ name: 'x', layer: checkLayer({}, 'x') }]), /no profile is assigned/);
});

test('inherited object names are not profiles, roles or phases unless defined', () => {
  for (const name of ['constructor', 'toString']) {
    const repo = checkout(`inherited-${name}`, { '.peer-skills-and-workflows/config.yaml': `roles:\n  responsible-party: ${name}\n` });
    const fromFile = resolve(['--repo', repo]);
    assert.equal(fromFile.status, 1, fromFile.stdout);
    assert.match(fromFile.stderr, new RegExp(`names undefined profile '${name}'`));
    const fromOperator = resolve(['--repo', checkout(`inherited-op-${name}`), '--assign', `R1=${name}`]);
    assert.equal(fromOperator.status, 1, fromOperator.stdout);
    assert.match(fromOperator.stderr, new RegExp(`names undefined profile '${name}'`));
  }
});

test('profiles named like object properties work when defined completely', () => {
  const repo = checkout('special-names', {
    '.peer-skills-and-workflows/config.yaml': [
      'profiles:',
      '  constructor:',
      '    agent: claude',
      '    model: model-c',
      '    effort: high',
      'roles:',
      '  investigator: constructor',
    ].join('\n'),
  });
  const { json, status, stderr } = resolve(['--repo', repo, '--profile', 'toString=codex,model-t,low', '--assign', 'R4=toString']);
  assert.equal(status, 0, stderr);
  assert.deepEqual([json.assignments.investigator.model, json.assignments.investigator.profileFrom], ['model-c', 'repository']);
  assert.deepEqual([json.assignments.R4.agent, json.assignments.R4.model], ['codex', 'model-t']);
});

test('__proto__ keys are ordinary keys, so they cannot hide sections or entries', () => {
  const cases = {
    'hidden section': ['__proto__:\n  engines: x\n', /unknown section '__proto__'/],
    'hidden role': ['roles:\n  __proto__: fable-high\n', /unknown roles entry '__proto__'/],
    'hidden profile field': ['profiles:\n  p:\n    agent: a\n    model: m\n    effort: e\n    __proto__:\n      x: v\n', /unknown field '__proto__'/],
  };
  for (const [name, [text, pattern]] of Object.entries(cases)) {
    const result = resolve(['--repo', checkout(`proto-${name.replace(/\s+/g, '-')}`, { '.peer-skills-and-workflows/config.yaml': text })]);
    assert.equal(result.status, 1, `${name}: ${result.stdout}`);
    assert.match(result.stderr, pattern, name);
  }
  const operator = resolve(['--repo', checkout('proto-operator'), '--profile', '__proto__=a,m,e']);
  assert.equal(operator.status, 1);
  assert.match(operator.stderr, /profile name '__proto__'/);
});

test('an absent phase stays absent, whatever its name', () => {
  const repo = checkout('absent-phase', { '.peer-skills-and-workflows/plans/p.yaml': 'phases:\n  1:\n    roles:\n      investigator: astra-high\n' });
  for (const phase of ['2', 'constructor', 'toString', '__proto__']) {
    for (const plan of ['p', 'missing-plan']) {
      const { json, status, stderr } = resolve(['--repo', repo, '--plan', plan, '--phase', phase]);
      assert.equal(status, 0, `${plan}/${phase}: ${stderr}`);
      assert.deepEqual(json.layers.find((l) => l.layer === 'phase').present, false, `${plan}/${phase}`);
      assert.equal(json.assignments.investigator.assignedBy, 'shared');
    }
  }
  const present = resolve(['--repo', repo, '--plan', 'p', '--phase', '1']).json;
  assert.deepEqual([present.assignments.investigator.profile, present.assignments.investigator.assignedBy], ['astra-high', 'phase']);
});

test('a supplied phase, even an empty one, needs a plan and selects exactly that key', () => {
  const repo = checkout('empty-phase', { '.peer-skills-and-workflows/plans/p.yaml': [
    'phases:',
    '  "":',
    '    roles:',
    '      investigator: astra-high',
    '  ph2:',
    '    roles:',
    '      investigator: astra-high',
  ].join('\n') });
  for (const args of [['--phase', ''], ['--phase=']]) {
    const result = resolve(['--repo', repo, ...args]);
    assert.equal(result.status, 2, args.join(' '));
    assert.match(result.stderr, /^usage: --phase needs --plan/, args.join(' '));
  }
  const layer = (json) => json.layers.find((l) => l.layer === 'phase');
  for (const args of [['--phase', ''], ['--phase=']]) {
    const { json, status, stderr } = resolve(['--repo', repo, '--plan', 'p', ...args]);
    assert.equal(status, 0, stderr);
    assert.deepEqual(layer(json), { layer: 'phase', path: 'plans/p.yaml phases.', present: true }, args.join(' '));
    assert.deepEqual([json.assignments.investigator.profile, json.assignments.investigator.assignedBy], ['astra-high', 'phase']);
  }
  const ordinary = resolve(['--repo', repo, '--plan', 'p', '--phase', 'ph2']).json;
  assert.deepEqual(layer(ordinary), { layer: 'phase', path: 'plans/p.yaml phases.ph2', present: true });
  assert.equal(ordinary.assignments.investigator.assignedBy, 'phase');
  const unknown = resolve(['--repo', repo, '--plan', 'p', '--phase', 'ph3']).json;
  assert.deepEqual(layer(unknown), { layer: 'phase', path: 'plans/p.yaml phases.ph3', present: false });
  assert.equal(unknown.assignments.investigator.assignedBy, 'shared');
  const plain = checkout('plain-phases', { '.peer-skills-and-workflows/plans/p.yaml': 'phases:\n  ph2:\n' });
  const absentEmpty = resolve(['--repo', plain, '--plan', 'p', '--phase', '']).json;
  assert.equal(layer(absentEmpty).present, false, 'an empty phase key that is not defined is absent');
  const omitted = resolve(['--repo', repo, '--plan', 'p']).json;
  assert.equal(layer(omitted), undefined, 'an omitted phase is not consulted');
  assert.equal(omitted.assignments.investigator.assignedBy, 'shared');
  assert.deepEqual(fs.readdirSync(path.join(repo, '.peer-skills-and-workflows')), ['plans'], 'nothing is created');
  assert.deepEqual(fs.readdirSync(path.join(repo, '.peer-skills-and-workflows', 'plans')), ['p.yaml']);
});

test('unknown assignment keys name the known roles and seats', () => {
  const operator = resolve(['--repo', checkout('unknown-assign'), '--assign', 'R5=fable-high']);
  assert.equal(operator.status, 1);
  assert.match(operator.stderr, /unknown role or seat 'R5' \(roles: responsible-party, .*; seats: R1, R2, R3, R4\)/);
  const misplaced = resolve(['--repo', checkout('misplaced-seat', { '.peer-skills-and-workflows/config.yaml': 'roles:\n  R1: fable-high\n' })]);
  assert.equal(misplaced.status, 1);
  assert.match(misplaced.stderr, /'R1' belongs under review-seats/);
});

test('plain values typed differently by YAML versions are refused in configuration with their file and line', () => {
  const repo = checkout('typed-scalar', { '.peer-skills-and-workflows/config.yaml': 'profiles:\n  p:\n    agent: claude\n    model: 012\n    effort: high\n' });
  const refused = resolve(['--repo', repo]);
  assert.equal(refused.status, 1);
  assert.equal(refused.stdout, '');
  // 012 is the integer 12 in YAML 1.2 Core and the octal 10 in YAML 1.1 (yaml.org/type/int).
  assert.equal(refused.stderr, `resolve: ${path.join(repo, '.peer-skills-and-workflows', 'config.yaml')}: line 4, column 12: YAML 1.2 reads `
    + 'the number 12 here and YAML 1.1 reads the number 10; write it so both read the same, for example by quoting a value meant as text\n');
});

test('merge keys, alias expansion and refused characters in configuration are refused with their file and position', () => {
  const ten = (item) => `[${Array(10).fill(item).join(', ')}]`;
  for (const [name, text, expected] of [
    ['merge', 'profiles:\n  p:\n    <<: {agent: claude}\n', /line 3, column 5: a plain '<<' key is the YAML 1\.1 merge key, not text, and merge keys are not supported; write the fields /],
    ['tagged-merge', 'roles:\n  !!str <<: x\n', /line 2, column 9: a plain '<<' key is the YAML 1\.1 merge key/],
    ['alias', `a: &a ${ten('x')}\nb: &b ${ten('*a')}\nc: &c ${ten('*b')}\nd: ${ten('*c')}\n`,
      /line 3, column \d+: alias \*b takes alias expansion past the package's maxAliasCount of 100 /],
    ['control', 'profiles:\n  p:\n    agent: claude\n    model: "m\u0001"\n    effort: high\n', /line 4, column 14: U\+0001 is a control character/],
    ['del', 'profiles:\n  p:\n    agent: claude\n    model: m\u007F\n    effort: high\n', /line 4, column 13: U\+007F is not a printable character/],
    ['anchor', 'profiles:\n  p: &p\u0080 {agent: claude, model: m, effort: high}\n', /line 2, column 8: U\+0080 is not a printable character, .*; remove it from the anchor name\n/],
    ['bom', 'profiles:\n  p:\n    agent: claude\n    model: m\uFEFF\n    effort: high\n', /line 4, column 13: U\+FEFF is a byte order mark, /],
  ]) {
    const repo = checkout(`refused-${name}`, { '.peer-skills-and-workflows/config.yaml': text });
    const refused = resolve(['--repo', repo]);
    assert.equal(refused.status, 1, name);
    assert.equal(refused.stdout, '', name);
    const file = path.join(repo, '.peer-skills-and-workflows', 'config.yaml');
    assert.ok(refused.stderr.startsWith(`resolve: ${file}: `), `${name}: ${refused.stderr}`);
    assert.match(refused.stderr.slice(`resolve: ${file}: `.length), new RegExp(`^${expected.source}`), name);
    assert.doesNotMatch(refused.stderr, /\n {4}at /, `${name}: no stack trace`);
  }
  const quoted = checkout('quoted-del', { '.peer-skills-and-workflows/config.yaml': 'profiles:\n  p: {agent: claude, model: "m\u007F", effort: high}\n' });
  const accepted = resolve(['--repo', quoted]);
  assert.equal(accepted.status, 0, accepted.stderr);
  assert.equal(accepted.json.profiles.p.model, 'm\u007F', 'quoted DEL is text');
});

// Configuration is UTF-8 (yaml.mjs): bytes that are not UTF-8 refuse the file
// instead of becoming U+FFFD in a value, while a leading byte order mark and an
// encoded U+FFFD are read.
test('configuration that is not UTF-8 is refused with its file, and valid UTF-8 is read as written', () => {
  const head = Buffer.from('profiles:\n  p: {agent: claude, model: "m');
  const tail = Buffer.from('", effort: high}\n');
  for (const [name, bytes] of [
    ['latin-1', [0xE9]], ['cp1252-quote', [0x93]], ['overlong', [0xC0, 0xAF]], ['surrogate', [0xED, 0xA0, 0x80]], ['truncated', [0xE2, 0x82]],
  ]) {
    const repo = checkout(`bytes-${name}`);
    const file = path.join(repo, '.peer-skills-and-workflows', 'config.yaml');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, Buffer.concat([head, Buffer.from(bytes), tail]));
    const refused = resolve(['--repo', repo]);
    assert.equal(refused.status, 1, name);
    assert.equal(refused.stdout, '', name);
    assert.equal(refused.stderr, `resolve: ${file}: the file is not valid UTF-8; save it as UTF-8\n`, name);
  }
  const repo = checkout('bytes-valid');
  const file = path.join(repo, '.peer-skills-and-workflows', 'config.yaml');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), head, Buffer.from('\uFFFD é', 'utf8'), tail]));
  const accepted = resolve(['--repo', repo]);
  assert.equal(accepted.status, 0, accepted.stderr);
  assert.equal(accepted.json.profiles.p.model, 'm\uFFFD é', 'an encoded U+FFFD and other characters are kept');
});

// Integer-like keys come first in a JavaScript object, so the copy under `1:`
// is compared before its anchor; the difference is located where it is written.
test('a difference reached through an alias is located in the configuration file, LF and CRLF', () => {
  const text = 'profiles:\n  p: &p {agent: claude, model: m, effort: on}\n  1: *p\n';
  for (const [form, source] of [['LF', text], ['CRLF', text.replace(/\n/g, '\r\n')]]) {
    const repo = checkout(`alias-difference-${form}`, { '.peer-skills-and-workflows/config.yaml': source });
    const refused = resolve(['--repo', repo]);
    assert.equal(refused.status, 1, form);
    assert.equal(refused.stdout, '', form);
    assert.equal(refused.stderr, `resolve: ${path.join(repo, '.peer-skills-and-workflows', 'config.yaml')}: line 2, column 43: YAML 1.2 reads `
      + 'the text "on" here and YAML 1.1 reads the boolean true; write it so both read the same, for example by quoting a value meant as text\n', form);
  }
});

test('configuration may use flow collections, anchors and document markers', () => {
  const repo = checkout('new-syntax', {
    '.peer-skills-and-workflows/config.yaml': [
      '---',
      'profiles:',
      '  base: &base {agent: claude, model: model-b, effort: high}',
      '  copy: *base',
      'roles: {investigator: copy}',
      'review-seats:',
      '  R1:',
      '    base',
      '...',
    ].join('\n'),
  });
  const { json, status, stderr } = resolve(['--repo', repo]);
  assert.equal(status, 0, stderr);
  assert.deepEqual([json.assignments.investigator.model, json.assignments.investigator.profileFrom], ['model-b', 'repository']);
  assert.deepEqual([json.assignments.R1.profile, json.assignments.R1.assignedBy], ['base', 'repository']);
});

// Keys are text written as they appear, so a phase is selected by exactly the
// text of its key.
test('phase keys keep their written text, and keys colliding as text are refused', () => {
  const repo = checkout('phase-keys', { '.peer-skills-and-workflows/plans/p.yaml': [
    'phases:',
    '  1.0:',
    '    roles: {investigator: astra-high}',
    '  2:',
    '    roles: {investigator: astra-high}',
  ].join('\n') });
  const assigned = (phase) => {
    const { json, status, stderr } = resolve(['--repo', repo, '--plan', 'p', '--phase', phase]);
    assert.equal(status, 0, stderr);
    return json.assignments.investigator.assignedBy;
  };
  assert.deepEqual(['1.0', '1', '2', '02'].map(assigned), ['phase', 'shared', 'phase', 'shared']);
  const colliding = checkout('phase-collision', { '.peer-skills-and-workflows/plans/p.yaml': 'phases:\n  2: {}\n  "2": {}\n' });
  const refused = resolve(['--repo', colliding, '--plan', 'p', '--phase', '2']);
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /p\.yaml: line 3, column 3: Map keys must be unique \(DUPLICATE_KEY\)\n$/);
});

test('a configuration key holding a Unicode text space is shown with it written out', () => {
  const repo = checkout('text-space-key', { '.peer-skills-and-workflows/config.yaml': 'roles:\n  investigator\u00A0: astra-high\n' });
  const refused = resolve(['--repo', repo]);
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /unknown roles entry 'investigator\\u00A0' \(U\+00A0 written as \\uXXXX\) \(known: /);
  const section = resolve(['--repo', checkout('text-space-section', { '.peer-skills-and-workflows/config.yaml': 'roles\u2003: {}\n' })]);
  assert.match(section.stderr, /unknown section 'roles\\u2003' \(U\+2003 written as \\uXXXX\)/);
});

test('a profile name holding a Unicode text space is refused with that space shown', () => {
  const repo = checkout('text-space-name', { '.peer-skills-and-workflows/config.yaml': 'roles:\n  investigator: astra-high\u00A0\n' });
  const refused = resolve(['--repo', repo]);
  assert.equal(refused.status, 1);
  assert.equal(refused.stdout, '');
  assert.ok(refused.stderr.endsWith(': roles.investigator must name a profile; the name is "astra-high\\u00A0" with U+00A0 '
    + 'written as \\uXXXX: it looks like a space but is part of the name, and profile names cannot contain spaces, so delete it\n'),
  refused.stderr);
  // Profile fields are free-form text and keep the same character.
  const free = checkout('text-space-model', {
    '.peer-skills-and-workflows/config.yaml': 'profiles:\n  p:\n    agent: claude\n    model: m\u00A0\n    effort: high\nroles:\n  investigator: p\n',
  });
  const accepted = resolve(['--repo', free]);
  assert.equal(accepted.status, 0, accepted.stderr);
  assert.equal(accepted.json.assignments.investigator.model, 'm\u00A0');
});

/** Create a directory symlink, or skip the test where the host forbids it. */
function trySymlink(t, target, dest) {
  try {
    fs.symlinkSync(target, dest, 'junction');
    return true;
  } catch (error) {
    if (error.code === 'EPERM') { t.skip(`symlinks not permitted on this host: ${error.message}`); return false; }
    throw error;
  }
}

test('an alias of the checkout resolves to the same canonical run root', (t) => {
  const repo = checkout('alias-target');
  const alias = path.join(scratch, 'alias-link');
  if (!trySymlink(t, repo, alias)) return;
  const direct = resolve(['--repo', repo, '--run', 'run_1']);
  const aliased = resolve(['--repo', alias, '--run', 'run_1']);
  assert.equal(aliased.status, 0, aliased.stderr);
  assert.equal(aliased.json.checkout, repo);
  assert.equal(aliased.json.runRoot, path.join(repo, '.peer-skills-and-workflows', 'runs', 'run_1'));
  assert.equal(aliased.stdout, direct.stdout);
});
