// The maintained write-for-humans suite loads and is complete; the two
// deterministic checks it introduced (a source file read whole, an edit
// confined to one passage) are exercised against fake traces in both
// engines' forms and end to end through the fake engine; dry runs on both
// engines plan the expected attempts. No network, no paid call.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, test } from 'node:test';
import { engineFor } from '../lib/engines.mjs';
import { classifySourceReads, editConfinement, fileSignature, inspectAttempt, outputShowsFile, passageBounds, sourceSignatures } from '../lib/inspect.mjs';
import { readJson } from '../lib/common.mjs';
import { reinspectRun } from '../lib/reinspect.mjs';
import { executeRun, planRun } from '../lib/run.mjs';
import { listSuites, loadSuite, matchesNodeTestPattern } from '../lib/suite.mjs';
import { fakeExecutables, makeSource, makeSuite, temporaryDirectory } from '../test-support/fixtures.mjs';

const scratch = temporaryDirectory('write-for-humans');
after(() => fs.rmSync(scratch, { recursive: true, force: true }));

const quiet = { info() {}, error() {} };
const GUIDANCE = 'docs/writing-guidance.md';
const CASE_IDS = [
  'receipt-clean', 'receipt-unresolved', 'receipt-selection', 'actor-fidelity', 'no-invented-authority', 'lead-with-result',
  'terse-complete', 'readiness-gap', 'missing-dependency', 'reply-as-artifact', 'narrow-edit', 'agent-section',
];

// A source tree with the five installed skills and a multi-line shared guidance file.
const SUITE_SKILLS = ['write-for-humans', 'clarify-artifact', 'write-for-agents', 'maintain-glossary', 'record-decision'];
const GUIDANCE_TEXT = '# Shared guidance\n\nSelect before drafting.\n\n## Deliver\n\n  The receipt is the first line alone.\n';
const source = makeSource(path.join(scratch, 'source'), SUITE_SKILLS);
fs.writeFileSync(path.join(source, 'docs', 'writing-guidance.md'), GUIDANCE_TEXT);
const SIGNATURE = { first: '# Shared guidance', last: 'The receipt is the first line alone.' };

