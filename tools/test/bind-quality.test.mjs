// Binding helper: the installed quality-profile selection, its config and
// profile manifest lookup.
// Shared fixtures in ../test-support/bind.mjs give each test file its own
// temporary directory of disposable Git repositories, so the files can run
// concurrently; this checkout's project files and workflow records stay unchanged.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import {
  establishLocalStorage, qualitySelection,
} from '../lib/bind.mjs';
import {
  cli, scratch, GIT_ENV, git, run, repository, write, qualityFixture,
} from '../test-support/bind.mjs';

test('missing or unreadable quality selection is reported as a dependency, not invented', () => {
  const none = repository('no-quality', { 'README.md': '# P\n' });
  assert.deepEqual(qualitySelection(none), { present: false, config: '.quality/config.json', error: 'ENOENT', profiles: [] });
  const broken = repository('broken-quality', {
    '.quality/config.json': JSON.stringify({ profiles: [{ profileId: 'profile:x/y', path: 'profiles/x-y' }] }),
  });
  const selection = qualitySelection(broken);
  assert.equal(selection.present, true);
  assert.deepEqual(selection.profiles, [{ profileId: 'profile:x/y', path: '.quality/profiles/x-y', selectedBy: 'config', present: false, error: 'ENOENT' }]);
  const malformed = repository('malformed-quality', { '.quality/config.json': '{not json' });
  assert.deepEqual(qualitySelection(malformed), { present: false, config: '.quality/config.json', error: 'invalid JSON', profiles: [] });
});

test('quality config the quality tool would refuse selects nothing; valid single and multiple selections are read', () => {
  const entry = { profileId: 'profile:acme/core', path: 'profiles/acme-core' };
  const installed = {
    '.quality/profiles/acme-core/_manifest/profile.json': JSON.stringify({ profileId: 'profile:acme/core', version: '1.0.0' }),
    '.quality/profiles/acme-extra/_manifest/profile.json': JSON.stringify({ profileId: 'profile:acme/extra', version: '2.0.0' }),
  };
  const refused = {
    'empty selection': ['{"profiles":[]}', 'profiles must NOT have fewer than 1 items'],
    'empty object': ['{}', "the document must have required property 'profiles'"],
    'top-level array': ['[]', 'the document must be object'],
    'top-level null': ['null', 'the document must be object'],
    'top-level string': ['"hello"', 'the document must be object'],
    'profiles object': ['{"profiles":{}}', 'profiles must be array'],
    'profiles string': ['{"profiles":"profile:acme/core"}', 'profiles must be array'],
    'unknown top-level member': [JSON.stringify({ profiles: [entry], extra: true }), 'the document must NOT have additional properties'],
    'unknown entry member': [JSON.stringify({ profiles: [{ ...entry, extra: 1 }] }), 'profiles[0] must NOT have additional properties'],
    'prototype member': [`{"__proto__":{"extra":1},"profiles":${JSON.stringify([entry])}}`, 'the document must NOT have additional properties'],
    'entry without path': ['{"profiles":[{"profileId":"profile:acme/core"}]}', "profiles[0] must have required property 'path'"],
    'entry without profileId': ['{"profiles":[{"path":"profiles/acme-core"}]}', "profiles[0] must have required property 'profileId'"],
    'entry string': ['{"profiles":["profile:acme/core"]}', 'profiles[0] must be object'],
    'object path spoof': ['{"profiles":[{"profileId":"profile:x/y","path":{"error":"injected text","location":"/etc"}}]}', 'profiles[0].path must be string'],
    'null path': ['{"profiles":[{"profileId":"profile:x/y","path":null}]}', 'profiles[0].path must be string'],
    'object profileId': ['{"profiles":[{"profileId":{"error":"injected text"},"path":"profiles/acme-core"}]}', 'profiles[0].profileId must be string'],
    'empty profileId': ['{"profiles":[{"profileId":"","path":"profiles/acme-core"}]}', 'profiles[0].profileId must NOT have fewer than 1 characters'],
    'repeated profileId': [JSON.stringify({ profiles: [entry, { ...entry, path: 'profiles/acme-extra' }] }), 'profiles[1].profileId repeats profiles[0].profileId'],
    'duplicate entry member': ['{"profiles":[{"profileId":"profile:acme/core","path":"injected","path":"profiles/acme-core"}]}', 'profiles[0].path is a duplicate member'],
    'duplicate top-level member': [`{"profiles":[],"profiles":${JSON.stringify([entry])}}`, 'profiles is a duplicate member'],
    'escaped duplicate member': [`{"profiles":${JSON.stringify([entry])},"\\u0070rofiles":${JSON.stringify([entry])}}`, 'profiles is a duplicate member'],
    'escaped duplicate entry member': ['{"profiles":[{"profileId":"profile:acme/core","path":"profiles/acme-core","p\\u0061th":"injected"}]}', 'profiles[0].path is a duplicate member'],
    'duplicate inside a discarded member': [`{"profiles":{"injected":{"a":1,"a":2}},"profiles":${JSON.stringify([entry])}}`, 'profiles.(unknown member).(unknown member) is a duplicate member'],
  };
  for (const [name, [text, reason]] of Object.entries(refused)) {
    const dir = repository(`quality-config-${name.replace(/ /g, '-')}`, { ...installed, '.quality/config.json': text });
    assert.deepEqual(qualitySelection(dir), { present: false, config: '.quality/config.json', error: `invalid structure: ${reason}`, profiles: [] }, name);
  }
  for (const [name, text] of [['byte order mark', `\uFEFF${JSON.stringify({ profiles: [entry] })}`], ['trailing input', `${JSON.stringify({ profiles: [entry] })} x`]]) {
    const dir = repository(`quality-config-${name.replace(/ /g, '-')}`, { ...installed, '.quality/config.json': text });
    assert.deepEqual(qualitySelection(dir), { present: false, config: '.quality/config.json', error: 'invalid JSON', profiles: [] }, name);
  }
  const core = { profileId: 'profile:acme/core', path: '.quality/profiles/acme-core', selectedBy: 'config', present: true, version: '1.0.0', inherits: [], requires: [] };
  const single = repository('quality-config-single', { ...installed, '.quality/config.json': JSON.stringify({ profiles: [entry] }) });
  assert.deepEqual(qualitySelection(single), { present: true, config: '.quality/config.json', profiles: [core] });
  const multiple = repository('quality-config-multiple', {
    ...installed, '.quality/config.json': JSON.stringify({ profiles: [entry, { profileId: 'profile:acme/extra', path: 'profiles/acme-extra' }, { profileId: 'profile:acme/gone', path: 'profiles/gone' }] }),
  });
  assert.deepEqual(qualitySelection(multiple).profiles, [
    core,
    { profileId: 'profile:acme/extra', path: '.quality/profiles/acme-extra', selectedBy: 'config', present: true, version: '2.0.0', inherits: [], requires: [] },
    { profileId: 'profile:acme/gone', path: '.quality/profiles/gone', selectedBy: 'config', present: false, error: 'ENOENT' },
  ], 'a valid selection keeps its unavailable-profile diagnostic');
  const invalid = repository('quality-config-inspect', { ...installed, 'README.md': '# P\n', '.quality/config.json': refused['object path spoof'][0] });
  const inspected = run('inspect', '--repo', invalid);
  assert.equal(inspected.status, 0, 'an unusable selection alone adds no exit policy');
  assert.deepEqual(inspected.json.quality, { present: false, config: '.quality/config.json', error: 'invalid structure: profiles[0].path must be string', profiles: [] });
  assert.equal(inspected.json.discovery.complete, true);
  assert.ok(inspected.json.candidates.some((c) => c.path === '.quality/config.json'), 'independent facts remain');
  assert.doesNotMatch(inspected.stdout, /injected text/);
});

