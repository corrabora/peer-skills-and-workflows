import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { workflowSourceIdentity } from '../lib/bind.mjs';

// Distribution contract: marketplace installations must not copy the authoring
// checkout's Git state into the bundle that Codex fingerprints for hook trust.
const root = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));

test('both marketplaces select a complete plugin payload without repository metadata', () => {
  const codex = read('.agents/plugins/marketplace.json').plugins[0];
  const claude = read('.claude-plugin/marketplace.json').plugins[0];
  const payload = path.resolve(root, codex.source.path);
  assert.notEqual(payload, root, 'marketplace source must exclude the authoring checkout and its Git metadata');
  assert.equal(codex.source.source, 'local');
  assert.equal(path.resolve(root, claude.source), payload);
  assert.ok(payload.startsWith(root + path.sep));
  for (const relative of ['.git', '.codex', '.claude', 'tests', 'tools/test']) {
    assert.equal(fs.existsSync(path.join(payload, relative)), false, relative + ' must not enter the installed bundle');
  }
  for (const relative of ['LICENSE', 'package.json', 'defaults.yaml', '.codex-plugin/plugin.json', '.claude-plugin/plugin.json', 'hooks/codex.json', 'hooks/claude.json', 'tools/successor.mjs', 'tools/resolve.mjs', 'tools/bind.mjs', 'tools/peer-records.mjs', 'tools/vendor/node_modules/ajv/dist/ajv.js', 'tools/vendor/node_modules/yaml/dist/index.js', 'workflow/RECORDS.md']) {
    assert.ok(fs.lstatSync(path.join(payload, relative)).isFile(), relative + ' must be a regular runtime file');
  }
  const expectedSkills = fs.readdirSync(path.join(root, 'skills')).sort();
  assert.deepEqual(fs.readdirSync(path.join(payload, 'skills')).sort(), expectedSkills);
  for (const skill of expectedSkills) assert.ok(fs.lstatSync(path.join(payload, 'skills', skill, 'SKILL.md')).isFile());
});

test('the payload runs alone and keeps its content identity under a Git parent', (t) => {
  const scratch = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'peer runtime é-')));
  t.after(() => fs.rmSync(scratch, { recursive: true, force: true }));
  const emptyConfig = path.join(scratch, 'gitconfig');
  const templates = path.join(scratch, 'templates');
  fs.writeFileSync(emptyConfig, '');
  fs.mkdirSync(templates);
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
  Object.assign(env, { GIT_CONFIG_GLOBAL: emptyConfig, GIT_CONFIG_NOSYSTEM: '1', GIT_TEMPLATE_DIR: templates, GIT_OPTIONAL_LOCKS: '0' });
  const run = (command, args, input) => {
    const result = spawnSync(command, args, { cwd: scratch, env, input, encoding: 'utf8' });
    assert.equal(result.status, 0, `${command}: ${result.stderr}`);
    return result.stdout;
  };
  run('git', ['init', '-q']);
  run('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgSign=false', 'commit', '--no-verify', '--allow-empty', '-qm', 'Fixture']);
  const copy = path.join(scratch, 'installed', 'peer');
  fs.cpSync(path.join(root, 'plugins/peer'), copy, { recursive: true });
  const tool = (name, args, input) => run(process.execPath, [path.join(copy, 'tools', `${name}.mjs`), ...args], input);
  tool('resolve', ['--repo', scratch]);
  const identity = JSON.parse(tool('bind', ['inspect', '--repo', scratch])).workflowSource;
  assert.equal(identity.head, null, 'the installed copy must not claim its parent commit');
  assert.equal(identity.digestScope, 'all-files');
  assert.equal(identity.digest, workflowSourceIdentity(path.join(root, 'plugins/peer')).digest);
  tool('peer-records', ['--workspace', scratch, '--run', 'fixture', '--task', 'smoke', '--storage', 'external']);
  for (const engine of ['codex', 'claude']) {
    tool('successor', ['hook', '--engine', engine], JSON.stringify({ hook_event_name: 'SessionStart', session_id: randomUUID(), cwd: scratch }));
  }
  fs.appendFileSync(path.join(copy, 'workflow/RECORDS.md'), '\n');
  assert.notEqual(JSON.parse(tool('bind', ['inspect', '--repo', scratch])).workflowSource.digest, identity.digest);
});
