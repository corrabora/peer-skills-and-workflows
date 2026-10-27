// Binding helper: persisted source manifests and their comparison.
// Shared fixtures in ../test-support/bind.mjs give each test file its own
// temporary directory of disposable Git repositories, so the files can run
// concurrently; this checkout's project files and workflow records stay unchanged.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import {
  compareManifests, establishLocalStorage, MANIFEST_FORMAT, MANIFEST_VERSION, manifestProblem, readManifest, sourceIdentity, sourceManifest,
} from '../lib/bind.mjs';
import {
  packageRoot, scratch, scratchFoldsCase, git, run, repository, write, qualityFixture,
} from '../test-support/bind.mjs';

test('the sources command writes a manifest and compares it on the next run; inspect reports the comparison', () => {
  const dir = repository('manifest', { 'README.md': '# P\n', 'docs/g.md': 'g\n' });
  establishLocalStorage(dir);
  const out = path.join(dir, '.agent-workflow', 'binding-sources.json');
  const first = run('sources', '--repo', dir, '--out', out, 'README.md', 'docs');
  assert.equal(first.status, 0, first.stderr);
  assert.equal(first.json.written, out);
  assert.ok(fs.existsSync(out));
  assert.equal(git(dir, 'status', '--porcelain'), '', 'the manifest lives in ignored local storage');

  write(dir, { 'docs/g.md': 'g changed\n' });
  const second = run('sources', '--repo', dir, '--compare', out, 'README.md', 'docs');
  assert.equal(second.status, 0, second.stderr);
  assert.deepEqual(second.json.comparison.changed, ['docs']);
  assert.equal(second.json.comparison.current, false);
  assert.equal(fs.existsSync(path.join(dir, '.agent-workflow', 'binding.md')), false, 'sources writes only the manifest');

  const inspected = run('inspect', '--repo', dir);
  assert.equal(inspected.json.binding.sourcesPresent, true);
  assert.deepEqual(inspected.json.binding.manifest, { path: out, usable: true, format: MANIFEST_FORMAT, version: MANIFEST_VERSION });
  assert.equal(inspected.json.binding.comparison.usable, true);
  assert.equal(inspected.json.binding.comparison.scope, 'recorded', 'inspect compares the recorded sources only');
  assert.deepEqual(inspected.json.binding.comparison.changed, ['docs']);
  assert.equal(inspected.json.binding.recordedHead, git(dir, 'rev-parse', 'HEAD').trim());
  assert.equal(inspected.json.localStorage.rulePresent, true);
});

test('additions invalidate an explicit comparison; inspect states its recorded-source scope', () => {
  const dir = repository('additions', { 'README.md': '# P\n', 'docs/g.md': 'g\n' });
  establishLocalStorage(dir);
  const out = path.join(dir, '.agent-workflow', 'binding-sources.json');
  assert.equal(run('sources', '--repo', dir, '--out', out, 'README.md').status, 0);
  write(dir, { 'docs/SECURITY.md': '# S\n' });
  const wider = run('sources', '--repo', dir, '--compare', out, 'README.md', 'docs');
  assert.equal(wider.json.comparison.usable, true);
  assert.equal(wider.json.comparison.scope, 'listed');
  assert.deepEqual(wider.json.comparison.added, ['docs']);
  assert.deepEqual(wider.json.comparison.changed, []);
  assert.equal(wider.json.comparison.current, false, 'an addition alone makes the comparison not current');
  const inspected = run('inspect', '--repo', dir);
  assert.equal(inspected.json.binding.comparison.scope, 'recorded');
  assert.equal(inspected.json.binding.comparison.current, true, `recorded sources are unchanged; comparison: ${JSON.stringify(inspected.json.binding.comparison)}`);
  assert.deepEqual(inspected.json.binding.comparison.added, []);
  assert.ok(inspected.json.candidates.some((c) => c.path === 'docs/SECURITY.md' && !c.tracked), 'the new guidance is a discovered candidate, not a comparison result');
});

