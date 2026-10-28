// Binding helper: the workflow source identity and the Git prerequisites and
// locale it depends on.
// Shared fixtures in ../test-support/bind.mjs give each test file its own
// temporary directory of disposable Git repositories, so the files can run
// concurrently; this checkout's project files and workflow records stay unchanged.

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import {
  checkoutFacts, compareManifests, establishLocalStorage, excludeFile, sourceIdentity, sourceManifest, workflowSourceIdentity,
} from '../lib/bind.mjs';
import {
  packageRoot, cli, scratch, GIT_ENV, git, run, repository, write, qualityFixture, indexOnlyEntry,
} from '../test-support/bind.mjs';

test('the workflow source identity names its commit, branch and uncommitted instruction changes', () => {
  const identity = workflowSourceIdentity(packageRoot);
  assert.equal(identity.path, packageRoot);
  assert.match(identity.head, /^[0-9a-f]{40,64}$/);
  assert.ok(Array.isArray(identity.dirty));
  const copy = path.join(scratch, 'copied-source');
  for (const part of ['workflow', 'defaults.yaml']) fs.cpSync(path.join(packageRoot, part), path.join(copy, part), { recursive: true });
  const copied = workflowSourceIdentity(copy);
  assert.equal(copied.head, null, 'a copied source has no commit');
  assert.equal(copied.dirty, null);
  assert.equal(copied.digestScope, 'all-files');
  assert.equal(identity.digestScope, 'git-visible');
  assert.match(copied.digest, /^sha256:/);
  assert.notEqual(copied.digest, identity.digest);
});

test('workflow source digests order by code unit, cover Git-visible files in a checkout and every file in a copy, and name exact dirty paths', () => {
  const names = ['Z.md', 'a.md', 'ä.md', '_x.md', 'b.md'];
  const copy = path.join(scratch, 'ordered-copy');
  for (const name of names) write(copy, { [`workflow/${name}`]: `${name}\n` });
  const identity = workflowSourceIdentity(copy);
  const expectedLines = [...names].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .map((name) => `workflow/${name}\0sha256:${crypto.createHash('sha256').update(`${name}\n`).digest('hex')}\n`).join('');
  assert.equal(identity.digest, `sha256:${crypto.createHash('sha256').update(expectedLines).digest('hex')}`);
  assert.equal(identity.digestScope, 'all-files');
  const script = `import('${path.join(packageRoot, 'tools', 'lib', 'bind.mjs').replaceAll('\\', '\\\\')}').then((m) => console.log(m.workflowSourceIdentity(process.argv[1]).digest))`;
  const digests = ['C', 'sv_SE.UTF-8', 'de_DE.UTF-8'].map((locale) => {
    const result = spawnSync(process.execPath, ['-e', script, copy], { encoding: 'utf8', env: { ...GIT_ENV, LC_ALL: locale, LANG: locale } });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  });
  assert.deepEqual(new Set(digests).size, 1, `the digest does not depend on the locale: ${digests.join(' ')}`);

  const source = repository('git-source', { 'workflow/a.md': 'a\n', 'README.md': '# W\n', '.gitignore': '*.junk\n' });
  const clean = workflowSourceIdentity(source);
  assert.equal(clean.digestScope, 'git-visible');
  assert.deepEqual(clean.dirty, []);
  write(source, { 'workflow/.b.junk': 'junk' });
  const withJunk = workflowSourceIdentity(source);
  assert.equal(withJunk.digest, clean.digest, 'an ignored file does not change a checkout\'s identity');
  assert.deepEqual(withJunk.dirty, []);
  write(source, { 'workflow/new.md': 'n\n' });
  const withNew = workflowSourceIdentity(source);
  assert.notEqual(withNew.digest, clean.digest, 'an untracked instruction file does');
  assert.deepEqual(withNew.dirty, ['workflow/new.md']);
  fs.rmSync(path.join(source, 'workflow', 'new.md'));
  git(source, 'mv', 'workflow/a.md', 'workflow/renamed.md');
  const renamed = workflowSourceIdentity(source);
  assert.deepEqual([...renamed.dirty].sort(), ['workflow/a.md', 'workflow/renamed.md'], 'a staged rename reports both exact paths');
  git(source, 'mv', 'workflow/renamed.md', 'workflow/a.md');

  const copied = path.join(scratch, 'git-source-copy');
  for (const part of ['workflow', 'README.md']) fs.cpSync(path.join(source, part), path.join(copied, part), { recursive: true });
  const allFiles = workflowSourceIdentity(copied);
  assert.equal(allFiles.digestScope, 'all-files');
  assert.notEqual(allFiles.digest, clean.digest, 'the copy still holds the ignored file, so its all-files digest differs');
  fs.rmSync(path.join(copied, 'workflow', '.b.junk'));
  assert.equal(workflowSourceIdentity(copied).digest, clean.digest, 'a copy of exactly the Git-visible files has the same identity');
});

