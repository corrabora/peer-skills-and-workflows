// The maintained write-for-agents suite loads and is complete; its premise
// (the skill read, the shared guidance read whole through the skill-local
// copy or the canonical path) and its one confined edit are exercised
// against fake traces in both engines' forms and end to end through the
// fake engine; dry runs on both engines plan the expected attempts. No
// network, no paid call.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, test } from 'node:test';
import { engineFor } from '../lib/engines.mjs';
import { editConfinement, inspectAttempt, passageBounds } from '../lib/inspect.mjs';
import { readJson } from '../lib/common.mjs';
import { reinspectRun } from '../lib/reinspect.mjs';
import { executeRun, planRun } from '../lib/run.mjs';
import { listSuites, loadSuite, matchesNodeTestPattern } from '../lib/suite.mjs';
import { fakeExecutables, makeSource, makeSuite, temporaryDirectory } from '../test-support/fixtures.mjs';

const scratch = temporaryDirectory('write-for-agents');
after(() => fs.rmSync(scratch, { recursive: true, force: true }));

const quiet = { info() {}, error() {} };
const SKILL = 'write-for-agents';
const GUIDANCE = 'docs/writing-guidance.md';
const ALIAS_PATH = `skills/${SKILL}/references/writing-guidance.md`;
const CASE_IDS = [
  'brief-from-notes', 'proposal-vs-accepted', 'prerequisite-transition', 'conditional-dependency', 'handoff', 'maintained-revision',
  'input-preservation', 'actor-fidelity', 'missing-dependency', 'narrow-edit', 'receipt-unresolved', 'human-section',
];
const SUITE_SKILLS = ['write-for-agents', 'write-for-humans', 'clarify-artifact', 'maintain-glossary', 'record-decision'];

// A source tree with the five installed skills, the shared guidance, and the
// skill-local copy write-for-agents reads it through (one generated-from header line).
const GUIDANCE_TEXT = '# Shared guidance\n\nSelect before drafting.\n\n## Deliver\n\n  The receipt is the first line alone.\n';
const HEADER = '<!-- Generated from docs/writing-guidance.md. -->';
const SIGNATURE = { first: '# Shared guidance', last: 'The receipt is the first line alone.' };
const source = makeSource(path.join(scratch, 'source'), SUITE_SKILLS);
fs.writeFileSync(path.join(source, GUIDANCE), GUIDANCE_TEXT);
fs.mkdirSync(path.join(source, 'skills', SKILL, 'references'), { recursive: true });
fs.writeFileSync(path.join(source, ALIAS_PATH), `${HEADER}\n${GUIDANCE_TEXT}`);

