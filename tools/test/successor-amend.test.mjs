import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { after, test } from 'node:test';
import { initialize, readChain, report, titles, update } from '../lib/successor.mjs';
import { readSources, sourceMessages } from '../lib/successor-instructions.mjs';

// Post-freeze input is amended into the same transfer, never waived or rewritten.
const scratch = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'transfer-amend-')));
after(() => fs.rmSync(scratch, { recursive: true, force: true }));
const WAKE = 'You have 1 orchestration message. Run `orca orchestration check --run run_5c199c9f09d1`.';

function session(f, engine) {
  const session = crypto.randomUUID();
  const log = path.join(f.dir, engine === 'codex' ? `rollout-amend-${session}.jsonl` : `${session}.jsonl`);
  const caller = { engine, session, log };
  const records =
    engine === 'codex'
      ? [
          { type: 'session_meta', payload: { id: session, source: 'cli' } },
          { type: 'event_msg', payload: { type: 'task_started', turn_id: 'turn-1' } },
        ]
      : [];
  records.push(message(caller, 'task-start', 'Coordinate the Run; keep the draft unchanged.', null));
  fs.writeFileSync(log, records.map(JSON.stringify).join('\n') + '\n');
  return caller;
}
function message(c, id, text, parentUuid = 'task-start') {
  return c.engine === 'codex'
    ? { type: 'response_item', payload: { type: 'message', id, role: 'user', content: [{ type: 'input_text', text }] } }
    : {
        type: 'user',
        sessionId: c.session,
        uuid: id,
        parentUuid,
        message: { role: 'user', content: [{ type: 'text', text }] },
      };
}
function append(c, v) {
  fs.appendFileSync(c.log, JSON.stringify(v) + '\n');
}
function fixture(engine, { run = false } = {}) {
  const dir = fs.mkdtempSync(path.join(scratch, 'case-'));
  const workspace = path.join(dir, 'workspace');
  const home = path.join(dir, 'home');
  fs.mkdirSync(workspace);
  fs.mkdirSync(home);
  const host = { platform: process.platform, home, env: { LOCALAPPDATA: path.join(home, 'AppData') } };
  const f = { dir, workspace, host };
  f.caller = session(f, engine);
  if (run) {
    spawnSync('git', ['-C', workspace, 'init', '-q']);
    fs.appendFileSync(path.join(workspace, '.git', 'info', 'exclude'), '\n/.peer-skills-and-workflows/\n');
    f.runRoot = path.join(workspace, '.peer-skills-and-workflows', 'runs', 'run_5c199c9f09d1');
    fs.mkdirSync(path.join(f.runRoot, 'control'), { recursive: true });
  }
  f.state = initialize({ caller: f.caller, workspace, task: 'Coordinator transfer', host, runRoot: f.runRoot ?? null });
  update(f.state.root, f.caller, 'capture', { fromLine: 1, scope: 'This root session contains only this task.' }, host);
  fs.writeFileSync(path.join(f.state.root, 'continuation.md'), 'Coordinate the Run; wait for worker results.');
  f.s = update(f.state.root, f.caller, 'prepare', {}, host);
  f.nonce = f.s.transfer.nonce;
  return f;
}
function amendRecord(f, expectedRevision, extra = {}) {
  const file = path.join(f.dir, `amend-${expectedRevision}-${crypto.randomUUID()}.json`);
  fs.writeFileSync(
    file,
    JSON.stringify(
      {
        version: 1,
        action: 'amend-transfer',
        chain: f.s.id,
        nonce: f.nonce,
        generation: f.s.generation,
        expectedRevision,
        assessment: 'Routine Orca mailbox wake for the bound Run; the successor reconciles the mailbox itself.',
        nextAction: 'Continue the same transfer; no task work.',
        ...extra,
      },
      null,
      2,
    ),
  );
  return file;
}

function successor(f) {
  return session(f, f.caller.engine);
}
function confirm(f, s, text) {
  fs.writeFileSync(path.join(path.dirname(s.transfer.handoff), 'confirmation.md'), text);
}