test('the shared writing guide is part of the workflow identity: its edit and deletion change it in a checkout and a copy; another docs file does not', () => {
  const files = { 'workflow/a.md': 'a\n', 'docs/writing-guidance.md': '# Guide\n', 'docs/other.md': '# Other\n' };
  const target = repository('writing-guide-target', { 'README.md': '# T\n' });
  const checkout = repository('writing-guide-source', files);
  const copy = path.join(scratch, 'writing-guide-copy');
  write(copy, files);
  const baselines = [];
  for (const [scope, source] of [['git-visible', checkout], ['all-files', copy]]) {
    const recorded = sourceManifest(target, ['README.md'], { workflowSource: source });
    const baseline = recorded.workflowSource;
    baselines.push(baseline.digest);
    assert.deepEqual([baseline.digestScope, baseline.files], [scope, 2], 'the guide and the workflow file are identified');
    const check = () => {
      const current = sourceManifest(target, ['README.md'], { workflowSource: source });
      const comparison = compareManifests(recorded, current);
      return { identity: current.workflowSource, changed: comparison.workflowSourceChanged, current: comparison.current };
    };
    const dirty = (paths) => (scope === 'git-visible' ? paths : null);

    write(source, { 'docs/other.md': '# Other, edited\n' });
    const unrelated = check();
    assert.equal(unrelated.identity.digest, baseline.digest, `${scope}: another docs file is not part of the identity`);
    assert.deepEqual([unrelated.changed, unrelated.current, unrelated.identity.dirty], [false, true, dirty([])]);

    write(source, { 'docs/writing-guidance.md': '# Guide, edited\n' });
    const edited = check();
    assert.notEqual(edited.identity.digest, baseline.digest, `${scope}: editing the guide changes the identity`);
    assert.deepEqual([edited.changed, edited.current, edited.identity.dirty], [true, false, dirty(['docs/writing-guidance.md'])]);

    fs.rmSync(path.join(source, 'docs', 'writing-guidance.md'));
    const deleted = check();
    assert.ok(![baseline.digest, edited.identity.digest].includes(deleted.identity.digest), `${scope}: deleting the guide changes the identity`);
    assert.deepEqual([deleted.identity.files, deleted.changed, deleted.current, deleted.identity.dirty], [1, true, false, dirty(['docs/writing-guidance.md'])]);

    write(source, { 'docs/writing-guidance.md': '# Guide\n' });
    const restored = check();
    assert.deepEqual([restored.identity.digest, restored.changed, restored.current], [baseline.digest, false, true], `${scope}: restoring the guide restores the identity`);
  }
  assert.equal(baselines[0], baselines[1], 'the checkout and its copy of the same files share the identity');
});

