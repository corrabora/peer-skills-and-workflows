// Binding helper: protection of sources --out destinations and reserved local
// storage names.
// Shared fixtures in ../test-support/bind.mjs give each test file its own
// temporary directory of disposable Git repositories, so the files can run
// concurrently; this checkout's project files and workflow records stay unchanged.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import {
  checkoutFacts, establishLocalStorage, excludeFile, localStorageChild, MANIFEST_VERSION, outputDestinationProblem, readManifest,
} from '../lib/bind.mjs';
import {
  cli, scratch, scratchFoldsCase, GIT_ENV, git, run, repository, write, treeState,
} from '../test-support/bind.mjs';

test('sources --out refuses a destination that resolves to a tracked file and admits permitted exports', () => {
  const dir = repository('out-guard', { 'README.md': '# P\n', 'docs/g.md': 'g\n' });
  establishLocalStorage(dir);
  const readme = fs.readFileSync(path.join(dir, 'README.md'), 'utf8');
  const alias = path.join(scratch, 'alias-of-out-guard');
  fs.symlinkSync(dir, alias, 'dir');
  for (const out of [path.join(dir, 'README.md'), path.join(alias, 'README.md'), path.join(dir, 'docs', '..', 'README.md'), 'docs/g.md']) {
    const result = spawnSync(process.execPath, [cli, 'sources', '--repo', dir, '--out', out, 'README.md'], { cwd: dir, encoding: 'utf8', env: GIT_ENV });
    const json = JSON.parse(result.stdout);
    assert.equal(result.status, 1, out);
    assert.equal(json.written, null);
    assert.equal(json.refused.trackedPath, path.basename(out) === 'g.md' ? 'docs/g.md' : 'README.md', out);
    assert.equal(json.refused.resolved, path.join(dir, json.refused.trackedPath));
    assert.match(json.refused.reason, /tracked/);
    assert.ok(Array.isArray(json.sources), 'the identities are still reported');
  }
  assert.equal(fs.readFileSync(path.join(dir, 'README.md'), 'utf8'), readme);
  assert.equal(git(dir, 'status', '--porcelain'), '', 'nothing tracked changed');
  for (const out of [path.join(dir, '.agent-workflow', 'binding-sources.json'), path.join(scratch, 'exports', 'out-guard.json'), path.join(dir, 'notes', 'export.json')]) {
    const result = run('sources', '--repo', dir, '--out', out, 'README.md');
    assert.equal(result.status, 0, out);
    assert.equal(result.json.written, out);
    assert.equal(readManifest(out).manifest.version, MANIFEST_VERSION);
  }
  assert.equal(git(dir, 'status', '--porcelain').trim(), '?? notes/', 'an untracked destination inside the checkout is the caller\'s choice, not refused');
});

for (const kind of ['nested', 'submodule', 'ignored-nested']) {
  test(`output protection refuses ${kind} tracked/admin paths and admits untracked exports`, () => {
    const origin = repository(`output-${kind}-origin`, { 'POLICY.md': 'committed policy' });
    const dir = repository(`output-${kind}-parent`, { 'README.md': 'parent', '.gitignore': kind === 'ignored-nested' ? 'child/\n' : '' });
    const child = path.join(dir, 'child');
    if (kind === 'submodule') git(dir, '-c', 'protocol.file.allow=always', 'submodule', 'add', '-q', origin, 'child');
    else git(dir, 'clone', '-q', origin, child);
    write(child, { 'POLICY.md': 'uncommitted bytes to preserve' });
    const policy = path.join(child, 'POLICY.md');
    const exclude = excludeFile(child);
    const originalExclude = fs.readFileSync(exclude);
    const before = treeState(child);
    fs.symlinkSync(child, path.join(dir, 'alias'), 'dir');
    for (const out of [policy, path.join(dir, 'alias/POLICY.md'), exclude, path.join(child, '.git'), path.join(child, '.git/new-output')]) {
      const result = run('sources', '--repo', dir, '--out', out, 'README.md');
      assert.equal(result.status, 1, result.stderr);
      assert.equal(result.json.written, null);
      assert.ok(result.json.refused.reason, out);
      assert.equal(fs.readFileSync(policy, 'utf8'), 'uncommitted bytes to preserve');
      assert.deepEqual(fs.readFileSync(exclude), originalExclude);
    }
    assert.deepEqual(treeState(child), before);
    const permitted = path.join(child, 'new/untracked.json');
    assert.equal(run('sources', '--repo', dir, '--out', permitted, 'README.md').status, 0);
    assert.equal(readManifest(permitted).manifest.sources[0].path, 'README.md');
    if (kind === 'submodule') {
      fs.rmSync(child, { recursive: true });
      const unavailable = run('sources', '--repo', dir, '--out', policy, 'README.md');
      assert.equal(unavailable.status, 1);
      assert.match(unavailable.json.refused.reason, /unavailable/);
      assert.equal(fs.existsSync(child), false, 'refusal creates no child and performs no initialization');
    }
  });
}

