import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const repositoryRoot = fileURLToPath(new URL('../..', import.meta.url));
/** Installs the authoring toolchain from the root development lock. */
export const LINT_INSTALL = 'npm ci --ignore-scripts';

/**
 * Variables through which Git hooks and callers can point Git at another
 * repository, index or object store. Lint selects files from the root it is
 * given, so target listing drops them.
 */
const REPOSITORY_VARIABLES = [
  'GIT_DIR',
  'GIT_COMMON_DIR',
  'GIT_WORK_TREE',
  'GIT_INDEX_FILE',
  'GIT_OBJECT_DIRECTORY',
  'GIT_ALTERNATE_OBJECT_DIRECTORIES',
  'GIT_NAMESPACE',
  'GIT_PREFIX',
  'GIT_CEILING_DIRECTORIES',
  'GIT_DISCOVERY_ACROSS_FILESYSTEM',
];

/** Tracked and unignored authored JavaScript, including the extensionless commit hook. */
export function lintTargets(root = repositoryRoot) {
  const env = { ...process.env, LC_ALL: 'C', GIT_OPTIONAL_LOCKS: '0' };
  for (const name of REPOSITORY_VARIABLES) delete env[name];
  const result = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
    cwd: root,
    env,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error) throw new Error(`cannot run Git: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`git ls-files failed: ${result.stderr.trim() || result.status}`);
  const files = result.stdout;
  return [...new Set(files.split('\0').filter(Boolean))]
    .filter(
      (file) =>
        !file.startsWith('plugins/peer/') &&
        !file.split('/').includes('node_modules') &&
        (/\.[cm]?js$/.test(file) || file === '.githooks/commit-msg'),
    )
    .sort();
}

/**
 * Count ESLint results; any warning fails like an error.
 * @param {{errorCount: number, warningCount: number}[]} results
 */
export function lintOutcome(results) {
  const errors = results.reduce((count, result) => count + result.errorCount, 0);
  const warnings = results.reduce((count, result) => count + result.warningCount, 0);
  return { ok: errors === 0 && warnings === 0, errors, warnings, files: results.length };
}

/** Lint authored sources with the root authoring toolchain and render its stylish report. */
export async function lint({ root = repositoryRoot, devRoot = repositoryRoot, files } = {}) {
  let ESLint;
  try {
    ({ ESLint } = createRequire(path.join(devRoot, 'package.json'))('eslint'));
  } catch (error) {
    throw new Error(`Cannot load the authoring toolchain; run ${LINT_INSTALL}`, { cause: error });
  }
  const eslint = new ESLint({
    cwd: root,
    overrideConfigFile: path.join(repositoryRoot, 'eslint.config.mjs'),
    errorOnUnmatchedPattern: true,
  });
  const targets = files ?? lintTargets(root);
  const results = targets.length ? await eslint.lintFiles(targets) : [];
  const report = await (await eslint.loadFormatter('stylish')).format(results);
  return { ...lintOutcome(results), report };
}
