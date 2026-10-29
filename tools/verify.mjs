#!/usr/bin/env node
// The repository's complete local gate, also run by commit-verify.mjs.
import path from 'node:path';
import { checkReferences } from './lib/install.mjs';
import { checkWritingReferences } from './lib/writing-references.mjs';
import { checkVendor } from './lib/vendor.mjs';
import { checkPluginPackage } from './lib/plugin-package.mjs';
import { checkPluginPayload } from './lib/plugin-payload.mjs';
import { runNode } from './lib/run-node.mjs';
import { sourceRoot, terminal as out, usage } from './lib/cli.mjs';

if (process.argv.length !== 2) usage('node tools/verify.mjs');

out.info('verify: skill metadata');
if (!runNode([path.join(sourceRoot, 'tools', 'validate.mjs')], sourceRoot)) process.exit(1);

out.info('verify: generated writing references');
if (!checkWritingReferences({ sourceRoot, out })) process.exit(1);

out.info('verify: vendored dependencies');
if (!checkVendor({ sourceRoot, out })) process.exit(1);

out.info('verify: native plugin package');
if (!checkPluginPackage({ sourceRoot, out })) process.exit(1);

out.info('verify: generated plugin payload');
if (!checkPluginPayload({ sourceRoot, out })) process.exit(1);

out.info('verify: package references');
if (!checkReferences({ sourceRoot, out })) process.exit(1);

out.info('verify: full test suite (node --test)');
if (!runNode(['--test'], sourceRoot)) process.exit(1);

out.info('verify: all checks passed');
