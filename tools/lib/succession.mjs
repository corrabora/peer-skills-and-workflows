// Coordinator succession counts: observed turns and completed compactions of
// one coordinator session, read from the engine's own session log and kept in
// a counts file in the run records. Neither engine gives a model a lifetime
// counter, so the counts come only from recorded session events.
//
// Claude Code writes one JSON object per line to
// <config>/projects/<project key>/<session id>.jsonl: a prompt that starts a
// turn is a `user` entry whose content is text (tool results, meta entries,
// compaction summaries and sidechain entries are not prompts; a message sent
// while a turn runs arrives as an attachment instead), and a completed
// compaction is a `system` entry with subtype `compact_boundary`.
// Codex writes <home>/sessions/<date>/rollout-<time>-<session id>.jsonl: a turn
// starts with an `event_msg` of type `task_started` carrying its `turn_id`
// (input that steers a running turn starts none), and a completed compaction
// is a top-level `compacted` record.
//
// Both engines also record sub-agent sessions, which can repeat the parent's
// transcript. Codex writes, for example, its guardian review thread as a
// rollout of its own whose first `session_meta` names a `parent_thread_id` and
// a `subagent` source; Claude Code writes sub-agent transcripts of sidechain
// entries under `<session id>/subagents/`. A sub-agent's log is never the
// coordinator's own, so it is neither located nor counted.
//
// The coordinator's log is located from the session identity the engine gives
// the commands it runs (`CODEX_THREAD_ID` or `CODEX_SESSION_ID`;
// `CLAUDE_CODE_SESSION_ID`), corroborated by the identity the log records, or,
// when no identity is available, from a fresh marker the session printed.
// Each event keeps a stable identity, so replayed or repeated lines count once
// and a later, shorter log never lowers a count already recorded.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const ENGINES = ['claude', 'codex'];
export const COUNTS_FORMAT = 'agent-workflow coordinator counts';
export const COUNTS_VERSION = 1;

/**
 * The session identity, whether the log starts at the session's beginning, and
 * the turn and compaction events in one session log's text. `recognized` is
 * false when no line has the engine's record shape, so the counts cannot be
 * observed from it. `identity` says what the log records about whose session
 * it is: `root` (a session of its own, `session` its id), `subagent`,
 * `missing` (no readable identity record, as in a log cut before it) or
 * `contradictory` (identity records that disagree), with `reason`.
 */
export function readSessionLog(engine, text, file = 'the session log') {
  if (!ENGINES.includes(engine)) throw new Error(`unknown engine '${engine}'; the engines are ${ENGINES.join(', ')}`);
  const records = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (!line.trim()) return;
    let value;
    try {
      value = JSON.parse(line);
    } catch {
      // A record cut short by a concurrent write or a crash may have dropped a
      // threshold-relevant event, so no complete observation exists; the
      // caller observes again once the engine has finished writing.
      const fragment = index === lines.length - 1 ? 'is an unterminated final fragment' : 'is not a complete JSON record';
      throw new Error(`${file} line ${index + 1} ${fragment}; the observation is refused and the counts are unchanged`);
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) records.push({ value, line: index + 1 });
  });
  return engine === 'claude' ? readClaude(records) : readCodex(records);
}

function readClaude(records) {
  const result = { session: null, startObserved: false, recognized: false, identity: 'missing', reason: 'no entry records a session id', turns: [], compactions: [] };
  let first = true;
  let chained = 0;
  let sidechain = 0;
  const ids = new Set();
  for (const { value, line } of records) {
    if (typeof value.sessionId === 'string') {
      result.recognized = true;
      if (value.isSidechain !== true) ids.add(value.sessionId);
    }
    if (typeof value.uuid === 'string') {
      chained += 1;
      if (value.isSidechain === true) sidechain += 1;
    }
    // The root session's first chained entry, of whatever type, has no parent;
    // a log that begins later in the chain starts with a parent it lacks.
    if (first && value.isSidechain !== true && typeof value.uuid === 'string' && Object.hasOwn(value, 'parentUuid')) {
      result.startObserved = value.parentUuid === null && !(value.type === 'system' && value.subtype === 'compact_boundary');
      first = false;
    }
    if (value.isSidechain === true) continue;
    if (value.type === 'system' && value.subtype === 'compact_boundary') {
      result.compactions.push({ id: value.uuid ?? `line-${line}-${digest(value)}`, at: value.timestamp ?? null });
    } else if (value.type === 'user' && isPrompt(value)) {
      result.turns.push({ id: value.promptId ?? value.uuid ?? `line-${line}-${digest(value)}`, at: value.timestamp ?? null });
    }
  }
  if (chained > 0 && sidechain === chained) {
    Object.assign(result, { identity: 'subagent', reason: 'every entry is a sidechain entry of a sub-agent' });
  } else if (ids.size > 1) {
    Object.assign(result, { identity: 'contradictory', reason: `entries record ${ids.size} different session ids` });
  } else if (ids.size === 1) {
    Object.assign(result, { identity: 'root', reason: null, session: [...ids][0] });
  }
  return dedupe(result);
}

