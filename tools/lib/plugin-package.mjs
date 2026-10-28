// Validate this repository's tested native package contract. Runtime loading,
// hook trust and model selection still need the separate native checks.
import fs from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { PACKAGE_SKILLS } from './install.mjs';
import { isWithin } from './paths.mjs';

const EVENTS = ['SessionStart', 'Stop', 'UserPromptSubmit'];
const requireCondition = (value, message) => { if (!value) throw new Error(message); };
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

function fields(value, required, label) {
  requireCondition(object(value), `${label} must be an object`);
  requireCondition(isDeepStrictEqual(Object.keys(value).sort(), [...required].sort()),
    `${label} must contain exactly: ${required.join(', ')}`);
}

function absent(file) {
  try { fs.lstatSync(file); return false; }
  catch (error) { if (error.code === 'ENOENT') return true; throw error; }
}

/** Read-only validation; return false with a path-specific diagnostic on failure. */
export function checkPluginPackage({ sourceRoot, out }) {
  try {
    const root = fs.realpathSync(sourceRoot);
    const component = (relative, kind = 'file') => {
      requireCondition(typeof relative === 'string' && relative.length > 0 && !path.isAbsolute(relative),
        `component path must be relative: ${relative}`);
      const file = path.resolve(root, relative);
      requireCondition(isWithin(root, file), `component escapes the package: ${relative}`);
      const real = fs.realpathSync(file);
      requireCondition(real === file && isWithin(root, real), `component crosses a link: ${relative}`);
      const stat = fs.statSync(real);
      requireCondition(kind === 'directory' ? stat.isDirectory() : stat.isFile(), `${relative} must be a ${kind}`);
      return real;
    };
    const read = (relative) => JSON.parse(fs.readFileSync(component(relative), 'utf8'));
    for (const file of ['plugin.json', 'hooks/hooks.json']) {
      requireCondition(absent(path.join(root, file)), `${file} must be absent; use explicit engine manifests and hooks`);
    }
    for (const engine of ['codex', 'claude']) {
      const manifestPath = `.${engine}-plugin/plugin.json`;
      const manifest = read(manifestPath);
      fields(manifest, ['name', 'description', 'hooks', ...(engine === 'codex' ? ['skills'] : [])], manifestPath);
      requireCondition(manifest.name === 'peer', `${manifestPath}: name must be peer`);
      requireCondition(typeof manifest.description === 'string' && manifest.description.trim() !== '', `${manifestPath}: description is required`);
      const hookPath = `./hooks/${engine}.json`;
      component(manifest.hooks);
      requireCondition(manifest.hooks === hookPath, `${manifestPath}: hooks must be ${hookPath}`);
      if (engine === 'codex') {
        component(manifest.skills, 'directory');
        requireCondition(manifest.skills === './skills/', `${manifestPath}: skills must be ./skills/`);
      }
      const hookFile = read(hookPath);
      fields(hookFile, ['hooks'], hookPath);
      fields(hookFile.hooks, EVENTS, `${hookPath}: hooks`);
      const variable = engine === 'codex' ? 'PLUGIN_ROOT' : 'CLAUDE_PLUGIN_ROOT';
      const expected = [{ hooks: [{ type: 'command', command: `node "\${${variable}}/tools/successor.mjs" hook --engine ${engine}` }] }];
      for (const event of EVENTS) {
        requireCondition(isDeepStrictEqual(hookFile.hooks[event], expected), `${hookPath}: ${event} must run exactly one quoted ${engine} successor command`);
      }
    }
    component('tools/successor.mjs');
    const claudePath = '.claude-plugin/marketplace.json';
    const claude = read(claudePath);
    fields(claude, ['name', 'owner', 'plugins'], claudePath);
    fields(claude.owner, ['name'], `${claudePath}: owner`);
    requireCondition(typeof claude.owner.name === 'string' && claude.owner.name.trim() !== '', `${claudePath}: owner.name is required`);
    const codexPath = '.agents/plugins/marketplace.json';
    const codex = read(codexPath);
    fields(codex, ['name', 'plugins'], codexPath);
    for (const [catalog, relative] of [[claude, claudePath], [codex, codexPath]]) {
      requireCondition(catalog.name === 'peer', `${relative}: marketplace name must be peer`);
      requireCondition(Array.isArray(catalog.plugins) && catalog.plugins.length === 1, `${relative}: declare exactly one plugin`);
      requireCondition(catalog.plugins[0].name === 'peer', `${relative}: plugin name must be peer`);
    }
    fields(claude.plugins[0], ['name', 'source'], `${claudePath}: plugin`);
    requireCondition(claude.plugins[0].source === './', `${claudePath}: plugin source must be ./`);
    fields(codex.plugins[0], ['name', 'source', 'policy', 'category'], `${codexPath}: plugin`);
    requireCondition(isDeepStrictEqual(codex.plugins[0].source, { source: 'local', path: './' }), `${codexPath}: source must be local with path ./`);
    requireCondition(isDeepStrictEqual(codex.plugins[0].policy, { installation: 'AVAILABLE', authentication: 'ON_INSTALL' }), `${codexPath}: invalid native installation/authentication policy`);
    requireCondition(codex.plugins[0].category === 'Productivity', `${codexPath}: category must be Productivity`);
    const skillDirectory = component('skills', 'directory');
    const skills = fs.readdirSync(skillDirectory, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() || entry.isSymbolicLink()).map((entry) => entry.name).sort();
    requireCondition(isDeepStrictEqual(skills, [...PACKAGE_SKILLS].sort()), 'skills/: plugin membership must match the installer skill sets');
    for (const skill of skills) component(`skills/${skill}/SKILL.md`);
    out.info('ok      native peer catalogs, manifests, hooks and skill membership');
    return true;
  } catch (error) {
    out.error(`FAIL    plugin package: ${error.message}`);
    return false;
  }
}