for (const engine of ['claude', 'codex']) {
  test(`${engine}: exact reconfirm retry rejects changed frozen revision evidence`, () => {
    const f = fixture(engine);
    update(f.s.root, f.caller, 'yield', { nonce: f.nonce }, f.host);
    const next = successor(f);
    confirm(f, f.s, `Source ${f.s.transfer.instructions.sha256}; continuity and UI verified.`);
    update(f.s.root, next, 'accept', { nonce: f.nonce }, f.host);
    append(f.caller, message(f.caller, 'wake-integrity', WAKE));
    const amended = update(
      f.s.root,
      f.caller,
      'amend-transfer',
      { nonce: f.nonce, expectedRevision: 0, recordFile: amendRecord(f, 0) },
      f.host,
    );
    fs.writeFileSync(
      path.join(path.dirname(amended.transfer.handoff), 'revisions', '1', 'confirmation.md'),
      `Source ${amended.instructionSource.sha256}; wake-integrity: routine delivery; reconcile mailbox before task work.`,
    );
    const options = { nonce: f.nonce, revision: 1, expectedAcknowledgedRevision: 0 };
    update(f.s.root, next, 'reconfirm', options, f.host);
    const before = fs.readFileSync(path.join(f.s.root, 'state.json'));
    fs.appendFileSync(amended.transfer.amendments[0].source.file, '\n');
    assert.throws(() => update(f.s.root, next, 'reconfirm', options, f.host), /amendment evidence changed/);
    assert.deepEqual(fs.readFileSync(path.join(f.s.root, 'state.json')), before);
  });

  test(`${engine}: rejected CLI amendment exposes the limitation identity needed for assessment`, () => {
    const f = fixture(engine);
    append(
      f.caller,
      engine === 'codex'
        ? {
            type: 'response_item',
            payload: {
              type: 'message',
              id: 'needs-assessment',
              role: 'user',
              content: [{ type: 'input_image', image_url: 'data:' }],
            },
          }
        : {
            type: 'user',
            sessionId: f.caller.session,
            uuid: 'needs-assessment',
            parentUuid: 'task-start',
            message: { role: 'user', content: [{ type: 'image', source: {} }] },
          },
    );
    const [limitation] = sourceMessages(f.caller, fs.readFileSync(f.caller.log), 1).limitations;
    const rejected = cli(
      f,
      f.caller,
      'amend-transfer',
      '--nonce',
      f.nonce,
      '--expected-revision',
      '0',
      '--record-file',
      amendRecord(f, 0),
    );
    assert.equal(rejected.status, 1);
    assert.ok(
      rejected.stderr.includes(limitation.id),
      'CLI must expose the uncaptured limitation ID required by limitationAssessments',
    );
    assert.ok(rejected.stderr.includes(limitation.reason), 'CLI must identify what requires assessment');
    assert.equal(readChain(f.s.root).transfer.revision ?? 0, 0);
  });

  test(`${engine}: exact reconfirm retry preserves the committed acknowledgment after further input`, () => {
    const f = fixture(engine);
    update(f.s.root, f.caller, 'yield', { nonce: f.nonce }, f.host);
    const next = successor(f);
    confirm(f, f.s, `Source ${f.s.transfer.instructions.sha256}; continuity and UI verified.`);
    update(f.s.root, next, 'accept', { nonce: f.nonce }, f.host);
    append(f.caller, message(f.caller, 'wake-retry', WAKE));
    const amended = update(
      f.s.root,
      f.caller,
      'amend-transfer',
      { nonce: f.nonce, expectedRevision: 0, recordFile: amendRecord(f, 0) },
      f.host,
    );
    fs.writeFileSync(
      path.join(path.dirname(amended.transfer.handoff), 'revisions', '1', 'confirmation.md'),
      `Source ${amended.instructionSource.sha256}; wake-retry: routine delivery; reconcile mailbox before task work.`,
    );
    const options = { nonce: f.nonce, revision: 1, expectedAcknowledgedRevision: 0 };
    const committed = update(f.s.root, next, 'reconfirm', options, f.host);
    const before = fs.readFileSync(path.join(f.s.root, 'state.json'));
    append(f.caller, message(f.caller, 'operator-after-reconfirm', 'Wait for my decision.', 'wake-retry'));
    assert.deepEqual(update(f.s.root, next, 'reconfirm', options, f.host), committed);
    assert.deepEqual(fs.readFileSync(path.join(f.s.root, 'state.json')), before);
    assert.throws(
      () => update(f.s.root, f.caller, 'retire', { nonce: f.nonce, retiredTitle: titles(committed).retired }, f.host),
      /new input arrived/,
    );
  });

  test(`${engine}: state validation rejects inconsistent transfer revision and acknowledgment fields`, () => {
    const f = fixture(engine);
    update(f.s.root, f.caller, 'yield', { nonce: f.nonce }, f.host);
    confirm(f, f.s, `Source ${f.s.transfer.instructions.sha256}; continuity and UI verified.`);
    update(f.s.root, successor(f), 'accept', { nonce: f.nonce }, f.host);
    append(f.caller, message(f.caller, 'wake-state', WAKE));
    update(
      f.s.root,
      f.caller,
      'amend-transfer',
      { nonce: f.nonce, expectedRevision: 0, recordFile: amendRecord(f, 0) },
      f.host,
    );
    const file = path.join(f.s.root, 'state.json');
    const good = fs.readFileSync(file, 'utf8');
    for (const mutate of [
      (t) => {
        t.acknowledgedRevision = 2;
      },
      (t) => {
        t.revision = 2;
      },
      (t) => {
        t.amendments = [];
      },
      (t) => {
        t.acknowledgedRevision = -1;
      },
      (t) => {
        t.amendments[0].revision = 7;
      },
      (t) => {
        t.confirmations = [{ revision: 1, file: t.confirmation, sha256: 'x' }];
      },
    ]) {
      const s = JSON.parse(good);
      mutate(s.transfer);
      fs.writeFileSync(file, JSON.stringify(s));
      assert.throws(() => readChain(f.s.root), /revision|acknowledg|confirmation/);
    }
    fs.writeFileSync(file, good);
    assert.equal(readChain(f.s.root).transfer.revision, 1);
  });

  test(`${engine}: status identifies the next transfer actor and command across acknowledgment states`, () => {
    const f = fixture(engine);
    const expectNext = (s, actor, command) => assert.deepEqual(report(s).transfer.next, { actor, command });
    expectNext(f.s, 'predecessor', 'yield');
    const yielded = update(f.s.root, f.caller, 'yield', { nonce: f.nonce }, f.host);
    expectNext(yielded, 'successor', 'accept');
    const next = successor(f);
    confirm(f, f.s, `Source ${f.s.transfer.instructions.sha256}; continuity and UI verified.`);
    const accepted = update(f.s.root, next, 'accept', { nonce: f.nonce }, f.host);
    expectNext(accepted, 'predecessor', 'retire');
    append(f.caller, message(f.caller, 'wake-status', WAKE));
    const amended = update(
      f.s.root,
      f.caller,
      'amend-transfer',
      { nonce: f.nonce, expectedRevision: 0, recordFile: amendRecord(f, 0) },
      f.host,
    );
    expectNext(amended, 'successor', 'reconfirm');
    assert.equal(report(amended).transfer.revision, 1);
    assert.equal(report(amended).transfer.acknowledgedRevision, 0);
    fs.writeFileSync(
      path.join(path.dirname(amended.transfer.handoff), 'revisions', '1', 'confirmation.md'),
      `Source ${amended.instructionSource.sha256}; wake-status: routine delivery; reconcile the mailbox.`,
    );
    const reconfirmed = update(
      f.s.root,
      next,
      'reconfirm',
      { nonce: f.nonce, revision: 1, expectedAcknowledgedRevision: 0 },
      f.host,
    );
    expectNext(reconfirmed, 'predecessor', 'retire');
  });

  for (const failure of ['record', 'state'])
    test(`${engine}: retry repairs amendment interrupted at ${failure} publication`, () => {
      const f = fixture(engine);
      const original = fs.readFileSync(f.s.transfer.instructions.file);
      append(f.caller, message(f.caller, 'wake-interrupted', WAKE));
      const options = { nonce: f.nonce, expectedRevision: 0, recordFile: amendRecord(f, 0) };
      const write = fs.writeFileSync;
      const rename = fs.renameSync;
      let injected = false;
      try {
        if (failure === 'record')
          fs.writeFileSync = (file, ...args) => {
            if (String(file).endsWith(`${path.sep}record.json`)) {
              injected = true;
              throw new Error('injected record publication failure');
            }
            return write(file, ...args);
          };
        else
          fs.renameSync = (from, to) => {
            if (to === path.join(f.s.root, 'state.json')) {
              injected = true;
              throw new Error('injected state publication failure');
            }
            return rename(from, to);
          };
        assert.throws(
          () => update(f.s.root, f.caller, 'amend-transfer', options, f.host),
          /injected .* publication failure/,
        );
      } finally {
        fs.writeFileSync = write;
        fs.renameSync = rename;
      }
      assert.equal(injected, true);
      assert.equal(readChain(f.s.root).transfer.revision ?? 0, 0);
      const retried = update(f.s.root, f.caller, 'amend-transfer', options, f.host);
      assert.equal(retried.transfer.revision, 1);
      assert.equal(retried.transfer.amendments.length, 1);
      assert.deepEqual(retried.transfer.amendments[0].newEntryIds, ['wake-interrupted']);
      assert.deepEqual(fs.readFileSync(f.s.transfer.instructions.file), original);
      assert.deepEqual(update(f.s.root, f.caller, 'amend-transfer', options, f.host), retried);
      assert.equal(update(f.s.root, f.caller, 'yield', { nonce: f.nonce }, f.host).transfer.phase, 'yielded');
    });

  test(`${engine}: acknowledgment must name each newly assessed limitation, not only text entries`, () => {
    const f = fixture(engine);
    update(f.s.root, f.caller, 'yield', { nonce: f.nonce }, f.host);
    append(
      f.caller,
      engine === 'codex'
        ? {
            type: 'response_item',
            payload: {
              type: 'message',
              id: 'only-image',
              role: 'user',
              content: [{ type: 'input_image', image_url: 'data:' }],
            },
          }
        : {
            type: 'user',
            sessionId: f.caller.session,
            uuid: 'only-image',
            parentUuid: 'task-start',
            message: { role: 'user', content: [{ type: 'image', source: {} }] },
          },
    );
    const [limitation] = sourceMessages(f.caller, fs.readFileSync(f.caller.log), 1).limitations;
    const s = update(
      f.s.root,
      f.caller,
      'amend-transfer',
      {
        nonce: f.nonce,
        expectedRevision: 0,
        recordFile: amendRecord(f, 0, {
          limitationAssessments: [{ limitationId: limitation.id, text: 'Image unreadable; wait for the operator.' }],
        }),
      },
      f.host,
    );
    assert.deepEqual(s.transfer.amendments[0].newLimitationIds, [limitation.id]);
    const next = successor(f);
    confirm(f, s, `Revision 1 source ${s.instructionSource.sha256}; no new text entries.`);
    assert.throws(() => update(f.s.root, next, 'accept', { nonce: f.nonce }, f.host), new RegExp(limitation.id));
    confirm(
      f,
      s,
      `Revision 1 source ${s.instructionSource.sha256}; limitation ${limitation.id}: unresolved-waiting; ask the operator to restate the image.`,
    );
    assert.equal(update(f.s.root, next, 'accept', { nonce: f.nonce }, f.host).transfer.acknowledgedRevision, 1);
  });

  test(`${engine}: an assessed non-text-only input can amend without inventing a text entry`, () => {
    const f = fixture(engine);
    const image =
      engine === 'codex'
        ? {
            type: 'response_item',
            payload: {
              type: 'message',
              id: 'image-only',
              role: 'user',
              content: [{ type: 'input_image', image_url: 'data:' }],
            },
          }
        : {
            type: 'user',
            sessionId: f.caller.session,
            uuid: 'image-only',
            parentUuid: 'task-start',
            message: { role: 'user', content: [{ type: 'image', source: {} }] },
          };
    append(f.caller, image);
    const [limitation] = sourceMessages(f.caller, fs.readFileSync(f.caller.log), 1).limitations;
    const s = update(
      f.s.root,
      f.caller,
      'amend-transfer',
      {
        nonce: f.nonce,
        expectedRevision: 0,
        recordFile: amendRecord(f, 0, {
          limitationAssessments: [
            {
              limitationId: limitation.id,
              text: 'Unresolved input: successor waits for operator restatement before task work.',
            },
          ],
        }),
      },
      f.host,
    );
    assert.equal(s.transfer.revision, 1);
    assert.deepEqual(s.transfer.amendments[0].newEntryIds, []);
    const { packet } = readSources(s);
    assert.ok(packet.reconciliations.some((v) => v.limitationId === limitation.id && v.transfer?.nonce === f.nonce));
    assert.equal(update(f.s.root, f.caller, 'yield', { nonce: f.nonce }, f.host).transfer.phase, 'yielded');
  });

  test(`${engine}: unsupported post-freeze input needs a transfer-scoped assessment bound to the amendment`, () => {
    const f = fixture(engine);
    update(f.s.root, f.caller, 'yield', { nonce: f.nonce }, f.host);
    const image =
      engine === 'codex'
        ? {
            type: 'response_item',
            payload: {
              type: 'message',
              id: 'pasted',
              role: 'user',
              content: [
                { type: 'input_text', text: 'See attached.' },
                { type: 'input_image', image_url: 'data:' },
              ],
            },
          }
        : {
            type: 'user',
            sessionId: f.caller.session,
            uuid: 'pasted',
            parentUuid: 'task-start',
            message: {
              role: 'user',
              content: [
                { type: 'text', text: 'See attached.' },
                { type: 'image', source: {} },
              ],
            },
          };
    append(f.caller, image);
    const [limitation] = sourceMessages(f.caller, fs.readFileSync(f.caller.log), 1).limitations;
    assert.ok(limitation);
    assert.throws(
      () =>
        update(
          f.s.root,
          f.caller,
          'amend-transfer',
          { nonce: f.nonce, expectedRevision: 0, recordFile: amendRecord(f, 0) },
          f.host,
        ),
      /limitation/,
    );
    assert.throws(
      () =>
        update(
          f.s.root,
          f.caller,
          'amend-transfer',
          {
            nonce: f.nonce,
            expectedRevision: 0,
            recordFile: amendRecord(f, 0, {
              limitationAssessments: [{ limitationId: 'unknown', text: 'Not a real limitation.' }],
            }),
          },
          f.host,
        ),
      /limitation/,
    );
    const text = 'The image is unavailable to the successor; the task waits for the operator to restate it.';
    const s = update(
      f.s.root,
      f.caller,
      'amend-transfer',
      {
        nonce: f.nonce,
        expectedRevision: 0,
        recordFile: amendRecord(f, 0, { limitationAssessments: [{ limitationId: limitation.id, text }] }),
      },
      f.host,
    );
    const { packet } = readSources(s);
    const r = packet.reconciliations.find((v) => v.limitationId === limitation.id);
    assert.equal(r.text, text);
    assert.equal(r.kind, 'agent-assessment');
    assert.equal(r.transfer?.nonce, f.nonce);
    assert.equal(r.transfer?.revision, 1);
    assert.deepEqual(
      packet.segments.at(-1).limitations.map((v) => v.id),
      [limitation.id],
    );
  });
}

