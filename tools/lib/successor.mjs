// Retained succession chains. This module owns the v1 state and session-pointer
// formats. Unknown versions or invalid state are errors, never a fresh chain.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { canonicalLocation, hostContext, isWithin, LOCAL_DIRECTORY, localDirectory, machineBase } from './paths.mjs';
import { assessSuccession, establishLog, locateLog, mergeObservation, observationFor, readCounts, readSessionLog, writeCounts } from './succession.mjs';
import { captureSources, freezeSources, reconcileSource, verifyFrozenSources, verifyCurrentSource } from './successor-instructions.mjs';
import { cancelledTitle, retainRecovery, verifyRecoveryRetry } from './successor-recovery.mjs';

const FORMAT = 'agent-workflow succession chain';
const STATES = ['active', 'transferring', 'disabled', 'complete'];
const ID = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/;
const text = (v) => typeof v === 'string' && v.trim().length > 0;
const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const assert = (yes, message) => { if (!yes) throw new Error(message); };
const now = () => new Date().toISOString();
const uuid = () => crypto.randomUUID();
export const controlFile = (root) => path.join(root, 'state.json');
export function limits(compactions = 3, turns = 40) {
  for (const n of [compactions, turns]) assert(Number.isSafeInteger(n) && n > 0, 'thresholds must be positive safe integers');
  return { 'compaction-threshold': compactions, 'turn-threshold': turns };
}
function identity(v) {
  return object(v) && ['claude', 'codex'].includes(v.engine) && text(v.session) && ID.test(v.session)
    && typeof v.log === 'string' && path.isAbsolute(v.log);
}
function regular(file) {
  assert(fs.lstatSync(file).isFile(), `${file} must be a regular file, not a link`);
  return fs.readFileSync(file, 'utf8');
}
function atomic(file, value) {
  if (fs.existsSync(file)) regular(file);
  const tmp = `${file}.${uuid()}.tmp`;
  try {
    fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    fs.renameSync(tmp, file);
  } finally { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); }
}
export function readChain(root) {
  const file = controlFile(root);
  let s;
  try { s = JSON.parse(regular(file)); } catch (e) { throw new Error(`cannot read ${file}: ${e.message}; preserve and repair the record`); }
  assert(object(s) && s.format === FORMAT && s.version === 1, `${file}: unsupported succession format/version`);
  assert(text(s.id) && ID.test(s.id) && text(s.task) && !/[\r\n\x00-\x1f]/.test(s.task), `${file}: invalid chain identity/task`);
  assert(s.root === fs.realpathSync(root) && path.isAbsolute(s.workspace), `${file}: root/workspace identity mismatch`);
  assert(STATES.includes(s.status) && Number.isSafeInteger(s.generation) && s.generation >= 1, `${file}: invalid lifecycle`);
  assert(identity(s.owner) && Array.isArray(s.retired) && s.retired.every(identity), `${file}: invalid session identity`);
  assert(text(s.createdAt) && text(s.updatedAt) && object(s.thresholds), `${file}: missing timestamps/thresholds`);
  assert(Object.hasOwn(s.thresholds, 'compaction-threshold') && Object.hasOwn(s.thresholds, 'turn-threshold'), `${file}: missing threshold values`);
  limits(s.thresholds['compaction-threshold'], s.thresholds['turn-threshold']);
  assert(typeof s.counts === 'string' && path.isAbsolute(s.counts), `${file}: invalid counts path`);
  const allowedCounts = s.runRoot ? path.join(s.runRoot, 'control', 'coordinator-counts.json') : path.join(s.root, 'counts.json');
  assert(s.counts === allowedCounts, `${file}: unexpected counts path`);
  assert(s.runRoot === null || (path.isAbsolute(s.runRoot) && s.root === path.join(s.runRoot, 'control', 'successor')), `${file}: invalid Run root`);
  if (s.transfer !== null) {
    const t = s.transfer;
    assert(object(t) && text(t.nonce) && ID.test(t.nonce) && ['prepared', 'yielded', 'confirmed', 'cancelled'].includes(t.phase), `${file}: invalid transfer`);
    assert(s.status === 'transferring' && t.generation === s.generation + 1 && text(t.handoff), `${file}: transfer/lifecycle mismatch`);
    assert(t.handoff === path.join(s.root, 'handoffs', t.nonce, 'handoff.md'), `${file}: invalid handoff path`);
    assert(t.phase !== 'confirmed' || (identity(t.successor) && t.successor.session !== s.owner.session && text(t.confirmation)), `${file}: invalid confirmation`);
    assert(t.phase !== 'cancelled' || (t.cancellation?.action === 'cancel-transfer' && t.cancellation.nonce === t.nonce
      && s.recoveries?.some((r) => r.record?.sha256 === t.cancellation.record?.sha256)), `${file}: missing cancellation evidence`);
  } else assert(s.status !== 'transferring', `${file}: missing transfer`);
  if (s.recoveries !== undefined) assert(Array.isArray(s.recoveries) && s.recoveries.every((r) => object(r)
    && ['cancel-transfer', 'resume-cancelled', 'finish-transfer'].includes(r.action) && text(r.nonce) && ID.test(r.nonce)
    && Number.isSafeInteger(r.generation) && r.generation >= 1 && r.generation <= s.generation
    && identity(r.predecessor) && text(r.at) && /^[a-f0-9]{64}$/.test(r.record?.sha256)
    && r.record.file === path.join(s.root, 'recovery', `${r.record.sha256}.json`)
    && Number.isSafeInteger(r.record.bytes) && r.record.bytes > 0), `${file}: invalid recovery history`);
  if (s.lastRetirement !== undefined) {
    const r = s.lastRetirement;
    assert(object(r) && text(r.nonce) && ID.test(r.nonce) && r.generation === s.generation && r.generation >= 2,
      `${file}: invalid committed retirement`);
    assert(identity(r.predecessor) && identity(r.successor) && matches(r.successor, s.owner)
      && !matches(r.predecessor, r.successor) && s.retired.some((v) => matches(v, r.predecessor)),
    `${file}: retirement/owner mismatch`);
    const retiredTitle = titles({ ...s, generation: r.generation - 1 }).retired;
    // Earlier chains committed DEAD labels. Read their immutable history without
    // allowing that former label for a new retirement.
    assert(text(r.at) && [retiredTitle, retiredTitle.replace(/^RETIRED — /, 'DEAD — ')].includes(r.title),
      `${file}: invalid retirement title/time`);
  }
  return s;
}
function locked(root, action) {
  const lock = path.join(root, '.lock');
  let fd;
  try { fd = fs.openSync(lock, 'wx', 0o600); }
  catch (e) { throw new Error(`${lock}: ${e.code}; another state update may be active; inspect before removing a stale lock`); }
  try { fs.writeFileSync(fd, String(process.pid)); return action(); }
  finally { fs.closeSync(fd); fs.unlinkSync(lock); }
}
function save(s) { s.updatedAt = now(); atomic(controlFile(s.root), s); return s; }
function matches(a, b) { return a.engine === b.engine && a.session === b.session; }
function owner(s, caller) { assert(matches(s.owner, caller), 'only the recorded current owner can perform this action'); }
export function sessionPointer(engine, session, host = hostContext()) {
  assert(['claude', 'codex'].includes(engine) && typeof session === 'string' && ID.test(session), 'invalid engine/session');
  return path.join(machineBase(host), 'successions', 'sessions', `${engine}-${session}.json`);
}
export function lookup(engine, session, host = hostContext()) {
  const file = sessionPointer(engine, session, host);
  if (!fs.existsSync(file)) return null;
  const p = JSON.parse(regular(file));
  assert(p.version === 1 && p.engine === engine && p.session === session && path.isAbsolute(p.root), `${file}: invalid session pointer`);
  return readChain(p.root);
}
export function register(s, caller, host = hostContext()) {
  const existing = lookup(caller.engine, caller.session, host);
  assert(!existing || existing.id === s.id || ['disabled', 'complete'].includes(existing.status), 'this session already belongs to another active succession chain');
  const file = sessionPointer(caller.engine, caller.session, host);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  atomic(file, { version: 1, engine: caller.engine, session: caller.session, root: s.root });
}
// Callers may supply an explicit log after locate's marker fallback. Its root
// identity still has to match the caller; a parent's/subagent's log is refused.
export function currentSession({ engine, session, log, host = hostContext() }) {
  assert(['claude', 'codex'].includes(engine), 'engine must be claude or codex');
  const given = session ?? (engine === 'codex' ? host.env.CODEX_THREAD_ID || host.env.CODEX_SESSION_ID : host.env.CLAUDE_CODE_SESSION_ID);
  if (!log) {
    const found = locateLog({ engine, home: host.home, env: host.env, session: given });
    log = found.log; session = found.session;
  } else session = given;
  assert(text(session), 'current session identity is unavailable; use succession.mjs marker and locate, then supply --session and --log');
  log = fs.realpathSync(log);
  const observed = readSessionLog(engine, fs.readFileSync(log, 'utf8'), log);
  const established = establishLog(engine, log, observed, session);
  assert(established.ok, `cannot establish current session: ${established.reason}`);
  return { engine, session, log };
}
function localStorage(workspace) {
  const local = localDirectory(workspace);
  if (!fs.existsSync(local)) return false;
  assert(fs.lstatSync(local).isDirectory() && !fs.lstatSync(local).isSymbolicLink(), `${local} is not a plain directory`);
  const tracked = spawnSync('git', ['-C', workspace, 'ls-files', '--', LOCAL_DIRECTORY], { encoding: 'utf8' });
  const ignored = spawnSync('git', ['-C', workspace, 'check-ignore', '-q', '--', `${LOCAL_DIRECTORY}/`]);
  assert(tracked.status === 0 && tracked.stdout.trim() === '' && ignored.status === 0, `${local} must be wholly untracked and the directory itself ignored`);
  return true;
}
export function initialize({ caller, workspace, task, storage = 'auto', runRoot = null, compactions, turns, host = hostContext() }) {
  const thresholds = limits(compactions, turns);
  assert(text(task) && !/[\r\n\x00-\x1f]/.test(task), 'task must be a nonempty single-line title');
  assert(['auto', 'local', 'external'].includes(storage), 'storage must be auto, local or external');
  workspace = fs.realpathSync(workspace);
  const existing = lookup(caller.engine, caller.session, host);
  if (existing?.status === 'disabled' && existing.workspace === workspace && existing.task === task) {
    owner(existing, caller);
    return locked(existing.root, () => {
      const s = readChain(existing.root);
      assert(s.status === 'disabled', 'chain changed while re-enabling; inspect its current state');
      observeState(s); s.status = 'active'; return save(s);
    });
  }
  if (existing && !['disabled', 'complete'].includes(existing.status)) {
    assert(existing.workspace === workspace && existing.task === task, 'session already has a chain; use its root or disable it before starting another task');
    assert(existing.status === 'active', `chain is ${existing.status}; use its recorded recovery/continuation`);
    return existing; // Re-invocation never resets counts or overwrites policy.
  }
  const id = uuid();
  let root;
  if (runRoot) {
    runRoot = fs.realpathSync(runRoot);
    assert(localStorage(workspace) && isWithin(path.join(localDirectory(workspace), 'runs'), runRoot), 'Run records must be inside this checkout’s established local runs directory');
    root = path.join(runRoot, 'control', 'successor');
  } else {
    const local = storage !== 'external' && localStorage(workspace);
    assert(storage !== 'local' || local, 'local storage is not established; use external storage or establish the ignored directory first');
    root = local ? path.join(localDirectory(workspace), 'successions', id) : path.join(machineBase(host), 'successions', id);
  }
  assert(canonicalLocation(root) === root, `succession root crosses a symlink: ${root}`);
  assert(!fs.existsSync(controlFile(root)), `succession state already exists at ${root}; read it instead of reinitializing`);
  fs.mkdirSync(root, { recursive: true });
  const s = { format: FORMAT, version: 1, id, task, root, workspace, runRoot,
    counts: runRoot ? path.join(runRoot, 'control', 'coordinator-counts.json') : path.join(root, 'counts.json'),
    status: 'active', generation: 1, owner: caller, retired: [], transfer: null, thresholds, createdAt: now(), updatedAt: now() };
  return locked(root, () => { observeState(s); save(s); register(s, caller, host); return s; });
}
function observeState(s, caller = s.owner) {
  const before = readCounts(s.counts);
  const obs = observationFor(caller.engine, caller.log, fs.readFileSync(caller.log, 'utf8'), before);
  assert(obs.session === caller.session, 'observed log no longer belongs to the recorded session');
  const counts = mergeObservation(before, { engine: caller.engine, log: caller.log, observation: obs });
  writeCounts(s.counts, counts);
  return assessSuccession(counts, s.thresholds);
}
export function titles(s) {
  const label = `${s.task} [${s.id.slice(0, 8)}]`;
  return { current: `CURRENT — ${label} #${s.generation}`,
    successor: `STARTING — ${label} #${s.generation + 1}`,
    retired: `RETIRED — ${label} #${s.generation} → #${s.generation + 1}`,
    ...(s.transfer ? { cancelledSuccessor: cancelledTitle(s) } : {}) };
}
export function report(s) {
  const counts = readCounts(s.counts);
  // An observation may have persisted before a failed ownership commit.
  // State, not the most recently observed log, selects the current owner.
  const entry = counts.sessions.find((v) => v.session === s.owner.session);
  assert(entry?.engine === s.owner.engine && entry.log === s.owner.log, 'counts do not establish the committed owner');
  const countsReport = assessSuccession({ ...counts, current: s.owner.session }, s.thresholds);
  // Keep staged observations in the raw evidence, not in predecessor history.
  countsReport.earlierSessions = countsReport.earlierSessions.filter((v) => v.session !== s.transfer?.successor?.session);
  return { ...s, titles: titles(s), continuation: path.join(s.root, 'continuation.md'),
    countsReport };
}
function retirementReceipt(s) {
  const r = s.lastRetirement;
  atomic(path.join(s.root, 'handoffs', r.nonce, 'retirement.json'), r);
}
export function update(root, caller, action, options = {}, host = hostContext()) {
  return locked(root, () => {
    const s = readChain(root);
    if (action === 'resume-cancelled' && s.status === 'active' && s.lastCancellation?.nonce === options.nonce
      && s.lastCancellation.generation === s.generation) {
      owner(s, caller); verifyRecoveryRetry(s, s.lastCancellation, options.recordFile); return s;
    }
    if (action === 'finish-transfer' && s.lastRetirement?.nonce === options.nonce) {
      assert(s.lastRetirement.recovery?.action === 'finish-transfer' && matches(s.lastRetirement.successor, caller),
        'only the designated successor can retry its committed recovery receipt');
      assert(options.retiredTitle === s.lastRetirement.title, 'retry requires the committed RETIRED title');
      verifyRecoveryRetry(s, s.lastRetirement.recovery, options.recordFile); retirementReceipt(s); return s;
    }
    if (action === 'retire' && s.lastRetirement?.nonce === options.nonce) {
      assert(matches(s.lastRetirement.predecessor, caller), 'only the committed predecessor can retry its retirement receipt');
      assert(options.retiredTitle === s.lastRetirement.title, 'retry requires the committed RETIRED title');
      retirementReceipt(s);
      return s; // Repair a missing receipt; never repeat the ownership transition.
    }
    if (!['accept', 'finish-transfer'].includes(action)) owner(s, caller);
    if (action === 'capture') {
      assert(s.status === 'active', 'capture instructions only while active; reconcile an existing frozen transfer first');
      s.instructionSource = captureSources(s, options);
    } else if (action === 'reconcile-source') {
      assert(s.status === 'active', 'reconcile source limitations only while active; this does not recover a frozen transfer');
      s.instructionSource = reconcileSource(s, options);
    } else if (action === 'observe') {
      assert(s.status === 'active', `cannot observe as active owner while ${s.status}`);
      observeState(s);
    } else if (action === 'policy') {
      assert(s.status === 'active', 'change policy only while active');
      s.thresholds = limits(options.compactions ?? s.thresholds['compaction-threshold'], options.turns ?? s.thresholds['turn-threshold']);
      observeState(s);
    } else if (['disable', 'complete'].includes(action)) {
      assert(s.status === 'active', 'resolve the transfer before disabling or completing the chain');
      s.status = action === 'disable' ? 'disabled' : 'complete';
    } else if (action === 'prepare') {
      assert(s.status === 'active', 'a transfer already exists or the chain is inactive');
      observeState(s);
      s.instructionSource = captureSources(s);
      const content = regular(path.join(root, 'continuation.md'));
      assert(content.trim(), 'write the continuation record before preparing transfer');
      const nonce = uuid();
      const dir = path.join(root, 'handoffs', nonce);
      fs.mkdirSync(dir, { recursive: true });
      const instructions = freezeSources(s, dir);
      fs.writeFileSync(path.join(dir, 'handoff.md'), content, { flag: 'wx', mode: 0o600 });
      s.status = 'transferring';
      s.transfer = { nonce, phase: 'prepared', generation: s.generation + 1, handoff: path.join(dir, 'handoff.md'),
        handoffSha256: crypto.createHash('sha256').update(content).digest('hex'), instructions, successor: null, confirmation: null };
    } else if (action === 'cancel-transfer') {
      assert(s.transfer?.nonce === options.nonce && ['prepared', 'yielded', 'cancelled'].includes(s.transfer.phase),
        'cancel-transfer requires this prepared or yielded nonce; confirmed transfers cannot be cancelled');
      if (s.transfer.phase === 'cancelled') { verifyRecoveryRetry(s, s.transfer.cancellation, options.recordFile); return s; }
      const evidence = retainRecovery(s, caller, action, options.recordFile, titles(s));
      s.recoveries = [...(s.recoveries ?? []), evidence];
      s.transfer.cancellation = evidence;
      s.transfer.phase = 'cancelled'; // Invalidate accept before any return to task work.
    } else if (action === 'resume-cancelled') {
      assert(s.transfer?.nonce === options.nonce && s.transfer.phase === 'cancelled', 'resume-cancelled requires the invalidated transfer nonce');
      const evidence = retainRecovery(s, caller, action, options.recordFile, titles(s));
      // New input that prevented the old transfer is captured before work resumes.
      s.instructionSource = captureSources(s); observeState(s);
      s.recoveries = [...(s.recoveries ?? []), evidence]; s.lastCancellation = evidence;
      s.transfer = null; s.status = 'active';
    } else if (action === 'yield') {
      assert(s.transfer?.phase === 'prepared' && s.transfer.nonce === options.nonce, 'yield requires the prepared transfer nonce');
      verifyFrozenSources(s); verifyCurrentSource(s);
      s.transfer.phase = 'yielded';
    } else if (action === 'accept') {
      assert(s.transfer?.phase === 'yielded' && s.transfer.nonce === options.nonce, 'accept requires a yielded transfer with the matching nonce');
      assert(!matches(s.owner, caller) && !s.retired.some((r) => matches(r, caller)), 'a successor must be a fresh session');
      assert(!readCounts(s.counts).sessions.some((r) => r.session === caller.session), 'successor session was already used in this chain');
      assert(!(s.recoveries ?? []).some((r) => ['cancel-transfer', 'resume-cancelled'].includes(r.action) && matches(r.successor ?? {}, caller)), 'a cancelled successor must not be reused');
      const confirmation = path.join(path.dirname(s.transfer.handoff), 'confirmation.md');
      const instructions = verifyFrozenSources(s);
      const confirmationText = regular(confirmation);
      assert(confirmationText.includes(instructions.sha256), `record continuity, instruction-source digest and UI verification in ${confirmation} before accepting`);
      register(s, caller, host);
      s.transfer.successor = caller;
      s.transfer.confirmation = confirmation;
      s.transfer.confirmationSha256 = crypto.createHash('sha256').update(confirmationText).digest('hex');
      s.transfer.phase = 'confirmed';
    } else if (action === 'retire' || action === 'finish-transfer') {
      assert(s.transfer?.phase === 'confirmed' && s.transfer.nonce === options.nonce, 'retire requires the successor’s matching confirmation');
      assert(options.retiredTitle === titles(s).retired, 'verify the predecessor’s exact RETIRED title in Orca, then pass it with --retired-title');
      verifyFrozenSources(s); verifyCurrentSource(s);
      if (action === 'finish-transfer') {
        const confirmationText = regular(s.transfer.confirmation);
        assert(confirmationText.includes(s.transfer.instructions.sha256), 'confirmed instruction evidence is missing from the confirmation');
        assert(!s.transfer.confirmationSha256 || crypto.createHash('sha256').update(confirmationText).digest('hex') === s.transfer.confirmationSha256,
          'confirmed continuity text changed; reconcile it before recovery');
      }
      const recovery = action === 'finish-transfer' ? retainRecovery(s, caller, action, options.recordFile, titles(s)) : null;
      // All fallible log observation precedes the ownership commit. The counts
      // file may advance first; report() still selects the committed owner.
      observeState(s, s.transfer.successor);
      s.lastRetirement = { nonce: s.transfer.nonce, generation: s.transfer.generation,
        predecessor: s.owner, successor: s.transfer.successor, title: options.retiredTitle, at: now() };
      if (recovery) { s.lastRetirement.recovery = recovery; s.recoveries = [...(s.recoveries ?? []), recovery]; }
      s.retired.push(s.owner);
      s.owner = s.transfer.successor;
      s.generation = s.transfer.generation;
      s.transfer = null;
      s.status = 'active';
      save(s); // The sole ownership commit; the receipt below is derived evidence.
      retirementReceipt(s);
      return s;
    } else throw new Error(`unknown succession action ${action}`);
    return save(s);
  });
}

