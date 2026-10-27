#!/usr/bin/env node
// Behavioral skill suites: run a suite against a pinned source tree with an
// explicit engine, model, effort and verbosity, retry transport failures
// under the standing policy, and report certification.
//
//   node tests/skills/run.mjs list [--suite <name>]
//   node tests/skills/run.mjs run --suite <name> --engine claude|codex [--model <id>] [--effort <level>]
//        [--verbosity <value>] [--replicates <n>] (--source-tree <tree-ish> [--repo <checkout>] | --source-dir <dir>)
//        --run-dir <dir outside every checkout> [--case <id>]... [--timeout-seconds <n>]
//        [--executable <engine>=<path>]... [--suites-root <dir>] [--dry-run]
//   node tests/skills/run.mjs retry --run-dir <dir> --cell <case>/<engine>/<replicate>
//        [--cooldown-seconds <n>] [--executable <engine>=<path>]...
//   node tests/skills/run.mjs inspect --run-dir <dir> [--cell <case>/<engine>/<replicate>]... [--suite <dir|tree-ish> [--repo <checkout>]]
//   node tests/skills/run.mjs report --run-dir <dir> [--judgments <file>] [--engines <a,b>] [--replicates <n>]
//        [--suite <dir|tree-ish> [--repo <checkout>]]
//
// `inspect` recomputes every retained attempt's inspection.json and
// attempt.json from its retained trace and workspace with the current
// classifier, launching nothing and keeping the earlier pair beside the new
// one as inspection.NNN.json and attempt.NNN.json; `report` reads the latest.
// For both, `--suite` names a revised suite (a directory holding it, or a
// tree-ish of this checkout or --repo) to judge against instead of the
// recorded one; it is accepted only when its case ids, fixtures and prompts
// match the run's, and both hashes and the criteria changes are recorded.
//
// Defaults for engine models, effort, replicates, timeout and the retry policy
// come from tests/skills/defaults.json. `--verbosity` has no default: omitted,
// the engine runs at its own default and the run records `engine-default`;
// given, it is Claude Code's output style name (passed as `--settings
// '{"outputStyle":"<value>"}'`) or Codex's `model_verbosity` level (`low`,
// `medium`, `high`, passed as `-c model_verbosity="<value>"`). Every paid run
// is explicit: nothing here runs under `node --test` or `node tools/verify.mjs`.

import path from 'node:path';
import { parseArgs } from 'node:util';
import { readJson, skillsTestRoot } from './lib/common.mjs';
import { ENGINES } from './lib/engines.mjs';
import { describePlan, executeRun, planRun, retryCell } from './lib/run.mjs';
import { reinspectRun } from './lib/reinspect.mjs';
import { buildReport, loadJudgments, writeReport } from './lib/report.mjs';
import { listSuites, loadSuite } from './lib/suite.mjs';

const USAGE = 'node tests/skills/run.mjs list|run|retry|inspect|report [options]; see the header of this file or tests/skills/README.md';
const defaults = readJson(path.join(skillsTestRoot, 'defaults.json'));

function usage(message) {
  if (message) process.stderr.write(`${message}\n`);
  process.stderr.write(`usage: ${USAGE}\n`);
  process.exit(2);
}

function integer(value, name, fallback) {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(value)) usage(`${name} must be a non-negative integer, got '${value}'`);
  return Number(value);
}

function executablesFrom(values = []) {
  const executables = {};
  for (const value of values) {
    const match = /^([a-z]+)=(.+)$/.exec(value);
    if (!match || !Object.hasOwn(ENGINES, match[1])) usage(`--executable must be <engine>=<path> with engine one of ${Object.keys(ENGINES).join(', ')}; got '${value}'`);
    executables[match[1]] = match[2];
  }
  return executables;
}

const out = { info: (line) => process.stdout.write(`${line}\n`), error: (line) => process.stderr.write(`${line}\n`) };

const [command, ...rest] = process.argv.slice(2);
const options = {
  suite: { type: 'string' },
  engine: { type: 'string' },
  model: { type: 'string' },
  effort: { type: 'string' },
  verbosity: { type: 'string' },
  replicates: { type: 'string' },
  'source-tree': { type: 'string' },
  'source-dir': { type: 'string' },
  repo: { type: 'string' },
  'run-dir': { type: 'string' },
  case: { type: 'string', multiple: true },
  'timeout-seconds': { type: 'string' },
  executable: { type: 'string', multiple: true },
  'dry-run': { type: 'boolean' },
  'suites-root': { type: 'string' },
  cell: { type: 'string', multiple: true },
  'cooldown-seconds': { type: 'string' },
  judgments: { type: 'string' },
  engines: { type: 'string' },
  help: { type: 'boolean', short: 'h' },
};
let args;
try {
  args = parseArgs({ args: rest, options, allowPositionals: false, strict: true }).values;
} catch (error) {
  usage(error.message);
}
if (args.help || command === undefined || command === '--help' || command === '-h') usage();