test('each required record reference changes workflow identity and freshness in a checkout and a copy', () => {
  const names = ['adr-format.md', 'glossary-format.md', 'record-format-adoption.md'];
  const files = { 'workflow/a.md': 'workflow', 'docs/guidance/unrelated.md': 'other' };
  for (const name of names) files[`docs/guidance/${name}`] = `original ${name}`;
  const target = repository('record-reference-target', { 'README.md': '# Target' });
  const checkout = repository('record-reference-source', files);
  const copy = path.join(scratch, 'record-reference-copy');
  write(copy, files);
  const digests = [];
  for (const [scope, source] of [['git-visible', checkout], ['all-files', copy]]) {
    const baseline = sourceManifest(target, ['README.md'], { workflowSource: source });
    digests.push(baseline.workflowSource.digest);
    assert.equal(baseline.workflowSource.files, 4);
    const current = () => sourceManifest(target, ['README.md'], { workflowSource: source });
    write(source, { 'docs/guidance/unrelated.md': 'changed unrelated guidance' });
    assert.equal(compareManifests(baseline, current()).current, true, scope);
    for (const name of names) {
      const file = `docs/guidance/${name}`;
      write(source, { [file]: `changed ${name}` });
      const edited = current();
      assert.notEqual(edited.workflowSource.digest, baseline.workflowSource.digest, `${scope}: ${file}`);
      assert.equal(compareManifests(baseline, edited).workflowSourceChanged, true);
      assert.equal(compareManifests(baseline, edited).current, false);
      assert.deepEqual(edited.workflowSource.dirty, scope === 'git-visible' ? [file] : null);
      fs.unlinkSync(path.join(source, file));
      const removed = current();
      assert.notEqual(removed.workflowSource.digest, edited.workflowSource.digest);
      assert.equal(removed.workflowSource.files, 3);
      assert.equal(compareManifests(baseline, removed).current, false);
      assert.deepEqual(removed.workflowSource.dirty, scope === 'git-visible' ? [file] : null);
      write(source, { [file]: files[file] });
      assert.equal(compareManifests(baseline, current()).current, true);
    }
  }
  assert.equal(digests[0], digests[1], 'the same visible content has the same digest');
});

test('Git administrative file and directory entries never affect all-files or workflow-source content identities', () => {
  const dir = repository('admin-content', { 'README.md': '# P\n' });
  establishLocalStorage(dir);
  const personal = path.join(dir, '.peer-skills-and-workflows', 'personal');
  const outside = path.join(scratch, 'admin-outside');
  for (const root of [personal, outside]) {
    write(root, { 'policy.md': 'policy', '.git/config': 'admin', 'nested/.git': 'gitdir: elsewhere\n', 'nested/guide.md': 'guide' });
    const first = sourceIdentity(dir, root);
    write(root, { '.git/config': 'changed admin', 'nested/.git': 'changed pointer' });
    assert.equal(sourceIdentity(dir, root).digest, first.digest);
    write(root, { 'policy.md': 'changed policy' });
    assert.notEqual(sourceIdentity(dir, root).digest, first.digest);
    assert.equal(sourceIdentity(dir, path.join(root, '.git')).kind, 'excluded');
  }
  const copied = path.join(scratch, 'admin-workflow-copy');
  write(copied, { 'README.md': 'readme', 'tools/a.mjs': 'a', 'tools/.git/config': 'admin', 'skills/nested/.git': 'pointer' });
  const first = workflowSourceIdentity(copied);
  write(copied, { 'tools/.git/config': 'changed', 'skills/nested/.git': 'changed' });
  assert.equal(workflowSourceIdentity(copied).digest, first.digest);
  write(copied, { 'tools/a.mjs': 'changed' });
  assert.notEqual(workflowSourceIdentity(copied).digest, first.digest);
  const visible = workflowSourceIdentity(dir);
  fs.appendFileSync(path.join(dir, '.git', 'info', 'exclude'), '# administrative neighbor\n');
  assert.equal(workflowSourceIdentity(dir).digest, visible.digest);
  write(dir, { 'README.md': 'changed' });
  assert.notEqual(workflowSourceIdentity(dir).digest, visible.digest);
});

