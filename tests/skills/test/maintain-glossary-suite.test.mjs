// The maintained maintain-glossary suite loads and is complete; its premise
// (the skill read, the glossary format read whole through the skill-local copy
// or the canonical path), the adoption reference required only where a legacy
// vocabulary is migrated, the `observed` guidance, the bounded writes (a
// literal path, the `*` pattern in the recording case, a deletion in the
// migration), and the two confined edits are exercised against fake traces in
// both engines' forms and end to end through the fake engine; dry runs on both
// engines plan the expected attempts. No network, no paid call.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, test } from 'node:test';
import { engineFor } from '../lib/engines.mjs';
import { editConfinement, inspectAttempt, passageBounds, registeredRewrites, sourceAliases } from '../lib/inspect.mjs';
import { packageRoot, readJson } from '../lib/common.mjs';
import { reinspectRun } from '../lib/reinspect.mjs';
import { describePlan, executeRun, planRun } from '../lib/run.mjs';
import { listSuites, loadSuite, matchesNodeTestPattern } from '../lib/suite.mjs';
import { fakeExecutables, makeSource, makeSuite, temporaryDirectory } from '../test-support/fixtures.mjs';

const scratch = temporaryDirectory('maintain-glossary');
after(() => fs.rmSync(scratch, { recursive: true, force: true }));

const quiet = { info() {}, error() {} };
const SKILL = 'maintain-glossary';
const FORMAT = 'docs/guidance/glossary-format.md';
const ADOPTION = 'docs/guidance/record-format-adoption.md';
const GUIDANCE = 'docs/writing-guidance.md';
const FORMAT_ALIAS = `skills/${SKILL}/references/glossary-format.md`;
const ADOPTION_ALIAS = `skills/${SKILL}/references/record-format-adoption.md`;
const CASE_IDS = [
  'new-glossary', 'nothing-qualifies', 'homonym', 'unresolved-meaning', 'meaning-kept', 'prune-relocate',
  'reuse-at-owner', 'scoped-glossary', 'migrate-table', 'missing-dependency', 'inline-proposal', 'decision-and-entry', 'related-term-unresolved',
];
const SUITE_SKILLS = ['maintain-glossary', 'write-for-humans', 'write-for-agents', 'clarify-artifact', 'record-decision'];
const WRITING = CASE_IDS.filter((id) => !['nothing-qualifies', 'meaning-kept'].includes(id));

// The generator registers no rewrite for the glossary-format copy (its links stay as they are) and one for the adoption copy.
const FORMAT_REWRITE = registeredRewrites(FORMAT, FORMAT_ALIAS);
const ADOPTION_REWRITE = registeredRewrites(ADOPTION, ADOPTION_ALIAS);
assert.deepEqual(FORMAT_REWRITE, [], 'the glossary-format copy has no registered rewrite');
assert.equal(ADOPTION_REWRITE.length, 1, 'the generator registers one rewrite for the adoption copy');

// A source tree with the five installed skills, the canonical glossary format,
// the adoption reference (whose one link the generator rewrites), the guidance,
// and maintain-glossary's three generated copies, each with a header line.
const FORMAT_TEXT = '# Glossary format\n\nCreate a root GLOSSARY.md only when there is a settled term to record.\n\n## Entries\n\nOne H2 per canonical term, alphabetical.\n';
const ADOPTION_TEXT = `# Record format adoption\n\nUse the [ADR](${ADOPTION_REWRITE[0].from}) and [glossary](glossary-format.md) formats.\n\nMigrate on request, preserving meaning and standing.\n`;
const ADOPTION_REWRITTEN = ADOPTION_TEXT.replace(`](${ADOPTION_REWRITE[0].from})`, `](${ADOPTION_REWRITE[0].to})`);
const GUIDANCE_TEXT = '# Shared guidance\n\nSelect before drafting.\n\n## Deliver\n\n  The receipt is the first line alone.\n';
const header = (relative) => `<!-- Generated from ${relative}. -->`;
const FORMAT_SIGNATURE = { first: '# Glossary format', last: 'One H2 per canonical term, alphabetical.' };
const source = makeSource(path.join(scratch, 'source'), SUITE_SKILLS);
fs.mkdirSync(path.join(source, 'docs', 'guidance'), { recursive: true });
fs.writeFileSync(path.join(source, FORMAT), FORMAT_TEXT);
fs.writeFileSync(path.join(source, ADOPTION), ADOPTION_TEXT);
fs.writeFileSync(path.join(source, GUIDANCE), GUIDANCE_TEXT);
fs.mkdirSync(path.join(source, 'skills', SKILL, 'references'), { recursive: true });
fs.writeFileSync(path.join(source, FORMAT_ALIAS), `${header(FORMAT)}\n${FORMAT_TEXT}`);
fs.writeFileSync(path.join(source, ADOPTION_ALIAS), `${header(ADOPTION)}\n${ADOPTION_REWRITTEN}`);
fs.writeFileSync(path.join(source, 'skills', SKILL, 'references', 'writing-guidance.md'), `${header(GUIDANCE)}\n${GUIDANCE_TEXT}`);

const caseOf = (suite, id) => suite.cases.find((caseDef) => caseDef.id === id);
const fixture = (suite, id, relative) => fs.readFileSync(path.join(caseOf(suite, id).workspace, ...relative.split('/')), 'utf8');

