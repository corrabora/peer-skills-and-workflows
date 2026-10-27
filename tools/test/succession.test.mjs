// Coordinator succession counts from synthetic session logs in each engine's
// record shape, through the library and the real entry point, against a
// temporary home and counts file.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  assessSuccession, emptyCounts, environmentSession, locateLog, mergeObservation, observationFor, readCounts, readSessionLog, sessionIdFromPath, writeCounts,
} from '../lib/succession.mjs';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const tool = path.join(packageRoot, 'tools', 'succession.mjs');
const scratch = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'aw succession-')));
after(() => fs.rmSync(scratch, { recursive: true, force: true }));

const lines = (records) => `${records.map((record) => JSON.stringify(record)).join('\n')}\n`;

test('a Claude compaction boundary is not evidence of the session beginning', () => {
  const records = [
    { type: 'system', subtype: 'compact_boundary', sessionId: 'coordinator', uuid: 'compact', parentUuid: null, logicalParentUuid: 'earlier' },
    { type: 'user', sessionId: 'coordinator', uuid: 'summary', parentUuid: 'compact', isCompactSummary: true, message: { content: 'Earlier work.' } },
    { type: 'user', sessionId: 'coordinator', uuid: 'next', parentUuid: 'summary', message: { content: 'Continue.' } },
  ];
  const side = { type: 'user', sessionId: 'coordinator', uuid: 'side', parentUuid: null, isSidechain: true, message: { content: 'Side task.' } };
  for (const prefix of [[], [side]]) {
    const observation = readSessionLog('claude', lines([...prefix, ...records]));
    assert.equal(observation.startObserved, false);
    const counts = mergeObservation(emptyCounts(), { engine: 'claude', log: 'synthetic.jsonl', at: '2026-10-24T00:00:00Z', observation });
    assert.equal(counts.sessions[0].lowerBound, true);
    assert.equal(counts.sessions[0].turns.count, 1);
    assert.equal(counts.sessions[0].compactions.count, 1);
  }
  assert.equal(readSessionLog('claude', lines([
    { ...side, parentUuid: 'missing-side-parent' },
    { type: 'user', sessionId: 'coordinator', uuid: 'root', parentUuid: null, message: { content: 'Root task.' } },
  ])).startObserved, true);
});

function recordedCounts() {
  return mergeObservation(emptyCounts(), {
    engine: 'codex', log: 'synthetic.jsonl', at: '2026-10-19T00:00:00Z',
    observation: readSessionLog('codex', lines(codexLog('coordinator', [{ kind: 'turn', id: 'turn-1' }]))),
  });
}

function malformedCounts() {
  const cases = [];
  const add = (label, change, reason) => {
    const data = recordedCounts();
    change(data);
    cases.push({ label, text: JSON.stringify(data, null, 1), reason });
  };
  cases.push({ label: 'invalid JSON', text: '{bad json', reason: /invalid JSON/ });
  for (const data of [null, [], {}, { ...emptyCounts(), sessions: {} }, { ...emptyCounts(), version: 2 }]) {
    cases.push({ label: `bad envelope ${JSON.stringify(data)}`, text: JSON.stringify(data), reason: /not a version 1 counts file/ });
  }
  for (const key of ['format', 'version', 'sessions']) add(`missing ${key}`, (data) => { delete data[key]; }, /not a version 1 counts file/);
  add('missing current', (data) => { delete data.current; }, /at current:/);
  for (const value of [null, '', ' ', 4, {}, 'missing-session']) {
    add(`incoherent current ${JSON.stringify(value)}`, (data) => { data.current = value; }, /at current:/);
  }
  add('empty sessions with current', (data) => { data.sessions = []; }, /at current:/);
  add('empty sessions missing current', (data) => { data.sessions = []; delete data.current; }, /at current:/);
  for (const value of [null, [], 'session']) add(`bad session object ${JSON.stringify(value)}`, (data) => { data.sessions[0] = value; }, /sessions\[0\]:/);
  for (const key of ['session', 'engine', 'log', 'firstObservedAt', 'lastObservedAt', 'lowerBound']) {
    add(`missing ${key}`, (data) => { delete data.sessions[0][key]; }, new RegExp(`sessions\\[0\\]\\.${key}:`));
  }
  for (const [key, value] of [
    ['session', ' '], ['session', 7], ['session', {}], ['engine', 'other'], ['engine', 1],
    ['log', ''], ['log', []], ['firstObservedAt', null], ['firstObservedAt', 1],
    ['lastObservedAt', ''], ['lastObservedAt', {}], ['lowerBound', 'false'], ['lowerBound', 0],
  ]) {
    add(`bad ${key} ${JSON.stringify(value)}`, (data) => { data.sessions[0][key] = value; }, new RegExp(`sessions\\[0\\]\\.${key}:`));
  }
  add('duplicate sessions', (data) => { data.sessions.push(structuredClone(data.sessions[0])); }, /duplicates a session identity/);
  add('duplicate session with another engine', (data) => { data.sessions.push({ ...structuredClone(data.sessions[0]), engine: 'claude' }); }, /duplicates a session identity/);
  add('malformed historical session', (data) => { data.sessions.unshift({ ...structuredClone(data.sessions[0]), session: 'predecessor', lowerBound: 'unknown' }); }, /sessions\[0\]\.lowerBound:/);
  for (const key of ['turns', 'compactions']) {
    const reason = new RegExp(`sessions\\[0\\]\\.${key}`);
    add(`missing ${key}`, (data) => { delete data.sessions[0][key]; }, reason);
    for (const value of [null, [], 0]) add(`bad ${key} object ${JSON.stringify(value)}`, (data) => { data.sessions[0][key] = value; }, reason);
    for (const field of ['count', 'ids']) add(`missing ${key}.${field}`, (data) => { delete data.sessions[0][key][field]; }, reason);
    for (const value of ['unknown', '0', null, true, -1, 0.5, Number.MAX_SAFE_INTEGER + 1, {}, []]) {
      add(`bad ${key}.count ${JSON.stringify(value)}`, (data) => { data.sessions[0][key].count = value; }, /safe nonnegative integer/);
    }
    for (const value of [null, 'turn-1', {}, [null], [1], [{}], [''], [' '], ['same', 'same']]) {
      add(`bad ${key}.ids ${JSON.stringify(value)}`, (data) => { data.sessions[0][key].ids = value; }, reason);
    }
    add(`${key} count exceeds ids, including lower bounds`, (data) => {
      data.sessions[0].lowerBound = true;
      data.sessions[0][key] = { count: 2, ids: ['one'] };
    }, /count must equal/);
    add(`${key} count below ids`, (data) => { data.sessions[0][key] = { count: 0, ids: ['one'] }; }, /count must equal/);
  }
  cases.push({ label: 'nonfinite JSON count', text: JSON.stringify(recordedCounts()).replace('"count":1', '"count":1e400'), reason: /safe nonnegative integer/ });
  return cases;
}

