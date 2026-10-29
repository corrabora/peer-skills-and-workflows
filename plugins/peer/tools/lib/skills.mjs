// Skill metadata validation shared by Claude and Codex. The rules follow the
// skill-creator validators both engines ship, taking the stricter of the two
// where they differ, so a skill that passes here is acceptable to both.

import fs from 'node:fs';
import path from 'node:path';
import { linesOutsideFences } from './markdown.mjs';
import { quoteShowingSpaces } from './text-spaces.mjs';
import { decodeUtf8, parseYaml, YamlError } from './yaml.mjs';

// `compatibility` is accepted by Claude's validator but rejected by Codex's.
export const ALLOWED_KEYS = ['allowed-tools', 'description', 'license', 'metadata', 'name'];
export const MAX_NAME_LENGTH = 64;
export const MAX_DESCRIPTION_LENGTH = 1024;

// The captured YAML keeps the line break before the closing `---`, so a block
// scalar ending the frontmatter keeps its real final line break.
const FRONTMATTER = /^---\r?\n([\s\S]*?\r?\n)---[ \t]*(?:\r?\n|$)/;
const PLACEHOLDER_LINE = /^[ ]{0,3}\[TODO:[^\n]*\][ \t]*$/;

/** Validate one skill directory; returns the list of problems (empty when valid). */
export function validateSkill(skillDir) {
  const skillFile = path.join(skillDir, 'SKILL.md');
  let stat;
  try {
    stat = fs.statSync(skillFile);
  } catch {
    return ['SKILL.md not found'];
  }
  if (!stat.isFile()) return ['SKILL.md is not a file'];

  const text = decodeUtf8(fs.readFileSync(skillFile));
  if (text === null) return ['SKILL.md is not valid UTF-8; save it as UTF-8'];
  const content = text.replace(/^\uFEFF/, '');
  if (!content.startsWith('---')) return ['No YAML frontmatter found'];
  const split = splitFrontmatter(content);
  if (!split) return ['Invalid frontmatter format: no closing --- line'];

  let frontmatter;
  try {
    frontmatter = parseYaml(split.yaml, { firstLine: 2 });
  } catch (error) {
    if (error instanceof YamlError) return [`Invalid YAML in frontmatter: ${error.message}`];
    throw error;
  }
  if (!isMapping(frontmatter)) return ['Frontmatter must be a YAML mapping'];

  const problems = [];
  const unexpected = Object.keys(frontmatter).filter((key) => !ALLOWED_KEYS.includes(key)).sort();
  if (unexpected.length) {
    problems.push(`Unexpected key(s) in frontmatter: ${unexpected.map(showKey).join(', ')}. Allowed: ${ALLOWED_KEYS.join(', ')}`);
  }
  problems.push(...checkName(frontmatter, path.basename(path.resolve(skillDir))));
  problems.push(...checkDescription(frontmatter));
  problems.push(...checkOptional(frontmatter));
  problems.push(...checkBody(split.body));
  return problems;
}

/**
 * Split a SKILL.md into its frontmatter YAML, which keeps the line break ending
 * its last line, and the body after the closing `---` line; null when there is
 * no closing line. Exported for tests, not a stable API.
 */
export function splitFrontmatter(content) {
  const match = FRONTMATTER.exec(content);
  return match && { yaml: match[1], body: content.slice(match[0].length) };
}

function checkName(frontmatter, directoryName) {
  if (!Object.hasOwn(frontmatter, 'name')) return ["Missing 'name' in frontmatter"];
  const raw = frontmatter.name;
  if (typeof raw !== 'string') return [`Name must be a string, got ${typeName(raw)}`];
  const name = raw.trim();
  if (!name) return ['Name must not be empty'];
  const problems = [];
  if (!/^[a-z0-9-]+$/.test(name)) {
    problems.push(`Name '${name}' should be hyphen-case (lowercase letters, digits and hyphens only)`);
  }
  if (name.startsWith('-') || name.endsWith('-') || name.includes('--')) {
    problems.push(`Name '${name}' cannot start or end with a hyphen or contain consecutive hyphens`);
  }
  const length = [...name].length;
  if (length > MAX_NAME_LENGTH) {
    problems.push(`Name is too long (${length} characters). Maximum is ${MAX_NAME_LENGTH}.`);
  }
  if (name !== directoryName) {
    problems.push(`Name '${name}' does not match its directory '${directoryName}'`);
  }
  return problems;
}

function checkDescription(frontmatter) {
  if (!Object.hasOwn(frontmatter, 'description')) return ["Missing 'description' in frontmatter"];
  const raw = frontmatter.description;
  if (typeof raw !== 'string') return [`Description must be a string, got ${typeName(raw)}`];
  const description = raw.trim();
  if (!description) return ['Description must not be empty'];
  const problems = [];
  if (description.startsWith('[TODO:')) problems.push('Description contains an unfinished TODO placeholder');
  if (description.includes('<') || description.includes('>')) {
    problems.push('Description cannot contain angle brackets (< or >)');
  }
  const length = [...description].length;
  if (length > MAX_DESCRIPTION_LENGTH) {
    problems.push(`Description is too long (${length} characters). Maximum is ${MAX_DESCRIPTION_LENGTH}.`);
  }
  return problems;
}

function checkOptional(frontmatter) {
  const problems = [];
  if (Object.hasOwn(frontmatter, 'license') && typeof frontmatter.license !== 'string') {
    problems.push(`License must be a string, got ${typeName(frontmatter.license)}`);
  }
  if (Object.hasOwn(frontmatter, 'allowed-tools')) {
    const tools = frontmatter['allowed-tools'];
    const valid = typeof tools === 'string' || (Array.isArray(tools) && tools.every((t) => typeof t === 'string'));
    if (!valid) problems.push('allowed-tools must be a string or a list of strings');
  }
  if (Object.hasOwn(frontmatter, 'metadata')) {
    const metadata = frontmatter.metadata;
    if (!isMapping(metadata) || !Object.values(metadata).every((v) => typeof v === 'string')) {
      problems.push('metadata must be a mapping of string values');
    }
  }
  return problems;
}

// An unfinished `[TODO: …]` line outside fenced examples means the skill was
// never completed.
function checkBody(body) {
  return linesOutsideFences(body).some(({ line }) => PLACEHOLDER_LINE.test(line))
    ? ['Skill instructions contain an unfinished TODO placeholder']
    : [];
}

// A key holding a Unicode space YAML reads as text looks like an allowed key
// when printed, so it is shown with that space written out.
function showKey(key) {
  const shown = quoteShowingSpaces(key);
  return shown === `'${key}'` ? key : shown;
}

function isMapping(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function typeName(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'list';
  return typeof value;
}