function isPrompt(entry) {
  if (entry.isMeta === true || entry.isCompactSummary === true) return false;
  const content = entry.message?.content;
  if (typeof content === 'string') return content.trim() !== '';
  if (!Array.isArray(content)) return false;
  if (content.some((block) => block?.type === 'tool_result')) return false;
  return content.some((block) => block?.type === 'text' && typeof block.text === 'string' && block.text.trim() !== '');
}

function readCodex(records) {
  const result = { session: null, startObserved: false, recognized: false, identity: 'missing', reason: 'no session_meta record', turns: [], compactions: [] };
  let meta = false;
  records.forEach(({ value, line }, index) => {
    const payload = value.payload && typeof value.payload === 'object' && !Array.isArray(value.payload) ? value.payload : {};
    if (value.type === 'session_meta') {
      result.recognized = true;
      if (index === 0) result.startObserved = true;
      if (!meta) {
        meta = true;
        Object.assign(result, codexIdentity(value.payload));
      }
    } else if (value.type === 'event_msg' && payload.type === 'task_started') {
      result.recognized = true;
      result.turns.push({ id: payload.turn_id ?? `line-${line}-${digest(value)}`, at: value.timestamp ?? null });
    } else if (value.type === 'compacted') {
      result.recognized = true;
      const id = payload.compaction_response_id ?? payload.window_id
        ?? (value.timestamp ? `${value.timestamp}#${value.ordinal ?? ''}` : `line-${line}-${digest(value)}`);
      result.compactions.push({ id, at: value.timestamp ?? null });
    } else if (['turn_context', 'response_item', 'event_msg'].includes(value.type)) {
      result.recognized = true;
    }
  });
  return dedupe(result);
}

/** What a rollout's first `session_meta` payload says about whose session it is. */
function codexIdentity(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { identity: 'missing', reason: 'the session_meta record has no readable payload' };
  }
  const id = typeof payload.id === 'string' && payload.id !== '' ? payload.id : null;
  const source = payload.source;
  const parent = typeof payload.parent_thread_id === 'string' && payload.parent_thread_id !== '';
  if (parent || (source !== null && typeof source === 'object' && Object.hasOwn(source, 'subagent'))) {
    return { identity: 'subagent', reason: 'session_meta names a parent thread or a sub-agent source', session: id };
  }
  if (!id) return { identity: 'missing', reason: 'session_meta records no session id' };
  if (typeof payload.session_id === 'string' && payload.session_id !== id) {
    return { identity: 'contradictory', reason: `session_meta id ${id} differs from its session_id ${payload.session_id}`, session: id };
  }
  return { identity: 'root', reason: null, session: id };
}

/** The session id a log's file name carries, or null. */
export function sessionIdFromPath(engine, file) {
  const name = path.basename(file);
  const match = engine === 'codex'
    ? /^rollout-.*-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl$/i.exec(name)
    : /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl$/i.exec(name);
  return match ? match[1].toLowerCase() : null;
}

/** The session identity the engine gives the commands a session runs, or null. */
export function environmentSession(engine, env = process.env) {
  const value = engine === 'codex' ? env.CODEX_THREAD_ID || env.CODEX_SESSION_ID : env.CLAUDE_CODE_SESSION_ID;
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

/**
 * Whether the log at `file` is established as the coordinator session `id`'s
 * own: its file name carries the id, and its recorded identity is a root
 * session with that id. Returns { ok, reason }.
 */
export function establishLog(engine, file, observation, id) {
  const fileId = sessionIdFromPath(engine, file);
  if (fileId !== id.toLowerCase()) return { ok: false, reason: `its file name does not carry session ${id}` };
  if (observation.identity !== 'root') return { ok: false, reason: observation.reason };
  if (observation.session.toLowerCase() !== id.toLowerCase()) {
    return { ok: false, reason: `it records session ${observation.session}, not ${id}` };
  }
  return { ok: true, reason: null };
}

function dedupe(result) {
  const unique = (events) => [...new Map(events.map((event) => [event.id, event])).values()];
  return { ...result, turns: unique(result.turns), compactions: unique(result.compactions) };
}

function digest(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16);
}