test('output protection covers actual linked-worktree Git/common directories and permits unrelated external exports', () => {
  const parent = repository('output-linked-parent', { 'README.md': 'parent' });
  const linked = path.join(scratch, 'output-linked-worktree');
  git(parent, 'worktree', 'add', '-q', '-b', 'linked', linked);
  const facts = checkoutFacts(linked);
  fs.symlinkSync(facts.commonDir, path.join(linked, 'admin-alias'), 'dir');
  const exclude = excludeFile(linked);
  const excludeBefore = fs.readFileSync(exclude);
  for (const out of [exclude, path.join(facts.gitDir, 'new-output'), path.join(facts.commonDir, 'new-output'), path.join(linked, 'admin-alias/info/exclude'), path.join(linked, 'README.md')]) {
    const result = run('sources', '--repo', linked, '--out', out, 'README.md');
    assert.equal(result.status, 1, result.stderr);
    assert.equal(result.json.written, null);
    assert.ok(result.json.refused.reason);
  }
  assert.deepEqual(fs.readFileSync(exclude), excludeBefore);
  assert.equal(fs.existsSync(path.join(facts.gitDir, 'new-output')), false);
  const unrelated = repository('output-external', { 'export.json': 'caller selected external export' });
  const out = path.join(unrelated, 'export.json');
  assert.equal(run('sources', '--repo', linked, '--out', out, 'README.md').status, 0, 'unrelated external repository protection is outside the contract');
  assert.equal(readManifest(out).manifest.checkout, fs.realpathSync.native(linked));
});

test('output protection resolves owning linked-child administration and refuses invalid or unmerged children', () => {
  const origin = repository('output-child-linked-origin', { 'POLICY.md': 'policy' });
  const dir = repository('output-child-linked-parent', { 'README.md': 'parent' });
  const child = path.join(dir, 'child');
  git(origin, 'worktree', 'add', '-q', '-b', 'child', child);
  const childFacts = checkoutFacts(child);
  fs.symlinkSync(childFacts.commonDir, path.join(child, 'administration'), 'dir');
  const out = path.join(child, 'administration/info/exclude');
  const before = fs.readFileSync(excludeFile(child));
  const result = run('sources', '--repo', dir, '--out', out, 'README.md');
  assert.equal(result.status, 1, result.stderr);
  assert.equal(result.json.refused.repository, fs.realpathSync.native(child));
  assert.equal(result.json.refused.administrativePath, childFacts.commonDir);
  assert.deepEqual(fs.readFileSync(excludeFile(child)), before);
  const marker = path.join(child, '.git');
  const original = fs.readFileSync(marker);
  fs.writeFileSync(marker, 'gitdir: /nonexistent/agent-workflow-output-test\n');
  const invalid = run('sources', '--repo', dir, '--out', path.join(child, 'POLICY.md'), 'README.md');
  assert.equal(invalid.status, 1);
  assert.match(invalid.json.refused.reason, /protection could not be established/);
  assert.equal(fs.readFileSync(path.join(child, 'POLICY.md'), 'utf8'), 'policy');
  fs.writeFileSync(marker, original);
  const pin = git(child, 'rev-parse', 'HEAD').trim();
  const input = `160000 ${pin} 1\tchild\n160000 ${pin} 2\tchild\n`;
  const updated = spawnSync('git', ['update-index', '--index-info'], { cwd: dir, env: GIT_ENV, input, encoding: 'utf8' });
  assert.equal(updated.status, 0, updated.stderr);
  const unmerged = run('sources', '--repo', dir, '--out', path.join(child, 'untracked.json'), 'README.md');
  assert.equal(unmerged.status, 1);
  assert.match(unmerged.json.refused.reason, /unmerged/);
  assert.equal(fs.existsSync(path.join(child, 'untracked.json')), false);
});

