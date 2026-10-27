import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { COMMIT_TYPES, validateCommitMessage } from '../lib/commit-message.mjs';
import { WRITING_REFERENCES, generateWritingReferences } from '../lib/writing-references.mjs';

const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'aw commit é-'));
after(() => fs.rmSync(scratch, { recursive: true, force: true }));
const emptyConfig = path.join(scratch, 'empty-config');
const emptyTemplates = path.join(scratch, 'empty-templates');
fs.writeFileSync(emptyConfig, '');
fs.mkdirSync(emptyTemplates);
// Isolate fixture repositories from the caller's Git settings and worktree.
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
Object.assign(env, { GIT_CONFIG_GLOBAL: emptyConfig, GIT_CONFIG_NOSYSTEM: '1', GIT_TEMPLATE_DIR: emptyTemplates });
const paths = new Set(['docs/guide.md']);
const validate = message => validateCommitMessage(message, paths);
const errors = message => validate(message).errors.map(error => error.message).join('\n');

test('subjects accept the type roster, optional scopes and imperative descriptions', () => {
  for (const type of COMMIT_TYPES) assert.equal(validate(`${type}: update guidance`).ok, true, type);
  assert.equal(validate('fix(tools/commit-message): reject malformed input').ok, true);
  assert.equal(validate('chore: tidy').ok, true);
  assert.equal(validate('\uFEFFdocs: explain conventions\r\n').ok, true);
});

test('subject examples rejected by the guidance are rejected by the lint', () => {
  for (const subject of ['docs: added guidance', 'docs: Adds guidance.', 'docs: add guidance.', 'feat: adding a role']) {
    assert.match(errors(subject), /imperative subject/, subject);
  }
  for (const subject of ['', 'add a role', 'feat(): add a role', 'feat(Role): add a role', 'feat:  add a role']) {
    assert.equal(validate(subject).ok, false, subject);
  }
  assert.match(errors('wip: add a role'), /Unsupported type/);
});

test('body details are imperative bullets with adjacent indented continuations', () => {
  assert.equal(validate('refactor: separate roles\n\n- move shared guidance\n  into one reference\n- preserve ownership').ok, true);
  for (const line of ['Prose paragraph', '- moved shared guidance', '- adds guidance', '- cleanup', '  orphan continuation', 'Signed-off-by: A <a@example.com>']) {
    assert.match(errors(`docs: update guidance\n\n${line}`), /imperative bullet/, line);
  }
  assert.equal(validate('docs: update guidance\n\n- move shared guidance\n\n  disconnected prose').ok, false);
});

test('breaking subjects need a meaningful callout and all failures are returned', () => {
  assert.match(errors('feat!: change review output'), /breaking subject requires/);
  assert.equal(validate('feat!: change review output\n\n- preserve finding identities\n\nBREAKING CHANGE: report fields have changed').ok, true);
  assert.equal(validate('feat: change review output\n\nBREAKING CHANGE: report fields have changed').ok, true);
  for (const callout of ['BREAKING CHANGE:', 'BREAKING CHANGE: ', 'BREAKING CHANGE:no space']) {
    assert.equal(validate(`feat!: change output\n\n${callout}`).ok, false);
  }
  assert.ok(validate('feat!: added output.\n\nSome prose\nMore prose').errors.length >= 4);
});

test('reference checks distinguish candidate paths, outside paths and public URLs', () => {
  assert.equal(validate('docs: update docs/guide.md').ok, true);
  assert.equal(validate('docs: update docs\\guide.md').ok, true);
  assert.equal(validate('docs: explain https://example.com/other/repo.md').ok, true);
  for (const reference of ['other/repo.md', '../docs/guide.md', '/Users/example/work/repo.md', 'C:\\Users\\example\\repo.md', '~example/', '-users-example-project']) {
    assert.equal(validate(`docs: explain ${reference}`).ok, false, reference);
  }
});

