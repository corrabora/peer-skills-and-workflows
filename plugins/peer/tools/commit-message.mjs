#!/usr/bin/env node
// Standalone message lint. Reads only; never rewrites a message.
import fs from 'node:fs';
import { validateCommitMessage } from './lib/commit-message.mjs';
import { git } from './lib/git.mjs';
import { terminal as out, usage } from './lib/cli.mjs';

const [messagePath, ...extra] = process.argv.slice(2);
if (!messagePath || extra.length || messagePath.startsWith('-')) usage('node tools/commit-message.mjs <message-file>');

try {
  const message = new TextDecoder('utf-8', { fatal: true }).decode(fs.readFileSync(messagePath));
  const root = git(['rev-parse', '--show-toplevel']).trim();
  const candidatePaths = new Set(git(['ls-files', '--cached', '--full-name', '-z'], { cwd: root }).split('\0').filter(Boolean));
  // Ask Git for its configured comment prefix, including core.commentString.
  const marker = git(['stripspace', '--comment-lines'], { input: 'marker\n' }).trimEnd().slice(0, -'marker'.length);
  const scissors = `${marker}------------------------ >8 ------------------------`;
  const content = message.split(/\r?\n/u);
  const cut = content.findIndex(line => line.trimEnd() === scissors);
  const cleaned = git(['stripspace', '--strip-comments'], { input: (cut < 0 ? content : content.slice(0, cut)).join('\n') });
  const result = validateCommitMessage(cleaned, candidatePaths);
  for (const error of result.errors) out.error(`commit-message: cleaned line ${error.line}: ${error.message}`);
  if (!result.ok) out.error('See docs/guidance/conventional-commits.md.');
  process.exitCode = result.ok ? 0 : 1;
} catch (error) {
  out.error(`commit-message: ${error.message}`);
  process.exitCode = 1;
}
