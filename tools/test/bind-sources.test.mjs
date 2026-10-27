// Binding helper: source identities of files, directories and links, and the
// modified annotation.
// Shared fixtures in ../test-support/bind.mjs give each test file its own
// temporary directory of disposable Git repositories, so the files can run
// concurrently; this checkout's project files and workflow records stay unchanged.

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import {
  compareManifests, discoverCandidates, escapedMember, establishLocalStorage, MANIFEST_FORMAT, MANIFEST_VERSION, manifestProblem, sourceIdentity, sourceManifest,
  workflowSourceIdentity,
} from '../lib/bind.mjs';
import {
  packageRoot, scratch, git, run, repository, write, qualityFixture, indexOnlyEntry,
} from '../test-support/bind.mjs';

test('source identities detect uncommitted edits, missing sources, directory changes and workflow source changes', () => {
  const dir = repository('sources', { 'AGENTS.md': '# A\n', 'docs/a.md': 'a\n', 'docs/b.md': 'b\n', '.gitignore': 'ignored.md\n' });
  const personal = path.join(scratch, 'personal-additions.md');
  fs.writeFileSync(personal, 'personal\n');
  const before = sourceManifest(dir, ['AGENTS.md', 'docs', 'absent.md', personal], { workflowSource: packageRoot });
  assert.equal(before.head, git(dir, 'rev-parse', 'HEAD').trim());
  const agents = before.sources[0];
  assert.equal(agents.state, 'tracked');
  assert.equal(agents.modified, false);
  assert.equal(agents.blob, agents.headBlob);
  assert.equal(before.sources[1].kind, 'directory');
  assert.equal(before.sources[1].files, 2);
  assert.equal(before.sources[2].kind, 'missing');
  assert.deepEqual([before.sources[3].scope, before.sources[3].kind], ['external', 'file']);
  assert.equal(before.format, MANIFEST_FORMAT);
  assert.equal(before.version, MANIFEST_VERSION);
  assert.equal(manifestProblem(before), null);
  assert.deepEqual(compareManifests(before, before), {
    changed: [], missing: ['absent.md'], added: [], unchanged: ['AGENTS.md', 'docs', personal], workflowSourceChanged: false, current: false, complete: true, unreadable: [], repositories: [], repositoryChanges: [],
  });

  write(dir, { 'AGENTS.md': '# A changed, not committed\n', 'docs/c.md': 'c\n', 'ignored.md': 'x', 'absent.md': 'now here\n' });
  fs.writeFileSync(personal, 'personal, changed\n');
  const after = sourceManifest(dir, ['AGENTS.md', 'docs', 'absent.md', personal, 'ignored.md'], { workflowSource: packageRoot });
  assert.equal(after.sources[0].modified, true, 'an uncommitted edit shows');
  assert.notEqual(after.sources[0].blob, after.sources[0].headBlob);
  assert.equal(after.sources[1].files, 3);
  assert.equal(after.sources[2].state, 'untracked');
  assert.equal(after.sources[4].state, 'ignored');
  const comparison = compareManifests(before, after);
  assert.deepEqual(comparison.changed, ['AGENTS.md', 'docs', 'absent.md', personal]);
  assert.deepEqual(comparison.added, ['ignored.md']);
  assert.equal(comparison.current, false);

  fs.rmSync(path.join(dir, 'docs', 'a.md'));
  const removed = sourceManifest(dir, ['AGENTS.md', 'docs'], { workflowSource: packageRoot });
  const gone = compareManifests(after, removed);
  assert.deepEqual(gone.missing, ['absent.md', personal, 'ignored.md'].sort((a, b) => after.sources.findIndex((s) => s.path === a) - after.sources.findIndex((s) => s.path === b)));
  assert.ok(gone.changed.includes('docs'), 'a deleted file changes its directory');

  const otherSource = { ...after, workflowSource: { ...after.workflowSource, digest: 'sha256:other' } };
  assert.equal(compareManifests(after, otherSource).workflowSourceChanged, true);
  assert.equal(compareManifests(after, otherSource).current, false);
});

