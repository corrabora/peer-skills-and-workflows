// Engine adapters pass model, effort and verbosity through exactly, refuse
// what the engine does not document, and build the retained launch for each
// engine.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { sha256 } from '../lib/common.mjs';
import { ENGINE_DEFAULT_VERBOSITY, ENGINES, codexSessionInstruction, engineFor, launchFor, sessionInstructionFor, validateSettings, verbosityFor } from '../lib/engines.mjs';
import { temporaryDirectory } from '../test-support/fixtures.mjs';

test('model and effort are routed to the right engine and refused when unsupported', () => {
  assert.deepEqual(validateSettings('claude', 'claude-opus-5-5', 'high'), { engine: 'claude', model: 'claude-opus-5-5', effort: 'high', verbosity: null });
  assert.deepEqual(validateSettings('claude', 'claude-fable-5-1', 'xhigh'), { engine: 'claude', model: 'claude-fable-5-1', effort: 'xhigh', verbosity: null });
  assert.deepEqual(validateSettings('codex', 'gpt-6.1-sol', 'high'), { engine: 'codex', model: 'gpt-6.1-sol', effort: 'high', verbosity: null });
  assert.deepEqual(validateSettings('codex', 'gpt-6-astra', 'xhigh'), { engine: 'codex', model: 'gpt-6-astra', effort: 'xhigh', verbosity: null });
  // Effort levels differ per engine; neither substitutes.
  assert.throws(() => validateSettings('codex', 'gpt-6.1-sol', 'max'), /effort 'max' is not supported for codex; supported: minimal, low, medium, high, xhigh/);
  assert.throws(() => validateSettings('claude', 'claude-opus-5-5', 'minimal'), /effort 'minimal' is not supported for claude; supported: low, medium, high, xhigh, max/);
  assert.throws(() => validateSettings('claude', 'claude-opus-5-5', 'High'), /effort 'High' is not supported/);
  // Aliases that drift to "latest" are refused; so are empty and malformed ids.
  assert.throws(() => validateSettings('claude', 'opus', 'high'), /model 'opus' is not a full model identifier/);
  assert.throws(() => validateSettings('codex', '', 'high'), /not a full model identifier/);
  assert.throws(() => validateSettings('codex', 'gpt 6', 'high'), /not a full model identifier/);
  assert.throws(() => validateSettings('gemini', 'g-1', 'high'), /unknown engine 'gemini'/);
});

test('each engine launch carries the requested settings and the retained permission profile', () => {
  const settings = { model: 'claude-opus-5-5', effort: 'xhigh', workspace: '/run/attempt/workspace', sourceRoot: '/run/source', attemptDir: '/run/attempt' };
  const claude = launchFor('claude', settings);
  assert.equal(claude.argv[0], 'claude');
  assert.equal(claude.cwd, '/run/attempt/workspace');
  assert.ok(claude.argv.includes('-p'));
  assert.equal(claude.argv[claude.argv.indexOf('--model') + 1], 'claude-opus-5-5');
  assert.equal(claude.argv[claude.argv.indexOf('--effort') + 1], 'xhigh');
  assert.equal(claude.argv[claude.argv.indexOf('--permission-mode') + 1], 'acceptEdits');
  assert.equal(claude.argv[claude.argv.indexOf('--permission-prompts') + 1], 'none');
  assert.equal(claude.argv[claude.argv.indexOf('--add-dir') + 1], '/run/source');
  assert.ok(claude.argv.includes('--no-session-persistence') && claude.argv.includes('--strict-mcp-config'));
  const disallowed = claude.argv.slice(claude.argv.indexOf('--disallowedTools') + 1, claude.argv.indexOf('--strict-mcp-config'));
  assert.deepEqual(disallowed, ['Agent', 'Bash(codex:*)', 'Bash(claude:*)']);
  assert.ok(!claude.argv.includes('--debug-file'), 'no private debug log in retained attempts');

  // No source tree exists at /run/source, so no session instruction is applied here; the tests below cover a present one.
  const codex = launchFor('codex', { ...settings, model: 'gpt-6.1-sol', effort: 'high' });
  assert.deepEqual(codex.argv.slice(0, 6), ['codex', 'exec', '-m', 'gpt-6.1-sol', '-c', 'model_reasoning_effort="high"']);
  assert.ok(codex.argv.includes('--ignore-user-config') && codex.argv.includes('--ephemeral') && codex.argv.includes('--skip-git-repo-check'));
  assert.equal(codex.argv[codex.argv.indexOf('--sandbox') + 1], 'workspace-write');
  assert.equal(codex.argv[codex.argv.indexOf('-C') + 1], '/run/attempt/workspace');
  assert.equal(codex.argv[codex.argv.indexOf('-o') + 1], '/run/attempt/final.txt');
  assert.equal(codex.argv.at(-1), '-');
});

