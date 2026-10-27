#!/usr/bin/env node
// Resolve peer records/scratch without writing or repairing any location.
import { parseArgs } from 'node:util';
import { usage } from './lib/cli.mjs';
import { resolvePeerRecords } from './lib/peer-records.mjs';

const USAGE = 'node tools/peer-records.mjs --workspace <checkout-or-folder> --run <id> --task <id> [--storage local|external]';
const HELP = `${USAGE}

Without \`--storage\`: external records and scratch, plus a local candidate only when binding
inspection establishes current mechanical facts. Use bind-agent-workflow CHECK
(or current caller-supplied evidence for this checkout) before selecting local.
Then --storage local re-verifies those facts; it does not replace CHECK.
--storage external skips binding inspection, including unavailable dependencies.
Report such failures and pause only work needing the missing facts.

Pass the checkout's top directory; a subdirectory is resolved as a plain folder
without inheriting its enclosing checkout's binding.
Use the existing Run and a stable peer task id. Without a Run, retain a unique
storage-only id; it need not equal a Run created later. Do not create
orchestration objects merely to name directories.
Both ids follow the shared single-name rule. Give each peer its own subdirectory
of each returned root. Preserve assigned locations and use selected roots for
the whole task. Keep supporting evidence in records and disposable files in
scratch. This command creates nothing and grants no writing authority.
Absent/non-Git folders need Node only; present bindings use tools/bind.mjs and
its dependencies (including ajv). Missing or unreadable facts are not currency.
Failures exit 1 with JSON diagnostics; invalid command syntax exits 2.
`;
let values;
try {
  ({ values } = parseArgs({ options: {
    workspace: { type: 'string' }, run: { type: 'string' }, task: { type: 'string' },
    storage: { type: 'string' }, help: { type: 'boolean' },
  }, strict: true }));
} catch (error) { usage(`${error.message}\n${USAGE}`); }
if (values.help) { process.stdout.write(HELP); }
else {
  if (!values.workspace || values.run === undefined || values.task === undefined) usage(USAGE);
  try {
    process.stdout.write(`${JSON.stringify(resolvePeerRecords(values), null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ error: error.message, ...(error.binding ? { binding: error.binding } : {}), ...(error.inspection ? { inspection: error.inspection } : {}) }, null, 2)}\n`);
    process.exitCode = 1;
  }
}