let ordinal = 0;
function fixture() {
  const root = path.join(scratch, `repo with spaces ${++ordinal}`);
  fs.mkdirSync(root);
  for (const name of ['.githooks/commit-msg', 'tools/commit-message.mjs', 'tools/commit-verify.mjs',
    'tools/verify.mjs', 'tools/install-hooks.mjs', 'tools/lib/commit-message.mjs',
    'tools/lib/git.mjs', 'tools/lib/cli.mjs', 'tools/lib/paths.mjs', 'tools/lib/run-node.mjs',
    'tools/lib/install.mjs', 'tools/lib/markdown.mjs', 'tools/lib/writing-references.mjs']) {
    const dest = path.join(root, name);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(source, name), dest);
  }
  for (const relative of new Set(WRITING_REFERENCES.map((reference) => reference.source))) {
    const file = path.join(root, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '# Fixture reference\n');
  }
  generateWritingReferences(root);
  // Skill validation has its own tests. Here its small stand-in lets us
  // exercise the real gate, reference checker and test runner without copying
  // this repository's suite recursively into every nested hook invocation.
  fs.writeFileSync(path.join(root, 'tools/validate.mjs'), "console.log('fixture metadata ran');\n");
  fs.mkdirSync(path.join(root, 'tools/test'));
  fs.writeFileSync(path.join(root, 'tools/test/suite.test.mjs'), "import test from 'node:test';\ntest('fixture suite ran', () => {});\n");
  git(root, ['init', '-q']);
  git(root, ['config', 'user.name', 'Fixture']);
  git(root, ['config', 'user.email', 'fixture@example.invalid']);
  git(root, ['config', 'commit.gpgsign', 'false']);
  return root;
}

function run(root, command, args) {
  return spawnSync(command, args, { cwd: root, env, encoding: 'utf8' });
}
// Git redirects hook output to stderr; direct CLI output uses both streams.
const output = result => result.stdout + result.stderr;
function git(root, args) {
  const result = run(root, 'git', args);
  assert.equal(result.status, 0, `${args.join(' ')}: ${result.stderr}`);
  return result.stdout;
}
function lint(root, text, cwd = root) {
  const file = path.join(root, 'message with spaces.txt');
  fs.writeFileSync(file, text);
  const result = run(cwd, process.execPath, [path.join(root, 'tools/commit-message.mjs'), file]);
  assert.equal(fs.readFileSync(file, 'utf8'), text, 'lint leaves message unchanged');
  return result;
}
function install(root) {
  return run(root, process.execPath, [path.join(root, 'tools/install-hooks.mjs')]);
}

test('CLI checks the index, including staged additions, rather than working files', () => {
  const root = fixture();
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  const file = path.join(root, 'docs', 'guide.md');
  fs.writeFileSync(file, 'guide');
  assert.equal(lint(root, 'docs: update docs/guide.md').status, 1, 'untracked file is absent from candidate');
  git(root, ['add', 'docs/guide.md']);
  fs.unlinkSync(file);
  assert.equal(lint(root, 'docs: update docs/guide.md', path.join(root, 'docs')).status, 0, 'staged file survives working-tree removal');
  git(root, ['rm', '--cached', 'docs/guide.md']);
  assert.equal(lint(root, 'docs: update docs/guide.md').status, 1);
});

test('CLI uses Git comment settings and scissors, with CRLF input', () => {
  const root = fixture();
  assert.equal(lint(root, '# template\r\ndocs: explain guidance\r\n# comment\r\n').status, 0);
  git(root, ['config', 'core.commentChar', ';']);
  assert.equal(lint(root, '; template\ndocs: explain guidance\n; comment').status, 0);
  assert.equal(lint(root, 'docs: explain guidance\n# retained prose').status, 1);
  assert.equal(lint(root, 'docs: explain guidance\n; ------------------------ >8 ------------------------\nverbose diff').status, 0);
});