test('a configured profile location outside the checkout is a dependency, not read: .. traversal and a link escape; an in-checkout location elsewhere is read', () => {
  const outside = path.join(scratch, 'profiles-outside');
  write(outside, { 'profiles/evil/_manifest/profile.json': JSON.stringify({ profileId: 'profile:evil/x', version: '9.9.9', inherits: [], requires: [] }) });
  const traversal = repository('quality-traversal', {
    '.quality/config.json': JSON.stringify({ profiles: [{ profileId: 'profile:evil/x', path: '../../profiles-outside/profiles/evil' }] }),
  });
  const climbed = qualitySelection(traversal);
  assert.equal(climbed.present, true, 'the tracked config itself is read');
  assert.deepEqual(climbed.profiles, [{
    profileId: 'profile:evil/x', path: '.quality/../../profiles-outside/profiles/evil', selectedBy: 'config', present: false, error: 'outside the checkout',
    location: path.join(outside, 'profiles', 'evil', '_manifest', 'profile.json'),
  }], 'the location is named and nothing from it (no version) is reported');

  const escape = repository('quality-link-escape', {
    '.quality/config.json': JSON.stringify({ profiles: [{ profileId: 'profile:evil/x', path: 'profiles/linked' }] }),
  });
  fs.mkdirSync(path.join(escape, '.quality', 'profiles'));
  fs.symlinkSync(path.join(outside, 'profiles', 'evil'), path.join(escape, '.quality', 'profiles', 'linked'), 'dir');
  const viaLink = qualitySelection(escape);
  assert.deepEqual([viaLink.profiles[0].present, viaLink.profiles[0].error, viaLink.profiles[0].location, viaLink.profiles[0].version], [false, 'outside the checkout', path.join(outside, 'profiles', 'evil', '_manifest', 'profile.json'), undefined], 'a canonical link escape is refused, not only a lexical ..');
  const inspected = run('inspect', '--repo', escape);
  assert.equal(inspected.status, 0, inspected.stderr);
  assert.equal(inspected.json.quality.profiles[0].error, 'outside the checkout');

  const neighbor = repository('quality-in-checkout', {
    '.quality/config.json': JSON.stringify({ profiles: [{ profileId: 'profile:acme/local', path: '../profiles-local/acme' }] }),
    'profiles-local/acme/_manifest/profile.json': JSON.stringify({ profileId: 'profile:acme/local', version: '1.2.3', inherits: [], requires: [] }),
  });
  const kept = qualitySelection(neighbor).profiles[0];
  assert.deepEqual([kept.present, kept.version, kept.path, kept.location], [true, '1.2.3', '.quality/../profiles-local/acme', undefined], 'a candidate-owned location elsewhere in the checkout is read');
  const standard = qualitySelection(repository('quality-standard', qualityFixture)).profiles.map((p) => [p.profileId, p.present]);
  assert.deepEqual(standard, [['profile:acme/defaults', true], ['profile:acme/core', true], ['profile:acme/reference', false]], 'the ordinary layout is unchanged');
});

