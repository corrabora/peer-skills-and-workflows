#!/usr/bin/env node
// Resolve, for one target checkout, its local workflow directory, the run root,
// the run's machine-local scratch root and the effective worker configuration,
// and print them as JSON for the plan coordinator to record. Reads only;
// creates nothing.
//
//   node tools/resolve.mjs --repo <checkout> [--run <run-id>] [--plan <name>]
//     [--phase <id>] [--profile <name>=<agent>,<model>,<effort>]...
//     [--assign <role-or-seat>=<profile>]...
//
// Layers, lowest precedence first: this package's defaults.yaml, the
// checkout's .agent-workflow/config.yaml, .agent-workflow/plans/<plan>.yaml,
// that plan file's phases.<id> section, then --profile/--assign overrides.

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { operatorLayer, readLayerFile, resolveConfiguration } from './lib/config.mjs';
import { sourceRoot, usage } from './lib/cli.mjs';
import {
  canonical, canonicalLocation, hostContext, isWithin, localDirectory, runRoot, scratchRoot,
} from './lib/paths.mjs';

const USAGE = 'node tools/resolve.mjs --repo <checkout> [--run <run-id>] [--plan <name>] [--phase <id>] '
  + '[--profile <name>=<agent>,<model>,<effort>]... [--assign <role-or-seat>=<profile>]...';
const NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

let values;
try {
  ({ values } = parseArgs({
    options: {
      repo: { type: 'string' },
      run: { type: 'string' },
      plan: { type: 'string' },
      phase: { type: 'string' },
      profile: { type: 'string', multiple: true, default: [] },
      assign: { type: 'string', multiple: true, default: [] },
    },
    strict: true,
  }));
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  usage(USAGE);
}
if (!values.repo) usage(USAGE);
if (values.phase !== undefined && values.plan === undefined) usage(`--phase needs --plan\n${USAGE}`);

try {
  const checkout = canonical(values.repo);
  if (!checkout || !fs.existsSync(path.join(checkout, '.git'))) {
    throw new Error(`${values.repo} is not the top of a Git checkout`);
  }
  const local = localDirectory(checkout);

  const layers = [];
  const consulted = [];
  const addFile = (name, file, options) => {
    const layer = readLayerFile(file, options);
    consulted.push({ layer: name, path: file, present: layer !== null });
    if (layer) layers.push({ name, layer });
    return layer;
  };
  const shared = addFile('shared', path.join(sourceRoot, 'defaults.yaml'));
  if (!shared) throw new Error(`shared defaults ${path.join(sourceRoot, 'defaults.yaml')} are missing`);
  addFile('repository', path.join(local, 'config.yaml'));
  // A supplied --plan or --run, even an empty one, is validated, never taken as omitted.
  // A supplied --phase, even an empty one, selects exactly that phase key,
  // which configuration may define; phase keys have no name grammar.
  if (values.plan !== undefined) {
    if (!NAME.test(values.plan)) throw new Error(`plan name '${values.plan}' must be a simple file name`);
    const plan = addFile('plan', path.join(local, 'plans', `${values.plan}.yaml`), { allowPhases: true });
    if (values.phase !== undefined) {
      const defined = plan !== null && Object.hasOwn(plan.phases, values.phase);
      consulted.push({ layer: 'phase', path: `plans/${values.plan}.yaml phases.${values.phase}`, present: defined });
      if (defined) layers.push({ name: 'phase', layer: plan.phases[values.phase] });
    }
  }
  if (values.profile.length || values.assign.length) {
    layers.push({ name: 'operator', layer: operatorLayer(values.profile, values.assign) });
    consulted.push({ layer: 'operator', path: 'command line', present: true });
  }
  const { profiles, assignments } = resolveConfiguration(layers);

  const result = {
    workflowSource: sourceRoot,
    checkout,
    localDirectory: local,
    ...(values.run !== undefined
      ? { runRoot: runRoot(checkout, values.run), scratchRoot: externalScratch(checkout, values.run) }
      : {}),
    layers: consulted,
    assignments,
    profiles,
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`resolve: ${error.message}\n`);
  process.exitCode = 1;
}

/** The run's scratch root, canonical as far as it exists, refused inside the checkout. */
function externalScratch(checkout, runId) {
  const root = canonicalLocation(scratchRoot(hostContext(), checkout, runId));
  if (isWithin(checkout, root)) {
    throw new Error(`scratch root ${root} lies inside the checkout ${checkout}; scratch must stay outside it`);
  }
  return root;
}
