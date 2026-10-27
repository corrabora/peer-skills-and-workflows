// The maintained record-decision suite loads and is complete; its premise
// (the skill read, the ADR format read whole through the link-rewritten
// skill-local copy or the canonical path), the `*` pattern in `writes`, the
// `observed` source-read rule and the two confined edits are exercised
// against fake traces in both engines' forms and end to end through the fake
// engine; dry runs on both engines plan the expected attempts. The alias rule
// for link-rewritten copies reads the generator's own rewrite table. No
// network, no paid call.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, test } from 'node:test';
import { WRITING_REFERENCES } from '../../../tools/lib/writing-references.mjs';
import { engineFor } from '../lib/engines.mjs';
import { aliasBodyMatch, editConfinement, inspectAttempt, passageBounds, registeredRewrites, sourceAliases, writeMatches } from '../lib/inspect.mjs';
import { packageRoot, readJson } from '../lib/common.mjs';
import { reinspectRun } from '../lib/reinspect.mjs';
import { describePlan, executeRun, planRun } from '../lib/run.mjs';
import { listSuites, loadSuite, matchesNodeTestPattern } from '../lib/suite.mjs';
import { fakeExecutables, makeSource, makeSuite, temporaryDirectory } from '../test-support/fixtures.mjs';

const scratch = temporaryDirectory('record-decision');
after(() => fs.rmSync(scratch, { recursive: true, force: true }));

const quiet = { info() {}, error() {} };
const SKILL = 'record-decision';
const ADR = 'docs/guidance/adr-format.md';
const ADOPTION = 'docs/guidance/record-format-adoption.md';
const GUIDANCE = 'docs/writing-guidance.md';
const ADR_ALIAS = `skills/${SKILL}/references/adr-format.md`;
const ADOPTION_ALIAS = `skills/${SKILL}/references/record-format-adoption.md`;
const CASE_IDS = [
  'explicit-accepted', 'proposed-standing', 'standing-unknown', 'offer-qualifies', 'offer-none', 'replacement-proposed',
  'correction-in-place', 'numbering-legacy', 'missing-dependency', 'material-cost', 'inline-draft', 'required-by-repository',
  'shared-amendment', 'migration-preserves-information', 'unknown-rationale',
];
const SUITE_SKILLS = ['record-decision', 'write-for-humans', 'write-for-agents', 'clarify-artifact', 'maintain-glossary'];

// The generator's registered rewrites for the two record-decision copies, read from its table, never restated.
const ADR_REWRITE = registeredRewrites(ADR, ADR_ALIAS);
const ADOPTION_REWRITE = registeredRewrites(ADOPTION, ADOPTION_ALIAS);
assert.equal(ADR_REWRITE.length, 1, 'the generator registers one rewrite for the adr-format copy');
assert.equal(ADOPTION_REWRITE.length, 1, 'the generator registers one rewrite for the adoption copy');

// A source tree with the five installed skills, a canonical ADR format whose
// one link the generator rewrites, the adoption reference and the guidance,
// and record-decision's three generated copies: each with a header line, the
// two record formats with their registered link rewritten.
const ADR_TEXT = `# ADR format\n\nMost records need a title and one sentence. Before offering a record, apply\n[the offer test](${ADR_REWRITE[0].from}).\n\n## Location\n\nChoose the next number after the highest in use.\n`;
const ADR_REWRITTEN = ADR_TEXT.replace(`](${ADR_REWRITE[0].from})`, `](${ADR_REWRITE[0].to})`);
const ADOPTION_TEXT = `# Record format adoption\n\nUse the [ADR](adr-format.md) and [glossary](${ADOPTION_REWRITE[0].from}) formats.\n\nNumber new records after existing ones across old and new locations.\n`;
const ADOPTION_REWRITTEN = ADOPTION_TEXT.replace(`](${ADOPTION_REWRITE[0].from})`, `](${ADOPTION_REWRITE[0].to})`);
const GUIDANCE_TEXT = '# Shared guidance\n\nSelect before drafting.\n\n## Deliver\n\n  The receipt is the first line alone.\n';
const header = (relative) => `<!-- Generated from ${relative}. -->`;
const ADR_SIGNATURE = { first: '# ADR format', last: 'Choose the next number after the highest in use.' };
const source = makeSource(path.join(scratch, 'source'), SUITE_SKILLS);
fs.mkdirSync(path.join(source, 'docs', 'guidance'), { recursive: true });
fs.writeFileSync(path.join(source, ADR), ADR_TEXT);
fs.writeFileSync(path.join(source, ADOPTION), ADOPTION_TEXT);
fs.writeFileSync(path.join(source, GUIDANCE), GUIDANCE_TEXT);
fs.mkdirSync(path.join(source, 'skills', SKILL, 'references'), { recursive: true });
fs.writeFileSync(path.join(source, ADR_ALIAS), `${header(ADR)}\n${ADR_REWRITTEN}`);
fs.writeFileSync(path.join(source, ADOPTION_ALIAS), `${header(ADOPTION)}\n${ADOPTION_REWRITTEN}`);
fs.writeFileSync(path.join(source, 'skills', SKILL, 'references', 'writing-guidance.md'), `${header(GUIDANCE)}\n${GUIDANCE_TEXT}`);