test('sources reserves resolved local binding.md while retaining factual manifest and permitted exports', () => {
  const dir = repository('reserved-binding', { 'README.md': 'readable' });
  establishLocalStorage(dir);
  const binding = path.join(dir, '.agent-workflow/binding.md');
  const content = '# Binding\nOperator choices must survive.\n';
  fs.writeFileSync(binding, content);
  const alias = path.join(scratch, 'reserved-binding-alias');
  const link = path.join(scratch, 'reserved-binding-link');
  fs.symlinkSync(dir, alias, 'dir');
  fs.symlinkSync(binding, link);
  for (const out of [binding, path.join(alias, '.agent-workflow/binding.md'), link]) {
    const result = run('sources', '--repo', dir, '--out', out, 'README.md');
    assert.equal(result.status, 1, result.stderr);
    assert.equal(result.json.written, null);
    assert.equal(result.json.refused.resolved, binding);
    assert.match(result.json.refused.reason, /binding-sources\.json/);
    assert.equal(fs.readFileSync(binding, 'utf8'), content);
  }
  for (const out of [path.join(dir, '.agent-workflow/binding-sources.json'), path.join(dir, 'export.json'), path.join(scratch, 'reserved-export.json')]) {
    const result = run('sources', '--repo', dir, '--out', out, 'README.md');
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.json.written, out);
    assert.equal(result.json.resolved, undefined);
    assert.equal(readManifest(out).error, undefined);
    assert.equal(fs.readFileSync(binding, 'utf8'), content);
  }
  fs.unlinkSync(binding);
  const absent = run('sources', '--repo', dir, '--out', binding, 'README.md');
  assert.equal(absent.status, 1, 'the reserved destination is protected even before a binding exists');
  assert.equal(fs.existsSync(binding), false);
});

test('occupied named storage refuses both exports before writes and preserves permitted neighbors', () => {
  const dir = repository('occupied-output', { 'README.md': 'readable' });
  const local = path.join(dir, '.agent-workflow');
  const outside = path.join(scratch, 'occupied-output-target');
  write(outside, { 'binding.md': 'operator choices', 'binding-sources.json': 'original manifest' });
  fs.symlinkSync(outside, local, 'dir');
  for (const name of ['binding.md', 'binding-sources.json', 'new/manifest.json']) {
    const out = `${local}/redundant/../${name}`;
    const result = run('sources', '--repo', dir, '--out', out, 'README.md');
    assert.equal(result.status, 1, result.stderr);
    assert.equal(result.json.written, null);
    assert.equal(result.json.refused.reason, 'local storage path occupied');
    assert.equal(result.json.refused.occupied.path, local);
    assert.equal(result.json.refused.occupied.kind, 'link');
    assert.equal(result.json.refused.occupied.target, outside);
    assert.match(result.json.refused.occupied.resolution, /move or remove it yourself/);
  }
  assert.equal(fs.readFileSync(path.join(outside, 'binding.md'), 'utf8'), 'operator choices');
  assert.equal(fs.readFileSync(path.join(outside, 'binding-sources.json'), 'utf8'), 'original manifest');
  assert.equal(fs.existsSync(path.join(outside, 'new')), false);
  assert.equal(fs.readlinkSync(local), outside);
  for (const out of [path.join(scratch, 'occupied-output-external.json'), path.join(dir, '.agent-workflow-neighbor/out.json')]) {
    assert.equal(run('sources', '--repo', dir, '--out', out, 'README.md').status, 0);
  }
  fs.unlinkSync(local);
  fs.writeFileSync(local, 'occupied file');
  for (const name of ['binding.md', 'binding-sources.json']) {
    const result = run('sources', '--repo', dir, '--out', path.join(local, name), 'README.md');
    assert.equal(result.status, 1, result.stderr);
    assert.equal(result.json.refused.occupied.kind, 'file');
    assert.equal(fs.readFileSync(local, 'utf8'), 'occupied file');
  }
  fs.unlinkSync(local);
  for (const target of [local, path.join(scratch, 'nonexistent-storage')]) {
    fs.symlinkSync(target, local, 'dir');
    const result = run('sources', '--repo', dir, '--out', path.join(local, 'binding-sources.json'), 'README.md');
    assert.equal(result.status, 1, result.stderr);
    assert.equal(result.json.refused.occupied.kind, 'link', 'loops and dangling links retain occupied diagnostics');
    assert.equal(fs.readlinkSync(local), target);
    fs.unlinkSync(local);
  }
  for (const name of ['binding-sources.json', 'other.json']) {
    const out = path.join(local, name);
    assert.equal(run('sources', '--repo', dir, '--out', out, 'README.md').status, 0, 'absent and ordinary directory storage permit manifests');
  }
});