test('the write-for-humans suite loads with its twelve cases, each with the guidance premise and a certifying criterion', () => {
  assert.ok(listSuites().includes('write-for-humans'));
  const suite = loadSuite('write-for-humans');
  assert.equal(suite.skill, 'write-for-humans');
  assert.deepEqual(suite.skills, SUITE_SKILLS);
  assert.deepEqual(suite.cases.map((caseDef) => caseDef.id), CASE_IDS);
  for (const caseDef of suite.cases) {
    assert.ok(caseDef.effect.length > 20, `${caseDef.id} states its effect`);
    assert.match(caseDef.prompt.toString('utf8'), /Use the `write-for-humans` skill\./, `${caseDef.id} names the skill`);
    assert.ok('README.md' in caseDef.fixtureManifest, `${caseDef.id} has the workspace README`);
    assert.equal(caseDef.deterministic.skillReads['write-for-humans'], 'required', `${caseDef.id} requires the skill`);
    assert.equal(caseDef.deterministic.sourceReads[GUIDANCE], 'required', `${caseDef.id} requires the guidance`);
    assert.deepEqual(caseDef.deterministic.premise, ['skillReads.write-for-humans', `sourceReads.${GUIDANCE}`], `${caseDef.id} makes both the premise`);
    assert.ok(caseDef.semantic.some((criterion) => criterion.observe !== true), `${caseDef.id} has at least one certifying criterion`);
    assert.ok(caseDef.deterministic.writes.allowed !== undefined, `${caseDef.id} bounds what may be written`);
  }
  // Observe-only criteria: the engine's own question, the receipt counts, and the write-for-agents read.
  const observed = Object.fromEntries(suite.cases.map((caseDef) => [caseDef.id, caseDef.semantic.filter((criterion) => criterion.observe === true).map((criterion) => criterion.id)]));
  assert.deepEqual(observed, {
    'receipt-clean': ['no-question', 'receipt-sentence-counts'],
    'receipt-unresolved': ['no-question', 'receipt-sentence-counts'],
    'receipt-selection': ['no-question', 'receipt-sentence-counts'],
    'actor-fidelity': ['no-question'],
    'no-invented-authority': ['no-question'],
    'lead-with-result': ['no-question'],
    'terse-complete': ['no-question'],
    'readiness-gap': [],
    'missing-dependency': ['no-question'],
    'reply-as-artifact': ['no-question'],
    'narrow-edit': ['no-question'],
    'agent-section': ['write-for-agents-read', 'no-question'],
  });
  // The receipt sentence rubric names its five counts in full and says it is not the cycle015 item rubric.
  for (const id of ['receipt-clean', 'receipt-unresolved', 'receipt-selection']) {
    const rubric = suite.cases.find((caseDef) => caseDef.id === id).semantic.find((criterion) => criterion.id === 'receipt-sentence-counts');
    assert.match(rubric.criterion, /preface\/contents\/offers\/recital\/assurance/, `${id} names the counts in full`);
    assert.match(rubric.criterion, /not the cycle015 item rubric/, `${id} distinguishes the rubric`);
    assert.doesNotMatch(rubric.criterion, /P\/C\/O\/R\/A/, `${id} does not use the colliding labels`);
  }
  // readiness-gap certifies the notice's facts when one is written, and says the criterion is not applicable otherwise.
  const readiness = suite.cases.find((caseDef) => caseDef.id === 'readiness-gap').semantic.find((criterion) => criterion.id === 'artifact-facts');
  assert.match(readiness.criterion, /supplier took the old kiln away/);
  assert.match(readiness.criterion, /not applicable/);
  assert.equal(readiness.observe, undefined, 'artifact-facts certifies');
  // lead-with-result asks for the result first, with the exclusions allowed to follow the usable shelves.
  const lead = suite.cases.find((caseDef) => caseDef.id === 'lead-with-result').semantic.find((criterion) => criterion.id === 'result-first');
  assert.match(lead.criterion, /exclusions may follow the usable shelves/);
  // no-invented-authority: the committee, or its 4 August meeting, is the minutes' own attribution; an individual, office or other body fails.
  const authority = suite.cases.find((caseDef) => caseDef.id === 'no-invented-authority');
  const approver = authority.semantic.find((criterion) => criterion.id === 'no-approver');
  assert.match(approver.criterion, /Attributing the decision to the committee, or to its 4 August meeting whose minutes record it, is the source's own attribution and passes/);
  assert.match(approver.criterion, /naming any individual, office or other body \(a chair, treasurer, steward, trustees, members' vote or similar\) as proposer, approver or decider fails/);
  assert.doesNotMatch(approver.criterion, /is the only attribution/, 'the old reading, under which the committee itself failed, is gone');
  assert.equal(approver.observe, undefined, 'no-approver certifies');
  const authorityFacts = authority.semantic.find((criterion) => criterion.id === 'artifact-facts');
  assert.match(authorityFacts.criterion, /Attributing the decision to the committee or its 4 August meeting is what the minutes give, not an addition/);
  // Every case keeps the claimed-artifact check on.
  for (const caseDef of suite.cases) assert.equal(caseDef.deterministic.claimedArtifacts, true, `${caseDef.id} checks claimed artifacts`);
  // No clarify-artifact or write-for-agents rule: their loading belongs to other suites or is observed.
  for (const caseDef of suite.cases) assert.deepEqual(Object.keys(caseDef.deterministic.skillReads), ['write-for-humans'], caseDef.id);
  // The narrow edit is the only case with a confinement check, and nothing is written in the reply-as-artifact case.
  const narrow = suite.cases.find((caseDef) => caseDef.id === 'narrow-edit');
  assert.deepEqual(narrow.deterministic.edits, { 'docs/handbook.md': { after: 'the day before the firing.', before: '## Glaze room' } });
  assert.equal(suite.cases.filter((caseDef) => caseDef.deterministic.edits).length, 1);
  assert.deepEqual(suite.cases.find((caseDef) => caseDef.id === 'reply-as-artifact').deterministic.writes, { allowed: [] });
  assert.equal(loadSuite('write-for-humans').hash, suite.hash);
});

test('no fixture path of the suite matches a Node test pattern, and no fixture echoes the skill', () => {
  const suite = loadSuite('write-for-humans');
  for (const relative of Object.keys(suite.manifest)) {
    assert.equal(matchesNodeTestPattern(relative), false, relative);
    assert.ok(!relative.split('/').includes('test'), relative);
  }
  for (const caseDef of suite.cases) {
    for (const relative of Object.keys(caseDef.fixtureManifest)) {
      const text = fs.readFileSync(path.join(caseDef.workspace, relative), 'utf8');
      assert.doesNotMatch(text, /write-for-humans|delivery receipt|shared writing guidance|clarify-artifact/i, `${caseDef.id}/${relative}`);
    }
  }
});

test('dry runs on both engines plan three replicates of every case with the fake engine and write nothing', () => {
  for (const engine of ['claude', 'codex']) {
    const runDir = path.join(scratch, 'runs', `dry-${engine}`);
    const plan = planRun({
      suiteName: 'write-for-humans',
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

// --- the source-read check against fake traces in both engines' forms ---

const claudeTrace = (calls) => calls.map(([name, input, output], index) => [
  JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', id: `t${index}`, name, input }] } }),
  output === null ? null : JSON.stringify({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: `t${index}`, content: output, ...(typeof output === 'string' && output.startsWith('File does not exist') ? { is_error: true } : {}) }] } }),
].filter(Boolean).join('\n')).join('\n');
const codexTrace = (commands) => commands.map(([command, output], index) => JSON.stringify({ type: 'item.completed', item: { id: `i${index}`, type: 'command_execution', command: `/bin/zsh -lc ${JSON.stringify(command)}`, aggregated_output: output, exit_code: 0, status: 'completed' } })).join('\n');
const numbered = (text) => text.split('\n').map((line, index) => `${index + 1}\t${line}`).join('\n');
const claudeEvents = (calls) => engineFor('claude').events(claudeTrace(calls));
const codexEvents = (commands) => engineFor('codex').events(codexTrace(commands));
const classify = (events) => classifySourceReads(events, [GUIDANCE], { signatures: { [GUIDANCE]: SIGNATURE } })[GUIDANCE];

test('a Read through the installed link or the real path whose output shows the whole file is a body read on both engines', () => {
  const linkPath = '/run/attempt/workspace/.claude/skills/write-for-humans/../../docs/writing-guidance.md';
  const realPath = '/run/source/docs/writing-guidance.md';
  const viaLink = classify(claudeEvents([['Read', { file_path: linkPath }, numbered(GUIDANCE_TEXT)]]));
  assert.equal(viaLink.body, true);
  assert.equal(viaLink.evidence[0].basis, 'read-path');
  const viaReal = classify(claudeEvents([['Read', { file_path: realPath }, numbered(GUIDANCE_TEXT)]]));
  assert.equal(viaReal.body, true);
  // Claude's file reader numbers lines with an arrow as well.
  const arrows = GUIDANCE_TEXT.split('\n').map((line, index) => `     ${index + 1}→${line}`).join('\n');
  assert.equal(classify(claudeEvents([['Read', { file_path: realPath }, arrows]])).body, true);
  const codexLink = classify(codexEvents([[`cat '.agents/skills/write-for-humans/../../${GUIDANCE}'`, GUIDANCE_TEXT]]));
  assert.equal(codexLink.body, true);
  assert.equal(codexLink.evidence[0].basis, 'output-signature');
  assert.equal(classify(codexEvents([[`cat -n '${realPath}'`, numbered(GUIDANCE_TEXT)]])).body, true);
  assert.equal(classify(codexEvents([[`sed -n '1,200p' ${realPath}`, GUIDANCE_TEXT]])).body, true);
  // The file's text inside a larger output still counts; a different file never does.
  assert.equal(classify(codexEvents([[`cat README.md ${realPath}`, `fixture\n${GUIDANCE_TEXT}`]])).body, true);
  assert.equal(classify(codexEvents([['cat README.md', 'fixture\n']])).body, false);
});

test('a failed Read, a truncated read or an unread mention is partial or listing, never a body read; chunks together count', () => {
  const realPath = '/run/source/docs/writing-guidance.md';
  const failed = classify(claudeEvents([['Read', { file_path: '/run/attempt/workspace/docs/writing-guidance.md' }, 'File does not exist: /run/attempt/workspace/docs/writing-guidance.md']]));
  assert.equal(failed.body, false);
  assert.equal(failed.partial, true);
  const truncated = classify(claudeEvents([['Read', { file_path: realPath, limit: 2 }, numbered(GUIDANCE_TEXT).split('\n').slice(0, 2).join('\n')]]));
  assert.equal(truncated.body, false);
  assert.equal(truncated.partial, true);
  const head = classify(codexEvents([[`head -c 40 ${realPath}`, GUIDANCE_TEXT.slice(0, 40)]]));
  assert.equal(head.body, false);
  assert.equal(head.partial, true);
  const noOutput = classify(codexEvents([[`cat ${realPath}`, null]]));
  assert.equal(noOutput.body, false);
  assert.equal(noOutput.listing, true);
  const grep = classify(claudeEvents([['Grep', { pattern: 'receipt', path: realPath }, `${realPath}:7:  The receipt is the first line alone.`]]));
  assert.equal(grep.body, false);
  assert.equal(grep.listing, true);
  const excluded = classify(codexEvents([[`rg --files -g '!${GUIDANCE}' .`, 'README.md\n']]));
  assert.equal(excluded.body || excluded.partial || excluded.listing, false);
  assert.equal(excluded.evidence[0].basis, 'exclusion-only');
  // Two partial reads that together show the file: a body read by chunked output.
  const lines = GUIDANCE_TEXT.split('\n');
  const chunked = classify(claudeEvents([
    ['Read', { file_path: realPath, limit: 3 }, numbered(lines.slice(0, 3).join('\n'))],
    ['Read', { file_path: realPath, offset: 4 }, lines.slice(3).map((line, index) => `${index + 4}\t${line}`).join('\n')],
  ]));
  assert.equal(chunked.body, true);
  assert.equal(chunked.evidence.at(-1).basis, 'chunked-output');
  const codexChunked = classify(codexEvents([[`head -n 3 ${realPath}`, lines.slice(0, 3).join('\n')], [`tail -n +4 ${realPath}`, lines.slice(3).join('\n')]]));
  assert.equal(codexChunked.body, true);
  // Without a signature no output establishes the read; a Read with no recorded output still counts by path.
  const unsigned = classifySourceReads(claudeEvents([['Read', { file_path: realPath }, numbered(GUIDANCE_TEXT)]]), [GUIDANCE], { signatures: {} })[GUIDANCE];
  assert.equal(unsigned.body, false);
  assert.equal(classify(claudeEvents([['Read', { file_path: realPath }, null]])).body, true);
});

test('file signatures come from the materialized source and recognize the whole file only', () => {
  assert.deepEqual(fileSignature(path.join(source, GUIDANCE)), SIGNATURE);
  assert.deepEqual(sourceSignatures(source, [GUIDANCE, 'docs/absent.md']), { [GUIDANCE]: SIGNATURE, 'docs/absent.md': null });
  assert.deepEqual(sourceSignatures(null, [GUIDANCE]), { [GUIDANCE]: null });
  assert.equal(outputShowsFile(GUIDANCE_TEXT, SIGNATURE), true);
  assert.equal(outputShowsFile(GUIDANCE_TEXT.slice(0, 30), SIGNATURE), false);
  assert.equal(outputShowsFile('x # Shared guidance\nThe receipt is the first line alone.', SIGNATURE), false, 'a mid-line mention is not a line');
  assert.equal(outputShowsFile(GUIDANCE_TEXT, null), false);
  // The real shared guidance of this checkout has a signature; the suite's premise can be judged against any tree that keeps it.
  const real = fileSignature(path.join(path.dirname(path.dirname(path.dirname(path.dirname(new URL(import.meta.url).pathname)))), 'docs', 'writing-guidance.md'));
  assert.ok(real === null || (real.first !== null && real.last !== null));
});

test('the premise is judged by inspectAttempt: whole file read passes, partial read is premise-not-met, on both engines', () => {
  const caseDef = loadSuite('write-for-humans').cases.find((candidate) => candidate.id === 'receipt-clean');
  const workspace = path.join(scratch, 'inspect-ws');
  fs.cpSync(caseDef.workspace, workspace, { recursive: true });
  fs.mkdirSync(path.join(workspace, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(workspace, 'docs', 'open-studio-notice.md'), 'notice\n');
  const skillBody = (skill) => fs.readFileSync(path.join(source, 'skills', skill, 'SKILL.md'), 'utf8');
  const skillSignatures = Object.fromEntries(SUITE_SKILLS.map((skill) => [skill, { name: skill, heading: skill }]));
  const exit = { status: 0, signal: null, timedOut: false, seconds: 1 };
  const inspect = (events) => inspectAttempt({ caseDef, skills: SUITE_SKILLS, events, finalReply: 'Saved docs/open-studio-notice.md.', workspace, fixtureManifest: caseDef.fixtureManifest, exit, effective: {}, signatures: skillSignatures, sourceRoot: source });
  const skillRead = ['Read', { file_path: '/ws/.claude/skills/write-for-humans/SKILL.md' }, numbered(skillBody('write-for-humans'))];
  const whole = inspect(claudeEvents([skillRead, ['Read', { file_path: '/ws/.claude/skills/write-for-humans/../../docs/writing-guidance.md' }, numbered(GUIDANCE_TEXT)]]));
  assert.equal(whole.verdict, 'pass');
  assert.deepEqual(whole.checks.map((check) => [check.id, check.kind, check.pass]), [['exit', 'criterion', true], ['skillReads.write-for-humans', 'premise', true], [`sourceReads.${GUIDANCE}`, 'premise', true], ['writes.allowed', 'criterion', true], ['writes.required', 'criterion', true], ['claimedArtifacts', 'criterion', true]]);
  assert.deepEqual(whole.classifier.sourceSignatures, { [GUIDANCE]: SIGNATURE });
  assert.equal(whole.sourceReads[GUIDANCE].body, true);
  const partial = inspect(claudeEvents([skillRead, ['Read', { file_path: `${source}/${GUIDANCE}`, limit: 1 }, '1\t# Shared guidance']]));
  assert.equal(partial.verdict, 'premise-not-met');
  assert.match(partial.checks.find((check) => check.id === `sourceReads.${GUIDANCE}`).detail, /partly returned/);
  const codexWhole = inspect(codexEvents([['cat .agents/skills/write-for-humans/SKILL.md', skillBody('write-for-humans')], [`cat '${source}/${GUIDANCE}'`, GUIDANCE_TEXT]]));
  assert.equal(codexWhole.verdict, 'pass');
  const codexNone = inspect(codexEvents([['cat .agents/skills/write-for-humans/SKILL.md', skillBody('write-for-humans')], ['ls docs', 'writing-guidance.md\n']]));
  assert.equal(codexNone.verdict, 'premise-not-met');
  // Without a source root the premise cannot be established from output.
  const rootless = inspectAttempt({ caseDef, skills: SUITE_SKILLS, events: claudeEvents([skillRead, ['Read', { file_path: `${source}/${GUIDANCE}` }, numbered(GUIDANCE_TEXT)]]), finalReply: 'x', workspace, fixtureManifest: caseDef.fixtureManifest, exit, effective: {}, signatures: skillSignatures });
  assert.equal(rootless.verdict, 'premise-not-met');
});

// --- the edit confinement check ---

const HANDBOOK = '# Handbook\n\n## One\n\nFirst section.\n\n## Two\n\nSecond section, to revise.\n\n## Three\n\nThird section.\n';

test('an edit is confined when only the passage between the markers changed', () => {
  assert.deepEqual(passageBounds(HANDBOOK, { after: '## Two', before: '## Three' }), { start: HANDBOOK.indexOf('\nSecond') , end: HANDBOOK.indexOf('## Three') });
  assert.deepEqual(passageBounds(HANDBOOK, { after: '## Three' }), { start: HANDBOOK.indexOf('\nThird'), end: HANDBOOK.length });
  const markers = { after: '## Two', before: '## Three' };
  assert.equal(editConfinement(HANDBOOK, HANDBOOK, markers).confined, true, 'unchanged');
  assert.equal(editConfinement(HANDBOOK, HANDBOOK.replace('Second section, to revise.', 'Second section, revised.\n\nWith a new paragraph.'), markers).confined, true);
  assert.equal(editConfinement(HANDBOOK, HANDBOOK.replace('Second section, to revise.\n\n', ''), markers).confined, true, 'the passage may be emptied');
  const before = editConfinement(HANDBOOK, HANDBOOK.replace('First section.', 'First section, touched.'), markers);
  assert.deepEqual([before.confined, before.prefixKept, before.suffixKept], [false, false, true]);
  const afterwards = editConfinement(HANDBOOK, HANDBOOK.replace('Third section.', 'Third section, touched.'), markers);
  assert.deepEqual([afterwards.confined, afterwards.prefixKept, afterwards.suffixKept], [false, true, false]);
  assert.equal(editConfinement(HANDBOOK, HANDBOOK.replace('## Two', '## Two (renamed)'), markers).confined, false, 'the marker line itself is outside the passage');
  assert.equal(editConfinement(HANDBOOK, 'rewritten\n', markers).confined, false);
  assert.throws(() => passageBounds(HANDBOOK, { after: '## Four' }), /after line '## Four' occurs 0 times/);
  assert.throws(() => passageBounds(`${HANDBOOK}## Two\n`, { after: '## Two' }), /occurs 2 times/);
  assert.throws(() => passageBounds(HANDBOOK, { after: '## Three', before: '## Two' }), /precedes/);
});

test('the loader validates sourceReads, edits and premise ids by name', () => {
  const suites = path.join(scratch, 'suites-validation');
  const base = { 'docs/handbook.md': HANDBOOK };
  makeSuite(suites, 'ok', [{ id: 'one', files: base, deterministic: { exit: 0, skillReads: { 'write-for-humans': 'required' }, sourceReads: { [GUIDANCE]: 'required' }, premise: ['skillReads.write-for-humans', `sourceReads.${GUIDANCE}`], writes: { allowed: ['docs/handbook.md'] }, edits: { 'docs/handbook.md': { after: '## Two', before: '## Three' } } }, semantic: [{ id: 'x', criterion: 'y' }] }]);
  const ok = loadSuite('ok', suites).cases[0].deterministic;
  assert.deepEqual(ok.sourceReads, { [GUIDANCE]: 'required' });
  assert.deepEqual(ok.edits, { 'docs/handbook.md': { after: '## Two', before: '## Three' } });
  assert.deepEqual(ok.premise, ['skillReads.write-for-humans', `sourceReads.${GUIDANCE}`]);
  // Cases without the new expectations load as before, with the claimed-artifact check on by default.
  makeSuite(suites, 'plain', [{ id: 'one', deterministic: { exit: 0, skillReads: { 'write-for-humans': 'required' }, premise: ['skillReads.write-for-humans'], writes: {} } }]);
  assert.deepEqual(loadSuite('plain', suites).cases[0].deterministic, { exit: 0, skillReads: { 'write-for-humans': 'required' }, premise: ['skillReads.write-for-humans'], writes: {}, claimedArtifacts: true });

  makeSuite(suites, 'bad-source-rule', [{ id: 'one', deterministic: { sourceReads: { [GUIDANCE]: 'maybe' } } }]);
  assert.throws(() => loadSuite('bad-source-rule', suites), /sourceReads.docs\/writing-guidance.md must be 'required' or 'forbidden'/);
  makeSuite(suites, 'bad-source-path', [{ id: 'one', deterministic: { sourceReads: { '/etc/passwd': 'required' } } }]);
  assert.throws(() => loadSuite('bad-source-path', suites), /sourceReads path '\/etc\/passwd' must be a relative path/);
  makeSuite(suites, 'bad-source-premise', [{ id: 'one', deterministic: { sourceReads: { [GUIDANCE]: 'required' }, premise: ['sourceReads.docs/other.md'] } }]);
  assert.throws(() => loadSuite('bad-source-premise', suites), /premise 'sourceReads.docs\/other.md' names no skillReads check or sourceReads check/);
  makeSuite(suites, 'bad-premise-kind', [{ id: 'one', deterministic: { premise: ['writes.allowed'] } }]);
  assert.throws(() => loadSuite('bad-premise-kind', suites), /premise 'writes.allowed' names no skillReads check/);
  makeSuite(suites, 'bad-edit-file', [{ id: 'one', deterministic: { edits: { 'docs/absent.md': { after: '## Two' } } } }]);
  assert.throws(() => loadSuite('bad-edit-file', suites), /edits.docs\/absent.md names no fixture file/);
  makeSuite(suites, 'bad-edit-marker', [{ id: 'one', files: base, deterministic: { edits: { 'docs/handbook.md': { after: '## Four' } } } }]);
  assert.throws(() => loadSuite('bad-edit-marker', suites), /edits.docs\/handbook.md: after line '## Four' occurs 0 times/);
  makeSuite(suites, 'bad-edit-twice', [{ id: 'one', files: { 'docs/handbook.md': `${HANDBOOK}## Two\n` }, deterministic: { edits: { 'docs/handbook.md': { after: '## Two' } } } }]);
  assert.throws(() => loadSuite('bad-edit-twice', suites), /occurs 2 times; it must occur exactly once/);
  makeSuite(suites, 'bad-edit-order', [{ id: 'one', files: base, deterministic: { edits: { 'docs/handbook.md': { after: '## Three', before: '## Two' } } } }]);
  assert.throws(() => loadSuite('bad-edit-order', suites), /before line '## Two' precedes after line '## Three'/);
  makeSuite(suites, 'bad-edit-shape', [{ id: 'one', files: base, deterministic: { edits: { 'docs/handbook.md': { before: '## Three' } } } }]);
  assert.throws(() => loadSuite('bad-edit-shape', suites), /needs an 'after' marker line/);
  makeSuite(suites, 'bad-edit-allowed', [{ id: 'one', files: base, deterministic: { writes: { allowed: ['docs/other.md'] }, edits: { 'docs/handbook.md': { after: '## Two' } } } }]);
  assert.throws(() => loadSuite('bad-edit-allowed', suites), /edits.docs\/handbook.md is not in writes.allowed/);
});

// --- end to end through the fake engine, both engines ---

test('the fake engine exercises both checks end to end on both engines, and inspect recomputes them unchanged', () => {
  const suites = path.join(scratch, 'suites-e2e');
  const guidanceRule = { skillReads: { 'write-for-humans': 'required' }, sourceReads: { [GUIDANCE]: 'required' }, premise: ['skillReads.write-for-humans', `sourceReads.${GUIDANCE}`] };
  const revised = HANDBOOK.replace('Second section, to revise.', 'Second section, revised from the minutes.');
  const cases = [
    // The guidance read through the installed link, as the skill directs.
    { id: 'via-link', directive: { readSkills: ['write-for-humans'], readFiles: ['.claude/skills/write-for-humans/../../docs/writing-guidance.md'], writes: [{ path: 'docs/out.md', text: 'out\n' }], reply: 'Saved docs/out.md.' },
      deterministic: { exit: 0, ...guidanceRule, writes: { allowed: ['docs/out.md'], required: ['docs/out.md'] } }, semantic: [{ id: 'receipt', criterion: 'the receipt alone' }] },
    // The guidance read at its real path under the materialized source.
    { id: 'via-real', directive: { readSkills: ['write-for-humans'], readFiles: [path.join(source, GUIDANCE)], writes: [{ path: 'docs/out.md', text: 'out\n' }], reply: 'Saved docs/out.md.' },
      deterministic: { exit: 0, ...guidanceRule, writes: { allowed: ['docs/out.md'], required: ['docs/out.md'] } }, semantic: [{ id: 'receipt', criterion: 'the receipt alone' }] },
    // Only the first bytes of the guidance came back: the premise is not met.
    { id: 'truncated', directive: { readSkills: ['write-for-humans'], readFiles: [{ path: path.join(source, GUIDANCE), limit: 20 }], writes: [{ path: 'docs/out.md', text: 'out\n' }], reply: 'Saved docs/out.md.' },
      deterministic: { exit: 0, ...guidanceRule, writes: { allowed: ['docs/out.md'], required: ['docs/out.md'] } }, semantic: [{ id: 'receipt', criterion: 'the receipt alone' }] },
    // A revision confined to the passage, and one that touched the text after it.
    { id: 'confined', files: { 'docs/handbook.md': HANDBOOK }, directive: { readSkills: ['write-for-humans'], readFiles: [path.join(source, GUIDANCE)], writes: [{ path: 'docs/handbook.md', text: revised }], reply: 'Revised docs/handbook.md.' },
      deterministic: { exit: 0, ...guidanceRule, writes: { allowed: ['docs/handbook.md'], required: ['docs/handbook.md'] }, edits: { 'docs/handbook.md': { after: '## Two', before: '## Three' } } }, semantic: [{ id: 'content', criterion: 'the section reflects the minutes' }] },
    { id: 'spilled', files: { 'docs/handbook.md': HANDBOOK }, directive: { readSkills: ['write-for-humans'], readFiles: [path.join(source, GUIDANCE)], writes: [{ path: 'docs/handbook.md', text: revised.replace('Third section.', 'Third section, tidied.') }], reply: 'Revised docs/handbook.md.' },
      deterministic: { exit: 0, ...guidanceRule, writes: { allowed: ['docs/handbook.md'], required: ['docs/handbook.md'] }, edits: { 'docs/handbook.md': { after: '## Two', before: '## Three' } } }, semantic: [{ id: 'content', criterion: 'the section reflects the minutes' }] },
  ];
  makeSuite(suites, 'wfh-e2e', cases, { skills: ['write-for-humans', 'clarify-artifact'] });
  const runDir = path.join(scratch, 'runs', 'e2e');
  const verdicts = {};
  for (const engine of ['claude', 'codex']) {
    const plan = planRun({ suiteName: 'wfh-e2e', suitesRoot: suites, engine, model: engine === 'claude' ? 'claude-opus-5-5' : 'gpt-6.1-sol', effort: 'high', replicates: 1, source: { dir: source }, runDir, executables: fakeExecutables, timeoutSeconds: 60 });
    const records = executeRun(plan, { out: quiet });
    assert.equal(records.length, cases.length, engine);
    for (const record of records) {
      assert.equal(record.status, 'behavioral', `${engine} ${record.case}`);
      verdicts[`${record.case}/${engine}`] = record.verdict;
      const inspection = readJson(path.join(runDir, 'attempts', record.case, engine, '001', 'inspection.json'));
      const check = inspection.checks.find((entry) => entry.id === `sourceReads.${GUIDANCE}`);
      assert.equal(check.kind, 'premise', `${engine} ${record.case}`);
      assert.deepEqual(inspection.classifier.sourceSignatures, { [GUIDANCE]: SIGNATURE }, `${engine} ${record.case} takes the signature from the run's source`);
      if (record.case === 'truncated') assert.equal(inspection.sourceReads[GUIDANCE].partial, true);
      else assert.equal(inspection.sourceReads[GUIDANCE].body, true, `${engine} ${record.case}`);
    }
  }
  const expected = { 'via-link': 'pass', 'via-real': 'pass', truncated: 'premise-not-met', confined: 'pass', spilled: 'fail' };
  for (const engine of ['claude', 'codex']) for (const [id, verdict] of Object.entries(expected)) assert.equal(verdicts[`${id}/${engine}`], verdict, `${id} on ${engine}`);
  const spilled = readJson(path.join(runDir, 'attempts', 'spilled', 'codex', '001', 'inspection.json')).checks.find((entry) => entry.id === 'edits.docs/handbook.md');
  assert.equal(spilled.pass, false);
  assert.match(spilled.detail, /changed outside the passage after '## Two' and before '## Three': text after it/);
  const confined = readJson(path.join(runDir, 'attempts', 'confined', 'claude', '001', 'inspection.json')).checks.find((entry) => entry.id === 'edits.docs/handbook.md');
  assert.equal(confined.pass, true);
  // The recompute passes the run's source root through, so every verdict stands.
  const { outcomes } = reinspectRun({ runDir, out: quiet });
  assert.equal(outcomes.length, cases.length * 2);
  for (const outcome of outcomes) {
    assert.equal(outcome.ok, true, outcome.attempt);
    assert.equal(outcome.after.verdict, outcome.before.verdict, outcome.attempt);
  }
});
