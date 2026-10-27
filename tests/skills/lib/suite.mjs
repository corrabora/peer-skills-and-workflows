// A suite: one skill's cases, each with a prompt, a fixture workspace,
// deterministic expectations and semantic criteria. A semantic criterion
// marked `observe: true` is graded and reported but never counts toward
// certification: it records behavior the skill under test cannot influence.
// Loading validates the shape so that a malformed case fails before any
// engine is launched.

import fs from 'node:fs';
import path from 'node:path';
import { digestOfManifest, manifestOf, readJson, skillsTestRoot } from './common.mjs';
import { passageBounds } from './inspect.mjs';

export const SUITES_ROOT = path.join(skillsTestRoot, 'suites');
const READ_RULES = new Set(['required', 'forbidden']);
// A source file may also be `observed`: classified and recorded in the inspection, never a check.
const SOURCE_READ_RULES = new Set([...READ_RULES, 'observed']);
const RELATIVE_PATH = /^(?!\/)(?!.*(^|\/)\.\.(\/|$))[^\0]+$/;
// A `writes` entry is a relative path, or a pattern with `*` within a segment; `**` and other glob syntax are not supported.
const WRITE_ENTRY = /^(?!\/)(?!.*(^|\/)\.\.(\/|$))(?!.*\*\*)[^\0?[\]{}]+$/;

// Node's default test-file patterns (`node --test` with no paths). A fixture
// file matching one would be run as a test by the repository gate.
const NODE_TEST_PATTERNS = [
  /(^|\/)[^/]*\.test\.[cm]?js$/,
  /(^|\/)[^/]*-test\.[cm]?js$/,
  /(^|\/)[^/]*_test\.[cm]?js$/,
  /(^|\/)test-[^/]*\.[cm]?js$/,
  /(^|\/)test\.[cm]?js$/,
  /(^|\/)test\/.*\.[cm]?js$/,
];

/** True when a repository-relative file path would be picked up by `node --test`. */
export function matchesNodeTestPattern(relativePath) {
  return NODE_TEST_PATTERNS.some((pattern) => pattern.test(relativePath));
}

function fail(suite, caseId, message) {
  throw new Error(`suite ${suite}${caseId ? `, case ${caseId}` : ''}: ${message}`);
}

function checkStringList(value, what, suite, caseId) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !WRITE_ENTRY.test(item))) {
    fail(suite, caseId, `${what} must be a list of relative paths, each optionally carrying '*' within a path segment`);
  }
}

