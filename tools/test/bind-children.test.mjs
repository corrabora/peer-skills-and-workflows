// Binding helper: nested repositories and submodules in source identities.
// Shared fixtures in ../test-support/bind.mjs give each test file its own
// temporary directory of disposable Git repositories, so the files can run
// concurrently; this checkout's project files and workflow records stay unchanged.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import {
  compareManifests, sourceIdentity, sourceManifest,
} from '../lib/bind.mjs';
import {
  scratch, GIT_ENV, git, run, repository, write, treeState,
} from '../test-support/bind.mjs';

// Both Git child forms obey the same working-content policy through every
// supported source shape. These fixtures use real child Git indexes/ignores.
for (const kind of ['nested', 'submodule']) {
  test(`${kind} working contents govern directory, direct file and workflow identities`, () => {
    const origin = repository(`${kind}-origin`, { 'POLICY.md': 'policy', '.gitignore': '*.tmp\n' });
    const dir = repository(`${kind}-parent`, { 'README.md': 'readable', 'tools/neighbor.md': 'neighbor' });
    const relative = 'tools/child';
    const child = path.join(dir, relative);
    if (kind === 'submodule') git(dir, '-c', 'protocol.file.allow=always', 'submodule', 'add', '-q', origin, relative);
    else git(dir, 'clone', '-q', origin, child);
    const selected = ['tools', relative, `${relative}/POLICY.md`, 'README.md'];
    const manifest = () => sourceManifest(dir, selected, { workflowSource: dir });
    const baseline = manifest();
    assert.equal(baseline.complete, true);
    assert.equal(baseline.sources[2].state, 'tracked');
    assert.equal(baseline.sources[2].indexBlob, git(child, 'rev-parse', ':POLICY.md').trim());
    assert.equal(baseline.sources[0].repositories[0].kind, kind);
    assert.equal(compareManifests(baseline, manifest()).current, true);
    write(child, { 'POLICY.md': 'edited working content' });
    const edited = manifest();
    assert.deepEqual(compareManifests(baseline, edited).changed, selected.slice(0, 3));
    assert.equal(compareManifests(baseline, edited).workflowSourceChanged, true);
    git(child, 'add', 'POLICY.md');
    assert.equal(compareManifests(edited, manifest()).current, true, 'staging the same working bytes changes no content identity');
    git(child, 'commit', '-q', '-m', 'child edit');
    const committed = manifest();
    assert.equal(compareManifests(edited, committed).current, true, 'committing the same bytes changes no content identity');
    assert.ok(compareManifests(edited, committed).repositoryChanges.length > 0);
    if (kind === 'submodule') assert.equal(committed.sources[0].repositories[0].indexPinMatchesChild, false);
    const changedDirectory = (before, after) => {
      const comparison = compareManifests(before, after);
      assert.deepEqual(comparison.changed, selected.slice(0, 2));
      assert.equal(comparison.workflowSourceChanged, true);
      assert.equal(comparison.current, false);
      assert.ok(comparison.unchanged.includes('README.md'));
    };
    write(child, { 'new.md': 'new untracked member', 'ignored.tmp': 'ignored' });
    const added = manifest();
    changedDirectory(committed, added);
    fs.renameSync(path.join(child, 'new.md'), path.join(child, 'renamed.md'));
    const renamed = manifest();
    changedDirectory(added, renamed);
    fs.rmSync(path.join(child, 'renamed.md'));
    assert.equal(compareManifests(committed, manifest()).current, true);
    write(child, { 'ignored.tmp': 'ignored edit' });
    assert.equal(compareManifests(committed, manifest()).current, true, 'ignored content is outside the selected membership');
    // An administrative ignore rule changes logical membership without being
    // hashed itself; an unrelated comment does not.
    fs.writeFileSync(path.join(git(child, 'rev-parse', '--absolute-git-dir').trim(), 'info/exclude'), 'POLICY.md\n');
    assert.equal(compareManifests(committed, manifest()).current, true, 'tracked content remains covered despite ignores');
    write(child, { 'visible.md': 'visible' });
    const visible = manifest();
    fs.appendFileSync(path.join(git(child, 'rev-parse', '--absolute-git-dir').trim(), 'info/exclude'), 'visible.md\n');
    changedDirectory(visible, manifest());
    const hidden = manifest();
    fs.appendFileSync(path.join(git(child, 'rev-parse', '--absolute-git-dir').trim(), 'info/exclude'), '# administrative comment\n');
    git(child, 'config', 'test.administrative', 'only');
    git(child, 'commit', '--allow-empty', '-q', '-m', 'same contents');
    assert.equal(compareManifests(hidden, manifest()).current, true, 'administrative-only and empty commit changes preserve logical content');
    fs.rmSync(path.join(child, 'POLICY.md'));
    const deleted = manifest();
    assert.equal(deleted.sources[2].kind, 'missing');
    assert.deepEqual(compareManifests(hidden, deleted).missing, [`${relative}/POLICY.md`]);
    assert.notEqual(hidden.sources[0].digest, deleted.sources[0].digest);
    if (kind === 'nested') {
      fs.rmSync(child, { recursive: true });
      const absent = manifest();
      assert.equal(absent.complete, true);
      assert.equal(absent.sources[1].kind, 'missing');
      assert.notEqual(deleted.workflowSource.digest, absent.workflowSource.digest);
    }
  });
}