test('the record-decision suite loads with its fifteen cases, the ADR-format premise, bounded writes and a certifying criterion each', () => {
  assert.ok(listSuites().includes(SKILL));
  const suite = loadSuite(SKILL);
  assert.equal(suite.skill, SKILL);
  assert.deepEqual(suite.skills, SUITE_SKILLS);
  assert.deepEqual(suite.cases.map((caseDef) => caseDef.id), CASE_IDS);
  for (const caseDef of suite.cases) {
    const prompt = caseDef.prompt.toString('utf8');
    assert.ok(caseDef.effect.length > 20, `${caseDef.id} states its effect`);
    assert.match(prompt, /^Use the `record-decision` skill\.\n/, `${caseDef.id} opens by naming the skill`);
    assert.doesNotMatch(prompt, /Put any question/, `${caseDef.id} carries no closing invitation line`);
    assert.ok(prompt.endsWith('.\n') && !prompt.endsWith('\n\n'), `${caseDef.id} ends with one newline`);
    assert.ok('README.md' in caseDef.fixtureManifest, `${caseDef.id} has the workspace README`);
    assert.deepEqual(caseDef.deterministic.skillReads, { [SKILL]: 'required' }, `${caseDef.id} requires the skill and constrains no other skill's loading`);
    assert.equal(caseDef.deterministic.sourceReads[GUIDANCE], 'observed', `${caseDef.id} observes the guidance read, never certifying it`);
    assert.equal(caseDef.deterministic.sourceReads[ADOPTION], ['numbering-legacy', 'migration-preserves-information'].includes(caseDef.id) ? 'required' : 'observed', `${caseDef.id} requires the adoption reference only where the legacy log needs it`);
    if (caseDef.id === 'offer-none') {
      assert.equal(caseDef.deterministic.sourceReads[ADR], 'observed', 'nothing is written, so the format read is observed only');
      assert.deepEqual(caseDef.deterministic.premise, [`skillReads.${SKILL}`]);
      assert.deepEqual(caseDef.deterministic.writes, { allowed: [] });
    } else {
      assert.equal(caseDef.deterministic.sourceReads[ADR], 'required', `${caseDef.id} requires the ADR format`);
      assert.deepEqual(caseDef.deterministic.premise, [`skillReads.${SKILL}`, `sourceReads.${ADR}`], `${caseDef.id} makes the skill and the format its premise`);
    }
    assert.equal(caseDef.deterministic.claimedArtifacts, true, `${caseDef.id} checks claimed artifacts`);
    assert.ok(caseDef.semantic.some((criterion) => criterion.observe !== true), `${caseDef.id} has at least one certifying criterion`);
    for (const criterion of caseDef.semantic) assert.ok(criterion.criterion.length > 25, `${caseDef.id}/${criterion.id} states what the grader judges`);
  }
  // The engine chooses the number and slug, so the written file is a pattern; the two in-place cases name their file.
  const writes = Object.fromEntries(suite.cases.map((caseDef) => [caseDef.id, caseDef.deterministic.writes]));
  for (const id of ['explicit-accepted', 'proposed-standing', 'standing-unknown', 'offer-qualifies', 'replacement-proposed', 'missing-dependency', 'material-cost', 'required-by-repository']) {
    assert.deepEqual(writes[id], { allowed: ['docs/adr/0004-*.md', 'DECISION-LOG.md', 'README.md'], required: ['docs/adr/0004-*.md', 'DECISION-LOG.md'] }, id);
  }
  assert.deepEqual(writes['numbering-legacy'], { allowed: ['docs/adr/0010-*.md', 'records/decisions-log.md', 'DECISION-LOG.md', 'README.md'], required: ['docs/adr/0010-*.md', 'DECISION-LOG.md', 'records/decisions-log.md'] });
  assert.deepEqual(writes['correction-in-place'], { allowed: ['docs/adr/0003-rent-letters-from-register.md'], required: ['docs/adr/0003-rent-letters-from-register.md'] });
  assert.deepEqual(writes['inline-draft'], { allowed: [] });
  for (const id of ['shared-amendment', 'migration-preserves-information', 'unknown-rationale']) {
    assert.ok(writes[id].required.includes('DECISION-LOG.md'), `${id} requires its index`);
    assert.deepEqual(writes[id].allowed, writes[id].required, `${id} bounds its entire write set`);
  }
  assert.equal(writes['shared-amendment'].required.filter((p) => p.includes('*')).length, 1, 'one new ADR for the shared choice');
  assert.deepEqual(writes['migration-preserves-information'].required, ['DECISION-LOG.md', 'docs/adr/0013-*.md', 'docs/adr/0041-*.md']);
  // The confined edits: the correction below the title line; the legacy log below its title.
  const edits = Object.fromEntries(suite.cases.filter((caseDef) => caseDef.deterministic.edits).map((caseDef) => [caseDef.id, caseDef.deterministic.edits]));
  assert.deepEqual(edits, {
    'correction-in-place': { 'docs/adr/0003-rent-letters-from-register.md': { after: '# ADR-0003: Rent letters generated from the register' } },
    'numbering-legacy': { 'records/decisions-log.md': { after: '# Decisions log' } },
  });
  // Observe-only criteria: the engine's own question everywhere; the write-for-humans and guidance reads (OG-0090, OG-0099);
  // the receipt rubric in the receipt cases; the question's shape where a question is plausible.
  const observed = Object.fromEntries(suite.cases.map((caseDef) => [caseDef.id, caseDef.semantic.filter((criterion) => criterion.observe === true).map((criterion) => criterion.id)]));
  assert.deepEqual(observed, {
    'explicit-accepted': ['no-question', 'write-for-humans-read', 'writing-guidance-read', 'receipt-sentence-counts'],
    'proposed-standing': ['no-question', 'write-for-humans-read', 'writing-guidance-read', 'receipt-sentence-counts'],
    'standing-unknown': ['no-question', 'question-shape', 'write-for-humans-read', 'writing-guidance-read', 'receipt-sentence-counts'],
    'offer-qualifies': ['no-question', 'write-for-humans-read', 'writing-guidance-read'],
    'offer-none': ['no-question', 'writing-guidance-read'],
    'replacement-proposed': ['no-question', 'write-for-humans-read', 'writing-guidance-read'],
    'correction-in-place': ['no-question', 'write-for-humans-read', 'writing-guidance-read', 'receipt-sentence-counts'],
    'numbering-legacy': ['no-question', 'write-for-humans-read', 'writing-guidance-read'],
    'missing-dependency': ['no-question', 'question-shape', 'write-for-humans-read', 'writing-guidance-read'],
    'material-cost': ['no-question', 'write-for-humans-read', 'writing-guidance-read', 'receipt-sentence-counts'],
    'inline-draft': ['no-question', 'write-for-humans-read', 'writing-guidance-read'],
    'required-by-repository': ['no-question', 'write-for-humans-read', 'writing-guidance-read'],
    'shared-amendment': ['no-question', 'write-for-humans-read', 'writing-guidance-read'],
    'migration-preserves-information': ['no-question', 'write-for-humans-read', 'writing-guidance-read'],
    'unknown-rationale': ['no-question', 'write-for-humans-read', 'writing-guidance-read'],
  });
  const criterion = (id, criterionId) => suite.cases.find((caseDef) => caseDef.id === id).semantic.find((entry) => entry.id === criterionId);
  for (const id of ['explicit-accepted', 'proposed-standing', 'standing-unknown', 'correction-in-place', 'material-cost']) {
    const rubric = criterion(id, 'receipt-sentence-counts');
    assert.match(rubric.criterion, /preface\/contents\/offers\/recital\/assurance/, `${id} names the counts in full`);
    assert.match(rubric.criterion, /not the cycle015 item rubric/, `${id} distinguishes the rubric`);
    assert.doesNotMatch(rubric.criterion, /P\/C\/O\/R\/A/, `${id} does not use the colliding labels`);
  }
  assert.match(criterion('explicit-accepted', 'write-for-humans-read').criterion, /inspection\.json/);
  assert.match(criterion('explicit-accepted', 'writing-guidance-read').criterion, /inspection\.json/);
  // The certifying criteria name the plausible wrong answers and cannot pass vacuously.
  assert.match(criterion('explicit-accepted', 'record-shape').criterion, /Context, Decision and Consequences/);
  assert.match(criterion('explicit-accepted', 'discussion-not-reproduced').criterion, /Does not narrate speaker preferences/);
  assert.match(criterion('proposed-standing', 'pending-not-accepted').criterion, /written as an accepted decision fails/);
  assert.match(criterion('standing-unknown', 'no-inferred-acceptance').criterion, /not Accepted or Proposed/);
  assert.match(criterion('standing-unknown', 'no-inferred-acceptance').criterion, /missing historical approval and date are not invented/);
  assert.match(criterion('offer-qualifies', 'only-rent-rule-recorded').criterion, /duplicate-number check/);
  assert.match(criterion('offer-qualifies', 'test-in-one-sentence').criterion, /yes or no each fails/);
  assert.match(criterion('offer-none', 'nothing-recorded').criterion, /rota spreadsheet/);
  assert.match(criterion('replacement-proposed', 'old-record-in-force').criterion, /"Superseded by"/);
  assert.match(criterion('correction-in-place', 'standing-and-shape-kept').criterion, /amendment notice or a second record fails/);
  assert.match(criterion('numbering-legacy', 'numbered-after-legacy').criterion, /numbered 0008/);
  assert.match(criterion('numbering-legacy', 'log-entries-unchanged').criterion, /Any change to an entry fails/);
  assert.match(criterion('missing-dependency', 'no-dependent-draft').criterion, /example of what the finance record would look like, fails/);
  assert.match(criterion('material-cost', 'cost-preserved').criterion, /without that cost fails/);
  assert.match(criterion('inline-draft', 'qualifications-inline').criterion, /without the standing sentence fails/);
  assert.match(criterion('required-by-repository', 'recorded-under-requirement').criterion, /declines because the change is routine/);
  for (const id of ['explicit-accepted', 'proposed-standing', 'standing-unknown', 'offer-qualifies', 'replacement-proposed', 'numbering-legacy', 'material-cost', 'required-by-repository']) {
    assert.match(criterion(id, 'receipt-number-check').criterion, /number-selection story, fails/, `${id} requires the pending number check`);
  }
  assert.equal(loadSuite(SKILL).hash, suite.hash);
});