for (const engine of ['claude', 'codex']) {
  for (const changed of ['original', 'reconfirmation'])
    test(`${engine}: retirement refuses changed ${changed} evidence after reconfirmation`, () => {
      const f = fixture(engine);
      update(f.s.root, f.caller, 'yield', { nonce: f.nonce }, f.host);
      const next = successor(f);
      confirm(f, f.s, `Read ${f.s.transfer.instructions.sha256}; continuity and UI verified.`);
      const accepted = update(f.s.root, next, 'accept', { nonce: f.nonce }, f.host);
      append(f.caller, message(f.caller, 'wake-confirmed', WAKE));
      const amended = update(
        f.s.root,
        f.caller,
        'amend-transfer',
        { nonce: f.nonce, expectedRevision: 0, recordFile: amendRecord(f, 0) },
        f.host,
      );
      const revisedFile = path.join(path.dirname(amended.transfer.handoff), 'revisions', '1', 'confirmation.md');
      fs.writeFileSync(
        revisedFile,
        `Source ${amended.instructionSource.sha256}; wake-confirmed: routine delivery; reconcile mailbox before task work.`,
      );
      const reconfirmed = update(
        f.s.root,
        next,
        'reconfirm',
        { nonce: f.nonce, revision: 1, expectedAcknowledgedRevision: 0 },
        f.host,
      );
      fs.appendFileSync(
        changed === 'original' ? accepted.transfer.confirmation : revisedFile,
        '\nAltered after acknowledgment: task work may proceed without review.',
      );
      assert.throws(
        () =>
          update(f.s.root, f.caller, 'retire', { nonce: f.nonce, retiredTitle: titles(reconfirmed).retired }, f.host),
        /confirmation.*changed|confirmed.*changed/,
      );
      assert.equal(readChain(f.s.root).generation, 1);
    });

  test(`${engine}: only the designated successor reconfirms the current revision, then the same transfer retires once`, () => {
    const f = fixture(engine);
    update(f.s.root, f.caller, 'yield', { nonce: f.nonce }, f.host);
    const next = successor(f);
    confirm(f, f.s, `Read ${f.s.transfer.instructions.sha256}; continuity and UI verified.`);
    const accepted = update(f.s.root, next, 'accept', { nonce: f.nonce }, f.host);
    const originalConfirmation = fs.readFileSync(accepted.transfer.confirmation);
    append(f.caller, message(f.caller, 'wake-confirmed', WAKE));
    const amended = update(
      f.s.root,
      f.caller,
      'amend-transfer',
      { nonce: f.nonce, expectedRevision: 0, recordFile: amendRecord(f, 0) },
      f.host,
    );
    const revised = amended.transfer.amendments[0].source.sha256;
    const file = path.join(path.dirname(amended.transfer.handoff), 'revisions', '1', 'confirmation.md');
    const options = { nonce: f.nonce, revision: 1, expectedAcknowledgedRevision: 0 };
    fs.writeFileSync(file, `Revision 1 source ${revised}.`);
    assert.throws(() => update(f.s.root, next, 'reconfirm', options, f.host), /wake-confirmed/);
    fs.writeFileSync(
      file,
      `Revision 1 source ${revised}; wake-confirmed: routine delivery; reconcile the Run mailbox before task work.`,
    );
    assert.throws(() => update(f.s.root, f.caller, 'reconfirm', options, f.host), /designated successor/);
    assert.throws(() => update(f.s.root, successor(f), 'reconfirm', options, f.host), /designated successor/);
    assert.throws(
      () => update(f.s.root, next, 'reconfirm', { ...options, revision: 0 }, f.host),
      /current transfer revision/,
    );
    const reconfirmed = update(f.s.root, next, 'reconfirm', options, f.host);
    assert.equal(reconfirmed.transfer.phase, 'confirmed');
    assert.equal(reconfirmed.transfer.acknowledgedRevision, 1);
    assert.deepEqual(fs.readFileSync(accepted.transfer.confirmation), originalConfirmation);
    assert.deepEqual(
      reconfirmed.transfer.confirmations.map((v) => v.revision),
      [0, 1],
    );
    const retired = update(
      f.s.root,
      f.caller,
      'retire',
      { nonce: f.nonce, retiredTitle: titles(reconfirmed).retired },
      f.host,
    );
    assert.equal(retired.generation, 2);
    assert.deepEqual(retired.owner, next);
    assert.equal(retired.lastRetirement.nonce, f.nonce);
  });

  test(`${engine}: confirmed amendment preserves participants and blocks retirement on the old acknowledgment`, () => {
    const f = fixture(engine);
    update(f.s.root, f.caller, 'yield', { nonce: f.nonce }, f.host);
    const next = successor(f);
    confirm(f, f.s, `Read ${f.s.transfer.instructions.sha256}; continuity and UI verified.`);
    const accepted = update(f.s.root, next, 'accept', { nonce: f.nonce }, f.host);
    const originalConfirmation = fs.readFileSync(accepted.transfer.confirmation);
    append(f.caller, message(f.caller, 'wake-confirmed', WAKE));
    const amended = update(
      f.s.root,
      f.caller,
      'amend-transfer',
      { nonce: f.nonce, expectedRevision: 0, recordFile: amendRecord(f, 0) },
      f.host,
    );
    assert.equal(amended.transfer.phase, 'confirmed');
    assert.deepEqual(amended.transfer.successor, next);
    assert.deepEqual(amended.owner, accepted.owner);
    assert.equal(amended.transfer.nonce, f.nonce);
    assert.equal(amended.transfer.revision, 1);
    assert.equal(amended.transfer.acknowledgedRevision, 0);
    assert.deepEqual(fs.readFileSync(amended.transfer.confirmation), originalConfirmation);
    assert.throws(
      () => update(f.s.root, f.caller, 'retire', { nonce: f.nonce, retiredTitle: titles(amended).retired }, f.host),
      /acknowledg|reconfirm/,
    );
    assert.equal(readChain(f.s.root).generation, 1);
  });

  test(`${engine}: a wake after yield is amended, and first accept must acknowledge that revision and its new entries`, () => {
    const f = fixture(engine);
    update(f.s.root, f.caller, 'yield', { nonce: f.nonce }, f.host);
    append(f.caller, message(f.caller, 'wake-1', WAKE));
    const s = update(
      f.s.root,
      f.caller,
      'amend-transfer',
      { nonce: f.nonce, expectedRevision: 0, recordFile: amendRecord(f, 0) },
      f.host,
    );
    assert.equal(s.transfer.phase, 'yielded');
    const next = successor(f);
    const revised = s.transfer.amendments[0].source.sha256;
    confirm(f, s, `Read original source ${s.transfer.instructions.sha256}; wake-1 is routine delivery.`);
    assert.throws(() => update(f.s.root, next, 'accept', { nonce: f.nonce }, f.host), /source digest/);
    confirm(f, s, `Read revision 1 source ${revised}.`);
    assert.throws(() => update(f.s.root, next, 'accept', { nonce: f.nonce }, f.host), /wake-1/);
    confirm(
      f,
      s,
      `Read revision 1 source ${revised}; wake-1: routine delivery; reconcile the Run mailbox before task work.`,
    );
    const accepted = update(f.s.root, next, 'accept', { nonce: f.nonce }, f.host);
    assert.equal(accepted.transfer.phase, 'confirmed');
    assert.equal(accepted.transfer.acknowledgedRevision, 1);
  });

  test(`${engine}: exact amendment retry returns its committed revision despite later source input`, () => {
    const f = fixture(engine);
    append(f.caller, message(f.caller, 'wake-1', WAKE));
    const recordFile = amendRecord(f, 0);
    const options = { nonce: f.nonce, expectedRevision: 0, recordFile };
    const committed = update(f.s.root, f.caller, 'amend-transfer', options, f.host);
    const stateBytes = fs.readFileSync(path.join(f.s.root, 'state.json'));
    append(f.caller, message(f.caller, 'operator-2', 'Wait for my decision before task work.', 'wake-1'));
    const retry = update(f.s.root, f.caller, 'amend-transfer', options, f.host);
    assert.deepEqual(retry, committed);
    assert.deepEqual(fs.readFileSync(path.join(f.s.root, 'state.json')), stateBytes);
    assert.throws(() => update(f.s.root, f.caller, 'yield', { nonce: f.nonce }, f.host), /new input arrived/);
  });

  test(`${engine}: a mailbox wake after prepare is amended into the same nonce without changing the original freeze`, () => {
    const f = fixture(engine);
    const original = fs.readFileSync(f.s.transfer.instructions.file);
    append(f.caller, message(f.caller, 'wake-1', WAKE));
    assert.throws(() => update(f.s.root, f.caller, 'yield', { nonce: f.nonce }, f.host), /new input arrived/);
    const s = update(
      f.s.root,
      f.caller,
      'amend-transfer',
      { nonce: f.nonce, expectedRevision: 0, recordFile: amendRecord(f, 0) },
      f.host,
    );
    assert.equal(s.transfer.nonce, f.nonce);
    assert.equal(s.transfer.phase, 'prepared');
    assert.equal(s.transfer.revision, 1);
    assert.equal(s.transfer.amendments.length, 1);
    assert.deepEqual(s.transfer.amendments[0].newEntryIds, ['wake-1']);
    assert.equal(
      s.transfer.amendments[0].source.file,
      path.join(path.dirname(s.transfer.handoff), 'revisions', '1', 'instructions.json'),
    );
    assert.ok(fs.readFileSync(f.s.transfer.instructions.file).equals(original));
    assert.equal(update(f.s.root, f.caller, 'yield', { nonce: f.nonce }, f.host).transfer.phase, 'yielded');
  });
}