test('the executable seam replaces only the engine executable', () => {
  const settings = { model: 'gpt-6.1-sol', effort: 'high', workspace: '/w', sourceRoot: '/s', attemptDir: '/a' };
  const codex = launchFor('codex', settings, { codex: ['/usr/bin/node', '/fake.mjs'] });
  assert.deepEqual(codex.argv.slice(0, 4), ['/usr/bin/node', '/fake.mjs', 'exec', '-m']);
  const claude = launchFor('claude', { ...settings, model: 'claude-opus-5-5' }, { claude: '/opt/claude-2.1.295' });
  assert.deepEqual(claude.argv.slice(0, 2), ['/opt/claude-2.1.295', '-p']);
  // A seam for the other engine leaves this one alone.
  assert.equal(launchFor('claude', { ...settings, model: 'claude-opus-5-5' }, { codex: '/x' }).argv[0], 'claude');
});

test('traces are read back in each engine shape', () => {
  const claude = engineFor('claude');
  const claudeTrace = [
    JSON.stringify({ type: 'system', subtype: 'init', model: 'claude-opus-5-5', permissionMode: 'acceptEdits' }),
    JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'Reading.' }, { type: 'tool_use', id: 't1', name: 'Read', input: { file_path: '/w/.claude/skills/clarify-artifact/SKILL.md' } }] } }),
    JSON.stringify({ type: 'system', subtype: 'permission_denied', tool_name: 'Bash' }),
    'not json',
    JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: 'Which reader?' }),
  ].join('\n');
  const claudeEvents = claude.events(claudeTrace);
  assert.deepEqual(claudeEvents.map((event) => event.kind), ['init', 'message', 'tool', 'denial', 'result']);
  assert.equal(claude.finalReply('/nowhere', claudeEvents), 'Which reader?');
  assert.deepEqual(claude.effectiveSettings(claudeEvents), { model: 'claude-opus-5-5', modelAttestedBy: 'init event', effort: null, effortAttestedBy: null, verbosity: null, verbosityAttestedBy: null });
  const errored = claude.events(`${JSON.stringify({ type: 'result', subtype: 'error_during_execution', is_error: true, result: 'boom' })}\n`);
  assert.equal(claude.finalReply('/nowhere', errored), null);

  const codex = ENGINES.codex;
  const codexTrace = [
    JSON.stringify({ type: 'thread.started', thread_id: 'x' }),
    JSON.stringify({ type: 'item.started', item: { id: 'item_1', type: 'command_execution', command: 'cat .agents/skills/clarify-artifact/SKILL.md', status: 'in_progress' } }),
    JSON.stringify({ type: 'item.completed', item: { id: 'item_1', type: 'command_execution', command: 'cat .agents/skills/clarify-artifact/SKILL.md', exit_code: 0, status: 'completed' } }),
    JSON.stringify({ type: 'item.completed', item: { id: 'item_2', type: 'file_change', changes: [{ path: '/w/docs/a.md', kind: 'add' }] } }),
    JSON.stringify({ type: 'item.completed', item: { id: 'item_3', type: 'agent_message', text: 'Done.' } }),
    JSON.stringify({ type: 'turn.completed', usage: {} }),
  ].join('\n');
  const codexEvents = codex.events(codexTrace);
  assert.deepEqual(codexEvents.map((event) => event.kind), ['init', 'turn', 'command', 'file_change', 'message']);
  assert.equal(codexEvents.filter((event) => event.kind === 'command').length, 1, 'started and completed items are one command');
  assert.equal(codex.finalReply('/nowhere', codexEvents), 'Done.');
  assert.equal(codex.effectiveSettings(codexEvents).model, null, 'Codex does not attest its model in the stream');
});

