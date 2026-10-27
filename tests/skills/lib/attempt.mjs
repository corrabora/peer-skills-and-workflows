// One attempt: a case's fixture materialized for one engine, model, effort
// and verbosity, the engine launched once, and everything it produced
// retained in the attempt directory: prompt, inputs, outputs, trace, stderr,
// exit, timing, requested and effective settings, and the deterministic
// inspection.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { isoNow, readJson, subprocessEnvironment, writeJson } from './common.mjs';
import { ENGINE_DEFAULT_VERBOSITY, engineFor, launchFor } from './engines.mjs';
import { copyWorkspace, initWorkspaceGit, installSkillLinks, recordManifest } from './materialize.mjs';
import { inspectAttempt, skillSignatures } from './inspect.mjs';

export const RETAINED_FILES = ['prompt.md', 'fixture-manifest.json', 'command.json', 'trace.jsonl', 'stderr.txt', 'exit.json', 'inspection.json', 'attempt.json'];

/**
 * Describe the launch of one attempt: the paths it will use, the exact
 * command, and the session-instruction and verbosity records the command
 * carries. Dry runs print this. `sessionInstruction` is the record the run
 * resolved from the source tree under test; when it is not given, the launch
 * resolves it from `sourceRoot` (the only read this function then makes).
 * `verbosity` is the requested value (null or omitted for the engine
 * default) or the record the run already built.
 */
export function planAttempt({ attemptDir, sourceRoot, engine, model, effort, verbosity = null, executables, sessionInstruction }) {
  const workspace = path.join(attemptDir, 'workspace');
  const tmp = path.join(attemptDir, 'tmp');
  const launch = launchFor(engine, { model, effort, verbosity, workspace, sourceRoot, attemptDir, sessionInstruction }, executables);
  return { attemptDir, workspace, tmp, argv: launch.argv, cwd: launch.cwd, promptFile: path.join(attemptDir, 'prompt.md'), sessionInstruction: launch.sessionInstruction, verbosity: launch.verbosity };
}

/**
 * Run one attempt into `attemptDir`, which must not exist. Returns the
 * attempt record, also written as attempt.json. A failure to produce a
 * behavioral reply (timeout, signal, spawn error, engine error, no reply) is
 * recorded as status `transport-failure` with its reason; nothing is retried
 * here.
 */
export function runAttempt({ attemptDir, sourceRoot, suite, caseDef, engine: engineName, model, effort, verbosity = null, replicate, retryOf = null, executables = {}, timeoutSeconds, now = Date.now, spawn = spawnSync, identity = {}, sessionInstruction }) {
  if (fs.existsSync(attemptDir)) throw new Error(`attempt directory ${attemptDir} already exists; attempts are never overwritten`);
  const engine = engineFor(engineName);
  const plan = planAttempt({ attemptDir, sourceRoot, engine: engineName, model, effort, verbosity, executables, sessionInstruction });
  fs.mkdirSync(attemptDir, { recursive: true });
  fs.mkdirSync(plan.tmp);
  fs.writeFileSync(plan.promptFile, caseDef.prompt);
  const fixtureManifest = copyWorkspace(caseDef.workspace, plan.workspace, caseDef.fixtureManifest);
  recordManifest(path.join(attemptDir, 'fixture-manifest.json'), fixtureManifest);
  const links = installSkillLinks(plan.workspace, sourceRoot, suite.skills);
  const workspaceGit = initWorkspaceGit(plan.workspace);
  const env = subprocessEnvironment(plan.tmp);

  const startedAt = isoNow(now);
  const command = {
    case: caseDef.id,
    engine: engineName,
    requested: { model, effort, verbosity: plan.verbosity.requested, timeoutSeconds },
    replicate,
    retryOf,
    argv: plan.argv,
    cwd: plan.cwd,
    promptOnStdin: true,
    environment: { TMPDIR: env.TMPDIR, TMP: env.TMP, TEMP: env.TEMP, gitVariablesRemoved: true },
    homeRedirected: false,
    sourceRoot,
    sessionInstruction: plan.sessionInstruction,
    verbosity: plan.verbosity,
    skillLinks: links,
    workspaceGit,
    ...identity,
    startedAt,
  };
  writeJson(path.join(attemptDir, 'command.json'), command);

  const started = now();
  const result = spawn(plan.argv[0], plan.argv.slice(1), {
    cwd: plan.cwd,
    env,
    input: caseDef.prompt,
    timeout: timeoutSeconds * 1000,
    killSignal: 'SIGTERM',
    maxBuffer: 1024 * 1024 * 1024,
  });
  const seconds = Math.round((now() - started) / 10) / 100;
  const stdout = result.stdout ? Buffer.from(result.stdout) : Buffer.alloc(0);
  const stderr = result.stderr ? Buffer.from(result.stderr) : Buffer.alloc(0);
  fs.writeFileSync(path.join(attemptDir, 'trace.jsonl'), stdout);
  fs.writeFileSync(path.join(attemptDir, 'stderr.txt'), stderr);
  const timedOut = result.error?.code === 'ETIMEDOUT' || (result.signal !== null && result.signal !== undefined && result.status === null && result.error !== undefined);
  const exit = {
    status: result.status ?? null,
    signal: result.signal ?? null,
    timedOut,
    spawnError: result.error && !timedOut ? result.error.message : null,
    seconds,
    startedAt,
    finishedAt: isoNow(now),
  };
  writeJson(path.join(attemptDir, 'exit.json'), exit);

  const events = engine.events(stdout.toString('utf8'));
  const finalReply = engine.finalReply(attemptDir, events);
  if (finalReply !== null && engineName === 'claude') fs.writeFileSync(path.join(attemptDir, 'final.txt'), finalReply);
  const effective = engine.effectiveSettings(events);
  const inspection = inspectAttempt({ caseDef, skills: suite.skills, events, finalReply, workspace: plan.workspace, fixtureManifest, exit, effective, signatures: skillSignatures(sourceRoot, suite.skills), sourceRoot, now });
  inspection.suite = { hash: suite.hash, recorded: suite.hash };
  writeJson(path.join(attemptDir, 'inspection.json'), inspection);

  const record = attemptRecord({
    attemptDir, caseDef, engine: engineName, model, effort, verbosity: plan.verbosity.requested, replicate, retryOf, timeoutSeconds,
    exit, finalReply, effective, inspection, stderr: stderr.toString('utf8'), startedAt,
  });
  writeJson(path.join(attemptDir, 'attempt.json'), record);
  return record;
}

