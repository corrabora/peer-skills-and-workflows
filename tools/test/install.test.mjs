// Installation runs the real entry point against a temporary home, so the
// user's own skill directories are never touched.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { generateWritingReferences } from '../lib/writing-references.mjs';
import { checkLinks, checkReferences, link, PACKAGE_SKILLS, RECORD_FORMATS, removeLink, sameLinkTarget, SKILL_SETS, unlink, WORKFLOW_SKILLS, WRITING_SKILLS } from '../lib/install.mjs';

const packageRoot = fs.realpathSync.native(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..'));
const installer = path.join(packageRoot, 'tools', 'install.mjs');
const scratch = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'aw install é-')));
after(() => fs.rmSync(scratch, { recursive: true, force: true }));

function run(home, ...args) {
  return runInstaller(installer, home, ...args);
}

function runInstaller(entryPoint, home, ...args) {
  const env = { ...process.env, HOME: home, USERPROFILE: home };
  delete env.CLAUDE_CONFIG_DIR;
  delete env.CODEX_HOME;
  return spawnSync(process.execPath, [entryPoint, ...args], { env, encoding: 'utf8' });
}

const ALL = PACKAGE_SKILLS.length;

/**
 * Create a symlink of `type`, or skip the test where the host forbids it and
 * return false. A test that can only continue with the link returns on false;
 * cases that do not need the link belong in a test of their own, so that one
 * skip never hides them.
 */
function trySymlink(t, target, dest, type) {
  try {
    fs.symlinkSync(target, dest, type);
    return true;
  } catch (error) {
    if (error.code === 'EPERM') { t.skip(`symlinks not permitted on this host: ${error.message}`); return false; }
    throw error;
  }
}

const silent = { info() {}, error() {} };

test('link repairs a moved checkout from the running script location, independently of cwd', () => {
  const home = path.join(scratch, 'relocation home');
  const original = path.join(scratch, 'original checkout');
  const moved = path.join(scratch, 'moved checkout é');
  for (const entry of ['tools', 'skills', 'docs']) {
    fs.cpSync(path.join(packageRoot, entry), path.join(original, entry), { recursive: true });
  }
  const entryPoint = (root) => path.join(root, 'tools', 'install.mjs');
  const first = runInstaller(entryPoint(original), home, 'link');
  assert.equal(first.status, 0, first.stderr);
  fs.renameSync(original, moved);

  // Only the selected set is repaired; unlink still leaves the former links alone.
  const unlinked = runInstaller(entryPoint(moved), home, 'unlink', 'writing');
  assert.equal(unlinked.status, 0, unlinked.stderr);
  assert.equal((unlinked.stderr.match(/^kept /gm) ?? []).length, 2 * WRITING_SKILLS.length);
  const writing = runInstaller(entryPoint(moved), home, 'link', 'writing');
  assert.equal(writing.status, 0, writing.stderr);
  assert.equal((writing.stdout.match(/^relinked /gm) ?? []).length, 2 * WRITING_SKILLS.length);
  for (const engine of ['.agents', '.claude']) {
    for (const skill of PACKAGE_SKILLS) {
      const root = WRITING_SKILLS.includes(skill) ? moved : original;
      assert.equal(fs.readlinkSync(path.join(home, engine, 'skills', skill)), path.join(root, 'skills', skill));
    }
  }
  const all = runInstaller(entryPoint(moved), home, 'link');
  assert.equal(all.status, 0, all.stderr);
  assert.equal((all.stdout.match(/^relinked /gm) ?? []).length, 2 * WORKFLOW_SKILLS.length);
  for (const engine of ['.agents', '.claude']) {
    for (const skill of PACKAGE_SKILLS) {
      assert.equal(fs.realpathSync(path.join(home, engine, 'skills', skill)), path.join(moved, 'skills', skill));
    }
  }
  const again = runInstaller(entryPoint(moved), home, 'link');
  assert.equal(again.status, 0, again.stderr);
  assert.equal((again.stdout.match(/^ok /gm) ?? []).length, 2 * ALL);
  for (const file of [path.join(home, '.codex/hooks.json'), path.join(home, '.claude/settings.json')]) {
    const config = fs.readFileSync(file, 'utf8');
    assert.ok(config.includes(moved.replaceAll('\\', '\\\\')), 'hooks follow the relocated checkout');
    assert.ok(!config.includes(original.replaceAll('\\', '\\\\')), 'stale commands were removed');
  }
});

test('repair requires a missing target for the same skill and a usable replacement', (t) => {
  const dir = path.join(scratch, 'repair boundaries');
  const sourceRoot = path.join(scratch, 'incomplete replacement');
  fs.mkdirSync(dir);
  const skill = WRITING_SKILLS[0];
  const dest = path.join(dir, skill);
  const former = path.join(scratch, 'gone', 'skills', skill);
  // Relative links are resolved against their containing directory.
  const relative = path.relative(dir, former);
  if (!trySymlink(t, process.platform === 'win32' ? former : relative, dest, 'junction')) return;
  assert.equal(link({ sourceRoot, scopes: [{ dir }], sets: ['writing'], out: silent }), false);
  assert.equal(fs.readlinkSync(dest), process.platform === 'win32' ? former : relative);
  assert.equal(link({ sourceRoot: packageRoot, scopes: [{ dir }], sets: ['writing'], out: silent }), true);
  assert.equal(fs.realpathSync(dest), path.join(packageRoot, 'skills', skill));

  fs.unlinkSync(dest);
  const wrongSkill = path.join(scratch, 'gone', 'skills', 'different-skill');
  if (!trySymlink(t, wrongSkill, dest, 'junction')) return;
  assert.equal(link({ sourceRoot: packageRoot, scopes: [{ dir }], sets: ['writing'], out: silent }), false);
  assert.equal(fs.readlinkSync(dest), wrongSkill);
});

