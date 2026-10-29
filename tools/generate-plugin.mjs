#!/usr/bin/env node
// Regenerate plugins/peer, the plugin payload both marketplace catalogs install.
import { sourceRoot, terminal as out, usage } from './lib/cli.mjs';
import { checkPluginPayload, generatePluginPayload, PAYLOAD_DIRECTORY } from './lib/plugin-payload.mjs';

const args = process.argv.slice(2);
if (args.length > 1 || (args.length === 1 && args[0] !== '--check')) usage('node tools/generate-plugin.mjs [--check]');
try {
  if (args[0] === '--check') {
    if (!checkPluginPayload({ sourceRoot, out })) process.exitCode = 1;
  } else {
    const files = generatePluginPayload(sourceRoot);
    out.info(`generated ${PAYLOAD_DIRECTORY} (${files.length} files)`);
  }
} catch (error) {
  out.error(`error   ${error.message}`);
  process.exitCode = 1;
}