for (const mode of ['inherited-leaf', 'profiles-ancestor', 'required-leaf', 'in-checkout-neighbor']) {
  test(`profile ID lookup guards before reads: ${mode}`, (t) => {
    const relation = mode === 'required-leaf' ? 'requires' : 'inherits';
    const dir = repository(`guard-${mode}`, {
      '.quality/config.json': JSON.stringify({ profiles: [{ profileId: 'profile:acme/root', path: 'root' }] }),
      '.quality/root/_manifest/profile.json': JSON.stringify({ profileId: 'profile:acme/root', [relation]: [{ profileId: 'profile:acme/hidden' }] }),
      'README.md': '# P\n',
    });
    const target = mode === 'in-checkout-neighbor' ? path.join(dir, 'local-profile') : path.join(scratch, `outside-${mode}`);
    write(target, { '_manifest/profile.json': JSON.stringify({ profileId: 'profile:acme/hidden', version: '1.2.3' }) });
    const profiles = path.join(dir, '.quality', 'profiles');
    if (mode === 'profiles-ancestor') {
      const parent = path.join(scratch, 'outside-profile-parent');
      fs.mkdirSync(parent);
      fs.renameSync(target, path.join(parent, 'unpredictable'));
      fs.symlinkSync(parent, profiles, 'dir');
    } else {
      fs.mkdirSync(path.join(profiles, 'unpredictable'), { recursive: true });
      fs.symlinkSync(path.join(target, '_manifest'), path.join(profiles, 'unpredictable', '_manifest'), 'dir');
    }
    const reads = [];
    for (const method of ['readFileSync', 'readdirSync']) {
      const original = fs[method];
      t.mock.method(fs, method, (file, ...args) => {
        let location;
        try { location = fs.realpathSync(file); } catch { location = String(file); }
        reads.push(location);
        return original(file, ...args);
      });
    }
    const selected = qualitySelection(dir);
    const dependency = selected.profiles.find((p) => p.profileId === 'profile:acme/hidden');
    assert.equal(selected.profiles[0].present, true);
    if (mode === 'in-checkout-neighbor') {
      assert.equal(dependency.present, true);
      assert.equal(dependency.version, '1.2.3');
      assert.ok(reads.includes(path.join(target, '_manifest', 'profile.json')));
    } else {
      assert.equal(dependency.present, false);
      assert.equal(dependency.path, null, 'the hidden ID is not associated with an unread location');
      assert.equal(dependency.error, 'not installed');
      assert.ok(selected.blockedLocations.some((p) => p.error === 'outside the checkout'));
      assert.ok(reads.every((file) => file.startsWith(`${dir}${path.sep}`)), JSON.stringify(reads));
    }
  });
}

for (const recorded of [false, true]) {
  test(`inherited profile lookup denial retains partial inspection: recorded sources ${recorded}`, (t) => {
    if (process.platform === 'win32' || process.getuid?.() === 0) { t.skip('needs POSIX permissions enforced'); return; }
    const dir = repository(`profile-denial-${recorded}`, { ...qualityFixture, '.gitignore': '/.peer-skills-and-workflows/\n' });
    establishLocalStorage(dir);
    const out = path.join(dir, '.peer-skills-and-workflows/binding-sources.json');
    if (recorded) assert.equal(run('sources', '--repo', dir, '--out', out, 'README.md', '.quality').status, 0);
    const normal = run('inspect', '--repo', dir);
    assert.equal(normal.status, 0, normal.stderr);
    assert.equal(normal.json.quality.profiles.find((p) => p.profileId === 'profile:acme/core').present, true);
    assert.equal(normal.json.quality.profiles.find((p) => p.profileId === 'profile:acme/reference').error, 'not installed');
    const profiles = path.join(dir, '.quality/profiles');
    fs.chmodSync(profiles, 0o111);
    try {
      assert.throws(() => fs.readdirSync(profiles), { code: 'EACCES' });
      const denied = run('inspect', '--repo', dir);
      assert.ok(denied.json, denied.stderr);
      assert.equal(denied.json.localStorage.ignored, true);
      assert.equal(denied.json.quality.profiles[0].present, true, 'known selected manifest stays readable');
      for (const dependency of denied.json.quality.profiles.slice(1)) {
        assert.equal(dependency.present, false);
        assert.equal(dependency.error, 'EACCES');
        assert.equal(dependency.location, profiles);
      }
      if (recorded) {
        assert.equal(denied.status, 1);
        assert.equal(denied.json.binding.comparison.complete, false);
        assert.ok(denied.json.binding.comparison.unchanged.includes('README.md'));
      } else {
        assert.equal(denied.status, denied.json.discovery.complete ? 0 : 1, 'quality diagnostics alone do not introduce an exit policy');
        assert.equal(denied.json.binding.manifest.reason, 'absent');
      }
    } finally { fs.chmodSync(profiles, 0o755); }
    const restored = run('inspect', '--repo', dir);
    assert.equal(restored.status, 0, restored.stderr);
    assert.deepEqual(restored.json.quality, normal.json.quality);
    if (recorded) assert.equal(restored.json.binding.comparison.current, true, `comparison: ${JSON.stringify(restored.json.binding.comparison)}`);
  });
}