test('link, check and unlink own only this checkout\'s links', (t) => {
  const home = path.join(scratch, 'home with space');
  const codex = path.join(home, '.agents', 'skills');
  const claude = path.join(home, '.claude', 'skills');
  fs.mkdirSync(codex, { recursive: true });
  fs.mkdirSync(claude, { recursive: true });

  // Foreign entries at role destinations: a file, a directory, a link elsewhere and a dangling link.
  fs.writeFileSync(path.join(codex, 'plan-reviewer'), 'foreign file');
  fs.mkdirSync(path.join(claude, 'plan-reviewer'));
  fs.writeFileSync(path.join(claude, 'plan-reviewer', 'SKILL.md'), 'foreign skill');
  const elsewhere = path.join(scratch, 'elsewhere');
  fs.mkdirSync(elsewhere);
  if (!trySymlink(t, elsewhere, path.join(codex, 'review-adjudicator'), 'junction')) return;
  trySymlink(t, path.join(scratch, 'missing'), path.join(claude, 'review-adjudicator'), 'junction');
  fs.writeFileSync(path.join(codex, 'unrelated'), 'keep');

  const linked = run(home, 'link');
  assert.equal(linked.status, 1, 'skipped foreign destinations make link fail');
  assert.doesNotMatch(linked.stdout, /^developer_instructions =/m);
  assert.equal((linked.stdout.match(/^linked /gm) ?? []).length, 2 * ALL - 4);
  assert.equal((linked.stderr.match(/^skipped /gm) ?? []).length, 4);
  assert.match(linked.stderr, /plan-reviewer: a file, not this checkout's link/);
  assert.match(linked.stderr, /plan-reviewer: a directory, not this checkout's link/);
  assert.ok(linked.stderr.includes(`review-adjudicator: a link to ${elsewhere}, not`), linked.stderr);
  assert.ok(linked.stderr.includes(`a link to ${path.join(scratch, 'missing')}, which does not exist`), linked.stderr);
  assert.equal((linked.stderr.match(/^help .*remove it yourself.*unlink` from the checkout it links to/gm) ?? []).length, 1);

  const checked = run(home, 'check');
  assert.equal(checked.status, 1, 'check fails while foreign entries occupy skill names');
  assert.equal((checked.stdout.match(/SKILL\.md and shared references readable/g) ?? []).length, 2 * ALL - 4);
  assert.match(checked.stderr, /is not linked to .* \(found a file\)/);
  assert.equal((checked.stderr.match(/^help /gm) ?? []).length, 1);

  const relinked = run(home, 'link');
  assert.equal((relinked.stdout.match(/^ok /gm) ?? []).length, 2 * ALL - 4, 'link is idempotent');

  const unlinked = run(home, 'unlink');
  assert.equal(unlinked.status, 0);
  assert.equal((unlinked.stdout.match(/^removed /gm) ?? []).length, 2 * ALL - 4);
  assert.equal((unlinked.stderr.match(/^kept /gm) ?? []).length, 4);
  assert.match(unlinked.stderr, /^kept .*plan-reviewer: a file, not this checkout's link$/m);

  assert.equal(fs.readFileSync(path.join(codex, 'plan-reviewer'), 'utf8'), 'foreign file');
  assert.equal(fs.readFileSync(path.join(claude, 'plan-reviewer', 'SKILL.md'), 'utf8'), 'foreign skill');
  assert.ok(fs.lstatSync(path.join(codex, 'review-adjudicator')).isSymbolicLink());
  assert.ok(fs.lstatSync(path.join(claude, 'review-adjudicator')).isSymbolicLink());
  assert.equal(fs.readFileSync(path.join(codex, 'unrelated'), 'utf8'), 'keep');
  for (const skill of ['bind-agent-workflow', 'plan-coordinator', 'plan-responsible-party', 'write-for-humans']) {
    assert.ok(!fs.existsSync(path.join(codex, skill)) && !fs.existsSync(path.join(claude, skill)));
  }
  for (const skill of PACKAGE_SKILLS) assert.ok(fs.existsSync(path.join(packageRoot, 'skills', skill, 'SKILL.md')), 'source intact');
});

test('a set name limits link, check and unlink to that set, and its shared references are checked through the link', () => {
  const home = path.join(scratch, 'writing only');
  const codex = path.join(home, '.agents', 'skills');
  const claude = path.join(home, '.claude', 'skills');
  fs.mkdirSync(home);
  const linked = run(home, 'link', 'writing');
  assert.equal(linked.status, 0, linked.stderr);
  assert.equal((linked.stdout.match(/^linked /gm) ?? []).length, 2 * WRITING_SKILLS.length);
  for (const dir of [codex, claude]) {
    assert.deepEqual(fs.readdirSync(dir).sort(), [...WRITING_SKILLS].sort(), 'only the writing skills are linked');
    for (const skill of WRITING_SKILLS) {
      const real = fs.realpathSync.native(path.join(dir, skill));
      assert.equal(real, path.join(packageRoot, 'skills', skill));
      assert.ok(fs.existsSync(path.join(real, '..', '..', 'docs', 'writing-guidance.md')), 'the shared guidance is reachable through the link');
    }
  }
  const checked = run(home, 'check', 'writing');
  assert.equal(checked.status, 0, checked.stderr);
  assert.equal((checked.stdout.match(/SKILL\.md and shared references readable/g) ?? []).length, 2 * WRITING_SKILLS.length);
  assert.doesNotMatch(checked.stderr, /plan-/, 'the workflow set is not checked');

  const whole = run(home, 'check');
  assert.equal(whole.status, 1, 'the whole package is not installed');
  assert.equal((whole.stderr.match(/^FAIL .*\(found nothing\)$/gm) ?? []).length, 2 * WORKFLOW_SKILLS.length);

  assert.equal(run(home, 'unlink', 'writing').status, 0);
  assert.deepEqual(fs.readdirSync(codex), []);
  assert.deepEqual(fs.readdirSync(claude), []);
  assert.equal(run(home, 'link', 'bogus').status, 2, 'an unknown set is a usage error');
});

test('link, unlink and check name an unknown set, including a name every object inherits', () => {
  const scopes = [{ dir: path.join(scratch, 'unknown sets') }];
  for (const name of ['bogus', '__proto__', 'constructor', 'toString']) {
    const message = `unknown skill set '${name}'; the sets are ${Object.keys(SKILL_SETS).join(', ')}`;
    for (const operation of [link, unlink, checkLinks]) {
      assert.throws(() => operation({ sourceRoot: packageRoot, scopes, sets: [name], out: silent }), { message }, `${operation.name} ${name}`);
    }
  }
});

test('links including writing print the documented Codex setting and preserve existing configuration', () => {
  const instructionPath = path.join(packageRoot, 'docs', 'guidance', 'codex-session-instructions.txt');
  const instructions = fs.readFileSync(instructionPath, 'utf8').trim();
  const readme = fs.readFileSync(path.join(packageRoot, 'README.md'), 'utf8');
  const snippet = readme.match(/```toml\ndeveloper_instructions = ("[^\n]+")\n```/);
  assert.ok(snippet, 'README includes the copyable top-level setting');
  assert.equal(JSON.parse(snippet[1]), instructions, 'README uses the canonical instruction');

  for (const set of ['writing', 'workflow', undefined]) {
    const home = path.join(scratch, `codex setting ${set ?? 'all'}`);
    const config = path.join(home, '.codex', 'config.toml');
    const existing = 'developer_instructions = "Keep the project conventions."\n';
    fs.mkdirSync(path.dirname(config), { recursive: true });
    fs.writeFileSync(config, existing);
    const selection = set === undefined ? [] : [set];
    for (let repeat = 0; repeat < 2; repeat++) {
      const linked = run(home, 'link', ...selection);
      assert.equal(linked.status, 0, linked.stderr);
      const values = [...linked.stdout.matchAll(/^developer_instructions = (.+)$/gm)];
      assert.equal(values.length, 1, 'first and repeated links each print one setting');
      assert.equal(JSON.parse(values[0][1]), instructions);
      assert.ok(linked.stdout.includes(instructionPath));
      assert.equal(fs.readFileSync(config, 'utf8'), existing, 'configuration remains unchanged');
      assert.deepEqual(fs.readdirSync(path.dirname(config)).sort(), set === 'writing'
        ? ['config.toml'] : ['.agent-workflow-successor-hooks.json', 'config.toml', 'hooks.json']);
    }
    for (const command of ['check', 'unlink']) {
      const result = run(home, command, ...selection);
      assert.equal(result.status, 0, result.stderr);
      assert.doesNotMatch(result.stdout, /^developer_instructions =/m);
    }
    assert.equal(fs.readFileSync(config, 'utf8'), existing);
  }
});

test('workflow link and check include writing; workflow removal preserves it', () => {
  const home = path.join(scratch, 'workflow dependencies');
  const dirs = ['.agents', '.claude'].map((engine) => path.join(home, engine, 'skills'));
  // Simulate an installation from before writing became a dependency.
  for (const dir of dirs) {
    fs.mkdirSync(dir, { recursive: true });
    for (const skill of WORKFLOW_SKILLS) fs.symlinkSync(path.join(packageRoot, 'skills', skill), path.join(dir, skill), 'junction');
  }
  const missing = run(home, 'check', 'workflow');
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /workflow set requires the absent writing set/);
  assert.doesNotMatch(missing.stderr, /if only the workflow set was intended/);
  const linked = run(home, 'link', 'workflow');
  assert.equal(linked.status, 0, linked.stderr);
  assert.equal((linked.stdout.match(/^linked /gm) ?? []).length, 2 * WRITING_SKILLS.length);
  assert.equal(run(home, 'check', 'workflow').status, 0);
  assert.equal(run(home, 'unlink', 'writing').status, 0);
  assert.equal(run(home, 'check', 'workflow').status, 1, 'removing a dependency invalidates readiness');
  assert.equal(run(home, 'link', 'workflow').status, 0);
  assert.equal(run(home, 'unlink', 'workflow').status, 0);
  for (const dir of dirs) assert.deepEqual(fs.readdirSync(dir).sort(), [...WRITING_SKILLS].sort());
  assert.equal(run(home, 'check', 'writing').status, 0);
});

for (const addedSkill of ['peer-review', 'peer-decision-making', 'peer-implementation', 'successor']) {
  test(`workflow upgrade adds ${addedSkill} without replacing existing skill links`, () => {
    const home = path.join(scratch, `${addedSkill} upgrade`);
    const dirs = ['.agents', '.claude'].map((engine) => path.join(home, engine, 'skills'));
    for (const dir of dirs) {
      fs.mkdirSync(dir, { recursive: true });
      for (const skill of PACKAGE_SKILLS.filter((name) => name !== addedSkill)) {
        fs.symlinkSync(path.join(packageRoot, 'skills', skill), path.join(dir, skill), 'junction');
      }
    }
    const before = dirs.map((dir) => new Map(fs.readdirSync(dir).map((name) => [name, fs.readlinkSync(path.join(dir, name))])));
    const linked = run(home, 'link', 'workflow');
    assert.equal(linked.status, 0, linked.stderr);
    for (const [index, dir] of dirs.entries()) {
      assert.equal(fs.realpathSync(path.join(dir, addedSkill)), path.join(packageRoot, 'skills', addedSkill));
      for (const [name, target] of before[index]) assert.equal(fs.readlinkSync(path.join(dir, name)), target);
      for (const dependency of ['write-for-agents', 'write-for-humans']) {
        assert.ok(fs.readFileSync(path.join(dir, dependency, 'SKILL.md'), 'utf8').length > 0);
      }
    }
    const checked = run(home, 'check', 'workflow');
    assert.equal(checked.status, 0, checked.stderr);
  });
}

test('workflow dependency conflicts preserve foreign links and name both sets in recovery', (t) => {
  const scope = path.join(scratch, 'workflow dependency conflict');
  const other = path.join(scratch, 'foreign writing checkout');
  fs.mkdirSync(scope);
  fs.mkdirSync(path.join(other, 'skills', 'write-for-humans'), { recursive: true });
  const dest = path.join(scope, 'write-for-humans');
  if (!trySymlink(t, path.join(other, 'skills', 'write-for-humans'), dest, 'junction')) return;
  const linked = capture();
  assert.equal(link({ sourceRoot: packageRoot, scopes: [{ dir: scope }], sets: ['workflow'], out: linked.out }), false);
  assert.equal(fs.realpathSync(dest), fs.realpathSync(path.join(other, 'skills', 'write-for-humans')));
  assert.match(linked.errors.join('\n'), /unlink workflow` and `node tools\/install\.mjs unlink writing`/);
  assert.match(linked.errors.join('\n'), /Then run `node tools\/install\.mjs link workflow` again/);
  const checked = capture();
  assert.equal(checkLinks({ sourceRoot: packageRoot, scopes: [{ dir: scope }], sets: ['workflow'], out: checked.out }), false);
  assert.ok(checked.errors.some(line => line.startsWith(`FAIL    ${dest} is not linked`)));
  for (const skill of WORKFLOW_SKILLS) assert.equal(fs.realpathSync(path.join(scope, skill)), path.join(packageRoot, 'skills', skill));
});

test('a missing or empty Codex instruction stops writing links before filesystem changes', () => {
  const root = path.join(scratch, 'installer without instruction');
  fs.cpSync(path.join(packageRoot, 'tools'), path.join(root, 'tools'), { recursive: true });
  const instructionPath = path.join(root, 'docs', 'guidance', 'codex-session-instructions.txt');
  for (const state of ['missing', 'empty']) {
    if (state === 'empty') {
      fs.mkdirSync(path.dirname(instructionPath), { recursive: true });
      fs.writeFileSync(instructionPath, ' \n');
    }
    for (const set of ['writing', 'workflow']) {
      const home = path.join(scratch, `instruction ${state} ${set}`);
      const result = runInstaller(path.join(root, 'tools', 'install.mjs'), home, 'link', set);
      assert.equal(result.status, 1);
      assert.ok(result.stderr.includes(instructionPath), result.stderr);
      assert.match(result.stderr, state === 'missing' ? /ENOENT/ : /empty Codex session instruction/);
      assert.equal(fs.existsSync(home), false, 'no destination directories or links created');
    }
  }
});

test('upgrading a writing installation adds new skills without replacing existing links', () => {
  const home = path.join(scratch, 'writing upgrade');
  const dirs = ['.agents', '.claude'].map((engine) => path.join(home, engine, 'skills'));
  const original = ['clarify-artifact', 'write-for-humans', 'write-for-agents'];
  const added = WRITING_SKILLS.filter((name) => !original.includes(name));
  const before = new Map();
  for (const dir of dirs) {
    fs.mkdirSync(dir, { recursive: true });
    for (const name of original) {
      const dest = path.join(dir, name);
      fs.symlinkSync(path.join(packageRoot, 'skills', name), dest, process.platform === 'win32' ? 'junction' : 'dir');
      before.set(dest, fs.lstatSync(dest).ino);
    }
  }
  const missing = run(home, 'check', 'writing');
  assert.equal(missing.status, 1, 'an old installation lacks the new entry points');
  for (const name of added) assert.ok(missing.stderr.includes(name), missing.stderr);
  assert.match(missing.stderr, /help .*writing set is partly linked.*node tools\/install\.mjs link writing/);
  for (const dir of dirs) assert.ok(missing.stderr.includes(dir), missing.stderr);
  assert.doesNotMatch(missing.stderr, /link workflow/);

  const upgraded = run(home, 'link', 'writing');
  assert.equal(upgraded.status, 0, upgraded.stderr);
  assert.equal((upgraded.stdout.match(/^linked /gm) ?? []).length, dirs.length * added.length);
  for (const [dest, inode] of before) assert.equal(fs.lstatSync(dest).ino, inode, 'existing links are kept');
  for (const dir of dirs) {
    for (const name of added) {
      assert.equal(fs.realpathSync.native(path.join(dir, name)), path.join(packageRoot, 'skills', name));
    }
  }
  const checked = run(home, 'check', 'writing');
  assert.equal(checked.status, 0, checked.stderr);
  assert.equal(run(home, 'unlink', 'writing').status, 0);
  for (const dir of dirs) assert.deepEqual(fs.readdirSync(dir), []);
});

test('bare check on a writing-only installation fails for the workflow set and names both ways on', () => {
  const home = path.join(scratch, 'writing only choices');
  const codex = path.join(home, '.agents', 'skills');
  const claude = path.join(home, '.claude', 'skills');
  fs.mkdirSync(home);
  assert.equal(run(home, 'link', 'writing').status, 0);
  assert.equal(run(home, 'check', 'writing').status, 0, 'the installed set checks clean on its own');

  const whole = run(home, 'check');
  assert.equal(whole.status, 1, 'bare check still covers both sets and fails for the absent one');
  assert.equal((whole.stderr.match(/^FAIL .*\(found nothing\)$/gm) ?? []).length, 2 * WORKFLOW_SKILLS.length);
  assert.equal((whole.stdout.match(/SKILL\.md and shared references readable/g) ?? []).length, 2 * WRITING_SKILLS.length, 'the writing set passes');
  const help = whole.stderr.split('\n').filter((line) => line.startsWith('help'));
  assert.equal(help.length, 1, whole.stderr);
  assert.ok(help[0].startsWith(`help    No skill of the workflow set is installed in ${codex} and ${claude}, where the writing set is. `), help[0]);
  assert.ok(help[0].includes('To install it too, run `node tools/install.mjs link workflow`;'), help[0]);
  assert.ok(help[0].includes('if only the writing set was intended, run `node tools/install.mjs check writing` to check that set alone.'), help[0]);
  assert.doesNotMatch(help[0], /unlink|never changes entries/, 'nothing occupies the destinations, so no occupied-entry recovery');

  // The help names only the scope in that state: with the Claude scope emptied, its skills fail one by
  // one, while the set help names the Codex scope alone.
  fs.rmSync(claude, { recursive: true });
  fs.mkdirSync(claude);
  const scopes = [{ dir: codex }, { dir: claude }];
  let { errors, out } = capture();
  assert.equal(checkLinks({ sourceRoot: packageRoot, scopes, out }), false);
  let lines = errors.filter((line) => line.startsWith('help'));
  assert.equal(lines.length, 1, errors.join('\n'));
  assert.ok(lines[0].startsWith(`help    No skill of the workflow set is installed in ${codex}, where the writing set is.`), lines[0]);
  assert.ok(!lines[0].includes(claude), lines[0]);
  assert.equal(errors.filter((line) => line.startsWith('FAIL') && line.startsWith(`FAIL    ${claude}`)).length, ALL, 'the empty scope fails for every skill');

  // Wholly absent sets keep their existing diagnostics. A missing-only partial
  // set gets relink advice without being offered as installed.
  ({ errors, out } = capture());
  assert.equal(checkLinks({ sourceRoot: packageRoot, scopes: [{ dir: claude }], out }), false);
  assert.equal(errors.filter((line) => line.startsWith('help')).length, 0, errors.join('\n'));
  ({ errors, out } = capture());
  assert.equal(checkLinks({ sourceRoot: packageRoot, scopes: [{ dir: claude }], sets: ['writing'], out }), false);
  assert.equal(errors.filter((line) => line.startsWith('help')).length, 0, errors.join('\n'));
  for (const skill of WORKFLOW_SKILLS.slice(0, 2)) fs.symlinkSync(path.join(packageRoot, 'skills', skill), path.join(codex, skill), 'junction');
  ({ errors, out } = capture());
  assert.equal(checkLinks({ sourceRoot: packageRoot, scopes, out }), false);
  lines = errors.filter((line) => line.startsWith('help'));
  assert.equal(lines.length, 1, errors.join('\n'));
  assert.ok(lines[0].startsWith(`help    The workflow set is partly linked in ${codex};`), lines[0]);
  assert.ok(lines[0].includes('`node tools/install.mjs link workflow`'), lines[0]);
  assert.ok(!lines[0].includes(claude), lines[0]);
  assert.equal(errors.filter((line) => line.startsWith(`FAIL    ${codex}`)).length, WORKFLOW_SKILLS.length - 2);

  // Set help and occupied-entry help are independent: the writing set linked from another checkout
  // is foreign, not installed from this one, so that scope gets the recovery help and no set help.
  const other = path.join(scratch, 'writing only choices other');
  for (const skill of WRITING_SKILLS) {
    fs.mkdirSync(path.join(other, 'skills', skill), { recursive: true });
    fs.symlinkSync(path.join(other, 'skills', skill), path.join(claude, skill), 'junction');
  }
  for (const skill of WORKFLOW_SKILLS.slice(0, 2)) fs.unlinkSync(path.join(codex, skill));
  ({ errors, out } = capture());
  assert.equal(checkLinks({ sourceRoot: packageRoot, scopes, out }), false);
  lines = errors.filter((line) => line.startsWith('help'));
  assert.equal(lines.length, 2, errors.join('\n'));
  assert.ok(lines[0].startsWith(`help    No skill of the workflow set is installed in ${codex}, where`), lines[0]);
  assert.ok(lines[1].includes('never changes entries it does not own') && lines[1].includes('run `node tools/install.mjs unlink` from the checkout'), lines[1]);

  assert.equal(run(home, 'unlink').status, 0);
  assert.deepEqual(fs.readdirSync(codex), []);
  assert.deepEqual(fs.readdirSync(claude).sort(), [...WRITING_SKILLS].sort(), 'the other checkout\'s links are kept');
});

test('set help offers a set as installed only where every one of its skills is linked', (t) => {
  const complete = path.join(scratch, 'partly present', 'complete');
  const partial = path.join(scratch, 'partly present', 'partial');
  fs.mkdirSync(complete, { recursive: true });
  fs.mkdirSync(partial);
  for (const skill of WRITING_SKILLS) {
    if (!trySymlink(t, path.join(packageRoot, 'skills', skill), path.join(complete, skill), 'junction')) return;
  }

  // One or two of the writing links beside an absent workflow set: no installed-set claim and no
  // two choices, while every missing skill still fails and the check fails.
  for (const count of [1, WRITING_SKILLS.length - 1]) {
    for (const skill of fs.readdirSync(partial)) fs.unlinkSync(path.join(partial, skill));
    for (const skill of WRITING_SKILLS.slice(0, count)) fs.symlinkSync(path.join(packageRoot, 'skills', skill), path.join(partial, skill), 'junction');
    const { errors, out } = capture();
    assert.equal(checkLinks({ sourceRoot: packageRoot, scopes: [{ dir: partial }], out }), false);
    assert.equal(errors.filter((line) => line.startsWith('help')).length, 1, errors.join('\n'));
    assert.ok(errors.some(line => line.startsWith(`help    The writing set is partly linked in ${partial};`) && line.includes('`node tools/install.mjs link writing`')), errors.join('\n'));
    assert.ok(!errors.some(line => line.includes('No skill of the workflow set')), 'a partial set is not offered as installed');
    assert.equal(errors.filter((line) => /^FAIL .*\(found nothing\)$/.test(line)).length, ALL - count, errors.join('\n'));
  }

  // A complete scope beside a partial one, the workflow set absent from both: the help names only
  // the complete scope, and the partial scope keeps its FAIL lines.
  const { errors, out } = capture();
  assert.equal(checkLinks({ sourceRoot: packageRoot, scopes: [{ dir: complete }, { dir: partial }], out }), false);
  const help = errors.filter((line) => line.startsWith('help'));
  assert.equal(help.length, 2, errors.join('\n'));
  assert.ok(help[1].startsWith(`help    The writing set is partly linked in ${partial};`), help[1]);
  assert.ok(help[0].startsWith(`help    No skill of the workflow set is installed in ${complete}, where the writing set is. `), help[0]);
  assert.ok(!help[0].includes(partial), help[0]);
  assert.equal(errors.filter((line) => line.startsWith(`FAIL    ${complete}`)).length, WORKFLOW_SKILLS.length, errors.join('\n'));
  assert.equal(errors.filter((line) => line.startsWith(`FAIL    ${partial}`)).length, WORKFLOW_SKILLS.length + 1, errors.join('\n'));

  // Completing the partial scope brings it into the same help line.
  fs.symlinkSync(path.join(packageRoot, 'skills', WRITING_SKILLS.at(-1)), path.join(partial, WRITING_SKILLS.at(-1)), 'junction');
  const whole = capture();
  assert.equal(checkLinks({ sourceRoot: packageRoot, scopes: [{ dir: complete }, { dir: partial }], out: whole.out }), false);
  const lines = whole.errors.filter((line) => line.startsWith('help'));
  assert.equal(lines.length, 1, whole.errors.join('\n'));
  assert.ok(lines[0].startsWith(`help    No skill of the workflow set is installed in ${complete} and ${partial}, where the writing set is. `), lines[0]);
});

test('partial-set relink help excludes occupied and wholly absent sets', (t) => {
  const scope = path.join(scratch, 'partial-occupied');
  fs.mkdirSync(scope);
  if (!trySymlink(t, path.join(packageRoot, 'skills', WRITING_SKILLS[0]), path.join(scope, WRITING_SKILLS[0]), 'junction')) return;
  fs.writeFileSync(path.join(scope, WRITING_SKILLS[1]), 'foreign');
  const occupied = capture();
  assert.equal(checkLinks({ sourceRoot: packageRoot, scopes: [{ dir: scope }], sets: ['writing'], out: occupied.out }), false);
  assert.ok(occupied.errors.some(line => line.includes('never changes entries it does not own')));
  assert.ok(!occupied.errors.some(line => line.includes('partly linked')));
  fs.unlinkSync(path.join(scope, WRITING_SKILLS[0]));
  fs.unlinkSync(path.join(scope, WRITING_SKILLS[1]));
  const absent = capture();
  assert.equal(checkLinks({ sourceRoot: packageRoot, scopes: [{ dir: scope }], sets: ['writing'], out: absent.out }), false);
  assert.equal(absent.errors.filter(line => line.startsWith('help')).length, 0);
});

test('check names each shared reference a linked skill cannot reach', (t) => {
  const root = path.join(scratch, 'missing-guidance', 'src');
  for (const skill of PACKAGE_SKILLS) {
    fs.mkdirSync(path.join(root, 'skills', skill), { recursive: true });
    fs.writeFileSync(path.join(root, 'skills', skill, 'SKILL.md'), 'skill');
  }
  for (const parts of [...SKILL_SETS.workflow.references, ...RECORD_FORMATS.map((file) => ['docs', 'guidance', file])]) {
    fs.mkdirSync(path.dirname(path.join(root, ...parts)), { recursive: true });
    fs.writeFileSync(path.join(root, ...parts), 'reference');
  }
  fs.writeFileSync(path.join(root, 'docs', 'writing-guidance.md'), 'guidance');
  generateWritingReferences(root);
  fs.rmSync(path.join(root, 'docs', 'writing-guidance.md'));
  const scope = path.join(scratch, 'missing-guidance', 'skills');
  fs.mkdirSync(scope);
  for (const skill of PACKAGE_SKILLS) {
    if (!trySymlink(t, path.join(root, 'skills', skill), path.join(scope, skill), 'junction')) return;
  }
  const scopes = [{ dir: scope }];
  assert.equal(checkLinks({ sourceRoot: root, scopes, sets: ['workflow'], out: silent }), false, 'workflow also needs its writing dependency');
  const { errors, out } = capture();
  assert.equal(checkLinks({ sourceRoot: root, scopes, out }), false, 'the writing set lacks its shared guidance');
  assert.equal(errors.length, WRITING_SKILLS.length, errors.join('\n'));
  for (const skill of WRITING_SKILLS) {
    const real = fs.realpathSync.native(path.join(scope, skill));
    assert.ok(errors.includes(`FAIL    ${path.join(scope, skill)} resolves to ${real}, which cannot reach ${path.join('..', '..', 'docs', 'writing-guidance.md')}`), errors.join('\n'));
  }
  fs.writeFileSync(path.join(root, 'docs', 'writing-guidance.md'), 'guidance');
  assert.equal(checkLinks({ sourceRoot: root, scopes, out: silent }), true, 'every set passes once the guidance exists');
  fs.rmSync(path.join(root, 'skills', 'clarify-artifact', 'SKILL.md'));
  const again = capture();
  assert.equal(checkLinks({ sourceRoot: root, scopes, out: again.out }), false);
  assert.equal(again.errors.length, WRITING_SKILLS.length, 'the missing skill fails itself and the two skills that load it');
  assert.ok(again.errors.some((line) => line.endsWith(`cannot reach SKILL.md, ${path.join('..', '..', 'skills', 'clarify-artifact', 'SKILL.md')}`)), again.errors.join('\n'));
});

test('check names each missing record format for every writing skill, since none is optional', (t) => {
  const fixture = usableFixture(t, 'missing-formats');
  if (!fixture) return;
  const { root, failures } = fixture;
  assert.equal(failures(['writing']).ok, true, 'every format present');
  for (const file of RECORD_FORMATS) fs.rmSync(path.join(root, 'docs', 'guidance', file));
  const { ok, errors } = failures(['writing']);
  assert.equal(ok, false, 'missing formats are reported, not skipped');
  assert.equal(errors.length, WRITING_SKILLS.length, errors.join('\n'));
  const names = RECORD_FORMATS.map((file) => path.join('..', '..', 'docs', 'guidance', file)).join(', ');
  for (const line of errors) assert.ok(line.endsWith(`cannot reach ${names}`), line);
  assert.equal(failures(['workflow']).ok, false, 'workflow checks its writing dependency formats');
});

test('record-skill local links cover the checked formats and shared guide', () => {
  const loaded = new Set();
  for (const skill of ['maintain-glossary', 'record-decision']) {
    const text = fs.readFileSync(path.join(packageRoot, 'skills', skill, 'SKILL.md'), 'utf8');
    for (const match of text.matchAll(/\]\(references\/([^)#]+)(?:#[^)]*)?\)/g)) loaded.add(match[1]);
  }
  assert.deepEqual([...loaded].sort(), [...RECORD_FORMATS, 'writing-guidance.md'].sort());
  for (const file of RECORD_FORMATS) assert.ok(fs.statSync(path.join(packageRoot, 'docs', 'guidance', file)).isFile(), file);
});

test('installed writing skills require their actual local reference bodies', (t) => {
  const fixture = usableFixture(t, 'local-reference');
  if (!fixture) return;
  const { root, failures } = fixture;
  const file = path.join(root, 'skills', 'write-for-humans', 'references', 'writing-guidance.md');
  assert.equal(failures(['writing']).ok, true);
  fs.rmSync(file);
  let result = failures(['writing']);
  assert.equal(result.ok, false);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /references[/\\]writing-guidance\.md/);
  assert.match(result.errors[0], /node tools\/generate-writing-references\.mjs/);
  assert.equal(failures(['workflow']).ok, false, 'workflow checks the actual writing references');
  generateWritingReferences(root);
  fs.appendFileSync(file, '\nchanged local body');
  result = failures(['writing']);
  assert.equal(result.ok, false);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /body differs/);
  generateWritingReferences(root);
  assert.equal(failures(['writing']).ok, true);
});

test('recovery help names only the selected set, so following it leaves other sets alone', (t) => {
  // Another checkout already links every skill; this checkout links only the writing set.
  const other = path.join(scratch, 'help-scope', 'other');
  const root = path.join(scratch, 'help-scope', 'src');
  for (const base of [other, root]) {
    for (const skill of PACKAGE_SKILLS) fs.mkdirSync(path.join(base, 'skills', skill), { recursive: true });
  }
  const home = path.join(scratch, 'help-scope', 'home');
  const scope = path.join(home, '.claude', 'skills');
  fs.mkdirSync(scope, { recursive: true });
  for (const skill of PACKAGE_SKILLS) {
    if (!trySymlink(t, path.join(other, 'skills', skill), path.join(scope, skill), 'junction')) return;
  }
  const scopes = [{ dir: scope }];
  const writing = capture();
  assert.equal(link({ sourceRoot: root, scopes, sets: ['writing'], out: writing.out }), false);
  assert.equal(writing.errors.filter((line) => line.startsWith('skipped')).length, WRITING_SKILLS.length);
  const help = writing.errors.filter((line) => line.startsWith('help'));
  assert.equal(help.length, 1);
  assert.ok(help[0].includes('run `node tools/install.mjs unlink writing` from the checkout it links to'), help[0]);
  assert.ok(help[0].includes('Then run `node tools/install.mjs link writing` again.'), help[0]);
  assert.doesNotMatch(help[0], /unlink` |link` /, 'no unscoped command in set-scoped advice');
  const checked = capture();
  assert.equal(checkLinks({ sourceRoot: root, scopes, sets: ['writing'], out: checked.out }), false);
  assert.ok(checked.errors.some((line) => line.startsWith('help') && line.includes('unlink writing`') && line.includes('link writing`')), checked.errors.join('\n'));
  const cli = run(home, 'link', 'writing');
  assert.equal(cli.status, 1);
  assert.match(cli.stderr, /^help .*`node tools\/install\.mjs unlink writing` from the checkout.*`node tools\/install\.mjs link writing` again\.$/m);

  // Following the scoped advice from the other checkout moves the writing links only.
  assert.equal(unlink({ sourceRoot: other, scopes, sets: ['writing'], out: silent }), true);
  assert.equal(link({ sourceRoot: root, scopes, sets: ['writing'], out: silent }), true);
  for (const skill of WORKFLOW_SKILLS) assert.equal(fs.readlinkSync(path.join(scope, skill)), path.join(other, 'skills', skill), `${skill} still links to the other checkout`);
  for (const skill of WRITING_SKILLS) assert.equal(fs.readlinkSync(path.join(scope, skill)), path.join(root, 'skills', skill));

  // Without a set name the advice stays unscoped, as the command was.
  const all = capture();
  assert.equal(link({ sourceRoot: root, scopes, out: all.out }), false);
  const unscoped = all.errors.find((line) => line.startsWith('help'));
  assert.ok(unscoped.includes('run `node tools/install.mjs unlink` from the checkout') && unscoped.includes('Then run `node tools/install.mjs link` again.'), unscoped);
});

/**
 * A fixture package with every skill's SKILL.md and every shared reference
 * present as readable regular files, linked from a scope directory, with a
 * `failures(sets)` helper that runs `checkLinks` and returns its FAIL lines.
 * Every usable-file case needs the directory links, so the test is skipped,
 * and null returned, where the host forbids them.
 */
function usableFixture(t, name) {
  const root = path.join(scratch, name, 'src');
  for (const skill of PACKAGE_SKILLS) {
    fs.mkdirSync(path.join(root, 'skills', skill), { recursive: true });
    fs.writeFileSync(path.join(root, 'skills', skill, 'SKILL.md'), 'skill');
  }
  for (const parts of [...SKILL_SETS.workflow.references, ...SKILL_SETS.writing.references]) {
    fs.mkdirSync(path.dirname(path.join(root, ...parts)), { recursive: true });
    if (!fs.existsSync(path.join(root, ...parts))) fs.writeFileSync(path.join(root, ...parts), 'reference');
  }
  fs.writeFileSync(path.join(root, 'docs', 'writing-guidance.md'), 'guidance');
  generateWritingReferences(root);
  const scope = path.join(scratch, name, 'skills');
  fs.mkdirSync(scope);
  for (const skill of PACKAGE_SKILLS) {
    if (!trySymlink(t, path.join(root, 'skills', skill), path.join(scope, skill), 'junction')) return null;
  }
  const scopes = [{ dir: scope }];
  const failures = (sets) => {
    const { errors, out } = capture();
    const ok = checkLinks({ sourceRoot: root, scopes, sets, out });
    return { ok, errors: errors.filter((line) => line.startsWith('FAIL')) };
  };
  const guidance = path.join(root, 'docs', 'writing-guidance.md');
  const guidanceName = path.join('..', '..', 'docs', 'writing-guidance.md');
  return { root, guidance, guidanceName, failures };
}

// The usable-file cases that need no file link run here; the file-link and
// permission cases are separate tests, so a host that refuses file symlinks
// or enforces no permissions skips only what it cannot run.
test('check requires readable regular files through the link, not mere existence', (t) => {
  const fixture = usableFixture(t, 'usable');
  if (!fixture) return;
  const { root, guidance, guidanceName, failures } = fixture;
  assert.equal(failures().ok, true, 'readable regular files pass');

  // The guidance is a directory: existence alone would pass, while reading it fails.
  fs.rmSync(guidance);
  fs.mkdirSync(guidance);
  assert.throws(() => fs.readFileSync(guidance), { code: 'EISDIR' });
  let { ok, errors } = failures();
  assert.equal(ok, false);
  assert.equal(errors.length, WRITING_SKILLS.length, errors.join('\n'));
  for (const line of errors) assert.ok(line.endsWith(`, which finds a directory, not a regular file, at ${guidanceName}`), line);
  assert.equal(failures(['workflow']).ok, false, 'workflow needs readable writing guidance');
  fs.rmdirSync(guidance);
  fs.writeFileSync(guidance, 'guidance');
  assert.equal(failures().ok, true, 'restored');

  // A skill's own SKILL.md as a directory fails that skill and the siblings that load it, alongside a missing file.
  const own = path.join(root, 'skills', 'clarify-artifact', 'SKILL.md');
  fs.rmSync(own);
  fs.mkdirSync(own);
  fs.rmSync(path.join(root, 'defaults.yaml'));
  ({ ok, errors } = failures());
  assert.equal(ok, false);
  assert.equal(errors.length, WORKFLOW_SKILLS.length + WRITING_SKILLS.length, errors.join('\n'));
  assert.ok(errors.some((line) => line.includes(', which finds a directory, not a regular file, at SKILL.md;')), errors.join('\n'));
  assert.ok(errors.some((line) => line.endsWith(`, which finds a directory, not a regular file, at ${path.join('..', '..', 'skills', 'clarify-artifact', 'SKILL.md')}`)), errors.join('\n'));
  assert.ok(errors.some((line) => line.endsWith(', which cannot reach ../../defaults.yaml'.replace(/\//g, path.sep))), errors.join('\n'));
  fs.rmdirSync(own);
  fs.writeFileSync(own, 'skill');
  fs.writeFileSync(path.join(root, 'defaults.yaml'), 'reference');
  assert.equal(failures().ok, true, 'restored');
});

test('check follows a file link to a readable file and names a link loop with its cause', (t) => {
  const fixture = usableFixture(t, 'usable-links');
  if (!fixture) return;
  const { guidance, guidanceName, failures } = fixture;
  const elsewhere = path.join(scratch, 'usable-links', 'guidance-elsewhere.md');
  fs.writeFileSync(elsewhere, 'guidance');
  fs.rmSync(guidance);
  if (!trySymlink(t, elsewhere, guidance, 'file')) return;
  assert.equal(failures().ok, true, 'a linked regular file is readable');
  fs.unlinkSync(guidance);
  if (!trySymlink(t, guidance, guidance, 'file')) return;
  const { ok, errors } = failures(['writing']);
  assert.equal(ok, false);
  assert.equal(errors.length, WRITING_SKILLS.length, errors.join('\n'));
  for (const line of errors) assert.ok(line.endsWith(`, which cannot resolve ${guidanceName} (ELOOP)`), line);
});

test('check names a file this process cannot read with the access error the next read would raise', (t) => {
  if (process.platform === 'win32' || process.getuid?.() === 0) { t.skip('needs POSIX permissions enforced'); return; }
  const fixture = usableFixture(t, 'usable-denied');
  if (!fixture) return;
  const { guidance, guidanceName, failures } = fixture;
  fs.chmodSync(guidance, 0o000);
  try {
    assert.throws(() => fs.readFileSync(guidance), { code: 'EACCES' });
    const { ok, errors } = failures(['writing']);
    assert.equal(ok, false);
    assert.equal(errors.length, WRITING_SKILLS.length, errors.join('\n'));
    for (const line of errors) assert.ok(line.endsWith(`, which cannot read ${guidanceName} (EACCES)`), line);
  } finally {
    fs.chmodSync(guidance, 0o644);
  }
  assert.equal(failures().ok, true, 'readable again');
});

test('a clean home links and checks successfully', () => {
  const home = path.join(scratch, 'clean');
  fs.mkdirSync(home);
  assert.equal(run(home, 'link').status, 0);
  assert.equal(fs.existsSync(path.join(home, '.codex/hooks.json')), true, 'workflow support hooks are installed');
  assert.equal(fs.existsSync(path.join(home, '.codex/config.toml')), false, 'Codex session instructions and trust are not configured by the installer');
  const checked = run(home, 'check');
  assert.equal(checked.status, 0, checked.stderr);
  assert.equal(run(home, 'unlink').status, 0);
  const missing = run(home, 'check');
  assert.equal(missing.status, 1, 'missing links fail the check');
  assert.match(missing.stderr, /\(found nothing\)/);
  assert.doesNotMatch(missing.stderr, /^help /m, 'nothing to inspect when destinations are empty');
});

test('destinations that cannot be inspected are reported and kept by link and unlink, never taken as absent', (t) => {
  if (process.platform === 'win32' || process.getuid?.() === 0) { t.skip('needs POSIX permissions enforced'); return; }
  const home = path.join(scratch, 'denied home');
  const codex = path.join(home, '.agents', 'skills');
  const claude = path.join(home, '.claude', 'skills');
  fs.mkdirSync(claude, { recursive: true });
  fs.writeFileSync(path.join(claude, 'plan-reviewer'), 'foreign file');
  assert.equal(run(home, 'link').status, 1, 'the foreign file is skipped');
  const unknown = "an entry that cannot be inspected (EACCES), so whether it is this checkout's link is unknown";

  fs.chmodSync(codex, 0o600);
  try {
    const unlinked = run(home, 'unlink');
    assert.equal(unlinked.status, 0, 'unlink still completes normally');
    assert.equal((unlinked.stdout.match(/^removed /gm) ?? []).length, ALL - 1, 'owned links in the other scope are removed');
    for (const skill of PACKAGE_SKILLS) assert.ok(unlinked.stderr.includes(`kept    ${path.join(codex, skill)}: ${unknown}\n`), unlinked.stderr);
    assert.match(unlinked.stderr, /^kept .*plan-reviewer: a file, not this checkout's link$/m);

    const linked = run(home, 'link');
    assert.equal(linked.status, 1, 'skipped destinations make link fail');
    assert.equal((linked.stdout.match(/^linked /gm) ?? []).length, ALL - 1, 'absent destinations are still linked');
    for (const skill of PACKAGE_SKILLS) assert.ok(linked.stderr.includes(`skipped ${path.join(codex, skill)}: ${unknown}\n`), linked.stderr);
    assert.equal((linked.stderr.match(/^help .*restore access to one that cannot be inspected/gm) ?? []).length, 1);
    assert.doesNotMatch(linked.stderr, /Error:|^\s+at /m, 'reported, not thrown');

    const scopes = [{ dir: codex }];
    assert.equal(unlink({ sourceRoot: packageRoot, scopes, out: silent }), true);
    assert.equal(link({ sourceRoot: packageRoot, scopes, out: silent }), false);
  } finally {
    fs.chmodSync(codex, 0o755);
  }
  for (const skill of PACKAGE_SKILLS) {
    assert.equal(fs.readlinkSync(path.join(codex, skill)), path.join(packageRoot, 'skills', skill), `${skill} survives`);
  }
  assert.equal(fs.readFileSync(path.join(claude, 'plan-reviewer'), 'utf8'), 'foreign file');
  assert.equal(run(home, 'unlink').status, 0);
  assert.deepEqual(fs.readdirSync(codex), []);
});

test('usage errors exit 2', () => {
  assert.equal(run(path.join(scratch, 'clean'), 'bogus').status, 2);
});

test('default reference checks include new documentation families', () => {
  const root = path.join(scratch, 'documentation');
  const dir = path.join(root, 'docs', 'qualities');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'rubric.md'), '[missing evidence](missing.md)\n');
  const errors = [];
  assert.equal(checkReferences({ sourceRoot: root, out: { info() {}, error: line => errors.push(line) } }), false);
  assert.ok(errors.some(line => line.includes('missing.md')), errors.join('\n'));
});

function fixturePackage(name, docs) {
  const root = path.join(scratch, name, 'pkg');
  fs.mkdirSync(path.join(root, 'workflow'), { recursive: true });
  fs.mkdirSync(path.join(root, 'skills'), { recursive: true });
  fs.writeFileSync(path.join(scratch, name, 'outside.md'), 'outside');
  fs.writeFileSync(path.join(root, 'workflow', 'PROCESS.md'), 'process');
  for (const [file, text] of Object.entries(docs)) fs.writeFileSync(path.join(root, file), text);
  return root;
}

function references(root) {
  const errors = [];
  const ok = checkReferences({ sourceRoot: root, out: { info() {}, error: (l) => errors.push(l) } });
  return { ok, errors };
}

test('contained relative links pass; fenced, anchor and URL links are not files', () => {
  const root = fixturePackage('contained', {
    'README.md': [
      '[process](workflow/PROCESS.md#roles) [anchor](#x) [web](https://example.com) [tpl](<placeholder>)',
      'See `workflow/PROCESS.md` and `workflow/<template>.md`.',
      '```text',
      '[ignored](../outside.md)',
      '```',
    ].join('\n'),
  });
  assert.deepEqual(references(root), { ok: true, errors: [] });
});

test('escaping, missing and absolute targets fail', () => {
  const root = fixturePackage('escaping', {
    'README.md': '[out](../outside.md)\n[gone](workflow/MISSING.md)\n[abs](/etc/hosts)\n`workflow/NOPE.md`\n',
  });
  const { ok, errors } = references(root);
  assert.equal(ok, false);
  assert.equal(errors.length, 4);
  assert.match(errors.join('\n'), /resolves outside the package/);
  assert.match(errors.join('\n'), /missing link target workflow\/MISSING\.md/);
  assert.match(errors.join('\n'), /is absolute/);
  assert.match(errors.join('\n'), /missing named path workflow\/NOPE\.md/);
});

test('a symlink inside the package whose target escapes fails; one staying inside passes', (t) => {
  const root = fixturePackage('symlinked', {
    'README.md': '[via link](workflow/escape/outside.md)\n[inside](workflow/alias/PROCESS.md)\n',
  });
  if (!trySymlink(t, path.join(scratch, 'symlinked'), path.join(root, 'workflow', 'escape'), 'junction')) return;
  trySymlink(t, path.join(root, 'workflow'), path.join(root, 'workflow', 'alias'), 'junction');
  const { ok, errors } = references(root);
  assert.equal(ok, false);
  assert.equal(errors.length, 1, errors.join('\n'));
  assert.match(errors[0], /escape\/outside\.md resolves outside the package/);
});

test('the package itself passes the reference check', () => {
  assert.equal(checkReferences({ sourceRoot: packageRoot, out: silent }), true);
});

test('a list-item fence closes like any other, so later links are still checked', () => {
  const root = fixturePackage('list-fence', {
    'README.md': ['- ~~~sh', '  node x', '  ~~~', '[out](../outside.md)', '[gone](workflow/NOPE.md)', '`workflow/ALSO-MISSING.md`'].join('\n'),
  });
  const { ok, errors } = references(root);
  assert.equal(ok, false);
  assert.equal(errors.length, 3, errors.join('\n'));
  assert.match(errors.join('\n'), /outside\.md resolves outside the package/);
});

test('a link loop is reported with its cause, not as a missing target', (t) => {
  const root = fixturePackage('loop', { 'README.md': '[loop](workflow/loop.md)\n' });
  if (!trySymlink(t, path.join(root, 'workflow', 'loop2.md'), path.join(root, 'workflow', 'loop.md'), 'file')) return;
  trySymlink(t, path.join(root, 'workflow', 'loop.md'), path.join(root, 'workflow', 'loop2.md'), 'file');
  const { ok, errors } = references(root);
  assert.equal(ok, false);
  assert.equal(errors.length, 1, errors.join('\n'));
  assert.match(errors[0], /link target workflow\/loop\.md cannot be resolved \(ELOOP\)/);
});

// Windows ownership normalization, checked with Windows path rules on any host.
// Native junction formats and permissions still need a Windows run.
test('link ownership compares targets by each platform\'s path rules', () => {
  const expected = 'C:\\src\\pkg\\skills\\plan-reviewer';
  const dir = 'C:\\Users\\a\\.claude\\skills';
  for (const text of [
    expected,
    '\\\\?\\C:\\src\\pkg\\skills\\plan-reviewer',
    'c:\\SRC\\Pkg\\skills\\PLAN-REVIEWER',
    'C:\\src\\pkg\\skills\\plan-reviewer\\\\',
    '\\\\?\\c:/src/pkg/skills/plan-reviewer/',
    'C:/src/pkg/skills/plan-reviewer',
    '..\\..\\..\\..\\src\\pkg\\skills\\plan-reviewer',
  ]) assert.ok(sameLinkTarget(dir, text, expected, 'win32'), `owned: ${text}`);
  for (const text of [
    'C:\\src\\pkg-old\\skills\\plan-reviewer',
    'C:\\src\\pkg\\skills\\plan-reviewer-x',
    'D:\\src\\pkg\\skills\\plan-reviewer',
    '\\\\server\\share\\pkg\\skills\\plan-reviewer',
  ]) assert.ok(!sameLinkTarget(dir, text, expected, 'win32'), `foreign: ${text}`);
  assert.ok(sameLinkTarget('C:\\x', '\\\\?\\C:\\', 'C:\\', 'win32'), 'drive root with and without prefix');

  const posix = '/src/pkg/skills/plan-reviewer';
  for (const text of [posix, '/src/pkg/skills/plan-reviewer/', '../../../../src/pkg/skills/plan-reviewer']) {
    assert.ok(sameLinkTarget('/home/a/.claude/skills', text, posix, 'linux'), `owned: ${text}`);
  }
  for (const text of [
    '/SRC/pkg/skills/plan-reviewer', '/src/pkg\\skills\\plan-reviewer', '/src/pkg-old/skills/plan-reviewer',
    '/src/pkg/skills/plan-reviewer\\', '/src/pkg/skills/plan-reviewer\\\\', '/src/pkg/skills/plan-reviewer/\\',
  ]) {
    assert.ok(!sameLinkTarget('/home/a/.claude/skills', text, posix, 'linux'), `foreign: ${text}`);
  }
  assert.ok(sameLinkTarget('/x', '/', '/', 'linux'), 'root');
});

test('link removal falls back to rmdir only for Windows directory-link errors', () => {
  const fake = (unlinkCode, rmdirCode) => {
    const calls = [];
    const fail = (code) => { throw Object.assign(new Error(code), { code }); };
    return {
      calls,
      unlinkSync: (dest) => { calls.push(['unlink', dest]); if (unlinkCode) fail(unlinkCode); },
      rmdirSync: (dest) => { calls.push(['rmdir', dest]); if (rmdirCode) fail(rmdirCode); },
    };
  };
  const ok = fake(null);
  removeLink('L', 'win32', ok);
  assert.deepEqual(ok.calls, [['unlink', 'L']]);
  for (const code of ['EPERM', 'EISDIR']) {
    const ops = fake(code);
    removeLink('L', 'win32', ops);
    assert.deepEqual(ops.calls, [['unlink', 'L'], ['rmdir', 'L']], code);
  }
  const rmdirFails = fake('EPERM', 'ENOTEMPTY');
  assert.throws(() => removeLink('L', 'win32', rmdirFails), { code: 'ENOTEMPTY' });
  for (const [platform, code] of [['win32', 'EACCES'], ['win32', 'EBUSY'], ['darwin', 'EPERM'], ['linux', 'EISDIR']]) {
    const ops = fake(code);
    assert.throws(() => removeLink('L', platform, ops), { code }, `${platform} ${code}`);
    assert.deepEqual(ops.calls, [['unlink', 'L']], `${platform} ${code} does not fall back`);
  }
});

function fixtureSource(name) {
  const root = path.join(scratch, name, 'src');
  for (const skill of PACKAGE_SKILLS) fs.mkdirSync(path.join(root, 'skills', skill), { recursive: true });
  const scope = path.join(scratch, name, 'skills');
  fs.mkdirSync(scope);
  return { root, scopes: [{ dir: scope }], scope };
}

function capture() {
  const errors = [];
  return { errors, out: { info() {}, error: (line) => errors.push(line) } };
}

test('on POSIX a link to a name ending in a backslash is foreign and is kept with its target', (t) => {
  if (process.platform === 'win32') { t.skip('a backslash is a path separator on Windows'); return; }
  const { root, scopes, scope } = fixtureSource('trailing-backslash');
  const foreign = `${path.join(root, 'skills', 'plan-reviewer')}\\`;
  fs.mkdirSync(foreign);
  fs.writeFileSync(path.join(foreign, 'foreign.txt'), 'foreign');
  const dest = path.join(scope, 'plan-reviewer');
  if (!trySymlink(t, foreign, dest, 'dir')) return;

  const checked = capture();
  assert.equal(checkLinks({ sourceRoot: root, scopes, out: checked.out }), false);
  assert.ok(checked.errors.some((line) => line.startsWith(`FAIL    ${dest} is not linked`)), checked.errors.join('\n'));
  const removed = capture();
  unlink({ sourceRoot: root, scopes, out: removed.out });
  assert.ok(removed.errors.includes(`kept    ${dest}: a link to ${foreign}, not this checkout's link`), removed.errors.join('\n'));
  assert.equal(fs.readlinkSync(dest), foreign, 'the foreign link survives');
  assert.equal(fs.readFileSync(path.join(foreign, 'foreign.txt'), 'utf8'), 'foreign');
});

test('check names an owned link\'s missing target and why a foreign link cannot be resolved', (t) => {
  const { root, scopes, scope } = fixtureSource('diagnostics');
  const missing = path.join(root, 'skills', 'plan-reviewer');
  if (!trySymlink(t, missing, path.join(scope, 'plan-reviewer'), 'junction')) return;
  fs.rmSync(missing, { recursive: true });
  const loop = path.join(scope, 'review-adjudicator');
  trySymlink(t, loop, loop, 'junction');

  const { errors, out } = capture();
  assert.equal(checkLinks({ sourceRoot: root, scopes, out }), false);
  const text = errors.join('\n');
  assert.ok(errors.includes(`FAIL    ${path.join(scope, 'plan-reviewer')} links to ${missing}, which does not exist`), text);
  assert.doesNotMatch(text, /null/);
  assert.ok(text.includes(`(found a link to ${loop}, which cannot be resolved (ELOOP))`), text);
  assert.ok(text.includes(`${path.join(scope, 'plan-coordinator')} is not linked`), 'later destinations are still checked');
  assert.ok(fs.lstatSync(loop).isSymbolicLink(), 'check changes nothing');
});

test('entries that cannot be inspected are described with their error code, not as absent', (t) => {
  if (process.platform === 'win32' || process.getuid?.() === 0) { t.skip('needs POSIX permissions enforced'); return; }
  const { root, scopes, scope } = fixtureSource('denied');
  const locked = path.join(scratch, 'denied', 'locked');
  fs.mkdirSync(path.join(locked, 'inner'), { recursive: true });
  const dest = path.join(scope, 'plan-coordinator');
  if (!trySymlink(t, path.join(locked, 'inner'), dest, 'dir')) return;
  const hidden = path.join(scratch, 'denied', 'hidden');
  fs.mkdirSync(hidden);
  fs.chmodSync(locked, 0o000);
  fs.chmodSync(hidden, 0o600);
  try {
    const checked = capture();
    assert.equal(checkLinks({ sourceRoot: root, scopes, out: checked.out }), false);
    assert.ok(checked.errors.join('\n').includes(`(found a link to ${path.join(locked, 'inner')}, which cannot be resolved (EACCES))`),
      checked.errors.join('\n'));
    const unreadable = capture();
    assert.equal(checkLinks({ sourceRoot: root, scopes: [{ dir: hidden }], out: unreadable.out }), false);
    const failures = unreadable.errors.filter((line) => line.startsWith('FAIL'));
    assert.equal(failures.length, PACKAGE_SKILLS.length, 'every destination is still reported');
    for (const line of failures) assert.match(line, /\(found an entry that cannot be inspected \(EACCES\)\)$/);
  } finally {
    fs.chmodSync(locked, 0o755);
    fs.chmodSync(hidden, 0o755);
  }
});