// The documented Codex session instruction: resolved under the source tree
// under test, applied to Codex per invocation as `-c developer_instructions=`
// followed by the JSON encoding of the trimmed text, recorded with both
// hashes, and never given to Claude. The harness writes its own file in a
// temporary tree; nothing here reads the package's copy.

const CANONICAL = 'When an unresolved reader, purpose, scope or governing-source choice requires one clarification question, that question is the successful result of this turn, not a skill-caused pause or block. Do not cite a skill solely because that question is the result. Keep existing reporting for actual missing dependencies, unavailable tools and permission or approval blocks.';

function sourceTree(label, instruction) {
  const root = temporaryDirectory(`engines ${label}`);
  fs.mkdirSync(path.join(root, 'docs', 'guidance'), { recursive: true });
  if (instruction !== undefined) fs.writeFileSync(path.join(root, 'docs', 'guidance', 'codex-session-instructions.txt'), instruction);
  return root;
}

test('a present session instruction becomes two Codex argv entries after exec, with the trimmed text JSON-encoded and both hashes recorded', () => {
  const root = sourceTree('present', `${CANONICAL}\n`);
  try {
    const record = codexSessionInstruction(root);
    assert.equal(record.file, path.join(root, 'docs', 'guidance', 'codex-session-instructions.txt'));
    assert.equal(record.present, true);
    assert.equal(record.applied, true);
    assert.equal(record.reason, null);
    assert.equal(record.effectiveText, CANONICAL, 'the final newline is trimmed');
    assert.equal(record.rawSha256, sha256(Buffer.from(`${CANONICAL}\n`)));
    assert.equal(record.effectiveSha256, sha256(Buffer.from(CANONICAL)));
    // The diagnostic that approved this text (cycle 016, sol-citation-arm-01) recorded this hash of the same trimmed text.
    assert.equal(record.effectiveSha256, '3271daddfdd9069140ae83c14bf7de1e8637c85c1f26ca511f57e5c0c5c9180b');
    assert.deepEqual(record.argv, ['-c', `developer_instructions=${JSON.stringify(CANONICAL)}`]);
    assert.equal(record.argv[1], `developer_instructions="${CANONICAL}"`, 'plain text is quoted, nothing else');

    const settings = { model: 'gpt-6.1-sol', effort: 'high', workspace: '/w', sourceRoot: root, attemptDir: '/a' };
    const launch = launchFor('codex', settings);
    assert.deepEqual(launch.argv.slice(0, 6), ['codex', 'exec', '-c', record.argv[1], '-m', 'gpt-6.1-sol'], 'the override follows exec and precedes the model, as the retained diagnostic placed it');
    assert.equal(launch.argv.filter((arg) => arg.startsWith('developer_instructions=')).length, 1);
    assert.deepEqual(launch.sessionInstruction, record, 'the launch carries the record it applied');
    // The same record, given explicitly, is used as given and not read again.
    fs.rmSync(record.file);
    assert.deepEqual(launchFor('codex', { ...settings, sessionInstruction: record }).argv.slice(2, 4), record.argv);
    // Through the executable seam the entries survive; only argv[0] is replaced.
    assert.deepEqual(launchFor('codex', { ...settings, sessionInstruction: record }, { codex: ['/usr/bin/node', '/fake.mjs'] }).argv.slice(0, 5), ['/usr/bin/node', '/fake.mjs', 'exec', '-c', record.argv[1]]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('an absent session instruction adds nothing and is recorded as absent, so older source trees run in their own environment', () => {
  const root = sourceTree('absent');
  try {
    const record = codexSessionInstruction(root);
    assert.deepEqual(record, { file: path.join(root, 'docs', 'guidance', 'codex-session-instructions.txt'), resolvedFrom: 'materialized source', present: false, rawSha256: null, effectiveSha256: null, effectiveText: null, applied: false, reason: 'absent', argv: [] });
    const launch = launchFor('codex', { model: 'gpt-6.1-sol', effort: 'high', workspace: '/w', sourceRoot: root, attemptDir: '/a' });
    assert.deepEqual(launch.argv.slice(0, 6), ['codex', 'exec', '-m', 'gpt-6.1-sol', '-c', 'model_reasoning_effort="high"']);
    assert.equal(launch.argv.some((arg) => arg.startsWith('developer_instructions=')), false);
    assert.equal(launch.sessionInstruction.reason, 'absent');
    // A missing docs/guidance directory, or a missing source root, is the same absence.
    assert.equal(codexSessionInstruction(path.join(root, 'nowhere')).reason, 'absent');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('an empty or unreadable session instruction stops before launch, naming the path and the reason', () => {
  const empty = sourceTree('empty', ' \n\t\n');
  const unreadable = sourceTree('unreadable');
  fs.mkdirSync(path.join(unreadable, 'docs', 'guidance', 'codex-session-instructions.txt'));
  const invalid = sourceTree('invalid-utf8', Buffer.from([0x57, 0x68, 0xff, 0xfe, 0x0a]));
  try {
    const emptyFile = path.join(empty, 'docs', 'guidance', 'codex-session-instructions.txt');
    assert.throws(() => codexSessionInstruction(empty), (error) => error.message.includes(emptyFile) && /present but empty/.test(error.message));
    assert.throws(() => launchFor('codex', { model: 'gpt-6.1-sol', effort: 'high', workspace: '/w', sourceRoot: empty, attemptDir: '/a' }), /present but empty/);
    const directory = path.join(unreadable, 'docs', 'guidance', 'codex-session-instructions.txt');
    assert.throws(() => codexSessionInstruction(unreadable), (error) => error.message.includes(`cannot read the Codex session instruction at ${directory}`) && /EISDIR/.test(error.message));
    assert.throws(() => codexSessionInstruction(invalid), /codex-session-instructions\.txt is not valid UTF-8/);
    // A read failure other than ENOENT from the pre-materialization seam stops the same way.
    assert.throws(() => codexSessionInstruction(empty, { read: () => { throw Object.assign(new Error('permission denied'), { code: 'EACCES' }); } }), /cannot read the Codex session instruction at .*codex-session-instructions\.txt: EACCES: permission denied/);
  } finally {
    for (const root of [empty, unreadable, invalid]) fs.rmSync(root, { recursive: true, force: true });
  }
});

test('quotes, backslashes, multiple lines and a trailing newline round-trip through the JSON encoding unchanged', () => {
  const text = 'Say "no" to C:\\path\\x; keep the\ttab.\nSecond line with a 🙂 and ünïcödé.';
  const root = sourceTree('round-trip', `\n\n${text}\n\n`);
  try {
    const record = codexSessionInstruction(root);
    assert.equal(record.effectiveText, text, 'only exterior whitespace is trimmed');
    assert.equal(record.argv[0], '-c');
    assert.ok(record.argv[1].startsWith('developer_instructions="'));
    assert.equal(JSON.parse(record.argv[1].slice('developer_instructions='.length)), text, 'decoding the argument gives back the exact text');
    assert.equal(record.argv[1], `developer_instructions=${JSON.stringify(text)}`);
    assert.equal(record.rawSha256, sha256(Buffer.from(`\n\n${text}\n\n`)));
    assert.equal(record.effectiveSha256, sha256(Buffer.from(text)));
    // The pre-materialization seam gets the materialized path and the relative path, and its note is recorded.
    const seen = [];
    const fromSeam = codexSessionInstruction('/planned/source', { read: (file, relative) => { seen.push([file, relative]); return Buffer.from(`${text}\n`); }, resolvedFrom: 'source tree abc, as it will be materialized' });
    assert.deepEqual(seen, [[path.join('/planned/source', 'docs', 'guidance', 'codex-session-instructions.txt'), 'docs/guidance/codex-session-instructions.txt']]);
    assert.equal(fromSeam.resolvedFrom, 'source tree abc, as it will be materialized');
    assert.equal(fromSeam.effectiveSha256, record.effectiveSha256);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('Claude receives no session instruction whatever the source tree holds, and the record says so', () => {
  const root = sourceTree('claude', `${CANONICAL}\n`);
  try {
    const launch = launchFor('claude', { model: 'claude-opus-5-5', effort: 'high', workspace: '/w', sourceRoot: root, attemptDir: '/a' });
    assert.equal(launch.argv.some((arg) => arg.includes('developer_instructions')), false);
    assert.equal(launch.argv.includes('-c'), false);
    const record = sessionInstructionFor('claude', root);
    fs.rmSync(path.join(root, 'docs', 'guidance', 'codex-session-instructions.txt'));
    assert.deepEqual(launch.argv, launchFor('claude', { model: 'claude-opus-5-5', effort: 'high', workspace: '/w', sourceRoot: root, attemptDir: '/a' }).argv, 'the Claude argv is identical with and without the file');
    assert.equal(record.present, true);
    assert.equal(record.applied, false);
    assert.equal(record.reason, 'claude receives no session instruction');
    assert.deepEqual(record.argv, []);
    assert.equal(record.effectiveSha256, sha256(Buffer.from(CANONICAL)), 'what the tree holds is still recorded');
    assert.equal(sessionInstructionFor('codex', root, { read: () => Buffer.from(CANONICAL) }).applied, true);
    assert.throws(() => sessionInstructionFor('gemini', root), /unknown engine 'gemini'/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// Verbosity: Claude Code's output style, passed as `--settings` JSON beside
// the setting sources; Codex's `model_verbosity` level, passed as a `-c`
// override beside the effort override. Omitted means the engine's own
// default and today's argv byte for byte. Values are validated per engine
// and the record names what was requested and the exact entries.

const CLAUDE_SETTINGS = { model: 'claude-opus-5-5', effort: 'high', workspace: '/run/attempt/workspace', sourceRoot: '/run/source', attemptDir: '/run/attempt' };
const CODEX_SETTINGS = { ...CLAUDE_SETTINGS, model: 'gpt-6.1-sol' };
// The launches before the verbosity dimension existed, as retained runs recorded them (no session instruction at /run/source).
const CLAUDE_ARGV_BEFORE = [
  'claude', '-p', '--model', 'claude-opus-5-5', '--effort', 'high', '--output-format', 'stream-json', '--verbose', '--no-session-persistence', '--setting-sources', 'project,local',
  '--permission-mode', 'acceptEdits', '--permission-prompts', 'none', '--add-dir', '/run/source',
  '--allowedTools', 'Read', 'Glob', 'Grep', 'Skill', 'Edit', 'Write',
  'Bash(cat:*)', 'Bash(ls:*)', 'Bash(pwd:*)', 'Bash(readlink:*)', 'Bash(realpath:*)', 'Bash(sed:*)', 'Bash(mkdir:*)', 'Bash(node:*)',
  'Bash(git status:*)', 'Bash(git show:*)', 'Bash(git diff:*)', 'Bash(git rev-parse:*)', 'Bash(git ls-tree:*)',
  '--disallowedTools', 'Agent', 'Bash(codex:*)', 'Bash(claude:*)', '--strict-mcp-config',
];
const CODEX_ARGV_BEFORE = [
  'codex', 'exec', '-m', 'gpt-6.1-sol', '-c', 'model_reasoning_effort="high"', '--ignore-user-config', '--skip-git-repo-check', '--ephemeral',
  '--sandbox', 'workspace-write', '--json', '-C', '/run/attempt/workspace', '-o', path.join('/run/attempt', 'final.txt'), '-',
];

test('verbosity is validated per engine: Codex one of its documented levels, Claude any non-empty style name, omitted the engine default', () => {
  assert.deepEqual(ENGINES.claude.verbosities, ['Default', 'Concise', 'Explanatory', 'Learning', 'Proactive'], 'the documented built-in output styles, case-sensitive');
  assert.deepEqual(ENGINES.codex.verbosities, ['low', 'medium', 'high']);
  assert.equal(ENGINE_DEFAULT_VERBOSITY, 'engine-default');
  for (const level of ['low', 'medium', 'high']) assert.deepEqual(validateSettings('codex', 'gpt-6.1-sol', 'high', level), { engine: 'codex', model: 'gpt-6.1-sol', effort: 'high', verbosity: level });
  for (const name of ['Concise', 'Default', 'Proactive', 'my-house-style']) assert.equal(validateSettings('claude', 'claude-opus-5-5', 'high', name).verbosity, name, 'a custom style is named freely');
  assert.equal(validateSettings('claude', 'claude-opus-5-5', 'high', undefined).verbosity, null);
  assert.equal(validateSettings('codex', 'gpt-6.1-sol', 'high', null).verbosity, null);
  // Outside the documented set, Codex is refused with the set named; nothing substitutes.
  assert.throws(() => validateSettings('codex', 'gpt-6.1-sol', 'high', 'verbose'), /verbosity 'verbose' is not supported for codex; supported: low, medium, high \(Codex configuration key model_verbosity\)/);
  assert.throws(() => validateSettings('codex', 'gpt-6.1-sol', 'high', 'Low'), /verbosity 'Low' is not supported for codex; supported: low, medium, high/);
  assert.throws(() => validateSettings('codex', 'gpt-6.1-sol', 'high', 'Concise'), /verbosity 'Concise' is not supported for codex/);
  // Empty, whitespace-only or whitespace-wrapped names are refused on both engines.
  for (const engine of ['claude', 'codex']) {
    const model = engine === 'claude' ? 'claude-opus-5-5' : 'gpt-6.1-sol';
    assert.throws(() => validateSettings(engine, model, 'high', ''), /verbosity '' is not a usable value/);
    assert.throws(() => validateSettings(engine, model, 'high', '  '), /not a usable value/);
    assert.throws(() => validateSettings(engine, model, 'high', ' low'), /not a usable value/);
    assert.throws(() => validateSettings(engine, model, 'high', 42), /not a usable value/);
  }
  // The record builder validates the same way.
  assert.deepEqual(verbosityFor('claude'), { requested: 'engine-default', applied: false, argv: [], mechanism: ENGINES.claude.verbosityMechanism, source: ENGINES.claude.verbositiesSource });
  assert.deepEqual(verbosityFor('codex', null), { requested: 'engine-default', applied: false, argv: [], mechanism: ENGINES.codex.verbosityMechanism, source: ENGINES.codex.verbositiesSource });
  assert.deepEqual(verbosityFor('codex', 'medium'), { requested: 'medium', applied: true, argv: ['-c', 'model_verbosity="medium"'], mechanism: ENGINES.codex.verbosityMechanism, source: ENGINES.codex.verbositiesSource });
  assert.throws(() => verbosityFor('codex', 'verbose'), /supported: low, medium, high/);
  assert.throws(() => verbosityFor('claude', ''), /not a usable value/);
  assert.throws(() => verbosityFor('gemini', 'low'), /unknown engine 'gemini'/);
});

test('each engine maps verbosity to its own argument beside the related flags, and omitted leaves today\'s argv byte for byte', () => {
  // Omitted, or null: no argument, the launch before the dimension existed.
  assert.deepEqual(launchFor('claude', CLAUDE_SETTINGS).argv, CLAUDE_ARGV_BEFORE);
  assert.deepEqual(launchFor('claude', { ...CLAUDE_SETTINGS, verbosity: null }).argv, CLAUDE_ARGV_BEFORE);
  assert.deepEqual(launchFor('codex', CODEX_SETTINGS).argv, CODEX_ARGV_BEFORE);
  assert.deepEqual(launchFor('codex', { ...CODEX_SETTINGS, verbosity: null }).argv, CODEX_ARGV_BEFORE);
  assert.deepEqual(launchFor('claude', CLAUDE_SETTINGS).verbosity, verbosityFor('claude'), 'the launch carries the record');

  // Claude: `--settings` with only the output style, directly after the setting sources, which stay as they were.
  const claude = launchFor('claude', { ...CLAUDE_SETTINGS, verbosity: 'Concise' });
  const sources = claude.argv.indexOf('--setting-sources');
  assert.deepEqual(claude.argv.slice(sources, sources + 4), ['--setting-sources', 'project,local', '--settings', '{"outputStyle":"Concise"}']);
  assert.deepEqual(JSON.parse(claude.argv[sources + 3]), { outputStyle: 'Concise' }, 'the settings JSON sets the output style and nothing else, so project and local settings keep every other key');
  assert.deepEqual([...claude.argv.slice(0, sources + 2), ...claude.argv.slice(sources + 4)], CLAUDE_ARGV_BEFORE, 'every other entry is unchanged and in place');
  assert.equal(claude.argv.filter((arg) => arg === '--settings').length, 1);
  assert.deepEqual(claude.verbosity, { requested: 'Concise', applied: true, argv: ['--settings', '{"outputStyle":"Concise"}'], mechanism: ENGINES.claude.verbosityMechanism, source: ENGINES.claude.verbositiesSource });
  // A custom style name with characters JSON must escape round-trips.
  const custom = launchFor('claude', { ...CLAUDE_SETTINGS, verbosity: 'My "House" Style\\v2' });
  assert.deepEqual(JSON.parse(custom.argv[custom.argv.indexOf('--settings') + 1]), { outputStyle: 'My "House" Style\\v2' });
  // Case is passed through as given; the engine's documentation makes it significant.
  assert.equal(launchFor('claude', { ...CLAUDE_SETTINGS, verbosity: 'concise' }).argv[sources + 3], '{"outputStyle":"concise"}');

  // Codex: the `-c model_verbosity` override directly after the effort override.
  const codex = launchFor('codex', { ...CODEX_SETTINGS, verbosity: 'low' });
  const effort = codex.argv.indexOf('model_reasoning_effort="high"');
  assert.deepEqual(codex.argv.slice(effort - 1, effort + 3), ['-c', 'model_reasoning_effort="high"', '-c', 'model_verbosity="low"']);
  assert.deepEqual([...codex.argv.slice(0, effort + 1), ...codex.argv.slice(effort + 3)], CODEX_ARGV_BEFORE, 'every other entry is unchanged and in place');
  assert.deepEqual(codex.verbosity, { requested: 'low', applied: true, argv: ['-c', 'model_verbosity="low"'], mechanism: ENGINES.codex.verbosityMechanism, source: ENGINES.codex.verbositiesSource });
  assert.throws(() => launchFor('codex', { ...CODEX_SETTINGS, verbosity: 'verbose' }), /supported: low, medium, high/);
  // With a documented session instruction the order is: exec, the instruction, the model, the effort, the verbosity.
  const root = sourceTree('verbosity', `${CANONICAL}\n`);
  try {
    const withInstruction = launchFor('codex', { ...CODEX_SETTINGS, sourceRoot: root, verbosity: 'high' });
    assert.deepEqual(withInstruction.argv.slice(0, 10), ['codex', 'exec', '-c', `developer_instructions=${JSON.stringify(CANONICAL)}`, '-m', 'gpt-6.1-sol', '-c', 'model_reasoning_effort="high"', '-c', 'model_verbosity="high"']);
    const claudeWithInstruction = launchFor('claude', { ...CLAUDE_SETTINGS, sourceRoot: root, verbosity: 'Learning' });
    assert.equal(claudeWithInstruction.argv.includes('-c'), false);
    assert.equal(claudeWithInstruction.argv[claudeWithInstruction.argv.indexOf('--settings') + 1], '{"outputStyle":"Learning"}');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
  // A record already built is used as given; the executable seam keeps the entries.
  const record = verbosityFor('codex', 'medium');
  assert.deepEqual(launchFor('codex', { ...CODEX_SETTINGS, verbosity: record }, { codex: ['/usr/bin/node', '/fake.mjs'] }).argv.slice(0, 9), ['/usr/bin/node', '/fake.mjs', 'exec', '-m', 'gpt-6.1-sol', '-c', 'model_reasoning_effort="high"', '-c', 'model_verbosity="medium"']);
  assert.deepEqual(launchFor('codex', { ...CODEX_SETTINGS, verbosity: record }).verbosity, record);
});

test('the Claude init event attests the output style when it reports one; without it, and on Codex, verbosity stays unattested', () => {
  const claude = engineFor('claude');
  const reported = claude.events(`${JSON.stringify({ type: 'system', subtype: 'init', model: 'claude-opus-5-5', output_style: 'Concise', permissionMode: 'acceptEdits' })}\n`);
  assert.equal(reported[0].outputStyle, 'Concise');
  assert.deepEqual(claude.effectiveSettings(reported), { model: 'claude-opus-5-5', modelAttestedBy: 'init event', effort: null, effortAttestedBy: null, verbosity: 'Concise', verbosityAttestedBy: 'init event' });
  // The engine reports the style it resolved, whatever was asked: a name that matched nothing shows up as the default, and is recorded as such.
  const fellBack = claude.events(`${JSON.stringify({ type: 'system', subtype: 'init', model: 'claude-opus-5-5', output_style: 'default' })}\n`);
  assert.deepEqual([claude.effectiveSettings(fellBack).verbosity, claude.effectiveSettings(fellBack).verbosityAttestedBy], ['default', 'init event']);
  const silent = claude.events(`${JSON.stringify({ type: 'system', subtype: 'init', model: 'claude-opus-5-5' })}\n`);
  assert.deepEqual([claude.effectiveSettings(silent).verbosity, claude.effectiveSettings(silent).verbosityAttestedBy], [null, null]);
  const malformed = claude.events(`${JSON.stringify({ type: 'system', subtype: 'init', model: 'claude-opus-5-5', output_style: 7 })}\n`);
  assert.equal(claude.effectiveSettings(malformed).verbosityAttestedBy, null);
  const codex = engineFor('codex');
  const codexEvents = codex.events(`${JSON.stringify({ type: 'thread.started', thread_id: 'x' })}\n${JSON.stringify({ type: 'turn.completed', usage: {} })}\n`);
  assert.deepEqual(codex.effectiveSettings(codexEvents), { model: null, modelAttestedBy: null, effort: null, effortAttestedBy: null, verbosity: null, verbosityAttestedBy: null }, 'Codex events carry no setting; the launch record is the only evidence');
});
