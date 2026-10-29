// Task-scoped source evidence, kept separately from generated continuation prose.
// The log format establishes a message channel, not its human author or authority.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { establishLog, readSessionLog } from './succession.mjs';

const FORMAT = 'agent-workflow instruction sources';
const sha = (v) => crypto.createHash('sha256').update(v).digest('hex');
const assert = (v, message) => { if (!v) throw new Error(`instruction sources: ${message}`); };
const nonempty = (v) => typeof v === 'string' && v.trim().length > 0;
const integer = (v) => Number.isSafeInteger(v) && v >= 1;
function regular(file) {
  assert(fs.lstatSync(file).isFile(), `${file} must be a regular file, not a link`);
  return fs.readFileSync(file);
}

function compactBoundary(v) { return v?.type === 'system' && v.subtype === 'compact_boundary'; }
function ancestryRecord(v) {
  const field = (key) => Object.hasOwn(v, key) ? v[key] : { unavailable: true };
  return JSON.stringify([field('parentUuid'), compactBoundary(v),
    compactBoundary(v) ? [field('logicalParentUuid'), v.compactMetadata?.trigger, field('sessionId')] : null,
    v.isCompactSummary === true, v.isCompactSummary === true ? [field('promptId'), field('sessionId')] : null]);
}

// Claude starts a new physical chain at compaction. Only its boundary record
// can supply the logical edge; ordinary messages cannot override their parent.
function claudeParent(v, records, session) {
  if (compactBoundary(v) && Object.hasOwn(v, 'logicalParentUuid')) {
    return v.parentUuid === null && nonempty(v.logicalParentUuid) && v.sessionId === session
      ? v.logicalParentUuid : undefined;
  }
  const boundary = records.get(v.parentUuid);
  if (v.type === 'user' && v.isCompactSummary === true && nonempty(v.promptId)
    && v.sessionId === session && compactBoundary(boundary) && boundary.parentUuid === null
    && boundary.sessionId === session && boundary.compactMetadata?.trigger === 'manual'
    && nonempty(boundary.logicalParentUuid)) {
    // A manual /compact prompt can be a sibling of the boundary. Correlate
    // its preserved original text through the summary's prompt identity, not
    // the summary prose or the file's ordering. Ambiguous siblings stay gaps.
    const children = [...records.values()].filter((r) => r.parentUuid === boundary.logicalParentUuid
      && r.type === 'user' && r.isMeta !== true && r.isCompactSummary !== true
      && (typeof r.message?.content === 'string' || (Array.isArray(r.message?.content) && r.message.content.some((b) => b?.type === 'text'))));
    const command = children[0];
    if (children.length === 1 && command.sessionId === session && command.promptId === v.promptId
      && typeof command.message?.content === 'string' && /^\/compact(?:\s|$)/.test(command.message.content)) return command.uuid;
  }
  return v.parentUuid;
}