test('the counts decoder refuses malformed v1 structure, identities, fields and count/event contradictions without changing bytes', () => {
  const file = path.join(scratch, 'invalid-decoder-counts.json');
  for (const { label, text, reason } of malformedCounts()) {
    fs.writeFileSync(file, text);
    assert.throws(() => readCounts(file), (error) => error.message.includes(file)
      && reason.test(error.message) && /restore.*report/.test(error.message), label);
    assert.equal(fs.readFileSync(file, 'utf8'), text, label);
  }
});

test('persisted empty, zero, historical, lower-bound and resumed counts retain writer meaning and arbitrary text identities', () => {
  const file = path.join(scratch, 'valid-decoder-counts.json');
  assert.deepEqual(readCounts(file), emptyCounts(), 'an absent file is initial state');
  assert.equal(fs.existsSync(file), false, 'reading initial state creates nothing');
  writeCounts(file, emptyCounts());
  assert.deepEqual(readCounts(file), emptyCounts(), 'an empty v1 record is initial state');
  let counts = mergeObservation(readCounts(file), {
    engine: 'claude', log: 'synthetic-predecessor.jsonl',
    observation: readSessionLog('claude', lines(claudeLog('predecessor', [{ kind: 'prompt', id: 'earlier-turn' }]))), lowerBound: true,
  });
  counts = mergeObservation(counts, { engine: 'codex', log: 'synthetic.jsonl', observation: readSessionLog('codex', lines(codexLog('current-session', []))) });
  writeCounts(file, counts);
  assert.deepEqual(readCounts(file), counts);
  const limits = { 'compaction-threshold': 3, 'turn-threshold': 40 };
  const zero = assessSuccession(readCounts(file), limits);
  assert.deepEqual([zero.turns.count, zero.compactions.count, zero.due], [0, 0, false]);
  assert.deepEqual(zero.earlierSessions, [{ session: 'predecessor', engine: 'claude', turns: 1, compactions: 0, lowerBound: true }]);
  const observation = readSessionLog('codex', lines(codexLog('current-session', [{ kind: 'turn', id: 'opaque/event:1' }, { kind: 'compact', id: 'window:1' }])));
  counts = mergeObservation(readCounts(file), { engine: 'codex', log: 'synthetic.jsonl', observation });
  writeCounts(file, counts);
  const replay = mergeObservation(readCounts(file), { engine: 'codex', log: 'synthetic.jsonl', observation });
  assert.deepEqual(replay.sessions.map(({ turns, compactions }) => [turns.count, compactions.count]), [[1, 0], [1, 1]]);
  writeCounts(file, replay);
  const decoded = readCounts(file);
  assert.equal(assessSuccession(decoded, limits).due, false);
  assert.deepEqual(assessSuccession(decoded, { ...limits, 'turn-threshold': 1 }).reasons, ['turns 1 of 1']);
  assert.deepEqual(assessSuccession(decoded, { ...limits, 'compaction-threshold': 1 }).reasons, ['completed compactions 1 of 1']);
});