test('submodule pin changes are separately observable without child-content changes or implicit pin agreement', () => {
  const origin = repository('pin-origin', { 'POLICY.md': 'same' });
  const dir = repository('pin-parent', { 'README.md': 'readable' });
  git(dir, '-c', 'protocol.file.allow=always', 'submodule', 'add', '-q', origin, 'tools/child');
  git(dir, 'commit', '-q', '-am', 'pin child');
  const child = path.join(dir, 'tools/child');
  const manifest = () => sourceManifest(dir, ['tools', 'tools/child/POLICY.md'], { workflowSource: dir });
  const before = manifest();
  git(child, 'commit', '--allow-empty', '-q', '-m', 'same content new revision');
  const mismatch = manifest();
  assert.equal(compareManifests(before, mismatch).current, true);
  assert.equal(mismatch.sources[0].repositories[0].indexPinMatchesChild, false);
  git(dir, 'add', 'tools/child');
  const stagedPin = manifest();
  const comparison = compareManifests(mismatch, stagedPin);
  assert.equal(comparison.current, true);
  assert.deepEqual(comparison.changed, []);
  assert.equal(comparison.workflowSourceChanged, false);
  assert.equal(comparison.repositories[0].indexPinMatchesChild, true);
  assert.equal(comparison.repositories[0].headPinMatchesChild, false);
  assert.notEqual(comparison.repositoryChanges[0].before.indexPin, comparison.repositoryChanges[0].after.indexPin);
  git(dir, 'commit', '-q', '-m', 'new parent pin');
  const pinned = manifest();
  assert.equal(compareManifests(stagedPin, pinned).current, true);
  assert.equal(pinned.sources[0].repositories[0].headPinMatchesChild, true);
});

test('uninitialized and inaccessible children fail incompletely, including direct inner files and repeated baselines', () => {
  const origin = repository('unavailable-origin', { 'POLICY.md': 'policy' });
  const dir = repository('unavailable-parent', { 'README.md': 'readable', 'tools/neighbor.md': 'neighbor' });
  git(dir, '-c', 'protocol.file.allow=always', 'submodule', 'add', '-q', origin, 'tools/child');
  const child = path.join(dir, 'tools/child');
  const paths = ['tools', 'tools/child', 'tools/child/POLICY.md', 'README.md'];
  const out = path.join(scratch, 'unavailable-baseline.json');
  fs.rmSync(child, { recursive: true });
  fs.mkdirSync(child);
  const before = treeState(dir);
  const baseline = run('sources', '--repo', dir, '--out', out, ...paths);
  assert.equal(baseline.status, 1, baseline.stderr);
  for (const entry of baseline.json.sources.slice(0, 3)) {
    assert.equal(entry.kind, 'unsupported');
    assert.equal(entry.member, 'tools/child');
    assert.match(entry.error, /uninitialized/);
    assert.equal(entry.digest, undefined);
  }
  const repeated = run('sources', '--repo', dir, '--compare', out, ...paths);
  assert.equal(repeated.status, 1);
  assert.equal(repeated.json.comparison.current, false);
  assert.equal(repeated.json.comparison.complete, false);
  assert.deepEqual(repeated.json.comparison.unchanged, ['README.md']);
  assert.equal(sourceManifest(dir, ['README.md'], { workflowSource: dir }).workflowSource.kind, 'unsupported');
  assert.deepEqual(treeState(dir), before, 'CHECK does not initialize or stage the child');
  git(dir, '-c', 'protocol.file.allow=always', 'submodule', 'update', '--init');
  assert.equal(run('sources', '--repo', dir, ...paths).status, 0);
  write(child, { '.git': 'gitdir: /nonexistent/agent-workflow-child\n' });
  const invalid = run('sources', '--repo', dir, ...paths);
  assert.equal(invalid.status, 1);
  assert.equal(invalid.json.sources[0].kind, 'unreadable');
  assert.match(invalid.json.sources[0].error, /not a git repository/);
  assert.equal(invalid.json.sources.at(-1).kind, 'file');
  fs.rmSync(child, { recursive: true });
  fs.symlinkSync(origin, child, 'dir');
  const aliased = run('sources', '--repo', dir, ...paths);
  assert.equal(aliased.status, 1);
  assert.equal(aliased.json.sources[2].kind, 'unsupported', 'a gitlink replaced by an alias does not authorize following inner files');
});

