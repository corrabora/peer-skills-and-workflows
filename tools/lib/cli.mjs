// Small helpers shared by the command-line entry points.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonical } from './paths.mjs';

/** Canonical root of this package checkout, found from the tools directory. */
export const sourceRoot = canonical(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..'));

// A closed reader (for example a pager or `head`) ends output quietly.
process.stdout.on('error', (error) => {
  if (error.code === 'EPIPE') process.exit(process.exitCode ?? 0);
  throw error;
});

export const terminal = {
  info: (line) => process.stdout.write(`${line}\n`),
  error: (line) => process.stderr.write(`${line}\n`),
};

/** Print `usage: <text>` to stderr and exit with status 2; never returns. */
export function usage(text) {
  process.stderr.write(`usage: ${text}\n`);
  process.exit(2);
}