function loadCase(suite, suiteDir, caseId) {
  const dir = path.join(suiteDir, 'cases', caseId);
  const file = path.join(dir, 'case.json');
  if (!fs.existsSync(file)) fail(suite, caseId, `missing ${file}`);
  const def = readJson(file);
  if (def.id !== caseId) fail(suite, caseId, `case.json id '${def.id}' does not match its directory`);
  if (typeof def.effect !== 'string' || !def.effect.trim()) fail(suite, caseId, 'effect must state the intended effect');
  const promptFile = path.join(dir, def.prompt ?? 'prompt.md');
  if (!fs.existsSync(promptFile)) fail(suite, caseId, `missing prompt ${promptFile}`);
  const workspace = path.join(dir, def.workspace ?? 'workspace');
  if (!fs.existsSync(workspace) || !fs.statSync(workspace).isDirectory()) fail(suite, caseId, `missing workspace ${workspace}`);

  const det = def.deterministic ?? {};
  if (det.exit !== undefined && !Number.isInteger(det.exit)) fail(suite, caseId, 'deterministic.exit must be an integer');
  const skillReads = det.skillReads ?? {};
  for (const [skill, rule] of Object.entries(skillReads)) {
    if (!READ_RULES.has(rule)) fail(suite, caseId, `skillReads.${skill} must be 'required' or 'forbidden'`);
  }
  // Source files (source-relative paths such as docs/writing-guidance.md) the engine must or must not read whole.
  const sourceReads = det.sourceReads;
  if (sourceReads !== undefined) {
    if (typeof sourceReads !== 'object' || sourceReads === null || Array.isArray(sourceReads)) fail(suite, caseId, 'sourceReads must map source-relative paths to a rule');
    for (const [relative, rule] of Object.entries(sourceReads)) {
      if (!RELATIVE_PATH.test(relative)) fail(suite, caseId, `sourceReads path '${relative}' must be a relative path`);
      if (!SOURCE_READ_RULES.has(rule)) fail(suite, caseId, `sourceReads.${relative} must be 'required' or 'forbidden' (or 'observed': recorded, never a check)`);
    }
  }
  // A premise id is `<check kind>.<key>`, split at the first dot so that a source path keeps its extension.
  const premise = det.premise ?? [];
  for (const id of premise) {
    const text = String(id);
    const dot = text.indexOf('.');
    const kind = dot < 0 ? text : text.slice(0, dot);
    const key = dot < 0 ? '' : text.slice(dot + 1);
    const known = (kind === 'skillReads' && key in skillReads) || (kind === 'sourceReads' && key in (sourceReads ?? {}));
    if (!known) fail(suite, caseId, `premise '${id}' names no skillReads check or sourceReads check`);
    if (kind === 'sourceReads' && sourceReads[key] === 'observed') fail(suite, caseId, `premise '${id}' names an observed source file, which yields no check`);
  }
  const writes = det.writes ?? {};
  if (writes.allowed !== undefined) checkStringList(writes.allowed, 'writes.allowed', suite, caseId);
  if (writes.required !== undefined) checkStringList(writes.required, 'writes.required', suite, caseId);
  for (const required of writes.required ?? []) {
    if (writes.allowed !== undefined && !writes.allowed.includes(required)) fail(suite, caseId, `writes.required '${required}' is not in writes.allowed`);
  }
  // An edit confined to one passage of a fixture file, bounded by marker lines that occur exactly once.
  const edits = det.edits;
  if (edits !== undefined) {
    if (typeof edits !== 'object' || edits === null || Array.isArray(edits)) fail(suite, caseId, 'edits must map fixture paths to { after, before }');
    for (const [relative, markers] of Object.entries(edits)) {
      if (!RELATIVE_PATH.test(relative)) fail(suite, caseId, `edits path '${relative}' must be a relative path`);
      const file = path.join(workspace, ...relative.split('/'));
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) fail(suite, caseId, `edits.${relative} names no fixture file`);
      if (typeof markers !== 'object' || markers === null || typeof markers.after !== 'string' || (markers.before !== undefined && typeof markers.before !== 'string')) {
        fail(suite, caseId, `edits.${relative} needs an 'after' marker line and optionally a 'before' marker line`);
      }
      try {
        passageBounds(fs.readFileSync(file, 'utf8'), markers);
      } catch (error) {
        fail(suite, caseId, `edits.${relative}: ${error.message}`);
      }
      if (writes.allowed !== undefined && !writes.allowed.includes(relative)) fail(suite, caseId, `edits.${relative} is not in writes.allowed`);
    }
  }

  // The final reply's claimed files are checked against the workspace in every case unless it opts out.
  const claimedArtifacts = det.claimedArtifacts;
  if (claimedArtifacts !== undefined && typeof claimedArtifacts !== 'boolean') fail(suite, caseId, 'claimedArtifacts must be true or false');

  const semantic = def.semantic ?? [];
  const seen = new Set();
  for (const criterion of semantic) {
    if (typeof criterion?.id !== 'string' || typeof criterion?.criterion !== 'string') fail(suite, caseId, 'each semantic criterion needs an id and a criterion');
    if (seen.has(criterion.id)) fail(suite, caseId, `duplicate semantic criterion '${criterion.id}'`);
    if (criterion.observe !== undefined && typeof criterion.observe !== 'boolean') fail(suite, caseId, `semantic criterion '${criterion.id}': observe must be true or false`);
    seen.add(criterion.id);
  }

  const fixtureManifest = manifestOf(workspace);
  for (const relative of Object.keys(fixtureManifest)) {
    if (matchesNodeTestPattern(relative)) fail(suite, caseId, `fixture file '${relative}' matches a Node test pattern and would run as a test`);
    if (fixtureManifest[relative].link !== undefined) fail(suite, caseId, `fixture '${relative}' is a link; fixtures are plain files`);
  }

  return {
    id: caseId,
    dir,
    effect: def.effect,
    promptFile,
    prompt: fs.readFileSync(promptFile),
    workspace,
    fixtureManifest,
    deterministic: { exit: det.exit ?? 0, skillReads, ...(sourceReads !== undefined ? { sourceReads } : {}), premise, writes, ...(edits !== undefined ? { edits } : {}), claimedArtifacts: claimedArtifacts ?? true },
    semantic,
  };
}

/** Load suite `name` from `suitesRoot`, validating every case. */
export function loadSuite(name, suitesRoot = SUITES_ROOT) {
  if (typeof name !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(name)) throw new Error(`suite name '${name}' is not a plain name`);
  const dir = path.join(suitesRoot, name);
  const file = path.join(dir, 'suite.json');
  if (!fs.existsSync(file)) throw new Error(`suite '${name}' not found at ${file}`);
  const def = readJson(file);
  if (typeof def.skill !== 'string') fail(name, null, 'suite.json must name the skill under test');
  if (!Array.isArray(def.cases) || def.cases.length === 0) fail(name, null, 'suite.json must list its cases');
  if (!Array.isArray(def.skills) || !def.skills.includes(def.skill)) fail(name, null, 'suite.json skills must list every skill installed for the run, including the skill under test');
  const cases = def.cases.map((caseId) => loadCase(name, dir, caseId));
  const manifest = manifestOf(dir);
  return {
    name,
    dir,
    skill: def.skill,
    skills: def.skills,
    description: def.description ?? '',
    cases,
    manifest,
    hash: digestOfManifest(manifest),
  };
}

/** Names of the suites present under `suitesRoot`. */
export function listSuites(suitesRoot = SUITES_ROOT) {
  if (!fs.existsSync(suitesRoot)) return [];
  return fs.readdirSync(suitesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(suitesRoot, entry.name, 'suite.json')))
    .map((entry) => entry.name)
    .sort();
}