test('manifests carry a format and version; unusable ones are reported with path and reason, never thrown, and rebuilt safely', () => {
  const dir = repository('manifests', { 'README.md': '# P\n' });
  establishLocalStorage(dir);
  const local = path.join(dir, '.agent-workflow');
  const manifestPath = path.join(local, 'binding-sources.json');
  const binding = '# Local binding\n\n## Operator choices\n\n- "Always keep documentation findings in set D." (operator, today)\n';
  fs.writeFileSync(path.join(local, 'binding.md'), binding);
  const cases = [
    ['{not json', /^invalid JSON: /],
    [JSON.stringify({ checkout: dir, sources: [{ path: 'README.md', kind: 'file' }] }), /^unsupported format: no format marker$/],
    [JSON.stringify({ format: 'something-else', version: 1, sources: [] }), /^unsupported format: "something-else"$/],
    [JSON.stringify({ format: MANIFEST_FORMAT, version: 2, sources: [] }), /^unsupported version: 2 /],
    [JSON.stringify({ format: MANIFEST_FORMAT, version: 1, sources: 'README.md' }), /^invalid structure: sources is not an array$/],
    [JSON.stringify({ format: MANIFEST_FORMAT, version: 1, sources: [{ kind: 'file' }] }), /^invalid structure: sources\[0\] has no path$/],
    ['[]', /^not a JSON object$/],
  ];
  for (const [text, reason] of cases) {
    fs.writeFileSync(manifestPath, text);
    const read = readManifest(manifestPath);
    assert.equal(read.error.path, manifestPath);
    assert.match(read.error.reason, reason);
    const inspected = run('inspect', '--repo', dir);
    assert.equal(inspected.status, 0, inspected.stderr);
    assert.equal(inspected.stderr, '', 'reported in JSON, not thrown');
    assert.equal(inspected.json.binding.present, true);
    assert.equal(inspected.json.binding.sourcesPresent, true);
    assert.equal(inspected.json.binding.manifest.usable, false);
    assert.match(inspected.json.binding.manifest.reason, reason);
    assert.deepEqual([inspected.json.binding.comparison.usable, inspected.json.binding.comparison.current], [false, false], 'an unusable manifest is never current');
    assert.equal(inspected.json.binding.comparison.path, manifestPath);
    const compared = run('sources', '--repo', dir, '--compare', manifestPath, 'README.md');
    assert.equal(compared.status, 0, compared.stderr);
    assert.deepEqual([compared.json.comparison.usable, compared.json.comparison.current], [false, false]);
    assert.match(compared.json.comparison.reason, reason);
  }
  assert.equal(readManifest(path.join(local, 'none.json')).error.reason, 'absent');
  assert.equal(manifestProblem({ format: MANIFEST_FORMAT, version: 1, sources: [{ path: 'a', kind: 'file', extra: 1 }], extra: true }), null, 'additive fields are ignored');

  const rebuilt = run('sources', '--repo', dir, '--out', manifestPath, 'README.md');
  assert.equal(rebuilt.status, 0, rebuilt.stderr);
  assert.equal(readManifest(manifestPath).manifest.version, MANIFEST_VERSION);
  assert.equal(fs.readFileSync(path.join(local, 'binding.md'), 'utf8'), binding, 'rebuilding the factual manifest leaves the operator\'s binding alone');
  const inspected = run('inspect', '--repo', dir);
  assert.equal(inspected.json.binding.manifest.usable, true);
  assert.equal(inspected.json.binding.comparison.current, true, `comparison: ${JSON.stringify(inspected.json.binding.comparison)}`);
});

/** `bytes` with every occurrence of `from` replaced by `to`; `from` must occur. */
function replaceBytes(bytes, from, to) {
  const parts = [];
  let start = 0;
  for (let at = bytes.indexOf(from); at !== -1; at = bytes.indexOf(from, start)) {
    parts.push(bytes.subarray(start, at), to);
    start = at + from.length;
  }
  assert.ok(parts.length, 'the generated record holds the replaced sequence');
  return Buffer.concat([...parts, bytes.subarray(start)]);
}

