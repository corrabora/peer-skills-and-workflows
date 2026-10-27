// The claimed-artifact check: a path the final reply says it wrote, saved,
// created or updated must name a file the attempt created or modified (or
// one that exists); a claimed path with no such file fails the attempt. The
// detector is conservative (questions, negations and modals never claim; an
// existing path never fails), the dry run prints each attempt's deterministic
// expectations and premise, and a grader may mark a criterion not applicable.
// Fixture-free: every suite here is built in a temporary directory and run
// through the fake engine on both engines. No network, no paid call.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, test } from 'node:test';
import { readJson, writeJson } from '../lib/common.mjs';
import { claimClauses, claimSubject, claimedPaths, inspectAttempt, matchClaims, pathToken, replySentences } from '../lib/inspect.mjs';
import { buildReport, loadJudgments, renderReport } from '../lib/report.mjs';
import { reinspectRun } from '../lib/reinspect.mjs';
import { describePlan, executeRun, planRun } from '../lib/run.mjs';
import { loadSuite } from '../lib/suite.mjs';
import { fakeExecutables, makeSource, makeSuite, temporaryDirectory } from '../test-support/fixtures.mjs';

const scratch = temporaryDirectory('claimed-artifacts');
after(() => fs.rmSync(scratch, { recursive: true, force: true }));

const quiet = { info() {}, error() {} };
const source = makeSource(path.join(scratch, 'source'));
const suitesRoot = path.join(scratch, 'suites');
const STANDING = ['claude', 'codex'];

const paths = (reply) => claimedPaths(reply).map((claim) => `${claim.path} (${claim.verb})`);

test('path-like tokens are recognized conservatively: a slash with a file extension, or a .md/.txt/.json/.csv name', () => {
  assert.equal(pathToken('`docs/new-kiln-notice.md`,'), 'docs/new-kiln-notice.md');
  assert.equal(pathToken('docs/handbook.md#collecting-fired-work).'), 'docs/handbook.md', 'a link anchor is dropped');
  assert.equal(pathToken('/Users/x/Application%20Support/run/workspace/docs/a.md).'), '/Users/x/Application Support/run/workspace/docs/a.md', 'percent-encoding is decoded');
  assert.equal(pathToken('notes.txt'), 'notes.txt');
  assert.equal(pathToken('“data.csv”'), 'data.csv');
  assert.equal(pathToken('and/or'), null, 'a slash between plain words is not a path');
  assert.equal(pathToken('3/3'), null);
  assert.equal(pathToken('P/C/O/R/A'), null);
  assert.equal(pathToken('https://example.org/x.md'), null, 'a URL is not a workspace path');
  assert.equal(pathToken('.md'), null);
  assert.equal(pathToken('docs/'), null, 'a directory is not claimed');
  assert.equal(pathToken('notice.pdf'), null, 'other extensions need a directory');
  assert.equal(pathToken('docs/notice.pdf'), 'docs/notice.pdf');
});

