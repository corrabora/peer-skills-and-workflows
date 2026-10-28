#!/usr/bin/env node
// Regenerate the vendored runtime dependencies from tools/vendor/package-lock.json,
// or with --check compare a fresh regeneration with the committed payload.
// Both need npm and registry access, or a populated npm cache given by --cache.
import path from 'node:path';
import { sourceRoot, terminal as out, usage } from './lib/cli.mjs';
import { generateVendor } from './lib/vendor.mjs';

const USAGE = 'node tools/generate-vendor.mjs [--check] [--cache <npm cache directory>]';
const args = process.argv.slice(2);
let check = false;
let cache;
if (args.length === 1 && ['--help', '-h'].includes(args[0])) {
  out.info(`usage: ${USAGE}\n\nWithout --check, replaces tools/vendor/node_modules and manifest.json from\ntools/vendor/package-lock.json. --check verifies the current payload offline and\ncompares a fresh regeneration with it, changing nothing.`);
  process.exit(0);
}
while (args.length) {
  const arg = args.shift();
  if (arg === '--check' && !check) check = true;
  else if (arg === '--cache' && cache === undefined && args.length) cache = path.resolve(args.shift());
  else usage(USAGE);
}
try {
  if (!generateVendor({ sourceRoot, out, check, cache })) process.exitCode = 1;
} catch (error) {
  out.error(`error   ${error.message}`);
  process.exitCode = 1;
}
