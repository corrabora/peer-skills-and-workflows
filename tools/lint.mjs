#!/usr/bin/env node
// Lint every authored JavaScript source with the root authoring toolchain.
// Any warning fails like an error; a missing toolchain fails with its install command.
import { lint } from './lib/lint.mjs';
import { sourceRoot, terminal as out, usage } from './lib/cli.mjs';

if (process.argv.length !== 2) usage('node tools/lint.mjs');

try {
  const { ok, errors, warnings, files, report } = await lint({ root: sourceRoot });
  process.stdout.write(report);
  out.info(`lint: ${files} files, ${errors} errors, ${warnings} warnings; warnings fail`);
  process.exitCode = ok ? 0 : 1;
} catch (error) {
  out.error(`lint: ${error.message}`);
  process.exitCode = 1;
}