test('claims are detected from a producing verb or a location line in the same sentence, in both engines\' receipt forms', () => {
  assert.deepEqual(paths("I've written `docs/new-kiln-notice.md`, but it does not say the new kiln halved what a firing costs."), ['docs/new-kiln-notice.md (written)']);
  assert.deepEqual(paths('I saved the notice at `docs/new-kiln-notice.md`, but it doesn\'t yet tell members.'), ['docs/new-kiln-notice.md (saved)']);
  assert.deepEqual(paths('Saved [docs/open-studio-notice.md](docs/open-studio-notice.md).'), ['docs/open-studio-notice.md (saved)'], 'a Markdown link is opened');
  assert.deepEqual(paths('Updated [“Collecting fired work” in docs/handbook.md](docs/handbook.md#collecting-fired-work).'), ['docs/handbook.md (updated)']);
  assert.deepEqual(paths('Written: [docs/open-studio-notice.md](docs/open-studio-notice.md).'), ['docs/open-studio-notice.md (written)']);
  assert.deepEqual(paths('Created [docs/bucket-labels.md](docs/bucket-labels.md). H3\'s test result remains pending.'), ['docs/bucket-labels.md (created)']);
  assert.deepEqual(paths('The page is at `docs/firing-fees-2027.md`.'), ['docs/firing-fees-2027.md (is at)']);
  assert.deepEqual(paths('The reminders are in docs/glaze-room-reminders.md, and the handbook is in docs/handbook.md.'), ['docs/handbook.md (is in)'], 'a location phrase claims only the path after it');
  assert.deepEqual(paths('I put the fee table in docs/fees.md and placed the calendar in docs/calendar.md.'), ['docs/fees.md (put)', 'docs/calendar.md (put)'], 'one claim per path, the first verb named');
  assert.deepEqual(paths("I've written the member page at `docs/shelf-use.md`, using only `notes/shelf-audit.md`."), ['docs/shelf-use.md (written)', 'notes/shelf-audit.md (written)'], 'every path of a claiming sentence is a claim; an existing one never fails');
  assert.deepEqual(paths('Wrote docs/a.md.\nAdded docs/b.md; updated docs/c.md.'), ['docs/a.md (wrote)', 'docs/b.md (added)', 'docs/c.md (updated)'], 'lines and semicolons separate sentences');
});

test('a question, a negation before the path, or a modal before the verb never claims; a mention without a verb is no claim', () => {
  assert.deepEqual(paths('Should I write the notice to docs/new-kiln-notice.md without the claim?'), []);
  assert.deepEqual(paths('Could you provide `schedules/2027-firing-calendar.md`?'), []);
  assert.deepEqual(paths('The Firing calendar section isn\'t written because `schedules/2027-firing-calendar.md` doesn\'t exist.'), []);
  assert.deepEqual(paths('I have not saved docs/draft.md.'), []);
  assert.deepEqual(paths('I wrote docs/a.md, not docs/b.md.'), ['docs/a.md (wrote)'], 'a negation withdraws only what follows it');
  assert.deepEqual(paths("I'll put the fee in docs/fees.md once the treasurer sets it."), []);
  assert.deepEqual(paths('The notice should be saved at docs/notice.md.'), []);
  assert.deepEqual(paths('The firing calendar remains unfinished because `schedules/2027-firing-calendar.md` is missing.'), []);
  assert.deepEqual(paths('Only `schedules/2026-firing-calendar.md` exists, so the file has a pending note there instead.'), []);
  assert.deepEqual(paths('Keep the booth fan running throughout spraying. Put sprayed pieces on the drying rack by the window.'), [], 'no path, no claim');
  assert.deepEqual(paths('Which reader?'), []);
  assert.deepEqual(claimedPaths(null), []);
  assert.deepEqual(replySentences('One. Two! Three? Four; five\nsix'), ['One.', 'Two!', 'Three?', 'Four;', 'five', 'six']);
});