test('CLI show and observe return errors without normal due output or overwriting malformed counts', () => {
  const dir = path.join(scratch, 'invalid-cli');
  fs.mkdirSync(dir);
  const file = path.join(dir, 'counts.json');
  const log = path.join(dir, 'synthetic.jsonl');
  fs.writeFileSync(log, lines(codexLog('coordinator', [{ kind: 'turn', id: 'new-turn' }])));
  for (const { label, text, reason } of malformedCounts()) {
    fs.writeFileSync(file, text);
    for (const command of ['show', 'observe']) {
      const args = [command, '--counts', file, '--compaction-threshold', '3', '--turn-threshold', '40'];
      if (command === 'observe') args.push('--engine', 'codex', '--log', log);
      const result = run(args);
      assert.equal(result.status, 1, `${command}, ${label}: ${result.stdout} ${result.stderr}`);
      assert.equal(result.stdout, '', `${command}, ${label}: no ordinary due/not-due JSON`);
      assert.ok(result.stderr.startsWith('succession: ') && result.stderr.includes(file), `${command}, ${label}: ${result.stderr}`);
      assert.match(result.stderr, reason, `${command}, ${label}`);
      assert.match(result.stderr, /restore.*report/, `${command}, ${label}`);
      assert.equal(fs.readFileSync(file, 'utf8'), text, `${command}, ${label}: invalid bytes unchanged`);
      assert.deepEqual(fs.readdirSync(dir).sort(), ['counts.json', 'synthetic.jsonl'], 'no replacement or temporary file');
    }
  }
});

// Claude Code: chained entries; a prompt is a text `user` entry.
function claudeLog(session, events, { fromStart = true } = {}) {
  let parent = fromStart ? null : 'missing-parent';
  let n = 0;
  const entry = (fields) => {
    const uuid = `${session}-u${n += 1}`;
    const record = { parentUuid: parent, isSidechain: false, sessionId: session, uuid, timestamp: `2026-10-17T10:00:${String(n).padStart(2, '0')}Z`, ...fields };
    parent = uuid;
    return record;
  };
  const records = [{ type: 'permission-mode', permissionMode: 'default' }, entry({ type: 'attachment', attachment: { type: 'hook_success' } })];
  for (const event of events) {
    switch (event.kind) {
      case 'prompt': records.push(entry({ type: 'user', promptId: event.id, message: { role: 'user', content: event.text ?? 'go on' } })); break;
      case 'prompt-blocks': records.push(entry({ type: 'user', promptId: event.id, message: { role: 'user', content: [{ type: 'text', text: 'orchestration message' }] } })); break;
      case 'tool': records.push(entry({ type: 'assistant', message: { content: [{ type: 'tool_use', id: 't', name: 'Bash' }] } }));
        records.push(entry({ type: 'user', promptId: event.id, message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't', content: 'ok' }] } })); break;
      case 'steer': records.push(entry({ type: 'attachment', attachment: { type: 'queued_command', prompt: 'also check X' } })); break;
      case 'meta': records.push(entry({ type: 'user', isMeta: true, message: { role: 'user', content: 'caveat' } })); break;
      case 'sidechain': records.push({ ...entry({ type: 'user', promptId: 'side', message: { role: 'user', content: 'worker prompt' } }), isSidechain: true }); break;
      case 'compact': records.push(entry({ type: 'system', subtype: 'compact_boundary', compactMetadata: { trigger: 'auto' } }));
        records.push(entry({ type: 'user', isCompactSummary: true, message: { role: 'user', content: 'summary of earlier work' } })); break;
      default: throw new Error(event.kind);
    }
  }
  return records;
}

// Codex: session_meta first; task_started per turn; top-level compacted records.
function codexLog(session, events, { fromStart = true } = {}) {
  let ordinal = 0;
  const record = (type, payload) => ({ timestamp: `2026-10-17T10:00:${String(ordinal).padStart(2, '0')}Z`, ordinal: ordinal++, type, payload });
  const records = fromStart ? [record('session_meta', { id: session, cwd: '/w' })] : [];
  for (const event of events) {
    switch (event.kind) {
      case 'turn': records.push(record('event_msg', { type: 'task_started', turn_id: event.id }));
        records.push(record('turn_context', { turn_id: event.id }));
        records.push(record('response_item', { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'message' }] })); break;
      case 'tool': records.push(record('response_item', { type: 'function_call', name: 'exec' }));
        records.push(record('response_item', { type: 'function_call_output', output: 'ok' })); break;
      case 'steer': records.push(record('response_item', { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'steer' }] })); break;
      case 'compact': records.push(record('compacted', { message: '', window_id: event.id, replacement_history: [] }));
        records.push(record('turn_context', { turn_id: 'same turn' })); break;
      case 'end': records.push(record('event_msg', { type: 'task_complete', turn_id: event.id })); break;
      default: throw new Error(event.kind);
    }
  }
  return records;
}