try {
  switch (command) {
    case 'list': {
      if (args.suite === undefined) {
        for (const name of listSuites(args['suites-root'])) out.info(name);
        break;
      }
      const suite = loadSuite(args.suite, args['suites-root']);
      out.info(`${suite.name}: skill ${suite.skill}; hash ${suite.hash}; ${suite.cases.length} cases`);
      for (const caseDef of suite.cases) out.info(`  ${caseDef.id}: ${caseDef.effect}`);
      break;
    }
    case 'run': {
      if (!args.suite) usage('--suite is required');
      if (!args.engine || !Object.hasOwn(ENGINES, args.engine)) usage(`--engine must be one of ${Object.keys(ENGINES).join(', ')}`);
      if ((args['source-tree'] === undefined) === (args['source-dir'] === undefined)) usage('give exactly one of --source-tree <tree-ish> or --source-dir <dir>');
      if (args['source-dir'] !== undefined && args.repo !== undefined) usage('--repo applies only with --source-tree');
      if (!args['run-dir']) usage('--run-dir is required');
      const engineDefaults = defaults.engines[args.engine] ?? {};
      const plan = planRun({
        suiteName: args.suite,
        suitesRoot: args['suites-root'],
        engine: args.engine,
        model: args.model ?? engineDefaults.model,
        effort: args.effort ?? engineDefaults.effort,
        verbosity: args.verbosity ?? null,
        replicates: integer(args.replicates, '--replicates', defaults.replicates),
        cases: args.case ?? null,
        source: args['source-dir'] !== undefined ? { dir: args['source-dir'] } : { repo: args.repo, tree: args['source-tree'] },
        runDir: args['run-dir'],
        executables: executablesFrom(args.executable),
        timeoutSeconds: integer(args['timeout-seconds'], '--timeout-seconds', defaults.timeoutSeconds),
      });
      if (args['dry-run']) {
        out.info(JSON.stringify(describePlan(plan), null, 2));
        out.info(`dry run: ${plan.cells.length} attempts planned${plan.skipped.length ? `, ${plan.skipped.length} already attempted and skipped` : ''}, nothing launched, nothing written`);
        break;
      }
      const records = executeRun(plan, { out });
      const transport = records.filter((record) => record.status === 'transport-failure');
      out.info(`${records.length} attempts; ${records.length - transport.length} behavioral, ${transport.length} transport failures${plan.skipped.length ? `; ${plan.skipped.length} earlier attempts kept` : ''}; run at ${plan.runDir}`);
      if (transport.length) {
        out.info(`retry a transport failure with: node tests/skills/run.mjs retry --run-dir "${plan.runDir}" --cell <case>/${plan.settings.engine}/<replicate>`);
        process.exitCode = 1;
      }
      break;
    }
    case 'retry': {
      if (!args['run-dir']) usage('--run-dir is required');
      if (!args.cell?.length) usage('--cell <case>/<engine>/<replicate> is required');
      if (args.cell.length > 1) usage('retry takes one --cell; retries run serially');
      const record = retryCell({
        runDir: args['run-dir'],
        cell: args.cell[0],
        cooldownSeconds: integer(args['cooldown-seconds'], '--cooldown-seconds', defaults.transportRetry.cooldownSeconds),
        maxPerCell: defaults.transportRetry.maxPerCell,
        executables: executablesFrom(args.executable),
        timeoutSeconds: args['timeout-seconds'] === undefined ? null : integer(args['timeout-seconds'], '--timeout-seconds'),
        out,
      });
      if (record.status !== 'behavioral') process.exitCode = 1;
      break;
    }
    case 'inspect': {
      if (!args['run-dir']) usage('--run-dir is required');
      if (args.repo !== undefined && args.suite === undefined) usage('--repo applies only with --suite');
      const { runDir, outcomes } = reinspectRun({ runDir: args['run-dir'], cells: args.cell ?? null, suite: args.suite ?? null, repo: args.repo ?? null, out });
      const failed = outcomes.filter((outcome) => !outcome.ok);
      const changed = outcomes.filter((outcome) => outcome.ok && (outcome.before.verdict !== outcome.after.verdict || outcome.before.status !== outcome.after.status));
      out.info(`${outcomes.length} attempts reinspected, ${changed.length} verdicts changed, ${failed.length} not reinspected; run at ${runDir}`);
      if (failed.length) process.exitCode = 1;
      break;
    }
    case 'report': {
      if (!args['run-dir']) usage('--run-dir is required');
      if (args.repo !== undefined && args.suite === undefined) usage('--repo applies only with --suite');
      const judgments = args.judgments === undefined ? null : loadJudgments(args.judgments);
      const report = buildReport({
        runDir: args['run-dir'],
        judgments,
        standingEngines: args.engines === undefined ? defaults.standingEngines : args.engines.split(',').filter(Boolean),
        replicates: integer(args.replicates, '--replicates', defaults.replicates),
        suite: args.suite ?? null,
        repo: args.repo ?? null,
      });
      const written = writeReport(report.runDir, report);
      out.info(`${report.certified ? 'certified' : 'not certified'}: ${report.suite.name} at source ${report.source.tree ?? report.source.digest}, verbosity ${report.verbosity}${report.suite.revised ? `; graded against revised suite ${report.suite.revised.hash} (run recorded ${report.suite.hash})` : ''}`);
      for (const caseDef of report.cases) {
        out.info(`  ${caseDef.id}: ${Object.entries(caseDef.engines).map(([engine, summary]) => `${engine} ${summary.status} ${summary.passed}/${summary.replicates}`).join('; ')}`);
      }
      out.info(`report: ${written.markdown}`);
      break;
    }
    default:
      usage(`unknown command '${command}'`);
  }
} catch (error) {
  out.error(`skill-suite: ${error.message}`);
  process.exitCode = 1;
}
