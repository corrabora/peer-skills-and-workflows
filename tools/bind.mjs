#!/usr/bin/env node
// Deterministic steps of binding the workflow to one checkout, for the
// bind-agent-workflow skill (workflow/BINDING.md). Prints JSON; the skill
// supplies the judgment.
//
//   node tools/bind.mjs inspect --repo <checkout>
//       Git identity of the checkout and of this workflow source, local
//       storage state (whether Git excludes the `.peer-skills-and-workflows/` directory
//       itself, with partial effects), the existing local binding and its
//       recorded manifest (usable or not, with path and reason) compared with
//       the current state of the sources it records, the installed
//       quality-profile selection and candidate guidance sources. Leaves project
//       files and workflow records unchanged; Git may update administrative
//       caches. It creates no directory or exclude rule. The comparison
//       covers the recorded sources; newly added guidance appears in
//       `candidates` (discovered guidance sources), which the skill compares
//       with the binding's cited sources. Discovery enumeration warnings and
//       listed names that are not UTF-8 (BINDING.md, Path names) return
//       discovery.complete false with path/cause errors (an unsupported name as
//       an escaped `name` beside the checkout `path`) and exit 1. Do not read
//       newly exposed candidates until the operator resolves the reported cause,
//       restoring access or obtaining a separately authorized rename to UTF-8,
//       and a recheck establishes complete discovery.
//   node tools/bind.mjs exclude --repo <checkout>
//       Establish local storage: refuse tracked `.peer-skills-and-workflows/` content and
//       a path occupied by a file, link or other non-directory entry (decided
//       before any probe or write), reuse a rule that excludes the directory
//       itself, else append `/.peer-skills-and-workflows/` to Git's local exclude file
//       once and verify with Git. Sequential repeats write nothing; concurrent
//       outcomes follow BINDING.md Local storage. Exits
//       1 when storage could not be established; the JSON names the conflict
//       (`tracked`, `occupied`, `unverified` or `unwritable`).
//   node tools/bind.mjs sources --repo <checkout> [--compare <manifest>]
//       [--out <file>] <path>...
//       Record the content identity of each source (a file or directory in the
//       checkout, named by its lookup path, or an absolute personal path), with
//       this workflow source's identity, and compare it with a recorded
//       manifest. The comparison covers the paths listed in this invocation
//       against the recorded ones: a recorded path not listed here is reported
//       as `missing` whether or not it still exists, so list every recorded
//       path, or use `inspect`, for the whole recorded set. Nothing is written
//       without `--out`; the skill passes
//       `--out <checkout>/.peer-skills-and-workflows/binding-sources.json` for the
//       binding. `--out` may name any other destination such as a scratch
//       export, except local binding.md, checkout/owning-child Git administration,
//       requested paths beneath occupied named local storage (through any
//       alias of the checkout, and under any name the filesystem treats as
//       that storage or binding file, such as another case on a
//       case-insensitive volume),
//       or a path that resolves (aliases and `..` included) to a file tracked by the checkout
//       or owning nested repository/submodule. Unavailable child boundaries
//       also refuse (workflow/BINDING.md, Procedure), with exit 1 and
//       a `refused` object, and nothing is written. Successful exports report
//       `written` as the requested path and `resolved` when the destination differs.
//       Expected source access failures
//       return partial JSON with unreadable entries and exit 1; incomplete
//       comparisons never establish currentness. Exits 0 even when readable sources
//       changed; `comparison.current` says whether they did, and a manifest
//       that cannot be used is reported as `comparison.usable: false` with its
//       path and reason, including a --compare file named beneath occupied
//       local storage, which is not read (`occupied` names the conflict).
//       With --compare and --out, comparison is stdout only.

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { sourceRoot, usage } from './lib/cli.mjs';
import { canonicalLocation } from './lib/paths.mjs';

const {
  BINDING_FILE, bindingFileState, checkoutFacts, compareManifests, discoverCandidates, establishLocalStorage, excludeFile, hasExcludeRule, ignoreCoverage,
  LOCAL_DIRECTORY, localStorageChild, namedStorageOccupant, outputDestinationProblem, qualitySelection, readManifest, sourceManifest, SOURCES_FILE, trackedLocalPaths,
  workflowSourceIdentity,
} = await import('./lib/bind.mjs').catch((error) => {
  if (error.name !== 'MissingDependencyError') throw error;
  process.stderr.write(`bind: ${error.message}\n`);
  process.exit(1);
});