test('Claude prompts count as turns; tool results, steering, meta, compaction summaries and sidechains do not', () => {
  const observation = readSessionLog('claude', lines(claudeLog('c1', [
    { kind: 'prompt', id: 'p1' }, { kind: 'tool', id: 'p1' }, { kind: 'tool', id: 'p1' }, { kind: 'steer' }, { kind: 'meta' },
    { kind: 'compact' }, { kind: 'prompt-blocks', id: 'p2' }, { kind: 'tool', id: 'p2' }, { kind: 'sidechain' }, { kind: 'compact' },
  ])));
  assert.equal(observation.session, 'c1');
  assert.equal(observation.startObserved, true);
  assert.deepEqual(observation.turns.map((t) => t.id), ['p1', 'p2']);
  assert.equal(observation.compactions.length, 2);
});

test('Codex task starts count as turns; steering input, tool calls and repeated turn context do not', () => {
  const observation = readSessionLog('codex', lines(codexLog('x1', [
    { kind: 'turn', id: 't1' }, { kind: 'tool' }, { kind: 'steer' }, { kind: 'compact', id: 'w1' }, { kind: 'tool' }, { kind: 'end', id: 't1' },
    { kind: 'turn', id: 't2' }, { kind: 'compact', id: 'w2' }, { kind: 'compact', id: 'w3' },
  ])));
  assert.equal(observation.session, 'x1');
  assert.equal(observation.startObserved, true);
  assert.deepEqual(observation.turns.map((t) => t.id), ['t1', 't2']);
  assert.deepEqual(observation.compactions.map((c) => c.id), ['w1', 'w2', 'w3']);
});

test('replayed lines count once, in both engines', () => {
  const claude = claudeLog('c2', [{ kind: 'prompt', id: 'p1' }, { kind: 'compact' }]);
  const codex = codexLog('x2', [{ kind: 'turn', id: 't1' }, { kind: 'compact', id: 'w1' }]);
  for (const [engine, records] of [['claude', claude], ['codex', codex]]) {
    const observation = readSessionLog(engine, lines([...records, ...records.slice(1)]));
    assert.deepEqual([observation.turns.length, observation.compactions.length], [1, 1], engine);
  }
});

test('resume keeps counts, a fresh successor starts its own, and a later shorter log never lowers them', () => {
  const thresholds = { 'compaction-threshold': 3, 'turn-threshold': 40 };
  let counts = emptyCounts();
  const first = codexLog('pred', [{ kind: 'turn', id: 't1' }, { kind: 'compact', id: 'w1' }]);
  counts = mergeObservation(counts, { engine: 'codex', log: 'pred.jsonl', observation: readSessionLog('codex', lines(first)) });
  const resumed = codexLog('pred', [{ kind: 'turn', id: 't1' }, { kind: 'compact', id: 'w1' }, { kind: 'turn', id: 't2' }, { kind: 'compact', id: 'w2' }]);
  counts = mergeObservation(counts, { engine: 'codex', log: 'pred.jsonl', observation: readSessionLog('codex', lines(resumed)) });
  assert.deepEqual([assessSuccession(counts, thresholds).turns.count, assessSuccession(counts, thresholds).compactions.count], [2, 2], 'resume keeps and extends counts');
  // A log truncated to its tail is only a lower bound and adds nothing already known.
  const tail = readSessionLog('codex', lines(codexLog('pred', [{ kind: 'turn', id: 't2' }], { fromStart: false })));
  assert.equal(tail.session, null, 'a tail without its session record names no session');
  counts = mergeObservation(counts, { engine: 'codex', log: 'pred.jsonl', observation: { ...tail, session: 'pred' } });
  assert.deepEqual([assessSuccession(counts, thresholds).turns.count, assessSuccession(counts, thresholds).lowerBound], [2, true]);
  const succ = codexLog('succ', [{ kind: 'turn', id: 's1' }]);
  counts = mergeObservation(counts, { engine: 'codex', log: 'succ.jsonl', observation: readSessionLog('codex', lines(succ)) });
  const report = assessSuccession(counts, thresholds);
  assert.deepEqual([report.session, report.turns.count, report.compactions.count, report.lowerBound], ['succ', 1, 0, false]);
  assert.deepEqual(report.earlierSessions, [{ session: 'pred', engine: 'codex', turns: 2, compactions: 2, lowerBound: true }],
    'the predecessor keeps its final counts');
});

