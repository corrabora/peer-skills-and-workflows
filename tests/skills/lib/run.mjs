// A run: one suite against one pinned source tree at one requested verbosity
// in one external run directory, holding any number of engine/model/effort
// cells. The run directory is created once with the run's identity; later
// invocations may add cells to it but never rewrite an attempt, and a
// different verbosity needs another run directory, as a different source
// tree does. Transport retries are a separate, explicit operation under the
// standing policy.

import fs from 'node:fs';
import path from 'node:path';
import { canonical, canonicalLocation, isWithin } from '../../../tools/lib/paths.mjs';
import { isoNow, ordinal, packageRoot, readJson, writeJson } from './common.mjs';
import { ENGINE_DEFAULT_VERBOSITY, codexSessionInstruction, sessionInstructionFor, validateSettings, verbosityFor } from './engines.mjs';
import { git, materializeDirectory, materializeTree, resolveTree, sourceIdentity } from './materialize.mjs';
import { loadSuite } from './suite.mjs';
import { planAttempt, readAttempt, runAttempt } from './attempt.mjs';

export const RUN_FORMAT = 'agent-workflow/skill-suite-run';

function syncSleep(ms) {
  if (ms > 0) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Check that `runDir` may hold a run: outside this checkout, outside the
 * source repository, and either absent, empty, or an existing run. Returns
 * the canonical path and the existing run record when there is one.
 */
export function resolveRunDir(runDir, { repo = null } = {}) {
  if (typeof runDir !== 'string' || !runDir) throw new Error('a run directory is required (--run-dir)');
  const location = canonicalLocation(runDir);
  const forbidden = [packageRoot, repo ? canonical(repo) ?? canonicalLocation(repo) : null].filter(Boolean);
  for (const root of forbidden) {
    if (isWithin(root, location)) throw new Error(`run directory ${location} lies inside the checkout ${root}; runs must be written outside every checkout`);
  }
  const runFile = path.join(location, 'run.json');
  if (fs.existsSync(runFile)) return { location, existing: readJson(runFile) };
  if (fs.existsSync(location) && fs.readdirSync(location).length > 0) {
    throw new Error(`run directory ${location} exists and is not empty, and holds no run.json; choose a new directory`);
  }
  return { location, existing: null };
}

/**
 * Resolve the source to run against: `{ repo, tree }` names a Git tree-ish in
 * a checkout, `{ dir }` an already materialized directory. Returns the
 * identity before anything is materialized.
 */
export function resolveSource(source) {
  if (source.dir) {
    const dir = canonical(source.dir);
    if (!dir) throw new Error(`source directory ${source.dir} does not exist`);
    if (!fs.existsSync(path.join(dir, 'skills'))) throw new Error(`source directory ${dir} has no skills/ directory`);
    return { kind: 'directory', dir, tree: null };
  }
  const repo = canonical(source.repo ?? packageRoot);
  if (!repo) throw new Error(`repository ${source.repo} does not exist`);
  const tree = resolveTree(repo, source.tree);
  return { kind: 'tree', repo, treeish: source.tree, tree };
}

/**
 * Read one file of the source before it is materialized, as the run will
 * materialize it: from the directory a `{ dir }` source copies, or from the
 * Git tree a `{ repo, tree }` source writes out. An absent file throws an
 * error with code ENOENT, as `fs.readFileSync` does, so that the session
 * instruction's absent rule applies to both. Returns the reader and a note
 * of where it reads from.
 */
function sourceReader(source) {
  if (source.kind === 'directory') {
    return { read: (file, relative) => fs.readFileSync(path.join(source.dir, ...relative.split('/'))), resolvedFrom: `source directory ${source.dir}, as it will be materialized` };
  }
  const read = (file, relative) => {
    const listing = git(['ls-tree', '-z', source.tree, '--', relative], source.repo).toString('utf8');
    if (!listing) throw Object.assign(new Error(`${relative} is not in tree ${source.tree}`), { code: 'ENOENT' });
    const match = /^(\d{6}) (\w+) ([0-9a-f]{40,64})\t/.exec(listing);
    if (!match || match[2] !== 'blob' || match[1] === '120000') throw new Error(`${relative} in tree ${source.tree} is not a regular file`);
    return git(['cat-file', 'blob', match[3]], source.repo);
  };
  return { read, resolvedFrom: `source tree ${source.tree} of ${source.repo}, as it will be materialized` };
}

/**
 * The session-instruction record for a plan: read from the run's materialized
 * source when the run exists, else from where the source will be
 * materialized from, so a dry run shows the exact argument before anything is
 * written. Throws, stopping the plan, when the file is present but unusable.
 */
function planSessionInstruction(engine, sourceRoot, source, existing) {
  if (existing) return sessionInstructionFor(engine, sourceRoot);
  return sessionInstructionFor(engine, sourceRoot, sourceReader(source));
}

/**
 * Build the plan for a run: validated settings, the selected cases, the
 * attempt directories each cell will use, the session instruction the source
 * tree documents, the verbosity record, and the exact launches. Refuses a
 * cell whose attempt directory already exists, and an existing run whose
 * recorded verbosity differs from the request. Nothing is written.
 */
export function planRun({ suiteName, suitesRoot, engine, model, effort, verbosity = null, replicates, cases = null, source, runDir, executables = {}, timeoutSeconds }) {
  const settings = validateSettings(engine, model, effort, verbosity);
  const verbosityRecord = verbosityFor(settings.engine, settings.verbosity);
  if (!Number.isInteger(replicates) || replicates < 1) throw new Error(`replicates must be a positive integer, got ${replicates}`);
  if (!Number.isInteger(timeoutSeconds) || timeoutSeconds < 1) throw new Error(`timeout must be a positive integer of seconds, got ${timeoutSeconds}`);
  const suite = loadSuite(suiteName, suitesRoot);
  const selected = cases === null ? suite.cases : cases.map((id) => {
    const found = suite.cases.find((caseDef) => caseDef.id === id);
    if (!found) throw new Error(`suite ${suiteName} has no case '${id}'; cases: ${suite.cases.map((caseDef) => caseDef.id).join(', ')}`);
    return found;
  });
  const resolvedSource = resolveSource(source);
  const { location, existing } = resolveRunDir(runDir, { repo: resolvedSource.repo ?? null });
  if (existing) {
    if (existing.format !== RUN_FORMAT) throw new Error(`${location} holds a run of unknown format ${existing.format}`);
    if (existing.suite.name !== suite.name || existing.suite.hash !== suite.hash) {
      throw new Error(`run ${location} was created for suite ${existing.suite.name} at hash ${existing.suite.hash}; the suite now loads as ${suite.name} at ${suite.hash}. A changed suite needs a new run directory`);
    }
    if (resolvedSource.tree && existing.source.tree !== resolvedSource.tree) {
      throw new Error(`run ${location} pins source tree ${existing.source.tree}; a different tree (${resolvedSource.tree}) needs a new run directory`);
    }
    // A run created before the verbosity dimension existed ran at the engine default.
    const recordedVerbosity = existing.verbosity?.requested ?? ENGINE_DEFAULT_VERBOSITY;
    if (recordedVerbosity !== verbosityRecord.requested) {
      throw new Error(`run ${location} was created at verbosity ${recordedVerbosity}; a different verbosity (${verbosityRecord.requested}) needs a new run directory`);
    }
  }
  const sourceRoot = path.join(location, 'source');
  const sessionInstruction = planSessionInstruction(settings.engine, sourceRoot, resolvedSource, existing);
  const cells = [];
  const skipped = [];
  for (const caseDef of selected) {
    for (let replicate = 1; replicate <= replicates; replicate += 1) {
      const cell = `${caseDef.id}/${settings.engine}/${ordinal(replicate)}`;
      const attemptDir = path.join(location, 'attempts', caseDef.id, settings.engine, ordinal(replicate));
      const recorded = readAttempt(attemptDir);
      if (recorded) {
        // A completed attempt is never rerun; an interrupted run resumes past it.
        skipped.push({ caseDef, replicate, attemptDir, status: recorded.status, verdict: recorded.verdict });
        continue;
      }
      if (fs.existsSync(attemptDir)) throw new Error(`cell ${cell} in ${location} holds an interrupted attempt without a record; attempts are never overwritten, so move it aside by hand or use another run directory`);
      cells.push({ caseDef, replicate, attemptDir, plan: planAttempt({ attemptDir, sourceRoot, engine: settings.engine, model, effort, verbosity: verbosityRecord, executables, sessionInstruction }) });
    }
  }
  if (cells.length === 0) throw new Error(`every selected cell of ${settings.engine} already has an attempt in ${location}; attempts are never overwritten. Use another run directory, or the retry command for a transport failure`);
  return { suite, settings, replicates, timeoutSeconds, source: resolvedSource, runDir: location, existing, sourceRoot, sessionInstruction, verbosity: verbosityRecord, cells, skipped, executables };
}

/** The deterministic expectations of a case as the inspector will judge them, for the dry run. */
function expectationsOf(caseDef) {
  const det = caseDef.deterministic;
  return {
    exit: det.exit,
    skillReads: det.skillReads,
    sourceReads: det.sourceReads ?? {},
    writes: { allowed: det.writes.allowed ?? null, required: det.writes.required ?? [] },
    edits: det.edits ?? {},
    claimedArtifacts: det.claimedArtifacts !== false,
  };
}

/**
 * A printable description of the plan, for dry runs and logs: the suite,
 * source, settings, session instruction and verbosity record, and per
 * attempt the launch, the verbosity it carries, and the deterministic
 * expectations and premise it will be judged by, so a plan can be verified
 * without opening the case files.
 */
export function describePlan(plan) {
  return {
    suite: { name: plan.suite.name, skill: plan.suite.skill, hash: plan.suite.hash, cases: plan.cells.map((cell) => cell.caseDef.id).filter((id, index, all) => all.indexOf(id) === index) },
    source: plan.source,
    runDir: plan.runDir,
    existingRun: plan.existing !== null,
    engine: plan.settings.engine,
    model: plan.settings.model,
    effort: plan.settings.effort,
    verbosity: plan.verbosity,
    replicates: plan.replicates,
    timeoutSeconds: plan.timeoutSeconds,
    sessionInstruction: plan.sessionInstruction,
    skipped: plan.skipped.map((cell) => ({ case: cell.caseDef.id, replicate: cell.replicate, attemptDir: cell.attemptDir, status: cell.status, verdict: cell.verdict })),
    attempts: plan.cells.map((cell) => ({ case: cell.caseDef.id, replicate: cell.replicate, attemptDir: cell.attemptDir, cwd: cell.plan.cwd, argv: cell.plan.argv, promptOnStdin: cell.plan.promptFile, verbosity: { requested: cell.plan.verbosity.requested, argv: cell.plan.verbosity.argv }, expectations: expectationsOf(cell.caseDef), premise: cell.caseDef.deterministic.premise })),
  };
}

function createRun(plan, now) {
  fs.mkdirSync(plan.runDir, { recursive: true });
  let manifest;
  if (plan.source.kind === 'tree') manifest = materializeTree(plan.source.repo, plan.source.tree, plan.sourceRoot);
  else manifest = materializeDirectory(plan.source.dir, plan.sourceRoot);
  const identity = sourceIdentity(manifest, plan.source.tree);
  writeJson(path.join(plan.runDir, 'source-manifest.json'), { ...identity, files: manifest });
  // The instruction as the materialized tree carries it, for every engine
  // the run will hold; each Codex attempt's command.json records what it
  // actually received.
  const codexInstruction = codexSessionInstruction(plan.sourceRoot);
  fs.cpSync(plan.suite.dir, path.join(plan.runDir, 'suites', plan.suite.name), { recursive: true, errorOnExist: true, force: false });
  const record = {
    format: RUN_FORMAT,
    version: 1,
    created: isoNow(now),
    suite: { name: plan.suite.name, skill: plan.suite.skill, skills: plan.suite.skills, hash: plan.suite.hash, cases: plan.suite.cases.map((caseDef) => caseDef.id) },
    source: { kind: plan.source.kind, repo: plan.source.repo ?? null, treeish: plan.source.treeish ?? null, dir: plan.source.dir ?? null, ...identity },
    skills: plan.suite.skills,
    codexSessionInstruction: { ...codexInstruction, appliesTo: 'codex' },
    // The verbosity every cell of this run is requested at; `argv` and
    // `mechanism` are the creating engine's mapping of it, and each
    // attempt's command.json records its own.
    verbosity: { ...plan.verbosity, engine: plan.settings.engine },
  };
  writeJson(path.join(plan.runDir, 'run.json'), record);
  return record;
}

/**
 * Execute a plan serially, creating the run when it is new. Returns the
 * attempt records. `spawn` and `now` are the seams the harness tests use.
 */
export function executeRun(plan, { out = console, now = Date.now, spawn } = {}) {
  const run = plan.existing ?? createRun(plan, now);
  const identity = { suite: { name: run.suite.name, hash: run.suite.hash }, source: { tree: run.source.tree, digest: run.source.digest } };
  // The record every attempt carries comes from the materialized source; a
  // plan made from the origin must agree with it, or the source changed
  // between planning and running.
  const sessionInstruction = sessionInstructionFor(plan.settings.engine, plan.sourceRoot);
  if (sessionInstruction.present !== plan.sessionInstruction.present || sessionInstruction.rawSha256 !== plan.sessionInstruction.rawSha256) {
    throw new Error(`the Codex session instruction at ${sessionInstruction.file} differs from the one planned (${plan.sessionInstruction.resolvedFrom}); the source changed between planning and running, so plan again`);
  }
  if (sessionInstruction.applied) out.info?.(`codex session instruction applied from ${sessionInstruction.file} (effective sha256 ${sessionInstruction.effectiveSha256})`);
  else if (plan.settings.engine === 'codex') out.info?.(`no codex session instruction: ${sessionInstruction.file} is ${sessionInstruction.reason}`);
  const records = [];
  for (const cell of plan.skipped) out.info?.(`skip ${cell.caseDef.id}/${plan.settings.engine}/${ordinal(cell.replicate)}: already attempted (${cell.status}${cell.verdict ? `, ${cell.verdict}` : ''})`);
  for (const cell of plan.cells) {
    out.info?.(`run ${cell.caseDef.id}/${plan.settings.engine}/${ordinal(cell.replicate)} (${plan.settings.model} ${plan.settings.effort}, verbosity ${plan.verbosity.requested})`);
    const record = runAttempt({
      attemptDir: cell.attemptDir,
      sourceRoot: plan.sourceRoot,
      suite: plan.suite,
      caseDef: cell.caseDef,
      engine: plan.settings.engine,
      model: plan.settings.model,
      effort: plan.settings.effort,
      verbosity: plan.verbosity,
      replicate: cell.replicate,
      executables: plan.executables,
      timeoutSeconds: plan.timeoutSeconds,
      now,
      ...(spawn ? { spawn } : {}),
      identity,
      sessionInstruction,
    });
    out.info?.(`  ${record.status}${record.reason ? `: ${record.reason}` : ''}${record.verdict ? `; deterministic ${record.verdict}` : ''} (${record.exit.seconds}s)`);
    records.push(record);
  }
  return records;
}

/** The attempts of one cell in order: the original, then its retries. */
export function cellAttempts(cellDir) {
  const original = readAttempt(cellDir);
  if (!original) return [];
  const retries = fs.readdirSync(cellDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^retry-\d{2}$/.test(entry.name))
    .map((entry) => entry.name)
    .sort()
    .map((name) => readAttempt(path.join(cellDir, name)))
    .filter(Boolean);
  return [original, ...retries];
}

/**
 * Whether a cell may be retried under the standing transport policy, and why
 * not when it may not. A cell is retried only while its latest attempt is a
 * transport failure, and at most `maxPerCell` times.
 */
export function retryEligibility(cellDir, maxPerCell) {
  const attempts = cellAttempts(cellDir);
  if (attempts.length === 0) return { eligible: false, reason: `no attempt at ${cellDir}` };
  const latest = attempts.at(-1);
  if (latest.status === 'behavioral') return { eligible: false, reason: `latest attempt ${latest.id} produced a behavioral reply (${latest.verdict}); behavioral results are never rerun` };
  const retries = attempts.length - 1;
  if (retries >= maxPerCell) return { eligible: false, reason: `cell already has ${retries} retries; the policy allows at most ${maxPerCell}` };
  return { eligible: true, attempts, next: path.join(cellDir, `retry-${String(retries + 1).padStart(2, '0')}`) };
}

/**
 * Retry a transport failure: same case, engine, model, effort, verbosity and
 * source, after the cooldown, serially, into the next retry directory of the
 * cell, leaving every earlier attempt in place.
 */
export function retryCell({ runDir, cell, cooldownSeconds, maxPerCell, executables = {}, timeoutSeconds = null, out = console, now = Date.now, spawn, sleep = syncSleep }) {
  const { location, existing } = resolveRunDir(runDir);
  if (!existing) throw new Error(`${location} holds no run`);
  const match = /^([a-z0-9-]+)\/(claude|codex)\/(\d{3})$/.exec(cell ?? '');
  if (!match) throw new Error(`cell must be <case>/<engine>/<replicate>, for example purpose-unsettled/claude/001; got '${cell}'`);
  const [, caseId, engine, replicate] = match;
  const cellDir = path.join(location, 'attempts', caseId, engine, replicate);
  const eligibility = retryEligibility(cellDir, maxPerCell);
  if (!eligibility.eligible) throw new Error(`cell ${cell} is not eligible for a transport retry: ${eligibility.reason}`);
  const original = eligibility.attempts[0];
  const suite = loadSuite(existing.suite.name, path.join(location, 'suites'));
  if (suite.hash !== existing.suite.hash) throw new Error(`the run's suite snapshot no longer matches its recorded hash; the run directory was altered`);
  const caseDef = suite.cases.find((candidate) => candidate.id === caseId);
  // An attempt recorded before the verbosity dimension existed ran at the engine default.
  const requestedVerbosity = original.verbosity === undefined || original.verbosity === ENGINE_DEFAULT_VERBOSITY ? null : original.verbosity;
  const settings = validateSettings(engine, original.model, original.effort, requestedVerbosity);
  const verbosity = verbosityFor(engine, settings.verbosity);
  const sessionInstruction = sessionInstructionFor(engine, path.join(location, 'source'));
  out.info?.(`retry ${cell} after ${cooldownSeconds}s cooldown (${settings.model} ${settings.effort}, verbosity ${verbosity.requested}); ${eligibility.attempts.length - 1} earlier retries`);
  sleep(cooldownSeconds * 1000);
  const record = runAttempt({
    attemptDir: eligibility.next,
    sourceRoot: path.join(location, 'source'),
    suite,
    caseDef,
    engine,
    model: settings.model,
    effort: settings.effort,
    verbosity,
    replicate: Number(replicate),
    retryOf: eligibility.attempts.at(-1).id,
    executables,
    timeoutSeconds: timeoutSeconds ?? readJson(path.join(cellDir, 'command.json')).requested.timeoutSeconds,
    now,
    ...(spawn ? { spawn } : {}),
    identity: { suite: { name: existing.suite.name, hash: existing.suite.hash }, source: { tree: existing.source.tree, digest: existing.source.digest } },
    sessionInstruction,
  });
  out.info?.(`  ${record.status}${record.reason ? `: ${record.reason}` : ''}${record.verdict ? `; deterministic ${record.verdict}` : ''} (${record.exit.seconds}s)`);
  return record;
}
