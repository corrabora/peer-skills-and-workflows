#!/usr/bin/env node
// Enable this package's hook in its own clone, preserving other hook setups.
import fs from 'node:fs';
import path from 'node:path';
import { git } from './lib/git.mjs';
import { sourceRoot, terminal as out, usage } from './lib/cli.mjs';

if (process.argv.length !== 2) usage('node tools/install-hooks.mjs');
try {
  const root = fs.realpathSync(git(['rev-parse', '--show-toplevel']).trim());
  if (root !== sourceRoot) throw new Error('run hook setup from this workflow source checkout; it does not install hooks in target repositories');
  const configured = git(['config', '--get', 'core.hooksPath'], { allowMissing: true })?.trim();
  if (configured !== undefined && configured !== '.githooks') {
    throw new Error(`core.hooksPath is already ${JSON.stringify(configured)}; keep that setup and call tools/commit-verify.mjs from its commit-msg hook`);
  }
  if (configured === undefined) {
    const previous = path.resolve(root, git(['rev-parse', '--git-path', 'hooks']).trim());
    const active = fs.existsSync(previous) ? fs.readdirSync(previous).filter(name => !name.endsWith('.sample')) : [];
    if (active.length) throw new Error(`existing hooks in ${previous}: ${active.join(', ')}; integrate tools/commit-verify.mjs there rather than replacing the hook directory`);
  }
  fs.chmodSync(path.join(root, '.githooks', 'commit-msg'), 0o755);
  git(['config', '--local', 'core.hooksPath', '.githooks']);
  const active = path.resolve(root, git(['rev-parse', '--git-path', 'hooks/commit-msg']).trim());
  if (fs.realpathSync(active) !== fs.realpathSync(path.join(root, '.githooks', 'commit-msg'))) {
    throw new Error('another Git configuration overrides the local hook path');
  }
  out.info('ok      commit-message and full verification gate enabled for this repository');
} catch (error) {
  out.error(`install-hooks: ${error.message}`);
  process.exitCode = 1;
}