/**
 * The attempt record for an attempt's retained files and inspection: its
 * status (`behavioral`, or `transport-failure` with the reason) and, for a
 * behavioral attempt, the inspection's verdict. Used when an attempt is run
 * and when its inspection is recomputed later. `verbosity` is the requested
 * value or `engine-default`; the engine's attestation, when any, is in
 * `effective`.
 */
export function attemptRecord({ attemptDir, caseDef, engine, model, effort, verbosity = ENGINE_DEFAULT_VERBOSITY, replicate, retryOf, timeoutSeconds, exit, finalReply, effective, inspection, stderr, startedAt }) {
  let status = 'behavioral';
  let reason = null;
  if (exit.spawnError) { status = 'transport-failure'; reason = `cannot start engine: ${exit.spawnError}`; }
  else if (exit.timedOut) { status = 'transport-failure'; reason = `timed out after ${timeoutSeconds}s`; }
  else if (exit.signal) { status = 'transport-failure'; reason = `terminated by ${exit.signal}`; }
  else if (finalReply === null) {
    status = 'transport-failure';
    const errors = inspection.engineErrors.length ? `; engine errors: ${inspection.engineErrors.join(' | ').slice(0, 400)}` : '';
    const stderrLine = stderr.split('\n').find((line) => line.trim()) ?? '';
    reason = `no final reply (exit ${exit.status})${errors}${stderrLine ? `; stderr: ${stderrLine.slice(0, 200)}` : ''}`;
  }
  if (status === 'behavioral' && effective.model && effective.model !== model) {
    status = 'transport-failure';
    reason = `engine ran model '${effective.model}' instead of the requested '${model}'`;
  }
  return {
    id: path.basename(attemptDir),
    case: caseDef.id,
    engine,
    model,
    effort,
    verbosity,
    replicate,
    retryOf,
    status,
    reason,
    verdict: status === 'behavioral' ? inspection.verdict : null,
    classifier: { version: inspection.classifier.version, inspectedAt: inspection.classifier.inspectedAt },
    effective,
    exit: { status: exit.status, signal: exit.signal, timedOut: exit.timedOut, seconds: exit.seconds },
    startedAt,
  };
}

/** The attempt record of an attempt directory, or null when it holds none. */
export function readAttempt(attemptDir) {
  const file = path.join(attemptDir, 'attempt.json');
  return fs.existsSync(file) ? readJson(file) : null;
}