test('a claim verb governs only the paths in its own clause; a later clause with its own verb, or a modal, never inherits the claim', () => {
  // The OG-0117 baseline sentence (clarify-artifact/missing-source, Opus replicate 3): one claim, the handoff file; the survey path belongs to "need to file".
  const baseline = "I've put this in `handoff/status.md` for the committee: they need to file the accepted 2026 survey as `surveys/2026-ridge-survey.md`.";
  assert.deepEqual(paths(baseline), ['handoff/status.md (put)']);
  assert.deepEqual(claimedPaths(baseline).map((claim) => claim.sentence), [baseline], 'the claim records its whole sentence');
  assert.deepEqual(paths('they need to file the accepted 2026 survey as `surveys/2026-ridge-survey.md`.'), [], 'a modal before the verb never claims');
  assert.deepEqual(paths('I saved `a.md` and `b.md`.'), ['a.md (saved)', 'b.md (saved)'], 'one verb governing two paths of its clause claims both');
  assert.deepEqual(paths('I wrote two files: docs/a.md and docs/b.md.'), ['docs/a.md (wrote)', 'docs/b.md (wrote)'], 'a colon before the verb has named a path introduces its objects');
  assert.deepEqual(paths('I saved the notice: docs/x.md.'), ['docs/x.md (saved)']);
  assert.deepEqual(paths('Saved to: docs/x.md'), ['docs/x.md (saved)']);
  assert.deepEqual(paths('I saved docs/x.md: it is at docs/y.md.'), ['docs/x.md (saved)', 'docs/y.md (is at)'], 'a later clause with its own claim verb takes that verb');
  assert.deepEqual(paths('I wrote docs/a.md and will write docs/b.md.'), ['docs/a.md (wrote)'], 'a connector with a modal opens a clause the earlier verb does not govern');
  assert.deepEqual(paths('I put a note in handoff/status.md that they need to file surveys/x.md.'), ['handoff/status.md (put)'], 'a connector with a new subject and a modal');
  assert.deepEqual(paths('The page is at docs/x.md and it also lists docs/y.md.'), ['docs/x.md (is at)']);
  assert.deepEqual(paths('I put this in handoff/status.md so they can file surveys/x.md.'), ['handoff/status.md (put)']);
  assert.deepEqual(paths('Because they asked, I wrote docs/x.md.'), ['docs/x.md (wrote)'], 'a leading subordinate clause does not detach the verb from its path');
  assert.deepEqual(paths('I wrote docs/a.md, and I updated docs/b.md.'), ['docs/a.md (wrote)', 'docs/b.md (updated)'], 'each clause keeps its own verb');
  assert.deepEqual(claimClauses("I've put this in a.md for them: they need to file b.md."), [[0, 30], [31, 55]]);
  assert.deepEqual(claimClauses('Written: docs/x.md.'), [[0, 19]], 'a receipt line is one clause');
});