test('no fixture path matches a Node test pattern, no fixture echoes the skill or the format, and each case\'s trap is in place', () => {
  const suite = loadSuite(SKILL);
  for (const relative of Object.keys(suite.manifest)) {
    assert.equal(matchesNodeTestPattern(relative), false, relative);
    assert.ok(!relative.split('/').includes('test'), relative);
  }
  const fixture = (id, relative) => fs.readFileSync(path.join(suite.cases.find((caseDef) => caseDef.id === id).workspace, ...relative.split('/')), 'utf8');
  for (const caseDef of suite.cases) {
    for (const relative of Object.keys(caseDef.fixtureManifest)) {
      const text = fs.readFileSync(path.join(caseDef.workspace, relative), 'utf8');
      assert.doesNotMatch(text, /record-decision|write-for-humans|write-for-agents|clarify-artifact|delivery receipt|offer test|house format|ADR format|Standing unknown|Proposed:|Rejected:|Superseded by|Amended by|provisional/i, `${caseDef.id}/${relative}`);
    }
    // Every base fixture carries records 0001 to 0003 in the house shape, except the legacy variant.
    if (!['numbering-legacy', 'shared-amendment', 'migration-preserves-information', 'unknown-rationale'].includes(caseDef.id)) {
      for (const file of ['docs/adr/0001-register-as-one-csv.md', 'docs/adr/0002-waiting-list-by-application-date.md', 'docs/adr/0003-rent-letters-from-register.md']) {
        assert.ok(file in caseDef.fixtureManifest, `${caseDef.id} has ${file}`);
      }
      assert.equal(Object.keys(caseDef.fixtureManifest).filter((relative) => relative.startsWith('docs/adr/')).length, 3, `${caseDef.id} has exactly three records, so the next number is 0004`);
    }
  }
  // The legacy variant: the log's highest number is 9, docs/adr/ holds 0006 and 0007, so the next number is 0010 and docs/adr/ alone would give 0008.
  const legacy = suite.cases.find((caseDef) => caseDef.id === 'numbering-legacy');
  assert.deepEqual(Object.keys(legacy.fixtureManifest).filter((relative) => relative.startsWith('docs/adr/')).sort(), ['docs/adr/0006-register-as-one-csv.md', 'docs/adr/0007-waiting-list-by-application-date.md']);
  const log = fixture('numbering-legacy', 'records/decisions-log.md');
  assert.deepEqual([...log.matchAll(/^## D-(\d+) /gm)].map((match) => Number(match[1])), [1, 2, 3, 4, 5, 8, 9]);
  assert.match(log, /Status: accepted/, 'the legacy entries carry the old shape for the engine to leave alone');
  assert.match(log, /\(\.\.\/docs\/adr\/0007-waiting-list-by-application-date\.md\)/, 'the log already points at the records filed in docs/adr/');
  // The correction: the record says April, its minute says March, and the marker line occurs once.
  assert.match(fixture('correction-in-place', 'docs/adr/0003-rent-letters-from-register.md'), /each April/);
  assert.match(fixture('correction-in-place', 'minutes/2025-03-plots.md'), /each March/);
  for (const [id, relative] of [['correction-in-place', 'docs/adr/0003-rent-letters-from-register.md'], ['numbering-legacy', 'records/decisions-log.md']]) {
    const caseDef = suite.cases.find((candidate) => candidate.id === id);
    assert.doesNotThrow(() => passageBounds(fixture(id, relative), caseDef.deterministic.edits[relative]), `${id} markers occur once`);
  }
  // The missing dependency: the finance minutes are absent and the plots minutes mention the finance matter as bait.
  const missing = suite.cases.find((caseDef) => caseDef.id === 'missing-dependency');
  assert.ok(!('minutes/2026-09-finance.md' in missing.fixtureManifest), 'the finance minutes are absent');
  assert.match(fixture('missing-dependency', 'minutes/2026-09-plots.md'), /bank mandate/);
  // The offer cases: only the rent rule is costly to reverse; the "none" minutes carry no such item.
  assert.match(fixture('offer-qualifies', 'minutes/2026-10-plots.md'), /Reversing it later would\s+mean/);
  assert.doesNotMatch(fixture('offer-none', 'minutes/2026-10-plots.md'), /Reversing|rent/i);
  // The standing-unknown sources: a script that applies the rule and a note that no minute was found; no acceptance anywhere.
  assert.match(fixture('standing-unknown', 'notes/keeper-handover-2019.md'), /found none/);
  assert.doesNotMatch(fixture('standing-unknown', 'tools/rent-letters.md'), /decided|agreed|accepted|approved/i);
  // The material cost sits in the decision sentence of the minutes, so a record that keeps it needs nothing invented.
  assert.match(fixture('material-cost', 'minutes/2026-10-plots.md'), /the east-row error stands/);
  // The repository requirement lives only in that case's README.
  assert.match(fixture('required-by-repository', 'README.md'), /Every change to the rent rules/);
  assert.doesNotMatch(fixture('explicit-accepted', 'README.md'), /Every change to the rent rules/);
  // Every README names the integration target the number check refers to.
  for (const caseDef of suite.cases) assert.match(fixture(caseDef.id, 'README.md'), /(?:merges changes to `main`|integrate into main)/, caseDef.id);
});

test('dry runs on both engines plan three replicates of every case with the fake engine, show the pattern and observed expectations, and write nothing', () => {
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
    const first = described.attempts.find((attempt) => attempt.case === 'explicit-accepted');
    assert.deepEqual(first.expectations.writes, { allowed: ['docs/adr/0004-*.md', 'DECISION-LOG.md', 'README.md'], required: ['docs/adr/0004-*.md', 'DECISION-LOG.md'] }, `${engine} prints the pattern`);
    assert.equal(first.expectations.sourceReads[GUIDANCE], 'observed', `${engine} prints the observed rule`);
    assert.deepEqual(first.premise, [`skillReads.${SKILL}`, `sourceReads.${ADR}`]);
    assert.equal(fs.existsSync(runDir), false, `${engine} dry run writes nothing`);
  }
});

// --- the link-rewritten alias rule ---

test('a link-rewritten copy is an alias when it equals the canonical body after the registered rewrites, with the rewrite recorded; any other change stays stale', () => {
  const rewrite = ADR_REWRITE;
  // As before: identical, or identical after a header line, with no rewrite recorded.
  assert.deepEqual(aliasBodyMatch(ADR_TEXT, ADR_TEXT, rewrite), { status: 'alias', header: null });
  assert.deepEqual(aliasBodyMatch(ADR_TEXT, `${header(ADR)}\n${ADR_TEXT}`, rewrite), { status: 'alias', header: header(ADR) });
  // The generated shape: header plus the body with the registered link rewritten.
  assert.deepEqual(aliasBodyMatch(ADR_TEXT, `${header(ADR)}\n${ADR_REWRITTEN}`, rewrite), { status: 'alias', header: header(ADR), rewrites: rewrite });
  assert.deepEqual(aliasBodyMatch(ADR_TEXT, ADR_REWRITTEN, rewrite), { status: 'alias', header: null, rewrites: rewrite }, 'without a header line');
  assert.deepEqual(aliasBodyMatch(ADR_TEXT, `${header(ADR)}\n\n${ADR_REWRITTEN.replace(/\n/g, '\r\n')}`, rewrite), { status: 'alias', header: header(ADR), rewrites: rewrite }, 'line endings and a blank line after the header are tolerated');
  // Without the generator's rewrites the same copy is stale, as before (nothing is guessed from the link text).
  assert.deepEqual(aliasBodyMatch(ADR_TEXT, `${header(ADR)}\n${ADR_REWRITTEN}`), { status: 'stale-alias', header: null });
  // A rewrite that does not occur in the canonical text makes no match and is not recorded.
  assert.deepEqual(aliasBodyMatch(ADR_TEXT, `${header(ADR)}\n${ADR_REWRITTEN}`, [{ from: 'absent.md', to: 'elsewhere.md' }]), { status: 'stale-alias', header: null });
  // The rewrite plus any other change is stale; so is the rewrite applied in the wrong direction or to a different link.
  assert.deepEqual(aliasBodyMatch(ADR_TEXT, `${header(ADR)}\n${ADR_REWRITTEN.replace('one sentence', 'one sentence, cited')}`, rewrite), { status: 'stale-alias', header: null });
  assert.deepEqual(aliasBodyMatch(ADOPTION_TEXT, `${header(ADOPTION)}\n${ADOPTION_TEXT.replace('](adr-format.md)', `](${ADOPTION_REWRITE[0].to})`)}`, ADOPTION_REWRITE), { status: 'stale-alias', header: null }, 'the rewrite applied to a different link');
  assert.deepEqual(aliasBodyMatch(ADOPTION_TEXT, `${header(ADOPTION)}\n${ADOPTION_REWRITTEN}`, ADOPTION_REWRITE), { status: 'alias', header: header(ADOPTION), rewrites: ADOPTION_REWRITE });
  assert.deepEqual(aliasBodyMatch(ADR_TEXT, `${header(ADR)}\n${ADR_REWRITTEN.replace(`](${rewrite[0].to})`, `](${rewrite[0].to}-x)`)}`, rewrite), { status: 'stale-alias', header: null });
  // Only the rewrites that occurred are recorded when several are registered.
  const both = [{ from: 'absent.md', to: 'elsewhere.md' }, ...rewrite];
  assert.deepEqual(aliasBodyMatch(ADR_TEXT, `${header(ADR)}\n${ADR_REWRITTEN}`, both), { status: 'alias', header: header(ADR), rewrites: rewrite });
});