test('occupied named storage refuses every alias spelling of the checkout before following the occupant', () => {
  const dir = repository('occupied-alias/repo', { 'README.md': 'readable' });
  const alias = path.join(scratch, 'occupied-alias-link');
  fs.symlinkSync(path.dirname(dir), alias, 'dir');
  const aliasRepo = path.join(alias, 'repo');
  fs.symlinkSync('.', path.join(dir, 'self'), 'dir');
  const local = path.join(dir, '.agent-workflow');
  const outside = path.join(scratch, 'occupied-alias-target');
  write(outside, { 'binding.md': 'operator choices', 'binding-sources.json': 'original manifest' });
  const unchanged = () => {
    assert.deepEqual(fs.readdirSync(outside).sort(), ['binding-sources.json', 'binding.md']);
    assert.equal(fs.readFileSync(path.join(outside, 'binding.md'), 'utf8'), 'operator choices');
    assert.equal(fs.readFileSync(path.join(outside, 'binding-sources.json'), 'utf8'), 'original manifest');
  };
  const refusedBy = (kind, repo, out) => {
    const result = run('sources', '--repo', repo, '--out', out, 'README.md');
    assert.equal(result.status, 1, `${repo} ${out}: ${result.stderr}`);
    assert.equal(result.json.written, null);
    assert.equal(result.json.refused.reason, 'local storage path occupied', out);
    assert.equal(result.json.refused.occupied.path, local);
    assert.equal(result.json.refused.occupied.kind, kind);
  };
  const spellings = [dir, aliasRepo, path.join(dir, 'self'), path.join(aliasRepo, 'self')];
  fs.symlinkSync(outside, local, 'dir');
  // Canonical and alias repository arguments, each with every output spelling;
  // both binding children, a nested destination and the entry itself.
  for (const base of spellings.slice(1)) for (const name of ['binding.md', 'new/manifest.json']) refusedBy('link', dir, path.join(base, '.agent-workflow', name));
  for (const base of spellings) for (const name of ['binding-sources.json', '']) refusedBy('link', aliasRepo, path.join(base, '.agent-workflow', name));
  unchanged();
  assert.equal(fs.readlinkSync(local), outside);
  for (const out of [path.join(scratch, 'occupied-alias-external.json'), path.join(aliasRepo, '.agent-workflow-neighbor/out.json'), path.join(aliasRepo, 'export/.agent-workflow-x.json')]) {
    const result = run('sources', '--repo', aliasRepo, '--out', out, 'README.md');
    assert.equal(result.status, 0, `${out}: ${result.stderr}`);
    assert.equal(result.json.written, out);
  }
  unchanged();
  fs.unlinkSync(local);
  for (const target of [local, path.join(scratch, 'occupied-alias-nonexistent')]) {
    fs.symlinkSync(target, local, 'dir');
    for (const out of [path.join(aliasRepo, '.agent-workflow/binding-sources.json'), path.join(dir, 'self/.agent-workflow/binding.md')]) refusedBy('link', dir, out);
    assert.equal(fs.readlinkSync(local), target, 'loops and dangling links stay unchanged');
    fs.unlinkSync(local);
  }
  assert.equal(fs.existsSync(path.join(scratch, 'occupied-alias-nonexistent')), false);
  fs.writeFileSync(local, 'occupied file');
  refusedBy('file', dir, path.join(aliasRepo, '.agent-workflow/binding-sources.json'));
  assert.equal(fs.readFileSync(local, 'utf8'), 'occupied file');
  fs.unlinkSync(local);
  const absent = run('sources', '--repo', dir, '--out', path.join(aliasRepo, '.agent-workflow/binding-sources.json'), 'README.md');
  assert.equal(absent.status, 0, absent.stderr);
  assert.equal(absent.json.resolved, path.join(local, 'binding-sources.json'), 'absent storage admits the manifest through an alias');
  for (const base of spellings.slice(1)) {
    const out = path.join(base, '.agent-workflow/other.json');
    const ordinary = run('sources', '--repo', aliasRepo, '--out', out, 'README.md');
    assert.equal(ordinary.status, 0, ordinary.stderr);
    assert.equal(ordinary.json.written, out);
    assert.equal(ordinary.json.resolved, path.join(local, 'other.json'), 'ordinary directory storage remains a permitted export');
    const reserved = run('sources', '--repo', aliasRepo, '--out', path.join(base, '.agent-workflow/binding.md'), 'README.md');
    assert.equal(reserved.status, 1);
    assert.match(reserved.json.refused.reason, /binding-sources\.json/);
  }
  assert.equal(fs.existsSync(path.join(local, 'binding.md')), false);
  unchanged();
});