test('the write-for-agents suite loads with its twelve cases, each with the guidance premise, bounded writes and a certifying criterion', () => {
  assert.ok(listSuites().includes(SKILL));
  const suite = loadSuite(SKILL);
  assert.equal(suite.skill, SKILL);
  assert.deepEqual(suite.skills, SUITE_SKILLS);
  assert.deepEqual(suite.cases.map((caseDef) => caseDef.id), CASE_IDS);
  for (const caseDef of suite.cases) {
    const prompt = caseDef.prompt.toString('utf8');
    assert.ok(caseDef.effect.length > 20, `${caseDef.id} states its effect`);
    assert.match(prompt, /^Use the `write-for-agents` skill\.\n/, `${caseDef.id} opens by naming the skill`);
    assert.doesNotMatch(prompt, /Put any question/, `${caseDef.id} carries no closing invitation line`);
    assert.ok(prompt.endsWith('.\n') && !prompt.endsWith('\n\n'), `${caseDef.id} ends with one newline`);
    assert.ok('README.md' in caseDef.fixtureManifest, `${caseDef.id} has the workspace README`);
    assert.equal(caseDef.deterministic.skillReads[SKILL], 'required', `${caseDef.id} requires the skill`);
    assert.deepEqual(Object.keys(caseDef.deterministic.skillReads), [SKILL], `${caseDef.id} constrains no other skill's loading`);
    assert.equal(caseDef.deterministic.sourceReads[GUIDANCE], 'required', `${caseDef.id} requires the guidance`);
    assert.deepEqual(caseDef.deterministic.premise, [`skillReads.${SKILL}`, `sourceReads.${GUIDANCE}`], `${caseDef.id} makes both the premise`);
    assert.equal(caseDef.deterministic.claimedArtifacts, true, `${caseDef.id} checks claimed artifacts`);
    assert.equal(caseDef.deterministic.writes.allowed.length, 1, `${caseDef.id} allows exactly one written file`);
    assert.deepEqual(caseDef.deterministic.writes.required, caseDef.deterministic.writes.allowed, `${caseDef.id} requires that file`);
    assert.ok(caseDef.semantic.some((criterion) => criterion.observe !== true), `${caseDef.id} has at least one certifying criterion`);
    for (const criterion of caseDef.semantic) assert.ok(criterion.criterion.length > 25, `${caseDef.id}/${criterion.id} states what the grader judges`);
  }
  // Observe-only criteria: the engine's own question everywhere; the receipt counts in the two receipt cases;
  // in human-section the coordinator section's content and the write-for-humans read, which that skill owns (OG-0090, OG-0099).
  const observed = Object.fromEntries(suite.cases.map((caseDef) => [caseDef.id, caseDef.semantic.filter((criterion) => criterion.observe === true).map((criterion) => criterion.id)]));
  assert.deepEqual(observed, {
    'brief-from-notes': ['no-question'],
    'proposal-vs-accepted': ['no-question'],
    'prerequisite-transition': ['no-question'],
    'conditional-dependency': ['no-question'],
    'handoff': ['no-question'],
    'maintained-revision': ['no-question'],
    'input-preservation': ['no-question'],
    'actor-fidelity': ['no-question'],
    'missing-dependency': ['no-question'],
    'narrow-edit': ['no-question'],
    'receipt-unresolved': ['no-question', 'receipt-sentence-counts'],
    'human-section': ['coordinator-section-content', 'write-for-humans-read', 'no-question', 'receipt-sentence-counts'],
  });
  // The receipt sentence rubric names its five counts in full and says it is not the cycle015 item rubric.
  for (const id of ['receipt-unresolved', 'human-section']) {
    const rubric = suite.cases.find((caseDef) => caseDef.id === id).semantic.find((criterion) => criterion.id === 'receipt-sentence-counts');
    assert.match(rubric.criterion, /preface\/contents\/offers\/recital\/assurance/, `${id} names the counts in full`);
    assert.match(rubric.criterion, /not the cycle015 item rubric/, `${id} distinguishes the rubric`);
    assert.doesNotMatch(rubric.criterion, /P\/C\/O\/R\/A/, `${id} does not use the colliding labels`);
  }
  // The certifying criteria name the plausible wrong answers and cannot pass vacuously.
  const criterion = (id, criterionId) => suite.cases.find((caseDef) => caseDef.id === id).semantic.find((entry) => entry.id === criterionId);
  assert.match(criterion('input-preservation', 'preserved-before-first-write').criterion, /makes the copy after normalising/, 'the ordering check fails when the later action comes first');
  assert.match(criterion('input-preservation', 'preserved-before-first-write').criterion, /no preservation step/, 'the ordering check fails when the action never happens');
  assert.match(criterion('input-preservation', 'preservation-checkable').criterion, /only points to the help page, fails/);
  assert.match(criterion('prerequisite-transition', 'exit-statuses-from-source').criterion, /stop and report it/);
  assert.match(criterion('prerequisite-transition', 'exit-statuses-from-source').criterion, /1 means a malformed file/);
  assert.match(criterion('prerequisite-transition', 'ordered-steps').criterion, /copy can happen before the prerequisite is tested fails/);
  assert.match(criterion('brief-from-notes', 'no-discarded-or-internal').criterion, /Mole/);
  assert.match(criterion('proposal-vs-accepted', 'proposal-kept-apart').criterion, /treats the proposal as decided fails/);
  assert.match(criterion('handoff', 'abandoned-omitted').criterion, /ledgerconv/);
  assert.match(criterion('actor-fidelity', 'qualification-kept').criterion, /feet rule without the exception fails/);
  assert.match(criterion('receipt-unresolved', 'no-false-verification').criterion, /marks the recipe as not run/);
  assert.match(criterion('missing-dependency', 'dependent-part-paused').criterion, /gauge-register-2019\.md is not used in its place/);
  assert.match(criterion('human-section', 'write-for-humans-read').criterion, /inspection\.json records write-for-humans/);
  assert.equal(criterion('human-section', 'receipt-first-line-only').observe, undefined, 'the receipt certifies in human-section');
  assert.equal(criterion('human-section', 'coordinator-section-content').observe, true, 'the coordinator section is observed only');
  // The narrow edit is the only case with a confinement check, bounded by the section heading and the next one.
  const narrow = suite.cases.find((caseDef) => caseDef.id === 'narrow-edit');
  assert.deepEqual(narrow.deterministic.edits, { 'briefs/monthly-summary.md': { after: '## Checks before publishing', before: '## Completion' } });
  assert.equal(suite.cases.filter((caseDef) => caseDef.deterministic.edits).length, 1);
  assert.equal(loadSuite(SKILL).hash, suite.hash);
});

