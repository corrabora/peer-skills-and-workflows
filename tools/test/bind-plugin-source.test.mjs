// A plugin update that changes only hook declarations or native manifests
// changes what the hosts load, so the workflow source identity must change too.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { workflowSourceIdentity } from '../lib/bind.mjs';
import { spawnSync } from 'node:child_process';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const scratch = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'aw plugin source é-')));
after(() => fs.rmSync(scratch, { recursive: true, force: true }));

const PLUGIN_FILES = [
  'hooks/claude.json', 'hooks/codex.json', '.claude-plugin/plugin.json', '.codex-plugin/plugin.json',
  '.claude-plugin/marketplace.json', '.agents/plugins/marketplace.json',
];

test('hook and native manifest edits change the workflow source identity of an installed copy', () => {
  for (const file of PLUGIN_FILES) {
    const copy = path.join(scratch, file.replaceAll('/', '_'));
    for (const part of ['skills', 'defaults.yaml', 'package.json', ...PLUGIN_FILES]) {
      fs.cpSync(path.join(packageRoot, part), path.join(copy, part), { recursive: true });
    }
    const before = workflowSourceIdentity(copy).digest;
    fs.appendFileSync(path.join(copy, file), '\n');
    assert.notEqual(workflowSourceIdentity(copy).digest, before, `${file} is part of the workflow source identity`);
  }
});

test('source inspection preserves the Git index of a stat-dirty installed package', () => {
  const source = path.join(scratch, 'git-package');
  fs.mkdirSync(source);
  const globalConfig = path.join(scratch, 'gitconfig');
  fs.writeFileSync(globalConfig, '');
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
  Object.assign(env, { GIT_CONFIG_GLOBAL: globalConfig, GIT_CONFIG_NOSYSTEM: '1', GIT_OPTIONAL_LOCKS: '1' });
  const git = (...args) => {
    const result = spawnSync('git', ['-C', source, ...args], { env, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  };
  git('init', '-q');
  const readme = path.join(source, 'README.md');
  fs.writeFileSync(readme, 'Installed package fixture.\n');
  git('add', 'README.md');
  git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgSign=false', 'commit', '--no-verify', '-qm', 'Fixture');
  const stat = fs.statSync(readme);
  fs.utimesSync(readme, stat.atime, new Date(stat.mtimeMs - 60_000));
  const index = path.join(source, '.git/index');
  const before = fs.readFileSync(index);
  const program = `import { workflowSourceIdentity } from ${JSON.stringify(new URL('../lib/bind.mjs', import.meta.url).href)};
console.log(JSON.stringify(workflowSourceIdentity(process.argv[1])));`;
  const inspected = spawnSync(process.execPath, ['--input-type=module', '-e', program, source], { env, input: '', encoding: 'utf8' });
  assert.equal(inspected.status, 0, inspected.stderr);
  const identity = JSON.parse(inspected.stdout);
  assert.match(identity.digest, /^sha256:/);
  assert.deepEqual(identity.dirty, []);
  assert.ok(fs.readFileSync(index).equals(before), 'source inspection must not rewrite the installed Git index and invalidate hook trust');
});