test('sources reports named and resolved permitted exports while refusing a tracked target', () => {
  const dir = repository('resolved-export', { 'README.md': 'readable' });
  const external = path.join(scratch, 'resolved-export-target.json');
  fs.writeFileSync(external, 'external original');
  const link = path.join(dir, 'export-link.json');
  fs.symlinkSync(external, link);
  git(dir, 'add', 'export-link.json');
  const before = treeState(dir);
  const result = run('sources', '--repo', dir, '--out', link, 'README.md');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.json.written, link);
  assert.equal(result.json.resolved, external);
  assert.equal(readManifest(external).error, undefined);
  assert.equal(fs.readlinkSync(link), external);
  assert.deepEqual(treeState(dir), before, 'the tracked link object and logical Git state are unchanged');
  const untracked = path.join(dir, 'untracked-link.json');
  fs.symlinkSync(external, untracked);
  const permitted = run('sources', '--repo', dir, '--out', untracked, 'README.md');
  assert.equal(permitted.status, 0, permitted.stderr);
  assert.equal(permitted.json.written, untracked);
  assert.equal(permitted.json.resolved, external);
  const tracked = path.join(dir, 'tracked-target-link');
  fs.symlinkSync(path.join(dir, 'README.md'), tracked);
  const refused = run('sources', '--repo', dir, '--out', tracked, 'README.md');
  assert.equal(refused.status, 1);
  assert.equal(refused.json.written, null);
  assert.equal(refused.json.refused.trackedPath, 'README.md');
  assert.equal(fs.readFileSync(path.join(dir, 'README.md'), 'utf8'), 'readable');
});

test('filesystem-equivalent storage and binding names refuse or reserve before any write; ordinary exports stay permitted', (t) => {
  if (!scratchFoldsCase) { t.skip('needs a case-insensitive filesystem; distinct case-sensitive names are covered by the next test'); return; }
  const dir = repository('equivalent-names/repo', { 'README.md': 'readable' });
  const alias = path.join(scratch, 'equivalent-names-link');
  fs.symlinkSync(path.dirname(dir), alias, 'dir');
  const aliasRepo = path.join(alias, 'repo');
  const local = path.join(dir, '.agent-workflow');
  const outside = path.join(scratch, 'equivalent-names-target');
  write(outside, { 'binding.md': 'operator choices', 'binding-sources.json': 'original manifest' });
  const unchanged = () => {
    assert.deepEqual(fs.readdirSync(outside).sort(), ['binding-sources.json', 'binding.md']);
    assert.equal(fs.readFileSync(path.join(outside, 'binding.md'), 'utf8'), 'operator choices');
    assert.equal(fs.readFileSync(path.join(outside, 'binding-sources.json'), 'utf8'), 'original manifest');
  };
  const refused = (out, check) => {
    const result = run('sources', '--repo', dir, '--out', out, 'README.md');
    assert.equal(result.status, 1, `${out}: ${result.stderr}`);
    assert.equal(result.json.written, null, out);
    check(result.json.refused, out);
  };
  const occupied = (refusal, out) => {
    assert.equal(refusal.reason, 'local storage path occupied', out);
    assert.equal(refusal.occupied.path, local);
    assert.equal(refusal.occupied.kind, 'link');
  };
  const reserved = (refusal, out) => assert.match(refusal.reason, /binding-sources\.json/, out);
  fs.symlinkSync(outside, local, 'dir');
  // Exact, case-variant and checkout-alias spellings; both children, a nested destination and the entry itself.
  for (const base of [dir, aliasRepo]) {
    for (const [storage, child] of [['.agent-workflow', 'binding.md'], ['.AGENT-WORKFLOW', 'binding.md'], ['.Agent-Workflow', 'binding-sources.json'],
      ['.AGENT-WORKFLOW', 'BINDING-SOURCES.JSON'], ['.agent-workfloW', 'new/manifest.json'], ['.AGENT-WORKFLOW', '']]) {
      refused(path.join(base, storage, child), occupied);
    }
  }
  unchanged();
  assert.equal(fs.readlinkSync(local), outside);
  fs.unlinkSync(local);
  fs.mkdirSync(local);
  // A linked binding child is refused under a variant child name, too.
  fs.symlinkSync(path.join(outside, 'binding-sources.json'), path.join(local, 'binding-sources.json'));
  for (const out of [path.join(local, 'BINDING-SOURCES.JSON'), path.join(aliasRepo, '.AGENT-WORKFLOW/Binding-Sources.json')]) {
    refused(out, (refusal) => {
      assert.match(refusal.reason, /binding output child must be a plain file/);
      assert.equal(refusal.state.kind, 'link');
    });
  }
  unchanged();
  fs.unlinkSync(path.join(local, 'binding-sources.json'));
  // The binding file is reserved under every equivalent name before it exists, in ordinary and in absent storage.
  for (const out of [path.join(local, 'Binding.md'), path.join(aliasRepo, '.agent-workflow/BINDING.MD'), path.join(dir, '.AGENT-WORKFLOW/binding.md')]) refused(out, reserved);
  assert.deepEqual(fs.readdirSync(local), []);
  fs.rmdirSync(local);
  for (const out of [path.join(dir, '.AGENT-WORKFLOW/Binding.md'), path.join(aliasRepo, '.Agent-Workflow/binding.md')]) refused(out, reserved);
  assert.equal(fs.existsSync(local), false, 'nothing was created for a refused reservation');
  fs.mkdirSync(local);
  fs.writeFileSync(path.join(local, 'binding.md'), 'existing choices');
  refused(path.join(local, 'BINDING.md'), reserved);
  assert.equal(fs.readFileSync(path.join(local, 'binding.md'), 'utf8'), 'existing choices');
  for (const out of [path.join(local, 'binding-sources.json'), path.join(aliasRepo, '.AGENT-WORKFLOW/other.json'), path.join(dir, '.agent-workflow-neighbor/out.json'),
    path.join(dir, '.agent-workflowx'), path.join(scratch, 'equivalent-names-external.json')]) {
    const result = run('sources', '--repo', dir, '--out', out, 'README.md');
    assert.equal(result.status, 0, `${out}: ${result.stderr}`);
    assert.equal(result.json.written, out);
  }
  assert.deepEqual(fs.readdirSync(local).sort(), ['binding-sources.json', 'binding.md', 'other.json']);
  assert.equal(fs.readFileSync(path.join(local, 'binding.md'), 'utf8'), 'existing choices');
  unchanged();
});

