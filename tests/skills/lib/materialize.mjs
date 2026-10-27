// Materializing what an attempt runs against, all under the external run
// directory: the pinned source tree, a byte-exact copy of a case's fixture
// workspace, the engines' project-level skill links into that source tree,
// and a Git repository in the workspace as the retained trials had.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { digestOfManifest, manifestOf, sha256, writeJson } from './common.mjs';

const GIT_IDENTITY = ['-c', 'user.name=skill-suite', '-c', 'user.email=skill-suite@localhost', '-c', 'commit.gpgsign=false', '-c', `core.hooksPath=${os.devNull}`];

/** Git with the caller's checkout-specific variables and personal configuration out of the way. */
export function git(args, cwd, { input } = {}) {
  const env = {};
  for (const [key, value] of Object.entries(process.env)) if (!key.startsWith('GIT_')) env[key] = value;
  env.GIT_CONFIG_NOSYSTEM = '1';
  env.GIT_CONFIG_GLOBAL = os.devNull;
  env.GIT_OPTIONAL_LOCKS = '0';
  const result = spawnSync('git', args, { cwd, env, input, encoding: 'buffer', maxBuffer: 256 * 1024 * 1024 });
  if (result.error) throw new Error(`cannot run git ${args[0]}: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed (${result.status}): ${result.stderr.toString('utf8').trim()}`);
  return result.stdout;
}

/** The tree id that `treeish` names in `repo`, or a thrown error. */
export function resolveTree(repo, treeish) {
  return git(['rev-parse', '--verify', `${treeish}^{tree}`], repo).toString('utf8').trim();
}

/**
 * Write the files of Git tree `tree` from `repo` into `dest` (created, must
 * not exist), file by file through `git cat-file`, preserving executable bits
 * and symbolic links. With `prefix`, only the files under that directory of
 * the tree are written, relative to it. Returns the manifest of what was
 * written.
 */
export function materializeTree(repo, tree, dest, prefix = null) {
  if (fs.existsSync(dest)) throw new Error(`source destination ${dest} already exists`);
  const listing = git(['ls-tree', '-r', '-z', tree, ...(prefix ? ['--', prefix] : [])], repo).toString('utf8');
  fs.mkdirSync(dest, { recursive: true });
  for (const record of listing.split('\0')) {
    if (!record) continue;
    const match = /^(\d{6}) (\w+) ([0-9a-f]{40,64})\t(.+)$/s.exec(record);
    if (!match) throw new Error(`unexpected ls-tree record: ${record}`);
    const [, mode, type, object, fullPath] = match;
    if (type !== 'blob') continue;
    const relative = prefix ? fullPath.slice(`${prefix}/`.length) : fullPath;
    if (prefix && !fullPath.startsWith(`${prefix}/`)) continue;
    const target = path.join(dest, ...relative.split('/'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const content = git(['cat-file', 'blob', object], repo);
    if (mode === '120000') fs.symlinkSync(content.toString('utf8'), target);
    else fs.writeFileSync(target, content, { mode: mode === '100755' ? 0o755 : 0o644 });
  }
  return manifestOf(dest);
}

/** Copy an already materialized directory (for example a working tree) into `dest`, byte for byte. */
export function materializeDirectory(source, dest) {
  if (fs.existsSync(dest)) throw new Error(`source destination ${dest} already exists`);
  fs.cpSync(source, dest, { recursive: true, errorOnExist: true, force: false, verbatimSymlinks: true, filter: (item) => path.basename(item) !== '.git' && path.basename(item) !== 'node_modules' });
  return manifestOf(dest);
}

/** Identity of a materialized source: its tree id when it came from Git, and always a content digest. */
export function sourceIdentity(manifest, tree = null) {
  return { tree, digest: digestOfManifest(manifest), files: Object.keys(manifest).length };
}

/**
 * Copy a case's fixture workspace into `dest`, byte for byte, and return the
 * manifest of the copy, checked against the suite's recorded manifest so a
 * fixture changed since the suite was loaded is caught before launch.
 */
export function copyWorkspace(fixtureDir, dest, expectedManifest) {
  if (fs.existsSync(dest)) throw new Error(`workspace ${dest} already exists`);
  fs.cpSync(fixtureDir, dest, { recursive: true, errorOnExist: true, force: false });
  const manifest = manifestOf(dest);
  if (digestOfManifest(manifest) !== digestOfManifest(expectedManifest)) {
    throw new Error(`workspace copy at ${dest} does not match the suite's fixture manifest`);
  }
  return manifest;
}

/**
 * Make `skills` discoverable to both engines from the workspace: project-level
 * `.claude/skills/<name>` and `.agents/skills/<name>` links to the materialized
 * source's `skills/<name>`. Junctions on Windows, as the installer uses.
 */
export function installSkillLinks(workspace, sourceRoot, skills, platform = process.platform) {
  const type = platform === 'win32' ? 'junction' : 'dir';
  const links = [];
  for (const scope of ['.claude', '.agents']) {
    const dir = path.join(workspace, scope, 'skills');
    fs.mkdirSync(dir, { recursive: true });
    for (const skill of skills) {
      const target = path.join(sourceRoot, 'skills', skill);
      if (!fs.existsSync(path.join(target, 'SKILL.md'))) throw new Error(`skill '${skill}' has no SKILL.md in the source tree at ${target}`);
      const dest = path.join(dir, skill);
      fs.symlinkSync(target, dest, type);
      links.push({ link: path.relative(workspace, dest).split(path.sep).join('/'), target });
    }
  }
  return links;
}

/**
 * Turn the workspace into a Git repository with one commit of the fixture,
 * the skill link directories excluded locally, and return the commit and
 * tree ids so a trace's Git activity can be read against them.
 */
export function initWorkspaceGit(workspace) {
  git(['init', '-q', '-b', 'main'], workspace);
  fs.writeFileSync(path.join(workspace, '.git', 'info', 'exclude'), '.agents/\n.claude/\n');
  git([...GIT_IDENTITY, 'add', '-A'], workspace);
  git([...GIT_IDENTITY, 'commit', '-q', '--allow-empty', '-m', 'fixture'], workspace);
  const head = git(['rev-parse', 'HEAD'], workspace).toString('utf8').trim();
  const tree = git(['rev-parse', 'HEAD^{tree}'], workspace).toString('utf8').trim();
  return { head, tree };
}

/** Write `manifest.json`-style records for a fixture copy, with a digest, beside it. */
export function recordManifest(file, manifest) {
  writeJson(file, { digest: digestOfManifest(manifest), files: manifest });
}

export { sha256 };