test('persisted manifests are decoded strictly at both comparison entry points: malformed UTF-8 and unpaired surrogates are unusable, valid Unicode stays current', () => {
  const replacement = 'r\u{FFFD}.md';
  const supplementary = 'g\u{1D11E}.md';
  const sources = ['README.md', replacement, supplementary];
  const dir = repository('manifest-decoding', { 'README.md': '# P\n', [replacement]: 'r\n', [supplementary]: 'g\n' });
  establishLocalStorage(dir);
  const file = path.join(dir, '.agent-workflow', 'binding-sources.json');
  assert.equal(run('sources', '--repo', dir, '--out', file, ...sources).status, 0);
  const valid = fs.readFileSync(file);
  assert.equal(valid[0], 0x7b, 'the generated record is one JSON object');
  const utf8 = (text) => Buffer.from(text, 'utf8');
  const observe = (bytes) => {
    fs.writeFileSync(file, bytes);
    const inspected = run('inspect', '--repo', dir);
    const compared = run('sources', '--repo', dir, '--compare', file, ...sources);
    for (const result of [inspected, compared]) {
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stderr, '', 'reported in JSON, not thrown');
    }
    assert.deepEqual(fs.readFileSync(file), bytes, 'readers do not repair persisted input');
    return { read: readManifest(file), manifest: inspected.json.binding.manifest, inspected: inspected.json.binding.comparison, compared: compared.json.comparison };
  };

  for (const [label, bytes] of [
    ['literal U+FFFD and a raw supplementary character', valid],
    ['an escaped surrogate pair', replaceBytes(valid, utf8('\u{1D11E}'), utf8('\\ud834\\udd1e'))],
    ['an escaped U+FFFD', replaceBytes(valid, utf8('\u{FFFD}'), utf8('\\ufffd'))],
  ]) {
    const { read, manifest, inspected, compared } = observe(bytes);
    assert.ok(read.manifest, label);
    assert.equal(manifest.usable, true, label);
    assert.deepEqual([inspected.usable, inspected.current], [true, true], `${label}; comparison: ${JSON.stringify(inspected)}`);
    assert.deepEqual([compared.usable, compared.current], [true, true], `${label}; comparison: ${JSON.stringify(compared)}`);
  }

  const unusable = [
    ['a byte that is never UTF-8 in place of U+FFFD', replaceBytes(valid, utf8('\u{FFFD}'), Buffer.from([0xff])), 'invalid JSON: not UTF-8'],
    ['a truncated four-byte sequence', replaceBytes(valid, utf8('\u{1D11E}'), Buffer.from([0xf0, 0x9d, 0x84])), 'invalid JSON: not UTF-8'],
    ['an unpaired high surrogate escape in a recorded path', replaceBytes(valid, utf8('\u{1D11E}'), utf8('\\ud834')), 'invalid JSON: unpaired surrogate'],
    ['an unpaired low surrogate escape in an additive field', Buffer.concat([utf8('{"note":"\\udd1e",'), valid.subarray(1)]), 'invalid JSON: unpaired surrogate'],
  ];
  for (const [label, bytes, reason] of unusable) {
    const { read, manifest, inspected, compared } = observe(bytes);
    assert.deepEqual(read, { error: { path: file, reason } }, label);
    assert.deepEqual([manifest.usable, manifest.reason], [false, reason], label);
    assert.deepEqual([inspected.usable, inspected.current, inspected.path, inspected.reason], [false, false, file, reason], label);
    assert.deepEqual([compared.usable, compared.current, compared.path, compared.reason], [false, false, file, reason], label);
  }

  const bom = observe(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), valid]));
  for (const reason of [bom.read.error.reason, bom.manifest.reason, bom.inspected.reason, bom.compared.reason]) {
    assert.match(reason, /^invalid JSON: /, 'a byte order mark is kept and does not parse');
    assert.doesNotMatch(reason, /not UTF-8|unpaired surrogate/);
  }
  assert.deepEqual([bom.manifest.usable, bom.inspected.current, bom.compared.usable, bom.compared.current], [false, false, false, false]);

  fs.writeFileSync(file, unusable[0][1]);
  assert.equal(run('sources', '--repo', dir, '--out', file, ...sources).status, 0);
  assert.ok(fs.readFileSync(file).includes(utf8('\u{FFFD}')), 'the factual rebuild records the actual name');
  const rebuilt = run('inspect', '--repo', dir).json.binding.comparison;
  assert.equal(rebuilt.current, true, `the factual rebuild restores a usable, current record; comparison: ${JSON.stringify(rebuilt)}`);
});