/** An empty counts record. */
export function emptyCounts() {
  return { format: COUNTS_FORMAT, version: COUNTS_VERSION, current: null, sessions: [] };
}

/** Read a counts file; an absent file is an empty record, anything else unexpected is an error. */
export function readCounts(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return emptyCounts();
    throw error;
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`${file} is not a counts file (invalid JSON); restore it rather than starting counts again; report the problem if no valid copy is available`);
  }
  if (data?.format !== COUNTS_FORMAT || data.version !== COUNTS_VERSION || !Array.isArray(data.sessions)) {
    throw new Error(`${file} is not a version ${COUNTS_VERSION} counts file; restore it rather than starting counts again; report the problem if no valid copy is available`);
  }
  checkCounts(data, file);
  return data;
}

// Validate the persisted v1 meaning at ingress, before show can assess it or
// observe can merge and overwrite it. Counts include only retained distinct
// event IDs, even when earlier history is unknown and lowerBound is true.
function checkCounts(data, file) {
  const fail = (field, message) => {
    throw new Error(`${file}: invalid version ${COUNTS_VERSION} counts at ${field}: ${message}; `
      + 'restore a valid copy rather than starting counts again; report the problem if none is available');
  };
  const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
  const text = (value) => typeof value === 'string' && value.trim() !== '';
  const sessions = new Set();
  for (const [index, entry] of data.sessions.entries()) {
    const field = `sessions[${index}]`;
    if (!record(entry)) fail(field, 'must be a session object');
    if (!text(entry.session)) fail(`${field}.session`, 'must be a nonempty session identity');
    if (sessions.has(entry.session)) fail(`${field}.session`, 'duplicates a session identity');
    sessions.add(entry.session);
    if (!ENGINES.includes(entry.engine)) fail(`${field}.engine`, `must be one of ${ENGINES.join(', ')}`);
    if (!text(entry.log)) fail(`${field}.log`, 'must be a nonempty log path');
    for (const key of ['firstObservedAt', 'lastObservedAt']) {
      if (!text(entry[key])) fail(`${field}.${key}`, 'must be a nonempty observation time string');
    }
    if (typeof entry.lowerBound !== 'boolean') fail(`${field}.lowerBound`, 'must be a boolean');
    for (const key of ['turns', 'compactions']) {
      const events = entry[key];
      const label = `${field}.${key}`;
      if (!record(events)) fail(label, 'must be an object with count and ids');
      if (!Number.isSafeInteger(events.count) || events.count < 0) {
        fail(`${label}.count`, 'must be a safe nonnegative integer');
      }
      if (!Array.isArray(events.ids)) fail(`${label}.ids`, 'must be a list of distinct nonempty event identities');
      const ids = new Set();
      for (const [position, id] of events.ids.entries()) {
        if (!text(id)) fail(`${label}.ids[${position}]`, 'must be a nonempty event identity');
        if (ids.has(id)) fail(`${label}.ids[${position}]`, 'duplicates an event identity');
        ids.add(id);
      }
      if (events.count !== ids.size) fail(label, 'count must equal the number of retained distinct event ids');
    }
  }
  if (data.sessions.length === 0) {
    if (data.current !== null) fail('current', 'must be null when no session has been observed');
  } else if (!text(data.current) || !sessions.has(data.current)) {
    fail('current', 'must name one of the recorded sessions');
  }
}

