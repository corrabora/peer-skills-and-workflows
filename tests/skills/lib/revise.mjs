// Re-grading a retained run against a revised suite without rerunning it. A
// revision is accepted only when it tests the same thing the engines were
// given: the same skill and installed skills, the same case ids, and every
// case's fixture and prompt byte for byte. Only expectations and criteria may
// differ; the differences are recorded so a report can say what changed. The
// revised suite is retained under the run directory, so the report's reference
// to it outlives the path or tree it came from.

import fs from 'node:fs';
import path from 'node:path';
import { canonical } from '../../../tools/lib/paths.mjs';
import { digestOfManifest, packageRoot, sha256 } from './common.mjs';
import { materializeTree, resolveTree } from './materialize.mjs';
import { loadSuite } from './suite.mjs';

export const REVISED_SUITES_DIR = 'suites-revised';

/**
 * Find the revised suite named by `spec`: a directory holding `suite.json`
 * for the run's suite, a suites root holding `<name>/suite.json`, or a Git
 * tree-ish in `repo` (this checkout by default) holding
 * `tests/skills/suites/<name>`. Returns `{ kind, suitesRoot, source }` with
 * the suite loadable from `suitesRoot`; a tree-ish is materialized under
 * `stagingDir`.
 */
function locateRevision(spec, name, { repo, stagingDir }) {
  const dir = canonical(spec);
  if (dir && fs.existsSync(path.join(dir, 'suite.json'))) {
    if (path.basename(dir) !== name) throw new Error(`revised suite at ${dir} is named '${path.basename(dir)}', the run's suite is '${name}'`);
    return { kind: 'directory', suitesRoot: path.dirname(dir), source: { kind: 'directory', path: dir } };
  }
  if (dir && fs.existsSync(path.join(dir, name, 'suite.json'))) return { kind: 'directory', suitesRoot: dir, source: { kind: 'directory', path: path.join(dir, name) } };
  if (dir) throw new Error(`${dir} holds neither suite.json nor ${name}/suite.json`);
  const repository = canonical(repo ?? packageRoot);
  if (!repository) throw new Error(`repository ${repo} does not exist`);
  let tree;
  try {
    tree = resolveTree(repository, spec);
  } catch (error) {
    throw new Error(`--suite '${spec}' is neither a directory nor a tree-ish of ${repository}: ${error.message}`);
  }
  const prefix = `tests/skills/suites/${name}`;
  const dest = path.join(stagingDir, name);
  const manifest = materializeTree(repository, tree, dest, prefix);
  if (Object.keys(manifest).length === 0) throw new Error(`tree ${tree} of ${repository} holds no ${prefix}`);
  return { kind: 'tree', suitesRoot: stagingDir, source: { kind: 'tree', repo: repository, treeish: spec, tree } };
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

/**
 * Compare a revised suite with the recorded one. Throws when the engines'
 * inputs differ (skill, installed skills, case ids, any fixture or prompt);
 * otherwise returns the per-case differences in effect, deterministic
 * expectations and semantic criteria.
 */
export function compareSuites(recorded, revised) {
  const problems = [];
  if (recorded.skill !== revised.skill) problems.push(`skill under test: recorded ${recorded.skill}, revised ${revised.skill}`);
  if (canonicalJson(recorded.skills) !== canonicalJson(revised.skills)) problems.push(`installed skills: recorded ${recorded.skills.join(', ')}, revised ${revised.skills.join(', ')}`);
  const recordedIds = recorded.cases.map((caseDef) => caseDef.id);
  const revisedIds = revised.cases.map((caseDef) => caseDef.id);
  for (const id of recordedIds) if (!revisedIds.includes(id)) problems.push(`case ${id} missing from the revised suite`);
  for (const id of revisedIds) if (!recordedIds.includes(id)) problems.push(`case ${id} added by the revised suite`);
  const diff = [];
  for (const before of recorded.cases) {
    const after = revised.cases.find((caseDef) => caseDef.id === before.id);
    if (!after) continue;
    if (digestOfManifest(before.fixtureManifest) !== digestOfManifest(after.fixtureManifest)) problems.push(`case ${before.id}: fixture differs`);
    if (sha256(before.prompt) !== sha256(after.prompt)) problems.push(`case ${before.id}: prompt differs`);
    const semantic = { added: [], removed: [], changed: [] };
    for (const criterion of after.semantic) {
      const earlier = before.semantic.find((candidate) => candidate.id === criterion.id);
      if (!earlier) semantic.added.push(criterion.id);
      else if (earlier.criterion !== criterion.criterion || (earlier.observe === true) !== (criterion.observe === true)) semantic.changed.push(criterion.id);
    }
    for (const criterion of before.semantic) if (!after.semantic.some((candidate) => candidate.id === criterion.id)) semantic.removed.push(criterion.id);
    const deterministic = canonicalJson(before.deterministic) !== canonicalJson(after.deterministic);
    const effect = before.effect !== after.effect;
    if (deterministic || effect || semantic.added.length || semantic.removed.length || semantic.changed.length) diff.push({ case: before.id, effect, deterministic, semantic });
  }
  if (problems.length) throw new Error(`the revised suite does not match what the run's engines were given; only expectations and criteria may change:\n  ${problems.join('\n  ')}`);
  return diff;
}

/**
 * Load the revised suite named by `spec` for the run at `runDir`, check it
 * against the run's recorded suite, retain it under
 * `<run>/suites-revised/<hash>/<name>` and return
 * `{ suite, hash, source, retained, diff }`. A revision whose hash equals
 * the recorded one is returned with an empty diff.
 */
export function loadRevisedSuite(runDir, existing, spec, { repo = null } = {}) {
  const name = existing.suite.name;
  const recorded = loadSuite(name, path.join(runDir, 'suites'));
  if (recorded.hash !== existing.suite.hash) throw new Error(`the run's suite snapshot no longer matches its recorded hash ${existing.suite.hash}; the run directory was altered`);
  const revisedRoot = path.join(runDir, REVISED_SUITES_DIR);
  fs.mkdirSync(revisedRoot, { recursive: true });
  const stagingDir = fs.mkdtempSync(path.join(revisedRoot, 'incoming-'));
  try {
    const located = locateRevision(spec, name, { repo, stagingDir });
    const candidate = loadSuite(name, located.suitesRoot);
    const diff = compareSuites(recorded, candidate);
    const retained = path.join(revisedRoot, candidate.hash, name);
    if (!fs.existsSync(retained)) {
      fs.mkdirSync(path.dirname(retained), { recursive: true });
      if (located.kind === 'tree') fs.renameSync(path.join(stagingDir, name), retained);
      else fs.cpSync(candidate.dir, retained, { recursive: true, errorOnExist: true, force: false });
    }
    const suite = loadSuite(name, path.dirname(retained));
    if (suite.hash !== candidate.hash) throw new Error(`the retained copy of the revised suite at ${retained} does not hash as the revision (${suite.hash} vs ${candidate.hash})`);
    return { suite, hash: suite.hash, source: located.source, retained, diff, recordedHash: recorded.hash };
  } finally {
    fs.rmSync(stagingDir, { recursive: true, force: true });
  }
}