test('a log that begins after the session start makes the counts a known lower bound', () => {
  for (const [engine, records] of [
    ['claude', claudeLog('c3', [{ kind: 'prompt', id: 'p9' }], { fromStart: false })],
    ['codex', [{ type: 'session_meta', payload: { id: 'x3' } }, ...codexLog('x3', [{ kind: 'turn', id: 't9' }], { fromStart: false })].reverse()],
  ]) {
    const observation = readSessionLog(engine, lines(records));
    assert.equal(observation.startObserved, false, engine);
    const counts = mergeObservation(emptyCounts(), { engine, log: 'l', observation });
    assert.equal(assessSuccession(counts, { 'compaction-threshold': 3, 'turn-threshold': 40 }).lowerBound, true, engine);
  }
  const explicit = mergeObservation(emptyCounts(), { engine: 'codex', log: 'l', observation: readSessionLog('codex', lines(codexLog('x4', []))), lowerBound: true });
  assert.equal(explicit.sessions[0].lowerBound, true, 'an operator-declared gap is kept');
});

test('either threshold independently makes succession due, also after lowering a threshold below the count', () => {
  const log = codexLog('x5', [{ kind: 'turn', id: 't1' }, { kind: 'turn', id: 't2' }, { kind: 'compact', id: 'w1' }]);
  const counts = mergeObservation(emptyCounts(), { engine: 'codex', log: 'l', observation: readSessionLog('codex', lines(log)) });
  assert.equal(assessSuccession(counts, { 'compaction-threshold': 3, 'turn-threshold': 40 }).due, false);
  assert.deepEqual(assessSuccession(counts, { 'compaction-threshold': 3, 'turn-threshold': 2 }).reasons, ['turns 2 of 2']);
  assert.deepEqual(assessSuccession(counts, { 'compaction-threshold': 1, 'turn-threshold': 40 }).reasons, ['completed compactions 1 of 1']);
  assert.equal(assessSuccession(counts, { 'compaction-threshold': 1, 'turn-threshold': 1 }).reasons.length, 2);
  for (const bad of [0, -1, 1.5, '3', null]) {
    assert.throws(() => assessSuccession(counts, { 'compaction-threshold': bad, 'turn-threshold': 40 }), /positive whole number/);
  }
});

test('an unrecognized log is reported as unobservable rather than counted as zero', () => {
  const observation = readSessionLog('codex', lines([{ hello: 'world' }]));
  assert.equal(observation.recognized, false);
  assert.throws(() => mergeObservation(emptyCounts(), { engine: 'codex', log: 'l', observation }), /cannot be observed from it; report the counts as unobservable rather than zero/);
  assert.throws(() => readSessionLog('gemini', ''), /unknown engine 'gemini'/);
  const otherEngine = mergeObservation(emptyCounts(), { engine: 'codex', log: 'l', observation: readSessionLog('codex', lines(codexLog('same', []))) });
  assert.throws(() => mergeObservation(otherEngine, { engine: 'claude', log: 'l', observation: { ...readSessionLog('claude', lines(claudeLog('same', []))) } }),
    /was recorded for codex, not claude/);
});

// The tool reads the session identity the engine gives commands; tests run
// inside an engine session, so they remove it unless a case supplies it.
const ENGINE_IDENTITY = ['CODEX_THREAD_ID', 'CODEX_SESSION_ID', 'CLAUDE_CODE_SESSION_ID'];

function run(args, env = {}) {
  const base = { ...process.env };
  for (const name of ENGINE_IDENTITY) delete base[name];
  return spawnSync(process.execPath, [tool, ...args], { encoding: 'utf8', env: { ...base, ...env } });
}

const uuid = (n) => `0000000${n}-0000-4000-8000-00000000000${n}`;

/** A home with logs for both engines: the coordinator's root logs, sub-agent logs and others. */
function homeWithLogs(name, marker) {
  const home = path.join(scratch, name);
  const project = path.join(home, '.claude', 'projects', '-work');
  const day = path.join(home, '.codex', 'sessions', '2026', '10', '17');
  fs.mkdirSync(path.join(project, uuid(1), 'subagents'), { recursive: true });
  fs.mkdirSync(day, { recursive: true });
  const marked = (records, session) => [...records, { type: 'user', sessionId: session, parentUuid: 'x', uuid: `${session}-m`, message: { content: `echo ${marker}` } }];
  const codexMarked = (records) => [...records, { type: 'response_item', payload: { type: 'function_call_output', output: marker } }];
  const files = {
    claudeRoot: path.join(project, `${uuid(1)}.jsonl`),
    claudeSub: path.join(project, uuid(1), 'subagents', 'agent-a1.jsonl'),
    claudeSidechainOnly: path.join(project, `${uuid(2)}.jsonl`),
    codexRoot: path.join(day, `rollout-2026-10-17T10-00-00-${uuid(3)}.jsonl`),
    codexGuardian: path.join(day, `rollout-2026-10-17T10-00-01-${uuid(4)}.jsonl`),
  };
  fs.writeFileSync(files.claudeRoot, lines(marked(claudeLog(uuid(1), [{ kind: 'prompt', id: 'p1' }]), uuid(1))));
  fs.writeFileSync(files.claudeSub, lines(marked(claudeLog(uuid(1), [{ kind: 'prompt', id: 's1' }]).map((r) => (r.uuid ? { ...r, isSidechain: true } : r)), uuid(1)).map((r) => ({ ...r, isSidechain: true }))));
  fs.writeFileSync(files.claudeSidechainOnly, lines(claudeLog(uuid(2), [{ kind: 'prompt', id: 'p2' }]).map((r) => (r.uuid ? { ...r, isSidechain: true } : r)).concat([{ isSidechain: true, uuid: 'z', sessionId: uuid(2), message: { content: marker } }])));
  fs.writeFileSync(files.codexRoot, lines(codexMarked(codexLog(uuid(3), [{ kind: 'turn', id: 't1' }]))));
  const guardian = codexLog(uuid(4), Array.from({ length: 14 }, (_, i) => ({ kind: 'turn', id: `g${i}` })));
  guardian[0] = { ...guardian[0], payload: { id: uuid(4), session_id: uuid(3), parent_thread_id: uuid(3), source: { subagent: { other: 'guardian' } } } };
  fs.writeFileSync(files.codexGuardian, lines(codexMarked(guardian)));
  return { home, files, env: { HOME: home, USERPROFILE: home, CLAUDE_CONFIG_DIR: '', CODEX_HOME: '' } };
}