export function sourceMessages(caller, bytes, fromLine) {
  const text = bytes.toString('utf8');
  assert(Buffer.from(text).equals(bytes), 'log is not lossless UTF-8');
  const observed = readSessionLog(caller.engine, text, caller.log);
  const identity = establishLog(caller.engine, caller.log, observed, caller.session);
  assert(identity.ok && observed.startObserved, `root log beginning/identity is unavailable: ${identity.reason ?? 'truncated history'}`);
  const lines = text.split(/\r?\n/);
  const throughLine = lines.length - (lines.at(-1) === '' ? 1 : 0);
  assert(integer(fromLine) && fromLine <= throughLine, 'from-line must name an existing source line');
  const entries = []; const limitations = []; const ids = new Map(); const parents = new Map(); const records = new Map();
  for (let i = 0; i < throughLine; i++) {
    if (!lines[i].trim()) continue;
    const v = JSON.parse(lines[i]);
    assert(v && typeof v === 'object' && !Array.isArray(v), `invalid source record at line ${i + 1}`);
    if (caller.engine === 'claude' && nonempty(v.uuid) && v.isSidechain !== true) {
      const previous = records.get(v.uuid);
      if (i >= fromLine - 1 && previous && ancestryRecord(previous) !== ancestryRecord(v)) {
        limitations.push({ line: i + 1, reason: 'duplicate message identity has conflicting ancestry', entry: v.uuid,
          previousParent: previous.parentUuid === undefined ? { unavailable: true } : previous.parentUuid,
          parent: v.parentUuid === undefined ? { unavailable: true } : v.parentUuid,
          ...(compactBoundary(previous) || compactBoundary(v) ? {
            previousLogicalParent: previous.logicalParentUuid ?? null, logicalParent: v.logicalParentUuid ?? null,
          } : {}) });
      }
      parents.set(v.uuid, claudeParent(v, records, caller.session));
      records.set(v.uuid, v);
    }
    if (i < fromLine - 1) continue;
    let content; let eventId; let channel;
    if (caller.engine === 'codex') {
      // EventMsg::ThreadRolledBack in openai/codex protocol.rs is retained
      // for replay of older rollouts. Physical line order is not live history.
      if (v.type === 'event_msg' && v.payload?.type === 'thread_rolled_back') {
        limitations.push({ line: i + 1, reason: 'rolled-back conversation; active instruction history needs reconciliation', numTurns: v.payload.num_turns });
      }
      if (v.type !== 'response_item' || v.payload?.role !== 'user') continue;
      if (v.payload.type !== 'message') { limitations.push({ line: i + 1, reason: 'unknown user response item' }); continue; }
      content = v.payload.content; eventId = v.payload.id; channel = 'user-message';
    } else {
      if (v.isSidechain === true || v.isMeta === true || v.isCompactSummary === true) continue;
      if (v.type === 'user') { content = v.message?.content; channel = 'user-message'; }
      else if (v.type === 'attachment' && v.attachment?.type === 'queued_command') {
        content = v.attachment.prompt; channel = 'queued-command';
      } else continue;
      eventId = v.uuid ?? v.promptId;
    }
    let texts;
    if (typeof content === 'string') texts = [content];
    else if (Array.isArray(content)) {
      const textTypes = caller.engine === 'codex' ? ['input_text'] : ['text'];
      texts = content.filter((b) => textTypes.includes(b?.type) && typeof b.text === 'string').map((b) => b.text);
      const unsupported = content.filter((b) => !textTypes.includes(b?.type) && !(caller.engine === 'claude' && b?.type === 'tool_result'));
      if (unsupported.length) limitations.push({ line: i + 1, reason: 'non-text or unsupported input blocks', types: unsupported.map((b) => b?.type ?? 'unknown') });
      if (content.some((b) => textTypes.includes(b?.type) && typeof b.text !== 'string')) limitations.push({ line: i + 1, reason: 'malformed text block' });
      if (texts.length && content.some((b) => b?.type === 'tool_result')) limitations.push({ line: i + 1, reason: 'mixed tool result and text; origin needs reconciliation' });
    } else { limitations.push({ line: i + 1, reason: 'unrecognized message content' }); continue; }
    if (!texts.length) continue;
    const contentSha256 = sha(JSON.stringify(texts));
    const id = nonempty(eventId) ? eventId : `line-${i + 1}-${contentSha256}`;
    if (ids.has(id)) { assert(ids.get(id) === contentSha256, `event ${id} changed content`); continue; }
    const lineage = {};
    if (caller.engine === 'claude') {
      lineage.parentId = typeof v.parentUuid === 'string' ? v.parentUuid : null;
      lineage.ancestorInstructionIds = [];
      const visited = new Set([id]); let parent = v.parentUuid;
      while (typeof parent === 'string' && !visited.has(parent)) {
        visited.add(parent);
        if (ids.has(parent)) lineage.ancestorInstructionIds.push(parent);
        parent = parents.get(parent);
      }
      lineage.ancestryEnd = parent === null ? 'root' : typeof parent === 'string' ? 'cycle' : 'unresolved';
      if (lineage.ancestryEnd !== 'root' || (entries.length && !lineage.ancestorInstructionIds.includes(entries.at(-1).id))) {
        limitations.push({ line: i + 1, reason: 'branched or unresolved conversation ancestry; file order is not instruction authority', previousEntry: entries.at(-1)?.id ?? null, entry: id });
      }
    }
    ids.set(id, contentSha256);
    entries.push({ id, line: i + 1, channel, origin: 'unverified', ...lineage, texts, contentSha256 });
  }
  return { entries, limitations: limitations.map((v) => ({ ...v, id: sha(JSON.stringify({ session: caller.session, ...v })) })), throughLine };
}

