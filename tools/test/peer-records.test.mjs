// Native filesystem/CLI tests plus explicitly simulated platform mappings.
// Binding source identities require the package to stay unchanged during this suite.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { peerLocations, resolvePeerRecords } from '../lib/peer-records.mjs';
import { machineBase, repositoryKey } from '../lib/paths.mjs';
import { sourceManifest } from '../lib/bind.mjs';
import { packageRoot, scratch, repository, write, git, GIT_ENV } from '../test-support/bind.mjs';

let count = 0;
function options(workspace, extra = {}) {
  return { workspace, run: 'run_1', task: 'peer_1', host: { platform: process.platform, env: { LOCALAPPDATA: path.join(scratch, 'AppData') }, home: path.join(scratch, 'home') }, ...extra };
}
function bound(name) {
  const dir = repository(name, { 'README.md': '# Example\n', '.gitignore': '/.peer-skills-and-workflows/\n' });
  write(dir, { '.peer-skills-and-workflows/binding.md': '# Fixture binding\nREADME.md governs this fixture.\n' });
  const manifest = sourceManifest(dir, ['README.md'], { workflowSource: packageRoot });
  write(dir, { '.peer-skills-and-workflows/binding-sources.json': JSON.stringify(manifest) });
  return dir;
}
function cli(workspace, ...args) {
  return spawnSync(process.execPath, [path.join(packageRoot, 'tools/peer-records.mjs'), '--workspace', workspace, '--run', 'run_1', '--task', 'peer_1', ...args], { env: GIT_ENV, encoding: 'utf8' });
}
function tree(dir) {
  if (!fs.existsSync(dir)) return null;
  const rows = [];
  function visit(parent) {
    for (const name of fs.readdirSync(parent).sort()) {
      const p = path.join(parent, name); const s = fs.lstatSync(p);
      rows.push([path.relative(dir, p), s.isFile() ? fs.readFileSync(p).toString('base64') : s.isSymbolicLink() ? fs.readlinkSync(p) : 'directory']);
      if (s.isDirectory() && !s.isSymbolicLink()) visit(p);
    }
  }
  visit(dir);
  return rows;
}
function link(t, target, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  try { fs.symlinkSync(target, dest, process.platform === 'win32' ? 'junction' : 'dir'); return true; }
  catch (error) { if (error.code === 'EPERM') { t.skip('host does not permit symlinks'); return false; } throw error; }
}

test('platform mappings reuse shared roots and separate workspace/run/task identities (simulated)', () => {
  for (const host of [
    { platform: 'linux', env: { XDG_STATE_HOME: '/state' }, home: '/home/a' },
    { platform: 'darwin', env: {}, home: '/Users/a' },
    { platform: 'win32', env: { LOCALAPPDATA: 'C:\\Local' }, home: 'C:\\Users\\a' },
  ]) {
    const p = host.platform === 'win32' ? path.win32 : path.posix;
    const w = host.platform === 'win32' ? 'C:\\work\\repo' : '/work/repo';
    const locations = peerLocations(host, w, 'run_1', 'peer_1');
    assert.equal(locations.externalRecords, p.join(machineBase(host), 'records/repositories', repositoryKey(w, host.platform), 'runs/run_1/peers/peer_1'));
    assert.equal(locations.localRecords, p.join(w, '.peer-skills-and-workflows/runs/run_1/peers/peer_1'));
    assert.notEqual(locations.scratch, locations.externalRecords);
    assert.notEqual(locations.externalRecords, peerLocations(host, w, 'run_1', 'peer_2').externalRecords);
    assert.notEqual(locations.externalRecords, peerLocations(host, w, 'run_2', 'peer_1').externalRecords);
    assert.notEqual(locations.externalRecords, peerLocations(host, p.join(w, 'other'), 'run_1', 'peer_1').externalRecords);
  }
  for (const bad of ['', '../x', 'a/b', 'a\\b', 'a..b', '.x', '-x', 'has space', null]) {
    assert.throws(() => peerLocations(options(scratch).host, scratch, bad, 'p'), /run id/);
    assert.throws(() => peerLocations(options(scratch).host, scratch, 'r', bad), /task id/);
  }
});

