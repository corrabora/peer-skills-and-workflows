// Binding helper: inspect, checkout facts, command usage and guidance discovery.
// Shared fixtures in ../test-support/bind.mjs give each test file its own
// temporary directory of disposable Git repositories, so the files can run
// concurrently; this checkout's project files and workflow records stay unchanged.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import {
  checkoutFacts, discoverCandidates, establishLocalStorage, EXCLUDE_RULE, excludeFile,
} from '../lib/bind.mjs';
import {
  packageRoot, cli, scratch, GIT_ENV, git, run, repository, write, qualityFixture, indexOnlyEntry,
} from '../test-support/bind.mjs';

test('inspect discovers quality selection, extensions and scoped guidance in a fresh repository', () => {
  const dir = repository('fresh', qualityFixture);
  const { status, json, stderr } = run('inspect', '--repo', dir);
  assert.equal(status, 0, stderr);
  assert.equal(json.checkout, dir);
  assert.equal(json.linkedWorktree, false);
  assert.equal(json.branch, 'main');
  assert.equal(json.head, git(dir, 'rev-parse', 'HEAD').trim());
  assert.deepEqual(json.localStorage.tracked, []);
  assert.equal(json.localStorage.ignored, false);
  assert.equal(json.binding.present, false);
  assert.equal(json.quality.present, true);
  const ids = json.quality.profiles.map((p) => [p.profileId, p.present, p.selectedBy]);
  assert.deepEqual(ids, [
    ['profile:acme/defaults', true, 'config'],
    ['profile:acme/core', true, 'profile:acme/defaults inherits'],
    ['profile:acme/reference', false, 'profile:acme/defaults requires'],
  ]);
  const byPath = Object.fromEntries(json.candidates.map((c) => [c.path, c.category]));
  assert.equal(byPath['AGENTS.md'], 'instructions');
  assert.equal(byPath['src/deep/AGENTS.md'], 'instructions');
  assert.equal(byPath['docs/qualities/README.md'], 'guidance');
  assert.equal(byPath['docs/CONTRIBUTING.md'], 'guidance');
  assert.equal(byPath['.quality/config.json'], 'quality');
  assert.equal(byPath['.quality/profiles/acme-core/_manifest/profile.json'], 'quality');
  assert.equal(byPath['Makefile'], 'verification');
  assert.equal(byPath['README.md'], 'guidance');
  assert.ok(!('src/main.js' in byPath));
  assert.equal(json.workflowSource.path, packageRoot);
  assert.match(json.workflowSource.digest, /^sha256:[0-9a-f]{64}$/);
});

test('newly added, uncommitted guidance is found by discovery; ignored files are not', () => {
  const dir = repository('added', { 'README.md': '# P\n', '.gitignore': 'secret.md\n' });
  write(dir, { 'docs/new-policy.md': '# New\n', 'secret.md': 'x', 'CLAUDE.md': '# C\n' });
  const { candidates: found, complete, errors } = discoverCandidates(dir);
  assert.equal(complete, true);
  assert.deepEqual(errors, []);
  assert.deepEqual(found.filter((c) => !c.tracked).map((c) => c.path), ['CLAUDE.md', 'docs/new-policy.md']);
  assert.ok(!found.some((c) => c.path === 'secret.md'));
});

test('a repository without commits and a fresh clone are inspected without local state', () => {
  const empty = repository('empty');
  const facts = checkoutFacts(empty);
  assert.equal(facts.head, null);
  assert.equal(facts.branch, 'main');
  assert.equal(establishLocalStorage(empty).status, 'added');

  const origin = repository('origin', {
    'README.md': '# P\n',
    '.quality/config.json': JSON.stringify({ profiles: [{ profileId: 'profile:acme/solo', path: 'profiles/acme-solo' }] }),
    '.quality/profiles/acme-solo/_manifest/profile.json': JSON.stringify({ profileId: 'profile:acme/solo', version: '1.0.0' }),
  });
  fs.mkdirSync(path.join(origin, '.agent-workflow'));
  fs.writeFileSync(path.join(origin, '.agent-workflow', 'binding.md'), 'local only\n');
  establishLocalStorage(origin);
  const clone = path.join(scratch, 'clone');
  git(scratch, 'clone', '-q', origin, clone);
  const inspected = run('inspect', '--repo', clone);
  assert.equal(inspected.status, 0, inspected.stderr);
  assert.equal(inspected.json.binding.present, false, 'local binding state does not travel with a clone');
  assert.equal(inspected.json.binding.sourcesPresent, false);
  assert.equal(inspected.json.binding.manifest.usable, false);
  assert.equal(inspected.json.binding.manifest.reason, 'absent');
  assert.equal(inspected.json.localStorage.ignored, false, 'nor does the local exclude rule');
  assert.equal(inspected.json.localStorage.directoryPresent, false);
  assert.equal(inspected.json.localStorage.rulePresent, false);
  assert.equal(fs.existsSync(path.join(clone, '.agent-workflow')), false, 'inspect creates nothing');
  assert.equal(inspected.json.quality.present, true);
  assert.deepEqual(inspected.json.quality.profiles, [{
    profileId: 'profile:acme/solo', path: '.quality/profiles/acme-solo', selectedBy: 'config', present: true, version: '1.0.0', inherits: [], requires: [],
  }]);
});