test('registered rewrites come from the generator\'s table, keyed by copy path and owner, and the real copies in the checkout resolve as aliases', () => {
  const table = Object.fromEntries(WRITING_REFERENCES.map((reference) => [reference.file, reference]));
  assert.deepEqual(ADR_REWRITE, Object.entries(table[ADR_ALIAS].rewrites).map(([from, to]) => ({ from, to })));
  assert.deepEqual(ADOPTION_REWRITE, Object.entries(table[ADOPTION_ALIAS].rewrites).map(([from, to]) => ({ from, to })));
  assert.deepEqual(registeredRewrites(GUIDANCE, `skills/${SKILL}/references/writing-guidance.md`), [], 'the guidance copy has no registered rewrite');
  assert.deepEqual(registeredRewrites(GUIDANCE, ADR_ALIAS), [], 'a copy of another owner has none');
  assert.deepEqual(registeredRewrites(ADR, 'skills/other/references/adr-format.md'), [], 'an unregistered copy has none');
  // The checkout's own generated copies, which `node tools/verify.mjs` holds to the generator's output.
  const real = sourceAliases(packageRoot, [ADR, ADOPTION, GUIDANCE]);
  const mine = (relative) => real[relative].find((alias) => alias.skill === SKILL);
  assert.deepEqual([mine(ADR).status, mine(ADR).rewrites], ['alias', ADR_REWRITE]);
  assert.deepEqual([mine(ADOPTION).status, mine(ADOPTION).rewrites], ['alias', ADOPTION_REWRITE]);
  assert.deepEqual([mine(GUIDANCE).status, mine(GUIDANCE).rewrites], ['alias', undefined]);
  assert.match(mine(ADR).header, /Generated from docs\/guidance\/adr-format\.md/);
});

