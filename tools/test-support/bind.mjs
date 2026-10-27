// Fixtures shared by the binding tests (tools/test/bind-*.test.mjs). This
// directory lies outside Node's test-file patterns, so it is imported, never run.
// Each test file process gets its own temporary directory, removed after its
// tests, so files run concurrently without sharing fixture repositories. The
// binding helper is exercised against disposable Git repositories there,
// leaving this checkout's project files and workflow records unchanged. Git
// queries may update administrative caches.
//
// Precondition: this package's instruction files (SOURCE_PARTS in
// tools/lib/bind.mjs) must not change while the binding tests run. The CLI
// identifies the workflow source it runs from, this checkout, on every call,
// and tests that record a manifest with it (through the CLI or
// `sourceManifest(..., { workflowSource: packageRoot })`) expect a later
// comparison to be current. An edit during the run correctly makes such a
// comparison not current; its assertion message shows the comparison, where
// `workflowSourceChanged` names that cause.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after } from 'node:test';
import { fileURLToPath } from 'node:url';
import { excludeFile } from '../lib/bind.mjs';

// Hooks export checkout-specific Git paths. Clear them in this test process
// so both direct helper calls and subprocesses use the fixture repositories,
// including children whose .git entry is a file.
for (const key of Object.keys(process.env)) {
  if (key.startsWith('GIT_')) delete process.env[key];
}

export const packageRoot = fs.realpathSync.native(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..'));
export const cli = path.join(packageRoot, 'tools', 'bind.mjs');
export const scratch = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'aw bind é-')));
after(() => fs.rmSync(scratch, { recursive: true, force: true }));

/** Whether the filesystem holding the test scratch treats differently cased names as one entry. */
export const scratchFoldsCase = (() => {
  const probe = path.join(scratch, 'case-probe');
  fs.mkdirSync(probe);
  try { return fs.existsSync(path.join(scratch, 'CASE-PROBE')); } finally { fs.rmdirSync(probe); }
})();

export const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 'test@example.com', GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 'test@example.com',
  GIT_CONFIG_GLOBAL: path.join(scratch, 'no-global-gitconfig'), GIT_CONFIG_NOSYSTEM: '1',
};

export function git(cwd, ...args) {
  const result = spawnSync('git', args, { cwd, env: GIT_ENV, encoding: 'utf8' });
  assert.equal(result.status, 0, `git ${args.join(' ')}: ${result.stderr}`);
  return result.stdout;
}

export function run(command, ...args) {
  const result = spawnSync(process.execPath, [cli, command, ...args], { encoding: 'utf8', env: GIT_ENV });
  let json = null;
  try { json = JSON.parse(result.stdout); } catch { /* not JSON */ }
  return { ...result, json };
}

/** A committed repository with the given files; `.quality` fixtures are added by name. */
export function repository(name, files = {}, { commit = true } = {}) {
  const dir = path.join(scratch, name);
  fs.mkdirSync(dir, { recursive: true });
  git(dir, 'init', '-q', '-b', 'main');
  write(dir, files);
  if (commit && Object.keys(files).length) {
    git(dir, 'add', '-A');
    git(dir, 'commit', '-q', '-m', 'initial');
  }
  return fs.realpathSync.native(dir);
}

export function write(dir, files) {
  for (const [file, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), text);
  }
}

export const qualityFixture = {
  '.quality/config.json': JSON.stringify({ profiles: [{ profileId: 'profile:acme/defaults', path: 'profiles/acme-defaults' }] }),
  '.quality/profiles/acme-defaults/_manifest/profile.json': JSON.stringify({
    profileId: 'profile:acme/defaults', version: '1.0.0',
    inherits: [{ profileId: 'profile:acme/core', versionRequirement: '=1.0.0' }],
    requires: [{ profileId: 'profile:acme/reference', versionRequirement: '=1.0.0' }], sources: [],
  }),
  '.quality/profiles/acme-core/_manifest/profile.json': JSON.stringify({ profileId: 'profile:acme/core', version: '1.0.0', inherits: [], requires: [] }),
  '.quality/profiles/acme-core/README.md': '# Core\n',
  'docs/qualities/README.md': '# Local rubric extension\n',
  'docs/CONTRIBUTING.md': '# Contributing\nRun `make check`.\n',
  'AGENTS.md': '# Agents\n',
  'src/deep/AGENTS.md': '# Scoped\n',
  'README.md': '# Project\n',
  'Makefile': 'check:\n\ttrue\n',
};

export function treeState(dir) {
  return {
    status: git(dir, 'status', '--porcelain', '-z'),
    index: git(dir, 'ls-files', '-s', '-z'),
    head: git(dir, 'rev-parse', 'HEAD').trim(),
  };
}

/** The local exclude file's content, or null when Git's template did not create one. */
export function excludeContent(dir) {
  return fs.existsSync(excludeFile(dir)) ? fs.readFileSync(excludeFile(dir), 'utf8') : null;
}

/** Local records written to probe what Git lists after setup. */
export const LOCAL_RECORDS = { '.agent-workflow/binding.md': 'b\n', '.agent-workflow/binding-sources.json': '{}', '.agent-workflow/runs/run_x/report.md': 'r\n' };

export function visibleLocal(dir) {
  write(dir, LOCAL_RECORDS);
  return git(dir, 'ls-files', '-o', '--exclude-standard', '-z', '--', '.agent-workflow').split('\0').filter(Boolean);
}

/**
 * Add an index entry whose name is the given bytes, with no working file, so a
 * name that is not UTF-8 can be tested on any host, whatever names its
 * filesystem accepts.
 */
export function indexOnlyEntry(dir, mode, object, name) {
  const input = Buffer.concat([Buffer.from(`${mode} ${object}\t`), name, Buffer.from([0])]);
  const result = spawnSync('git', ['update-index', '-z', '--index-info'], { cwd: dir, env: GIT_ENV, input });
  assert.equal(result.status, 0, `git update-index --index-info: ${result.stderr}`);
}