function validate(s, packet) {
  assert(packet?.format === FORMAT && packet.version === 1 && packet.chain === s.id && Array.isArray(packet.segments) && packet.segments.length,
    'invalid source record format, chain or segments');
  for (const [i, segment] of packet.segments.entries()) {
    assert(segment.generation === i + 1 && ['claude', 'codex'].includes(segment.engine) && nonempty(segment.session)
      && path.isAbsolute(segment.log) && integer(segment.fromLine) && nonempty(segment.scope)
      && integer(segment.throughLine) && segment.throughLine >= segment.fromLine && integer(segment.throughBytes)
      && /^[a-f0-9]{64}$/.test(segment.prefixSha256) && Array.isArray(segment.entries) && Array.isArray(segment.limitations), 'invalid source segment');
    const known = [...s.retired, s.owner][i];
    assert(known && known.session === segment.session && known.engine === segment.engine && known.log === segment.log,
      'source segment does not belong to this chain generation');
    const seen = new Set();
    for (const entry of segment.entries) {
      assert(nonempty(entry.id) && !seen.has(entry.id) && integer(entry.line) && entry.line >= segment.fromLine && entry.line <= segment.throughLine
        && ['user-message', 'queued-command'].includes(entry.channel) && entry.origin === 'unverified'
        && Array.isArray(entry.texts) && entry.texts.length && entry.texts.every((v) => typeof v === 'string')
        && sha(JSON.stringify(entry.texts)) === entry.contentSha256, 'invalid source entry');
      seen.add(entry.id);
    }
  }
  for (const r of packet.reconciliations ?? []) {
    const segment = packet.segments.find((v) => v.generation === r.generation);
    const reporter = [...s.retired, s.owner][r.reporterGeneration - 1];
    assert(segment?.limitations.some((v) => v.id === r.limitationId) && nonempty(r.text) && nonempty(r.at)
      && reporter?.session === r.reporter?.session && reporter.engine === r.reporter.engine
      && r.kind === 'agent-assessment' && sha(r.text) === r.textSha256, 'invalid limitation reconciliation');
  }
  return packet;
}

export function readSources(s, descriptor = s.instructionSource) {
  assert(descriptor && /^[a-f0-9]{64}$/.test(descriptor.sha256) && descriptor.file === path.join(s.root, 'instructions', `${descriptor.sha256}.json`),
    'capture a scoped source record before transfer');
  const directory = fs.lstatSync(path.dirname(descriptor.file));
  assert(directory.isDirectory() && !directory.isSymbolicLink(), 'instruction directory must be a plain directory');
  const bytes = regular(descriptor.file);
  assert(bytes.length === descriptor.bytes && sha(bytes) === descriptor.sha256, 'source file differs from its retained identity');
  return { packet: validate(s, JSON.parse(bytes)), bytes };
}

// Called under the chain lock. Publish an immutable blob before the caller
// commits its pointer in state.json. A failed state save leaves only an orphan.
export function captureSources(s, { fromLine, scope } = {}) {
  const prior = s.instructionSource ? readSources(s).packet : { format: FORMAT, version: 1, chain: s.id, segments: [] };
  const last = prior.segments.at(-1);
  const same = last?.generation === s.generation;
  let scopeHistory = same ? last.scopeHistory ?? [] : [];
  assert(same || (last?.generation ?? 0) === s.generation - 1, 'earlier generations have no captured source; reconcile missing evidence');
  if (same) {
    assert(last.engine === s.owner.engine && last.session === s.owner.session && last.log === s.owner.log, 'capture owner differs from retained source');
    assert(fromLine === undefined || (integer(fromLine) && fromLine <= last.fromLine), 'cannot move a task boundary later and discard evidence');
    if (fromLine !== undefined && fromLine < last.fromLine) {
      assert(nonempty(scope), 'widening a task boundary requires a new scope rationale');
      scopeHistory = [...scopeHistory, { fromLine: last.fromLine, scope: last.scope, sourceSha256: s.instructionSource.sha256 }];
    } else {
      assert(scope === undefined || scope === last.scope, 'cannot rewrite the established scope rationale');
      fromLine = last.fromLine; scope = last.scope;
    }
  }
  assert(integer(fromLine) && nonempty(scope), 'first capture in each session requires --from-line and --scope describing the task boundary');
  const bytes = regular(s.owner.log);
  if (same) assert(bytes.length >= last.throughBytes && sha(bytes.subarray(0, last.throughBytes)) === last.prefixSha256,
    'the captured log prefix changed or was truncated; retained evidence is unchanged');
  const observed = sourceMessages(s.owner, bytes, fromLine);
  assert(observed.entries.length, 'no text messages in the selected range; inspect the source and task boundary');
  const excludedTextEntries = fromLine === 1 ? 0 : sourceMessages(s.owner, bytes, 1).entries.filter((v) => v.line < fromLine).length;
  const segment = { generation: s.generation, ...s.owner, fromLine, scope, scopeHistory, excludedTextEntries, throughBytes: bytes.length,
    prefixSha256: sha(bytes), ...observed };
  if (same) {
    // A newer adapter may resolve a formerly unknown edge. Keep historical
    // limitations and their assessments, just as we keep the original blobs.
    segment.limitations = [...last.limitations, ...segment.limitations.filter((v) => !last.limitations.some((old) => old.id === v.id))];
    const retained = segment.entries.filter((v) => v.line >= last.fromLine).slice(0, last.entries.length);
    // Widening exposes additional ancestry, but must preserve original text,
    // identities and locations. Earlier capture blobs remain unchanged.
    const original = ({ parentId, ancestorInstructionIds, ancestryEnd, ...v }) => v;
    assert(JSON.stringify(retained.map(original)) === JSON.stringify(last.entries.map(original)), 'previous source messages changed');
    for (const [i, old] of last.entries.entries()) for (const key of ['parentId', 'ancestryEnd']) {
      assert(!Object.hasOwn(old, key) || old[key] === retained[i][key], 'previous source ancestry changed');
    }
    if (s.owner.engine === 'claude' && last.entries.some((v, i) => !Object.hasOwn(v, 'parentId')
      || JSON.stringify(v.ancestorInstructionIds) !== JSON.stringify(retained[i].ancestorInstructionIds))) {
      segment.lineageEnrichedFrom = s.instructionSource.sha256;
    } else if (last.lineageEnrichedFrom) segment.lineageEnrichedFrom = last.lineageEnrichedFrom;
  }
  const packet = { ...prior, segments: [...prior.segments.slice(0, same ? -1 : undefined), segment] };
  return publishSources(s, packet);
}