test('no fixture path matches a Node test pattern, no fixture echoes the skills, and the aliasing fact lives only in the help page', () => {
  const suite = loadSuite(SKILL);
  for (const relative of Object.keys(suite.manifest)) {
    assert.equal(matchesNodeTestPattern(relative), false, relative);
    assert.ok(!relative.split('/').includes('test'), relative);
  }
  const helpTexts = new Set();
  for (const caseDef of suite.cases) {
    for (const relative of Object.keys(caseDef.fixtureManifest)) {
      const text = fs.readFileSync(path.join(caseDef.workspace, relative), 'utf8');
      assert.doesNotMatch(text, /write-for-agents|write-for-humans|delivery receipt|shared writing guidance|clarify-artifact|stop and report/i, `${caseDef.id}/${relative}`);
      // The in-place write of `normalize` is discoverable only from the help page, so a brief that skips it cannot preserve by luck.
      if (relative === 'tools/gaugetool-help.txt') helpTexts.add(text);
      else assert.doesNotMatch(text, /unless --out|replacing it|in place/i, `${caseDef.id}/${relative} does not give away the aliasing fact`);
    }
  }
  assert.equal(helpTexts.size, 1, 'every case carries the same help page');
  assert.match([...helpTexts][0], /written to <file> itself, replacing it, unless --out is\s+given/);
  // The prompts name only paths that exist in the fixture, except the one missing dependency and the files the engine is to write.
  const missing = suite.cases.find((caseDef) => caseDef.id === 'missing-dependency');
  assert.ok(!('references/gauge-register.md' in missing.fixtureManifest), 'the register is absent');
  assert.ok('references/gauge-register-2019.md' in missing.fixtureManifest, 'the superseded register is the substitution trap');
});

test('dry runs on both engines plan three replicates of every case with the fake engine and write nothing', () => {
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
    assert.equal(fs.existsSync(runDir), false, `${engine} dry run writes nothing`);
  }
});

// --- the premise against fake traces in both engines' forms ---

const claudeTrace = (calls) => calls.map(([name, input, output], index) => [
  JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', id: `t${index}`, name, input }] } }),
  output === null ? null : JSON.stringify({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: `t${index}`, content: output }] } }),
].filter(Boolean).join('\n')).join('\n');
const codexTrace = (commands) => commands.map(([command, output], index) => JSON.stringify({ type: 'item.completed', item: { id: `i${index}`, type: 'command_execution', command: `/bin/zsh -lc ${JSON.stringify(command)}`, aggregated_output: output, exit_code: 0, status: 'completed' } })).join('\n');
const numbered = (text) => text.split('\n').map((line, index) => `${index + 1}\t${line}`).join('\n');
const claudeEvents = (calls) => engineFor('claude').events(claudeTrace(calls));
const codexEvents = (commands) => engineFor('codex').events(codexTrace(commands));

