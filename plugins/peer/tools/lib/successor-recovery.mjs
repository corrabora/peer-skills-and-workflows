// Recovery evidence is an attributed assessment of retained runtime/operator
// sources. Validation binds scope and identities; it does not authenticate them.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const assert = (v, message) => { if (!v) throw new Error(`recovery: ${message}`); };
const text = (v) => typeof v === 'string' && v.trim().length > 0;
const same = (a, b) => a?.engine === b?.engine && a?.session === b?.session;
const sha = (v) => crypto.createHash('sha256').update(v).digest('hex');
function regular(file) {
  assert(typeof file === 'string' && path.isAbsolute(file), 'evidence paths must be absolute');
  assert(fs.lstatSync(file).isFile(), 'evidence must be a regular file, not a link');
  const bytes = fs.readFileSync(file); const value = bytes.toString('utf8');
  assert(text(value) && Buffer.from(value).equals(bytes), 'evidence must be nonempty UTF-8 text');
  return { value, bytes };
}
export function cancelledTitle(s, nonce = s.transfer?.nonce) {
  return `RETIRED — ${s.task} [${s.id.slice(0, 8)}] #${s.generation + 1} (cancelled ${nonce.slice(0, 8)})`;
}
export function readRecovery(s, descriptor) {
  assert(descriptor?.file === path.join(s.root, 'recovery', `${descriptor.sha256}.json`), 'invalid retained record location');
  const { value, bytes } = regular(descriptor.file);
  assert(sha(bytes) === descriptor.sha256 && bytes.length === descriptor.bytes, 'retained recovery evidence changed');
  const bundle = JSON.parse(value);
  assert(bundle.version === 1 && bundle.record?.chain === s.id, 'retained recovery record belongs to another chain');
  return bundle;
}
export function verifyRecoveryRetry(s, entry, file) {
  const bundle = readRecovery(s, entry.record);
  if (file !== undefined) assert(regular(file).value === bundle.sourceText,
    'this operation already committed with a different record; inspect state and use the next recovery step');
}