function publishSources(s, packet) {
  validate(s, packet);
  const encoded = Buffer.from(`${JSON.stringify(packet, null, 2)}\n`);
  const digest = sha(encoded);
  const dir = path.join(s.root, 'instructions');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { mode: 0o700 });
  assert(fs.lstatSync(dir).isDirectory() && !fs.lstatSync(dir).isSymbolicLink(), 'instruction directory must be a plain directory');
  const file = path.join(dir, `${digest}.json`);
  if (fs.existsSync(file)) assert(regular(file).equals(encoded), 'source blob identity collision');
  else {
    const tmp = path.join(dir, `${crypto.randomUUID()}.tmp`);
    try { fs.writeFileSync(tmp, encoded, { flag: 'wx', mode: 0o600 }); fs.renameSync(tmp, file); }
    finally { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); }
  }
  return { file, sha256: digest, bytes: encoded.length };
}

export function reconcileSource(s, { generation, limitationId, resolutionFile }) {
  const { packet } = readSources(s);
  assert(packet.segments.find((v) => v.generation === generation)?.limitations.some((v) => v.id === limitationId), 'select an indexed generation and limitation-id');
  assert(typeof resolutionFile === 'string', 'provide a resolution-file containing the evidence, scope and next permitted action');
  const bytes = regular(path.resolve(resolutionFile)); const text = bytes.toString('utf8');
  assert(nonempty(text) && Buffer.from(text).equals(bytes), 'resolution must be nonempty lossless UTF-8');
  const reconciliation = { generation, limitationId, kind: 'agent-assessment', reporter: s.owner,
    reporterGeneration: s.generation, at: new Date().toISOString(), text, textSha256: sha(text) };
  return publishSources(s, { ...packet, reconciliations: [...(packet.reconciliations ?? []), reconciliation] });
}

export function freezeSources(s, dir) {
  const { packet, bytes } = readSources(s);
  assert(packet.segments.at(-1).generation === s.generation, 'capture this generation before transfer');
  assert(packet.segments.every((v) => v.limitations.every((l) => (packet.reconciliations ?? []).some((r) => r.generation === v.generation && r.limitationId === l.id))),
    'unsupported or ambiguous input remains; record source reconciliation before transfer');
  const file = path.join(dir, 'instructions.json');
  fs.writeFileSync(file, bytes, { flag: 'wx', mode: 0o600 });
  return { file, sha256: s.instructionSource.sha256, bytes: bytes.length };
}

export function verifyFrozenSources(s) {
  const d = s.transfer?.instructions;
  assert(d?.file === path.join(path.dirname(s.transfer.handoff), 'instructions.json') && d.sha256 === s.instructionSource?.sha256, 'transfer source identity is missing or inconsistent');
  const { bytes } = readSources(s);
  assert(regular(d.file).equals(bytes) && d.bytes === bytes.length, 'frozen instruction evidence changed');
  assert(sha(regular(s.transfer.handoff)) === s.transfer.handoffSha256, 'frozen handoff text changed');
  return d;
}

export function verifyCurrentSource(s) {
  const last = readSources(s).packet.segments.at(-1);
  assert(last.generation === s.generation, 'current generation has no source capture');
  const bytes = regular(s.owner.log);
  assert(bytes.length >= last.throughBytes && sha(bytes.subarray(0, last.throughBytes)) === last.prefixSha256, 'frozen source prefix changed or was truncated');
  const observed = sourceMessages(s.owner, bytes, last.fromLine);
  assert(JSON.stringify(observed.entries) === JSON.stringify(last.entries)
    && observed.limitations.every((v) => last.limitations.some((old) => JSON.stringify(old) === JSON.stringify(v))),
    'new input arrived after the source freeze; reconcile the handoff before transferring authority');
}