test('usage and checkout errors', () => {
  assert.equal(run('bogus').status, 2);
  assert.equal(run('inspect').status, 2);
  assert.equal(run('sources', '--repo', scratch).status, 2, 'sources needs a path');
  assert.equal(run('inspect', '--repo', scratch, '--out', 'x').status, 2);
  const notGit = path.join(scratch, 'plain');
  fs.mkdirSync(notGit);
  const result = run('inspect', '--repo', notGit);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /is not inside a Git working tree/);
  const nested = repository('nested', { 'sub/x.md': 'x\n' });
  const sub = run('inspect', '--repo', path.join(nested, 'sub'));
  assert.equal(sub.status, 1);
  assert.match(sub.stderr, /is not the top of its Git working tree/);
  assert.match(run('inspect', '--repo', path.join(scratch, 'absent')).stderr, /does not exist/);
});

test('discovery denial fails a file-only CHECK with surviving facts and restores filtered candidates', (t) => {
  if (process.platform === 'win32' || process.getuid?.() === 0) { t.skip('needs POSIX permissions enforced'); return; }
  const dir = repository('discovery-denial', { 'README.md': 'readable', '.gitignore': '/.agent-workflow/\n' });
  establishLocalStorage(dir);
  const out = path.join(dir, '.agent-workflow/binding-sources.json');
  assert.equal(run('sources', '--repo', dir, '--out', out, 'README.md').status, 0);
  write(dir, { 'docs/private-notes.md': 'ignored private notes', 'docs/new-guidance.md': 'visible guidance' });
  const exclude = excludeFile(dir);
  fs.writeFileSync(exclude, `${EXCLUDE_RULE}\ndocs/private-notes.md\n`);
  const before = fs.readFileSync(out, 'utf8');
  const readable = run('inspect', '--repo', dir);
  assert.equal(readable.status, 0, readable.stderr);
  assert.deepEqual(readable.json.discovery, { complete: true, errors: [] });
  assert.ok(!readable.json.candidates.some((c) => c.path === 'docs/private-notes.md'));
  assert.ok(readable.json.candidates.some((c) => c.path === 'docs/new-guidance.md'));
  fs.chmodSync(exclude, 0);
  try {
    assert.throws(() => fs.readFileSync(exclude), { code: 'EACCES' });
    const denied = run('inspect', '--repo', dir);
    assert.equal(denied.status, 1, denied.stderr);
    assert.equal(denied.json.discovery.complete, false);
    assert.ok(denied.json.discovery.errors.some((e) => e.path === exclude && /Permission denied/.test(e.error)));
    assert.equal(denied.json.binding.comparison.current, true, `file-only recorded currentness is independent; comparison: ${JSON.stringify(denied.json.binding.comparison)}`);
    assert.equal(denied.json.localStorage.ignored, true);
    assert.equal(denied.json.localStorage.rulePresent, null);
    assert.ok(denied.json.candidates.some((c) => c.path === 'docs/private-notes.md'), 'unverified candidates remain diagnostic only');
  } finally { fs.chmodSync(exclude, 0o644); }
  const restored = run('inspect', '--repo', dir);
  assert.equal(restored.status, 0, restored.stderr);
  assert.deepEqual(restored.json.discovery, readable.json.discovery);
  assert.deepEqual(restored.json.candidates, readable.json.candidates);
  assert.equal(fs.readFileSync(out, 'utf8'), before);
});