test('deeply nested additive values do not exhaust the strict decoder at either comparison entry point: valid ones stay current, a deep unpaired surrogate keeps its fixed cause', () => {
  const dir = repository('manifest-deep-additive', { 'README.md': '# P\n' });
  establishLocalStorage(dir);
  const file = path.join(dir, '.agent-workflow', 'binding-sources.json');
  assert.equal(run('sources', '--repo', dir, '--out', file, 'README.md').status, 0);
  const valid = fs.readFileSync(file, 'utf8').trimEnd();
  assert.ok(valid.endsWith('}'), 'the generated record is one JSON object');
  // 10,000 levels, alternating object members and arrays, so member names and values are both nested.
  const pairs = 5000;
  const deep = (inner) => Buffer.from(`${valid.slice(0, -1)},"additive":${'{"level":['.repeat(pairs)}${inner}${']}'.repeat(pairs)}}\n`, 'utf8');
  const observe = (bytes) => {
    fs.writeFileSync(file, bytes);
    const inspected = run('inspect', '--repo', dir);
    const compared = run('sources', '--repo', dir, '--compare', file, 'README.md');
    for (const result of [inspected, compared]) {
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stderr, '', 'reported in JSON, not thrown');
    }
    assert.deepEqual(fs.readFileSync(file), bytes, 'readers do not repair persisted input');
    return { read: readManifest(file), manifest: inspected.json.binding.manifest, inspected: inspected.json.binding.comparison, compared: compared.json.comparison };
  };

  const accepted = observe(deep('"valid \\ud834\\udd1e"'));
  assert.equal(accepted.read.error, undefined);
  let value = accepted.read.manifest.additive;
  for (let level = 0; level < pairs; level++) value = value.level[0];
  assert.equal(value, 'valid \u{1D11E}', 'the deepest value is read as written');
  assert.equal(accepted.manifest.usable, true);
  assert.deepEqual([accepted.inspected.usable, accepted.inspected.current], [true, true], `comparison: ${JSON.stringify(accepted.inspected)}`);
  assert.deepEqual([accepted.compared.usable, accepted.compared.current], [true, true], `comparison: ${JSON.stringify(accepted.compared)}`);

  const reason = 'invalid JSON: unpaired surrogate';
  const refused = observe(deep('"\\ud834"'));
  assert.deepEqual(refused.read, { error: { path: file, reason } });
  assert.deepEqual([refused.manifest.usable, refused.manifest.reason], [false, reason]);
  assert.deepEqual([refused.inspected.usable, refused.inspected.current, refused.inspected.reason], [false, false, reason]);
  assert.deepEqual([refused.compared.usable, refused.compared.current, refused.compared.reason], [false, false, reason]);
});

test('a link loop among recorded sources is that entry\'s unreadable result; readable neighbors and the other facts are still reported', () => {
  const dir = repository('loops', { 'README.md': '# P\n', 'docs/a.md': 'a\n' });
  fs.symlinkSync('loop.md', path.join(dir, 'loop.md'));
  fs.mkdirSync(path.join(dir, 'ring'));
  fs.symlinkSync('../ring', path.join(dir, 'ring', 'self'), 'dir');
  const leaf = sourceIdentity(dir, 'loop.md');
  assert.deepEqual([leaf.path, leaf.kind, leaf.error], ['loop.md', 'unreadable', 'ELOOP']);
  assert.deepEqual(leaf.link, { target: 'loop.md' }, 'the link metadata is kept');
  const ancestor = sourceIdentity(dir, 'ring/self/self/self/self/self/self/self/self/self/self/self/self/self/self/self/self/self/self/self/self/self/self/self/self/self/self/self/self/self/self/self/self/self/self/self/self/self/self/self/self/self/self/x.md');
  assert.deepEqual([ancestor.kind, ancestor.error], ['unreadable', 'ELOOP'], 'a loop among ancestors is reported the same way');
  const outsideParent = path.join(scratch, 'loop-parent');
  fs.symlinkSync('loop-parent', outsideParent, 'dir');
  const external = sourceIdentity(dir, path.join(outsideParent, 'policy.md'));
  assert.deepEqual([external.scope, external.kind, external.error], ['external', 'unreadable', 'ELOOP'], 'an external path whose ancestors loop');

  establishLocalStorage(dir);
  const out = path.join(dir, '.agent-workflow', 'binding-sources.json');
  const recorded = run('sources', '--repo', dir, '--out', out, 'README.md', 'loop.md', 'docs');
  assert.equal(recorded.status, 1, recorded.stderr);
  assert.deepEqual(recorded.json.sources.map((s) => [s.path, s.kind]), [['README.md', 'file'], ['loop.md', 'unreadable'], ['docs', 'directory']]);
  const inspected = run('inspect', '--repo', dir);
  assert.equal(inspected.status, 1, inspected.stderr);
  assert.equal(inspected.stderr, '', 'inspect returns useful partial JSON');
  assert.equal(inspected.json.binding.comparison.usable, true);
  assert.deepEqual(inspected.json.binding.comparison.unchanged, ['README.md', 'docs']);
  assert.equal(inspected.json.binding.comparison.current, false, 'repeated unreadability cannot establish currentness');
  assert.equal(inspected.json.binding.comparison.complete, false);
  assert.equal(inspected.json.quality.present, false);
  assert.ok(inspected.json.candidates.some((c) => c.path === 'README.md'), 'the other facts are reported');
  assert.equal(git(dir, 'status', '--porcelain', '--untracked-files=no'), '', 'nothing tracked changed; the loops themselves stay untracked fixtures');
});