test('CLI fails clearly for arguments, unreadable files, invalid UTF-8 and absent Git context', () => {
  const root = fixture();
  const cli = path.join(root, 'tools/commit-message.mjs');
  assert.equal(run(root, process.execPath, [cli]).status, 2);
  assert.equal(run(root, process.execPath, [cli, 'one', 'two']).status, 2);
  assert.equal(run(root, process.execPath, [cli, 'missing']).status, 1);
  const invalid = path.join(root, 'invalid');
  fs.writeFileSync(invalid, Buffer.from([0xff]));
  assert.equal(run(root, process.execPath, [cli, invalid]).status, 1);
  assert.equal(lint(root, 'docs: explain guidance', scratch).status, 1);
});

test('hook setup is idempotent and real Git accepts and rejects messages', () => {
  const root = fixture();
  assert.equal(install(root).status, 0);
  assert.equal(install(root).status, 0);
  assert.equal(git(root, ['config', '--local', '--get', 'core.hooksPath']).trim(), '.githooks');
  const rejected = run(root, 'git', ['commit', '--allow-empty', '-m', 'not conventional']);
  assert.notEqual(rejected.status, 0);
  assert.match(rejected.stderr, /conventional-commits\.md/);
  assert.doesNotMatch(output(rejected), /fixture metadata ran|fixture suite ran/);
  const accepted = run(root, 'git', ['commit', '--allow-empty', '-m', 'test: exercise commit hook']);
  assert.equal(accepted.status, 0, accepted.stderr);
  assert.match(output(accepted), /fixture metadata ran/);
  assert.match(output(accepted), /fixture suite ran/, 'the nested test runner actually executes tests');
  assert.match(output(accepted), /verify: all checks passed/);
  const before = git(root, ['rev-parse', 'HEAD']);
  assert.notEqual(run(root, 'git', ['commit', '--allow-empty', '-m', 'feat!: change behavior']).status, 0);
  assert.equal(git(root, ['rev-parse', 'HEAD']), before, 'rejection creates no commit');
});

test('a failing test blocks a real commit, and a correction runs the full suite again', () => {
  const root = fixture();
  assert.equal(install(root).status, 0);
  const failing = path.join(root, 'tools/test/failing.test.mjs');
  fs.writeFileSync(failing, "import test from 'node:test';\nimport assert from 'node:assert/strict';\ntest('second fixture test', () => assert.fail('intentional gate failure'));\n");
  const rejected = run(root, 'git', ['commit', '--allow-empty', '-m', 'test: exercise failing gate']);
  assert.notEqual(rejected.status, 0);
  assert.match(output(rejected), /fixture suite ran/);
  assert.match(output(rejected), /intentional gate failure/);
  assert.match(rejected.stderr, /commit blocked/);
  assert.notEqual(run(root, 'git', ['rev-parse', '--verify', 'HEAD']).status, 0, 'no initial commit was created');
  fs.writeFileSync(failing, "import test from 'node:test';\ntest('corrected fixture test', () => {});\n");
  const accepted = run(root, 'git', ['commit', '--allow-empty', '-m', 'test: exercise corrected gate']);
  assert.equal(accepted.status, 0, accepted.stderr);
  assert.match(output(accepted), /fixture suite ran/);
  assert.match(output(accepted), /corrected fixture test/);
  assert.match(output(accepted), /verify: all checks passed/);
});