const USAGE = 'node tools/bind.mjs inspect --repo <checkout> | exclude --repo <checkout> | '
  + 'sources --repo <checkout> [--compare <manifest>] [--out <file>] <path>...';

const [command, ...rest] = process.argv.slice(2);
if (!['inspect', 'exclude', 'sources'].includes(command)) usage(USAGE);
let values;
let positionals;
try {
  ({ values, positionals } = parseArgs({
    args: rest,
    options: { repo: { type: 'string' }, compare: { type: 'string' }, out: { type: 'string' } },
    allowPositionals: command === 'sources',
    strict: true,
  }));
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  usage(USAGE);
}
if (!values.repo) usage(USAGE);
if (command !== 'sources' && (values.compare !== undefined || values.out !== undefined)) usage(USAGE);
if (command === 'sources' && !positionals.length) usage(`sources needs at least one path\n${USAGE}`);

/**
 * The comparison of a recorded manifest file with the current manifest, or its
 * unusable state. A file named beneath occupied local storage is not read
 * through the occupant; a directly named external file is compared as given.
 */
function comparisonWith(file, current, scope) {
  let occupied;
  try {
    occupied = namedStorageOccupant(current.checkout, file);
  } catch (error) {
    return { usable: false, current: false, scope, path: file, reason: `local storage protection could not be established: ${error.cause?.code ?? error.code ?? error.message}` };
  }
  if (occupied) return { usable: false, current: false, scope, path: file, reason: 'local storage path occupied', occupied };
  const recorded = readManifest(file);
  if (recorded.error) return { usable: false, current: false, scope, path: recorded.error.path, reason: recorded.error.reason };
  return { usable: true, scope, ...checkoutComparison(recorded.manifest, current.checkout), ...compareManifests(recorded.manifest, current) };
}

/** Checkout provenance is separate from content currentness; unknown stays unknown. */
function checkoutComparison(recorded, checkout) {
  const recordedCheckout = recorded.checkout ?? null;
  try {
    if (typeof recordedCheckout !== 'string' || !path.isAbsolute(recordedCheckout)) throw new Error('recorded checkout is not an absolute path');
    const recordedCheckoutCanonical = canonicalLocation(recordedCheckout);
    return { recordedCheckout, recordedCheckoutCanonical, checkoutMatches: recordedCheckoutCanonical === checkout };
  } catch (error) {
    return { recordedCheckout, recordedCheckoutCanonical: null, checkoutMatches: null, checkoutMatchError: error.code ?? error.message };
  }
}