for (const recorded of [false, true]) {
  test(`a denied manifest at a non-fallback folder leaves its ID unresolved, not uninstalled: recorded sources ${recorded}`, (t) => {
    if (process.platform === 'win32' || process.getuid?.() === 0) { t.skip('needs POSIX permissions enforced'); return; }
    const dir = repository(`manifest-denial-${recorded}`, {
      'README.md': '# P\n', '.gitignore': '/.peer-skills-and-workflows/\n',
      '.quality/config.json': JSON.stringify({ profiles: [{ profileId: 'profile:acme/root', path: 'profiles/root-installed' }] }),
      '.quality/profiles/root-installed/_manifest/profile.json': JSON.stringify({
        profileId: 'profile:acme/root', inherits: [{ profileId: 'profile:acme/core' }, { profileId: 'profile:acme/extra' }], requires: [{ profileId: 'profile:acme/absent' }],
      }),
      '.quality/profiles/core-installed/_manifest/profile.json': JSON.stringify({ profileId: 'profile:acme/core', version: '1.0.0' }),
      '.quality/profiles/extra-installed/_manifest/profile.json': JSON.stringify({ profileId: 'profile:acme/extra', version: '2.0.0' }),
    });
    establishLocalStorage(dir);
    const out = path.join(dir, '.peer-skills-and-workflows/binding-sources.json');
    if (recorded) assert.equal(run('sources', '--repo', dir, '--out', out, 'README.md', '.quality').status, 0);
    const byId = (json, id) => json.quality.profiles.find((p) => p.profileId === id);
    const readable = run('inspect', '--repo', dir);
    assert.equal(readable.status, 0, readable.stderr);
    assert.equal(byId(readable.json, 'profile:acme/core').path, '.quality/profiles/core-installed');
    assert.equal(byId(readable.json, 'profile:acme/core').present, true);
    assert.deepEqual(byId(readable.json, 'profile:acme/absent'), { profileId: 'profile:acme/absent', path: null, selectedBy: 'profile:acme/root requires', present: false, error: 'not installed' }, 'a complete search establishes absence');
    assert.equal(readable.json.quality.blockedLocations, undefined);
    const manifest = path.join(dir, '.quality/profiles/core-installed/_manifest/profile.json');
    fs.chmodSync(manifest, 0);
    try {
      assert.throws(() => fs.readFileSync(manifest), { code: 'EACCES' });
      const denied = run('inspect', '--repo', dir);
      assert.ok(denied.json, denied.stderr);
      const inaccessible = [{ path: '.quality/profiles/core-installed/_manifest/profile.json', location: manifest, error: 'EACCES' }];
      for (const [id, relation] of [['profile:acme/core', 'inherits'], ['profile:acme/absent', 'requires']]) {
        assert.deepEqual(byId(denied.json, id), { profileId: id, path: null, selectedBy: `profile:acme/root ${relation}`, present: false, error: 'unresolved', inaccessible }, `${id}: unread bytes neither match nor rule out the ID`);
      }
      assert.equal(byId(denied.json, 'profile:acme/extra').present, true, 'a readable match still wins');
      assert.equal(byId(denied.json, 'profile:acme/root').present, true);
      assert.deepEqual(denied.json.quality.blockedLocations, inaccessible);
      assert.equal(denied.json.localStorage.ignored, true);
      assert.equal(denied.json.discovery.complete, true);
      if (recorded) {
        assert.equal(denied.status, 1, 'the recorded source check still fails');
        assert.equal(denied.json.binding.comparison.complete, false);
        assert.ok(denied.json.binding.comparison.unchanged.includes('README.md'));
      } else {
        assert.equal(denied.status, 0, 'quality diagnostics alone add no exit policy');
        assert.equal(denied.json.binding.manifest.reason, 'absent');
      }
    } finally { fs.chmodSync(manifest, 0o644); }
    const restored = run('inspect', '--repo', dir);
    assert.equal(restored.status, 0, restored.stderr);
    assert.deepEqual(restored.json.quality, readable.json.quality);
    if (recorded) assert.equal(restored.json.binding.comparison.current, true, `comparison: ${JSON.stringify(restored.json.binding.comparison)}`);
  });
}

test('manifest lookup propagates unrelated read failures and keeps other expected access codes', (t) => {
  const dir = repository('manifest-lookup-unrelated', {
    '.quality/config.json': JSON.stringify({ profiles: [{ profileId: 'profile:acme/root', path: 'profiles/root-installed' }] }),
    '.quality/profiles/root-installed/_manifest/profile.json': JSON.stringify({ profileId: 'profile:acme/root', inherits: [{ profileId: 'profile:acme/core' }] }),
    '.quality/profiles/core-installed/_manifest/profile.json': JSON.stringify({ profileId: 'profile:acme/core' }),
  });
  const manifest = path.join(dir, '.quality/profiles/core-installed/_manifest/profile.json');
  const native = fs.readFileSync;
  const unrelated = new Error('unrelated manifest read failure');
  t.mock.method(fs, 'readFileSync', (file, ...args) => {
    if (file === manifest) throw unrelated;
    return native(file, ...args);
  });
  assert.throws(() => qualitySelection(dir), (error) => error === unrelated);
  t.mock.restoreAll();
  t.mock.method(fs, 'readFileSync', (file, ...args) => {
    if (file === manifest) throw Object.assign(new Error('injected manifest access denial'), { code: 'EPERM' });
    return native(file, ...args);
  });
  const core = qualitySelection(dir).profiles.find((p) => p.profileId === 'profile:acme/core');
  assert.equal(core.error, 'unresolved');
  assert.deepEqual(core.inaccessible, [{ path: '.quality/profiles/core-installed/_manifest/profile.json', location: manifest, error: 'EPERM' }]);
});