test('differently cased storage and binding names stay distinct neighbors where the filesystem keeps case: native, else simulated', (t) => {
  const dir = repository('distinct-names', { 'README.md': 'readable' });
  const facts = checkoutFacts(dir);
  const local = path.join(dir, '.agent-workflow');
  const outside = path.join(scratch, 'distinct-names-target');
  write(outside, { 'binding.md': 'operator choices' });
  const neighbors = [path.join(dir, '.AGENT-WORKFLOW/binding.md'), path.join(local, 'Binding.md')];
  if (!scratchFoldsCase) {
    fs.mkdirSync(local);
    for (const out of neighbors) {
      const result = run('sources', '--repo', dir, '--out', out, 'README.md');
      assert.equal(result.status, 0, `${out}: ${result.stderr}`);
      assert.equal(result.json.written, out);
    }
    assert.deepEqual(fs.readdirSync(local).sort(), ['Binding.md']);
    assert.equal(run('sources', '--repo', dir, '--out', path.join(local, 'binding.md'), 'README.md').status, 1, 'the exact name stays reserved');
    fs.rmSync(local, { recursive: true });
    fs.symlinkSync(outside, local, 'dir');
    const result = run('sources', '--repo', dir, '--out', path.join(dir, '.Agent-Workflow/new.json'), 'README.md');
    assert.equal(result.status, 0, 'a distinct neighbor of occupied storage is an ordinary export');
    assert.deepEqual(fs.readdirSync(outside), ['binding.md']);
    return;
  }
  // Simulated: lstat answers as a case-sensitive filesystem would, where a
  // name with an uppercase letter is a different, absent entry. Nothing is written.
  const native = fs.lstatSync;
  t.mock.method(fs, 'lstatSync', (file, ...args) => {
    if (/[A-Z]/.test(path.basename(String(file)))) throw Object.assign(new Error(`ENOENT: simulated case-sensitive lookup '${file}'`), { code: 'ENOENT' });
    return native(file, ...args);
  });
  assert.equal(outputDestinationProblem(facts, neighbors[0]), null, 'absent storage: a cased neighbor is not local storage');
  fs.mkdirSync(local);
  assert.equal(outputDestinationProblem(facts, neighbors[1]), null, 'ordinary storage: a cased neighbor is not the binding file');
  assert.equal(localStorageChild(dir, path.join(local, 'Binding-Sources.json')), null);
  assert.equal(localStorageChild(dir, path.join(local, 'binding-sources.json')), path.join(local, 'binding-sources.json'));
  assert.match(outputDestinationProblem(facts, path.join(local, 'binding.md')).reason, /binding-sources\.json/, 'the exact name stays reserved');
  fs.rmdirSync(local);
  fs.symlinkSync(outside, local, 'dir');
  assert.equal(outputDestinationProblem(facts, path.join(dir, '.AGENT-WORKFLOW/new.json'))?.occupied, undefined, 'a distinct neighbor is not the occupied entry');
  assert.equal(outputDestinationProblem(facts, path.join(local, 'new.json')).occupied.kind, 'link');
  t.mock.restoreAll();
  assert.deepEqual(fs.readdirSync(outside), ['binding.md']);
});