test('file aliases cannot reintroduce Git administrative content into directory or workflow hashes; ordinary aliases still detect edits', () => {
  const dir = repository('admin-file-alias', { 'README.md': 'readme', 'ordinary.md': 'ordinary before', 'tools/plain.mjs': 'plain' });
  const administrative = path.join(dir, '.git', 'alias-content');
  fs.writeFileSync(administrative, 'admin before');
  fs.symlinkSync('../.git/alias-content', path.join(dir, 'tools', 'administrative-alias'));
  fs.symlinkSync('../ordinary.md', path.join(dir, 'tools', 'ordinary-alias'));
  git(dir, 'add', 'tools');
  const copy = path.join(scratch, 'admin-top-level-alias-copy');
  fs.mkdirSync(copy);
  fs.symlinkSync(administrative, path.join(copy, 'README.md'));
  fs.symlinkSync(path.join(dir, 'ordinary.md'), path.join(copy, 'defaults.yaml'));
  const identities = () => [sourceIdentity(dir, 'tools'), workflowSourceIdentity(dir), workflowSourceIdentity(copy)];
  const before = identities();
  assert.equal(before[0].files, 2, 'the administrative alias is excluded from directory members');
  assert.equal(before[2].files, 1, 'the copied workflow counts only content actually hashed');
  const direct = sourceIdentity(dir, 'tools/administrative-alias');
  assert.equal(direct.kind, 'excluded');
  assert.equal(direct.link.target, '../.git/alias-content');
  fs.writeFileSync(administrative, 'admin after');
  const adminChanged = identities();
  for (let i = 0; i < before.length; i++) assert.equal(adminChanged[i].digest, before[i].digest, `administrative mutation has no effect: shape ${i}`);
  write(dir, { 'ordinary.md': 'ordinary after' });
  const ordinaryChanged = identities();
  for (let i = 0; i < before.length; i++) assert.notEqual(ordinaryChanged[i].digest, adminChanged[i].digest, `ordinary aliased content still participates: shape ${i}`);
  assert.equal(sourceIdentity(dir, 'tools/ordinary-alias').kind, 'file');
});