test('profile lookup contains expected errors only and quality-only diagnostics preserve success', (t) => {
  const dir = repository('profile-lookup-errors', qualityFixture);
  const profiles = path.join(dir, '.quality/profiles');
  const native = fs.readdirSync;
  const unrelated = new Error('unrelated lookup failure');
  t.mock.method(fs, 'readdirSync', (file, ...args) => {
    if (file === profiles) throw unrelated;
    return native(file, ...args);
  });
  assert.throws(() => qualitySelection(dir), (error) => error === unrelated);
  t.mock.restoreAll();
  const observer = path.join(scratch, 'profile-quality-only.mjs');
  fs.writeFileSync(observer, `import fs from 'node:fs';
    const native = fs.readdirSync;
    fs.readdirSync = (file, ...args) => {
      if (file === ${JSON.stringify(profiles)}) throw Object.assign(new Error('injected lookup access denial'), { code: 'EACCES', path: file });
      return native(file, ...args);
    };`);
  const result = spawnSync(process.execPath, ['--import', observer, cli, 'inspect', '--repo', dir], { encoding: 'utf8', env: GIT_ENV });
  assert.equal(result.status, 0, result.stderr);
  const json = JSON.parse(result.stdout);
  assert.equal(json.discovery.complete, true);
  assert.equal(json.quality.profiles[1].error, 'EACCES');
  assert.equal(json.quality.profiles[1].location, profiles);
});

test('an undecodable manifest at a non-fallback folder leaves its ID unresolved with a fixed cause; readable, restored, fallback and absent controls', () => {
  const coreManifest = JSON.stringify({ profileId: 'profile:acme/core', version: '1.0.0' });
  const dir = repository('manifest-undecodable', {
    'README.md': '# P\n',
    '.quality/config.json': JSON.stringify({ profiles: [{ profileId: 'profile:acme/root', path: 'profiles/root-installed' }] }),
    '.quality/profiles/root-installed/_manifest/profile.json': JSON.stringify({
      profileId: 'profile:acme/root', inherits: [{ profileId: 'profile:acme/core' }, { profileId: 'profile:acme/extra' }], requires: [{ profileId: 'profile:acme/absent' }],
    }),
    '.quality/profiles/core-installed/_manifest/profile.json': coreManifest,
    '.quality/profiles/extra-installed/_manifest/profile.json': JSON.stringify({ profileId: 'profile:acme/extra', version: '2.0.0' }),
    '.quality/profiles/parsed-array/_manifest/profile.json': '["profile:acme/absent"]',
    '.quality/profiles/parsed-other/_manifest/profile.json': JSON.stringify({ profileId: 'profile:acme/other' }),
  });
  const byId = (json, id) => json.quality.profiles.find((p) => p.profileId === id);
  const readable = run('inspect', '--repo', dir);
  assert.equal(readable.status, 0, readable.stderr);
  assert.equal(byId(readable.json, 'profile:acme/core').path, '.quality/profiles/core-installed');
  assert.deepEqual(byId(readable.json, 'profile:acme/absent'), { profileId: 'profile:acme/absent', path: null, selectedBy: 'profile:acme/root requires', present: false, error: 'not installed' }, 'parsed nonmatching manifests leave a complete search');
  assert.equal(readable.json.quality.blockedLocations, undefined);
  const manifest = path.join(dir, '.quality/profiles/core-installed/_manifest/profile.json');
  fs.writeFileSync(manifest, '{"profileId": "profile:acme/core", "injected parser text');
  const corrupt = run('inspect', '--repo', dir);
  assert.equal(corrupt.status, 0, 'quality diagnostics alone add no exit policy');
  const inaccessible = [{ path: '.quality/profiles/core-installed/_manifest/profile.json', location: manifest, error: 'invalid JSON' }];
  for (const [id, relation] of [['profile:acme/core', 'inherits'], ['profile:acme/absent', 'requires']]) {
    assert.deepEqual(byId(corrupt.json, id), { profileId: id, path: null, selectedBy: `profile:acme/root ${relation}`, present: false, error: 'unresolved', inaccessible }, `${id}: undecodable bytes neither match nor rule out the ID`);
  }
  assert.equal(byId(corrupt.json, 'profile:acme/extra').present, true, 'a readable match still wins');
  assert.equal(byId(corrupt.json, 'profile:acme/root').present, true);
  assert.deepEqual(corrupt.json.quality.blockedLocations, inaccessible);
  assert.equal(corrupt.json.discovery.complete, true, 'independent facts remain');
  assert.doesNotMatch(corrupt.stdout, /injected parser text/);
  fs.writeFileSync(manifest, coreManifest);
  const restored = run('inspect', '--repo', dir);
  assert.equal(restored.status, 0, restored.stderr);
  assert.deepEqual(restored.json.quality, readable.json.quality);
  // Identical bytes in the folder named after the ID keep the fallback diagnostic.
  const fallback = repository('manifest-undecodable-fallback', {
    '.quality/config.json': JSON.stringify({ profiles: [{ profileId: 'profile:acme/root', path: 'profiles/root-installed' }] }),
    '.quality/profiles/root-installed/_manifest/profile.json': JSON.stringify({ profileId: 'profile:acme/root', inherits: [{ profileId: 'profile:acme/core' }] }),
    '.quality/profiles/acme-core/_manifest/profile.json': '{"profileId": "profile:acme/core", ',
  });
  const core = qualitySelection(fallback).profiles.find((p) => p.profileId === 'profile:acme/core');
  assert.equal(core.path, '.quality/profiles/acme-core');
  assert.equal(core.present, false);
  assert.match(core.error, /^invalid JSON/);
  assert.equal(qualitySelection(fallback).blockedLocations, undefined);
});

