// Argument-based Git for package tools, including binding; capacity: workflow/BINDING.md, Git capture capacity.
import { spawnSync } from 'node:child_process';
import path from 'node:path';

/**
 * Run Git and return its standard output as UTF-8 text, or with `bytes` as the
 * exact bytes Git wrote, for callers that must not decode them with
 * substitution (path names Git prints as stored). Diagnostics are text either way.
 *
 * A failure throws an Error whose message callers classify, so its forms are
 * stable: `cannot run Git: <cause>` when Git cannot be started or its output
 * cannot be captured; otherwise, for a nonzero exit,
 * `git <args[0]> failed: <trimmed stderr, or else the signal or exit status>`.
 * With `allowMissing`, exit status 1 with empty stdout and stderr returns null
 * instead; every other failure still throws. `onStderr` receives stderr only
 * when it is not empty and Git exited 0, never when the call throws or returns
 * null. Git runs with `LC_ALL=C` under a per-call capture limit; both are
 * owned by workflow/BINDING.md, Git capture capacity.
 */
export function git(args, { cwd = process.cwd(), input, allowMissing = false, onStderr, bytes = false } = {}) {
  // This adapter owns stable messages for callers that classify Git diagnostics.
  const result = spawnSync('git', args, { cwd, input, env: { ...process.env, LC_ALL: 'C' }, encoding: bytes ? 'buffer' : 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (result.error) throw new Error(`cannot run Git: ${result.error.message}`);
  const stderr = bytes ? result.stderr.toString('utf8') : result.stderr;
  if (allowMissing && result.status === 1 && !result.stdout.length && !stderr) return null;
  if (result.status !== 0) throw new Error(`git ${args[0]} failed: ${stderr.trim() || result.signal || result.status}`);
  if (stderr) onStderr?.(stderr);
  return result.stdout;
}

const PATH_FORMAT = '--path-format=absolute';

/**
 * Absolute paths from `git rev-parse --path-format=absolute <queries>`, one
 * per query (an option, or an option with its argument as an array).
 * `--path-format` needs Git 2.31 or later (README, Requirements). An older
 * Git rejects it or, like any Git given an option it does not know,
 * echoes it and succeeds, so the result is validated before a caller takes it
 * for a checkout identity. An unsupported Git is reported as that
 * prerequisite (`UnsupportedGitError`); every other failure keeps its own
 * diagnostic.
 */
export function gitPaths(queries, options = {}) {
  let output;
  try {
    output = git(['rev-parse', PATH_FORMAT, ...queries.flat()], options);
  } catch (error) {
    if (/unknown option [`']?path-format/.test(error.message)) throw unsupportedGit(options, error.message);
    throw error;
  }
  const text = output.replace(/\r?\n$/, '');
  if (text.split(/\r?\n/)[0] === PATH_FORMAT) throw unsupportedGit(options, `git rev-parse echoed ${PATH_FORMAT} as an unknown option`);
  // One query keeps its whole line, so a path containing a line break survives.
  const lines = queries.length === 1 ? [text] : text.split(/\r?\n/);
  if (lines.length !== queries.length || !lines.every((line) => path.isAbsolute(line))) {
    throw new Error(`git rev-parse ${PATH_FORMAT} ${queries.flat().join(' ')} returned unexpected output: ${JSON.stringify(output)}`);
  }
  return lines;
}

function unsupportedGit(options, detail) {
  let version = 'the Git on PATH';
  try { version = git(['--version'], options).trim(); } catch { /* the capability failure is the diagnosis */ }
  return Object.assign(new Error(`the workflow tools require Git 2.31 or later: ${version} does not support 'rev-parse ${PATH_FORMAT}' (${detail})`), { name: 'UnsupportedGitError' });
}
