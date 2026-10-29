#!/usr/bin/env node
// Link, check or unlink the package's skills for Codex (~/.agents/skills) and
// Claude (~/.claude/skills, or $CLAUDE_CONFIG_DIR/skills when that is an
// absolute path; a relative value is ignored in favor of the default).
//
//   node tools/install.mjs link [<set>]     link each skill to this checkout
//   node tools/install.mjs check [<set>]    check package links and installed links
//   node tools/install.mjs unlink [<set>]   remove only links into this checkout
//
// link/check workflow includes its writing dependency and user-level successor
// hooks. unlink removes only the named set and its owned support hooks; without
// a set every skill is installed, checked or removed. Hook trust stays human-owned.

import fs from 'node:fs';
import path from 'node:path';
import { checkLinks, checkReferences, link, SKILL_SETS, unlink } from './lib/install.mjs';
import { terminal as out, sourceRoot, usage } from './lib/cli.mjs';
import { hostContext, skillScopes } from './lib/paths.mjs';
import { supportHooks } from './lib/install-support.mjs';

const USAGE = `node tools/install.mjs link|check|unlink [${Object.keys(SKILL_SETS).join('|')}]`;
const [command, set, ...extra] = process.argv.slice(2);
if (extra.length || (set !== undefined && !Object.hasOwn(SKILL_SETS, set))) usage(USAGE);

const host = hostContext();
const context = { sourceRoot, scopes: skillScopes(host), sets: set === undefined ? undefined : [set], platform: process.platform, host, out };
let ok;
switch (command) {
  case 'link': {
    const instructionPath = path.join(sourceRoot, 'docs', 'guidance', 'codex-session-instructions.txt');
    const instructions = fs.readFileSync(instructionPath, 'utf8').trim();
    if (instructions === '') throw new Error(`empty Codex session instruction: ${instructionPath}`);
    ok = link(context);
    ok = supportHooks({ ...context, action: 'link' }) && ok;
    if (ok) {
      out.info(`Codex environment from ${instructionPath}`);
      out.info('Add this top-level setting to ~/.codex/config.toml or a trusted project\'s .codex/config.toml; preserve any existing developer_instructions. See README.md#codex-environment. Codex session instructions were not changed.');
      out.info(`developer_instructions = ${JSON.stringify(instructions)}`);
    }
    break;
  }
  case 'unlink':
    ok = supportHooks({ ...context, action: 'unlink' });
    if (ok) ok = unlink(context);
    break;
  case 'check': {
    const references = checkReferences(context);
    const links = checkLinks(context);
    ok = supportHooks({ ...context, action: 'check' }) && links && references;
    break;
  }
  default: usage(USAGE);
}
process.exitCode = ok ? 0 : 1;