test('aliases resolved from a source tree record the rewrite that made the match, and a copy with an unregistered change is stale', () => {
  const declared = sourceAliases(source, [ADR, ADOPTION, GUIDANCE]);
  assert.deepEqual(declared[ADR], [{ skill: SKILL, path: ADR_ALIAS, status: 'alias', header: header(ADR), rewrites: ADR_REWRITE }]);
  assert.deepEqual(declared[ADOPTION], [{ skill: SKILL, path: ADOPTION_ALIAS, status: 'alias', header: header(ADOPTION), rewrites: ADOPTION_REWRITE }]);
  assert.deepEqual(declared[GUIDANCE], [{ skill: SKILL, path: `skills/${SKILL}/references/writing-guidance.md`, status: 'alias', header: header(GUIDANCE) }]);
  // A copy under another skill with the same rewritten body is not a registered reference of that owner: stale.
  const other = makeSource(path.join(scratch, 'source-other'), SUITE_SKILLS);
  fs.mkdirSync(path.join(other, 'docs', 'guidance'), { recursive: true });
  fs.writeFileSync(path.join(other, ADR), ADR_TEXT);
  fs.mkdirSync(path.join(other, 'skills', 'write-for-humans', 'references'), { recursive: true });
  fs.writeFileSync(path.join(other, 'skills', 'write-for-humans', 'references', 'adr-format.md'), `${header(ADR)}\n${ADR_REWRITTEN}`);
  fs.mkdirSync(path.join(other, 'skills', SKILL, 'references'), { recursive: true });
  fs.writeFileSync(path.join(other, ADR_ALIAS), `${header(ADR)}\n${ADR_REWRITTEN.replace('Most records', 'Most decision records')}`);
  assert.deepEqual(sourceAliases(other, [ADR])[ADR], [
    { skill: SKILL, path: ADR_ALIAS, status: 'stale-alias', header: null },
    { skill: 'write-for-humans', path: 'skills/write-for-humans/references/adr-format.md', status: 'stale-alias', header: null },
  ]);
});

// --- the premise, the pattern and the observed rule against fake traces in both engines' forms ---

const claudeTrace = (calls) => calls.map(([name, input, output], index) => [
  JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', id: `t${index}`, name, input }] } }),
  output === null ? null : JSON.stringify({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: `t${index}`, content: output }] } }),
].filter(Boolean).join('\n')).join('\n');
const codexTrace = (commands) => commands.map(([command, output], index) => JSON.stringify({ type: 'item.completed', item: { id: `i${index}`, type: 'command_execution', command: `/bin/zsh -lc ${JSON.stringify(command)}`, aggregated_output: output, exit_code: 0, status: 'completed' } })).join('\n');
const numbered = (text) => text.split('\n').map((line, index) => `${index + 1}\t${line}`).join('\n');
const claudeEvents = (calls) => engineFor('claude').events(claudeTrace(calls));
const codexEvents = (commands) => engineFor('codex').events(codexTrace(commands));