/** Write a counts file through a temporary file beside it, so a reader never sees half a record. */
export function writeCounts(file, counts) {
  const temporary = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.tmp`);
  fs.writeFileSync(temporary, `${JSON.stringify(counts, null, 2)}\n`);
  fs.renameSync(temporary, file);
}

/**
 * Merge one observation of a session log into the counts. The session's
 * earlier event identities are kept, so counts never fall and repeated events
 * count once; a session not seen before becomes current with counts of its
 * own, leaving earlier sessions' final counts as they were. `lowerBound`
 * records that events before the observed log are unknown.
 */
export function mergeObservation(counts, { engine, log, observation, lowerBound = false, at = new Date().toISOString() }) {
  if (!observation.recognized) {
    throw new Error(`${log} has no ${engine} session records, so turns and compactions cannot be observed from it; `
      + 'report the counts as unobservable rather than zero');
  }
  if (observation.identity === 'subagent') {
    throw new Error(`${log} belongs to a sub-agent session (${observation.reason}), not the coordinator's own; observe the coordinator's own log`);
  }
  if (observation.identity === 'contradictory') {
    throw new Error(`${log} records contradictory session identities (${observation.reason}); its counts cannot be attributed`);
  }
  if (!observation.session) throw new Error(`${log} names no session, so its counts cannot be kept apart from another session's`);
  const sessions = counts.sessions.map((entry) => ({ ...entry }));
  let entry = sessions.find((candidate) => candidate.session === observation.session);
  if (entry && entry.engine !== engine) {
    throw new Error(`session ${observation.session} was recorded for ${entry.engine}, not ${engine}`);
  }
  if (!entry) {
    entry = {
      session: observation.session,
      engine,
      log,
      firstObservedAt: at,
      lowerBound: false,
      turns: { count: 0, ids: [] },
      compactions: { count: 0, ids: [] },
    };
    sessions.push(entry);
  }
  const union = (known, events) => [...new Set([...known, ...events.map((event) => event.id)])];
  const turns = union(entry.turns.ids, observation.turns);
  const compactions = union(entry.compactions.ids, observation.compactions);
  Object.assign(entry, {
    log,
    lastObservedAt: at,
    lowerBound: entry.lowerBound || lowerBound || !observation.startObserved,
    turns: { count: turns.length, ids: turns },
    compactions: { count: compactions.length, ids: compactions },
  });
  return { ...counts, current: observation.session, sessions };
}

/**
 * The observation of `file` to merge into `counts`, with the coordinator
 * session it belongs to. A log recording its own root identity is attributed
 * to it, provided its file name does not carry another id. A log without a
 * readable identity record, such as one cut before its start, is attributed
 * only to a session already established in `counts` whose id its file name
 * carries, and then as a lower bound. Sub-agent and contradictory logs, and an
 * unestablished log without identity, are refused.
 */
export function observationFor(engine, file, text, counts) {
  const observation = readSessionLog(engine, text, file);
  const fileId = sessionIdFromPath(engine, file);
  if (observation.identity === 'root' && fileId !== null && fileId !== observation.session.toLowerCase()) {
    return { ...observation, identity: 'contradictory', reason: `it records session ${observation.session} but its file name carries ${fileId}` };
  }
  if (observation.identity === 'missing') {
    const established = fileId !== null && counts.sessions.some((entry) => entry.session.toLowerCase() === fileId && entry.engine === engine);
    if (!established) {
      throw new Error(`${file} does not record whose session it is (${observation.reason}), and no established coordinator session `
        + 'matches its file name; locate the coordinator\'s log first');
    }
    return { ...observation, session: counts.sessions.find((entry) => entry.session.toLowerCase() === fileId).session, startObserved: false };
  }
  return observation;
}

/**
 * The current session's counts against the thresholds: due when either count
 * has reached its threshold. Counts known only as a lower bound say so; a
 * lower bound that has reached a threshold is still due.
 */