test('modified compares content as Git stores it: converted clean checkouts are unmodified, edits show, a filter attribute is unknown and its driver never runs', () => {
  const identity = (dir, source) => sourceIdentity(dir, source);
  const clean = (dir, file) => assert.equal(git(dir, 'status', '--porcelain', '--', file), '', `Git reports ${file} clean`);
  const reconvert = (dir, file) => { fs.rmSync(path.join(dir, file)); git(dir, 'checkout', '--', file); };

  // End-of-line attribute and core.autocrlf checkouts: CRLF on disk, LF stored, Git-clean.
  const eol = repository('stored-eol', { '.gitattributes': '*.md text eol=crlf\n', 'AGENTS.md': 'line one\nline two\n' });
  const autocrlf = repository('stored-autocrlf', {});
  git(autocrlf, 'config', 'core.autocrlf', 'true');
  write(autocrlf, { 'AGENTS.md': 'line one\nline two\n' });
  git(autocrlf, 'add', '-A');
  git(autocrlf, 'commit', '-q', '-m', 'initial');
  for (const dir of [eol, autocrlf]) {
    reconvert(dir, 'AGENTS.md');
    assert.equal(fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf8'), 'line one\r\nline two\r\n', 'the checkout was converted');
    clean(dir, 'AGENTS.md');
    const converted = identity(dir, 'AGENTS.md');
    assert.notEqual(converted.blob, converted.headBlob, 'the raw working blob differs from the stored blob');
    assert.equal(converted.indexBlob, converted.headBlob);
    assert.equal(converted.modified, false, 'a Git-clean converted checkout is not modified');
    assert.equal(converted.modifiedUnknown, undefined);
  }
  const before = sourceManifest(eol, ['AGENTS.md']);

  // Genuine unstaged and staged edits under conversion; committing them makes the file unmodified again.
  fs.writeFileSync(path.join(eol, 'AGENTS.md'), 'line one\r\nline two, edited\r\n');
  const unstaged = identity(eol, 'AGENTS.md');
  assert.equal(unstaged.modified, true, 'an unstaged edit shows');
  assert.deepEqual(compareManifests(before, sourceManifest(eol, ['AGENTS.md'])).changed, ['AGENTS.md'], 'the raw identity is still what is compared');
  git(eol, 'add', 'AGENTS.md');
  const staged = identity(eol, 'AGENTS.md');
  assert.notEqual(staged.indexBlob, staged.headBlob);
  assert.equal(staged.modified, true, 'a staged edit shows');
  git(eol, 'commit', '-q', '-m', 'edit');
  assert.equal(identity(eol, 'AGENTS.md').modified, false);
  assert.equal(identity(autocrlf, 'AGENTS.md').modified, false);
  fs.writeFileSync(path.join(autocrlf, 'AGENTS.md'), 'line one\r\n');
  assert.equal(identity(autocrlf, 'AGENTS.md').modified, true);

  // A built-in working-tree encoding: a converted checkout is unmodified; content Git cannot convert is unknown.
  const encoded = repository('stored-encoding', { '.gitattributes': 'guide.txt working-tree-encoding=UTF-16LE\n' });
  fs.writeFileSync(path.join(encoded, 'guide.txt'), Buffer.from('guidance\n', 'utf16le'));
  git(encoded, 'add', '-A');
  git(encoded, 'commit', '-q', '-m', 'initial');
  clean(encoded, 'guide.txt');
  const utf16 = identity(encoded, 'guide.txt');
  assert.notEqual(utf16.blob, utf16.headBlob);
  assert.equal(utf16.modified, false, 'a working-tree encoding checkout is not modified');
  fs.writeFileSync(path.join(encoded, 'guide.txt'), Buffer.from([0x67, 0x00, 0x75]));
  const unconvertible = identity(encoded, 'guide.txt');
  assert.deepEqual([unconvertible.kind, unconvertible.modified, unconvertible.modifiedUnknown], ['file', 'unknown', 'Git could not apply its built-in conversions to the working content']);
  assert.equal(typeof unconvertible.blob, 'string', 'the raw identity is still reported');

  // A link is stored as its target text, never converted.
  fs.symlinkSync('AGENTS.md', path.join(eol, 'GUIDE.md'));
  git(eol, 'add', 'GUIDE.md');
  git(eol, 'commit', '-q', '-m', 'link');
  assert.equal(identity(eol, 'GUIDE.md').modified, false, 'the committed link is unmodified');
  fs.unlinkSync(path.join(eol, 'GUIDE.md'));
  fs.symlinkSync('.gitattributes', path.join(eol, 'GUIDE.md'));
  assert.equal(identity(eol, 'GUIDE.md').modified, true, 'a retargeted link is modified');

  // A filter attribute: committed before its driver is configured, then the driver would leave a marker if run.
  const filtered = repository('stored-filter', { '.gitattributes': 'filtered.md filter=marker\n', 'filtered.md': 'filtered\n', 'plain.md': 'plain\n' });
  const marker = path.join(scratch, 'stored-filter-driver-ran');
  for (const role of ['clean', 'smudge']) git(filtered, 'config', `filter.marker.${role}`, `touch '${marker}' && cat`);
  for (const content of [null, 'filtered, edited\n']) {
    if (content) fs.writeFileSync(path.join(filtered, 'filtered.md'), content);
    const manifest = sourceManifest(filtered, ['filtered.md', 'plain.md']);
    const [unknown, plain] = manifest.sources;
    assert.deepEqual([unknown.state, unknown.modified, unknown.modifiedUnknown], ['tracked', 'unknown', 'a filter attribute applies to the path; its driver is not run'], String(content));
    assert.equal(unknown.blob, content ? git(filtered, 'hash-object', '--no-filters', 'filtered.md').trim() : unknown.headBlob, 'the raw identity is retained');
    assert.equal(plain.modified, false, 'paths without a filter attribute are unaffected');
    assert.equal(manifest.complete, true);
    const cli = run('sources', '--repo', filtered, 'filtered.md');
    assert.equal(cli.status, 0, cli.stderr);
    assert.equal(cli.json.sources[0].modified, 'unknown');
    assert.equal(fs.existsSync(marker), false, 'the configured driver was never run');
  }
  git(filtered, 'hash-object', '--path=filtered.md', 'filtered.md');
  assert.equal(fs.existsSync(marker), true, 'the same driver runs when Git applies it, so the marker would have shown');
});

test('raw bytes identical to HEAD are not unmodified where a working-tree encoding applies: even length converts to other content, odd length is unknown', () => {
  // Committed before the attributes, so HEAD stores these UTF-8 bytes as they are and the working bytes equal it.
  const dir = repository('head-identical-encoding', { 'even.txt': 'even', 'odd.txt': 'odd', 'filtered.txt': 'filtered', 'eol.md': 'line\n', 'plain.md': 'plain\n' });
  write(dir, { '.gitattributes': '*.txt working-tree-encoding=UTF-16LE\nfiltered.txt filter=marker\neol.md text eol=crlf\n' });
  git(dir, 'add', '.gitattributes');
  git(dir, 'commit', '-q', '-m', 'attributes');
  const marker = path.join(scratch, 'head-identical-encoding-driver-ran');
  for (const role of ['clean', 'smudge']) git(dir, 'config', `filter.marker.${role}`, `touch '${marker}' && cat`);
  const manifest = sourceManifest(dir, ['even.txt', 'odd.txt', 'filtered.txt', 'eol.md', 'plain.md']);
  const [even, odd, filtered, eol, plain] = manifest.sources;
  for (const entry of manifest.sources) assert.equal(entry.blob, entry.headBlob, `${entry.path}: the raw working bytes equal the HEAD blob`);

  // Read as UTF-16LE, the four bytes are two other characters, stored as different UTF-8 content.
  assert.notEqual(git(dir, 'hash-object', '--path=even.txt', 'even.txt').trim(), even.headBlob, 'Git would store other content');
  assert.deepEqual([even.modified, even.modifiedUnknown], [true, undefined]);
  // Three bytes are not UTF-16LE text, so Git cannot convert them and there is nothing to compare.
  assert.deepEqual([odd.modified, odd.modifiedUnknown], ['unknown', 'Git could not apply its built-in conversions to the working content']);
  // A filter attribute is still decided first, and its driver never runs.
  assert.deepEqual([filtered.modified, filtered.modifiedUnknown], ['unknown', 'a filter attribute applies to the path; its driver is not run']);
  assert.equal(fs.existsSync(marker), false, 'the configured driver was never run');
  // Without a working-tree encoding, raw bytes equal to HEAD stay unmodified, end-of-line attribute included.
  assert.deepEqual([eol.modified, eol.modifiedUnknown, plain.modified, plain.modifiedUnknown], [false, undefined, false, undefined]);
  assert.equal(manifest.complete, true, 'the annotation never makes a source incomplete');

  // The same text encoded as UTF-16LE converts to the stored UTF-8: Git-clean and unmodified.
  // Staging it makes Git compare the converted content. Otherwise, once a
  // timestamp tick separates the index write from this rewrite, Git trusts
  // the stale pre-attribute size and reports the file modified unread.
  fs.writeFileSync(path.join(dir, 'even.txt'), Buffer.from('even', 'utf16le'));
  git(dir, 'add', '--', 'even.txt');
  assert.equal(git(dir, 'ls-files', '-s', '--', 'even.txt').split(/\s+/)[1], even.headBlob, 'the converted content is the HEAD blob');
  assert.equal(fs.existsSync(marker), false, 'staging ran no filter driver');
  assert.equal(git(dir, 'status', '--porcelain', '--', 'even.txt'), '', 'Git reports even.txt clean');
  const encoded = sourceIdentity(dir, 'even.txt');
  assert.notEqual(encoded.blob, encoded.headBlob);
  assert.deepEqual([encoded.modified, encoded.modifiedUnknown], [false, undefined]);
});

test('a source keeps its lookup identity through links: retarget, replacement, removal, broken link and directory alias', () => {
  const dir = repository('aliases', { 'policy/a.txt': 'test-a\n', 'policy/b.txt': 'test-b\n', 'docs/x.md': 'x\n', 'README.md': '# P\n' });
  fs.symlinkSync('policy/a.txt', path.join(dir, 'AGENTS.md'));
  fs.symlinkSync('docs', path.join(dir, 'docs-link'), 'dir');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'links');
  const recorded = sourceManifest(dir, ['AGENTS.md', 'docs-link', 'docs']);
  const agents = recorded.sources[0];
  assert.equal(agents.path, 'AGENTS.md', 'the lookup path is recorded, not the target');
  assert.deepEqual(agents.link, { target: 'policy/a.txt' });
  assert.equal(agents.resolved, 'policy/a.txt');
  assert.equal(agents.state, 'tracked');
  assert.equal(agents.modified, false, 'the committed link is unmodified');
  assert.equal(agents.blob, git(dir, 'hash-object', 'policy/a.txt').trim(), 'the effective content is identified');
  assert.equal(agents.linkBlob, agents.headBlob);
  const alias = recorded.sources[1];
  assert.equal(alias.path, 'docs-link');
  assert.equal(alias.kind, 'directory');
  assert.deepEqual(alias.link, { target: 'docs' });
  assert.equal(alias.resolved, 'docs');
  assert.equal(alias.files, 1);
  assert.equal(recorded.sources.length, 3, 'distinct aliases stay distinct');

  fs.rmSync(path.join(dir, 'AGENTS.md'));
  fs.symlinkSync('policy/b.txt', path.join(dir, 'AGENTS.md'));
  const retargeted = sourceManifest(dir, ['AGENTS.md', 'docs-link', 'docs']);
  assert.deepEqual(compareManifests(recorded, retargeted).changed, ['AGENTS.md'], 'a retargeted alias is a change');
  assert.equal(retargeted.sources[0].modified, true);
  assert.equal(retargeted.sources[0].blob, git(dir, 'hash-object', 'policy/b.txt').trim());

  fs.rmSync(path.join(dir, 'AGENTS.md'));
  fs.writeFileSync(path.join(dir, 'AGENTS.md'), 'test-a\n');
  const replaced = sourceManifest(dir, ['AGENTS.md']);
  assert.equal(replaced.sources[0].link, undefined);
  assert.deepEqual(compareManifests(recorded, replaced).changed, ['AGENTS.md'], 'a link replaced by a file with the old content is still a change of source');

  fs.rmSync(path.join(dir, 'AGENTS.md'));
  assert.deepEqual(compareManifests(recorded, sourceManifest(dir, ['AGENTS.md', 'docs-link', 'docs'])).missing, ['AGENTS.md']);
  fs.symlinkSync('policy/gone.txt', path.join(dir, 'AGENTS.md'));
  const broken = sourceManifest(dir, ['AGENTS.md']).sources[0];
  assert.equal(broken.kind, 'missing');
  assert.deepEqual(broken.link, { target: 'policy/gone.txt' });
  assert.ok(compareManifests(recorded, { sources: [broken] }).missing.includes('AGENTS.md'), 'a broken link is a missing source');

  write(dir, { 'docs/y.md': 'y\n' });
  const grown = sourceManifest(dir, ['docs-link']);
  assert.equal(grown.sources[0].files, 2, 'a directory alias is resolved afresh');
  assert.deepEqual(compareManifests(recorded, grown).changed, ['docs-link']);

  const aliasRoot = path.join(scratch, 'alias-of-aliases');
  fs.symlinkSync(dir, aliasRoot, 'dir');
  const viaAlias = sourceIdentity(dir, path.join(aliasRoot, 'README.md'));
  assert.deepEqual([viaAlias.path, viaAlias.scope, viaAlias.state], ['README.md', 'checkout', 'tracked'], 'a source named through an alias of the checkout is a checkout source');
});