// Orca notice shapes: the counted form observed in the issue (Codex, 2026-11-04)
// and the two templates in the installed orcad bundle. Fixtures, not live runs.
const NOTICES = [
  WAKE,
  'You have new orchestration messages. Read them with the `check` command above, then continue.',
  'You have new orchestration messages. They arrive next, one at a time; act on each.',
];
const helper = fileURLToPath(new URL('../successor.mjs', import.meta.url));
function cli(f, c, ...args) {
  const r = spawnSync(
    process.execPath,
    [helper, ...args, '--root', f.s.root, '--engine', c.engine, '--session', c.session],
    { encoding: 'utf8', env: { ...process.env, HOME: f.host.home, LOCALAPPDATA: f.host.env.LOCALAPPDATA } },
  );
  return { ...r, json: r.status === 0 ? JSON.parse(r.stdout) : null };
}

for (const engine of ['claude', 'codex']) {
  test(`${engine}: CLI completes one transfer through wakes at every phase with one successor and one ownership increment`, () => {
    const f = fixture(engine);
    const next = successor(f);
    const handoffDir = path.dirname(f.s.transfer.handoff);
    let revision = 0;
    let n = 0;
    const amend = () => {
      n++;
      append(
        f.caller,
        message(f.caller, `wake-${n}`, NOTICES[(n - 1) % NOTICES.length], n === 1 ? 'task-start' : `wake-${n - 1}`),
      );
      const r = cli(
        f,
        f.caller,
        'amend-transfer',
        '--nonce',
        f.nonce,
        '--expected-revision',
        String(revision),
        '--record-file',
        amendRecord(f, revision),
      );
      assert.equal(r.status, 0, r.stderr);
      revision++;
      assert.equal(r.json.transfer.revision, revision);
      return r.json;
    };
    amend(); // prepared
    assert.equal(cli(f, f.caller, 'yield', '--nonce', f.nonce).status, 0);
    let s = amend(); // yielded
    fs.writeFileSync(
      path.join(handoffDir, 'confirmation.md'),
      `Source ${s.instructionSource.sha256}; wake-1, wake-2: routine delivery; mailbox reconciled.`,
    );
    const accepted = spawnSync(
      process.execPath,
      [
        helper,
        'accept',
        '--root',
        f.s.root,
        '--engine',
        engine,
        '--session',
        next.session,
        '--log',
        next.log,
        '--nonce',
        f.nonce,
      ],
      { encoding: 'utf8', env: { ...process.env, HOME: f.host.home } },
    );
    assert.equal(accepted.status, 0, accepted.stderr);
    s = amend(); // confirmed
    const blocked = cli(f, f.caller, 'retire', '--nonce', f.nonce, '--retired-title', s.titles.retired);
    assert.equal(blocked.status, 1);
    assert.match(blocked.stderr, /reconfirm/);
    fs.writeFileSync(
      path.join(handoffDir, 'revisions', '3', 'confirmation.md'),
      `Source ${s.instructionSource.sha256}; wake-3: routine delivery.`,
    );
    const reconfirmed = cli(
      f,
      next,
      'reconfirm',
      '--nonce',
      f.nonce,
      '--revision',
      '3',
      '--expected-acknowledged-revision',
      '2',
    );
    assert.equal(reconfirmed.status, 0, reconfirmed.stderr);
    const retired = cli(f, f.caller, 'retire', '--nonce', f.nonce, '--retired-title', s.titles.retired);
    assert.equal(retired.status, 0, retired.stderr);
    assert.equal(retired.json.generation, 2);
    assert.deepEqual(retired.json.owner.session, next.session);
    assert.equal(retired.json.lastRetirement.nonce, f.nonce);
    assert.equal(retired.json.retired.length, 1);
  });
}