test('duplicate lookup keys make a manifest unusable in either order; distinct aliases and additive fields are accepted', () => {
  const dir = repository('duplicates', { 'README.md': '# P\n', 'docs/a.md': 'a\n' });
  fs.symlinkSync('docs', path.join(dir, 'guides'), 'dir');
  establishLocalStorage(dir);
  const manifestPath = path.join(dir, '.agent-workflow', 'binding-sources.json');
  const current = sourceManifest(dir, ['README.md', 'docs', 'guides'], { workflowSource: packageRoot });
  const stale = { ...current.sources[0], blob: 'stale' };
  for (const [order, label] of [[[stale, current.sources[0]], 'stale first'], [[current.sources[0], stale], 'stale last']]) {
    const data = { ...current, sources: [...order, current.sources[1]] };
    assert.equal(manifestProblem(data), 'invalid structure: duplicate path "README.md" (sources[0] and sources[1])', label);
    fs.writeFileSync(manifestPath, JSON.stringify(data));
    const read = readManifest(manifestPath);
    assert.match(read.error.reason, /^invalid structure: duplicate path "README\.md"/, label);
    const inspected = run('inspect', '--repo', dir);
    assert.equal(inspected.status, 0, inspected.stderr);
    assert.deepEqual([inspected.json.binding.manifest.usable, inspected.json.binding.comparison.usable, inspected.json.binding.comparison.current], [false, false, false], `${label}: never compared, never current`);
    const compared = run('sources', '--repo', dir, '--compare', manifestPath, 'README.md', 'docs');
    assert.deepEqual([compared.json.comparison.usable, compared.json.comparison.current], [false, false], label);
    assert.match(compared.json.comparison.reason, /duplicate path/);
  }
  const spelled = { ...current, sources: [{ path: 'docs', kind: 'directory' }, { path: './docs/', kind: 'directory' }] };
  assert.equal(manifestProblem(spelled), 'invalid structure: duplicate path "./docs/" (sources[0] and sources[1])', 'spellings of one lookup path are one key');
  assert.equal(manifestProblem(current), null, 'docs beside its alias guides is not a duplicate');
  assert.equal(manifestProblem({ ...current, extra: 1, sources: current.sources.map((s) => ({ ...s, extra: true })) }), null, 'additive fields are still ignored');
  fs.writeFileSync(manifestPath, `${JSON.stringify(current)}\n`);
  const accepted = run('inspect', '--repo', dir).json.binding.comparison;
  assert.equal(accepted.current, true, `comparison: ${JSON.stringify(accepted)}`);
});