test('lookup paths are normalized before deduplication and distinct aliases are kept', () => {
  const dir = repository('spelling', { 'docs/a.md': 'a\n', 'README.md': '# P\n' });
  fs.symlinkSync('docs', path.join(dir, 'guides'), 'dir');
  const manifest = sourceManifest(dir, ['docs', './docs', 'docs/', 'docs/../docs', path.join(dir, 'docs'), 'guides', 'guides/']);
  assert.deepEqual(manifest.sources.map((s) => s.path), ['docs', 'guides']);
  const cli = run('sources', '--repo', dir, 'docs', './docs', 'docs/');
  assert.equal(cli.status, 0, cli.stderr);
  assert.deepEqual(cli.json.sources.map((s) => s.path), ['docs']);
});

test('an ancestor alias retargeted to identical content is a change: the resolved location is part of the identity', () => {
  const dir = repository('ancestor-retarget', { 'README.md': '# P\n' });
  const personal = path.join(scratch, 'personal-ancestor');
  write(personal, { 'a/policy.md': 'same policy\n', 'b/policy.md': 'same policy\n' });
  fs.symlinkSync('a', path.join(personal, 'current'), 'dir');
  const lookup = path.join(personal, 'current', 'policy.md');
  const before = sourceManifest(dir, ['README.md', lookup]);
  assert.deepEqual([before.sources[1].path, before.sources[1].scope, before.sources[1].resolved], [lookup, 'external', path.join(personal, 'a', 'policy.md')]);
  assert.equal(before.sources[1].link, undefined, 'the leaf is a regular file');
  fs.unlinkSync(path.join(personal, 'current'));
  fs.symlinkSync('b', path.join(personal, 'current'), 'dir');
  const after = sourceManifest(dir, ['README.md', lookup]);
  assert.equal(after.sources[1].resolved, path.join(personal, 'b', 'policy.md'));
  assert.equal(after.sources[1].digest, before.sources[1].digest, 'the content is byte-identical');
  const comparison = compareManifests(before, after);
  assert.deepEqual(comparison.changed, [lookup], 'the retarget is reported');
  assert.deepEqual(comparison.unchanged, ['README.md']);
  assert.equal(comparison.current, false);
  assert.equal(after.sources[1].path, lookup, 'the lookup path is preserved');
  const inside = repository('ancestor-retarget-inside', { 'policy-a/guidance.md': 'g\n', 'policy-b/guidance.md': 'g\n' });
  fs.symlinkSync('policy-a', path.join(inside, 'current'), 'dir');
  git(inside, 'add', '-A');
  git(inside, 'commit', '-q', '-m', 'alias');
  const first = sourceManifest(inside, ['current/guidance.md', 'current']);
  fs.unlinkSync(path.join(inside, 'current'));
  fs.symlinkSync('policy-b', path.join(inside, 'current'), 'dir');
  const second = sourceManifest(inside, ['current/guidance.md', 'current']);
  assert.deepEqual(compareManifests(first, second).changed, ['current/guidance.md', 'current'], 'both the descendant and the directory alias report the retarget');
  assert.equal(second.sources.length, 2, 'distinct lookups stay distinct');
});