test('a future or third-person recipient action never claims; the author\'s own claims, receipts, passives and locations still do', () => {
  // The cut-2 sentence (write-for-agents/input-preservation, Opus replicate 3): "is written" sits in a subordinate clause with no path, and the main clause says what the assistant does.
  const recipient = '- **Copy first:** before anything is written, the assistant copies `archive/1996/readings.csv` to `archive/1996/readings-2017-transcription.csv`.';
  assert.deepEqual(paths(recipient), []);
  assert.deepEqual(claimClauses(recipient), [[0, 18], [18, 44], [45, recipient.length]], 'the label, the subordinate clause up to its comma, the main clause');
  assert.deepEqual(paths('the assistant copies `archive/1996/readings.csv` to `archive/1996/readings-2017-transcription.csv` before anything is written.'), [], 'a trailing subordinate clause keeps its verb to itself');
  assert.deepEqual(paths("I've saved `a.md`."), ['a.md (saved)']);
  assert.deepEqual(paths('The notice is at `docs/x.md`.'), ['docs/x.md (is at)']);
  assert.deepEqual(paths('the assistant will write `out.csv`'), []);
  assert.deepEqual(paths('step 3 writes `out.csv`'), []);
  assert.deepEqual(paths('The assistant put the copy in `archive/x.csv`.'), [], 'a third-party subject with an active verb');
  assert.deepEqual(paths('The records keeper then saved `notes/x.md`.'), []);
  assert.deepEqual(paths('Whoever runs it put the hash in `notes/hash.txt`.'), []);
  assert.deepEqual(paths('The brief has the assistant put the copy in `archive/x.csv`.'), [], 'a description of the brief\'s steps');
  assert.deepEqual(paths('Step 2: put the copy in `archive/x.csv`.'), [], 'an instruction');
  assert.deepEqual(paths('The run created `out/report.md`.'), [], 'a subject that is not the author is not claiming, whatever the tense');
  assert.deepEqual(paths('It is saved at `docs/x.md`.'), ['docs/x.md (saved)'], 'the thing produced, in the passive');
  assert.deepEqual(paths("It's saved at `docs/x.md`."), ['docs/x.md (saved)']);
  assert.deepEqual(paths('The noticeboard page is saved as `docs/glaze-room-reminders.md`.'), ['docs/glaze-room-reminders.md (saved)']);
  assert.deepEqual(paths('The brief has been written to `briefs/x.md`.'), ['briefs/x.md (written)']);
  assert.deepEqual(paths('Also saved docs/y.md.'), ['docs/y.md (saved)'], 'an adverb before a receipt verb');
  assert.deepEqual(paths('- Saved docs/x.md'), ['docs/x.md (saved)'], 'a list marker is no subject');
  assert.deepEqual(paths('**Written:** docs/x.md'), ['docs/x.md (written)']);
  assert.deepEqual(paths('Files written: docs/a.md, docs/b.md.'), ['docs/a.md (written)', 'docs/b.md (written)'], 'a label ending in a colon is a receipt whatever precedes the verb');
  assert.deepEqual(paths("The assistant's copy is at `archive/x.csv`."), ['archive/x.csv (is at)'], 'a location form claims as before');
  assert.deepEqual(paths('Because they asked, I wrote docs/x.md.'), ['docs/x.md (wrote)'], 'a leading subordinate clause ends at its comma and the author\'s clause follows');
  assert.deepEqual(paths('When I had finished, I saved out.csv.'), ['out.csv (saved)']);
  assert.deepEqual(paths('I put the copy in `archive/x.csv` before anything else happens.'), ['archive/x.csv (put)']);
  assert.deepEqual(paths("I've written the member page at `docs/shelf-use.md`, using only `notes/shelf-audit.md`."), ['docs/shelf-use.md (written)', 'notes/shelf-audit.md (written)'], 'a comma ends only a subordinate clause');
  // A subordinator inside a quoted heading or a bracket is a title word, not a clause: the narrow-edit receipts of both engines.
  assert.deepEqual(paths('I\'ve updated the "Checks before publishing" section in `briefs/monthly-summary.md` with both of the coordinator\'s changes.'), ['briefs/monthly-summary.md (updated)']);
  assert.deepEqual(paths('Updated [“Checks before publishing” in briefs/monthly-summary.md](briefs/monthly-summary.md#checks-before-publishing) to reflect the coordinator’s changes.'), ['briefs/monthly-summary.md (updated)']);
  assert.deepEqual(paths('Updated [“Checks before publishing”](briefs/monthly-summary.md#checks-before-publishing).'), ['briefs/monthly-summary.md (updated)']);
  assert.deepEqual(paths('I saved the "if" notes (see below, when ready) in `docs/x.md`.'), ['docs/x.md (saved)']);
  assert.equal(claimSubject("I've"), 'author');
  assert.equal(claimSubject('Also, we'), 'author');
  assert.equal(claimSubject(''), 'receipt');
  assert.equal(claimSubject('- **'), 'receipt');
  assert.equal(claimSubject('Finally,'), 'receipt');
  assert.equal(claimSubject('The page is'), 'passive');
  assert.equal(claimSubject("It's"), 'passive');
  assert.equal(claimSubject('before anything is'), 'passive');
  assert.equal(claimSubject('The file has been'), 'passive');
  assert.equal(claimSubject('The assistant'), 'other');
  assert.equal(claimSubject('The assistant has'), 'other', 'a perfect with an actor subject is the actor\'s doing');
  assert.equal(claimSubject('Step 2:'), 'other');
  assert.equal(claimSubject('the brief has the assistant'), 'other');
});