test('profile manifests that are not UTF-8 or hold an unpaired surrogate are undecodable: lookup unresolved, configured and fallback present false; text, readable, restored and fallback controls', () => {
  const bytes = (...parts) => Buffer.concat(parts.map((part) => (typeof part === 'string' ? Buffer.from(part) : Buffer.from(part))));
  const root = (inherits) => JSON.stringify({ profileId: 'profile:acme/root', version: '1.0.0', inherits, requires: [{ profileId: 'profile:acme/absent' }] });
  const files = {
    'README.md': '# P\n',
    '.quality/config.json': JSON.stringify({ profiles: [{ profileId: 'profile:acme/root', path: 'profiles/root-installed' }] }),
    '.quality/profiles/root-installed/_manifest/profile.json': root([{ profileId: 'profile:acme/core' }, { profileId: 'profile:acme/extra' }]),
    '.quality/profiles/core-installed/_manifest/profile.json': JSON.stringify({ profileId: 'profile:acme/core', version: '1.0.0' }),
    '.quality/profiles/extra-installed/_manifest/profile.json': JSON.stringify({ profileId: 'profile:acme/extra', version: '2.0.0' }),
  };
  const dir = repository('profile-encoding', files);
  const byId = (selection, id) => selection.profiles.find((p) => p.profileId === id);
  const readable = qualitySelection(dir);
  assert.equal(byId(readable, 'profile:acme/core').path, '.quality/profiles/core-installed');
  assert.equal(byId(readable, 'profile:acme/absent').error, 'not installed');
  const core = path.join(dir, '.quality/profiles/core-installed/_manifest/profile.json');
  const inaccessible = [{ path: '.quality/profiles/core-installed/_manifest/profile.json', location: core, error: 'invalid JSON' }];

  // An undecodable non-fallback manifest leaves both the ID it may declare and the absent ID unresolved.
  for (const [name, content] of [['invalid byte in the ID', bytes('{"profileId":"profile:acme/co', [0xff], 're","version":"1.0.0"}')],
    ['encoded surrogate in the ID', bytes('{"profileId":"profile:acme/core', [0xed, 0xa0, 0x80], '"}')],
    ['invalid byte in the version', bytes('{"profileId":"profile:acme/core","version":"1.', [0xc3, 0x28], '"}')],
    ['lone surrogate escape in the ID', '{"profileId":"profile:acme/core\\ud800"}'], ['lone surrogate escape in a member name', '{"profileId":"profile:acme/core","\\udc00":1}']]) {
    fs.writeFileSync(core, content);
    const selection = qualitySelection(dir);
    for (const [id, relation] of [['profile:acme/core', 'inherits'], ['profile:acme/absent', 'requires']]) {
      assert.deepEqual(byId(selection, id), { profileId: id, path: null, selectedBy: `profile:acme/root ${relation}`, present: false, error: 'unresolved', inaccessible }, `${name}: ${id}`);
    }
    assert.equal(byId(selection, 'profile:acme/extra').present, true, `${name}: a readable match still wins`);
    assert.deepEqual(selection.blockedLocations, inaccessible, name);
  }
  const inspected = run('inspect', '--repo', dir);
  assert.equal(inspected.status, 0, 'quality diagnostics alone add no exit policy');
  assert.equal(byId(inspected.json.quality, 'profile:acme/core').error, 'unresolved');
  assert.equal(inspected.json.discovery.complete, true, 'independent facts remain');
  assert.doesNotMatch(inspected.stdout, /�/, 'no replaced text is reported');
  // Supplementary characters, raw or as an escaped pair, are ordinary text; restored bytes resolve as before.
  for (const content of [JSON.stringify({ profileId: 'profile:acme/core', version: '1.0.0', note: '\u{1F600}' }), '{"profileId":"profile:acme/core","version":"1.0.0","note":"\\ud83d\\ude00"}']) {
    fs.writeFileSync(core, content);
    assert.deepEqual(qualitySelection(dir), readable, content);
  }

  // A configured manifest whose inheritance or version bytes are malformed is present: false with a fixed cause; nothing is followed from it.
  const configured = path.join(dir, '.quality/profiles/root-installed/_manifest/profile.json');
  for (const [content, error] of [[bytes('{"profileId":"profile:acme/root","inherits":[{"profileId":"profile:acme/co', [0xff], 're"}]}'), 'invalid JSON: not UTF-8'],
    [bytes('{"profileId":"profile:acme/root","version":"1.', [0xe2, 0x82], '","inherits":[]}'), 'invalid JSON: not UTF-8'],
    ['{"profileId":"profile:acme/root","inherits":[{"profileId":"profile:acme/core\\udc00"}]}', 'invalid JSON: unpaired surrogate']]) {
    fs.writeFileSync(configured, content);
    assert.deepEqual(qualitySelection(dir), { present: true, config: '.quality/config.json', profiles: [{ profileId: 'profile:acme/root', path: '.quality/profiles/root-installed', selectedBy: 'config', present: false, error }] }, error);
  }
  fs.writeFileSync(configured, files['.quality/profiles/root-installed/_manifest/profile.json']);
  assert.deepEqual(qualitySelection(dir), readable, 'restored');

  // A fallback folder's undecodable manifest is present: false with its fixed cause, not a blocked lookup.
  const fallback = repository('profile-encoding-fallback', {
    '.quality/config.json': JSON.stringify({ profiles: [{ profileId: 'profile:acme/root', path: 'profiles/root-installed' }] }),
    '.quality/profiles/root-installed/_manifest/profile.json': JSON.stringify({ profileId: 'profile:acme/root', inherits: [{ profileId: 'profile:acme/core' }] }),
  });
  const fallbackManifest = path.join(fallback, '.quality/profiles/acme-core/_manifest/profile.json');
  write(fallback, { '.quality/profiles/acme-core/_manifest/.keep': '' });
  for (const [content, error] of [[bytes('{"profileId":"profile:acme/', [0xff], '"}'), 'invalid JSON: not UTF-8'], ['{"profileId":"profile:acme/core\\ud800"}', 'invalid JSON: unpaired surrogate']]) {
    fs.writeFileSync(fallbackManifest, content);
    const selection = qualitySelection(fallback);
    assert.deepEqual(byId(selection, 'profile:acme/core'), { profileId: 'profile:acme/core', path: '.quality/profiles/acme-core', selectedBy: 'profile:acme/root inherits', present: false, error }, error);
    assert.equal(selection.blockedLocations, undefined, error);
  }
  fs.writeFileSync(fallbackManifest, JSON.stringify({ profileId: 'profile:acme/core', version: '1.0.0' }));
  assert.equal(byId(qualitySelection(fallback), 'profile:acme/core').present, true, 'a restored fallback manifest is read');
});