test('a file beneath a directory alias is classified at the location its ancestors reach; direct files and links keep their own Git semantics', () => {
  const dir = repository('alias-descendant', { 'policy-a/guidance.md': 'tracked\n', 'README.md': '# P\n', 'docs/x.md': 'x\n' });
  fs.symlinkSync('policy-a', path.join(dir, 'current-policy'), 'dir');
  fs.symlinkSync('policy-a/guidance.md', path.join(dir, 'GUIDE.md'));
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'aliases');
  write(dir, { 'policy-a/draft.md': 'untracked\n' });
  const manifest = sourceManifest(dir, ['current-policy/guidance.md', 'current-policy/draft.md', 'README.md', 'GUIDE.md', 'current-policy', 'current-policy/absent.md']);
  const [tracked, untracked, direct, leafLink, alias, absent] = manifest.sources;
  assert.deepEqual([tracked.path, tracked.kind, tracked.state, tracked.resolved], ['current-policy/guidance.md', 'file', 'tracked', 'policy-a/guidance.md']);
  assert.equal(tracked.link, undefined, 'the descendant itself is not a link');
  assert.equal(tracked.blob, git(dir, 'hash-object', 'policy-a/guidance.md').trim());
  assert.equal(tracked.indexBlob, tracked.blob, 'index and HEAD are read at the resolved location');
  assert.equal(tracked.headBlob, tracked.blob);
  assert.equal(tracked.modified, false);
  assert.deepEqual([untracked.path, untracked.state, untracked.resolved, untracked.indexBlob, untracked.headBlob], ['current-policy/draft.md', 'untracked', 'policy-a/draft.md', null, null]);
  assert.deepEqual([direct.path, direct.state, direct.resolved, direct.link], ['README.md', 'tracked', undefined, undefined], 'a direct file is unchanged');
  assert.deepEqual([leafLink.path, leafLink.state, leafLink.link, leafLink.resolved], ['GUIDE.md', 'tracked', { target: 'policy-a/guidance.md' }, 'policy-a/guidance.md']);
  assert.equal(leafLink.linkBlob, leafLink.headBlob, 'a direct link still compares what Git stores');
  assert.equal(leafLink.indexBlob, leafLink.linkBlob);
  assert.equal(leafLink.modified, false);
  assert.deepEqual([alias.kind, alias.resolved, alias.files], ['directory', 'policy-a', 2], 'a directory alias is unchanged');
  assert.equal(absent.kind, 'missing');
  write(dir, { 'policy-a/guidance.md': 'tracked, edited\n' });
  const edited = sourceManifest(dir, ['current-policy/guidance.md', 'GUIDE.md']);
  assert.equal(edited.sources[0].modified, true, 'an uncommitted edit beneath the alias shows');
  assert.equal(edited.sources[1].modified, false, 'the link itself did not change');
  assert.deepEqual(compareManifests(manifest, edited).changed, ['current-policy/guidance.md', 'GUIDE.md'], 'the effective content changed for both lookups');
  const cli = run('sources', '--repo', dir, 'current-policy/guidance.md');
  assert.equal(cli.status, 0, cli.stderr);
  assert.equal(cli.json.sources[0].state, 'tracked');

  const elsewhere = path.join(scratch, 'alias-descendant-outside');
  write(elsewhere, { 'guidance.md': 'outside\n' });
  fs.symlinkSync(elsewhere, path.join(dir, 'external-policy'), 'dir');
  const outside = sourceIdentity(dir, 'external-policy/guidance.md');
  assert.deepEqual([outside.path, outside.scope, outside.kind, outside.state, outside.resolved], ['external-policy/guidance.md', 'checkout', 'file', 'external', path.join(elsewhere, 'guidance.md')]);
  assert.match(outside.digest, /^sha256:/);
});

