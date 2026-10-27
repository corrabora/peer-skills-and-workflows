#!/usr/bin/env node
// Check cheap message errors before running the full local gate. No cached pass.
import path from 'node:path';
import { runNode } from './lib/run-node.mjs';
import { sourceRoot, terminal as out, usage } from './lib/cli.mjs';

const [messagePath, ...extra] = process.argv.slice(2);
if (!messagePath || extra.length || messagePath.startsWith('-')) usage('node tools/commit-verify.mjs <message-file>');

out.info('commit-verify: commit message');
if (!runNode([path.join(sourceRoot, 'tools', 'commit-message.mjs'), path.resolve(messagePath)], process.cwd())) process.exit(1);
if (!runNode([path.join(sourceRoot, 'tools', 'verify.mjs')], sourceRoot)) {
  out.error('commit-verify: commit blocked; fix the failing checks and retry');
  process.exit(1);
}