test('the maintain-glossary suite loads with its thirteen cases, the format premise where an entry is written or proposed, bounded writes and a certifying criterion each', () => {
  assert.ok(listSuites().includes(SKILL));
  const suite = loadSuite(SKILL);
  assert.equal(suite.skill, SKILL);
  assert.deepEqual(suite.skills, SUITE_SKILLS);
  assert.deepEqual(suite.cases.map((caseDef) => caseDef.id), CASE_IDS);
  for (const caseDef of suite.cases) {
    const prompt = caseDef.prompt.toString('utf8');
    assert.ok(caseDef.effect.length > 20, `${caseDef.id} states its effect`);
    assert.match(prompt, /^Use the `maintain-glossary` skill\.\n\n/, `${caseDef.id} opens by naming the skill`);
    assert.doesNotMatch(prompt, /Put any question/, `${caseDef.id} carries no closing invitation line`);
    assert.ok(prompt.endsWith('.\n') && !prompt.endsWith('\n\n'), `${caseDef.id} ends with one newline`);
    assert.ok('README.md' in caseDef.fixtureManifest, `${caseDef.id} has the workspace README`);
    assert.deepEqual(caseDef.deterministic.skillReads, { [SKILL]: 'required' }, `${caseDef.id} requires the skill and constrains no other skill's loading`);
    assert.equal(caseDef.deterministic.sourceReads[GUIDANCE], 'observed', `${caseDef.id} observes the guidance read, never certifying it`);
    assert.equal(caseDef.deterministic.sourceReads[ADOPTION], caseDef.id === 'migrate-table' ? 'required' : 'observed', `${caseDef.id} requires the adoption reference only where a legacy vocabulary is migrated`);
    if (WRITING.includes(caseDef.id)) {
      assert.equal(caseDef.deterministic.sourceReads[FORMAT], 'required', `${caseDef.id} requires the glossary format`);
      assert.deepEqual(caseDef.deterministic.premise, [`skillReads.${SKILL}`, `sourceReads.${FORMAT}`], `${caseDef.id} makes the skill and the format its premise`);
    } else {
      assert.equal(caseDef.deterministic.sourceReads[FORMAT], 'observed', `${caseDef.id} drafts nothing, so the format read is observed only`);
      assert.deepEqual(caseDef.deterministic.premise, [`skillReads.${SKILL}`]);
    }
    assert.equal(caseDef.deterministic.claimedArtifacts, true, `${caseDef.id} checks claimed artifacts`);
    assert.ok(caseDef.semantic.some((criterion) => criterion.observe !== true), `${caseDef.id} has at least one certifying criterion`);
    for (const criterion of caseDef.semantic) assert.ok(criterion.criterion.length > 25, `${caseDef.id}/${criterion.id} states what the grader judges`);
  }
  // The bounded writes: the root glossary alone in most cases; the planning note where a pending mark is allowed; nothing in the two
  // deterministic no-file cases; the contract in the pruning case; both glossaries in the scoped case; the migration batch; the recording case's pattern.
  const writes = Object.fromEntries(suite.cases.map((caseDef) => [caseDef.id, caseDef.deterministic.writes]));
  for (const id of ['new-glossary', 'homonym', 'reuse-at-owner', 'missing-dependency']) assert.deepEqual(writes[id], { allowed: ['GLOSSARY.md'], required: ['GLOSSARY.md'] }, id);
  assert.deepEqual(writes['nothing-qualifies'], { allowed: [] });
  assert.deepEqual(writes['inline-proposal'], { allowed: [] });
  assert.deepEqual(writes['meaning-kept'], { allowed: ['planning/2026-10-overdue.md'] }, 'the glossary is not allowed, so the entry stays byte-identical');
  assert.deepEqual(writes['unresolved-meaning'], { allowed: ['GLOSSARY.md', 'planning/2026-10-membership.md'], required: ['GLOSSARY.md'] });
  assert.deepEqual(writes['prune-relocate'], { allowed: ['GLOSSARY.md', 'docs/contracts/loan-rules.md'], required: ['GLOSSARY.md'] });
  assert.deepEqual(writes['scoped-glossary'], { allowed: ['GLOSSARY.md', 'repairs/GLOSSARY.md'], required: ['GLOSSARY.md', 'repairs/GLOSSARY.md'] });
  assert.deepEqual(writes['migrate-table'], { allowed: ['GLOSSARY.md', 'docs/terms.md', 'README.md', 'docs/contracts/loan-rules.md'], required: ['GLOSSARY.md'] });
  assert.deepEqual(writes['decision-and-entry'], { allowed: ['GLOSSARY.md', 'README.md', 'docs/adr/0001-*.md', 'DECISION-LOG.md'], required: ['GLOSSARY.md'] }, 'the record is allowed under its pattern, never required');
  assert.deepEqual(writes['related-term-unresolved'], writes['decision-and-entry'], 'both recording cases keep contracts outside scope');
  // The confined edits: the homonym entries between Booking's definition and the Loan heading; the pruned entry between its heading and the next.
  const edits = Object.fromEntries(suite.cases.filter((caseDef) => caseDef.deterministic.edits).map((caseDef) => [caseDef.id, caseDef.deterministic.edits]));
  assert.deepEqual(edits, {
    homonym: { 'GLOSSARY.md': { after: 'A member\'s request for a named tool on a future date, held at the desk until the tool is collected or the date passes.', before: '## Loan' } },
    'prune-relocate': { 'GLOSSARY.md': { after: '## Overdue', before: '## Renewal' } },
  });
  // Observe-only criteria: the engine's own question everywhere; the write-for-humans and guidance reads (OG-0090, OG-0099); the receipt rubric in the
  // saved-receipt cases; the question's shape where a question is plausible; the decision skill's loading and the record's content in the recording case.
  const observed = Object.fromEntries(suite.cases.map((caseDef) => [caseDef.id, caseDef.semantic.filter((criterion) => criterion.observe === true).map((criterion) => criterion.id)]));
  assert.deepEqual(observed, {
    'new-glossary': ['no-question', 'write-for-humans-read', 'writing-guidance-read', 'receipt-sentence-counts'],
    'nothing-qualifies': ['no-question', 'writing-guidance-read'],
    homonym: ['no-question', 'write-for-humans-read', 'writing-guidance-read', 'receipt-sentence-counts'],
    'unresolved-meaning': ['no-question', 'question-shape', 'write-for-humans-read', 'writing-guidance-read'],
    'meaning-kept': ['no-question', 'writing-guidance-read'],
    'prune-relocate': ['no-question', 'write-for-humans-read', 'writing-guidance-read', 'receipt-sentence-counts'],
    'reuse-at-owner': ['no-question', 'write-for-humans-read', 'writing-guidance-read', 'receipt-sentence-counts'],
    'scoped-glossary': ['no-question', 'write-for-humans-read', 'writing-guidance-read'],
    'migrate-table': ['no-question', 'write-for-humans-read', 'writing-guidance-read', 'receipt-sentence-counts'],
    'missing-dependency': ['no-question', 'question-shape', 'write-for-humans-read', 'writing-guidance-read'],
    'inline-proposal': ['no-question', 'question-shape', 'write-for-humans-read', 'writing-guidance-read'],
    'decision-and-entry': ['record-decision-read', 'decision-record-observed', 'no-question', 'write-for-humans-read', 'writing-guidance-read', 'receipt-sentence-counts'],
    'related-term-unresolved': ['record-decision-read', 'decision-record-observed', 'no-question', 'write-for-humans-read', 'writing-guidance-read', 'receipt-sentence-counts'],
  });
  const criterion = (id, criterionId) => caseOf(suite, id).semantic.find((entry) => entry.id === criterionId);
  for (const id of ['new-glossary', 'homonym', 'prune-relocate', 'reuse-at-owner', 'migrate-table', 'decision-and-entry']) {
    const rubric = criterion(id, 'receipt-sentence-counts');
    assert.match(rubric.criterion, /preface\/contents\/offers\/recital\/assurance/, `${id} names the counts in full`);
    assert.match(rubric.criterion, /not the cycle015 item rubric/, `${id} distinguishes the rubric`);
    assert.doesNotMatch(rubric.criterion, /P\/C\/O\/R\/A/, `${id} does not use the colliding labels`);
  }
  assert.match(criterion('new-glossary', 'write-for-humans-read').criterion, /inspection\.json/);
  assert.match(criterion('new-glossary', 'writing-guidance-read').criterion, /inspection\.json/);
  assert.match(criterion('decision-and-entry', 'record-decision-read').criterion, /inspection\.json/);
  assert.match(criterion('decision-and-entry', 'decision-record-observed').criterion, /record-decision owns that content/);
  // The certifying criteria name the plausible wrong answers and cannot pass vacuously.
  assert.match(criterion('new-glossary', 'house-shape').criterion, /A table, a labeled-field list/);
  assert.match(criterion('new-glossary', 'only-settled-terms').criterion, /A glossary with such an entry fails/);
  assert.match(criterion('nothing-qualifies', 'nothing-recorded').criterion, /A GLOSSARY\.md created for any of them/);
  assert.match(criterion('homonym', 'two-qualified-entries').criterion, /One entry covering both meanings/);
  assert.match(criterion('unresolved-meaning', 'unresolved-not-defined').criterion, /A neat Active member entry taken from either source fails/);
  assert.match(criterion('unresolved-meaning', 'pending-with-concrete-case').criterion, /either as the one question it asks or as a pending item/);
  assert.match(criterion('meaning-kept', 'entry-kept').criterion, /A rewritten entry, or a reply that reports an update, fails/);
  assert.match(criterion('prune-relocate', 'detail-relocated-or-reported').criterion, /in neither place after the edit fails/);
  assert.match(criterion('reuse-at-owner', 'definition-not-copied').criterion, /the network's sentence copied in fails/);
  assert.match(criterion('scoped-glossary', 'hold-qualified-not-split').criterion, /A desk\/GLOSSARY\.md or a one-term glossary anywhere fails/);
  assert.match(criterion('scoped-glossary', 'scoped-glossary-created').criterion, /dumped into the root glossary instead fails/);
  assert.match(criterion('migrate-table', 'proposed-term-not-settled').criterion, /A Grace period entry among the settled terms fails/);
  assert.match(criterion('migrate-table', 'anchors-or-references').criterion, /an anchor that no longer exists fails/);
  assert.match(criterion('missing-dependency', 'no-dependent-entry').criterion, /an example of what it would say, fails/);
  assert.match(criterion('inline-proposal', 'unresolved-carried').criterion, /A Scrap entry, or a reply that drops the question, fails/);
  assert.match(criterion('decision-and-entry', 'member-entry-updated').criterion, /no entry retains the superseded person-level Member meaning/);
  assert.match(criterion('decision-and-entry', 'affected-use-reconciled').criterion, /no mention in the reply fails/);
  assert.equal(loadSuite(SKILL).hash, suite.hash);
});

test('no fixture path matches a Node test pattern, no fixture echoes the skill or the format, and each case\'s trap is in place', () => {
  const suite = loadSuite(SKILL);
  for (const relative of Object.keys(suite.manifest)) {
    assert.equal(matchesNodeTestPattern(relative), false, relative);
    assert.ok(!relative.split('/').includes('test'), relative);
  }
  for (const caseDef of suite.cases) {
    for (const relative of Object.keys(caseDef.fixtureManifest)) {
      const text = fs.readFileSync(path.join(caseDef.workspace, relative), 'utf8');
      assert.doesNotMatch(text, /maintain-glossary|write-for-humans|write-for-agents|clarify-artifact|record-decision|delivery receipt|house format|glossary format|canonical term|homonym|Allocation|Reservation|one meaning per term|settled/i, `${caseDef.id}/${relative}`);
    }
  }
  const has = (id, relative) => relative in caseOf(suite, id).fixtureManifest;
  // No glossary exists where one is to be created or nothing is to be created; the base glossary is present elsewhere.
  for (const id of ['new-glossary', 'nothing-qualifies', 'migrate-table']) assert.equal(has(id, 'GLOSSARY.md'), false, `${id} starts without a glossary`);
  for (const id of CASE_IDS.filter((candidate) => !['new-glossary', 'nothing-qualifies', 'migrate-table'].includes(candidate))) {
    assert.equal(has(id, 'GLOSSARY.md'), true, `${id} has a glossary to act on`);
    assert.match(fixture(suite, id, 'GLOSSARY.md'), /^# Glossary\n\n## Booking\n/, `${id} glossary opens with Booking`);
  }
  // The three agreed meanings are in the September minutes, which also carry the ordinary words an over-eager glossary would define.
  const minutes = fixture(suite, 'new-glossary', 'minutes/2026-09-committee.md');
  assert.match(minutes, /A booking is a member's request/);
  assert.match(minutes, /A loan is overdue from the day after its due date/);
  assert.match(minutes, /available,\s+on loan, booked, at bench and missing/);
  assert.doesNotMatch(minutes, /glossary/i, 'the minutes do not name the glossary');
  // Nothing qualifies: ordinary programming words in their ordinary sense and two terms the stocktake rules own.
  const script = fixture(suite, 'nothing-qualifies', 'planning/2026-10-catalogue-script.md');
  for (const word of ['record', 'index', 'flagged', 'batches', 'condition grade', 'stocktake']) assert.match(script, new RegExp(word), word);
  assert.match(fixture(suite, 'nothing-qualifies', 'docs/contracts/stocktake.md'), /condition grade: A, as new; B, worn/);
  // The homonym: both deposits in their contracts, the confusion in the note, the amount only in the loan rules.
  assert.match(fixture(suite, 'homonym', 'docs/contracts/loan-rules.md'), /hire deposit of 20\.00/);
  assert.match(fixture(suite, 'homonym', 'docs/contracts/intake.md'), /A donor deposits a tool/);
  assert.doesNotMatch(fixture(suite, 'homonym', 'planning/2026-10-desk-notes.md'), /20\.00/);
  // The unresolved meaning: two sources, two meanings, no decision; the settled household term in the minutes and the note.
  assert.match(fixture(suite, 'unresolved-meaning', 'docs/contracts/loan-rules.md'), /active members, those who have borrowed in the last twelve\s+months/);
  assert.match(fixture(suite, 'unresolved-meaning', 'planning/2026-10-membership.md'), /marks a\s+member active when the current year's fee has been paid/);
  assert.match(fixture(suite, 'unresolved-meaning', 'planning/2026-10-membership.md'), /has not been asked which meaning should stand/);
  assert.match(fixture(suite, 'unresolved-meaning', 'minutes/2026-09-committee.md'), /Household membership\. Agreed/);
  // The proposal: not before the committee; the glossary carries the established meaning.
  assert.match(fixture(suite, 'meaning-kept', 'planning/2026-10-overdue.md'), /Not yet put\s+to the committee/);
  assert.match(fixture(suite, 'meaning-kept', 'GLOSSARY.md'), /## Overdue\n\nA loan that has passed its due date without the tool being checked in\.\n/);
  // The overgrown entry: rates duplicated from the loan rules; the cap and waiver stated only in the glossary and the June minutes.
  const overgrown = fixture(suite, 'prune-relocate', 'GLOSSARY.md');
  const pruneRules = fixture(suite, 'prune-relocate', 'docs/contracts/loan-rules.md');
  assert.match(overgrown, /capped at 25\.00/);
  assert.match(overgrown, /waived when the tool was recalled for repair/);
  assert.match(overgrown, /1\.00 per day for a hand tool and 2\.50 per day for a power tool/);
  assert.match(pruneRules, /1\.00 per\s+day for a hand tool and 2\.50 per day for a power tool/);
  assert.doesNotMatch(pruneRules, /25\.00|waived|recalled/);
  assert.match(fixture(suite, 'prune-relocate', 'minutes/2026-06-committee.md'), /capped at 25\.00/);
  assert.match(overgrown, /## Renewal\n/, 'an entry follows Overdue so the before marker bounds the passage');
  // The owner's definition is in the network terms; the note says the network maintains it.
  assert.match(fixture(suite, 'reuse-at-owner', 'docs/references/network-terms.md'), /## Inter-library loan\n\nA loan of a tool held by one library to a member of another/);
  assert.match(fixture(suite, 'reuse-at-owner', 'planning/2026-10-network.md'), /the network maintains that wording/);
  // The scoped context: owned by the bench, five terms, and the desk's one-word request.
  assert.match(fixture(suite, 'scoped-glossary', 'repairs/README.md'), /repair bench volunteers own this directory/);
  const bench = fixture(suite, 'scoped-glossary', 'planning/2026-10-bench-vocabulary.md');
  assert.equal([...bench.matchAll(/^- A (bench ticket|service hold|strip-down|write-off|parts bin) is/gm)].length, 5);
  assert.match(bench, /a list of their own with\s+hold in it/);
  assert.equal(has('scoped-glossary', 'repairs/GLOSSARY.md'), false);
  // The legacy vocabulary: labeled fields, H3 anchors, a proposed term among the agreed ones, links into it from the README and the loan rules.
  const legacy = fixture(suite, 'migrate-table', 'docs/terms.md');
  assert.deepEqual([...legacy.matchAll(/^### (.+)$/gm)].map((match) => match[1]), ['booking', 'grace period', 'loan', 'overdue', 'write-off']);
  assert.match(legacy, /Status: proposed by the desk volunteers/);
  assert.equal([...legacy.matchAll(/^- Means: /gm)].length, 5);
  assert.match(fixture(suite, 'migrate-table', 'README.md'), /\(docs\/terms\.md#loan\)/);
  assert.match(fixture(suite, 'migrate-table', 'docs/contracts/loan-rules.md'), /\(\.\.\/terms\.md#booking\)/);
  for (const neighbour of ['planning/2026-10-desk-notes.md', 'catalogue/tools.csv', 'docs/contracts/intake.md', 'docs/contracts/stocktake.md', 'minutes/2026-09-committee.md']) assert.equal(has('migrate-table', neighbour), true, neighbour);
  // The missing dependency: the booking rules are absent and the desk notes mention the slot as bait.
  assert.equal(has('missing-dependency', 'docs/contracts/booking-rules.md'), false);
  assert.match(fixture(suite, 'missing-dependency', 'planning/2026-10-desk-notes.md'), /half-hour collection windows/);
  // The inline proposal: two agreed terms and the unresolved scrap with its concrete case.
  const intake = fixture(suite, 'inline-proposal', 'planning/2026-10-intake-words.md');
  assert.match(intake, /An intake slip is/);
  assert.match(intake, /A bench check is/);
  assert.match(intake, /A rejected drill kept for its motor/);
  assert.match(intake, /The committee has not decided/);
  // The recording case: the old meaning in the glossary and the README, the accepted one in the October minutes, docs/adr/ named and empty.
  assert.match(fixture(suite, 'decision-and-entry', 'GLOSSARY.md'), /## Member\n\nA person who has paid the yearly fee/);
  assert.match(fixture(suite, 'decision-and-entry', 'README.md'), /Each member is one person with one member number/);
  assert.match(fixture(suite, 'decision-and-entry', 'README.md'), /Decision records live in `docs\/adr\/`, numbered from 0001/);
  assert.match(fixture(suite, 'decision-and-entry', 'minutes/2026-10-committee.md'), /Agreed: a membership covers one household/);
  assert.equal(Object.keys(caseOf(suite, 'decision-and-entry').fixtureManifest).some((relative) => relative.startsWith('docs/adr/')), false);
  // The edit markers occur once in their fixtures.
  for (const id of ['homonym', 'prune-relocate']) assert.doesNotThrow(() => passageBounds(fixture(suite, id, 'GLOSSARY.md'), caseOf(suite, id).deterministic.edits['GLOSSARY.md']), `${id} markers occur once`);
});

test('dry runs on both engines plan three replicates of every case with the fake engine, show the premise, the pattern and the observed rule, and write nothing', () => {
  for (const engine of ['claude', 'codex']) {
    const runDir = path.join(scratch, 'runs', `dry-${engine}`);
    const plan = planRun({
      suiteName: SKILL,
      engine,
      model: engine === 'claude' ? 'claude-opus-5-5' : 'gpt-6.1-sol',
      effort: 'high',
      replicates: 3,
      source: { dir: source },
      runDir,
      executables: fakeExecutables,
      timeoutSeconds: 60,
    });
    assert.equal(plan.cells.length, CASE_IDS.length * 3, engine);
    assert.deepEqual([...new Set(plan.cells.map((cell) => cell.caseDef.id))], CASE_IDS, engine);
    assert.equal(plan.cells[0].plan.argv[0], process.execPath, `${engine} launches the fake engine`);
    const described = describePlan(plan);
    const first = described.attempts.find((attempt) => attempt.case === 'new-glossary');
    assert.deepEqual(first.expectations.writes, { allowed: ['GLOSSARY.md'], required: ['GLOSSARY.md'] });
    assert.equal(first.expectations.sourceReads[GUIDANCE], 'observed', `${engine} prints the observed rule`);
    assert.deepEqual(first.premise, [`skillReads.${SKILL}`, `sourceReads.${FORMAT}`]);
    const recording = described.attempts.find((attempt) => attempt.case === 'decision-and-entry');
    assert.deepEqual(recording.expectations.writes.allowed, ['GLOSSARY.md', 'README.md', 'docs/adr/0001-*.md', 'DECISION-LOG.md'], `${engine} prints the pattern`);
    const skip = described.attempts.find((attempt) => attempt.case === 'nothing-qualifies');
    assert.deepEqual(skip.premise, [`skillReads.${SKILL}`]);
    assert.equal(skip.expectations.sourceReads[FORMAT], 'observed');
    assert.equal(fs.existsSync(runDir), false, `${engine} dry run writes nothing`);
  }
});

// --- the aliases of the three references, from the checkout's own copies and the temporary source ---

test('the checkout\'s maintain-glossary copies resolve as aliases (the adoption copy by its registered rewrite), and the temporary source declares the same', () => {
  const real = sourceAliases(packageRoot, [FORMAT, ADOPTION, GUIDANCE]);
  const mine = (relative) => real[relative].find((alias) => alias.skill === SKILL);
  assert.deepEqual([mine(FORMAT).status, mine(FORMAT).rewrites], ['alias', undefined]);
  assert.deepEqual([mine(ADOPTION).status, mine(ADOPTION).rewrites], ['alias', ADOPTION_REWRITE]);
  assert.deepEqual([mine(GUIDANCE).status, mine(GUIDANCE).rewrites], ['alias', undefined]);
  assert.match(mine(FORMAT).header, /Generated from docs\/guidance\/glossary-format\.md/);
  const declared = sourceAliases(source, [FORMAT, ADOPTION, GUIDANCE]);
  assert.deepEqual(declared[FORMAT], [{ skill: SKILL, path: FORMAT_ALIAS, status: 'alias', header: header(FORMAT) }]);
  assert.deepEqual(declared[ADOPTION], [{ skill: SKILL, path: ADOPTION_ALIAS, status: 'alias', header: header(ADOPTION), rewrites: ADOPTION_REWRITE }]);
  assert.deepEqual(declared[GUIDANCE], [{ skill: SKILL, path: `skills/${SKILL}/references/writing-guidance.md`, status: 'alias', header: header(GUIDANCE) }]);
});

// --- the premise, the writes and the observed rule against fake traces in both engines' forms ---

const claudeTrace = (calls) => calls.map(([name, input, output], index) => [
  JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', id: `t${index}`, name, input }] } }),
  output === null ? null : JSON.stringify({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: `t${index}`, content: output }] } }),
].filter(Boolean).join('\n')).join('\n');
const codexTrace = (commands) => commands.map(([command, output], index) => JSON.stringify({ type: 'item.completed', item: { id: `i${index}`, type: 'command_execution', command: `/bin/zsh -lc ${JSON.stringify(command)}`, aggregated_output: output, exit_code: 0, status: 'completed' } })).join('\n');
const numbered = (text) => text.split('\n').map((line, index) => `${index + 1}\t${line}`).join('\n');
const claudeEvents = (calls) => engineFor('claude').events(claudeTrace(calls));
const codexEvents = (commands) => engineFor('codex').events(codexTrace(commands));
const skillBody = (skill) => fs.readFileSync(path.join(source, 'skills', skill, 'SKILL.md'), 'utf8');
const skillSignatures = Object.fromEntries(SUITE_SKILLS.map((skill) => [skill, { name: skill, heading: skill }]));
const exit = { status: 0, signal: null, timedOut: false, seconds: 1 };
const copyText = `${header(FORMAT)}\n${FORMAT_TEXT}`;
const check = (inspection, id) => inspection.checks.find((entry) => entry.id === id);
const NEW_GLOSSARY = '# Glossary\n\n## Booking\n\nA request.\n\n## Loan\n\nA tool issued.\n\n## Overdue\n\nA late loan.\n';

test('the premise is met by the skill read with the glossary format read through the skill-local copy or the canonical path, on both engines; the glossary write is bounded; the observed references yield no check', () => {
  const suite = loadSuite(SKILL);
  const caseDef = caseOf(suite, 'new-glossary');
  const workspace = path.join(scratch, 'inspect-ws');
  fs.cpSync(caseDef.workspace, workspace, { recursive: true });
  fs.writeFileSync(path.join(workspace, 'GLOSSARY.md'), NEW_GLOSSARY);
  const inspect = (events, finalReply = 'Saved GLOSSARY.md.', sourceRoot = source) => inspectAttempt({ caseDef, skills: SUITE_SKILLS, events, finalReply, workspace, fixtureManifest: caseDef.fixtureManifest, exit, effective: {}, signatures: skillSignatures, sourceRoot });

  // Claude: the skill through its link, the format through the skill-local copy.
  const claudeSkill = ['Read', { file_path: `/ws/.claude/skills/${SKILL}/SKILL.md` }, numbered(skillBody(SKILL))];
  const viaCopy = inspect(claudeEvents([claudeSkill, ['Read', { file_path: `/ws/.claude/skills/${SKILL}/references/glossary-format.md` }, numbered(copyText)]]));
  assert.equal(viaCopy.verdict, 'pass');
  assert.deepEqual([check(viaCopy, `skillReads.${SKILL}`).kind, check(viaCopy, `skillReads.${SKILL}`).pass, check(viaCopy, `sourceReads.${FORMAT}`).kind, check(viaCopy, `sourceReads.${FORMAT}`).pass], ['premise', true, 'premise', true]);
  assert.deepEqual([viaCopy.sourceReads[FORMAT].forms, viaCopy.sourceReads[FORMAT].skillLocal], [['skill-local'], [SKILL]]);
  assert.match(check(viaCopy, `sourceReads.${FORMAT}`).detail, /read through skill-local copy \(maintain-glossary\)/);
  assert.deepEqual(viaCopy.classifier.sourceAliases[FORMAT], [{ skill: SKILL, path: FORMAT_ALIAS, status: 'alias', header: header(FORMAT) }]);
  assert.deepEqual(viaCopy.classifier.sourceSignatures[FORMAT], FORMAT_SIGNATURE);
  assert.deepEqual(viaCopy.files.created, ['GLOSSARY.md']);
  assert.deepEqual([check(viaCopy, 'writes.allowed').pass, check(viaCopy, 'writes.required').pass], [true, true]);
  assert.equal(check(viaCopy, 'writes.required').detail, 'written: GLOSSARY.md');
  // The observed adoption reference and guidance: classified and recorded, no check, read or not.
  assert.equal(check(viaCopy, `sourceReads.${ADOPTION}`), undefined);
  assert.equal(check(viaCopy, `sourceReads.${GUIDANCE}`), undefined);
  assert.equal(viaCopy.sourceReads[GUIDANCE].body, false);
  const withBoth = inspect(claudeEvents([claudeSkill, ['Read', { file_path: `/ws/.claude/skills/${SKILL}/references/glossary-format.md` }, numbered(copyText)], ['Read', { file_path: `/ws/.claude/skills/${SKILL}/references/record-format-adoption.md` }, numbered(`${header(ADOPTION)}\n${ADOPTION_REWRITTEN}`)], ['Read', { file_path: `/ws/.claude/skills/${SKILL}/references/writing-guidance.md` }, numbered(`${header(GUIDANCE)}\n${GUIDANCE_TEXT}`)]]));
  assert.equal(withBoth.verdict, 'pass');
  assert.deepEqual([withBoth.sourceReads[ADOPTION].body, withBoth.sourceReads[GUIDANCE].body], [true, true], 'recorded for the grader');
  assert.deepEqual(withBoth.classifier.sourceAliases[ADOPTION][0].rewrites, ADOPTION_REWRITE, 'the adoption copy matched by its rewrite');
  assert.equal(check(withBoth, `sourceReads.${ADOPTION}`), undefined);
  // Claude: the canonical path under the materialized source.
  const viaCanonical = inspect(claudeEvents([claudeSkill, ['Read', { file_path: path.join(source, FORMAT) }, numbered(FORMAT_TEXT)]]));
  assert.equal(viaCanonical.verdict, 'pass');
  assert.deepEqual(viaCanonical.sourceReads[FORMAT].forms, ['canonical']);
  // Claude: only the first lines came back; the skill never read.
  const partial = inspect(claudeEvents([claudeSkill, ['Read', { file_path: `/ws/.claude/skills/${SKILL}/references/glossary-format.md`, limit: 2 }, numbered(`${header(FORMAT)}\n# Glossary format`)]]));
  assert.equal(partial.verdict, 'premise-not-met');
  assert.match(check(partial, `sourceReads.${FORMAT}`).detail, /partly returned through skill-local copy \(maintain-glossary\)/);
  const noSkill = inspect(claudeEvents([['Read', { file_path: `/ws/.claude/skills/${SKILL}/references/glossary-format.md` }, numbered(copyText)]]));
  assert.equal(noSkill.verdict, 'premise-not-met');
  // Claude: a second file outside the allowed set fails the write check, outside the premise.
  fs.writeFileSync(path.join(workspace, 'docs', 'glossary.md'), '# Glossary\n');
  const stray = inspect(claudeEvents([claudeSkill, ['Read', { file_path: `/ws/.claude/skills/${SKILL}/references/glossary-format.md` }, numbered(copyText)]]));
  assert.equal(stray.verdict, 'fail');
  assert.match(check(stray, 'writes.allowed').detail, /changed outside the allowed set: docs\/glossary\.md/);
  fs.rmSync(path.join(workspace, 'docs', 'glossary.md'));

  // Codex: shell reads of the same files through the .agents link.
  const codexSkill = [`cat .agents/skills/${SKILL}/SKILL.md`, skillBody(SKILL)];
  const codexCopy = inspect(codexEvents([codexSkill, [`cat .agents/skills/${SKILL}/references/glossary-format.md`, copyText]]));
  assert.equal(codexCopy.verdict, 'pass');
  assert.deepEqual([codexCopy.sourceReads[FORMAT].forms, codexCopy.sourceReads[FORMAT].skillLocal], [['skill-local'], [SKILL]]);
  const codexCanonical = inspect(codexEvents([codexSkill, [`cat -n '${path.join(source, FORMAT)}'`, numbered(FORMAT_TEXT)]]));
  assert.equal(codexCanonical.verdict, 'pass');
  const codexChunked = inspect(codexEvents([codexSkill, [`head -n 3 .agents/skills/${SKILL}/references/glossary-format.md`, `${header(FORMAT)}\n# Glossary format\n`], [`tail -n +4 .agents/skills/${SKILL}/references/glossary-format.md`, FORMAT_TEXT.split('\n').slice(2).join('\n')]]));
  assert.equal(codexChunked.verdict, 'pass', 'chunks through the copy join');
  const codexListed = inspect(codexEvents([codexSkill, [`ls -l .agents/skills/${SKILL}/references/glossary-format.md`, null]]));
  assert.equal(codexListed.verdict, 'premise-not-met');
  assert.equal(codexListed.sourceReads[FORMAT].listing, true);
  // Codex: a stale copy of the format never counts.
  const stale = makeSource(path.join(scratch, 'source-stale'), SUITE_SKILLS);
  fs.mkdirSync(path.join(stale, 'docs', 'guidance'), { recursive: true });
  fs.writeFileSync(path.join(stale, FORMAT), FORMAT_TEXT);
  fs.mkdirSync(path.join(stale, 'skills', SKILL, 'references'), { recursive: true });
  fs.writeFileSync(path.join(stale, FORMAT_ALIAS), `${header(FORMAT)}\n${FORMAT_TEXT.replace('settled term', 'agreed term')}`);
  const staleRead = inspect(codexEvents([codexSkill, [`cat .agents/skills/${SKILL}/references/glossary-format.md`, copyText]]), 'Saved GLOSSARY.md.', stale);
  assert.equal(staleRead.verdict, 'premise-not-met');
  assert.equal(staleRead.sourceReads[FORMAT].staleAlias, true);
});

test('the adoption reference is a required check in the migration case and its absence fails outside the premise; a deleted legacy page is an allowed change; the no-file cases fail on any file', () => {
  const suite = loadSuite(SKILL);
  const migrate = caseOf(suite, 'migrate-table');
  const workspace = path.join(scratch, 'inspect-migrate');
  fs.cpSync(migrate.workspace, workspace, { recursive: true });
  fs.writeFileSync(path.join(workspace, 'GLOSSARY.md'), NEW_GLOSSARY);
  fs.rmSync(path.join(workspace, 'docs', 'terms.md'));
  const inspect = (caseDef, ws, events, finalReply) => inspectAttempt({ caseDef, skills: SUITE_SKILLS, events, finalReply, workspace: ws, fixtureManifest: caseDef.fixtureManifest, exit, effective: {}, signatures: skillSignatures, sourceRoot: source });
  const claudeSkill = ['Read', { file_path: `/ws/.claude/skills/${SKILL}/SKILL.md` }, numbered(skillBody(SKILL))];
  const formatRead = ['Read', { file_path: `/ws/.claude/skills/${SKILL}/references/glossary-format.md` }, numbered(copyText)];
  const adoptionRead = ['Read', { file_path: `/ws/.claude/skills/${SKILL}/references/record-format-adoption.md` }, numbered(`${header(ADOPTION)}\n${ADOPTION_REWRITTEN}`)];
  const withAdoption = inspect(migrate, workspace, claudeEvents([claudeSkill, formatRead, adoptionRead]), 'Saved GLOSSARY.md; docs/terms.md removed.');
  assert.equal(withAdoption.verdict, 'pass');
  assert.deepEqual([check(withAdoption, `sourceReads.${ADOPTION}`).kind, check(withAdoption, `sourceReads.${ADOPTION}`).pass], ['criterion', true]);
  assert.deepEqual(withAdoption.files.deleted, ['docs/terms.md']);
  assert.equal(check(withAdoption, 'writes.allowed').pass, true, 'the deletion is inside the allowed set');
  const withoutAdoption = inspect(migrate, workspace, claudeEvents([claudeSkill, formatRead]), 'Saved GLOSSARY.md; docs/terms.md removed.');
  assert.equal(withoutAdoption.verdict, 'fail', 'the premise holds; the adoption check fails');
  assert.equal(check(withoutAdoption, `sourceReads.${ADOPTION}`).pass, false);
  // Codex form of the adoption read through the rewritten copy.
  const codexSkill = [`cat .agents/skills/${SKILL}/SKILL.md`, skillBody(SKILL)];
  const codexAll = inspect(migrate, workspace, codexEvents([codexSkill, [`cat .agents/skills/${SKILL}/references/glossary-format.md`, copyText], [`cat .agents/skills/${SKILL}/references/record-format-adoption.md`, `${header(ADOPTION)}\n${ADOPTION_REWRITTEN}`]]), 'Saved GLOSSARY.md.');
  assert.equal(codexAll.verdict, 'pass');
  assert.deepEqual(codexAll.classifier.sourceAliases[ADOPTION][0].rewrites, ADOPTION_REWRITE);
  // A neighbour touched in the migration fails deterministically.
  fs.appendFileSync(path.join(workspace, 'planning', '2026-10-desk-notes.md'), '\nSee GLOSSARY.md.\n');
  const neighbour = inspect(migrate, workspace, claudeEvents([claudeSkill, formatRead, adoptionRead]), 'Saved GLOSSARY.md.');
  assert.equal(neighbour.verdict, 'fail');
  assert.match(check(neighbour, 'writes.allowed').detail, /changed outside the allowed set: planning\/2026-10-desk-notes\.md/);
  // The two no-file cases: untouched passes with the skill alone (format observed) or with the format (required premise); a created glossary fails.
  for (const [id, needsFormat] of [['nothing-qualifies', false], ['inline-proposal', true]]) {
    const caseDef = caseOf(suite, id);
    const ws = path.join(scratch, `inspect-${id}`);
    fs.cpSync(caseDef.workspace, ws, { recursive: true });
    const events = claudeEvents(needsFormat ? [claudeSkill, formatRead] : [claudeSkill]);
    const clean = inspect(caseDef, ws, events, 'Nothing qualifies.');
    assert.equal(clean.verdict, 'pass', id);
    assert.equal(check(clean, 'writes.allowed').detail, 'nothing changed');
    assert.equal(check(clean, `sourceReads.${FORMAT}`) === undefined, !needsFormat, `${id}: the format read is ${needsFormat ? 'a premise' : 'observed'}`);
    fs.writeFileSync(path.join(ws, 'GLOSSARY.md'), NEW_GLOSSARY);
    const wrote = inspect(caseDef, ws, events, 'Saved GLOSSARY.md.');
    assert.equal(wrote.verdict, 'fail', `${id}: a glossary written fails`);
    assert.match(check(wrote, 'writes.allowed').detail, /changed outside the allowed set: GLOSSARY\.md/);
  }
  // The meaning-kept case: the glossary is not allowed, so a rewritten entry fails deterministically while a pending mark on the note passes.
  const kept = caseOf(suite, 'meaning-kept');
  const keptWs = path.join(scratch, 'inspect-kept');
  fs.cpSync(kept.workspace, keptWs, { recursive: true });
  fs.appendFileSync(path.join(keptWs, 'planning', '2026-10-overdue.md'), '\nPending the committee\'s decision; the glossary entry is unchanged.\n');
  const marked = inspect(kept, keptWs, claudeEvents([claudeSkill]), 'The entry is unchanged; the proposal is pending in planning/2026-10-overdue.md.');
  assert.equal(marked.verdict, 'pass');
  fs.writeFileSync(path.join(keptWs, 'GLOSSARY.md'), fs.readFileSync(path.join(keptWs, 'GLOSSARY.md'), 'utf8').replace('has passed its due date', 'is more than three days past its due date'));
  const rewritten = inspect(kept, keptWs, claudeEvents([claudeSkill]), 'Updated GLOSSARY.md.');
  assert.equal(rewritten.verdict, 'fail');
  assert.match(check(rewritten, 'writes.allowed').detail, /GLOSSARY\.md/);
});

// --- the confined edits against the real fixtures ---

test('the homonym and pruning markers bound one passage each, and only a change inside it is confined', () => {
  const suite = loadSuite(SKILL);
  const homonym = fixture(suite, 'homonym', 'GLOSSARY.md');
  const homonymMarkers = caseOf(suite, 'homonym').deterministic.edits['GLOSSARY.md'];
  const bounds = passageBounds(homonym, homonymMarkers);
  assert.equal(homonym.slice(bounds.start, bounds.end), '\n', 'the passage is the gap between Booking\'s definition and the Loan heading');
  const inserted = homonym.replace('\n\n## Loan', '\n\n## Deposit (donation)\n\nA tool a donor hands in.\n\n## Deposit (hire)\n\nMoney held against a power tool.\n\n## Loan');
  assert.equal(editConfinement(homonym, inserted, homonymMarkers).confined, true);
  assert.equal(editConfinement(homonym, homonym.replace('## Overdue', '## Deposit\n\nEither kind.\n\n## Overdue'), homonymMarkers).confined, false, 'an entry placed out of order is outside the passage');
  assert.equal(editConfinement(homonym, inserted.replace('## Loan\n\nA tool issued', '## Loan\n\nA tool (not a deposit) issued'), homonymMarkers).confined, false, 'a neighbour rewritten is outside the passage');
  const overgrown = fixture(suite, 'prune-relocate', 'GLOSSARY.md');
  const pruneMarkers = caseOf(suite, 'prune-relocate').deterministic.edits['GLOSSARY.md'];
  const pruneBounds = passageBounds(overgrown, pruneMarkers);
  assert.match(overgrown.slice(pruneBounds.start, pruneBounds.end), /capped at 25\.00/, 'the passage is the Overdue body');
  const pruned = overgrown.replace(/## Overdue\n\n[^\n]+\n/, '## Overdue\n\nA loan that has passed its due date without the tool being checked in.\n');
  assert.equal(editConfinement(overgrown, pruned, pruneMarkers).confined, true);
  assert.equal(editConfinement(overgrown, pruned.replace('## Renewal\n\nA loan extended', '## Renewal\n\nA loan extended, fee capped at 25.00,'), pruneMarkers).confined, false, 'the next entry is outside the passage');
  assert.equal(editConfinement(overgrown, pruned.replace('## Booking', '## Booking (desk)'), pruneMarkers).confined, false, 'an earlier heading is outside the passage');
});

// --- end to end through the fake engine, both engines ---

test('the fake engine exercises the skill-local premise, the glossary write, the adoption check, the deletion, the pattern and the confined pruning end to end on both engines, and inspect recomputes them unchanged', () => {
  const suites = path.join(scratch, 'suites-e2e');
  const suite = loadSuite(SKILL);
  const OVERGROWN = fixture(suite, 'prune-relocate', 'GLOSSARY.md');
  const pruneMarkers = caseOf(suite, 'prune-relocate').deterministic.edits['GLOSSARY.md'];
  const LEGACY = fixture(suite, 'migrate-table', 'docs/terms.md');
  const rule = { exit: 0, skillReads: { [SKILL]: 'required' }, sourceReads: { [FORMAT]: 'required', [ADOPTION]: 'observed', [GUIDANCE]: 'observed' }, premise: [`skillReads.${SKILL}`, `sourceReads.${FORMAT}`] };
  const semantic = [{ id: 'shape', criterion: 'title and one sentence per term' }];
  const newGlossary = { path: 'GLOSSARY.md', text: NEW_GLOSSARY };
  const only = { allowed: ['GLOSSARY.md'], required: ['GLOSSARY.md'] };
  const formatCopy = `.claude/skills/${SKILL}/references/glossary-format.md`;
  const adoptionCopy = `.claude/skills/${SKILL}/references/record-format-adoption.md`;
  const pruned = OVERGROWN.replace(/## Overdue\n\n[^\n]+\n/, '## Overdue\n\nA loan that has passed its due date without the tool being checked in.\n');
  const cases = [
    // The format read through the skill-local copy via the installed link; the glossary created.
    { id: 'via-copy', directive: { readSkills: [SKILL], readFiles: [formatCopy], writes: [newGlossary], reply: 'Saved GLOSSARY.md.' }, deterministic: { ...rule, writes: only }, semantic },
    // The canonical path under the materialized source, with the guidance read as well (observed).
    { id: 'via-canonical', directive: { readSkills: [SKILL], readFiles: [path.join(source, FORMAT), `.claude/skills/${SKILL}/references/writing-guidance.md`], writes: [newGlossary], reply: 'Saved GLOSSARY.md.' }, deterministic: { ...rule, writes: only }, semantic },
    // Only the first bytes of the copy came back: the premise is not met.
    { id: 'truncated', directive: { readSkills: [SKILL], readFiles: [{ path: formatCopy, limit: 30 }], writes: [newGlossary], reply: 'Saved GLOSSARY.md.' }, deterministic: { ...rule, writes: only }, semantic },
    // Nothing qualifies, but a file was created: outside the empty allowed set.
    { id: 'file-when-none', directive: { readSkills: [SKILL], readFiles: [formatCopy], writes: [newGlossary], reply: 'Saved GLOSSARY.md.' }, deterministic: { ...rule, writes: { allowed: [] } }, semantic },
    // The migration: adoption required and read, the legacy page deleted inside the allowed set.
    { id: 'migrated', files: { 'docs/terms.md': LEGACY }, directive: { readSkills: [SKILL], readFiles: [formatCopy, adoptionCopy], writes: [newGlossary], deletes: ['docs/terms.md'], reply: 'Saved GLOSSARY.md.' }, deterministic: { ...rule, sourceReads: { ...rule.sourceReads, [ADOPTION]: 'required' }, writes: { allowed: ['GLOSSARY.md', 'docs/terms.md'], required: ['GLOSSARY.md'] } }, semantic },
    // The same migration without the adoption read: the premise holds and the check fails.
    { id: 'unadopted', files: { 'docs/terms.md': LEGACY }, directive: { readSkills: [SKILL], readFiles: [formatCopy], writes: [newGlossary], deletes: ['docs/terms.md'], reply: 'Saved GLOSSARY.md.' }, deterministic: { ...rule, sourceReads: { ...rule.sourceReads, [ADOPTION]: 'required' }, writes: { allowed: ['GLOSSARY.md', 'docs/terms.md'], required: ['GLOSSARY.md'] } }, semantic },
    // The recording case's pattern: a record under docs/adr/0001-*.md is allowed; one under 0002 is not.
    { id: 'record-allowed', files: { 'GLOSSARY.md': NEW_GLOSSARY }, directive: { readSkills: [SKILL], readFiles: [formatCopy], writes: [{ path: 'GLOSSARY.md', text: `${NEW_GLOSSARY}\n## Member\n\nA household.\n` }, { path: 'docs/adr/0001-household-membership.md', text: '# ADR-0001: Household membership\n\nOne membership per household.\n' }], reply: 'Saved GLOSSARY.md and docs/adr/0001-household-membership.md.' }, deterministic: { ...rule, writes: { allowed: ['GLOSSARY.md', 'docs/adr/0001-*.md'], required: ['GLOSSARY.md'] } }, semantic },
    { id: 'record-misnumbered', files: { 'GLOSSARY.md': NEW_GLOSSARY }, directive: { readSkills: [SKILL], readFiles: [formatCopy], writes: [{ path: 'GLOSSARY.md', text: `${NEW_GLOSSARY}\n## Member\n\nA household.\n` }, { path: 'docs/adr/0002-household-membership.md', text: '# ADR-0002: Household membership\n' }], reply: 'Saved GLOSSARY.md.' }, deterministic: { ...rule, writes: { allowed: ['GLOSSARY.md', 'docs/adr/0001-*.md'], required: ['GLOSSARY.md'] } }, semantic },
    // The pruning inside its passage, and one that also touched the next entry.
    { id: 'confined', files: { 'GLOSSARY.md': OVERGROWN }, directive: { readSkills: [SKILL], readFiles: [formatCopy], writes: [{ path: 'GLOSSARY.md', text: pruned }], reply: 'Pruned GLOSSARY.md.' }, deterministic: { ...rule, writes: only, edits: { 'GLOSSARY.md': pruneMarkers } }, semantic },
    { id: 'spilled', files: { 'GLOSSARY.md': OVERGROWN }, directive: { readSkills: [SKILL], readFiles: [formatCopy], writes: [{ path: 'GLOSSARY.md', text: pruned.replace('## Renewal\n\nA loan extended', '## Renewal\n\nA loan extended, fee capped at 25.00,') }], reply: 'Pruned GLOSSARY.md.' }, deterministic: { ...rule, writes: only, edits: { 'GLOSSARY.md': pruneMarkers } }, semantic },
  ];
  makeSuite(suites, 'mg-e2e', cases, { skills: SUITE_SKILLS });
  const runDir = path.join(scratch, 'runs', 'e2e');
  const expected = { 'via-copy': 'pass', 'via-canonical': 'pass', truncated: 'premise-not-met', 'file-when-none': 'fail', migrated: 'pass', unadopted: 'fail', 'record-allowed': 'pass', 'record-misnumbered': 'fail', confined: 'pass', spilled: 'fail' };
  for (const engine of ['claude', 'codex']) {
    const plan = planRun({ suiteName: 'mg-e2e', suitesRoot: suites, engine, model: engine === 'claude' ? 'claude-opus-5-5' : 'gpt-6.1-sol', effort: 'high', replicates: 1, source: { dir: source }, runDir, executables: fakeExecutables, timeoutSeconds: 60 });
    const records = executeRun(plan, { out: quiet });
    assert.equal(records.length, cases.length, engine);
    for (const record of records) {
      assert.equal(record.status, 'behavioral', `${engine} ${record.case}`);
      assert.equal(record.verdict, expected[record.case], `${record.case} on ${engine}`);
      const inspection = readJson(path.join(runDir, 'attempts', record.case, engine, '001', 'inspection.json'));
      assert.deepEqual(inspection.classifier.sourceAliases[FORMAT], [{ skill: SKILL, path: FORMAT_ALIAS, status: 'alias', header: header(FORMAT) }], `${engine} ${record.case} declares the format alias from the run's source`);
      assert.deepEqual(inspection.classifier.sourceAliases[ADOPTION][0].rewrites, ADOPTION_REWRITE, `${engine} ${record.case} declares the rewritten adoption alias`);
      assert.equal(inspection.checks.some((entry) => entry.id === `sourceReads.${GUIDANCE}`), false, `${engine} ${record.case}: the observed guidance yields no check`);
      assert.equal(inspection.sourceReads[GUIDANCE].body, record.case === 'via-canonical', `${engine} ${record.case}: the observed read is recorded`);
      if (record.case === 'truncated') assert.equal(inspection.sourceReads[FORMAT].partial, true);
      else assert.equal(inspection.sourceReads[FORMAT].body, true, `${engine} ${record.case}`);
      if (record.case === 'via-canonical') assert.deepEqual(inspection.sourceReads[FORMAT].forms, ['canonical']);
      else assert.deepEqual(inspection.sourceReads[FORMAT].forms, ['skill-local'], `${engine} ${record.case}`);
      if (record.case === 'migrated') {
        assert.deepEqual(inspection.files.deleted, ['docs/terms.md']);
        assert.equal(inspection.checks.find((entry) => entry.id === `sourceReads.${ADOPTION}`).pass, true);
        assert.equal(inspection.sourceReads[ADOPTION].body, true);
      }
      if (record.case === 'unadopted') assert.equal(inspection.checks.find((entry) => entry.id === `sourceReads.${ADOPTION}`).pass, false);
      if (record.case === 'file-when-none') assert.match(inspection.checks.find((entry) => entry.id === 'writes.allowed').detail, /changed outside the allowed set: GLOSSARY\.md/);
      if (record.case === 'record-misnumbered') assert.match(inspection.checks.find((entry) => entry.id === 'writes.allowed').detail, /docs\/adr\/0002-household-membership\.md/);
      if (record.case === 'record-allowed') assert.equal(inspection.checks.find((entry) => entry.id === 'writes.allowed').pass, true);
    }
  }
  const spilled = readJson(path.join(runDir, 'attempts', 'spilled', 'codex', '001', 'inspection.json')).checks.find((entry) => entry.id === 'edits.GLOSSARY.md');
  assert.equal(spilled.pass, false);
  const { outcomes } = reinspectRun({ runDir, out: quiet });
  assert.equal(outcomes.length, cases.length * 2);
  for (const outcome of outcomes) {
    assert.equal(outcome.ok, true, outcome.attempt);
    assert.equal(outcome.after.verdict, outcome.before.verdict, outcome.attempt);
  }
});