test('an ignored directory recorded as a source is identified by its regular files: edits, additions and removals show; a visible neighbor is unchanged', () => {
  const dir = repository('ignored-directory', { 'README.md': '# P\n', 'docs/a.md': 'a\n' });
  establishLocalStorage(dir);
  write(dir, { '.agent-workflow/personal/additions.md': 'personal\n', '.agent-workflow/personal/nested/more.md': 'more\n' });
  const before = sourceManifest(dir, ['.agent-workflow/personal', 'docs', '.agent-workflow/personal/additions.md']);
  const [personal, docs, file] = before.sources;
  assert.deepEqual([personal.kind, personal.state, personal.digestScope, personal.files], ['directory', 'ignored', 'all-files', 2]);
  assert.deepEqual([docs.kind, docs.state, docs.digestScope, docs.files], ['directory', undefined, 'git-visible', 1], 'a visible directory keeps the Git-visible digest');
  assert.equal(file.state, 'ignored');
  const expected = `sha256:${crypto.createHash('sha256').update([
    `additions.md\0sha256:${crypto.createHash('sha256').update('personal\n').digest('hex')}\n`,
    `nested/more.md\0sha256:${crypto.createHash('sha256').update('more\n').digest('hex')}\n`,
  ].join('')).digest('hex')}`;
  assert.equal(personal.digest, expected, 'names and contents, in code-unit order');

  write(dir, { '.agent-workflow/personal/additions.md': 'personal, edited\n' });
  const edited = sourceManifest(dir, ['.agent-workflow/personal', 'docs', '.agent-workflow/personal/additions.md']);
  assert.deepEqual(compareManifests(before, edited).changed, ['.agent-workflow/personal', '.agent-workflow/personal/additions.md'], 'an edit inside the ignored directory shows on the directory itself');
  assert.deepEqual(compareManifests(before, edited).unchanged, ['docs']);
  write(dir, { '.agent-workflow/personal/extra.md': 'x\n' });
  const added = sourceManifest(dir, ['.agent-workflow/personal', 'docs']);
  assert.equal(added.sources[0].files, 3);
  assert.deepEqual(compareManifests(edited, added).changed, ['.agent-workflow/personal'], 'an added file shows');
  fs.rmSync(path.join(dir, '.agent-workflow', 'personal', 'nested'), { recursive: true });
  const removed = sourceManifest(dir, ['.agent-workflow/personal', 'docs']);
  assert.equal(removed.sources[0].files, 2);
  assert.deepEqual(compareManifests(added, removed).changed, ['.agent-workflow/personal'], 'a removed file shows');
  assert.deepEqual(compareManifests(added, removed).unchanged, ['docs'], 'the visible neighbor is unchanged throughout');
  fs.symlinkSync('../../README.md', path.join(dir, '.agent-workflow', 'personal', 'link.md'));
  assert.equal(sourceManifest(dir, ['.agent-workflow/personal']).sources[0].files, 2, 'links inside are not followed');
  assert.equal(git(dir, 'status', '--porcelain'), '', 'nothing tracked changed');
  const inspected = run('inspect', '--repo', dir);
  assert.equal(inspected.status, 0, inspected.stderr);
});

for (const mode of ['direct', 'ignored-root', 'external-root', 'ignored-member', 'external-member', 'ignored-subdirectory', 'external-subdirectory', 'git-member']) {
  test(`content access failure returns partial JSON and a failed check: ${mode}`, (t) => {
    if (process.platform === 'win32' || process.getuid?.() === 0) { t.skip('needs POSIX permissions enforced'); return; }
    const dir = repository(`access-${mode}`, { 'README.md': '# P\n', 'docs/a.md': 'before\n', ...Object.fromEntries(Object.entries(qualityFixture).filter(([name]) => name.startsWith('.quality/'))) });
    establishLocalStorage(dir);
    const root = mode.startsWith('external') ? path.join(scratch, `personal-${mode}`) : path.join(dir, '.agent-workflow', 'personal');
    write(root, { 'member.md': 'before\n', 'nested/member.md': 'nested\n' });
    const source = mode === 'direct' ? 'docs/a.md' : mode === 'git-member' ? 'docs' : root;
    const directoryDenied = mode.endsWith('root') || mode.endsWith('subdirectory');
    const denied = mode === 'direct' || mode === 'git-member' ? path.join(dir, 'docs', 'a.md') : mode.endsWith('root') ? root : mode.endsWith('subdirectory') ? path.join(root, 'nested') : path.join(root, 'member.md');
    const manifestPath = path.join(dir, '.agent-workflow', 'binding-sources.json');
    const baseline = run('sources', '--repo', dir, '--out', manifestPath, source, 'README.md');
    assert.equal(baseline.status, 0, baseline.stderr);
    fs.chmodSync(denied, 0);
    try {
      const failed = run('sources', '--repo', dir, '--compare', manifestPath, source, 'README.md');
      assert.equal(failed.status, 1, failed.stderr);
      assert.equal(failed.json.complete, false);
      const affected = failed.json.sources[0];
      assert.equal(affected.kind, 'unreadable');
      assert.match(affected.error, /EACCES|Permission denied/i);
      assert.ok(affected.member);
      assert.equal(affected.digest, undefined);
      assert.equal(affected.blob, undefined);
      assert.deepEqual(failed.json.sources[1], baseline.json.sources[1]);
      assert.equal(failed.json.comparison.current, false);
      const inspected = run('inspect', '--repo', dir);
      assert.equal(inspected.status, 1, inspected.stderr);
      assert.equal(inspected.json.binding.comparison.complete, false);
      assert.equal(inspected.json.binding.comparison.unreadable[0].kind, 'unreadable');
      assert.equal(inspected.json.quality.present, true);
      assert.ok(inspected.json.candidates.some((entry) => entry.path === 'README.md'));
      // Even a previously retained incomplete report can never become current.
      fs.writeFileSync(manifestPath, JSON.stringify(failed.json));
      fs.chmodSync(denied, directoryDenied ? 0o755 : 0o644);
      fs.writeFileSync(directoryDenied ? path.join(denied, 'member.md') : denied, 'edited while unavailable\n');
      fs.chmodSync(denied, 0);
      const repeated = run('inspect', '--repo', dir);
      assert.equal(repeated.status, 1, repeated.stderr);
      assert.equal(repeated.json.binding.comparison.current, false);
      assert.deepEqual(repeated.json.binding.comparison.unchanged, ['README.md']);
    } finally {
      fs.chmodSync(denied, directoryDenied ? 0o755 : 0o644);
    }
    fs.writeFileSync(manifestPath, JSON.stringify(baseline.json));
    if (mode === 'git-member') {
      fs.unlinkSync(denied);
      const deleted = run('sources', '--repo', dir, '--compare', manifestPath, source, 'README.md');
      assert.equal(deleted.status, 0, deleted.stderr);
      const expected = `sha256:${crypto.createHash('sha256').update('docs/a.md\0missing\n').digest('hex')}`;
      assert.equal(deleted.json.sources[0].digest, expected, 'true indexed deletion retains its sentinel');
      assert.equal(deleted.json.comparison.current, false);
      const inspected = run('inspect', '--repo', dir);
      assert.equal(inspected.status, 0, inspected.stderr);
      assert.deepEqual(inspected.json.binding.comparison.changed, ['docs']);
      assert.deepEqual(inspected.json.binding.comparison.unchanged, ['README.md']);
    } else {
      assert.equal(run('inspect', '--repo', dir).status, 0, 'successful recheck after access repair');
    }
  });
}

