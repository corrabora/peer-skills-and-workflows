#!/usr/bin/env node
// Command interface for the successor skill. --help is the CLI contract.
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { currentSession, hook, hookConfig, initialize, lookup, readChain, register, report, update } from './lib/successor.mjs';
import { readSources } from './lib/successor-instructions.mjs';

const help = `Usage: node tools/successor.mjs <command> [options]
  init --engine claude|codex --workspace <dir> --task <title>
       [--storage auto|local|external | --run-root <existing Run records>]
       [--compactions <positive integer>] [--turns <positive integer>]
       [--session <current session id>] [--log <established root session log>]
  status --root <chain root>
  source-index --root <chain root>      metadata only; use read-sources for message text
  read-sources --root <chain root> [--generation <n>] [--entry-id <id> | --limitation-id <id>]
                                      read retained text with provenance, without JSON escaping
  sources --root <chain root> [--generation <n>] [--entry-id <id> | --limitation-id <id>]
                                      same evidence as JSON for structured processing
  capture --root <root> --engine <engine> [--session <id>]
       [--from-line <first task source line> --scope <boundary rationale>]
  reconcile-source --root <root> --engine <engine> [--session <id>]
       --generation <n> --limitation-id <indexed id> --resolution-file <text file>
  observe|disable|complete|prepare --root <root> --engine <engine> [--session <id>]
  policy --root <root> --engine <engine> [--session <id>] [--compactions <n>] [--turns <n>]
  yield|retire --root <root> --engine <engine> [--session <id>] --nonce <nonce>
       retire also requires --retired-title <verified RETIRED title>
  cancel-transfer|resume-cancelled --root <root> --engine <engine> [--session <id>]
       --nonce <nonce> --record-file <recovery evidence JSON>
  finish-transfer --root <root> --engine <successor engine> [--session <id>]
       --nonce <nonce> --record-file <recovery evidence JSON> --retired-title <verified RETIRED title>
  accept --root <root> --engine <engine> [--session <id>] [--log <log>] --nonce <nonce>
  register --root <root> --engine <engine> [--session <id>]
  find --engine <engine> [--session <id>]
  hook --engine <engine>                 JSON event on stdin; hook JSON on stdout
  hook-config --engine <engine>          prints config fragment; edits no settings
  --help

init observes existing session history (defaults 3 compactions OR 40 turns).
Repeated init preserves existing policy and counts. Use policy to change limits.
First capture in each session requires --from-line and --scope; later captures
extend the same task range. Source text is evidence, not verified operator authority.
prepare refreshes capture and freezes continuation.md plus instructions.json.
accept requires confirmation.md to name the verified instruction-source digest.
register repairs hook discovery for an existing owner/confirmed successor.
Records are retained until the operator removes them. No command launches an agent.
Exit 0: success/not due; 3: active succession due; 1: failure; 2: usage error.
Hook commands return 0 with event-specific JSON; any error is reported on stderr.
`;
const [command, ...args] = process.argv.slice(2);
if (command === '--help' || command === 'help') { process.stdout.write(help); process.exit(0); }
let v;
try {
  ({ values: v } = parseArgs({ args, strict: true, options: Object.fromEntries([
    'engine', 'workspace', 'task', 'storage', 'run-root', 'compactions', 'turns', 'session', 'log', 'root', 'nonce', 'retired-title', 'from-line', 'scope', 'generation', 'entry-id', 'limitation-id', 'resolution-file', 'record-file',
  ].map((key) => [key, { type: 'string' }])) }));
} catch (e) { process.stderr.write(`${e.message}\n${help}`); process.exit(2); }
const print = (value) => process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
// Keep all provenance and limitations visible while rendering the text blocks
// literally. The immutable JSON packet remains the source of byte identity.
const renderSourceText = (value) => {
  if (value.segments) {
    const { segments, ...metadata } = value;
    return `${JSON.stringify(metadata, null, 2)}\n${segments.map(renderSourceText).join('\n')}`;
  }
  if (value.entries) {
    const { entries, ...metadata } = value;
    return `${JSON.stringify(metadata, null, 2)}\n${entries.map(renderSourceText).join('\n')}`;
  }
  if (value.texts) {
    const { texts, ...metadata } = value;
    return `${JSON.stringify(metadata, null, 2)}\n${texts.map((text, i) =>
      `--- Retained text ${i + 1} (${Buffer.byteLength(text)} UTF-8 bytes) ---\n${text}\n--- End retained text ${i + 1} ---`).join('\n')}\n`;
  }
  return `${JSON.stringify(value, null, 2)}\n`;
};
const printSource = (value) => command === 'read-sources'
  ? process.stdout.write(`Instruction evidence; origin and authority require interpretation.\n${renderSourceText(value)}`)
  : print(value);