test('repository facts are guarded at both manifest locations without modifying additive input', () => {
  const dir = repository('repository-facts-schema', { 'README.md': 'readable', ...qualityFixture });
  establishLocalStorage(dir);
  const file = path.join(dir, '.agent-workflow/binding-sources.json');
  const base = sourceManifest(dir, ['README.md'], { workflowSource: packageRoot });
  const malformed = [null, 'bad', 1, {}, [null], [[]], [1], ['bad'], [{}], [{ path: 'child' }], [{ kind: 'nested' }], [{ path: 1, kind: 'nested' }], [{ path: 'child', kind: null }]];
  for (const location of ['source', 'workflow']) {
    for (const repositories of malformed) {
      const data = structuredClone(base);
      const entry = location === 'source' ? data.sources[0] : data.workflowSource;
      entry.repositories = repositories;
      const original = JSON.stringify(data);
      assert.match(manifestProblem(data), location === 'source' ? /sources\[0\]\.repositories/ : /workflowSource\.repositories/);
      assert.equal(JSON.stringify(data), original, 'validation does not coerce or insert defaults');
      fs.writeFileSync(file, original);
      const result = run('inspect', '--repo', dir);
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stderr, '');
      assert.equal(result.json.binding.manifest.usable, false);
      assert.equal(result.json.binding.manifest.path, file);
      assert.match(result.json.binding.manifest.reason, /repositories/);
      assert.equal(result.json.binding.comparison.current, false);
      assert.equal(result.json.quality.present, true);
      assert.ok(result.json.candidates.some((candidate) => candidate.path === 'README.md'));
      assert.equal(result.json.checkout, dir);
      const compared = run('sources', '--repo', dir, '--compare', file, 'README.md');
      assert.equal(compared.json.comparison.usable, false);
      assert.equal(compared.json.comparison.current, false);
      assert.equal(compared.json.sources[0].kind, 'file');
    }
    for (const repositories of [undefined, [], [{ path: 'child', kind: 'nested', future: { keep: true } }]]) {
      const data = structuredClone(base);
      const entry = location === 'source' ? data.sources[0] : data.workflowSource;
      if (repositories !== undefined) entry.repositories = repositories;
      entry.future = true;
      const original = JSON.stringify(data);
      assert.equal(manifestProblem(data), null);
      assert.equal(JSON.stringify(data), original);
      fs.writeFileSync(file, original);
      assert.deepEqual(readManifest(file).manifest, data);
      assert.equal(run('inspect', '--repo', dir).json.binding.manifest.usable, true);
    }
  }
});

test('repository comparison ignores additive fields and key order at both locations but detects revision and pin changes', () => {
  const origin = repository('semantic-facts-origin', { 'POLICY.md': 'policy' });
  const dir = repository('semantic-facts-parent', { 'README.md': 'readable' });
  git(dir, '-c', 'protocol.file.allow=always', 'submodule', 'add', '-q', origin, 'tools/child');
  git(dir, 'commit', '-qam', 'add child');
  const manifest = () => sourceManifest(dir, ['tools'], { workflowSource: dir });
  const baseline = manifest();
  for (const location of ['source', 'workflow']) {
    const changed = structuredClone(baseline);
    const entry = location === 'source' ? changed.sources[0] : changed.workflowSource;
    entry.repositories = entry.repositories.map((repository) => ({
      ...Object.fromEntries(Object.entries(repository).reverse()), future: { preserve: ['value'] }, source: 'unknown additive member',
    }));
    const original = JSON.stringify(changed);
    assert.equal(manifestProblem(changed), null);
    for (const comparison of [compareManifests(changed, baseline), compareManifests(baseline, changed)]) {
      assert.equal(comparison.current, true);
      assert.deepEqual(comparison.repositoryChanges, []);
    }
    assert.equal(JSON.stringify(changed), original);
    for (const key of ['path', 'kind', 'head', 'indexPin', 'headPin', 'indexPinMatchesChild', 'headPinMatchesChild']) {
      const altered = structuredClone(changed);
      const fact = (location === 'source' ? altered.sources[0] : altered.workflowSource).repositories[0];
      fact[key] = typeof fact[key] === 'boolean' ? !fact[key] : `${fact[key]}-different`;
      assert.ok(compareManifests(baseline, altered).repositoryChanges.length, `${location} ${key} participates`);
    }
  }
  const child = path.join(dir, 'tools/child');
  git(child, 'commit', '--allow-empty', '-qm', 'same content, new revision');
  const revision = manifest();
  const revisionChange = compareManifests(baseline, revision);
  assert.equal(revisionChange.current, true);
  assert.deepEqual(revisionChange.repositoryChanges.map((entry) => entry.after.source), ['tools', null]);
  assert.ok(revisionChange.repositoryChanges.every(({ before, after }) => before.head !== after.head && after.indexPinMatchesChild === false));
  git(dir, 'add', 'tools/child');
  const pinChange = compareManifests(revision, manifest());
  assert.equal(pinChange.current, true);
  assert.equal(pinChange.repositoryChanges.length, 2);
  assert.ok(pinChange.repositoryChanges.every(({ before, after }) => before.indexPin !== after.indexPin && after.indexPinMatchesChild === true && after.headPinMatchesChild === false));
});