test('Git-visible member stat errors retain the cause; unrelated programming failures still throw', (t) => {
  const dir = repository('stat-access', { 'docs/a.md': 'a', 'README.md': 'readable' });
  const denied = path.join(dir, 'docs', 'a.md');
  const original = fs.statSync;
  t.mock.method(fs, 'statSync', (file, ...args) => {
    if (String(file) === denied) throw Object.assign(new Error('injected stat access denial'), { code: 'EACCES' });
    return original(file, ...args);
  });
  const manifest = sourceManifest(dir, ['docs', 'README.md']);
  assert.equal(manifest.complete, false);
  assert.equal(manifest.sources[0].error, 'EACCES');
  assert.equal(manifest.sources[0].message, 'injected stat access denial');
  assert.equal(manifest.sources[0].member, 'docs/a.md');
  assert.equal(manifest.sources[0].digest, undefined);
  assert.equal(manifest.sources[1].kind, 'file');
  t.mock.restoreAll();
  const outside = path.join(scratch, 'unrelated-failure.md');
  fs.writeFileSync(outside, 'content');
  const read = fs.readFileSync;
  t.mock.method(fs, 'readFileSync', (file, ...args) => {
    if (String(file) === outside) throw new Error('unrelated implementation failure');
    return read(file, ...args);
  });
  assert.throws(() => sourceIdentity(dir, outside), /unrelated implementation failure/);
});

test('Git-visible links retain working target/type and followed content without directory traversal', () => {
  const dir = repository('member-links', { 'docs/plain.md': 'plain', 'target.md': 'followed', 'v1/a': 'one', 'v2/a': 'two' });
  const link = path.join(dir, 'docs', 'current');
  fs.symlinkSync('../v1', link);
  fs.symlinkSync('../target.md', path.join(dir, 'docs', 'file-link'));
  git(dir, 'add', 'docs');
  // docs is not a workflow part; exercise the same member through tools too.
  git(dir, 'mv', 'docs', 'tools');
  const current = path.join(dir, 'tools', 'current');
  const manifest = () => sourceManifest(dir, ['tools', 'target.md'], { workflowSource: dir });
  const baseline = manifest();
  const replace = (target) => { fs.unlinkSync(current); fs.symlinkSync(target, current); };
  replace('../v2');
  const unstaged = manifest();
  assert.equal(compareManifests(baseline, unstaged).current, false);
  assert.notEqual(unstaged.sources[0].digest, baseline.sources[0].digest);
  assert.notEqual(unstaged.workflowSource.digest, baseline.workflowSource.digest);
  git(dir, 'add', 'tools/current');
  assert.equal(manifest().sources[0].digest, unstaged.sources[0].digest);
  assert.equal(compareManifests(baseline, manifest()).current, false);
  write(dir, { 'v2/a': 'directory children are outside the member identity' });
  assert.equal(manifest().sources[0].digest, unstaged.sources[0].digest);
  replace('../absent-one');
  const dangling = manifest();
  replace('../absent-two');
  assert.notEqual(manifest().sources[0].digest, dangling.sources[0].digest);
  assert.notEqual(manifest().workflowSource.digest, dangling.workflowSource.digest);
  fs.unlinkSync(current);
  const absent = manifest();
  assert.equal(absent.complete, true);
  assert.notEqual(absent.sources[0].digest, dangling.sources[0].digest);
  fs.symlinkSync('../absent-one', current);
  fs.mkdirSync(path.join(dir, 'absent-one'));
  assert.notEqual(manifest().sources[0].digest, dangling.sources[0].digest, 'target type changes participate');
  const beforeContent = manifest();
  write(dir, { 'tools/plain.md': 'unstaged plain edit' });
  const ordinary = manifest();
  assert.notEqual(ordinary.sources[0].digest, beforeContent.sources[0].digest);
  assert.notEqual(ordinary.workflowSource.digest, beforeContent.workflowSource.digest);
  write(dir, { 'target.md': 'unstaged followed edit' });
  assert.notEqual(manifest().sources[0].digest, ordinary.sources[0].digest);
  assert.notEqual(manifest().workflowSource.digest, ordinary.workflowSource.digest);
});

for (const stagedDeletion of [false, true]) {
  test(`ordinary file replaced by directory stays measurable (staged deletion: ${stagedDeletion})`, () => {
    const dir = repository(`ordinary-replacement-${stagedDeletion}`, { 'docs/old': 'former file', 'docs/neighbor.md': 'neighbor' });
    const before = sourceIdentity(dir, 'docs');
    fs.unlinkSync(path.join(dir, 'docs/old'));
    if (stagedDeletion) git(dir, 'rm', '--cached', 'docs/old');
    write(dir, { 'docs/old/new.md': 'visible descendant' });
    const replacement = sourceIdentity(dir, 'docs');
    assert.equal(replacement.kind, 'directory');
    assert.equal(replacement.repositories, undefined);
    assert.equal(replacement.files, stagedDeletion ? 2 : 3, 'unstaged old entry remains missing beside ordinary descendants');
    assert.notEqual(replacement.digest, before.digest);
    write(dir, { 'docs/old/new.md': 'changed descendant' });
    assert.notEqual(sourceIdentity(dir, 'docs').digest, replacement.digest);
    assert.equal(run('sources', '--repo', dir, 'docs').status, 0);
  });
}

