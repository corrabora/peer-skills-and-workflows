#!/usr/bin/env node
// Validate skill metadata for Claude and Codex.
//
//   node tools/validate.mjs                 every skill in this package
//   node tools/validate.mjs <skill-dir>...  the named skill directories
//
// Exits 1 when any skill is invalid or the tools' dependencies are not
// installed, and 2 with usage for -h, --help or any other option (name a
// directory starting with '-' as ./-name).

import fs from 'node:fs';
import path from 'node:path';
import { validateSkill } from './lib/skills.mjs';
import { MissingDependencyError } from './lib/yaml.mjs';
import { terminal as out, sourceRoot, usage } from './lib/cli.mjs';

const args = process.argv.slice(2);
if (args.some((arg) => arg.startsWith('-'))) usage('node tools/validate.mjs [<skill-dir>...]');
const skills = args.length
  ? args.map((arg) => path.resolve(arg))
  : fs.readdirSync(path.join(sourceRoot, 'skills'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(sourceRoot, 'skills', entry.name))
    .sort();

let ok = true;
try {
  for (const skill of skills) {
    const problems = validateSkill(skill);
    if (problems.length === 0) {
      out.info(`ok      ${skill}`);
    } else {
      ok = false;
      for (const problem of problems) out.error(`FAIL    ${skill}: ${problem}`);
    }
  }
} catch (error) {
  if (!(error instanceof MissingDependencyError)) throw error;
  out.error(`validate: ${error.message}`);
  ok = false;
}
process.exitCode = ok ? 0 : 1;