test('a sub-agent log, such as the guardian rollout that repeats its parent, is identified and never counted', () => {
  const { files } = homeWithLogs('subagents', 'aw-coordinator-session-identity-check-0001');
  const root = readSessionLog('codex', fs.readFileSync(files.codexRoot, 'utf8'));
  const guardian = readSessionLog('codex', fs.readFileSync(files.codexGuardian, 'utf8'));
  assert.deepEqual([root.identity, root.session, root.turns.length], ['root', uuid(3), 1]);
  assert.deepEqual([guardian.identity, guardian.turns.length], ['subagent', 14]);
  assert.throws(() => mergeObservation(emptyCounts(), { engine: 'codex', log: files.codexGuardian, observation: guardian }),
    /belongs to a sub-agent session .* not the coordinator's own/);
  const sidechain = readSessionLog('claude', fs.readFileSync(files.claudeSidechainOnly, 'utf8'));
  assert.equal(sidechain.identity, 'subagent');
  // Either signal marks a Codex sub-agent: a parent thread with an ordinary source, or a sub-agent source alone.
  for (const payload of [{ id: uuid(5), parent_thread_id: uuid(3), source: 'cli' }, { id: uuid(5), source: { subagent: 'review' } }]) {
    assert.equal(readSessionLog('codex', lines([{ type: 'session_meta', payload }])).identity, 'subagent', JSON.stringify(payload));
  }
});

test('missing, malformed and contradictory identity records are reported, never taken as a root', () => {
  const cases = [
    ['codex', [{ type: 'event_msg', payload: { type: 'task_started', turn_id: 't' } }], 'missing'],
    ['codex', [{ type: 'session_meta', payload: 'not an object' }], 'missing'],
    ['codex', [{ type: 'session_meta', payload: { cwd: '/w' } }], 'missing'],
    ['codex', [{ type: 'session_meta', payload: { id: uuid(6), session_id: uuid(7) } }], 'contradictory'],
    ['claude', [{ type: 'user', uuid: 'a', parentUuid: null, message: { content: 'hi' } }], 'missing'],
    ['claude', [{ type: 'user', uuid: 'a', parentUuid: null, sessionId: uuid(6), message: { content: 'hi' } },
      { type: 'user', uuid: 'b', parentUuid: 'a', sessionId: uuid(7), message: { content: 'hi' } }], 'contradictory'],
  ];
  for (const [engine, records, identity] of cases) {
    const text = lines(records);
    assert.equal(readSessionLog(engine, text).identity, identity, `${engine} ${JSON.stringify(records).slice(0, 80)}`);
  }
  const contradictory = readSessionLog('codex', lines([{ type: 'session_meta', payload: { id: uuid(6), session_id: uuid(7) } }]));
  assert.throws(() => mergeObservation(emptyCounts(), { engine: 'codex', log: 'l', observation: contradictory }), /contradictory session identities/);
  assert.equal(sessionIdFromPath('codex', `/x/rollout-2026-10-17T10-00-00-${uuid(3)}.jsonl`), uuid(3));
  assert.equal(sessionIdFromPath('claude', `/x/${uuid(1)}.jsonl`), uuid(1));
  assert.equal(sessionIdFromPath('claude', '/x/notes.jsonl'), null);
  assert.equal(environmentSession('codex', { CODEX_THREAD_ID: uuid(3) }), uuid(3));
  assert.equal(environmentSession('codex', { CODEX_SESSION_ID: uuid(3) }), uuid(3));
  assert.equal(environmentSession('claude', { CLAUDE_CODE_SESSION_ID: uuid(1) }), uuid(1));
  assert.equal(environmentSession('claude', { CODEX_THREAD_ID: uuid(3) }), null);
});

test('locate takes the engine-given session identity, corroborated by the log, on both engines', () => {
  const marker = 'aw-coordinator-session-identity-check-0002';
  const { home, files } = homeWithLogs('identity', marker);
  const base = { CLAUDE_CONFIG_DIR: '', CODEX_HOME: '' };
  const claude = locateLog({ engine: 'claude', home, env: { ...base, CLAUDE_CODE_SESSION_ID: uuid(1) } });
  assert.deepEqual([claude.log, claude.basis], [files.claudeRoot, 'environment'], 'the sub-agent transcript under the session is not a candidate');
  const codex = locateLog({ engine: 'codex', home, env: { ...base, CODEX_THREAD_ID: uuid(3) } });
  assert.deepEqual([codex.log, codex.basis], [files.codexRoot, 'environment']);
  assert.throws(() => locateLog({ engine: 'codex', home, env: base, session: uuid(4) }),
    /no log is established for session .*excluded: .*guardian|session_meta names a parent thread or a sub-agent source/);
  assert.throws(() => locateLog({ engine: 'codex', home, env: base, session: uuid(9) }), /no log is established for session/);
  // A log at the identity's path that records another session, or no identity, does not establish an initial location.
  const day = path.dirname(files.codexRoot);
  fs.writeFileSync(path.join(day, `rollout-2026-10-17T11-00-00-${uuid(8)}.jsonl`), lines(codexLog(uuid(7), [])));
  assert.throws(() => locateLog({ engine: 'codex', home, env: base, session: uuid(8) }), /records session .* not /);
  fs.writeFileSync(path.join(day, `rollout-2026-10-17T12-00-00-${uuid(9)}.jsonl`), lines(codexLog(uuid(9), [{ kind: 'turn', id: 't' }], { fromStart: false })));
  assert.throws(() => locateLog({ engine: 'codex', home, env: base, session: uuid(9) }), /no session_meta record/);
});

test('the marker fallback skips sub-agent logs and reports ambiguity or inability truthfully', () => {
  const marker = 'aw-coordinator-session-identity-check-0003';
  const { home, files } = homeWithLogs('marker', marker);
  const base = { CLAUDE_CONFIG_DIR: '', CODEX_HOME: '' };
  assert.equal(locateLog({ engine: 'codex', home, env: base, marker }).log, files.codexRoot, 'root plus guardian gives the root');
  assert.equal(locateLog({ engine: 'claude', home, env: base, marker }).log, files.claudeRoot, 'sub-agent transcripts are skipped');
  // Only sub-agent or unverifiable matches: no root can be established, and each is named with its reason.
  fs.unlinkSync(files.codexRoot);
  assert.throws(() => locateLog({ engine: 'codex', home, env: base, marker }),
    /no root session log modified in the window contains the marker; excluded: .*session_meta names a parent thread or a sub-agent source/);
  // A second genuine root with the marker is ambiguous, never resolved by picking one.
  const day = path.dirname(files.codexGuardian);
  for (const n of [5, 6]) {
    fs.writeFileSync(path.join(day, `rollout-2026-10-17T13-00-0${n}-${uuid(n)}.jsonl`),
      lines([...codexLog(uuid(n), []), { type: 'response_item', payload: { type: 'message', content: marker } }]));
  }
  assert.throws(() => locateLog({ engine: 'codex', home, env: base, marker }), /2 root session logs contain the marker, so this session's log is ambiguous/);
  assert.throws(() => locateLog({ engine: 'codex', home, env: base }), /no session identity is available from the engine; print a marker/);
});

test('observing an established log keeps truncated history as a lower bound; an unestablished one is refused', () => {
  const { files } = homeWithLogs('observe', 'aw-coordinator-session-identity-check-0004');
  let counts = mergeObservation(emptyCounts(), {
    engine: 'codex', log: files.codexRoot, observation: observationFor('codex', files.codexRoot, fs.readFileSync(files.codexRoot, 'utf8'), emptyCounts()),
  });
  const truncatedText = lines(codexLog(uuid(3), [{ kind: 'turn', id: 't2' }], { fromStart: false }));
  const truncated = observationFor('codex', files.codexRoot, truncatedText, counts);
  counts = mergeObservation(counts, { engine: 'codex', log: files.codexRoot, observation: truncated });
  const report = assessSuccession(counts, { 'compaction-threshold': 3, 'turn-threshold': 40 });
  assert.deepEqual([report.session, report.turns.count, report.lowerBound], [uuid(3), 2, true]);
  assert.throws(() => observationFor('codex', `/x/rollout-2026-10-17T10-00-00-${uuid(8)}.jsonl`, truncatedText, counts),
    /does not record whose session it is .* no established coordinator session matches its file name; locate the coordinator's log first/);
  assert.equal(observationFor('codex', `/x/rollout-2026-10-17T10-00-00-${uuid(8)}.jsonl`, lines(codexLog(uuid(3), [])), counts).identity, 'contradictory',
    'a log whose file name carries another id is contradictory');
});

test('the entry point locates, persists counts and exits 3 when succession is due', () => {
  const marker = 'aw-coordinator-session-identity-check-0005';
  const { files, env } = homeWithLogs('cli', marker);
  const located = run(['locate', '--engine', 'claude'], { ...env, CLAUDE_CODE_SESSION_ID: uuid(1) });
  assert.equal(located.status, 0, located.stderr);
  assert.deepEqual([JSON.parse(located.stdout).log, JSON.parse(located.stdout).basis], [files.claudeRoot, 'environment']);
  const byMarker = run(['locate', '--engine', 'codex', '--marker', marker], env);
  assert.equal(byMarker.status, 0, byMarker.stderr);
  assert.equal(JSON.parse(byMarker.stdout).log, files.codexRoot);
  assert.equal(run(['locate', '--engine', 'codex', '--marker', 'aw-coordinator-session-absent-marker'], env).status, 1);
  assert.match(run(['locate', '--engine', 'codex', '--session', uuid(4)], env).stderr, /sub-agent source/);

  const counts = path.join(scratch, 'counts.json');
  const observed = run(['observe', '--engine', 'codex', '--log', files.codexRoot, '--counts', counts, '--compaction-threshold', '3', '--turn-threshold', '40']);
  assert.equal(observed.status, 0, observed.stderr);
  assert.deepEqual([JSON.parse(observed.stdout).turns.count, JSON.parse(observed.stdout).compactions.count], [1, 0]);
  const refused = run(['observe', '--engine', 'codex', '--log', files.codexGuardian, '--counts', counts, '--compaction-threshold', '3', '--turn-threshold', '40']);
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /belongs to a sub-agent session/);
  const lowered = run(['show', '--counts', counts, '--compaction-threshold', '3', '--turn-threshold', '1']);
  assert.equal(lowered.status, 3, 'due immediately after a lowered threshold');
  assert.deepEqual(JSON.parse(lowered.stdout).reasons, ['turns 1 of 1']);
  assert.equal(JSON.parse(lowered.stdout).turns.count, 1, 'the refused guardian log added nothing');
  assert.equal(run(['show', '--counts', counts, '--compaction-threshold', '0', '--turn-threshold', '40']).status, 1);
  fs.writeFileSync(path.join(scratch, 'not-counts.json'), '{"x":1}');
  assert.match(run(['show', '--counts', path.join(scratch, 'not-counts.json'), '--compaction-threshold', '3', '--turn-threshold', '40']).stderr,
    /is not a version 1 counts file; restore it rather than starting counts again/);
  assert.equal(run(['observe', '--engine', 'claude']).status, 2);
  assert.deepEqual(fs.readdirSync(scratch).filter((name) => name.endsWith('.tmp')), [], 'no temporary file is left behind');
});

test('a malformed or cut-short session log record refuses the observation and leaves the counts unchanged', () => {
  const dir = path.join(scratch, 'malformed-logs');
  fs.mkdirSync(dir);
  const counts = path.join(dir, 'counts.json');
  writeCounts(counts, recordedCounts());
  const before = fs.readFileSync(counts, 'utf8');
  const records = codexLog('coordinator', [{ kind: 'turn', id: 'turn-2' }, { kind: 'turn', id: 'turn-3' }]).map((record) => JSON.stringify(record));
  const cut = records.at(-1).slice(0, 12);
  const cases = [
    { label: 'interior', text: `${[records[0], cut, ...records.slice(1)].join('\n')}\n`, line: 2, reason: /is not a complete JSON record/ },
    { label: 'terminated final', text: `${[...records, cut].join('\n')}\n`, line: records.length + 1, reason: /is not a complete JSON record/ },
    { label: 'unterminated final', text: [...records, cut].join('\n'), line: records.length + 1, reason: /is an unterminated final fragment/ },
  ];
  for (const { label, text, line, reason } of cases) {
    const log = path.join(dir, `${label.replace(/ /g, '-')}.jsonl`);
    fs.writeFileSync(log, text);
    assert.throws(() => readSessionLog('codex', text, log), new RegExp(`line ${line} `), label);
    const refused = run(['observe', '--engine', 'codex', '--log', log, '--counts', counts, '--compaction-threshold', '3', '--turn-threshold', '40']);
    assert.equal(refused.status, 1, label);
    assert.match(refused.stderr, reason, label);
    assert.ok(refused.stderr.includes(`${log} line ${line} `), `${label} names the file and line`);
    assert.equal(fs.readFileSync(counts, 'utf8'), before, `${label} leaves the counts unchanged`);
  }
  const complete = path.join(dir, 'complete.jsonl');
  fs.writeFileSync(complete, `${records.join('\n')}\n`);
  const later = run(['observe', '--engine', 'codex', '--log', complete, '--counts', counts, '--compaction-threshold', '3', '--turn-threshold', '40']);
  assert.equal(later.status, 0, later.stderr);
});