test('recorded absence stays missing through inspect and listed checks, appearance and deletion', () => {
  const dir = repository('persistent-absence', { 'README.md': 'readable' });
  establishLocalStorage(dir);
  const file = path.join(dir, '.agent-workflow/binding-sources.json');
  const recorded = run('sources', '--repo', dir, '--out', file, 'expected.md', 'README.md');
  assert.equal(recorded.status, 0, recorded.stderr);
  assert.equal(recorded.json.complete, true);
  assert.equal(recorded.json.sources[0].kind, 'missing');
  const checks = () => [
    run('inspect', '--repo', dir).json.binding.comparison,
    run('sources', '--repo', dir, '--compare', file, 'expected.md', 'README.md').json.comparison,
  ];
  for (let repeat = 0; repeat < 2; repeat++) {
    for (const result of checks()) {
      assert.equal(result.complete, true);
      assert.equal(result.current, false);
      assert.deepEqual(result.missing, ['expected.md']);
      assert.deepEqual(result.unchanged, ['README.md']);
    }
  }
  write(dir, { 'expected.md': 'now present' });
  for (const result of checks()) {
    assert.deepEqual(result.changed, ['expected.md']);
    assert.deepEqual(result.missing, []);
    assert.equal(result.current, false);
  }
  assert.equal(run('sources', '--repo', dir, '--out', file, 'expected.md', 'README.md').status, 0);
  for (const result of checks()) assert.equal(result.current, true, `comparison: ${JSON.stringify(result)}`);
  fs.rmSync(path.join(dir, 'expected.md'));
  for (const result of checks()) {
    assert.deepEqual(result.missing, ['expected.md']);
    assert.equal(result.current, false);
    assert.equal(result.complete, true);
  }
});

test('admitted lookup spellings compare canonically in inspect, listed checks and repository grouping', () => {
  const dir = repository('lookup-spelling', { 'docs/guide.md': 'guide' });
  const origin = repository('lookup-child', { 'POLICY.md': 'policy' });
  git(dir, 'clone', '-q', origin, path.join(dir, 'docs/child'));
  establishLocalStorage(dir);
  const file = path.join(dir, '.agent-workflow/binding-sources.json');
  const baseline = sourceManifest(dir, ['docs'], { workflowSource: packageRoot });
  for (const variant of ['./docs', 'docs/', './docs//']) {
    const recorded = structuredClone(baseline);
    recorded.sources[0].path = variant;
    assert.equal(manifestProblem(recorded), null);
    fs.writeFileSync(file, JSON.stringify(recorded));
    for (const result of [
      run('inspect', '--repo', dir).json.binding.comparison,
      run('sources', '--repo', dir, '--compare', file, variant).json.comparison,
      compareManifests(baseline, recorded),
    ]) {
      assert.equal(result.current, true, `comparison: ${JSON.stringify(result)}`);
      assert.deepEqual(result.unchanged, ['docs']);
      assert.deepEqual(result.added, []);
      assert.deepEqual(result.missing, []);
      assert.deepEqual(result.repositoryChanges, []);
      assert.ok(result.repositories.every((entry) => entry.source === 'docs'));
    }
    assert.equal(recorded.sources[0].path, variant, 'comparison preserves input');
  }
  write(dir, { 'docs/guide.md': 'changed guide' });
  for (const result of [run('inspect', '--repo', dir).json.binding.comparison,
    run('sources', '--repo', dir, '--compare', file, './docs/').json.comparison]) {
    assert.equal(result.current, false);
    assert.deepEqual(result.changed, ['docs']);
    assert.deepEqual(result.repositoryChanges, []);
  }
});

// Literal named paths keep their own index provenance even beside glob matches.
test('literal file index lookup handles metacharacters, staged neighbors and untracked matches', () => {
  const question = process.platform === 'win32' ? {} : { 'a?.md': 'question', 'a1.md': 'other neighbor' };
  const dir = repository('literal-index', { 'doc[1].md': 'bracket', 'doc1.md': 'neighbor', ...question, 'a.md': 'tracked neighbor' });
  for (const name of ['doc[1].md', ...('a?.md' in question ? ['a?.md'] : [])]) {
    assert.equal(sourceIdentity(dir, name).indexBlob, git(dir, 'rev-parse', `:${name}`).trim());
    write(dir, { [name]: `staged ${name}` });
    git(dir, 'add', '--', `:(literal)${name}`);
    const entry = sourceIdentity(dir, name);
    assert.equal(entry.indexBlob, git(dir, 'rev-parse', `:${name}`).trim());
    assert.equal(entry.indexBlob, entry.blob);
    assert.notEqual(entry.headBlob, entry.indexBlob);
  }
  write(dir, { 'doc1.md': 'staged neighbor edit', '[a].md': 'untracked bracket' });
  git(dir, 'add', 'doc1.md');
  assert.equal(sourceIdentity(dir, 'doc[1].md').indexBlob, git(dir, 'rev-parse', ':doc[1].md').trim());
  const before = sourceManifest(dir, ['[a].md']);
  assert.equal(before.sources[0].state, 'untracked');
  assert.equal(before.sources[0].indexBlob, null);
  git(dir, 'rm', '--cached', 'a.md');
  const comparison = compareManifests(before, sourceManifest(dir, ['[a].md']));
  assert.equal(comparison.current, true, 'neighbor-only index removal changes neither content nor state');
  assert.deepEqual(comparison.changed, []);
});

