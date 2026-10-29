#!/usr/bin/env node
import { sourceRoot, terminal as out, usage } from './lib/cli.mjs';
import { checkWritingReferences, generateWritingReferences } from './lib/writing-references.mjs';

const args = process.argv.slice(2);
if (args.length > 1 || (args.length === 1 && args[0] !== '--check')) usage('node tools/generate-writing-references.mjs [--check]');
try {
  if (args[0] === '--check') {
    if (!checkWritingReferences({ sourceRoot, out })) process.exitCode = 1;
  } else {
    const changed = generateWritingReferences(sourceRoot);
    for (const file of changed) out.info(`generated ${file}`);
    if (!changed.length) out.info('ok      generated writing references are current');
  }
} catch (error) {
  out.error(`error   ${error.message}`);
  process.exitCode = 1;
}