test('reserved entries stored under another spelling are refused under that spelling too; separately listed hard links stay ordinary', (t) => {
  if (!scratchFoldsCase) { t.skip('needs a case-insensitive filesystem; case-sensitive hard links are covered by the next test'); return; }
  const dir = repository('stored-spellings/repo', { 'README.md': 'readable' });
  const facts = checkoutFacts(dir);
  const alias = path.join(scratch, 'stored-spellings-link');
  fs.symlinkSync(path.dirname(dir), alias, 'dir');
  const aliasRepo = path.join(alias, 'repo');
  const local = path.join(dir, '.agent-workflow');
  const outside = path.join(scratch, 'stored-spellings-target');
  const manifest = run('sources', '--repo', dir, 'README.md').stdout;
  write(outside, { 'binding-sources.json': manifest });
  const unchanged = () => {
    assert.deepEqual(fs.readdirSync(outside), ['binding-sources.json']);
    assert.equal(fs.readFileSync(path.join(outside, 'binding-sources.json'), 'utf8'), manifest);
  };
  const exported = (out) => run('sources', '--repo', dir, '--out', out, 'README.md');
  const refused = (out, pattern) => {
    const result = exported(out);
    assert.equal(result.status, 1, `${out}: ${result.stderr}`);
    assert.equal(result.json.written, null, out);
    assert.match(result.json.refused.reason, pattern, out);
    return result.json.refused;
  };
  const compared = (file) => run('sources', '--repo', dir, '--compare', file, 'README.md').json.comparison;

  // The binding file stored as Binding.md is reserved under that spelling, every other one and through the checkout alias.
  fs.mkdirSync(local);
  fs.writeFileSync(path.join(local, 'Binding.md'), 'operator choices');
  for (const out of [path.join(local, 'Binding.md'), path.join(local, 'binding.md'), path.join(aliasRepo, '.agent-workflow/Binding.md'), path.join(dir, '.AGENT-WORKFLOW/BINDING.MD')]) {
    refused(out, /binding-sources\.json/);
  }
  assert.equal(compared(path.join(local, 'Binding.md')).usable, false, 'operator choices are not a manifest');
  assert.deepEqual(fs.readdirSync(local), ['Binding.md']);
  assert.equal(fs.readFileSync(path.join(local, 'Binding.md'), 'utf8'), 'operator choices');

  // A hard link beside the stored-variant and beside the canonical binding name is a name of its own.
  for (const stored of ['Binding.md', 'binding.md']) {
    if (stored === 'binding.md') fs.renameSync(path.join(local, 'Binding.md'), path.join(local, 'binding.md'));
    fs.linkSync(path.join(local, stored), path.join(local, 'choices-copy.md'));
    for (const out of [path.join(local, 'choices-copy.md'), path.join(local, 'CHOICES-COPY.md')]) {
      assert.equal(outputDestinationProblem(facts, out), null, `${stored}: ${out}`);
      assert.equal(localStorageChild(dir, out), null, `${stored}: ${out}`);
    }
    assert.match(outputDestinationProblem(facts, path.join(local, 'BINDING.md')).reason, /binding-sources\.json/, stored);
    assert.equal(localStorageChild(dir, path.join(local, stored)), path.join(local, 'binding.md'));
    fs.unlinkSync(path.join(local, 'choices-copy.md'));
  }
  assert.deepEqual(fs.readdirSync(local), ['binding.md']);
  fs.rmSync(local, { recursive: true });

  // Local storage stored as a .Agent-Workflow link is occupied under its stored spelling: neither written through nor read.
  fs.symlinkSync(outside, path.join(dir, '.Agent-Workflow'), 'dir');
  for (const out of [path.join(dir, '.Agent-Workflow/binding-sources.json'), path.join(dir, '.Agent-Workflow/new.json'), path.join(aliasRepo, '.Agent-Workflow/binding-sources.json'),
    path.join(local, 'binding-sources.json')]) {
    const refusal = refused(out, /^local storage path occupied$/);
    assert.deepEqual([refusal.occupied.path, refusal.occupied.kind, refusal.occupied.target], [local, 'link', outside], out);
  }
  for (const file of [path.join(dir, '.Agent-Workflow/binding-sources.json'), path.join(aliasRepo, '.Agent-Workflow/binding-sources.json')]) {
    const comparison = compared(file);
    assert.deepEqual([comparison.usable, comparison.reason, comparison.occupied.kind], [false, 'local storage path occupied', 'link'], `${file} is not read through the occupant`);
  }
  unchanged();
  assert.equal(fs.readlinkSync(path.join(dir, '.Agent-Workflow')), outside);
  fs.unlinkSync(path.join(dir, '.Agent-Workflow'));

  // A manifest stored as a Binding-Sources.json link is refused under its stored spelling; a hard link beside it is ordinary.
  fs.mkdirSync(local);
  fs.symlinkSync(path.join(outside, 'binding-sources.json'), path.join(local, 'Binding-Sources.json'));
  for (const out of [path.join(local, 'Binding-Sources.json'), path.join(local, 'binding-sources.json'), path.join(aliasRepo, '.agent-workflow/Binding-Sources.json')]) {
    assert.equal(refused(out, /binding output child must be a plain file/).state.kind, 'link', out);
  }
  assert.match(compared(path.join(local, 'Binding-Sources.json')).reason, /^linked manifest is a conflict/);
  unchanged();
  fs.unlinkSync(path.join(local, 'Binding-Sources.json'));
  fs.writeFileSync(path.join(local, 'Binding-Sources.json'), manifest);
  fs.linkSync(path.join(local, 'Binding-Sources.json'), path.join(local, 'manifest-copy.json'));
  assert.equal(localStorageChild(dir, path.join(local, 'manifest-copy.json')), null);
  assert.equal(localStorageChild(dir, path.join(local, 'BINDING-SOURCES.json')), path.join(local, 'binding-sources.json'));
  assert.equal(compared(path.join(local, 'Binding-Sources.json')).usable, true, 'a plain stored-variant manifest is compared');
  for (const out of [path.join(local, 'Binding-Sources.json'), path.join(local, 'other.json'), path.join(dir, '.agent-workflow-neighbor/out.json')]) {
    const result = exported(out);
    assert.equal(result.status, 0, `${out}: ${result.stderr}`);
    assert.equal(result.json.written, out);
  }
  assert.deepEqual(fs.readdirSync(local).sort(), ['Binding-Sources.json', 'manifest-copy.json', 'other.json']);
  unchanged();
});