test('the premise is met by the skill read with the ADR format read through the link-rewritten copy or the canonical path, on both engines; the written record matches its pattern; the observed guidance yields no check', () => {
  const suite = loadSuite(SKILL);
  const caseDef = suite.cases.find((candidate) => candidate.id === 'explicit-accepted');
  const workspace = path.join(scratch, 'inspect-ws');
  fs.cpSync(caseDef.workspace, workspace, { recursive: true });
  fs.writeFileSync(path.join(workspace, 'docs', 'adr', '0004-composting-toilet.md'), '# ADR-0004: Composting toilet\n\nReplace the chemical toilet with a composting toilet.\n');
  fs.writeFileSync(path.join(workspace, 'DECISION-LOG.md'), '# Decision log\n\n[ADR-0004](docs/adr/0004-composting-toilet.md)\n');
  const skillBody = (skill) => fs.readFileSync(path.join(source, 'skills', skill, 'SKILL.md'), 'utf8');
  const skillSignatures = Object.fromEntries(SUITE_SKILLS.map((skill) => [skill, { name: skill, heading: skill }]));
  const exit = { status: 0, signal: null, timedOut: false, seconds: 1 };
  const inspect = (events, finalReply = 'Saved docs/adr/0004-composting-toilet.md. Recheck provisional ADR-0004 against main before integration.') => inspectAttempt({ caseDef, skills: SUITE_SKILLS, events, finalReply, workspace, fixtureManifest: caseDef.fixtureManifest, exit, effective: {}, signatures: skillSignatures, sourceRoot: source });
  const check = (inspection, id) => inspection.checks.find((entry) => entry.id === id);
  const copyText = `${header(ADR)}\n${ADR_REWRITTEN}`;

  // Claude: the skill through its link, the format through the rewritten skill-local copy.
  const claudeSkill = ['Read', { file_path: `/ws/.claude/skills/${SKILL}/SKILL.md` }, numbered(skillBody(SKILL))];
  const viaCopy = inspect(claudeEvents([claudeSkill, ['Read', { file_path: `/ws/.claude/skills/${SKILL}/references/adr-format.md` }, numbered(copyText)]]));
  assert.equal(viaCopy.verdict, 'pass');
  assert.deepEqual([check(viaCopy, `skillReads.${SKILL}`).kind, check(viaCopy, `skillReads.${SKILL}`).pass, check(viaCopy, `sourceReads.${ADR}`).kind, check(viaCopy, `sourceReads.${ADR}`).pass], ['premise', true, 'premise', true]);
  assert.deepEqual([viaCopy.sourceReads[ADR].forms, viaCopy.sourceReads[ADR].skillLocal], [['skill-local'], [SKILL]]);
  assert.match(check(viaCopy, `sourceReads.${ADR}`).detail, /read through skill-local copy \(record-decision\)/);
  assert.deepEqual(viaCopy.classifier.sourceAliases[ADR], [{ skill: SKILL, path: ADR_ALIAS, status: 'alias', header: header(ADR), rewrites: ADR_REWRITE }], 'the inspection records which rewrite made the match');
  assert.deepEqual(viaCopy.classifier.sourceSignatures[ADR], ADR_SIGNATURE);
  assert.equal(viaCopy.classifier.version, 9);
  // The pattern: the created file matches docs/adr/0004-*.md for both the allowed and the required check.
  assert.deepEqual(viaCopy.files.created, ['DECISION-LOG.md', 'docs/adr/0004-composting-toilet.md']);
  assert.deepEqual([check(viaCopy, 'writes.allowed').pass, check(viaCopy, 'writes.required').pass], [true, true]);
  assert.equal(check(viaCopy, 'writes.required').detail, 'written: docs/adr/0004-*.md (docs/adr/0004-composting-toilet.md), DECISION-LOG.md');
  // The observed guidance: classified and recorded, no check, whether read or not.
  assert.equal(check(viaCopy, `sourceReads.${GUIDANCE}`), undefined, 'an observed file yields no check');
  assert.equal(viaCopy.sourceReads[GUIDANCE].body, false);
  const withGuidance = inspect(claudeEvents([claudeSkill, ['Read', { file_path: `/ws/.claude/skills/${SKILL}/references/adr-format.md` }, numbered(copyText)], ['Read', { file_path: `/ws/.claude/skills/${SKILL}/references/writing-guidance.md` }, numbered(`${header(GUIDANCE)}\n${GUIDANCE_TEXT}`)]]));
  assert.equal(withGuidance.sourceReads[GUIDANCE].body, true, 'recorded for the grader');
  assert.deepEqual(withGuidance.sourceReads[GUIDANCE].forms, ['skill-local']);
  assert.equal(check(withGuidance, `sourceReads.${GUIDANCE}`), undefined);
  assert.equal(check(withGuidance, `sourceReads.${ADOPTION}`), undefined, 'the adoption reference is observed in this case');
  assert.equal(withGuidance.verdict, 'pass');
  // Claude: the canonical path under the materialized source.
  const viaCanonical = inspect(claudeEvents([claudeSkill, ['Read', { file_path: path.join(source, ADR) }, numbered(ADR_TEXT)]]));
  assert.equal(viaCanonical.verdict, 'pass');
  assert.deepEqual(viaCanonical.sourceReads[ADR].forms, ['canonical']);
  // Claude: only the first lines of the copy came back; the skill never read.
  const partial = inspect(claudeEvents([claudeSkill, ['Read', { file_path: `/ws/.claude/skills/${SKILL}/references/adr-format.md`, limit: 2 }, numbered(`${header(ADR)}\n# ADR format`)]]));
  assert.equal(partial.verdict, 'premise-not-met');
  assert.match(check(partial, `sourceReads.${ADR}`).detail, /partly returned through skill-local copy \(record-decision\)/);
  const noSkill = inspect(claudeEvents([['Read', { file_path: `/ws/.claude/skills/${SKILL}/references/adr-format.md` }, numbered(copyText)]]));
  assert.equal(noSkill.verdict, 'premise-not-met');
  // Claude: a record under the wrong number fails both write checks, outside the premise.
  fs.writeFileSync(path.join(workspace, 'docs', 'adr', '0005-composting-toilet.md'), '# ADR-0005: Composting toilet\n');
  const wrongNumber = inspect(claudeEvents([claudeSkill, ['Read', { file_path: `/ws/.claude/skills/${SKILL}/references/adr-format.md` }, numbered(copyText)]]));
  assert.equal(wrongNumber.verdict, 'fail');
  assert.equal(check(wrongNumber, 'writes.allowed').pass, false);
  assert.match(check(wrongNumber, 'writes.allowed').detail, /changed outside the allowed set: docs\/adr\/0005-composting-toilet\.md/);
  fs.rmSync(path.join(workspace, 'docs', 'adr', '0005-composting-toilet.md'));
  fs.renameSync(path.join(workspace, 'docs', 'adr', '0004-composting-toilet.md'), path.join(workspace, 'docs', 'adr', '0005-composting-toilet.md'));
  const onlyWrong = inspect(claudeEvents([claudeSkill, ['Read', { file_path: `/ws/.claude/skills/${SKILL}/references/adr-format.md` }, numbered(copyText)]]), 'Saved docs/adr/0005-composting-toilet.md.');
  assert.equal(onlyWrong.verdict, 'fail');
  assert.equal(check(onlyWrong, 'writes.required').detail, 'not written: docs/adr/0004-*.md');
  fs.renameSync(path.join(workspace, 'docs', 'adr', '0005-composting-toilet.md'), path.join(workspace, 'docs', 'adr', '0004-composting-toilet.md'));

  // Codex: shell reads of the same files through the .agents link.
  const codexSkill = [`cat .agents/skills/${SKILL}/SKILL.md`, skillBody(SKILL)];
  const codexCopy = inspect(codexEvents([codexSkill, [`cat .agents/skills/${SKILL}/references/adr-format.md`, copyText]]));
  assert.equal(codexCopy.verdict, 'pass');
  assert.deepEqual([codexCopy.sourceReads[ADR].forms, codexCopy.sourceReads[ADR].skillLocal], [['skill-local'], [SKILL]]);
  assert.deepEqual(codexCopy.classifier.sourceAliases[ADR][0].rewrites, ADR_REWRITE);
  const codexCanonical = inspect(codexEvents([codexSkill, [`cat -n '${path.join(source, ADR)}'`, numbered(ADR_TEXT)]]));
  assert.equal(codexCanonical.verdict, 'pass');
  const codexChunked = inspect(codexEvents([codexSkill, [`head -n 3 .agents/skills/${SKILL}/references/adr-format.md`, `${header(ADR)}\n# ADR format\n`], [`tail -n +4 .agents/skills/${SKILL}/references/adr-format.md`, ADR_REWRITTEN.split('\n').slice(2).join('\n')]]));
  assert.equal(codexChunked.verdict, 'pass', 'chunks through the copy join');
  const codexListed = inspect(codexEvents([codexSkill, [`ls -l .agents/skills/${SKILL}/references/adr-format.md`, null]]));
  assert.equal(codexListed.verdict, 'premise-not-met');
  assert.equal(codexListed.sourceReads[ADR].listing, true);
  // Codex: a stale copy of the format (unregistered change) never counts.
  const stale = makeSource(path.join(scratch, 'source-stale'), SUITE_SKILLS);
  fs.mkdirSync(path.join(stale, 'docs', 'guidance'), { recursive: true });
  fs.writeFileSync(path.join(stale, ADR), ADR_TEXT);
  fs.mkdirSync(path.join(stale, 'skills', SKILL, 'references'), { recursive: true });
  fs.writeFileSync(path.join(stale, ADR_ALIAS), `${header(ADR)}\n${ADR_REWRITTEN.replace('Most records', 'Most decision records')}`);
  const staleRead = inspectAttempt({ caseDef, skills: SUITE_SKILLS, events: codexEvents([codexSkill, [`cat .agents/skills/${SKILL}/references/adr-format.md`, copyText]]), finalReply: 'Saved docs/adr/0004-composting-toilet.md.', workspace, fixtureManifest: caseDef.fixtureManifest, exit, effective: {}, signatures: skillSignatures, sourceRoot: stale });
  assert.equal(staleRead.verdict, 'premise-not-met');
  assert.equal(staleRead.sourceReads[ADR].staleAlias, true);
  assert.deepEqual(staleRead.classifier.sourceAliases[ADR], [{ skill: SKILL, path: ADR_ALIAS, status: 'stale-alias', header: null }]);
});

