#!/usr/bin/env node
// Count the active coordinator's observed turns and completed compactions from
// its own session log and report them against the succession thresholds.
// Writes only the counts file named by --counts; prints JSON.
//
//   node tools/succession.mjs marker
//   node tools/succession.mjs locate --engine <claude|codex> [--session <id> | --marker <text> [--since-hours <n>]]
//   node tools/succession.mjs observe --engine <claude|codex> --log <session log> --counts <file>
//     --compaction-threshold <n> --turn-threshold <n> [--lower-bound]
//   node tools/succession.mjs show --counts <file> --compaction-threshold <n> --turn-threshold <n>
//
// locate finds the coordinator's own session log from the session identity
// the engine gives this command (or --session), checked against the identity
// the log records; when the engine gives none, it falls back to a marker
// printed by `marker` in an earlier step. Sub-agent logs are never located or
// counted. observe merges the log's events into the counts file and reports
// whether succession is due; show reports the recorded counts against
// (possibly changed) thresholds.
// Exit status: 0 when not due, 3 when due, 1 on error, 2 on usage.

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { usage } from './lib/cli.mjs';
import { assessSuccession, ENGINES, locateLog, mergeObservation, observationFor, readCounts, writeCounts } from './lib/succession.mjs';

const USAGE = [
  'node tools/succession.mjs marker',
  'node tools/succession.mjs locate --engine <claude|codex> [--session <id> | --marker <text> [--since-hours <n>]]',
  'node tools/succession.mjs observe --engine <claude|codex> --log <file> --counts <file> --compaction-threshold <n> --turn-threshold <n> [--lower-bound]',
  'node tools/succession.mjs show --counts <file> --compaction-threshold <n> --turn-threshold <n>',
].join('\n       ');

const [command, ...rest] = process.argv.slice(2);
let values;
try {
  ({ values } = parseArgs({
    args: rest,
    options: {
      engine: { type: 'string' },
      marker: { type: 'string' },
      session: { type: 'string' },
      'since-hours': { type: 'string', default: '24' },
      log: { type: 'string' },
      counts: { type: 'string' },
      'compaction-threshold': { type: 'string' },
      'turn-threshold': { type: 'string' },
      'lower-bound': { type: 'boolean', default: false },
    },
    strict: true,
  }));
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  usage(USAGE);
}

const print = (value) => process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
const engine = () => {
  if (!ENGINES.includes(values.engine)) usage(USAGE);
  return values.engine;
};
const thresholds = () => {
  const result = {};
  for (const key of ['compaction-threshold', 'turn-threshold']) {
    if (values[key] === undefined) usage(USAGE);
    if (!/^[0-9]+$/.test(values[key]) || Number(values[key]) < 1) throw new Error(`--${key} must be a positive whole number, not '${values[key]}'`);
    result[key] = Number(values[key]);
  }
  return result;
};

try {
  switch (command) {
    case 'marker':
      print({ marker: `aw-coordinator-session-${crypto.randomUUID()}` });
      break;
    case 'locate': {
      const hours = Number(values['since-hours']);
      if (!(hours > 0)) usage(USAGE);
      const found = locateLog({
        engine: engine(), home: os.homedir(), session: values.session ?? null, marker: values.marker ?? null, since: Date.now() - hours * 3600e3,
      });
      print({ engine: values.engine, ...found });
      break;
    }
    case 'observe': {
      if (!values.log || !values.counts) usage(USAGE);
      const limits = thresholds();
      const before = readCounts(values.counts);
      const observation = observationFor(engine(), values.log, fs.readFileSync(values.log, 'utf8'), before);
      const counts = mergeObservation(before, {
        engine: values.engine, log: path.resolve(values.log), observation, lowerBound: values['lower-bound'],
      });
      writeCounts(values.counts, counts);
      const report = assessSuccession(counts, limits);
      print(report);
      if (report.due) process.exitCode = 3;
      break;
    }
    case 'show': {
      if (!values.counts) usage(USAGE);
      const limits = thresholds();
      const report = assessSuccession(readCounts(values.counts), limits);
      print(report);
      if (report.due) process.exitCode = 3;
      break;
    }
    default:
      usage(USAGE);
  }
} catch (error) {
  process.stderr.write(`succession: ${error.message}\n`);
  process.exitCode = 1;
}