test('case-sensitive neighbors that are hard links of a reserved entry stay distinct: native, else simulated', (t) => {
  const dir = repository('case-sensitive-hard-links', { 'README.md': 'readable' });
  const facts = checkoutFacts(dir);
  const local = path.join(dir, '.agent-workflow');
  fs.mkdirSync(local);
  fs.writeFileSync(path.join(local, 'binding.md'), 'operator choices');
  const neighbor = path.join(local, 'Binding.md');
  if (!scratchFoldsCase) {
    fs.linkSync(path.join(local, 'binding.md'), neighbor);
    assert.deepEqual(fs.readdirSync(local).sort(), ['Binding.md', 'binding.md']);
  } else {
    // Simulated: the directory lists both names, and lstat and realpath reach one
    // inode under each name, as on a case-sensitive filesystem where Binding.md
    // is a hard link of binding.md.
    const nativeLstat = fs.lstatSync;
    const nativeReaddir = fs.readdirSync;
    const nativeRealpath = fs.realpathSync.native;
    t.mock.method(fs, 'lstatSync', (file, ...args) => nativeLstat(String(file) === neighbor ? path.join(local, 'binding.md') : file, ...args));
    t.mock.method(fs.realpathSync, 'native', (file, ...args) => (String(file) === neighbor ? neighbor : nativeRealpath(file, ...args)));
    t.mock.method(fs, 'readdirSync', (file, ...args) => (String(file) === local && !args.length ? ['Binding.md', 'binding.md'] : nativeReaddir(file, ...args)));
  }
  assert.equal(outputDestinationProblem(facts, neighbor), null, 'a separately listed hard link is not the binding file');
  assert.equal(localStorageChild(dir, neighbor), null);
  assert.match(outputDestinationProblem(facts, path.join(local, 'binding.md')).reason, /binding-sources\.json/, 'the binding file stays reserved');
  assert.equal(localStorageChild(dir, path.join(local, 'binding-sources.json')), path.join(local, 'binding-sources.json'));
  t.mock.restoreAll();
  assert.equal(fs.readFileSync(path.join(local, 'binding.md'), 'utf8'), 'operator choices');
});