export function assessSuccession(counts, thresholds) {
  for (const key of ['compaction-threshold', 'turn-threshold']) {
    const value = thresholds[key];
    if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${key} must be a positive whole number`);
  }
  const entry = counts.sessions.find((candidate) => candidate.session === counts.current);
  if (!entry) throw new Error('no coordinator session has been observed yet; observe the current session log first');
  const reasons = [];
  if (entry.turns.count >= thresholds['turn-threshold']) {
    reasons.push(`turns ${entry.turns.count} of ${thresholds['turn-threshold']}`);
  }
  if (entry.compactions.count >= thresholds['compaction-threshold']) {
    reasons.push(`completed compactions ${entry.compactions.count} of ${thresholds['compaction-threshold']}`);
  }
  return {
    session: entry.session,
    engine: entry.engine,
    log: entry.log,
    lowerBound: entry.lowerBound,
    turns: { count: entry.turns.count, threshold: thresholds['turn-threshold'] },
    compactions: { count: entry.compactions.count, threshold: thresholds['compaction-threshold'], observable: true },
    due: reasons.length > 0,
    reasons,
    earlierSessions: counts.sessions
      .filter((candidate) => candidate.session !== entry.session)
      .map(({ session, engine, turns, compactions, lowerBound }) => ({
        session, engine, turns: turns.count, compactions: compactions.count, lowerBound,
      })),
  };
}

/** The directory under the engine's home that holds its session logs. */
function logRoot(engine, home, env) {
  return engine === 'claude'
    ? path.join(env.CLAUDE_CONFIG_DIR && path.isAbsolute(env.CLAUDE_CONFIG_DIR) ? env.CLAUDE_CONFIG_DIR : path.join(home, '.claude'), 'projects')
    : path.join(env.CODEX_HOME && path.isAbsolute(env.CODEX_HOME) ? env.CODEX_HOME : path.join(home, '.codex'), 'sessions');
}

/** Session log files under `root`, leaving out Claude's sub-agent transcripts. */
function logFiles(engine, root) {
  const found = [];
  const walk = (dir) => {
    let items;
    try {
      items = fs.readdirSync(dir, { withFileTypes: true });
    } catch (error) {
      if (error.code === 'ENOENT') return;
      throw error;
    }
    for (const item of items) {
      const full = path.join(dir, item.name);
      if (item.isDirectory()) {
        if (!(engine === 'claude' && item.name === 'subagents')) walk(full);
      } else if (item.isFile() && item.name.endsWith('.jsonl') && (engine === 'claude' || item.name.startsWith('rollout-'))) {
        found.push(full);
      }
    }
  };
  walk(root);
  return found.sort();
}

/**
 * Locate the coordinator's own session log. With a session identity (given,
 * or from the engine's environment), the log is the one whose file name
 * carries that id and whose recorded identity is that root session; without
 * one, it is the one root-session log modified since `since` that contains
 * `marker`. Sub-agent logs and logs whose identity is missing or contradictory
 * are never located. Returns { log, session, basis, excluded }; throws, naming
 * every candidate and why it was excluded, unless exactly one log is
 * established.
 */
export function locateLog({ engine, home, env = process.env, session = null, marker = null, since = 0 }) {
  if (!ENGINES.includes(engine)) throw new Error(`unknown engine '${engine}'; the engines are ${ENGINES.join(', ')}`);
  const root = logRoot(engine, home, env);
  const id = session ?? environmentSession(engine, env);
  const excluded = [];
  if (id) {
    const candidates = logFiles(engine, root).filter((file) => sessionIdFromPath(engine, file) === id.toLowerCase());
    const established = [];
    for (const file of candidates) {
      const check = establishLog(engine, file, readSessionLog(engine, fs.readFileSync(file, 'utf8')), id);
      if (check.ok) established.push(file);
      else excluded.push({ log: file, reason: check.reason });
    }
    if (established.length === 1) return { log: established[0], session: id, basis: session ? 'given session' : 'environment', excluded };
    throw new Error(established.length > 1
      ? `${established.length} logs are established for session ${id}: ${established.join(', ')}`
      : `no log is established for session ${id} under ${root}${describe(excluded)}`);
  }
  if (!marker || marker.length < 16) {
    throw new Error('no session identity is available from the engine; print a marker with the marker command, then locate with --marker');
  }
  const found = [];
  for (const file of logFiles(engine, root)) {
    if (fs.statSync(file).mtimeMs < since) continue;
    const text = fs.readFileSync(file, 'utf8');
    if (!text.includes(marker)) continue;
    const observation = readSessionLog(engine, text);
    const fileId = sessionIdFromPath(engine, file);
    if (observation.identity !== 'root') {
      excluded.push({ log: file, reason: observation.reason });
    } else if (fileId !== null && fileId !== observation.session.toLowerCase()) {
      excluded.push({ log: file, reason: `it records session ${observation.session} but its file name carries ${fileId}` });
    } else {
      found.push({ file, session: observation.session });
    }
  }
  if (found.length === 1) return { log: found[0].file, session: found[0].session, basis: 'marker', excluded };
  throw new Error(found.length > 1
    ? `${found.length} root session logs contain the marker, so this session's log is ambiguous: ${found.map((entry) => entry.file).join(', ')}`
    : `no root session log modified in the window contains the marker${describe(excluded)}`);
}

function describe(excluded) {
  return excluded.length ? `; excluded: ${excluded.map(({ log, reason }) => `${log} (${reason})`).join('; ')}` : '';
}