test('quality config bytes that are not UTF-8 or hold an unpaired surrogate select nothing; supplementary characters and escaped pairs are text', () => {
  const installed = {
    '.quality/profiles/acme-core/_manifest/profile.json': JSON.stringify({ profileId: 'profile:acme/core', version: '1.0.0' }),
    '.quality/profiles/acme-\u{1F600}/_manifest/profile.json': JSON.stringify({ profileId: 'profile:acme/\u{1F600}', version: '3.0.0' }),
  };
  const bytes = (...parts) => Buffer.concat(parts.map((part) => (typeof part === 'string' ? Buffer.from(part) : Buffer.from(part))));
  const refused = {
    'invalid byte in a value': [bytes('{"profiles":[{"profileId":"profile:acme/core","path":"profiles/acme-core', [0xff], '"}]}'), 'not UTF-8'],
    'invalid byte in a path': [bytes('{"profiles":[{"profileId":"profile:acme/core","path":"profiles/acme-c', [0xc3, 0x28], 're"}]}'), 'not UTF-8'],
    'overlong encoding': [bytes('{"profiles":[{"profileId":"profile:acme/core","path":"profiles', [0xc0, 0xaf], 'acme-core"}]}'), 'not UTF-8'],
    'encoded surrogate': [bytes('{"profiles":[{"profileId":"profile:acme/', [0xed, 0xa0, 0x80], '","path":"profiles/acme-core"}]}'), 'not UTF-8'],
    'truncated sequence': [bytes('{"profiles":[{"profileId":"profile:acme/core","path":"profiles/acme-core"}]}', [0xe2, 0x82]), 'not UTF-8'],
    'lone high surrogate escape': ['{"profiles":[{"profileId":"profile:acme/\\ud800","path":"profiles/acme-core"}]}', 'unpaired surrogate'],
    'lone low surrogate in a path': ['{"profiles":[{"profileId":"profile:acme/core","path":"profiles/acme-core\\uDC00"}]}', 'unpaired surrogate'],
    'reversed pair': ['{"profiles":[{"profileId":"profile:acme/\\ude00\\ud83d","path":"profiles/acme-core"}]}', 'unpaired surrogate'],
    'lone surrogate in a member name': ['{"profiles":[{"profileId":"profile:acme/core","path":"profiles/acme-core"}],"\\ud800":1}', 'unpaired surrogate'],
  };
  for (const [name, [content, reason]] of Object.entries(refused)) {
    const dir = repository(`quality-encoding-${name.replace(/ /g, '-')}`, installed);
    fs.writeFileSync(path.join(dir, '.quality/config.json'), content);
    assert.deepEqual(qualitySelection(dir), { present: false, config: '.quality/config.json', error: `invalid JSON: ${reason}`, profiles: [] }, name);
  }
  const smile = { profileId: 'profile:acme/\u{1F600}', path: '.quality/profiles/acme-\u{1F600}', selectedBy: 'config', present: true, version: '3.0.0', inherits: [], requires: [] };
  for (const [name, text] of [['raw supplementary character', JSON.stringify({ profiles: [{ profileId: 'profile:acme/\u{1F600}', path: 'profiles/acme-\u{1F600}' }] })],
    ['escaped surrogate pair', '{"profiles":[{"profileId":"profile:acme/\\ud83d\\ude00","path":"profiles/acme-\\uD83D\\uDE00"}]}']]) {
    const dir = repository(`quality-encoding-${name.replace(/ /g, '-')}`, { ...installed, '.quality/config.json': text });
    assert.deepEqual(qualitySelection(dir), { present: true, config: '.quality/config.json', profiles: [smile] }, name);
  }
  const dir = repository('quality-encoding-inspect', { ...installed, 'README.md': '# P\n' });
  fs.writeFileSync(path.join(dir, '.quality/config.json'), refused['invalid byte in a path'][0]);
  const inspected = run('inspect', '--repo', dir);
  assert.equal(inspected.status, 0, 'an unusable selection alone adds no exit policy');
  assert.deepEqual(inspected.json.quality, { present: false, config: '.quality/config.json', error: 'invalid JSON: not UTF-8', profiles: [] });
  assert.equal(inspected.json.discovery.complete, true, 'independent facts remain');
});