test('the premise is met by the skill read with the guidance read through the skill-local copy or the canonical path, on both engines; a partial read or no read is premise-not-met', () => {
  const suite = loadSuite(SKILL);
  const caseDef = suite.cases.find((candidate) => candidate.id === 'human-section');
  const workspace = path.join(scratch, 'inspect-ws');
  fs.cpSync(caseDef.workspace, workspace, { recursive: true });
  fs.mkdirSync(path.join(workspace, 'briefs'), { recursive: true });
  fs.writeFileSync(path.join(workspace, 'briefs', 'rain-totals-2026.md'), '# Rain totals\n');
  const skillBody = (skill) => fs.readFileSync(path.join(source, 'skills', skill, 'SKILL.md'), 'utf8');
  const skillSignatures = Object.fromEntries(SUITE_SKILLS.map((skill) => [skill, { name: skill, heading: skill }]));
  const exit = { status: 0, signal: null, timedOut: false, seconds: 1 };
  const inspect = (events) => inspectAttempt({ caseDef, skills: SUITE_SKILLS, events, finalReply: 'Saved briefs/rain-totals-2026.md.', workspace, fixtureManifest: caseDef.fixtureManifest, exit, effective: {}, signatures: skillSignatures, sourceRoot: source });
  const premiseIds = [`skillReads.${SKILL}`, `sourceReads.${GUIDANCE}`];
  const premise = (inspection) => inspection.checks.filter((check) => premiseIds.includes(check.id)).map((check) => [check.id, check.kind, check.pass]);

  // Claude: the skill through its link, the guidance through the skill-local copy with its header.
  const claudeSkill = ['Read', { file_path: `/ws/.claude/skills/${SKILL}/SKILL.md` }, numbered(skillBody(SKILL))];
  const viaCopy = inspect(claudeEvents([claudeSkill, ['Read', { file_path: `/ws/.claude/skills/${SKILL}/references/writing-guidance.md` }, numbered(`${HEADER}\n${GUIDANCE_TEXT}`)]]));
  assert.equal(viaCopy.verdict, 'pass');
  assert.deepEqual(premise(viaCopy), [[`skillReads.${SKILL}`, 'premise', true], [`sourceReads.${GUIDANCE}`, 'premise', true]]);
  assert.deepEqual(viaCopy.sourceReads[GUIDANCE].forms, ['skill-local']);
  assert.deepEqual(viaCopy.sourceReads[GUIDANCE].skillLocal, [SKILL]);
  assert.match(viaCopy.checks.find((check) => check.id === `sourceReads.${GUIDANCE}`).detail, /read through skill-local copy \(write-for-agents\)/);
  assert.deepEqual(viaCopy.classifier.sourceAliases[GUIDANCE], [{ skill: SKILL, path: ALIAS_PATH, status: 'alias', header: HEADER }]);
  assert.deepEqual(viaCopy.classifier.sourceSignatures, { [GUIDANCE]: SIGNATURE });
  // Claude: the canonical path under the materialized source.
  const viaCanonical = inspect(claudeEvents([claudeSkill, ['Read', { file_path: path.join(source, GUIDANCE) }, numbered(GUIDANCE_TEXT)]]));
  assert.equal(viaCanonical.verdict, 'pass');
  assert.deepEqual(viaCanonical.sourceReads[GUIDANCE].forms, ['canonical']);
  // Claude: the write-for-humans read is recorded for the observe-only criterion without affecting the verdict.
  const withHumans = inspect(claudeEvents([claudeSkill, ['Read', { file_path: `/ws/.claude/skills/write-for-humans/SKILL.md` }, numbered(skillBody('write-for-humans'))], ['Read', { file_path: `/ws/.claude/skills/${SKILL}/references/writing-guidance.md` }, numbered(`${HEADER}\n${GUIDANCE_TEXT}`)]]));
  assert.equal(withHumans.verdict, 'pass');
  assert.equal(withHumans.skillReads['write-for-humans'].body, true);
  assert.equal(viaCopy.skillReads['write-for-humans'].body, false);
  // Claude: only the first lines of the copy came back.
  const partial = inspect(claudeEvents([claudeSkill, ['Read', { file_path: `/ws/.claude/skills/${SKILL}/references/writing-guidance.md`, limit: 2 }, numbered(`${HEADER}\n# Shared guidance`)]]));
  assert.equal(partial.verdict, 'premise-not-met');
  assert.match(partial.checks.find((check) => check.id === `sourceReads.${GUIDANCE}`).detail, /partly returned through skill-local copy \(write-for-agents\)/);
  // Claude: the skill never read.
  const noSkill = inspect(claudeEvents([['Read', { file_path: `/ws/.claude/skills/${SKILL}/references/writing-guidance.md` }, numbered(`${HEADER}\n${GUIDANCE_TEXT}`)]]));
  assert.equal(noSkill.verdict, 'premise-not-met');
  assert.deepEqual(premise(noSkill), [[`skillReads.${SKILL}`, 'premise', false], [`sourceReads.${GUIDANCE}`, 'premise', true]]);

  // Codex: shell reads of the same files through the .agents link.
  const codexSkill = [`cat .agents/skills/${SKILL}/SKILL.md`, skillBody(SKILL)];
  const codexCopy = inspect(codexEvents([codexSkill, [`cat .agents/skills/${SKILL}/references/writing-guidance.md`, `${HEADER}\n${GUIDANCE_TEXT}`]]));
  assert.equal(codexCopy.verdict, 'pass');
  assert.deepEqual(codexCopy.sourceReads[GUIDANCE].forms, ['skill-local']);
  const codexCanonical = inspect(codexEvents([codexSkill, [`cat -n '${path.join(source, GUIDANCE)}'`, numbered(GUIDANCE_TEXT)]]));
  assert.equal(codexCanonical.verdict, 'pass');
  const codexChunked = inspect(codexEvents([codexSkill, [`head -n 3 .agents/skills/${SKILL}/references/writing-guidance.md`, `${HEADER}\n# Shared guidance\n`], [`tail -n +4 .agents/skills/${SKILL}/references/writing-guidance.md`, GUIDANCE_TEXT.split('\n').slice(2).join('\n')]]));
  assert.equal(codexChunked.verdict, 'pass', 'chunks through the copy join');
  const codexListed = inspect(codexEvents([codexSkill, [`ls -l .agents/skills/${SKILL}/references/writing-guidance.md`, null]]));
  assert.equal(codexListed.verdict, 'premise-not-met');
  assert.equal(codexListed.sourceReads[GUIDANCE].listing, true);
  const codexHead = inspect(codexEvents([codexSkill, [`head -c 40 .agents/skills/${SKILL}/references/writing-guidance.md`, `${HEADER}\n${GUIDANCE_TEXT}`.slice(0, 40)]]));
  assert.equal(codexHead.verdict, 'premise-not-met');
  assert.equal(codexHead.sourceReads[GUIDANCE].partial, true);
});