test('absent binding and plain folder resolve external storage without creating anything', () => {
  const repo = repository('unbound'); const folder = path.join(scratch, 'folder'); fs.mkdirSync(folder);
  for (const dir of [repo, folder]) {
    const before = tree(scratch); const result = resolvePeerRecords(options(dir));
    assert.equal(result.storage, 'external'); assert.equal(result.localCandidate, null);
    assert.equal(result.binding.state, dir === repo ? 'absent' : 'folder');
    assert.deepEqual(tree(scratch), before);
    assert.throws(() => resolvePeerRecords(options(dir, { storage: 'local' })), /require current mechanical/);
  }
});

test('current mechanical facts offer a candidate but do not claim a binding CHECK', () => {
  const dir = bound('current'); const before = tree(dir);
  const result = resolvePeerRecords(options(dir));
  assert.equal(result.storage, 'external'); assert.equal(result.binding.eligibleForCheck, true);
  assert.equal(result.localCandidate, path.join(dir, '.peer-skills-and-workflows/runs/run_1/peers/peer_1'));
  assert.equal(result.bindingCheckRequired, true); assert.match(result.scope, /also requires current binding CHECK evidence/);
  assert.equal(resolvePeerRecords(options(dir, { storage: 'local' })).recordsRoot, result.localCandidate);
  assert.deepEqual(tree(dir), before, 'resolution creates neither records nor scratch and leaves binding unchanged');
  write(dir, { 'README.md': '# Changed\n' });
  const stale = resolvePeerRecords(options(dir));
  assert.equal(stale.localCandidate, null); assert.equal(stale.binding.facts.recordedSourcesCurrent, false);
  assert.throws(() => resolvePeerRecords(options(dir, { storage: 'local' })), /require current mechanical/);
});

test('new discovered guidance is exposed for CHECK even while recorded sources match', () => {
  const dir = bound('new-guidance'); write(dir, { 'AGENTS.md': 'Additional instruction\n' });
  const result = resolvePeerRecords(options(dir));
  assert.equal(result.binding.eligibleForCheck, true);
  assert.equal(result.bindingCheckRequired, true);
  assert.ok(result.binding.inspection.candidates.some(c => c.path === 'AGENTS.md'));
  assert.equal(result.storage, 'external', 'the tool never turns mechanical facts into a semantic currentness verdict');
});

test('copied, malformed, partial and unprotected bindings never select local', () => {
  const original = bound('copy-origin'); const copy = repository('copy-destination', { 'README.md': '# Example\n', '.gitignore': '/.peer-skills-and-workflows/\n' });
  fs.cpSync(path.join(original, '.peer-skills-and-workflows'), path.join(copy, '.peer-skills-and-workflows'), { recursive: true });
  assert.equal(resolvePeerRecords(options(copy)).binding.facts.exactCheckout, false);
  for (const type of ['malformed', 'partial', 'unprotected', 'tracked']) {
    const dir = bound(type);
    if (type === 'malformed') write(dir, { '.peer-skills-and-workflows/binding-sources.json': '{oops' });
    if (type === 'partial') fs.unlinkSync(path.join(dir, '.peer-skills-and-workflows/binding.md'));
    if (type === 'unprotected') write(dir, { '.gitignore': '' });
    if (type === 'tracked') git(dir, 'add', '-f', '.peer-skills-and-workflows/binding.md');
    const result = resolvePeerRecords(options(dir));
    assert.equal(result.localCandidate, null, type);
    assert.throws(() => resolvePeerRecords(options(dir, { storage: 'local' })), /require current mechanical/, type);
  }
});

test('occupied or linked local roots are refused without touching occupants; explicit external remains independent', t => {
  for (const kind of ['file', 'link', 'run-link']) {
    const dir = kind === 'run-link' ? bound(`occupied-${kind}`) : repository(`occupied-${kind}`);
    const occupant = path.join(dir, '.peer-skills-and-workflows', ...(kind === 'run-link' ? ['runs'] : []));
    if (kind === 'file') fs.writeFileSync(occupant, 'preserve');
    else if (!link(t, scratch, occupant)) return;
    const before = tree(dir);
    assert.throws(() => resolvePeerRecords(options(dir)), /occupied/);
    assert.equal(resolvePeerRecords(options(dir, { storage: 'external' })).binding.state, 'not-inspected');
    assert.deepEqual(tree(dir), before);
  }
});

