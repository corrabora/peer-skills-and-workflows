// Validate this repository's tested native package contract. Runtime loading,
// hook trust and model selection still need the separate native checks.
import fs from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { checkReferences, PACKAGE_SKILLS, referencesIn } from './install.mjs';
import { isWithin } from './paths.mjs';
import { PAYLOAD_DIRECTORY } from './plugin-payload.mjs';

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

/**
 * Included documents whose own links are repository navigation for people,
 * such as README's links to tests and quality profiles. Runtime documents may
 * link to them, so they must exist in the payload, but their onward links are
 * not followed or required there.
 */
const NAVIGATION_ENDPOINTS = ['README.md', 'docs/installation.md'];
const SCHEME = /^[A-Za-z][A-Za-z0-9+.-]+:/;

/**
 * The payload's agent-read documents: every Markdown file under `skills/` and
 * `workflow/`, and the payload Markdown files they reach through relative
 * links, short of the navigation endpoints.
 */
function runtimeDocuments(root) {
  const seen = new Set();
  const queue = [];
  const add = (file) => {
    if (!seen.has(file)) { seen.add(file); queue.push(file); }
  };
  const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith('.md')) add(full);
    }
  };
  for (const directory of ['skills', 'workflow']) walk(path.join(root, directory));
  const endpoints = new Set(NAVIGATION_ENDPOINTS.map((relative) => path.join(root, ...relative.split('/'))));
  while (queue.length) {
    const file = queue.shift();
    for (const { target } of referencesIn(fs.readFileSync(file, 'utf8')).links) {
      const pathPart = target.replace(/[#?].*$/, '');
      if (!pathPart || target.startsWith('<') || SCHEME.test(target)) continue;
      let linked;
      try { linked = path.resolve(path.dirname(file), decodeURIComponent(pathPart)); } catch { continue; } // checkReferences reports it
      if (linked.endsWith('.md') && isWithin(root, linked) && !endpoints.has(linked) && fs.existsSync(linked)) {
        requireCondition(fs.realpathSync(linked) === linked, `runtime reference crosses a link: ${path.relative(root, linked)}`);
        requireCondition(fs.lstatSync(linked).isFile(), `runtime reference must be a regular file: ${path.relative(root, linked)}`);
        add(linked);
      }
    }
  }
  return [...seen].sort();
}

/**
 * Read-only validation of the root catalogs and the payload they select;
 * return false with a path-specific diagnostic on failure.
 */
export function checkPluginPackage({ sourceRoot, out }) {
  let scope = 'checkout';
  try {
    let root = fs.realpathSync(sourceRoot);
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
    const source = `./${PAYLOAD_DIRECTORY}`;
    fields(claude.plugins[0], ['name', 'source'], `${claudePath}: plugin`);
    requireCondition(claude.plugins[0].source === source, `${claudePath}: plugin source must be ${source}`);
    fields(codex.plugins[0], ['name', 'source', 'policy', 'category'], `${codexPath}: plugin`);
    requireCondition(isDeepStrictEqual(codex.plugins[0].source, { source: 'local', path: source }), `${codexPath}: source must be local with path ${source}`);
    requireCondition(isDeepStrictEqual(codex.plugins[0].policy, { installation: 'AVAILABLE', authentication: 'ON_INSTALL' }), `${codexPath}: invalid native installation/authentication policy`);
    requireCondition(codex.plugins[0].category === 'Productivity', `${codexPath}: category must be Productivity`);
    // The remaining components belong to the selected payload.
    root = component(PAYLOAD_DIRECTORY, 'directory');
    scope = PAYLOAD_DIRECTORY;
    requireCondition(absent(path.join(root, '.git')), `${PAYLOAD_DIRECTORY}/.git must be absent; the payload carries no repository metadata`);
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
    const skillDirectory = component('skills', 'directory');
    const skills = fs.readdirSync(skillDirectory, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() || entry.isSymbolicLink()).map((entry) => entry.name).sort();
    requireCondition(isDeepStrictEqual(skills, [...PACKAGE_SKILLS].sort()), `${PAYLOAD_DIRECTORY}/skills/: plugin membership must match the installer skill sets`);
    for (const skill of skills) component(`skills/${skill}/SKILL.md`);
    const unresolved = [];
    checkReferences({ sourceRoot: root, files: runtimeDocuments(root), out: { info() {}, error: (line) => unresolved.push(line) } });
    requireCondition(unresolved.length === 0, `runtime references must resolve inside the payload:\n${unresolved.join('\n')}`);
    out.info('ok      native peer catalogs, manifests, hooks, skill membership and runtime references');
    return true;
  } catch (error) {
    out.error(`FAIL    plugin package (${scope}): ${error.message}`);
    return false;
  }
}