for (const form of ['git', 'copied']) {
  for (const deniedKind of ['subtree', 'file']) {
    test(`workflow access failure preserves partial facts and never becomes current: ${form} ${deniedKind}`, (t) => {
      if (process.platform === 'win32' || process.getuid?.() === 0) { t.skip('needs POSIX permissions enforced'); return; }
      const dir = repository(`workflow-target-${form}-${deniedKind}`, qualityFixture);
      establishLocalStorage(dir);
      const source = path.join(scratch, `workflow-${form}-${deniedKind}`);
      fs.mkdirSync(source);
      fs.cpSync(path.join(packageRoot, 'tools'), path.join(source, 'tools'), { recursive: true });
      // Copied tools need their runtime dependencies, as in an npm-prepared
      // distribution. Copy them so the fixture never links back to the source.
      write(source, { 'workflow/private/member.md': 'before', 'README.md': 'source', '.gitignore': '*.junk\nnode_modules/\n' });
      if (form === 'git') {
        git(source, 'init', '-q', '-b', 'main');
        git(source, 'add', '-A');
        git(source, 'commit', '-q', '-m', 'initial');
      }
      const call = (...args) => {
        const result = spawnSync(process.execPath, [path.join(source, 'tools', 'bind.mjs'), ...args], { encoding: 'utf8', env: GIT_ENV });
        return { ...result, json: JSON.parse(result.stdout) };
      };
      const manifestPath = path.join(dir, '.peer-skills-and-workflows', 'binding-sources.json');
      const baseline = call('sources', '--repo', dir, '--out', manifestPath, 'README.md');
      assert.equal(baseline.status, 0, baseline.stderr);
      const denied = path.join(source, 'workflow', 'private', ...(deniedKind === 'file' ? ['member.md'] : []));
      const member = path.join(source, 'workflow', 'private', 'member.md');
      const restore = () => fs.chmodSync(denied, deniedKind === 'file' ? 0o644 : 0o755);
      fs.chmodSync(denied, 0);
      try {
        const failed = call('sources', '--repo', dir, '--compare', manifestPath, '--out', manifestPath, 'README.md');
        assert.equal(failed.status, 1, failed.stderr);
        assert.equal(failed.json.complete, false);
        assert.equal(failed.json.workflowSource.kind, 'unreadable');
        assert.equal(failed.json.workflowSource.error, 'EACCES');
        assert.ok(failed.json.workflowSource.message);
        assert.match(failed.json.workflowSource.member, /^workflow\/private/);
        assert.equal(failed.json.workflowSource.digest, undefined);
        assert.deepEqual(failed.json.sources, baseline.json.sources);
        assert.equal(failed.json.comparison.current, false);
        restore();
        fs.writeFileSync(member, 'hidden edit');
        fs.chmodSync(denied, 0);
        const inspected = call('inspect', '--repo', dir);
        assert.equal(inspected.status, 1, inspected.stderr);
        assert.equal(inspected.json.workflowSource.kind, 'unreadable');
        assert.equal(inspected.json.binding.manifest.usable, false, 'a persisted workflow failure has no evaluable computation identity');
        assert.equal(inspected.json.binding.comparison.current, false);
        assert.match(inspected.json.binding.manifest.reason, /workflowSource.*computation identity/);
        assert.equal(inspected.json.quality.present, true);
        assert.equal(inspected.json.localStorage.ignored, true);
        assert.ok(inspected.json.candidates.some((entry) => entry.path === 'README.md'));
      } finally { restore(); }
      const repaired = call('inspect', '--repo', dir);
      assert.equal(repaired.status, 0, 'the current workflow is readable; the unusable persisted baseline still requires refresh');
      assert.equal(repaired.json.binding.manifest.usable, false);
      assert.equal(repaired.json.binding.comparison.current, false);
      fs.writeFileSync(manifestPath, JSON.stringify(baseline.json));
      fs.unlinkSync(member);
      const deletion = call('inspect', '--repo', dir);
      assert.equal(deletion.status, 0, deletion.stderr);
      assert.equal(deletion.json.binding.comparison.complete, true);
      assert.equal(deletion.json.binding.comparison.workflowSourceChanged, true);
      assert.equal(deletion.json.binding.comparison.current, false);
    });
  }
}

test('unrelated workflow read failures are not converted to partial content-access diagnoses', (t) => {
  const copy = path.join(scratch, 'workflow-programming-error');
  write(copy, { 'README.md': 'source' });
  const read = fs.readFileSync;
  t.mock.method(fs, 'readFileSync', (file, ...args) => {
    if (String(file) === path.join(copy, 'README.md')) throw new Error('unrelated implementation failure');
    return read(file, ...args);
  });
  assert.throws(() => workflowSourceIdentity(copy), /unrelated implementation failure/);
});