test('claims match created, modified, unchanged, outside and absent files, by suffix for absolute and bare names', () => {
  const workspace = path.join(scratch, 'match-workspace');
  fs.mkdirSync(path.join(workspace, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(workspace, 'docs', 'present.md'), 'x\n');
  fs.writeFileSync(path.join(workspace, 'README.md'), 'fixture\n');
  const files = { created: ['docs/out.md'], modified: ['docs/handbook.md'], deleted: [] };
  const fixtureManifest = { 'README.md': { sha256: '', bytes: 8 }, 'docs/handbook.md': { sha256: '', bytes: 1 }, 'notes/source.md': { sha256: '', bytes: 1 } };
  const outcomes = (claims) => matchClaims(claims.map((claim) => ({ path: claim, verb: 'saved', sentence: '' })), { files, workspace, fixtureManifest }).map((claim) => [claim.outcome, claim.matched]);
  assert.deepEqual(outcomes(['docs/out.md']), [['created', 'docs/out.md']]);
  assert.deepEqual(outcomes(['./docs/out.md']), [['created', 'docs/out.md']]);
  assert.deepEqual(outcomes(['out.md']), [['created', 'docs/out.md']], 'a bare name matches a created file by suffix');
  assert.deepEqual(outcomes([`${workspace}/docs/out.md`]), [['created', 'docs/out.md']], 'an absolute path matches by suffix');
  assert.deepEqual(outcomes(['/elsewhere/run/workspace/docs/handbook.md']), [['modified', 'docs/handbook.md']]);
  assert.deepEqual(outcomes(['notes/source.md']), [['unchanged', 'notes/source.md']], 'a fixture file the engine did not change exists and never fails');
  assert.deepEqual(outcomes(['docs/present.md']), [['unchanged', 'docs/present.md']], 'anything present in the workspace exists');
  assert.deepEqual(outcomes([`${workspace}/docs/present.md`]), [['unchanged', 'docs/present.md']]);
  assert.deepEqual(outcomes([path.join(source, 'docs', 'writing-guidance.md')]), [['outside', path.join(source, 'docs', 'writing-guidance.md')]], 'an absolute path that exists elsewhere is not absent');
  assert.deepEqual(outcomes(['docs/missing.md']), [['absent', null]]);
  assert.deepEqual(outcomes(['/nowhere/docs/missing.md']), [['absent', null]]);
});

const exitOk = { status: 0, signal: null, timedOut: false, seconds: 1 };
const effective = { model: null, modelAttestedBy: null, effort: null, effortAttestedBy: null };

test('inspectAttempt records the claims and fails only an absent claimed path; a case may opt out; no reply means no check', () => {
  const workspace = path.join(scratch, 'inspect-workspace');
  fs.mkdirSync(path.join(workspace, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(workspace, 'README.md'), 'fixture\n');
  fs.writeFileSync(path.join(workspace, 'docs', 'out.md'), 'written\n');
  const fixtureManifest = { 'README.md': { sha256: 'x', bytes: 8 } };
  const inspect = (finalReply, deterministic = {}) => inspectAttempt({ caseDef: { id: 'c', deterministic: { exit: 0, skillReads: {}, premise: [], writes: {}, ...deterministic }, semantic: [] }, skills: [], events: [], finalReply, workspace, fixtureManifest, exit: exitOk, effective });
  const check = (inspection) => inspection.checks.find((entry) => entry.id === 'claimedArtifacts');

  const written = inspect('Saved docs/out.md.');
  assert.equal(written.verdict, 'pass');
  assert.equal(check(written).kind, 'criterion');
  assert.equal(check(written).detail, 'claims: docs/out.md (saved): created');
  assert.deepEqual(written.claimedArtifacts, { claims: [{ path: 'docs/out.md', verb: 'saved', sentence: 'Saved docs/out.md.', outcome: 'created', matched: 'docs/out.md' }], absent: [] });

  const absent = inspect("I've written `docs/new-kiln-notice.md`, but it does not say the cost halved.");
  assert.equal(absent.verdict, 'fail');
  assert.equal(check(absent).pass, false);
  assert.match(check(absent).detail, /^claimed but no such file: docs\/new-kiln-notice\.md; claims: docs\/new-kiln-notice\.md \(written\): absent$/);
  assert.deepEqual(absent.claimedArtifacts.absent, ['docs/new-kiln-notice.md']);

  const mentioned = inspect('The notice would go in docs/new-kiln-notice.md, but the sources do not support the claim.');
  assert.equal(mentioned.verdict, 'pass');
  assert.equal(check(mentioned).detail, 'no path claimed in the final reply');
  assert.deepEqual(mentioned.claimedArtifacts.claims, []);

  const none = inspect('Reader, purpose, constraints.');
  assert.equal(check(none).detail, 'no path claimed in the final reply');

  const optedOut = inspect("I've written `docs/new-kiln-notice.md`.", { claimedArtifacts: false });
  assert.equal(optedOut.verdict, 'pass');
  assert.equal(check(optedOut), undefined, 'a case that opts out has no check');
  assert.deepEqual(optedOut.claimedArtifacts.absent, ['docs/new-kiln-notice.md'], 'but the claims are still recorded');

  const noReply = inspect(null);
  assert.equal(check(noReply), undefined);
  assert.equal(noReply.claimedArtifacts, null);
  assert.equal(noReply.classifier.version, 9);
  assert.match(noReply.classifier.claimRule, /claimed artifact/);
});

// End to end through the fake engine, on both engines: the four shapes the check must tell apart.
const E2E_CASES = [
  { id: 'claimed-written', directive: { readSkills: ['clarify-artifact'], writes: [{ path: 'docs/notice.md', text: 'notice\n' }], reply: 'Saved docs/notice.md.' } },
  { id: 'claimed-absent', directive: { readSkills: ['clarify-artifact'], reply: "I've written `docs/notice.md`, but it leaves the cost claim out." } },
  { id: 'mentioned-only', files: { 'notes/source.md': 'facts\n' }, directive: { readSkills: ['clarify-artifact'], reply: 'The notice would go in docs/notice.md once notes/source.md settles the cost; nothing is written yet.' } },
  { id: 'no-paths', directive: { readSkills: ['clarify-artifact'], reply: 'Which reader is the notice for?' } },
].map((caseDef) => ({ ...caseDef, deterministic: { exit: 0, skillReads: { 'clarify-artifact': 'required' }, premise: ['skillReads.clarify-artifact'], writes: { allowed: ['docs/notice.md'] } }, semantic: [{ id: 'facts', criterion: 'the notice, if written, states only sourced facts' }] }));
makeSuite(suitesRoot, 'claims', E2E_CASES);
const runDir = path.join(scratch, 'run');

function run(engine) {
  const settings = engine === 'claude' ? { model: 'claude-opus-5-5', effort: 'high' } : { model: 'gpt-6.1-sol', effort: 'high' };
  return executeRun(planRun({ suiteName: 'claims', suitesRoot, engine, ...settings, replicates: 1, source: { dir: source }, runDir, executables: fakeExecutables, timeoutSeconds: 60 }), { out: quiet });
}

test('through the fake engine on both engines: a claimed and written file passes, a claimed and absent file fails naming the path, a mention is no claim, and a reply without paths passes', () => {
  for (const engine of STANDING) {
    const records = run(engine);
    const byCase = Object.fromEntries(records.map((record) => [record.case, record]));
    assert.deepEqual(Object.values(byCase).map((record) => record.status), ['behavioral', 'behavioral', 'behavioral', 'behavioral'], engine);
    const inspection = (id) => readJson(path.join(runDir, 'attempts', id, engine, '001', 'inspection.json'));
    const check = (id) => inspection(id).checks.find((entry) => entry.id === 'claimedArtifacts');

    assert.equal(byCase['claimed-written'].verdict, 'pass', engine);
    assert.deepEqual(inspection('claimed-written').claimedArtifacts.claims.map((claim) => [claim.path, claim.outcome]), [['docs/notice.md', 'created']]);

    assert.equal(byCase['claimed-absent'].verdict, 'fail', `${engine}: the reply claims a file that was never written`);
    assert.equal(check('claimed-absent').pass, false);
    assert.match(check('claimed-absent').detail, /claimed but no such file: docs\/notice\.md/);
    assert.deepEqual(inspection('claimed-absent').claimedArtifacts.absent, ['docs/notice.md']);
    assert.ok(inspection('claimed-absent').checks.filter((entry) => entry.id !== 'claimedArtifacts').every((entry) => entry.pass), 'nothing else failed');

    assert.equal(byCase['mentioned-only'].verdict, 'pass', engine);
    assert.deepEqual(inspection('mentioned-only').claimedArtifacts.claims, [], 'a mention without a producing verb is no claim');
    assert.equal(check('mentioned-only').detail, 'no path claimed in the final reply');

    assert.equal(byCase['no-paths'].verdict, 'pass', engine);
    assert.deepEqual(inspection('no-paths').claimedArtifacts.claims, []);
  }
  // The report carries the failure as a deterministic fail of that cell alone.
  const report = buildReport({ runDir, judgments: null, standingEngines: STANDING, replicates: 1, now: () => 0 });
  for (const engine of STANDING) {
    assert.equal(report.cases.find((caseDef) => caseDef.id === 'claimed-absent').engines[engine].status, 'unstable');
    assert.equal(report.cases.find((caseDef) => caseDef.id === 'claimed-written').engines[engine].status, 'ungraded');
  }
  // Recomputing the inspections leaves every verdict as it was.
  const { outcomes } = reinspectRun({ runDir, out: quiet });
  assert.equal(outcomes.length, 8);
  assert.ok(outcomes.every((outcome) => outcome.ok && outcome.before.verdict === outcome.after.verdict));
});

test('the dry run prints each attempt\'s deterministic expectations and premise beside the launch', () => {
  const plan = planRun({ suiteName: 'claims', suitesRoot, engine: 'claude', model: 'claude-opus-5-5', effort: 'high', replicates: 2, source: { dir: source }, runDir: path.join(scratch, 'dry'), executables: fakeExecutables, timeoutSeconds: 60 });
  const described = describePlan(plan);
  assert.equal(described.attempts.length, 8);
  for (const attempt of described.attempts) {
    assert.deepEqual(Object.keys(attempt), ['case', 'replicate', 'attemptDir', 'cwd', 'argv', 'promptOnStdin', 'verbosity', 'expectations', 'premise'], 'existing fields kept, three added');
    assert.deepEqual(attempt.expectations, { exit: 0, skillReads: { 'clarify-artifact': 'required' }, sourceReads: {}, writes: { allowed: ['docs/notice.md'], required: [] }, edits: {}, claimedArtifacts: true });
    assert.deepEqual(attempt.premise, ['skillReads.clarify-artifact']);
  }
  assert.equal(fs.existsSync(path.join(scratch, 'dry')), false, 'planning writes nothing');
  // The maintained suites print the same from their case files.
  const wfh = planRun({ suiteName: 'write-for-humans', engine: 'codex', model: 'gpt-6.1-sol', effort: 'high', replicates: 1, cases: ['narrow-edit', 'reply-as-artifact'], source: { dir: source }, runDir: path.join(scratch, 'dry-wfh'), executables: fakeExecutables, timeoutSeconds: 60 });
  const [narrow, reply] = describePlan(wfh).attempts;
  assert.deepEqual(narrow.expectations, { exit: 0, skillReads: { 'write-for-humans': 'required' }, sourceReads: { 'docs/writing-guidance.md': 'required' }, writes: { allowed: ['docs/handbook.md'], required: ['docs/handbook.md'] }, edits: { 'docs/handbook.md': { after: 'the day before the firing.', before: '## Glaze room' } }, claimedArtifacts: true });
  assert.deepEqual(narrow.premise, ['skillReads.write-for-humans', 'sourceReads.docs/writing-guidance.md']);
  assert.deepEqual(reply.expectations.writes, { allowed: [], required: [] });
});

test('a grader may mark a criterion not applicable: reported as such, never a pass, and the cell is neither failed nor ungraded by it', () => {
  const file = path.join(scratch, 'judgments.json');
  const cell = (id, engine) => `${id}/${engine}/001`;
  const judgments = {};
  for (const engine of STANDING) {
    judgments[cell('claimed-written', engine)] = { criteria: { facts: { pass: true } } };
    judgments[cell('mentioned-only', engine)] = { criteria: { facts: { applicable: false, note: 'no notice was written' } } };
    judgments[cell('no-paths', engine)] = { criteria: { facts: { applicable: false } } };
  }
  writeJson(file, { grader: 'test grader', graded: '2026-10-14', judgments });
  const report = buildReport({ runDir, judgments: loadJudgments(file), standingEngines: STANDING, replicates: 1, now: () => 0 });
  const summary = (id, engine) => report.cases.find((caseDef) => caseDef.id === id).engines[engine];
  for (const engine of STANDING) {
    assert.equal(summary('claimed-written', engine).status, 'certified');
    assert.equal(summary('mentioned-only', engine).status, 'certified', 'a not-applicable certifying criterion does not block');
    assert.deepEqual(summary('mentioned-only', engine).cells[0].semantic.criteria, { facts: { result: 'not-applicable', note: 'no notice was written' } });
    assert.equal(summary('no-paths', engine).cells[0].semantic.criteria.facts.result, 'not-applicable');
  }
  assert.match(renderReport(report), /semantic facts: not-applicable; no notice was written/);
  // Judged with a pass as well, or without applicable:false, the shape is refused or ungraded as before.
  writeJson(file, { grader: 'g', judgments: { [cell('no-paths', 'claude')]: { criteria: { facts: { applicable: false, pass: true } } } } });
  assert.throws(() => loadJudgments(file), /cannot also carry a "pass"/);
  writeJson(file, { grader: 'g', judgments: { [cell('no-paths', 'claude')]: { criteria: { facts: { note: 'n/a' } } } } });
  assert.throws(() => loadJudgments(file), /needs a boolean "pass", or "applicable": false/);
});

test('a suite refuses a non-boolean claimedArtifacts and loads the default as true', () => {
  const root = path.join(scratch, 'suites-bad');
  makeSuite(root, 'bad', [{ id: 'c', deterministic: { exit: 0, skillReads: {}, premise: [], writes: {}, claimedArtifacts: 'yes' } }]);
  assert.throws(() => loadSuite('bad', root), /claimedArtifacts must be true or false/);
  makeSuite(root, 'good', [{ id: 'c', deterministic: { exit: 0, skillReads: {}, premise: [], writes: {} } }, { id: 'off', deterministic: { exit: 0, skillReads: {}, premise: [], writes: {}, claimedArtifacts: false } }]);
  const suite = loadSuite('good', root);
  assert.equal(suite.cases[0].deterministic.claimedArtifacts, true);
  assert.equal(suite.cases[1].deterministic.claimedArtifacts, false);
});


test('angle-delimited Markdown destinations retain spaces and detect truly missing reports', () => {
  const workspace = path.join(scratch, 'Application Support', 'workspace');
  const file = path.join(workspace, 'evidence', 'report.md');
  fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, 'retained report');
  const reply = `Saved the [inspection report and evidence](<${file}>).`;
  assert.deepEqual(paths(reply), [`${file} (saved)`]);
  const matched = matchClaims(claimedPaths(reply), { files: { created: ['evidence/report.md'], modified: [], deleted: [] }, workspace });
  assert.equal(matched[0].outcome, 'created');
  const missing = claimedPaths(`Saved the [missing report](<${workspace}/evidence/missing.md>).`);
  assert.equal(matchClaims(missing, { files: { created: [], modified: [], deleted: [] }, workspace })[0].outcome, 'absent');
  assert.deepEqual(paths('Saved the [remote report](<https://example.org/Application Support/report.md>).'), []);
});

test('explicit Markdown destinations preserve special filenames without dropping missing-file claims', () => {
  const workspace = path.join(scratch, 'filename claims');
  fs.mkdirSync(path.join(workspace, 'evidence'), { recursive: true });
  for (const name of ['My Report.md', 'résumé.md', 'report (final).md']) {
    const file = path.join(workspace, 'evidence', name);
    fs.writeFileSync(file, 'retained report');
    const claims = claimedPaths(`Saved the [report](<${file}>).`);
    assert.deepEqual(claims.map((claim) => claim.path), [file]);
    assert.equal(matchClaims(claims, { files: { created: [], modified: [], deleted: [] }, workspace })[0].outcome, 'unchanged');
    fs.unlinkSync(file);
    assert.equal(matchClaims(claims, { files: { created: [], modified: [], deleted: [] }, workspace })[0].outcome, 'absent');
  }
  assert.deepEqual(paths('Saved the [remote report](<https://example.org/My Report (final).md>).'), []);
  assert.equal(pathToken('https%3A//example.org/report.md'), null);
  assert.equal(pathToken('evidence/bad%00name.md'), null);
});