test('metadata, generated-reference and package-reference failures stop the commit before the test suite', () => {
  const root = fixture();
  assert.equal(install(root).status, 0);
  const validator = path.join(root, 'tools/validate.mjs');
  fs.writeFileSync(validator, 'process.exitCode = 1;\n');
  const metadata = run(root, 'git', ['commit', '--allow-empty', '-m', 'test: exercise metadata gate']);
  assert.notEqual(metadata.status, 0);
  assert.doesNotMatch(output(metadata), /verify: package references|fixture suite ran/);
  fs.writeFileSync(validator, "console.log('fixture metadata ran');\n");
  const generated = path.join(root, WRITING_REFERENCES[0].file);
  fs.appendFileSync(generated, 'stale body\n');
  const drift = run(root, 'git', ['commit', '--allow-empty', '-m', 'test: exercise generated-reference gate']);
  assert.notEqual(drift.status, 0);
  assert.match(drift.stderr, /body differs/);
  assert.doesNotMatch(output(drift), /verify: package references|fixture suite ran/);
  generateWritingReferences(root);
  fs.writeFileSync(path.join(root, 'README.md'), '[missing reference](absent.md)\n');
  const references = run(root, 'git', ['commit', '--allow-empty', '-m', 'test: exercise reference gate']);
  assert.notEqual(references.status, 0);
  assert.match(references.stderr, /absent\.md/);
  assert.doesNotMatch(output(references), /fixture suite ran/);
});

test('the complete verification command runs from the source root and checks its arguments', () => {
  const root = fixture();
  const verify = path.join(root, 'tools/verify.mjs');
  const result = run(path.join(root, 'tools'), process.execPath, [verify]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /fixture suite ran/);
  assert.equal(run(root, process.execPath, [verify, '--skip-tests']).status, 2);
  const commitVerify = path.join(root, 'tools/commit-verify.mjs');
  assert.equal(run(root, process.execPath, [commitVerify]).status, 2);
  assert.equal(run(root, process.execPath, [commitVerify, 'one', 'two']).status, 2);
});

test('hook setup preserves foreign hook directories and existing default hooks', () => {
  const configured = fixture();
  git(configured, ['config', 'core.hooksPath', 'foreign-hooks']);
  assert.equal(install(configured).status, 1);
  assert.equal(git(configured, ['config', '--get', 'core.hooksPath']).trim(), 'foreign-hooks');
  const existing = fixture();
  const hook = path.join(existing, '.git', 'hooks', 'pre-commit');
  fs.mkdirSync(path.dirname(hook), { recursive: true });
  fs.writeFileSync(hook, 'foreign hook');
  assert.equal(install(existing).status, 1);
  assert.equal(fs.readFileSync(hook, 'utf8'), 'foreign hook');
  assert.equal(run(existing, 'git', ['config', '--local', '--get', 'core.hooksPath']).status, 1);
});

test('the hook operates in a linked worktree and the CLI runs through a symlink', t => {
  const root = fixture();
  assert.equal(install(root).status, 0);
  git(root, ['commit', '--allow-empty', '-m', 'test: initialize fixture']);
  const worktree = path.join(scratch, `linked worktree ${ordinal}`);
  git(root, ['worktree', 'add', '--detach', worktree, 'HEAD']);
  // Runtime files are deliberately not part of fixture history; copy only them.
  fs.cpSync(path.join(root, '.githooks'), path.join(worktree, '.githooks'), { recursive: true });
  fs.cpSync(path.join(root, 'tools'), path.join(worktree, 'tools'), { recursive: true });
  fs.cpSync(path.join(root, 'docs'), path.join(worktree, 'docs'), { recursive: true });
  fs.cpSync(path.join(root, 'skills'), path.join(worktree, 'skills'), { recursive: true });
  assert.equal(install(worktree).status, 0);
  const rejected = run(worktree, 'git', ['commit', '--allow-empty', '-m', 'wrong']);
  assert.notEqual(rejected.status, 0);
  assert.match(rejected.stderr, /conventional-commits\.md/);
  const link = path.join(scratch, `lint-link-${ordinal}.mjs`);
  try { fs.symlinkSync(path.join(root, 'tools/commit-message.mjs'), link); }
  catch (error) { if (error.code === 'EPERM') { t.diagnostic('host does not permit file symlinks'); return; } throw error; }
  const file = path.join(root, 'bad-message');
  fs.writeFileSync(file, 'wrong');
  assert.equal(run(root, process.execPath, [link, file]).status, 1);
});