test('linked binding children are reported, never read as ordinary files', t => {
  const dir = bound('linked-child'); const child = path.join(dir, '.peer-skills-and-workflows/binding.md'); fs.unlinkSync(child);
  if (!link(t, path.join(scratch, 'missing-binding'), child)) return;
  const result = resolvePeerRecords(options(dir));
  assert.equal(result.localCandidate, null); assert.equal(result.binding.inspection.binding.state.kind, 'link');
});

test('workspace aliases share identities while scratch/workspace aliases are refused', t => {
  const dir = repository('aliased-workspace'); const alias = path.join(scratch, 'workspace-alias');
  if (!link(t, dir, alias)) return;
  assert.equal(resolvePeerRecords(options(alias)).recordsRoot, resolvePeerRecords(options(dir)).recordsRoot);
  const host = { platform: process.platform, env: { LOCALAPPDATA: path.join(scratch, 'alias-app') }, home: path.join(scratch, 'alias-home') };
  const roots = peerLocations(host, dir, 'r', 't');
  if (!link(t, dir, path.dirname(roots.scratch))) return;
  assert.throws(() => resolvePeerRecords({ workspace: dir, run: 'r', task: 't', host }), /scratch root overlaps workspace/);
});

test('selected external namespaces reject occupants, links and records/scratch aliasing', t => {
  for (const kind of ['file', 'link']) {
    const dir = repository(`external-${kind}`); const host = options(dir).host;
    host.home = path.join(scratch, `external-home-${count++}`); host.env.LOCALAPPDATA = path.join(scratch, `external-app-${count++}`);
    const roots = peerLocations(host, dir, 'r', 't');
    fs.mkdirSync(path.dirname(roots.externalRecords), { recursive: true });
    if (kind === 'file') fs.writeFileSync(roots.externalRecords, 'preserve');
    else { fs.mkdirSync(roots.scratch, { recursive: true }); if (!link(t, roots.scratch, roots.externalRecords)) return; }
    assert.throws(() => resolvePeerRecords({ workspace: dir, run: 'r', task: 't', host }), /occupied|overlap/);
  }
});

test('unreadable binding source returns unavailable facts, not stale or absent', t => {
  const dir = bound('unreadable'); const file = path.join(dir, 'README.md'); fs.chmodSync(file, 0);
  try {
    try { fs.readFileSync(file); t.skip('host can read mode 000'); return; } catch { /* expected */ }
    assert.throws(() => resolvePeerRecords(options(dir)), error => /inspection unavailable/.test(error.message) && error.inspection?.binding?.comparison?.complete === false);
    assert.equal(resolvePeerRecords(options(dir, { storage: 'external' })).storage, 'external');
  } finally { fs.chmodSync(file, 0o644); }
});

test('CLI help and invalid syntax do not create records; resolution errors have JSON causes', () => {
  assert.equal(cli(scratch, '--help').status, 0);
  assert.equal(cli(scratch, '--unknown').status, 2);
  const bad = cli(scratch, '--storage', 'bogus'); assert.equal(bad.status, 1);
  assert.match(JSON.parse(bad.stderr).error, /local or external/);
});

test('a minimal installed-link package works unbound without ajv; bound missing dependency is explicit', t => {
  const pkg = path.join(scratch, 'minimal-package');
  for (const name of ['tools/peer-records.mjs', 'tools/bind.mjs', 'tools/lib/peer-records.mjs', 'tools/lib/cli.mjs', 'tools/lib/paths.mjs', 'tools/lib/bind.mjs', 'tools/lib/git.mjs', 'skills/peer-review/SKILL.md']) {
    const dest = path.join(pkg, name); fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.copyFileSync(path.join(packageRoot, name), dest);
  }
  const installed = path.join(scratch, 'installed-peer-review'); if (!link(t, path.join(pkg, 'skills/peer-review'), installed)) return;
  const realSkill = fs.realpathSync(installed); const tool = path.resolve(realSkill, '../../tools/peer-records.mjs');
  const dir = repository('minimal-target');
  const run = (...args) => spawnSync(process.execPath, [tool, '--workspace', dir, '--run', 'r', '--task', 't', ...args], { env: { ...GIT_ENV, NODE_PATH: '' }, encoding: 'utf8' });
  assert.equal(run().status, 0);
  write(dir, { '.peer-skills-and-workflows/binding.md': '# Binding\n' });
  const missing = run(); assert.equal(missing.status, 1);
  assert.match(JSON.parse(missing.stderr).error, /'ajv' runtime dependency is missing/);
  assert.equal(run('--storage', 'external').status, 0);
});