try {
  const facts = checkoutFacts(values.repo);
  const { checkout } = facts;
  const local = path.join(checkout, LOCAL_DIRECTORY);
  let result;
  if (command === 'inspect') {
    const coverage = ignoreCoverage(checkout);
    const bindingPath = path.join(local, BINDING_FILE);
    const sourcesPath = path.join(local, SOURCES_FILE);
    const state = coverage.occupied ? { kind: 'unavailable', present: null, reason: 'local storage path occupied' } : bindingFileState(bindingPath);
    const sourcesState = coverage.occupied ? { kind: 'unavailable', present: null, reason: 'local storage path occupied' } : bindingFileState(sourcesPath);
    const recorded = coverage.occupied ? null
      : !['file', 'absent'].includes(sourcesState.kind)
        ? { error: { path: sourcesPath, reason: `binding manifest ${sourcesState.kind}: ${sourcesState.error ?? 'resolve the occupied child before refresh'}` } }
        : readManifest(sourcesPath);
    const binding = coverage.occupied ? {
      path: bindingPath, present: null, state, sourcesPath, sourcesPresent: null, sourcesState,
      manifest: { path: sourcesPath, usable: false, reason: 'local storage unavailable: path occupied' },
    } : {
      path: bindingPath,
      present: state.present,
      state,
      sourcesPath,
      sourcesPresent: sourcesState.present,
      sourcesState,
      manifest: recorded.error
        ? { path: sourcesPath, usable: false, reason: recorded.error.reason }
        : { path: sourcesPath, usable: true, format: recorded.manifest.format, version: recorded.manifest.version },
    };
    if (recorded?.manifest) {
      const current = sourceManifest(checkout, recorded.manifest.sources.map((entry) => entry.path), { workflowSource: sourceRoot });
      binding.recordedHead = recorded.manifest.head ?? null;
      binding.recordedWorkflowSource = recorded.manifest.workflowSource ?? null;
      Object.assign(binding, checkoutComparison(recorded.manifest, checkout));
      binding.comparison = { usable: true, scope: 'recorded', ...compareManifests(recorded.manifest, current) };
      if (!binding.comparison.complete) process.exitCode = 1;
    } else if (recorded && sourcesState.kind !== 'absent') {
      binding.comparison = { usable: false, current: false, scope: 'recorded', path: sourcesPath, reason: recorded.error.reason };
    }
    if (!coverage.occupied && [state, sourcesState].some((entry) => !['file', 'absent'].includes(entry.kind))) {
      binding.conflict = { reason: 'binding children must be plain files; resolve occupied entries or restore access before adoption or refresh', paths: [
        ...(!['file', 'absent'].includes(state.kind) ? [bindingPath] : []),
        ...(!['file', 'absent'].includes(sourcesState.kind) ? [sourcesPath] : []),
      ] };
    }
    const exclude = excludeFile(checkout);
    let rulePresent = false;
    let ruleError;
    try { rulePresent = hasExcludeRule(fs.readFileSync(exclude, 'utf8')); } catch (error) {
      // Only a missing file establishes absence; other read failures are unknown.
      if (error.code !== 'ENOENT') {
        rulePresent = null;
        ruleError = { path: exclude, error: error.code ?? error.message };
      }
    }
    const { candidates, ...discovery } = discoverCandidates(checkout);
    result = {
      workflowSource: workflowSourceIdentity(sourceRoot),
      ...facts,
      localDirectory: local,
      localStorage: { tracked: trackedLocalPaths(checkout), ...coverage, excludeFile: exclude, rulePresent, ...(ruleError ? { ruleError } : {}) },
      binding,
      quality: qualitySelection(checkout),
      candidates,
      discovery,
    };
    if (!discovery.complete || ['unreadable', 'unsupported'].includes(result.workflowSource.kind)) process.exitCode = 1;
  } else if (command === 'exclude') {
    result = { checkout, localDirectory: local, ...establishLocalStorage(checkout) };
    if (!['ignored', 'added'].includes(result.status)) process.exitCode = 1;
  } else {
    const manifest = sourceManifest(checkout, positionals, { workflowSource: sourceRoot });
    const comparison = values.compare !== undefined ? comparisonWith(path.resolve(values.compare), manifest, 'listed') : undefined;
    if (!manifest.complete || comparison?.complete === false) process.exitCode = 1;
    if (values.out !== undefined) {
      const out = path.resolve(values.out);
      const destinationProblem = outputDestinationProblem(facts, out);
      let localChild = null;
      let childError = null;
      try {
        // A binding child named under any spelling the filesystem treats as it.
        if (!destinationProblem?.occupied) localChild = localStorageChild(checkout, path.join(canonicalLocation(path.dirname(out)), path.basename(out)));
      } catch (error) { childError = error; }
      const childState = localChild ? bindingFileState(localChild) : null;
      const problem = childState && !['file', 'absent'].includes(childState.kind)
        ? { reason: 'binding output child must be a plain file; resolve the occupied entry or restore access before refresh', state: childState }
        : destinationProblem ?? (childError && { reason: 'destination protection could not be established; resolve the reported cause before exporting', error: childError.cause?.code ?? childError.code ?? childError.message });
      if (problem) {
        manifest.written = null;
        manifest.refused = { out, ...problem, checkout };
        process.exitCode = 1;
      } else {
        const resolved = canonicalLocation(out);
        fs.mkdirSync(path.dirname(out), { recursive: true });
        fs.writeFileSync(out, `${JSON.stringify(manifest, null, 2)}\n`);
        manifest.written = out;
        if (resolved !== out) manifest.resolved = resolved;
      }
    }
    result = { ...manifest, ...(comparison ? { comparison } : {}) };
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`bind: ${error.message}\n`);
  process.exitCode = 1;
}