// --- the confined edit against the real narrow-edit fixture ---

test('the narrow-edit markers bound the one section, and only a revision inside it is confined', () => {
  const caseDef = loadSuite(SKILL).cases.find((candidate) => candidate.id === 'narrow-edit');
  const file = path.join(caseDef.workspace, 'briefs', 'monthly-summary.md');
  const fixture = fs.readFileSync(file, 'utf8');
  const markers = caseDef.deterministic.edits['briefs/monthly-summary.md'];
  const bounds = passageBounds(fixture, markers);
  assert.equal(fixture.slice(bounds.start, bounds.end).includes('emailed the month\'s calibration confirmation'), true, 'the passage is the checks section');
  assert.equal(fixture.slice(bounds.start, bounds.end).includes('## Completion'), false);
  const revised = fixture.replace(/## Checks before publishing\n[\s\S]*?(?=## Completion)/, '## Checks before publishing\n\nBefore copying the summary to `published/`, confirm that `calibration/<year>-<month>.md` exists.\n\n');
  assert.notEqual(revised, fixture);
  assert.equal(editConfinement(fixture, revised, markers).confined, true);
  assert.equal(editConfinement(fixture, revised.replace('Done when the summary', 'Done once the summary'), markers).confined, false, 'a change in the next section spills');
  assert.equal(editConfinement(fixture, revised.replace('## Inputs', '## Inputs and authority'), markers).confined, false, 'a change before the section spills');
  assert.equal(editConfinement(fixture, revised.replace('## Checks before publishing', '## Checks'), markers).confined, false, 'renaming the heading is outside the passage');
});

// --- end to end through the fake engine, both engines ---

test('the fake engine exercises the alias premise and the confined edit end to end on both engines, and inspect recomputes them unchanged', () => {
  const suites = path.join(scratch, 'suites-e2e');
  const rule = { skillReads: { [SKILL]: 'required' }, sourceReads: { [GUIDANCE]: 'required' }, premise: [`skillReads.${SKILL}`, `sourceReads.${GUIDANCE}`] };
  const narrow = loadSuite(SKILL).cases.find((candidate) => candidate.id === 'narrow-edit');
  const BRIEF = fs.readFileSync(path.join(narrow.workspace, 'briefs', 'monthly-summary.md'), 'utf8');
  const markers = narrow.deterministic.edits['briefs/monthly-summary.md'];
  const revised = BRIEF.replace('has emailed the month\'s calibration confirmation', 'has written `calibration/<year>-<month>.md`');
  const cases = [
    // The guidance read through the skill-local copy via the installed link, as the skill directs.
    { id: 'via-copy', directive: { readSkills: [SKILL], readFiles: [`.claude/skills/${SKILL}/references/writing-guidance.md`], writes: [{ path: 'briefs/out.md', text: 'out\n' }], reply: 'Saved briefs/out.md.' },
      deterministic: { exit: 0, ...rule, writes: { allowed: ['briefs/out.md'], required: ['briefs/out.md'] } }, semantic: [{ id: 'receipt', criterion: 'the receipt alone' }] },
    // The canonical path under the materialized source.
    { id: 'via-canonical', directive: { readSkills: [SKILL], readFiles: [path.join(source, GUIDANCE)], writes: [{ path: 'briefs/out.md', text: 'out\n' }], reply: 'Saved briefs/out.md.' },
      deterministic: { exit: 0, ...rule, writes: { allowed: ['briefs/out.md'], required: ['briefs/out.md'] } }, semantic: [{ id: 'receipt', criterion: 'the receipt alone' }] },
    // Only the first bytes of the copy came back: the premise is not met.
    { id: 'truncated', directive: { readSkills: [SKILL], readFiles: [{ path: `.claude/skills/${SKILL}/references/writing-guidance.md`, limit: 30 }], writes: [{ path: 'briefs/out.md', text: 'out\n' }], reply: 'Saved briefs/out.md.' },
      deterministic: { exit: 0, ...rule, writes: { allowed: ['briefs/out.md'], required: ['briefs/out.md'] } }, semantic: [{ id: 'receipt', criterion: 'the receipt alone' }] },
    // A revision confined to the checks section, and one that also touched the completion section.
    { id: 'confined', files: { 'briefs/monthly-summary.md': BRIEF }, directive: { readSkills: [SKILL], readFiles: [`.claude/skills/${SKILL}/references/writing-guidance.md`], writes: [{ path: 'briefs/monthly-summary.md', text: revised }], reply: 'Revised briefs/monthly-summary.md.' },
      deterministic: { exit: 0, ...rule, writes: { allowed: ['briefs/monthly-summary.md'], required: ['briefs/monthly-summary.md'] }, edits: { 'briefs/monthly-summary.md': markers } }, semantic: [{ id: 'content', criterion: 'the section reflects the note' }] },
    { id: 'spilled', files: { 'briefs/monthly-summary.md': BRIEF }, directive: { readSkills: [SKILL], readFiles: [`.claude/skills/${SKILL}/references/writing-guidance.md`], writes: [{ path: 'briefs/monthly-summary.md', text: revised.replace('Done when the summary', 'Done once the summary') }], reply: 'Revised briefs/monthly-summary.md.' },
      deterministic: { exit: 0, ...rule, writes: { allowed: ['briefs/monthly-summary.md'], required: ['briefs/monthly-summary.md'] }, edits: { 'briefs/monthly-summary.md': markers } }, semantic: [{ id: 'content', criterion: 'the section reflects the note' }] },
  ];
  makeSuite(suites, 'wfa-e2e', cases, { skills: SUITE_SKILLS });
  const runDir = path.join(scratch, 'runs', 'e2e');
  const verdicts = {};
  for (const engine of ['claude', 'codex']) {
    const plan = planRun({ suiteName: 'wfa-e2e', suitesRoot: suites, engine, model: engine === 'claude' ? 'claude-opus-5-5' : 'gpt-6.1-sol', effort: 'high', replicates: 1, source: { dir: source }, runDir, executables: fakeExecutables, timeoutSeconds: 60 });
    const records = executeRun(plan, { out: quiet });
    assert.equal(records.length, cases.length, engine);
    for (const record of records) {
      assert.equal(record.status, 'behavioral', `${engine} ${record.case}`);
      verdicts[`${record.case}/${engine}`] = record.verdict;
      const inspection = readJson(path.join(runDir, 'attempts', record.case, engine, '001', 'inspection.json'));
      assert.equal(inspection.checks.find((entry) => entry.id === `sourceReads.${GUIDANCE}`).kind, 'premise', `${engine} ${record.case}`);
      assert.deepEqual(inspection.classifier.sourceAliases[GUIDANCE], [{ skill: SKILL, path: ALIAS_PATH, status: 'alias', header: HEADER }], `${engine} ${record.case} declares the alias from the run's source`);
      if (record.case === 'truncated') assert.equal(inspection.sourceReads[GUIDANCE].partial, true);
      else assert.equal(inspection.sourceReads[GUIDANCE].body, true, `${engine} ${record.case}`);
      if (record.case !== 'via-canonical' && record.case !== 'truncated') assert.deepEqual(inspection.sourceReads[GUIDANCE].forms, ['skill-local'], `${engine} ${record.case}`);
    }
  }
  const expected = { 'via-copy': 'pass', 'via-canonical': 'pass', truncated: 'premise-not-met', confined: 'pass', spilled: 'fail' };
  for (const engine of ['claude', 'codex']) for (const [id, verdict] of Object.entries(expected)) assert.equal(verdicts[`${id}/${engine}`], verdict, `${id} on ${engine}`);
  const spilled = readJson(path.join(runDir, 'attempts', 'spilled', 'codex', '001', 'inspection.json')).checks.find((entry) => entry.id === 'edits.briefs/monthly-summary.md');
  assert.equal(spilled.pass, false);
  assert.match(spilled.detail, /text after it/);
  const { outcomes } = reinspectRun({ runDir, out: quiet });
  assert.equal(outcomes.length, cases.length * 2);
  for (const outcome of outcomes) {
    assert.equal(outcome.ok, true, outcome.attempt);
    assert.equal(outcome.after.verdict, outcome.before.verdict, outcome.attempt);
  }
});