test('Git path-format capability is validated before checkout identity; unrelated failures and non-repositories keep their own diagnosis', () => {
  const dir = repository('git-capability', { 'README.md': 'readable', 'workflow/a.md': 'guide' });
  const plain = path.join(scratch, 'git-capability-plain');
  fs.mkdirSync(plain);
  const script = path.join(scratch, 'git-capability-control.mjs');
  // Deterministic substitutes for an older Git, which echoes or rejects the
  // option, and for an unrelated failure. Every other call reaches real Git.
  fs.writeFileSync(script, `
    import assert from 'node:assert/strict';
    import cp from 'node:child_process';
    import { syncBuiltinESMExports } from 'node:module';
    const native = cp.spawnSync;
    let mode = 'native';
    cp.spawnSync = (command, args, options) => {
      if (command === 'git' && mode !== 'native' && args[0] === 'rev-parse' && args.includes('--path-format=absolute')) {
        if (mode === 'echo') {
          const rest = native(command, args.filter((arg) => arg !== '--path-format=absolute'), options);
          return { ...rest, stdout: '--path-format=absolute\\n' + rest.stdout };
        }
        if (mode === 'reject') return { status: 129, signal: null, stdout: '', stderr: "error: unknown option \\\`path-format=absolute'\\nusage: git rev-parse --parseopt [<options>] -- [<args>...]\\n" };
        return { status: 128, signal: null, stdout: '', stderr: 'fatal: unrelated repository failure\\n' };
      }
      return native(command, args, options);
    };
    syncBuiltinESMExports();
    const { checkoutFacts, excludeFile, workflowSourceIdentity } = await import(${JSON.stringify(new URL('../lib/bind.mjs', import.meta.url).href)});
    const dir = ${JSON.stringify(dir)};
    const valid = checkoutFacts(dir);
    assert.equal(valid.checkout, dir);
    assert.equal(excludeFile(dir), valid.commonDir + '/info/exclude');
    assert.throws(() => checkoutFacts(${JSON.stringify(plain)}), /is not inside a Git working tree \\(git rev-parse failed: fatal: not a git repository/);
    assert.throws(() => checkoutFacts(valid.gitDir), /is not inside a Git working tree \\(git rev-parse failed: fatal: this operation must be run in a work tree/);
    const unsupported = /^the workflow tools require Git 2\\.31 or later: git version .+ does not support 'rev-parse --path-format=absolute' \\(/;
    for (mode of ['echo', 'reject']) {
      for (const call of [() => checkoutFacts(dir), () => excludeFile(dir), () => workflowSourceIdentity(dir)]) {
        assert.throws(call, (error) => error.name === 'UnsupportedGitError' && unsupported.test(error.message) && !/working tree/.test(error.message), mode);
      }
    }
    mode = 'unrelated';
    assert.throws(() => checkoutFacts(dir), (error) => error.message === 'git rev-parse failed: fatal: unrelated repository failure');
    assert.throws(() => workflowSourceIdentity(dir), /unrelated repository failure/);
  `);
  const result = spawnSync(process.execPath, [script], { encoding: 'utf8', env: GIT_ENV });
  assert.equal(result.status, 0, result.stderr);
  const observer = path.join(scratch, 'git-capability-cli.mjs');
  fs.writeFileSync(observer, `import cp from 'node:child_process';
    import { syncBuiltinESMExports } from 'node:module';
    const native = cp.spawnSync;
    cp.spawnSync = (command, args, options) => {
      if (command !== 'git' || args[0] !== 'rev-parse' || !args.includes('--path-format=absolute')) return native(command, args, options);
      const rest = native(command, args.filter((arg) => arg !== '--path-format=absolute'), options);
      return { ...rest, stdout: '--path-format=absolute\\n' + rest.stdout };
    };
    syncBuiltinESMExports();`);
  const cliResult = spawnSync(process.execPath, ['--import', observer, cli, 'inspect', '--repo', dir], { encoding: 'utf8', env: GIT_ENV });
  assert.equal(cliResult.status, 1);
  assert.equal(cliResult.stdout, '');
  assert.match(cliResult.stderr, /^bind: the workflow tools require Git 2\.31 or later: git version .+ does not support 'rev-parse --path-format=absolute' \(git rev-parse echoed/);
});

test('Git message locale pin admits copied sources in a non-English environment and preserves unrelated failures', () => {
  const dir = repository('locale-checkout', { 'workflow/a.md': 'guide', '.gitignore': '*.junk\n' });
  const copy = path.join(scratch, 'locale-copy');
  write(copy, { 'workflow/a.md': 'guide' });
  write(dir, { 'workflow/ignored.junk': 'ignored' });
  const script = path.join(scratch, 'locale-control.mjs');
  // Deterministic message-boundary substitute, not a native localized-host claim.
  // It honors the actual spawn environment and delegates pinned calls to real Git.
  fs.writeFileSync(script, `
    import assert from 'node:assert/strict';
    import cp from 'node:child_process';
    import { syncBuiltinESMExports } from 'node:module';
    const native = cp.spawnSync;
    const seen = [];
    let unrelated = false;
    cp.spawnSync = (command, args, options = {}) => {
      if (command === 'git') {
        const locale = (options.env ?? process.env).LC_ALL;
        seen.push(locale);
        if (options.cwd === ${JSON.stringify(copy)} && args.includes('--show-toplevel')) {
          if (unrelated) return { status: 128, stdout: '', stderr: 'fatal: unrelated repository access failure' };
          if (locale !== 'C') return { status: 128, stdout: '', stderr: 'fatal: Kein Git-Repository' };
        }
      }
      return native(command, args, options);
    };
    syncBuiltinESMExports();
    const unpinned = cp.spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd: ${JSON.stringify(copy)}, encoding: 'utf8' });
    assert.equal(unpinned.status, 128);
    assert.match(unpinned.stderr, /Kein Git-Repository/);
    seen.length = 0;
    const { workflowSourceIdentity } = await import(${JSON.stringify(new URL('../lib/bind.mjs', import.meta.url).href)});
    const checkout = workflowSourceIdentity(${JSON.stringify(dir)});
    const copied = workflowSourceIdentity(${JSON.stringify(copy)});
    assert.equal(checkout.digestScope, 'git-visible');
    assert.equal(copied.digestScope, 'all-files');
    assert.equal(checkout.digest, copied.digest);
    assert.ok(seen.length > 0);
    assert.ok(seen.every(locale => locale === 'C'), JSON.stringify(seen));
    assert.equal(process.env.LC_ALL, 'de_DE.UTF-8', 'the parent environment stays unchanged');
    unrelated = true;
    assert.throws(() => workflowSourceIdentity(${JSON.stringify(copy)}), /unrelated repository access failure/);
    console.log(JSON.stringify({ unpinned: unpinned.stderr, checkout, copied, spawnedLocales: seen, parentLocale: process.env.LC_ALL, unrelatedFailure: 'refused' }));
  `);
  const result = spawnSync(process.execPath, [script], { encoding: 'utf8', env: { ...GIT_ENV, LANG: 'de_DE.UTF-8', LC_ALL: 'de_DE.UTF-8' } });
  assert.equal(result.status, 0, result.stderr);
});

test('a Git path name that is not UTF-8 in the workflow source makes its identity unsupported and the comparison incomplete', () => {
  const unsupported = 'path name is not valid UTF-8; such names are not supported';
  const source = repository('invalid-workflow-name', { 'workflow/a.md': 'a\n', 'workflow/caf\uFFFD.md': 'replacement\n' });
  const target = repository('invalid-workflow-target', { 'README.md': '# T\n' });
  const recorded = sourceManifest(target, ['README.md'], { workflowSource: source });
  assert.deepEqual([recorded.complete, recorded.workflowSource.files], [true, 2], 'a literal U+FFFD name is ordinary content');

  const invalid = Buffer.concat([Buffer.from('workflow/caf'), Buffer.from([0xff]), Buffer.from('.md')]);
  indexOnlyEntry(source, '100644', git(source, 'rev-parse', 'HEAD:workflow/a.md').trim(), invalid);
  const current = sourceManifest(target, ['README.md'], { workflowSource: source });
  const identity = current.workflowSource;
  assert.deepEqual([identity.kind, identity.error, identity.member, identity.digest, identity.digestScope], ['unsupported', unsupported, 'workflow/caf\\xff.md', undefined, 'git-visible']);
  assert.deepEqual([identity.path, identity.head, identity.branch], [recorded.workflowSource.path, recorded.workflowSource.head, recorded.workflowSource.branch], 'independent facts survive');
  const comparison = compareManifests(recorded, current);
  assert.deepEqual([current.complete, comparison.complete, comparison.current, comparison.unchanged], [false, false, false, ['README.md']]);

  const head = git(source, 'rev-parse', 'HEAD').trim();
  indexOnlyEntry(source, '0', '0'.repeat(head.length), invalid);
  assert.equal(compareManifests(recorded, sourceManifest(target, ['README.md'], { workflowSource: source })).current, true, 'removing the entry restores the identity');
});