test('a writes entry matches literally or as a single-segment pattern, and the loader refuses other glob syntax', () => {
  assert.equal(writeMatches('docs/adr/0004-*.md', 'docs/adr/0004-composting-toilet.md'), true);
  assert.equal(writeMatches('docs/adr/0004-*.md', 'docs/adr/0004-.md'), true, 'a star may match nothing');
  assert.equal(writeMatches('docs/adr/0004-*.md', 'docs/adr/0005-composting-toilet.md'), false);
  assert.equal(writeMatches('docs/adr/0004-*.md', 'docs/adr/0004-x/y.md'), false, 'a star does not cross a slash');
  assert.equal(writeMatches('docs/adr/0004-*.md', 'archive/docs/adr/0004-x.md'), false, 'the pattern is anchored');
  assert.equal(writeMatches('docs/adr/*-*.md', 'docs/adr/0004-composting-toilet.md'), true);
  assert.equal(writeMatches('docs/adr/0004-toilet.md', 'docs/adr/0004-toilet.md'), true);
  assert.equal(writeMatches('docs/adr/0004-toilet.md', 'docs/adr/0004-toilet2.md'), false);
  assert.equal(writeMatches('docs/adr/0004.md', 'docs/adr/0004Xmd'), false, 'a dot is literal');
  const suites = path.join(scratch, 'suites-patterns');
  makeSuite(suites, 'pattern-ok', [{ id: 'one', deterministic: { exit: 0, skillReads: {}, premise: [], writes: { allowed: ['docs/adr/0004-*.md', 'DECISION-LOG.md', 'README.md'], required: ['docs/adr/0004-*.md', 'DECISION-LOG.md'] } } }]);
  assert.deepEqual(loadSuite('pattern-ok', suites).cases[0].deterministic.writes, { allowed: ['docs/adr/0004-*.md', 'DECISION-LOG.md', 'README.md'], required: ['docs/adr/0004-*.md', 'DECISION-LOG.md'] });
  for (const [label, entry] of [['double-star', 'docs/**/x.md'], ['question', 'docs/adr/000?.md'], ['brace', 'docs/adr/{a,b}.md'], ['bracket', 'docs/adr/[0-9].md']]) {
    makeSuite(suites, `pattern-${label}`, [{ id: 'one', deterministic: { exit: 0, skillReads: {}, premise: [], writes: { allowed: [entry] } } }]);
    assert.throws(() => loadSuite(`pattern-${label}`, suites), /writes\.allowed must be a list of relative paths, each optionally carrying '\*' within a path segment/, label);
  }
  // The observed rule loads, is never a premise, and the old rules are refused as before.
  makeSuite(suites, 'observed-ok', [{ id: 'one', deterministic: { exit: 0, skillReads: {}, sourceReads: { [GUIDANCE]: 'observed' }, premise: [], writes: {} } }]);
  assert.equal(loadSuite('observed-ok', suites).cases[0].deterministic.sourceReads[GUIDANCE], 'observed');
  makeSuite(suites, 'observed-premise', [{ id: 'one', deterministic: { exit: 0, skillReads: {}, sourceReads: { [GUIDANCE]: 'observed' }, premise: [`sourceReads.${GUIDANCE}`], writes: {} } }]);
  assert.throws(() => loadSuite('observed-premise', suites), /premise 'sourceReads.docs\/writing-guidance.md' names an observed source file, which yields no check/);
  makeSuite(suites, 'observed-bad', [{ id: 'one', deterministic: { exit: 0, skillReads: {}, sourceReads: { [GUIDANCE]: 'watched' }, premise: [], writes: {} } }]);
  assert.throws(() => loadSuite('observed-bad', suites), /sourceReads.docs\/writing-guidance.md must be 'required' or 'forbidden'/);
});

// --- the confined edits against the real fixtures ---

test('the correction and legacy-log markers bound the body below each title, and only a change inside it is confined', () => {
  const suite = loadSuite(SKILL);
  const correction = suite.cases.find((candidate) => candidate.id === 'correction-in-place');
  const record = fs.readFileSync(path.join(correction.workspace, 'docs', 'adr', '0003-rent-letters-from-register.md'), 'utf8');
  const markers = correction.deterministic.edits['docs/adr/0003-rent-letters-from-register.md'];
  const bounds = passageBounds(record, markers);
  assert.equal(record.slice(bounds.start, bounds.end).includes('each April'), true, 'the passage is the body');
  assert.equal(record.slice(0, bounds.start), '# ADR-0003: Rent letters generated from the register\n');
  assert.equal(editConfinement(record, record.replace('each April', 'each March'), markers).confined, true);
  assert.equal(editConfinement(record, record.replace('each April', 'each March').replace('# ADR-0003:', '# ADR-0003 (corrected):'), markers).confined, false, 'the title is outside the passage');
  assert.equal(editConfinement(record, `${record.replace('each April', 'each March')}\nAmended by ADR-0004.\n`, markers).confined, true, 'an appended notice is inside the passage and left to the grader');
  const legacy = suite.cases.find((candidate) => candidate.id === 'numbering-legacy');
  const log = fs.readFileSync(path.join(legacy.workspace, 'records', 'decisions-log.md'), 'utf8');
  const logMarkers = legacy.deterministic.edits['records/decisions-log.md'];
  assert.equal(editConfinement(log, `${log}- 0010: [Two signatories](../docs/adr/0010-two-signatories.md)\n`, logMarkers).confined, true);
  assert.equal(editConfinement(log, log.replace('# Decisions log', '# Decisions log (legacy)'), logMarkers).confined, false);
});

// --- end to end through the fake engine, both engines ---