test('unreadable nested directory enumeration cannot become a complete empty baseline', (t) => {
  if (process.platform === 'win32' || process.getuid?.() === 0) { t.skip('needs POSIX permissions enforced'); return; }
  const dir = repository('denied-nested-root', { 'README.md': 'readable', 'tools/neighbor.md': 'neighbor' });
  const child = path.join(dir, 'tools/child');
  git(dir, 'clone', '-q', dir, child);
  const manifest = () => sourceManifest(dir, ['tools', 'tools/child', 'README.md'], { workflowSource: dir });
  assert.equal(manifest().complete, true);
  fs.chmodSync(child, 0);
  try {
    const denied = manifest();
    assert.equal(denied.complete, false);
    assert.equal(denied.sources[0].kind, 'unreadable');
    assert.equal(denied.workflowSource.kind, 'unreadable');
    assert.equal(compareManifests(denied, manifest()).current, false);
    assert.equal(denied.sources[2].kind, 'file');
    assert.equal(run('sources', '--repo', dir, 'tools', 'README.md').status, 1);
  } finally { fs.chmodSync(child, 0o755); }
  assert.equal(manifest().complete, true);
});

test('ignored child directories retain all-files policy and tracked directory aliases are not traversed', () => {
  const dir = repository('child-policy-boundaries', { 'README.md': 'readable', '.gitignore': 'personal/\n', 'tools/linked/old.md': 'old' });
  const origin = repository('child-policy-origin', { 'POLICY.md': 'policy', '.gitignore': '*.tmp\n' });
  const child = path.join(dir, 'personal');
  git(dir, 'clone', '-q', origin, child);
  const before = sourceIdentity(dir, 'personal');
  assert.equal(before.digestScope, 'all-files');
  write(child, { 'ignored.tmp': 'included by the existing personal all-files policy' });
  assert.notEqual(sourceIdentity(dir, 'personal').digest, before.digest);
  fs.rmSync(path.join(dir, 'tools/linked'), { recursive: true });
  fs.symlinkSync(origin, path.join(dir, 'tools/linked'), 'dir');
  const linked = sourceIdentity(dir, 'tools');
  write(origin, { 'old.md': 'target file beneath a directory link' });
  assert.equal(sourceIdentity(dir, 'tools').digest, linked.digest, 'stale parent index paths do not traverse a directory-link member');
  assert.equal(sourceIdentity(dir, 'tools/linked/POLICY.md').state, 'external', 'explicit named alias retains its established behavior');
});

test('deeper mixed children and repository boundary changes use child membership without directory-link recursion', () => {
  const dir = repository('deep-parent', { 'README.md': 'parent', 'tools/neighbor.md': 'neighbor' });
  const origin = repository('deep-origin', { 'POLICY.md': 'policy' });
  const nested = path.join(dir, 'tools/nested');
  git(dir, 'clone', '-q', origin, nested);
  git(nested, '-c', 'protocol.file.allow=always', 'submodule', 'add', '-q', origin, 'deeper');
  const deeper = path.join(nested, 'deeper');
  const inner = path.join(deeper, 'inner');
  git(deeper, 'clone', '-q', origin, inner);
  const manifest = () => sourceManifest(dir, ['tools', 'tools/nested/deeper', 'tools/nested/deeper/inner/POLICY.md'], { workflowSource: dir });
  const before = manifest();
  assert.equal(before.complete, true);
  assert.deepEqual(before.sources[0].repositories.map((entry) => entry.kind), ['nested', 'submodule', 'nested']);
  write(inner, { 'POLICY.md': 'deep edit' });
  const edited = manifest();
  assert.equal(compareManifests(before, edited).changed.length, 3);
  assert.equal(compareManifests(before, edited).workflowSourceChanged, true);
  fs.symlinkSync('../deeper', path.join(deeper, 'alias'), 'dir');
  const linked = manifest();
  write(inner, { 'POLICY.md': 'deep edit again' });
  assert.notEqual(linked.sources[0].digest, manifest().sources[0].digest);
  // An ordinary parent-tracked directory can become a child repository.
  const boundary = path.join(dir, 'tools/boundary');
  write(boundary, { 'guide.md': 'guide' });
  git(dir, 'add', 'tools/boundary');
  const plain = sourceIdentity(dir, 'tools');
  git(boundary, 'init', '-q');
  git(boundary, 'add', 'guide.md');
  const child = sourceIdentity(dir, 'tools');
  assert.notEqual(child.digest, plain.digest);
  write(boundary, { 'new.md': 'new child-visible member' });
  assert.notEqual(sourceIdentity(dir, 'tools').digest, child.digest);
  fs.rmSync(path.join(boundary, '.git'), { recursive: true });
  assert.equal(sourceIdentity(dir, 'tools').kind, 'directory');
});