// Hook adapters only observe registered sessions and return reminders. They
// never launch/rename/close an agent or interpret task content as authority.
export function hook(engine, event, { host = hostContext(), skill } = {}) {
  assert(object(event) && text(event.session_id), 'hook input needs session_id');
  const name = event.hook_event_name;
  assert(['SessionStart', 'UserPromptSubmit', 'Stop'].includes(name), `unsupported hook event ${name}`);
  let s = lookup(engine, event.session_id, host);
  if (!s || ['disabled', 'complete'].includes(s.status)) return {};
  let message;
  let due = false;
  const caller = { engine, session: event.session_id };
  if (!matches(s.owner, caller) && !matches(s.transfer?.successor ?? {}, caller)) {
    message = `This session is retired from succession chain ${s.id}. Its current owner is ${s.owner.engine}/${s.owner.session}. Do not resume its task here. Records: ${s.root}.`;
  } else if (s.status === 'transferring') {
    message = `Succession transfer ${s.transfer.nonce} is ${s.transfer.phase}. Load ${skill}; read ${controlFile(s.root)}. `
      + (s.transfer.phase === 'cancelled' ? 'Follow references/recovery.md to reconcile UI and run resume-cancelled. Start no task work until that command commits the predecessor active again.'
        : 'Preserve the yield/confirmation/retirement boundary; start no task work until ownership transfers.');
  } else {
    try {
      if (event.transcript_path) assert(fs.realpathSync(event.transcript_path) === s.owner.log, 'hook transcript differs from the recorded session log');
      s = update(s.root, caller, 'observe', {}, host);
      const counts = report(s).countsReport;
      due = counts.due;
      message = `Succession ${s.id}, observed in the session log: ${counts.compactions.count}/${counts.compactions.threshold} compactions, ${counts.turns.count}/${counts.turns.threshold} turns${counts.lowerBound ? ' (known lower bound)' : ''}. `
        + `Load ${skill}; preserve ${path.join(s.root, 'continuation.md')}. `
        + (due ? 'Succession is due. Start no new work batch; prepare and transfer at the next safe checkpoint.'
          : name === 'Stop' ? 'Update the continuation record after consequential decisions.'
            : 'This hook can run before the current prompt or compaction is written to the log. Run the helper observe check in this session before task work; use that result to decide whether succession is due. Do not add to counts from this reminder.');
    } catch (e) {
      due = true;
      message = `Succession observation is unverified: ${e.message}. Load ${skill}; preserve ${s.root} and report the blocker before new work. Do not reset counts.`;
    }
  }
  if (name === 'Stop') return due && !event.stop_hook_active ? { decision: 'block', reason: message } : {};
  return { hookSpecificOutput: { hookEventName: name, additionalContext: message } };
}

export function hookConfig(engine, script, executable = process.execPath, platform = process.platform) {
  assert(['claude', 'codex'].includes(engine), 'engine must be claude or codex');
  const quote = (v) => {
    if (platform !== 'win32') return `'${v.replaceAll("'", "'\\''")}'`;
    assert(!/["%!^&<>|\r\n]/.test(v), 'Windows hook command path contains shell metacharacters; choose a safe installation path');
    return `"${v}"`;
  };
  const command = `${quote(executable)} ${quote(script)} hook --engine ${engine}`;
  return { hooks: Object.fromEntries(['SessionStart', 'UserPromptSubmit', 'Stop'].map((name) => [name, [{ hooks: [{ type: 'command', command }] }]])) };
}