test('the fake engine exercises the rewritten-copy premise, the pattern, the observed read and the confined correction end to end on both engines, and inspect recomputes them unchanged', () => {
  const suites = path.join(scratch, 'suites-e2e');
  const suite = loadSuite(SKILL);
  const correction = suite.cases.find((candidate) => candidate.id === 'correction-in-place');
  const RECORD = fs.readFileSync(path.join(correction.workspace, 'docs', 'adr', '0003-rent-letters-from-register.md'), 'utf8');
  const markers = correction.deterministic.edits['docs/adr/0003-rent-letters-from-register.md'];
  const rule = { exit: 0, skillReads: { [SKILL]: 'required' }, sourceReads: { [ADR]: 'required', [GUIDANCE]: 'observed' }, premise: [`skillReads.${SKILL}`, `sourceReads.${ADR}`] };
  const semantic = [{ id: 'shape', criterion: 'title and one sentence' }];
  const newRecord = { path: 'docs/adr/0004-composting-toilet.md', text: '# ADR-0004: Composting toilet\n\nReplace the chemical toilet.\n' };
  const newIndex = { path: 'DECISION-LOG.md', text: '# Decision log\n\n[ADR-0004](docs/adr/0004-composting-toilet.md)\n' };
  const pattern = { allowed: ['docs/adr/0004-*.md', 'DECISION-LOG.md', 'README.md'], required: ['docs/adr/0004-*.md', 'DECISION-LOG.md'] };
  const cases = [
    // The format read through the rewritten skill-local copy via the installed link; the record under the pattern.
    { id: 'via-copy', directive: { readSkills: [SKILL], readFiles: [`.claude/skills/${SKILL}/references/adr-format.md`], writes: [newRecord, newIndex], reply: 'Saved docs/adr/0004-composting-toilet.md.' }, deterministic: { ...rule, writes: pattern }, semantic },
    // The canonical path under the materialized source, with the guidance read as well (observed).
    { id: 'via-canonical', directive: { readSkills: [SKILL], readFiles: [path.join(source, ADR), `.claude/skills/${SKILL}/references/writing-guidance.md`], writes: [newRecord, newIndex], reply: 'Saved docs/adr/0004-composting-toilet.md.' }, deterministic: { ...rule, writes: pattern }, semantic },
    // Only the first bytes of the copy came back: the premise is not met.
    { id: 'truncated', directive: { readSkills: [SKILL], readFiles: [{ path: `.claude/skills/${SKILL}/references/adr-format.md`, limit: 30 }], writes: [newRecord, newIndex], reply: 'Saved docs/adr/0004-composting-toilet.md.' }, deterministic: { ...rule, writes: pattern }, semantic },
    // A record under the next-but-one number: outside the allowed pattern and the required one unmet.
    { id: 'wrong-number', directive: { readSkills: [SKILL], readFiles: [`.claude/skills/${SKILL}/references/adr-format.md`], writes: [{ ...newRecord, path: 'docs/adr/0005-composting-toilet.md' }, newIndex], reply: 'Saved docs/adr/0005-composting-toilet.md.' }, deterministic: { ...rule, writes: pattern }, semantic },
    // The correction inside the body, and one that also renamed the title.
    { id: 'confined', files: { 'docs/adr/0003-rent-letters-from-register.md': RECORD }, directive: { readSkills: [SKILL], readFiles: [`.claude/skills/${SKILL}/references/adr-format.md`], writes: [{ path: 'docs/adr/0003-rent-letters-from-register.md', text: RECORD.replace('each April', 'each March') }], reply: 'Corrected docs/adr/0003-rent-letters-from-register.md.' },
      deterministic: { ...rule, writes: { allowed: ['docs/adr/0003-rent-letters-from-register.md'], required: ['docs/adr/0003-rent-letters-from-register.md'] }, edits: { 'docs/adr/0003-rent-letters-from-register.md': markers } }, semantic },
    { id: 'spilled', files: { 'docs/adr/0003-rent-letters-from-register.md': RECORD }, directive: { readSkills: [SKILL], readFiles: [`.claude/skills/${SKILL}/references/adr-format.md`], writes: [{ path: 'docs/adr/0003-rent-letters-from-register.md', text: RECORD.replace('each April', 'each March').replace('# ADR-0003:', '# ADR-0003 (corrected):') }], reply: 'Corrected docs/adr/0003-rent-letters-from-register.md.' },
      deterministic: { ...rule, writes: { allowed: ['docs/adr/0003-rent-letters-from-register.md'], required: ['docs/adr/0003-rent-letters-from-register.md'] }, edits: { 'docs/adr/0003-rent-letters-from-register.md': markers } }, semantic },
  ];
  makeSuite(suites, 'rd-e2e', cases, { skills: SUITE_SKILLS });
  const runDir = path.join(scratch, 'runs', 'e2e');
  const expected = { 'via-copy': 'pass', 'via-canonical': 'pass', truncated: 'premise-not-met', 'wrong-number': 'fail', confined: 'pass', spilled: 'fail' };
  for (const engine of ['claude', 'codex']) {
    const plan = planRun({ suiteName: 'rd-e2e', suitesRoot: suites, engine, model: engine === 'claude' ? 'claude-opus-5-5' : 'gpt-6.1-sol', effort: 'high', replicates: 1, source: { dir: source }, runDir, executables: fakeExecutables, timeoutSeconds: 60 });
    const records = executeRun(plan, { out: quiet });
    assert.equal(records.length, cases.length, engine);
    for (const record of records) {
      assert.equal(record.status, 'behavioral', `${engine} ${record.case}`);
      assert.equal(record.verdict, expected[record.case], `${record.case} on ${engine}`);
      const inspection = readJson(path.join(runDir, 'attempts', record.case, engine, '001', 'inspection.json'));
      assert.equal(inspection.classifier.version, 9);
      assert.deepEqual(inspection.classifier.sourceAliases[ADR], [{ skill: SKILL, path: ADR_ALIAS, status: 'alias', header: header(ADR), rewrites: ADR_REWRITE }], `${engine} ${record.case} declares the rewritten alias from the run's source`);
      assert.equal(inspection.checks.some((entry) => entry.id === `sourceReads.${GUIDANCE}`), false, `${engine} ${record.case}: the observed guidance yields no check`);
      assert.equal(inspection.sourceReads[GUIDANCE].body, record.case === 'via-canonical', `${engine} ${record.case}: the observed read is recorded`);
      if (record.case === 'truncated') assert.equal(inspection.sourceReads[ADR].partial, true);
      else assert.equal(inspection.sourceReads[ADR].body, true, `${engine} ${record.case}`);
      if (record.case === 'via-canonical') assert.deepEqual(inspection.sourceReads[ADR].forms, ['canonical']);
      else assert.deepEqual(inspection.sourceReads[ADR].forms, ['skill-local'], `${engine} ${record.case}`);
      if (record.case === 'wrong-number') {
        assert.equal(inspection.checks.find((entry) => entry.id === 'writes.allowed').pass, false);
        assert.equal(inspection.checks.find((entry) => entry.id === 'writes.required').detail, 'not written: docs/adr/0004-*.md');
      }
      if (record.case === 'via-copy') assert.equal(inspection.checks.find((entry) => entry.id === 'writes.required').detail, 'written: docs/adr/0004-*.md (docs/adr/0004-composting-toilet.md), DECISION-LOG.md');
    }
  }
  const spilled = readJson(path.join(runDir, 'attempts', 'spilled', 'codex', '001', 'inspection.json')).checks.find((entry) => entry.id === 'edits.docs/adr/0003-rent-letters-from-register.md');
  assert.equal(spilled.pass, false);
  assert.match(spilled.detail, /text before it/);
  const { outcomes } = reinspectRun({ runDir, out: quiet });
  assert.equal(outcomes.length, cases.length * 2);
  for (const outcome of outcomes) {
    assert.equal(outcome.ok, true, outcome.attempt);
    assert.equal(outcome.after.verdict, outcome.before.verdict, outcome.attempt);
  }
});
