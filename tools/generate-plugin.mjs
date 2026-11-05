#!/usr/bin/env node
// Regenerate plugins/peer, the plugin payload both marketplace catalogs install.
import { sourceRoot, terminal as out, usage } from './lib/cli.mjs';
import {
  checkPluginPayload,
  generatePluginPayload,
  payloadJavaScript,
  PAYLOAD_DIRECTORY,
} from './lib/plugin-payload.mjs';
import { lint } from './lib/lint.mjs';

const args = process.argv.slice(2);
if (args.length > 1 || (args.length === 1 && args[0] !== '--check')) usage('node tools/generate-plugin.mjs [--check]');
try {
  if (args[0] === '--check') {
    if (!checkPluginPayload({ sourceRoot, out })) process.exitCode = 1;
  } else {
    const result = await lint({ root: sourceRoot, files: payloadJavaScript(sourceRoot) });
    process.stdout.write(result.report);
    if (!result.ok) {
      out.error('error   payload sources fail lint; generation refused');
      process.exitCode = 1;
    } else {
      const files = generatePluginPayload(sourceRoot);
      out.info(`generated ${PAYLOAD_DIRECTORY} (${files.length} files)`);
    }
  }
} catch (error) {
  out.error(`error   ${error.message}`);
  process.exitCode = 1;
}