const number = (key) => {
  if (v[key] === undefined) return undefined;
  if (!/^[1-9][0-9]*$/.test(v[key])) throw new Error(`--${key} must be a positive integer`);
  return Number(v[key]);
};
const caller = () => {
  const session = v.session ?? (v.engine === 'codex' ? process.env.CODEX_THREAD_ID || process.env.CODEX_SESSION_ID : process.env.CLAUDE_CODE_SESSION_ID);
  if (!['claude', 'codex'].includes(v.engine) || !session) throw new Error('supply the current --engine and --session (or its engine environment identity)');
  return { engine: v.engine, session };
};
try {
  const script = fs.realpathSync(fileURLToPath(import.meta.url));
  if (command === 'hook-config') { print(hookConfig(v.engine, script)); process.exit(0); }
  if (command === 'hook') {
    print(hook(v.engine, JSON.parse(fs.readFileSync(0, 'utf8')), { skill: path.resolve(path.dirname(script), '../skills/successor/SKILL.md') }));
    process.exit(0);
  }
  if (command === 'find') { const c = caller(); const s = lookup(c.engine, c.session); print(s ? report(s) : null); process.exit(0); }
  let state;
  if (command === 'init') {
    if (!v.workspace || !v.task) throw new Error('init requires --workspace and --task');
    state = initialize({ caller: currentSession({ engine: v.engine, session: v.session, log: v.log }), workspace: v.workspace, task: v.task,
      storage: v.storage, runRoot: v['run-root'], compactions: number('compactions'), turns: number('turns') });
  } else {
    if (!v.root) throw new Error('supply --root from the existing chain');
    const root = fs.realpathSync(v.root);
    if (['sources', 'read-sources', 'source-index'].includes(command)) {
      const s = readChain(root); const { packet } = readSources(s);
      if (command === 'source-index') print({ ...s.instructionSource,
        reconciliations: (packet.reconciliations ?? []).map(({ text, ...r }) => ({ ...r, textBytes: Buffer.byteLength(text) })),
        segments: packet.segments.map(({ entries, ...segment }) => ({ ...segment,
        entries: entries.map(({ texts, ...entry }) => ({ ...entry, textBytes: texts.reduce((n, t) => n + Buffer.byteLength(t), 0) })) })) });
      else if (v['entry-id'] || v['limitation-id'] || v.generation) {
        const segment = packet.segments.find((g) => g.generation === number('generation'));
        if (!segment) throw new Error('source selection requires an existing --generation');
        if (v['entry-id'] && v['limitation-id']) throw new Error('select one entry or limitation at a time');
        const reconciliations = (packet.reconciliations ?? []).filter((r) => r.generation === segment.generation);
        const limitation = segment.limitations.find((l) => l.id === v['limitation-id']);
        const value = v['entry-id'] ? segment.entries.find((e) => e.id === v['entry-id']) : v['limitation-id']
          ? limitation && { limitation, reconciliations: reconciliations.filter((r) => r.limitationId === limitation.id) }
          : { ...segment, reconciliations };
        if (!value) throw new Error('source entry is not present in that generation');
        printSource(value);
      } else printSource(packet);
      process.exit(0);
    }
    if (command === 'status') state = readChain(root);
    else if (command === 'register') {
      state = readChain(root); const c = caller();
      if (![state.owner, state.transfer?.successor].some((x) => x?.engine === c.engine && x?.session === c.session)) throw new Error('only the owner or confirmed successor may register');
      register(state, c);
    } else state = update(root, command === 'accept' ? currentSession({ engine: v.engine, session: v.session, log: v.log }) : caller(), command,
      { compactions: number('compactions'), turns: number('turns'), nonce: v.nonce, retiredTitle: v['retired-title'], fromLine: number('from-line'), scope: v.scope,
        generation: number('generation'), limitationId: v['limitation-id'], resolutionFile: v['resolution-file'], recordFile: v['record-file'] });
  }
  const result = report(state); print(result);
  if (state.status === 'active' && result.countsReport.due) process.exitCode = 3;
} catch (e) { process.stderr.write(`successor: ${e.message}\n`); process.exitCode = 1; }