test('a deeply nested quality config is refused with its structural cause, not a stack overflow; inspect keeps the independent facts', () => {
  const dir = repository('quality-config-deep', { 'README.md': '# P\n', '.quality/config.json': `{"profiles":${'['.repeat(10000)}"x"${']'.repeat(10000)}}` });
  const refused = { present: false, config: '.quality/config.json', error: 'invalid structure: profiles[0] must be object', profiles: [] };
  assert.deepEqual(qualitySelection(dir), refused);
  const inspected = run('inspect', '--repo', dir);
  assert.equal(inspected.status, 0, inspected.stderr);
  assert.equal(inspected.stderr, '', 'reported in JSON, not thrown');
  assert.deepEqual(inspected.json.quality, refused);
  assert.equal(inspected.json.discovery.complete, true);
  assert.ok(inspected.json.candidates.some((c) => c.path === '.quality/config.json'), 'independent facts remain');
});

test('quality config is contained before it is read: outside links select nothing; inside links name their canonical origin; an ordinary file is read', () => {
  const installed = { 'README.md': '# P\n', '.quality/profiles/acme-core/_manifest/profile.json': JSON.stringify({ profileId: 'profile:acme/core', version: '1.0.0' }) };
  const selection = JSON.stringify({ profiles: [{ profileId: 'profile:acme/core', path: 'profiles/acme-core' }] });
  const core = { profileId: 'profile:acme/core', path: '.quality/profiles/acme-core', selectedBy: 'config', present: true, version: '1.0.0', inherits: [], requires: [] };
  const outsideFile = path.join(scratch, 'config-outside-selection.json');
  fs.writeFileSync(outsideFile, selection);
  const linked = repository('config-outside-link', installed);
  fs.symlinkSync(outsideFile, path.join(linked, '.quality/config.json'));
  git(linked, 'add', '.quality/config.json');
  const outside = { present: false, config: '.quality/config.json', error: 'outside the checkout', location: outsideFile, profiles: [] };
  assert.deepEqual(qualitySelection(linked), outside, 'a tracked link to outside bytes selects nothing');
  const inspected = run('inspect', '--repo', linked);
  assert.equal(inspected.status, 0, 'an unusable selection alone adds no exit policy');
  assert.deepEqual(inspected.json.quality, outside);
  assert.ok(inspected.json.candidates.some((c) => c.path === '.quality/config.json'), 'independent facts remain');
  const outsideDir = path.join(scratch, 'config-outside-directory');
  write(outsideDir, { 'config.json': selection });
  const ancestor = repository('config-outside-ancestor', { 'README.md': '# P\n' });
  fs.symlinkSync(outsideDir, path.join(ancestor, '.quality'), 'dir');
  assert.deepEqual(qualitySelection(ancestor), { ...outside, location: path.join(outsideDir, 'config.json') }, 'a linked ancestor is resolved too');
  const inside = repository('config-inside-link', { ...installed, 'docs/selection.json': selection });
  fs.symlinkSync('../docs/selection.json', path.join(inside, '.quality/config.json'));
  assert.deepEqual(qualitySelection(inside), { present: true, config: '.quality/config.json', resolved: 'docs/selection.json', profiles: [core] });
  fs.writeFileSync(path.join(inside, 'docs/selection.json'), '{"profiles":[]}');
  assert.deepEqual(qualitySelection(inside), { present: false, config: '.quality/config.json', resolved: 'docs/selection.json', error: 'invalid structure: profiles must NOT have fewer than 1 items', profiles: [] });
  const ordinary = repository('config-ordinary', { ...installed, '.quality/config.json': selection });
  assert.deepEqual(qualitySelection(ordinary), { present: true, config: '.quality/config.json', profiles: [core] });
});

