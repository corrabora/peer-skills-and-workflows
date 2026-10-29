// Read-only peer storage selection. Binding inspection supplies mechanical facts;
// the binding skill owns the separate coverage/readiness judgment.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  canonical, canonicalLocation, checkRunId, hostContext, isWithin, localDirectory,
  machineBase, pathFor, repositoryKey, runRoot, scratchRoot,
} from './paths.mjs';
import { sourceRoot } from './cli.mjs';

/** Pure mapping; callers supply the canonical workspace, including on simulated hosts. */
export function peerLocations(host, workspace, run, task) {
  checkRunId(run);
  checkRunId(task, 'task id');
  const p = pathFor(host.platform);
  return {
    externalRecords: p.join(machineBase(host), 'records', 'repositories', repositoryKey(workspace, host.platform), 'runs', run, 'peers', task),
    localRecords: p.join(runRoot(workspace, run, host.platform), 'peers', task),
    scratch: p.join(scratchRoot(host, workspace, run), 'peers', task),
  };
}

function entry(target) {
  try { return fs.lstatSync(target); }
  catch (error) {
    if (error.code === 'ENOENT') return null;
    throw new Error(`cannot inspect ${target}: ${error.code ?? error.message}`);
  }
}

/** Refuse occupied directories and links from the selected base downward. */
function plainDirectories(base, target) {
  if (!isWithin(base, target)) throw new Error(`${target} is outside storage base ${base}`);
  let current = base;
  for (const part of ['', ...path.relative(base, target).split(path.sep).filter(Boolean)]) {
    current = path.join(current, part);
    const state = entry(current);
    if (state && (!state.isDirectory() || state.isSymbolicLink())) {
      throw new Error(`storage path occupied by a link or non-directory: ${current}`);
    }
  }
}

function overlap(one, two) { return isWithin(one, two) || isWithin(two, one); }

/** Full public inspection only when binding state exists. Never imports ajv on the absent branch. */
function inspectBinding(workspace, localRecords) {
  const marker = entry(path.join(workspace, '.git'));
  if (!marker) return { state: 'folder', reason: 'no Git checkout marker at the workspace root', eligibleForCheck: false };
  const local = localDirectory(workspace);
  plainDirectories(workspace, local);
  const children = ['binding.md', 'binding-sources.json'].map(name => entry(path.join(local, name)));
  if (children.every(child => child === null)) {
    return { state: 'absent', reason: 'both binding children are absent', eligibleForCheck: false };
  }
  plainDirectories(workspace, localRecords);
  const result = spawnSync(process.execPath, [path.join(sourceRoot, 'tools', 'bind.mjs'), 'inspect', '--repo', workspace], {
    encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' },
  });
  let inspection;
  try { inspection = JSON.parse(result.stdout); } catch { /* Failure below retains the diagnostic. */ }
  if (result.error || result.status !== 0 || !inspection) {
    throw Object.assign(new Error(`binding inspection unavailable: ${result.error?.message || result.stderr?.trim() || 'see partial inspection'} (exit ${result.status})`), { inspection });
  }
  const b = inspection.binding;
  const s = inspection.localStorage;
  const facts = {
    ordinaryChildren: b?.state?.kind === 'file' && b?.sourcesState?.kind === 'file',
    usableManifest: b?.manifest?.usable === true,
    exactCheckout: inspection.checkout === workspace && b?.checkoutMatches === true,
    recordedSourcesComplete: b?.comparison?.complete === true,
    recordedSourcesCurrent: b?.comparison?.current === true,
    discoveryComplete: inspection.discovery?.complete === true,
    protectedStorage: s?.ignored === true && Array.isArray(s?.tracked) && s.tracked.length === 0 && !s.occupied,
  };
  return {
    state: 'inspected', eligibleForCheck: Object.values(facts).every(Boolean), facts,
    reasons: Object.keys(facts).filter(key => !facts[key]), inspection,
  };
}

/** Resolve existing facts and destinations without creating or repairing anything. */
export function resolvePeerRecords({ workspace: requested, run, task, storage, host = hostContext() }) {
  if (storage !== undefined && !['local', 'external'].includes(storage)) throw new Error('--storage must be local or external');
  const workspace = canonical(requested);
  if (!workspace || !fs.statSync(workspace).isDirectory()) throw new Error(`workspace is not an existing directory: ${requested}`);
  const locations = peerLocations(host, workspace, run, task);
  // Resolve the user base's aliases (for example the OS home path), but reject
  // links and occupants within the task's selected namespace.
  const base = canonicalLocation(machineBase(host));
  const scratch = canonicalLocation(locations.scratch);
  if (overlap(workspace, scratch)) throw new Error(`scratch root overlaps workspace: ${scratch}`);
  plainDirectories(base, path.join(base, path.relative(machineBase(host), locations.scratch)));
  const binding = storage === 'external'
    ? { state: 'not-inspected', reason: 'explicit external selection', eligibleForCheck: false }
    : inspectBinding(workspace, locations.localRecords);
  let localCandidate = null;
  if (binding.eligibleForCheck) {
    plainDirectories(workspace, locations.localRecords);
    localCandidate = locations.localRecords;
  }
  if (storage === 'local' && !localCandidate) {
    throw Object.assign(new Error('local records require current mechanical binding facts; see binding reasons'), { binding });
  }
  const selected = storage === 'local' ? 'local' : 'external';
  const records = selected === 'local' ? localCandidate : canonicalLocation(locations.externalRecords);
  if (selected === 'external') {
    if (overlap(workspace, records)) throw new Error(`external records root overlaps workspace: ${records}`);
    plainDirectories(base, path.join(base, path.relative(machineBase(host), locations.externalRecords)));
  }
  if (overlap(records, scratch)) throw new Error(`records and scratch roots overlap: ${records}, ${scratch}`);
  return {
    workspace, run, task, storage: selected, recordsRoot: records, scratchRoot: scratch, localCandidate, binding,
    bindingCheckRequired: localCandidate !== null,
    scope: 'Mechanical storage facts only. Local selection also requires current binding CHECK evidence; resolution grants no writing authority.',
  };
}