export function retainRecovery(s, caller, action, file, expectedTitles) {
  const input = regular(file); const r = JSON.parse(input.value); const t = s.transfer;
  assert(r.version === 1 && r.action === action && r.chain === s.id && r.nonce === t.nonce
    && r.generation === s.generation, 'record must name this action, chain, nonce and predecessor generation');
  assert(same(r.predecessor, s.owner) && text(r.predecessor.handle), 'record must identify the predecessor and its actual handle');
  assert(same(r.reporter, caller), 'record must identify the actual recovery caller');
  assert(text(r.runtime?.id) && text(r.runtime?.host) && text(r.observation?.at) && text(r.assessment),
    'retain runtime/host identity, observation time and an attributed assessment');
  assert(Array.isArray(r.evidence) && r.evidence.length > 0, 'retain the underlying evidence');
  const ids = new Set();
  const evidence = r.evidence.map((e) => {
    assert(text(e.id) && !ids.has(e.id), 'evidence ids must be unique'); ids.add(e.id);
    const { value, bytes } = regular(e.path);
    return { id: e.id, originalPath: e.path, sha256: sha(bytes), bytes: bytes.length, text: value };
  });
  const reference = (id) => assert(ids.has(id), `missing evidence reference ${id}`);
  reference(r.launchEvidence); reference(r.runtimeEvidence);
  const subject = r.successor;
  if (subject !== null) assert(['claude', 'codex'].includes(subject?.engine)
    && (subject.session === null || text(subject.session)) && text(subject.handle), 'identify the exact successor handle and known session');
  const decision = (owner) => {
    const d = r.decision;
    assert(d?.kind === 'operator-decision' && d.chain === s.id && d.nonce === t.nonce
      && d.action === action && same(d.predecessor, r.predecessor)
      && (subject === null ? d.successor === null : same(d.successor, subject) && d.successor.handle === subject.handle)
      && same(d.authorizedOwner, owner) && text(d.quote), 'explicit operator decision must bind this transfer, both identities and the authorized owner');
    reference(d.evidence);
    assert(![r.launchEvidence, r.runtimeEvidence, r.ui?.predecessor?.evidence, r.ui?.successor?.evidence].includes(d.evidence),
      'use a dedicated operator-decision evidence id, distinct from launch/runtime/UI observations');
    assert(evidence.find((e) => e.id === d.evidence).text.includes(d.quote), 'operator quote is absent from its named source');
  };
  const ui = (item, handle, title, closed = false) => {
    assert(item?.handle === handle && (item.state === 'visible' && item.title === title
      || closed && item.state === 'closed'), 'UI evidence must bind the exact handle and required visible title or verified closure');
    reference(item.evidence);
  };
  if (action === 'cancel-transfer') {
    assert(['not-launched', 'exited', 'live', 'unverifiable'].includes(r.observation.verdict), 'invalid successor liveness verdict');
    assert((r.observation.verdict === 'not-launched') === (subject === null), 'non-launch needs no successor; a launched/uncertain successor needs its exact handle');
    if (['live', 'unverifiable'].includes(r.observation.verdict)) decision(s.owner);
    else if (r.decision != null) decision(s.owner);
  } else if (action === 'resume-cancelled') {
    const prior = readRecovery(s, t.cancellation.record).record;
    const discovered = prior.successor === null && subject !== null;
    assert(prior.action === 'cancel-transfer' && prior.nonce === t.nonce && prior.generation === s.generation
      && same(prior.predecessor, s.owner) && r.predecessor.handle === prior.predecessor.handle && r.runtime.id === prior.runtime.id && r.runtime.host === prior.runtime.host
      && (discovered || (subject === null ? prior.successor === null : same(subject, prior.successor) && subject.handle === prior.successor?.handle)),
    'resume must reconcile the same runtime and exact cancelled participants');
    ui(r.ui?.predecessor, r.predecessor.handle, expectedTitles.current);
    if (subject) {
      assert(['exited', 'live', 'unverifiable'].includes(r.observation.verdict), 'observe the cancelled successor before resuming');
      if (discovered || r.observation.verdict !== 'exited' && prior.decision?.kind !== 'operator-decision') decision(s.owner);
      else if (r.decision != null) decision(s.owner);
      ui(r.ui?.successor, subject.handle, cancelledTitle(s), r.observation.verdict === 'exited');
    } else assert(r.observation.verdict === 'not-launched' && r.ui?.successor === null, 'non-launch resume must retain its absent successor');
  } else if (action === 'finish-transfer') {
    assert(same(subject, t.successor) && same(caller, t.successor), 'only the designated confirmed successor may finish');
    assert(['exited', 'unverifiable'].includes(r.observation.verdict), 'observe the disappeared predecessor; known-live predecessors must be reconciled first');
    decision(t.successor);
    ui(r.ui?.predecessor, r.predecessor.handle, expectedTitles.retired);
    ui(r.ui?.successor, subject.handle, expectedTitles.successor);
  } else throw new Error(`unknown recovery action ${action}`);
  if (s.runRoot && action !== 'cancel-transfer') {
    const expectedOwner = action === 'resume-cancelled' ? r.predecessor.handle : subject.handle;
    assert(text(r.coordinator?.runId) && r.coordinator.ownerHandle === expectedOwner
      && Number.isSafeInteger(r.coordinator.consumerGeneration) && r.coordinator.consumerGeneration >= 1,
    'reconcile and record the actual Run owner and consumer generation before resuming coordination');
    reference(r.coordinator.evidence);
  }

  const bundle = { version: 1, record: r, sourceText: input.value, evidence };
  const bytes = Buffer.from(`${JSON.stringify(bundle, null, 2)}\n`); const digest = sha(bytes);
  const dir = path.join(s.root, 'recovery'); fs.mkdirSync(dir, { recursive: true });
  assert(fs.lstatSync(dir).isDirectory() && !fs.lstatSync(dir).isSymbolicLink(), 'recovery directory cannot be a link');
  const target = path.join(dir, `${digest}.json`);
  if (fs.existsSync(target)) assert(regular(target).bytes.equals(bytes), 'retained recovery blob conflicts');
  else fs.writeFileSync(target, bytes, { flag: 'wx', mode: 0o600 });
  return { action, nonce: t.nonce, generation: s.generation, predecessor: s.owner, successor: subject,
    reporter: { engine: caller.engine, session: caller.session }, at: new Date().toISOString(),
    record: { file: target, sha256: digest, bytes: bytes.length } };
}