// Simulated Run evidence: the helper never reads Orca. This shows a Run-stored
// chain keeps its Run, counts and delivery accounting through amended transfer.
for (const engine of ['claude', 'codex']) {
  test(`${engine}: a Run-stored coordinator chain finishes the same transfer with live-worker wakes and retained delivery identities`, () => {
    const f = fixture(engine, { run: true });
    const next = successor(f);
    const handoffDir = path.dirname(f.s.transfer.handoff);
    const deliveries = path.join(f.runRoot, 'control', 'simulated-deliveries.json');
    const pending = {
      runId: 'run_5c199c9f09d1',
      consumerGeneration: 40,
      pending: ['msg_adjudicator_a', 'msg_adjudicator_b'],
    };
    fs.writeFileSync(deliveries, JSON.stringify(pending));
    const before = fs.readFileSync(deliveries);
    update(f.s.root, f.caller, 'yield', { nonce: f.nonce }, f.host);
    confirm(
      f,
      f.s,
      `Source ${f.s.transfer.instructions.sha256}; Run run_5c199c9f09d1 owner consumer 40; recovered msg_adjudicator_a, msg_adjudicator_b.`,
    );
    update(f.s.root, next, 'accept', { nonce: f.nonce }, f.host);
    append(f.caller, message(f.caller, 'wake-a', WAKE, 'task-start'));
    append(f.caller, message(f.caller, 'wake-b', WAKE, 'wake-a'));
    const amended = update(
      f.s.root,
      f.caller,
      'amend-transfer',
      { nonce: f.nonce, expectedRevision: 0, recordFile: amendRecord(f, 0) },
      f.host,
    );
    assert.deepEqual(amended.transfer.amendments[0].newEntryIds, ['wake-a', 'wake-b']);
    fs.writeFileSync(
      path.join(handoffDir, 'revisions', '1', 'confirmation.md'),
      `Source ${amended.instructionSource.sha256}; wake-a, wake-b: routine delivery for msg_adjudicator_a, msg_adjudicator_b already recovered.`,
    );
    update(f.s.root, next, 'reconfirm', { nonce: f.nonce, revision: 1, expectedAcknowledgedRevision: 0 }, f.host);
    const retired = update(
      f.s.root,
      f.caller,
      'retire',
      { nonce: f.nonce, retiredTitle: titles(amended).retired },
      f.host,
    );
    assert.equal(retired.runRoot, f.state.runRoot);
    assert.equal(retired.counts, path.join(f.state.runRoot, 'control', 'coordinator-counts.json'));
    assert.equal(retired.generation, 2);
    assert.equal(retired.retired.length, 1);
    assert.deepEqual(retired.owner, next);
    assert.ok(fs.readFileSync(deliveries).equals(before));
    const counts = JSON.parse(fs.readFileSync(retired.counts, 'utf8'));
    assert.deepEqual(counts.sessions.map((v) => v.session).sort(), [f.caller.session, next.session].sort());
    assert.ok(fs.readFileSync(path.join(handoffDir, 'confirmation.md'), 'utf8').includes('msg_adjudicator_b'));
  });
}
