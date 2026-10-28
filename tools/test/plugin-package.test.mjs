import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = (relative) => {
  const file = path.join(root, relative);
  assert.ok(fs.existsSync(file), `Git package requires ${relative}`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
};

test('one peer root package supplies separate native catalogs and hook declarations', () => {
  const codex = read('.codex-plugin/plugin.json');
  const claude = read('.claude-plugin/plugin.json');
  const codexCatalog = read('.agents/plugins/marketplace.json');
  const claudeCatalog = read('.claude-plugin/marketplace.json');
  for (const value of [codex, claude, codexCatalog, claudeCatalog]) assert.equal(value.name, 'peer');
  for (const catalog of [codexCatalog, claudeCatalog]) {
    assert.equal(catalog.plugins.length, 1);
    assert.equal(catalog.plugins[0].name, 'peer');
  }
  assert.deepEqual(codexCatalog.plugins[0].source, { source: 'local', path: './' });
  assert.equal(claudeCatalog.plugins[0].source, './');
  assert.equal(codex.skills, './skills/');
  assert.equal(fs.existsSync(path.join(root, 'plugin.json')), false);
  assert.equal(fs.existsSync(path.join(root, 'hooks/hooks.json')), false);
  for (const [engine, manifest, variable] of [
    ['codex', codex, 'PLUGIN_ROOT'], ['claude', claude, 'CLAUDE_PLUGIN_ROOT'],
  ]) {
    assert.equal(manifest.hooks, `./hooks/${engine}.json`);
    assert.equal(manifest.version, undefined, 'release identity comes from Git');
    const hooks = read(manifest.hooks).hooks;
    assert.deepEqual(Object.keys(hooks).sort(), ['SessionStart', 'Stop', 'UserPromptSubmit']);
    for (const groups of Object.values(hooks)) {
      assert.deepEqual(groups, [{ hooks: [{
        type: 'command', command: `node "\${${variable}}/tools/successor.mjs" hook --engine ${engine}`,
      }] }]);
    }
  }
});

test('the offline gate validates the native package and rejects drift', async (t) => {
  const validator = path.join(root, 'tools/lib/plugin-package.mjs');
  assert.ok(fs.existsSync(validator), 'the package needs an offline plugin package validator');
  assert.match(fs.readFileSync(path.join(root, 'tools/verify.mjs'), 'utf8'), /checkPluginPackage\(/, 'verify runs the validator');
  const { checkPluginPackage } = await import(validator);
  const errors = [];
  const out = { info() {}, error(message) { errors.push(message); } };
  assert.equal(checkPluginPackage({ sourceRoot: root, out }), true, errors.join('\n'));
  const edit = (file, change) => (copy) => {
    const target = path.join(copy, file);
    const value = JSON.parse(fs.readFileSync(target, 'utf8')); change(value);
    fs.writeFileSync(target, JSON.stringify(value));
  };
  const mutations = {
    name: edit('.claude-plugin/plugin.json', (v) => { v.name = 'peer2'; }),
    escapingHooks: edit('.codex-plugin/plugin.json', (v) => { v.hooks = './../hooks/codex.json'; }),
    catalogSource: edit('.claude-plugin/marketplace.json', (v) => { v.plugins[0].source = './plugins/peer'; }),
    catalogField: edit('.agents/plugins/marketplace.json', (v) => { delete v.plugins[0].policy; }),
    missingComponent: edit('.codex-plugin/plugin.json', (v) => { v.skills = './missing/'; }),
    wrongEngine: edit('hooks/claude.json', (v) => { v.hooks.Stop[0].hooks[0].command = v.hooks.Stop[0].hooks[0].command.replace('--engine claude', '--engine codex'); }),
    version: edit('.codex-plugin/plugin.json', (v) => { v.version = '1.0.0'; }),
    portableManifest: (copy) => fs.writeFileSync(path.join(copy, 'plugin.json'), '{"name":"peer"}'),
    defaultHooks: (copy) => fs.writeFileSync(path.join(copy, 'hooks/hooks.json'), '{}'),
    linkedHooks: (copy) => {
      fs.renameSync(path.join(copy, 'hooks'), `${copy}-hooks`);
      fs.symlinkSync(`${copy}-hooks`, path.join(copy, 'hooks'), process.platform === 'win32' ? 'junction' : 'dir');
    },
    straySkill: (copy) => { fs.mkdirSync(path.join(copy, 'skills/stray')); fs.writeFileSync(path.join(copy, 'skills/stray/SKILL.md'), '---\nname: stray\n---\n'); },
  };
  for (const [name, mutate] of Object.entries(mutations)) {
    await t.test(name, () => {
      const copy = fs.mkdtempSync(path.join(os.tmpdir(), `peer-package-${name}-`));
      try {
        for (const part of ['.claude-plugin', '.codex-plugin', '.agents', 'hooks', 'skills', 'tools']) {
          fs.cpSync(path.join(root, part), path.join(copy, part), { recursive: true, filter: (source) => path.basename(source) !== 'node_modules' });
        }
        errors.length = 0;
        assert.equal(checkPluginPackage({ sourceRoot: copy, out }), true, `unmodified ${name} fixture: ${errors.join('\n')}`);
        mutate(copy);
        errors.length = 0;
        assert.equal(checkPluginPackage({ sourceRoot: copy, out }), false, `${name} must fail package validation`);
        assert.ok(errors.length, `${name} needs an actionable diagnostic`);
      } finally {
        fs.rmSync(copy, { recursive: true, force: true });
        fs.rmSync(`${copy}-hooks`, { recursive: true, force: true });
      }
    });
  }
});