test('a denied directory names its own path in discovery errors and an unknown warning has no path', (t) => {
  if (process.platform === 'win32' || process.getuid?.() === 0) { t.skip('needs POSIX permissions enforced'); return; }
  const dir = repository('discovery-directory-denial', { 'README.md': 'readable', 'docs/private/notes.md': 'notes', '.gitignore': '/.agent-workflow/\n' });
  establishLocalStorage(dir);
  const out = path.join(dir, '.agent-workflow/binding-sources.json');
  assert.equal(run('sources', '--repo', dir, '--out', out, 'README.md').status, 0);
  write(dir, { 'docs/private/new-guidance.md': 'untracked guidance' });
  const readable = run('inspect', '--repo', dir);
  assert.equal(readable.status, 0, readable.stderr);
  assert.deepEqual(readable.json.discovery, { complete: true, errors: [] });
  const denied = path.join(dir, 'docs/private');
  fs.chmodSync(denied, 0);
  try {
    assert.throws(() => fs.readdirSync(denied), { code: 'EACCES' });
    const result = run('inspect', '--repo', dir);
    assert.equal(result.status, 1, result.stderr);
    assert.deepEqual(result.json.discovery, {
      complete: false,
      errors: [{ path: denied, error: 'Permission denied', message: "warning: could not open directory 'docs/private/': Permission denied" }],
    });
    assert.equal(result.json.binding.comparison.current, true, `file-only recorded currentness is independent; comparison: ${JSON.stringify(result.json.binding.comparison)}`);
    assert.equal(result.json.localStorage.ignored, true);
  } finally { fs.chmodSync(denied, 0o755); }
  const restored = run('inspect', '--repo', dir);
  assert.equal(restored.status, 0, restored.stderr);
  assert.deepEqual(restored.json.discovery, readable.json.discovery);
  assert.deepEqual(restored.json.candidates, readable.json.candidates);
  const observer = path.join(scratch, 'unknown-discovery-warning.mjs');
  // Deterministic message-boundary substitute: a warning form this parser does not know.
  fs.writeFileSync(observer, `import cp from 'node:child_process';
    import { syncBuiltinESMExports } from 'node:module';
    const native = cp.spawnSync;
    cp.spawnSync = (command, args, options) => {
      const result = native(command, args, options);
      if (command === 'git' && args[0] === 'ls-files' && args.includes('--others') && args.length === 5) return { ...result, stderr: 'warning: an unrecognized enumeration problem\\n' };
      return result;
    };
    syncBuiltinESMExports();`);
  const unknown = spawnSync(process.execPath, ['--import', observer, cli, 'inspect', '--repo', dir], { encoding: 'utf8', env: GIT_ENV });
  assert.equal(unknown.status, 1, unknown.stderr);
  const json = JSON.parse(unknown.stdout);
  assert.deepEqual(json.discovery, {
    complete: false, errors: [{ path: null, error: 'warning: an unrecognized enumeration problem', message: 'warning: an unrecognized enumeration problem' }],
  });
  assert.equal(json.binding.comparison.current, true, `comparison: ${JSON.stringify(json.binding.comparison)}`);
});

test('discovery reports a Git path name that is not UTF-8 as an enumeration error, never as a substituted candidate; valid candidates and independent facts remain', () => {
  const unsupported = 'path name is not valid UTF-8; such names are not supported';
  const dir = repository('invalid-discovery', { 'AGENTS.md': '# A\n', 'docs/guide.md': 'g\n' });
  // Untracked and valid: the literal U+FFFD candidate a replacement-decoded name would collide with.
  write(dir, { 'docs/caf\uFFFD.md': 'r\n' });
  const before = discoverCandidates(dir);
  assert.equal(before.complete, true);
  assert.deepEqual(before.candidates.find((entry) => entry.path === 'docs/caf\uFFFD.md'), { path: 'docs/caf\uFFFD.md', category: 'guidance', tracked: false });

  const invalid = Buffer.concat([Buffer.from('docs/caf'), Buffer.from([0xff]), Buffer.from('.md')]);
  indexOnlyEntry(dir, '100644', git(dir, 'rev-parse', 'HEAD:AGENTS.md').trim(), invalid);
  const error = { path: dir, name: 'docs/caf\\xff.md', error: unsupported, message: `git ls-files listed docs/caf\\xff.md: ${unsupported}` };
  const after = discoverCandidates(dir);
  assert.deepEqual([after.complete, after.errors], [false, [error]]);
  assert.deepEqual(after.candidates, before.candidates, 'the valid untracked candidate is not taken for the tracked invalid name');
  const inspect = run('inspect', '--repo', dir);
  assert.equal(inspect.status, 1, inspect.stderr);
  assert.deepEqual([inspect.json.discovery, inspect.json.checkout, inspect.json.candidates], [{ complete: false, errors: [error] }, dir, before.candidates], 'a failed partial check keeps independent facts');

  const head = git(dir, 'rev-parse', 'HEAD').trim();
  indexOnlyEntry(dir, '0', '0'.repeat(head.length), invalid);
  assert.deepEqual(discoverCandidates(dir), before, 'removing the entry restores complete discovery');
});