test('persisted readers refuse missing or unevaluable workflow identity while generic source-only comparison remains valid', () => {
  const dir = repository('persisted-workflow-identity', { 'README.md': 'readable' });
  establishLocalStorage(dir);
  const file = path.join(dir, '.agent-workflow/binding-sources.json');
  const generic = sourceManifest(dir, ['README.md']);
  assert.equal(manifestProblem(generic), null);
  assert.equal(compareManifests(generic, sourceManifest(dir, ['README.md'])).current, true);
  const complete = sourceManifest(dir, ['README.md'], { workflowSource: packageRoot });
  for (const workflowSource of [undefined, {}, { path: packageRoot }, { digest: '' }, { digest: 'sha256:bad' }, { ...complete.workflowSource, kind: 'unreadable' }]) {
    const data = { ...generic, ...(workflowSource === undefined ? {} : { workflowSource }) };
    fs.writeFileSync(file, JSON.stringify(data));
    const before = fs.readFileSync(file);
    assert.equal(readManifest(file).error.path, file);
    assert.match(readManifest(file).error.reason, /workflowSource.*computation identity/);
    const inspected = run('inspect', '--repo', dir);
    assert.equal(inspected.status, 0, inspected.stderr);
    assert.equal(inspected.json.binding.manifest.usable, false);
    assert.equal(inspected.json.binding.comparison.current, false);
    const compared = run('sources', '--repo', dir, '--compare', file, 'README.md');
    assert.equal(compared.json.comparison.usable, false);
    assert.equal(compared.json.comparison.path, file);
    assert.match(compared.json.comparison.reason, /refresh with sources --out/);
    assert.deepEqual(fs.readFileSync(file), before, 'readers do not repair persisted input');
  }
  fs.writeFileSync(file, JSON.stringify(complete));
  assert.deepEqual(readManifest(file).manifest, complete);
  const inspected = run('inspect', '--repo', dir).json.binding.comparison;
  assert.equal(inspected.current, true, `comparison: ${JSON.stringify(inspected)}`);
  const compared = run('sources', '--repo', dir, '--compare', file, 'README.md').json.comparison;
  assert.equal(compared.current, true, `comparison: ${JSON.stringify(compared)}`);
});

test('copied and relocated checkout diagnostics stay separate from content currentness and accept canonical aliases', () => {
  const original = repository('checkout-original', { 'README.md': 'same bytes' });
  const other = repository('checkout-other', { 'README.md': 'same bytes' });
  establishLocalStorage(other);
  const file = path.join(other, '.agent-workflow/binding-sources.json');
  const baseline = sourceManifest(original, ['README.md'], { workflowSource: packageRoot });
  const alias = path.join(scratch, 'checkout-alias');
  fs.symlinkSync(other, alias, 'dir');
  const check = (recorded, expected) => {
    fs.writeFileSync(file, JSON.stringify({ ...baseline, checkout: recorded }));
    const before = fs.readFileSync(file);
    const result = run('inspect', '--repo', other).json.binding;
    assert.equal(result.recordedCheckout, recorded);
    assert.equal(result.checkoutMatches, expected);
    assert.equal(result.comparison.current, true, `comparison: ${JSON.stringify(result.comparison)}`);
    const compared = run('sources', '--repo', other, '--compare', file, 'README.md').json.comparison;
    assert.equal(compared.checkoutMatches, expected);
    assert.equal(compared.current, true, `comparison: ${JSON.stringify(compared)}`);
    assert.deepEqual(fs.readFileSync(file), before);
  };
  check(original, false);
  fs.renameSync(original, `${original}-moved`);
  check(original, false);
  check(`${other}/./`, true);
  check(alias, true);
  check(null, null);
});