test('Git path names that are not UTF-8 make a directory identity unsupported, never looked up under a substituted name; valid Unicode, literal U+FFFD and absence are unaffected', () => {
  const unsupported = 'path name is not valid UTF-8; such names are not supported';
  const dir = repository('invalid-path-names', {
    'README.md': '# P\n', 'docs/café.md': 'é\n', 'docs/caf\uFFFD.md': 'replacement\n', 'docs/gone.md': 'gone\n', 'lib/readme.md': 'lib\n',
  });
  fs.rmSync(path.join(dir, 'docs', 'gone.md'));
  const sources = ['README.md', 'docs', 'lib'];
  const valid = sourceManifest(dir, sources);
  assert.equal(valid.complete, true);
  assert.deepEqual([valid.sources[1].kind, valid.sources[1].digestScope, valid.sources[1].files], ['directory', 'git-visible', 3],
    'a valid accented name, a literal U+FFFD name and a deleted tracked file are each identified');
  write(dir, { 'docs/caf\uFFFD.md': 'replacement, edited\n' });
  assert.deepEqual(compareManifests(valid, sourceManifest(dir, sources)).changed, ['docs'], 'an edit of the literal U+FFFD file shows');
  write(dir, { 'docs/caf\uFFFD.md': 'replacement\n' });

  // Index-only, so any host can hold it: replacement decoding would turn this name into the literal U+FFFD file's.
  const invalidFile = Buffer.concat([Buffer.from('docs/caf'), Buffer.from([0xff]), Buffer.from('.md')]);
  indexOnlyEntry(dir, '100644', git(dir, 'rev-parse', 'HEAD:README.md').trim(), invalidFile);
  const current = sourceManifest(dir, sources);
  const [readme, docs, lib] = current.sources;
  assert.deepEqual([docs.kind, docs.error, docs.message, docs.member, docs.digest], ['unsupported', unsupported, unsupported, 'docs/caf\\xff.md', undefined]);
  assert.deepEqual([readme, lib], [valid.sources[0], valid.sources[2]], 'unaffected sources keep their identities');
  assert.equal(current.complete, false);
  const comparison = compareManifests(valid, current);
  assert.deepEqual([comparison.complete, comparison.current, comparison.unreadable.map((entry) => entry.path), comparison.unchanged], [false, false, ['docs'], ['README.md', 'lib']]);
  const command = run('sources', '--repo', dir, ...sources);
  assert.equal(command.status, 1, command.stderr);
  assert.deepEqual([command.json.complete, command.json.sources.map((entry) => entry.kind)], [false, ['file', 'unsupported', 'directory']]);

  // A gitlink whose name is not UTF-8 is never taken for a child under a substituted name.
  const head = git(dir, 'rev-parse', 'HEAD').trim();
  const invalidLink = Buffer.concat([Buffer.from('lib/'), Buffer.from([0xfe]), Buffer.from('child')]);
  indexOnlyEntry(dir, '160000', head, invalidLink);
  assert.deepEqual(['kind', 'error', 'member'].map((key) => sourceIdentity(dir, 'lib')[key]), ['unsupported', unsupported, 'lib/\\xfechild']);

  for (const name of [invalidFile, invalidLink]) indexOnlyEntry(dir, '0', '0'.repeat(head.length), name);
  assert.equal(compareManifests(valid, sourceManifest(dir, sources)).current, true, 'removing the entries restores the complete identities');
});

test('escaped Git names stay opaque text: source, child, gitlink, workflow-source and discovery names are the same under POSIX and Win32 path semantics, and no path or filesystem function receives one', () => {
  const unsupported = 'path name is not valid UTF-8; such names are not supported';
  const dir = repository('escaped-opaque', { 'README.md': '# P\n', 'docs/a.md': 'a\n', 'lib/a.md': 'l\n', 'workflow/a.md': 'w\n' });
  const child = repository('escaped-opaque/vendor/child', { 'a.md': 'c\n' });
  const blob = git(dir, 'rev-parse', 'HEAD:README.md').trim();
  const head = git(dir, 'rev-parse', 'HEAD').trim();
  const name = (...parts) => Buffer.concat(parts.map((part) => Buffer.from(part)));
  // Index-only, so any host can hold them. Each invalid name has a literal
  // backslash, which Windows path functions would read as a separator; the
  // valid name with one is ordinary content.
  indexOnlyEntry(dir, '100644', blob, name('docs/a\\b.md'));
  indexOnlyEntry(dir, '100644', blob, name('docs/a\\b', [0xff], '.md'));
  indexOnlyEntry(dir, '160000', head, name('lib/\\', [0xfe]));
  indexOnlyEntry(dir, '100644', blob, name('workflow/caf\\', [0xff], '.md'));
  indexOnlyEntry(child, '100644', git(child, 'rev-parse', 'HEAD:a.md').trim(), name('sub\\', [0xff]));

  // An escape (`\xHH` or a doubled `\`) or a replacement character reaching a
  // host path or filesystem function would be parsed or looked up as a path.
  const escapedOrReplaced = /\\x[0-9a-f]{2}|\\\\|\uFFFD/;
  const received = [];
  const watched = [[path, ['join', 'resolve', 'relative', 'normalize', 'dirname', 'basename', 'parse', 'toNamespacedPath']],
    [fs, ['lstatSync', 'statSync', 'readFileSync', 'readdirSync', 'readlinkSync', 'existsSync']]];
  const originals = watched.map(([owner, names]) => names.map((key) => owner[key]));
  watched.forEach(([owner, names], index) => names.forEach((key, at) => {
    owner[key] = (...args) => {
      if (args.some((arg) => typeof arg === 'string' && escapedOrReplaced.test(arg))) received.push([key, ...args]);
      return originals[index][at](...args);
    };
  }));
  let docs, lib, nested, workflow, discovery;
  try {
    [docs, lib, nested] = ['docs', 'lib', 'vendor/child'].map((source) => sourceIdentity(dir, source));
    workflow = workflowSourceIdentity(dir);
    discovery = discoverCandidates(dir);
  } finally {
    watched.forEach(([owner, names], index) => names.forEach((key, at) => { owner[key] = originals[index][at]; }));
  }
  assert.deepEqual(received, [], 'escaped and replacement names are never host paths');

  const reported = [
    ['', 'docs/a\\\\b\\xff.md', docs], ['', 'lib/\\\\\\xfe', lib], ['vendor/child', 'sub\\\\\\xff', nested], ['', 'workflow/caf\\\\\\xff.md', workflow],
  ];
  for (const [owner, escaped, identity] of reported) {
    assert.deepEqual([identity.kind, identity.error, identity.message, identity.digest], ['unsupported', unsupported, unsupported, undefined]);
    for (const [platform, root] of [['posix', '/r/repo'], ['win32', 'C:\\r\\repo']]) {
      const p = platform === 'win32' ? path.win32 : path.posix;
      assert.equal(escapedMember(root, p.join(root, owner), escaped, platform), identity.member, `${platform} ${escaped}`);
    }
  }
  assert.deepEqual(reported.map(([, , identity]) => identity.member),
    ['docs/a\\\\b\\xff.md', 'lib/\\\\\\xfe', 'vendor/child/sub\\\\\\xff', 'workflow/caf\\\\\\xff.md']);
  assert.deepEqual([workflow.path, workflow.head], [dir, head], 'the workflow source keeps its actual location separately');
  assert.equal(discovery.complete, false);
  assert.deepEqual(discovery.errors, ['docs/a\\\\b\\xff.md', 'lib/\\\\\\xfe', 'workflow/caf\\\\\\xff.md']
    .map((escaped) => ({ path: dir, name: escaped, error: unsupported, message: `git ls-files listed ${escaped}: ${unsupported}` })));
  assert.ok(discovery.candidates.some((entry) => entry.path === 'docs/a\\b.md'), 'a valid name with a literal backslash is still a candidate');
});