for (const kind of ['nested', 'submodule']) {
  test(`${kind} denied content is never current and readable neighbors survive`, (t) => {
    if (process.platform === 'win32' || process.getuid?.() === 0) { t.skip('needs POSIX permissions enforced'); return; }
    const dir = repository(`denied-child-${kind}`, { 'README.md': 'readable' });
    const origin = repository(`denied-origin-${kind}`, { 'POLICY.md': 'policy' });
    const child = path.join(dir, 'tools/child');
    if (kind === 'submodule') git(dir, '-c', 'protocol.file.allow=always', 'submodule', 'add', '-q', origin, 'tools/child');
    else git(dir, 'clone', '-q', origin, child);
    const denied = path.join(child, 'POLICY.md');
    fs.chmodSync(denied, 0);
    try {
      const baseline = sourceManifest(dir, ['tools', 'tools/child/POLICY.md', 'README.md'], { workflowSource: dir });
      assert.equal(baseline.complete, false);
      assert.equal(baseline.sources[0].kind, 'unreadable');
      assert.equal(baseline.sources[0].member, 'tools/child/POLICY.md');
      assert.equal(baseline.sources[2].kind, 'file');
      assert.equal(baseline.workflowSource.kind, 'unreadable');
      assert.equal(compareManifests(baseline, baseline).current, false);
      assert.equal(run('sources', '--repo', dir, 'tools', 'README.md').status, 1);
    } finally { fs.chmodSync(denied, 0o644); }
    assert.equal(sourceManifest(dir, ['tools'], { workflowSource: dir }).complete, true);
  });
}

test('named source and selected subtree ignore a large unrelated index during child lookup', () => {
  const dir = repository('large-unrelated-index', { 'README.md': 'ordinary source', 'docs/guide.md': 'named descendant', 'tools/guide.md': 'selected subtree' });
  const before = sourceManifest(dir, ['README.md', 'docs/guide.md', 'tools'], { workflowSource: dir });
  const blob = git(dir, 'rev-parse', ':README.md').trim();
  const records = Array.from({ length: 70000 }, (_, i) => `100644 ${blob}\tdocs/unrelated/${String(i).padStart(6, '0')}-${'x'.repeat(210)}\0`).join('');
  assert.ok(Buffer.byteLength(records) > 16 * 1024 * 1024, 'fixture exceeds the former captured-output bound');
  const added = spawnSync('git', ['update-index', '-z', '--index-info'], { cwd: dir, env: GIT_ENV, input: records, encoding: 'utf8' });
  assert.equal(added.status, 0, added.stderr);
  const after = sourceManifest(dir, ['README.md', 'docs/guide.md', 'tools'], { workflowSource: dir });
  assert.equal(after.complete, true);
  assert.equal(compareManifests(before, after).current, true);
  const result = run('sources', '--repo', dir, 'README.md', 'docs/guide.md', 'tools');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.json.complete, true);
});

test('scoped ancestor queries retain absent and unmerged gitlink diagnostics', () => {
  const origin = repository('scoped-pin-origin', { 'POLICY.md': 'policy' });
  const dir = repository('scoped-pin-parent', { 'README.md': 'neighbor' });
  const pin = git(origin, 'rev-parse', 'HEAD').trim();
  git(dir, 'update-index', '--add', '--cacheinfo', `160000,${pin},docs/child`);
  const absent = sourceManifest(dir, ['docs/child/POLICY.md', 'docs', 'README.md']);
  assert.equal(absent.complete, false);
  assert.equal(absent.sources[0].kind, 'unsupported');
  assert.equal(absent.sources[0].member, 'docs/child');
  assert.equal(absent.sources[2].kind, 'file');
  const input = `0 ${'0'.repeat(40)}\tdocs/child\n160000 ${pin} 1\tdocs/child\n160000 ${pin} 2\tdocs/child\n`;
  const updated = spawnSync('git', ['update-index', '--index-info'], { cwd: dir, env: GIT_ENV, input, encoding: 'utf8' });
  assert.equal(updated.status, 0, updated.stderr);
  const unmerged = sourceManifest(dir, ['docs/child/POLICY.md', 'README.md']);
  assert.equal(unmerged.complete, false);
  assert.equal(unmerged.sources[0].error, 'unmerged submodule index entry');
  assert.equal(unmerged.sources[1].kind, 'file');
});