test('combined compare and out keeps transient comparison only in stdout', () => {
  const dir = repository('compare-export', { 'README.md': 'before' });
  const out = path.join(scratch, 'compare-export.json');
  assert.equal(run('sources', '--repo', dir, '--out', out, 'README.md').status, 0);
  fs.writeFileSync(path.join(dir, 'README.md'), 'after');
  const result = run('sources', '--repo', dir, '--compare', out, '--out', out, 'README.md');
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.json.comparison.changed, ['README.md']);
  assert.equal(result.json.comparison.current, false);
  const persisted = JSON.parse(fs.readFileSync(out, 'utf8'));
  assert.equal(Object.hasOwn(persisted, 'comparison'), false);
  assert.equal(Object.hasOwn(persisted, 'written'), false);
  assert.equal(persisted.format, MANIFEST_FORMAT);
  assert.equal(persisted.version, MANIFEST_VERSION);
  const repeated = run('sources', '--repo', dir, '--compare', out, 'README.md').json.comparison;
  assert.equal(repeated.current, true, `comparison: ${JSON.stringify(repeated)}`);
});

test('a comparison naming occupied local storage is unusable before any read; external, ordinary and linked-file comparisons keep their policy', () => {
  const dir = repository('compare-occupied', { 'README.md': 'readable' });
  const local = path.join(dir, '.agent-workflow');
  const outside = path.join(scratch, 'compare-occupied-target');
  const external = path.join(outside, 'binding-sources.json');
  assert.equal(run('sources', '--repo', dir, '--out', external, 'README.md').status, 0);
  const compare = (file) => run('sources', '--repo', dir, '--compare', file, 'README.md');
  const direct = compare(external);
  assert.equal(direct.status, 0, direct.stderr);
  assert.equal(direct.json.comparison.usable, true, 'a directly named external file is compared as given');
  assert.equal(direct.json.comparison.current, true, `comparison: ${JSON.stringify(direct.json.comparison)}`);
  if (process.platform !== 'win32' && process.getuid?.() !== 0) {
    const denied = path.join(scratch, 'compare-denied');
    write(denied, { 'inner/binding-sources.json': fs.readFileSync(external, 'utf8') });
    fs.chmodSync(denied, 0);
    try {
      const result = compare(path.join(denied, 'inner/binding-sources.json'));
      assert.equal(result.json.comparison.reason, 'unreadable: EACCES', 'an external read failure keeps its own diagnosis');
    } finally { fs.chmodSync(denied, 0o755); }
  }
  fs.symlinkSync(outside, local, 'dir');
  const alias = path.join(scratch, 'compare-occupied-alias');
  fs.symlinkSync(dir, alias, 'dir');
  const spellings = [path.join(local, 'binding-sources.json'), path.join(alias, '.agent-workflow/binding-sources.json'),
    ...(scratchFoldsCase ? [path.join(dir, '.AGENT-WORKFLOW/binding-sources.json'), path.join(alias, '.Agent-Workflow/binding-sources.json')] : [])];
  for (const file of spellings) {
    const result = compare(file);
    assert.equal(result.status, 0, `an unusable comparison alone keeps the exit policy: ${result.stderr}`);
    const { occupied, ...comparison } = result.json.comparison;
    assert.deepEqual(comparison, { usable: false, current: false, scope: 'listed', path: file, reason: 'local storage path occupied' }, file);
    assert.equal(occupied.path, local);
    assert.equal(occupied.kind, 'link');
    assert.equal(occupied.target, outside);
    assert.equal(result.json.complete, true, 'source facts remain');
  }
  const again = compare(external).json.comparison;
  assert.equal(direct.json.comparison.current, again.current, `the external file itself is unaffected; comparison: ${JSON.stringify(again)}`);
  assert.equal(run('inspect', '--repo', dir).json.binding.manifest.usable, false);
  fs.unlinkSync(local);
  fs.mkdirSync(local);
  fs.copyFileSync(external, path.join(local, 'binding-sources.json'));
  const ordinary = compare(path.join(alias, '.agent-workflow/binding-sources.json'));
  assert.equal(ordinary.json.comparison.usable, true, 'ordinary storage is read');
  assert.equal(ordinary.json.comparison.current, true, `comparison: ${JSON.stringify(ordinary.json.comparison)}`);
  fs.unlinkSync(path.join(local, 'binding-sources.json'));
  fs.symlinkSync(external, path.join(local, 'binding-sources.json'));
  const linked = compare(path.join(local, 'binding-sources.json'));
  assert.equal(linked.json.comparison.usable, false);
  assert.match(linked.json.comparison.reason, /^linked manifest is a conflict/, 'a linked final file is still refused');
});

