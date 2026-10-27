// The source-read check recognizes a skill's own copy of a shared reference
// (`skills/<skill>/references/<basename>`) as a read of the canonical source
// file when the copy's body equals the canonical body after an optional
// header line; a copy whose body differs is a stale alias and never counts.
// Aliases are resolved from the materialized source, never guessed from a
// path. Exercised against fake traces in both engines' forms and end to end
// through the fake engine. No network, no paid call.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, test } from 'node:test';
import { engineFor } from '../lib/engines.mjs';
import { aliasBodyMatch, classifySourceReads, inspectAttempt, sourceAliases } from '../lib/inspect.mjs';
import { readJson } from '../lib/common.mjs';
import { reinspectRun } from '../lib/reinspect.mjs';
import { executeRun, planRun } from '../lib/run.mjs';
import { fakeExecutables, makeSource, makeSuite, temporaryDirectory } from '../test-support/fixtures.mjs';

const scratch = temporaryDirectory('source-aliases');
after(() => fs.rmSync(scratch, { recursive: true, force: true }));

const quiet = { info() {}, error() {} };
const GUIDANCE = 'docs/writing-guidance.md';
const SKILLS = ['write-for-humans', 'write-for-agents', 'clarify-artifact'];
const GUIDANCE_TEXT = '# Shared guidance\n\nSelect before drafting.\n\n## Deliver\n\n  The receipt is the first line alone.\n';
const HEADER = '<!-- Generated from docs/writing-guidance.md. -->';
const SIGNATURE = { first: '# Shared guidance', last: 'The receipt is the first line alone.' };
const STALE_TEXT = GUIDANCE_TEXT.replace('Select before drafting.', 'Select before drafting, and cite the rule.');

/** A source tree with the canonical guidance and the named skill-local copies, each `{ skill, text }`. */
function sourceWith(label, copies) {
  const root = makeSource(path.join(scratch, `source-${label}`), SKILLS);
  fs.writeFileSync(path.join(root, 'docs', 'writing-guidance.md'), GUIDANCE_TEXT);
  for (const { skill, text } of copies) {
    fs.mkdirSync(path.join(root, 'skills', skill, 'references'), { recursive: true });
    fs.writeFileSync(path.join(root, 'skills', skill, 'references', 'writing-guidance.md'), text);
  }
  return root;
}

const claudeTrace = (calls) => calls.map(([name, input, output], index) => [
  JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', id: `t${index}`, name, input }] } }),
  output === null ? null : JSON.stringify({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: `t${index}`, content: output }] } }),
].filter(Boolean).join('\n')).join('\n');
const codexTrace = (commands) => commands.map(([command, output], index) => JSON.stringify({ type: 'item.completed', item: { id: `i${index}`, type: 'command_execution', command: `/bin/zsh -lc ${JSON.stringify(command)}`, aggregated_output: output, exit_code: 0, status: 'completed' } })).join('\n');
const numbered = (text) => text.split('\n').map((line, index) => `${index + 1}\t${line}`).join('\n');
const claudeEvents = (calls) => engineFor('claude').events(claudeTrace(calls));
const codexEvents = (commands) => engineFor('codex').events(codexTrace(commands));
const flags = (read) => ({ body: read.body, partial: read.partial, listing: read.listing, staleAlias: read.staleAlias, forms: read.forms, skillLocal: read.skillLocal });

const ALIAS = { skill: 'write-for-humans', path: 'skills/write-for-humans/references/writing-guidance.md', status: 'alias', header: null };
const classify = (events, aliases = [ALIAS]) => classifySourceReads(events, [GUIDANCE], { signatures: { [GUIDANCE]: SIGNATURE }, aliases: { [GUIDANCE]: aliases } })[GUIDANCE];
const LINK_PATH = '/run/attempt/workspace/.claude/skills/write-for-humans/references/writing-guidance.md';
const AGENTS_PATH = '.agents/skills/write-for-humans/references/writing-guidance.md';
const REAL_ALIAS = '/run/source/skills/write-for-humans/references/writing-guidance.md';
const CANONICAL = '/run/source/docs/writing-guidance.md';

test('a copy is an alias when its body equals the canonical body, with or without one header line; otherwise it is stale', () => {
  assert.deepEqual(aliasBodyMatch(GUIDANCE_TEXT, GUIDANCE_TEXT), { status: 'alias', header: null });
  assert.deepEqual(aliasBodyMatch(GUIDANCE_TEXT, `${HEADER}\n\n${GUIDANCE_TEXT}`), { status: 'alias', header: HEADER });
  assert.deepEqual(aliasBodyMatch(GUIDANCE_TEXT, `${HEADER}\n${GUIDANCE_TEXT}`), { status: 'alias', header: HEADER }, 'no blank line after the header');
  assert.deepEqual(aliasBodyMatch(GUIDANCE_TEXT, GUIDANCE_TEXT.replace(/\n/g, '\r\n')), { status: 'alias', header: null }, 'line endings do not make a copy stale');
  assert.deepEqual(aliasBodyMatch(GUIDANCE_TEXT, GUIDANCE_TEXT.trimEnd()), { status: 'alias', header: null }, 'a missing final newline does not either');
  assert.deepEqual(aliasBodyMatch(GUIDANCE_TEXT, STALE_TEXT), { status: 'stale-alias', header: null });
  assert.deepEqual(aliasBodyMatch(GUIDANCE_TEXT, `${HEADER}\n\n${STALE_TEXT}`), { status: 'stale-alias', header: null }, 'a header does not excuse a changed body');
  assert.deepEqual(aliasBodyMatch(GUIDANCE_TEXT, `${HEADER}\n${HEADER}\n${GUIDANCE_TEXT}`), { status: 'stale-alias', header: null }, 'only one header line is allowed');
  assert.deepEqual(aliasBodyMatch(GUIDANCE_TEXT, GUIDANCE_TEXT.slice(0, 30)), { status: 'stale-alias', header: null });
  assert.deepEqual(aliasBodyMatch(GUIDANCE_TEXT, ''), { status: 'stale-alias', header: null });
});

test('aliases are resolved from the materialized source: regular files under skills/*/references with the canonical basename', () => {
  const none = sourceWith('none', []);
  assert.deepEqual(sourceAliases(none, [GUIDANCE]), { [GUIDANCE]: [] });
  assert.deepEqual(sourceAliases(null, [GUIDANCE]), { [GUIDANCE]: [] }, 'no source root, no alias');
  assert.deepEqual(sourceAliases(none, ['docs/absent.md']), { 'docs/absent.md': [] }, 'no canonical file, no alias');
  const mixed = sourceWith('mixed', [
    { skill: 'write-for-humans', text: `${HEADER}\n\n${GUIDANCE_TEXT}` },
    { skill: 'write-for-agents', text: GUIDANCE_TEXT },
    { skill: 'clarify-artifact', text: STALE_TEXT },
  ]);
  // A same-named file elsewhere in a skill, a link, and a copy under a different basename are not aliases.
  fs.writeFileSync(path.join(mixed, 'skills', 'write-for-humans', 'writing-guidance.md'), GUIDANCE_TEXT);
  fs.writeFileSync(path.join(mixed, 'skills', 'write-for-humans', 'references', 'other-guidance.md'), GUIDANCE_TEXT);
  fs.mkdirSync(path.join(mixed, 'skills', 'record-decision', 'references'), { recursive: true });
  fs.symlinkSync(path.join(mixed, 'docs', 'writing-guidance.md'), path.join(mixed, 'skills', 'record-decision', 'references', 'writing-guidance.md'));
  assert.deepEqual(sourceAliases(mixed, [GUIDANCE]), {
    [GUIDANCE]: [
      { skill: 'clarify-artifact', path: 'skills/clarify-artifact/references/writing-guidance.md', status: 'stale-alias', header: null },
      { skill: 'write-for-agents', path: 'skills/write-for-agents/references/writing-guidance.md', status: 'alias', header: null },
      { skill: 'write-for-humans', path: 'skills/write-for-humans/references/writing-guidance.md', status: 'alias', header: HEADER },
    ],
  });
});

test('a Read of the canonical path or of a skill-local alias whose output shows the file is a body read, with the path form recorded', () => {
  const canonical = classify(claudeEvents([['Read', { file_path: CANONICAL }, numbered(GUIDANCE_TEXT)]]));
  assert.deepEqual(flags(canonical), { body: true, partial: false, listing: false, staleAlias: false, forms: ['canonical'], skillLocal: [] });
  assert.equal(canonical.evidence[0].form, 'canonical');
  assert.equal(canonical.evidence[0].skill, null);
  // The installed link, the Codex link and the real path under the materialized source all end with the alias path.
  for (const file of [LINK_PATH, AGENTS_PATH, REAL_ALIAS]) {
    const local = classify(claudeEvents([['Read', { file_path: file }, numbered(GUIDANCE_TEXT)]]));
    assert.deepEqual(flags(local), { body: true, partial: false, listing: false, staleAlias: false, forms: ['skill-local'], skillLocal: ['write-for-humans'] }, file);
    assert.equal(local.evidence[0].basis, 'read-path', file);
    assert.equal(local.evidence[0].form, 'skill-local', file);
    assert.equal(local.evidence[0].skill, 'write-for-humans', file);
  }
  // The generated copy's header line precedes the signature; the signature is still the canonical file's.
  const headed = classify(claudeEvents([['Read', { file_path: LINK_PATH }, numbered(`${HEADER}\n\n${GUIDANCE_TEXT}`)]]));
  assert.equal(headed.body, true);
  assert.deepEqual(headed.forms, ['skill-local']);
  // Both forms read: both recorded.
  const both = classify(claudeEvents([['Read', { file_path: CANONICAL }, numbered(GUIDANCE_TEXT)], ['Read', { file_path: LINK_PATH }, numbered(GUIDANCE_TEXT)]]));
  assert.deepEqual(both.forms, ['canonical', 'skill-local']);
  assert.deepEqual(both.skillLocal, ['write-for-humans']);
  // A Read of the alias with no recorded output counts by path, as the canonical path does.
  assert.equal(classify(claudeEvents([['Read', { file_path: LINK_PATH }, null]])).body, true);
  // Without a declared alias the same path names nothing: nothing is guessed from a path.
  const undeclared = classify(claudeEvents([['Read', { file_path: LINK_PATH }, numbered(GUIDANCE_TEXT)]]), []);
  assert.deepEqual(flags(undeclared), { body: false, partial: false, listing: false, staleAlias: false, forms: [], skillLocal: [] });
  assert.deepEqual(undeclared.evidence, []);
  // An alias of another skill is not this skill's.
  const other = classify(claudeEvents([['Read', { file_path: '/ws/.claude/skills/write-for-agents/references/writing-guidance.md' }, numbered(GUIDANCE_TEXT)]]));
  assert.equal(other.body, false);
});

test('a partial read of a skill-local alias is partial, and chunks through the alias together count', () => {
  const truncated = classify(claudeEvents([['Read', { file_path: LINK_PATH, limit: 2 }, numbered(GUIDANCE_TEXT).split('\n').slice(0, 2).join('\n')]]));
  assert.deepEqual(flags(truncated), { body: false, partial: true, listing: false, staleAlias: false, forms: ['skill-local'], skillLocal: ['write-for-humans'] });
  assert.match(truncated.how[0], /output lacks the file's first or last line/);
  const failed = classify(claudeEvents([['Read', { file_path: LINK_PATH }, `File does not exist: ${LINK_PATH}`]]));
  assert.equal(failed.partial, true);
  assert.equal(failed.body, false);
  const lines = GUIDANCE_TEXT.split('\n');
  const chunked = classify(claudeEvents([
    ['Read', { file_path: LINK_PATH, limit: 3 }, numbered(lines.slice(0, 3).join('\n'))],
    ['Read', { file_path: LINK_PATH, offset: 4 }, lines.slice(3).map((line, index) => `${index + 4}\t${line}`).join('\n')],
  ]));
  assert.equal(chunked.body, true);
  assert.equal(chunked.evidence.at(-1).basis, 'chunked-output');
  assert.deepEqual(chunked.forms, ['skill-local']);
  const listed = classify(codexEvents([[`ls ${path.dirname(AGENTS_PATH)}`, 'writing-guidance.md\n'], [`cat ${AGENTS_PATH}`, null]]));
  assert.deepEqual(flags(listed), { body: false, partial: false, listing: true, staleAlias: false, forms: [], skillLocal: [] });
});

test('a shell read of the alias path whose output shows the file is a body read on both engines\' trace forms', () => {
  const codex = classify(codexEvents([[`cat ${AGENTS_PATH}`, `${HEADER}\n\n${GUIDANCE_TEXT}`]]));
  assert.deepEqual(flags(codex), { body: true, partial: false, listing: false, staleAlias: false, forms: ['skill-local'], skillLocal: ['write-for-humans'] });
  assert.equal(codex.evidence[0].basis, 'output-signature');
  assert.equal(codex.evidence[0].form, 'skill-local');
  assert.equal(codex.evidence[0].skill, 'write-for-humans');
  const claude = classify(claudeEvents([['Bash', { command: `cat -n '${LINK_PATH}'` }, numbered(GUIDANCE_TEXT)]]));
  assert.deepEqual(flags(claude), { body: true, partial: false, listing: false, staleAlias: false, forms: ['skill-local'], skillLocal: ['write-for-humans'] });
  assert.equal(classify(codexEvents([[`sed -n '1,200p' ${REAL_ALIAS}`, GUIDANCE_TEXT]])).body, true);
  // A command whose output shows the file without naming a path still counts; no form is known.
  const piped = classify(codexEvents([['find .agents/skills -name "*.md" | xargs cat', `${HEADER}\n\n${GUIDANCE_TEXT}`]]));
  assert.equal(piped.body, true);
  assert.deepEqual(piped.forms, []);
  const head = classify(codexEvents([[`head -c 40 ${AGENTS_PATH}`, GUIDANCE_TEXT.slice(0, 40)]]));
  assert.deepEqual(flags(head), { body: false, partial: true, listing: false, staleAlias: false, forms: ['skill-local'], skillLocal: ['write-for-humans'] });
  const excluded = classify(codexEvents([[`rg --files -g '!${AGENTS_PATH}' .`, 'README.md\n']]));
  assert.equal(excluded.body || excluded.partial || excluded.listing || excluded.staleAlias, false);
  assert.equal(excluded.evidence[0].basis, 'exclusion-only');
});

test('a stale alias never counts: a Read or a shell read naming it is recorded as stale-alias, whatever the output shows', () => {
  const stale = [{ ...ALIAS, status: 'stale-alias' }];
  // The stale copy still begins and ends as the canonical file does, so its output carries the signature.
  const read = classify(claudeEvents([['Read', { file_path: LINK_PATH }, numbered(STALE_TEXT)]]), stale);
  assert.deepEqual(flags(read), { body: false, partial: false, listing: false, staleAlias: true, forms: [], skillLocal: [] });
  assert.equal(read.evidence[0].basis, 'stale-alias');
  assert.equal(read.evidence[0].result, 'stale-alias');
  assert.equal(read.evidence[0].skill, 'write-for-humans');
  assert.match(read.how[0], /names a stale skill-local copy of docs\/writing-guidance\.md under skills\/write-for-humans; not a read/);
  const shell = classify(codexEvents([[`cat ${AGENTS_PATH}`, STALE_TEXT]]), stale);
  assert.deepEqual(flags(shell), { body: false, partial: false, listing: false, staleAlias: true, forms: [], skillLocal: [] });
  assert.equal(classify(codexEvents([[`cat ${AGENTS_PATH}`, null]]), stale).staleAlias, true, 'no output recorded: still only the stale copy');
  // A stale chunk never joins with a canonical chunk, and a canonical read beside a stale one still counts.
  const lines = GUIDANCE_TEXT.split('\n');
  const mixedChunks = classify(claudeEvents([
    ['Read', { file_path: CANONICAL, limit: 3 }, numbered(lines.slice(0, 3).join('\n'))],
    ['Read', { file_path: LINK_PATH, offset: 4 }, lines.slice(3).map((line, index) => `${index + 4}\t${line}`).join('\n')],
  ]), stale);
  assert.equal(mixedChunks.body, false);
  assert.equal(mixedChunks.partial, true);
  assert.equal(mixedChunks.staleAlias, true);
  const beside = classify(claudeEvents([['Read', { file_path: LINK_PATH }, numbered(STALE_TEXT)], ['Read', { file_path: CANONICAL }, numbered(GUIDANCE_TEXT)]]), stale);
  assert.equal(beside.body, true);
  assert.deepEqual(beside.forms, ['canonical']);
  assert.equal(beside.staleAlias, true);
  // One command naming the canonical file and the stale copy: the canonical path carries it.
  const both = classify(codexEvents([[`cat ${CANONICAL} ${AGENTS_PATH}`, `${GUIDANCE_TEXT}${STALE_TEXT}`]]), stale);
  assert.equal(both.body, true);
  assert.equal(both.staleAlias, false);
});

const exitOk = { status: 0, signal: null, timedOut: false, seconds: 1 };
const caseDef = {
  id: 'c',
  deterministic: { exit: 0, skillReads: {}, sourceReads: { [GUIDANCE]: 'required' }, premise: [`sourceReads.${GUIDANCE}`], writes: {}, claimedArtifacts: true },
  semantic: [],
};

test('inspectAttempt resolves the aliases from the source root and records them with the classifier', () => {
  const workspace = path.join(scratch, 'inspect-ws');
  fs.mkdirSync(workspace, { recursive: true });
  fs.writeFileSync(path.join(workspace, 'README.md'), 'fixture\n');
  const fixtureManifest = { 'README.md': { sha256: 'x', bytes: 8 } };
  const inspect = (sourceRoot, events) => inspectAttempt({ caseDef, skills: [], events, finalReply: 'Done.', workspace, fixtureManifest, exit: exitOk, effective: {}, sourceRoot });
  const headed = sourceWith('inspect-headed', [{ skill: 'write-for-humans', text: `${HEADER}\n\n${GUIDANCE_TEXT}` }]);
  const local = inspect(headed, claudeEvents([['Read', { file_path: LINK_PATH }, numbered(`${HEADER}\n\n${GUIDANCE_TEXT}`)]]));
  assert.equal(local.verdict, 'pass');
  assert.equal(local.classifier.version, 9);
  assert.deepEqual(local.classifier.sourceAliases, { [GUIDANCE]: [{ ...ALIAS, header: HEADER }] });
  assert.deepEqual(local.classifier.sourceSignatures, { [GUIDANCE]: SIGNATURE }, 'the signature is the canonical file\'s');
  assert.deepEqual(local.sourceReads[GUIDANCE].forms, ['skill-local']);
  assert.deepEqual(local.sourceReads[GUIDANCE].skillLocal, ['write-for-humans']);
  assert.equal(local.checks.find((check) => check.id === `sourceReads.${GUIDANCE}`).detail, `${GUIDANCE}: read through skill-local copy (write-for-humans)`);
  const canonical = inspect(headed, claudeEvents([['Read', { file_path: CANONICAL }, numbered(GUIDANCE_TEXT)]]));
  assert.equal(canonical.verdict, 'pass');
  assert.equal(canonical.checks.find((check) => check.id === `sourceReads.${GUIDANCE}`).detail, `${GUIDANCE}: read through canonical`);
  const staleRoot = sourceWith('inspect-stale', [{ skill: 'write-for-humans', text: STALE_TEXT }]);
  const stale = inspect(staleRoot, claudeEvents([['Read', { file_path: LINK_PATH }, numbered(STALE_TEXT)]]));
  assert.equal(stale.verdict, 'premise-not-met');
  assert.equal(stale.classifier.sourceAliases[GUIDANCE][0].status, 'stale-alias');
  assert.equal(stale.checks.find((check) => check.id === `sourceReads.${GUIDANCE}`).detail, `${GUIDANCE}: stale skill-local copy named`);
  const partial = inspect(headed, claudeEvents([['Read', { file_path: LINK_PATH, limit: 1 }, '1\t<!-- Generated from docs/writing-guidance.md. -->']]));
  assert.equal(partial.verdict, 'premise-not-met');
  assert.equal(partial.checks.find((check) => check.id === `sourceReads.${GUIDANCE}`).detail, `${GUIDANCE}: partly returned through skill-local copy (write-for-humans)`);
  // A source tree without aliases: the alias path names nothing and the record carries no alias.
  const plain = sourceWith('inspect-plain', []);
  const unaliased = inspect(plain, claudeEvents([['Read', { file_path: LINK_PATH }, numbered(GUIDANCE_TEXT)]]));
  assert.equal(unaliased.verdict, 'premise-not-met');
  assert.deepEqual(unaliased.classifier.sourceAliases, { [GUIDANCE]: [] });
  assert.equal(unaliased.checks.find((check) => check.id === `sourceReads.${GUIDANCE}`).detail, `${GUIDANCE}: not mentioned`);
  assert.equal(inspect(plain, claudeEvents([['Read', { file_path: CANONICAL }, numbered(GUIDANCE_TEXT)]])).verdict, 'pass');
  // No source root: no alias and no signature, as before.
  assert.deepEqual(inspect(null, []).classifier.sourceAliases, { [GUIDANCE]: [] });
});

test('end to end through the fake engine on both engines: alias reads pass, a stale alias is premise-not-met, and inspect recomputes them unchanged', () => {
  const source = sourceWith('e2e', [{ skill: 'write-for-humans', text: `${HEADER}\n\n${GUIDANCE_TEXT}` }, { skill: 'write-for-agents', text: STALE_TEXT }]);
  const suites = path.join(scratch, 'suites-e2e');
  const rule = { exit: 0, skillReads: { 'write-for-humans': 'required' }, sourceReads: { [GUIDANCE]: 'required' }, premise: ['skillReads.write-for-humans', `sourceReads.${GUIDANCE}`], writes: { allowed: ['docs/out.md'], required: ['docs/out.md'] } };
  const semantic = [{ id: 'receipt', criterion: 'the receipt alone' }];
  const out = { writes: [{ path: 'docs/out.md', text: 'out\n' }], reply: 'Saved docs/out.md.' };
  const cases = [
    // The skill-local copy read through the installed link, as a skill reading a plain path in its own directory does.
    { id: 'via-local-link', directive: { readSkills: ['write-for-humans'], readFiles: ['.claude/skills/write-for-humans/references/writing-guidance.md'], ...out }, deterministic: rule, semantic },
    // The copy at its real path under the materialized source.
    { id: 'via-local-real', directive: { readSkills: ['write-for-humans'], readFiles: [path.join(source, 'skills', 'write-for-humans', 'references', 'writing-guidance.md')], ...out }, deterministic: rule, semantic },
    // The canonical file, as today.
    { id: 'via-canonical', directive: { readSkills: ['write-for-humans'], readFiles: [path.join(source, GUIDANCE)], ...out }, deterministic: rule, semantic },
    // Only the first bytes of the copy came back.
    { id: 'local-truncated', directive: { readSkills: ['write-for-humans'], readFiles: [{ path: '.claude/skills/write-for-humans/references/writing-guidance.md', limit: 20 }], ...out }, deterministic: rule, semantic },
    // The other skill's copy is stale: reading it establishes nothing.
    { id: 'stale-copy', directive: { readSkills: ['write-for-humans'], readFiles: ['.claude/skills/write-for-agents/references/writing-guidance.md'], ...out }, deterministic: rule, semantic },
  ];
  makeSuite(suites, 'alias-e2e', cases, { skills: ['write-for-humans', 'write-for-agents'] });
  const runDir = path.join(scratch, 'runs', 'e2e');
  const expected = { 'via-local-link': 'pass', 'via-local-real': 'pass', 'via-canonical': 'pass', 'local-truncated': 'premise-not-met', 'stale-copy': 'premise-not-met' };
  for (const engine of ['claude', 'codex']) {
    const plan = planRun({ suiteName: 'alias-e2e', suitesRoot: suites, engine, model: engine === 'claude' ? 'claude-opus-5-5' : 'gpt-6.1-sol', effort: 'high', replicates: 1, source: { dir: source }, runDir, executables: fakeExecutables, timeoutSeconds: 60 });
    const records = executeRun(plan, { out: quiet });
    assert.equal(records.length, cases.length, engine);
    for (const record of records) {
      assert.equal(record.status, 'behavioral', `${engine} ${record.case}`);
      assert.equal(record.verdict, expected[record.case], `${record.case} on ${engine}`);
      const inspection = readJson(path.join(runDir, 'attempts', record.case, engine, '001', 'inspection.json'));
      const read = inspection.sourceReads[GUIDANCE];
      assert.equal(inspection.classifier.version, 9);
      assert.deepEqual(inspection.classifier.sourceAliases[GUIDANCE].map((alias) => [alias.skill, alias.status, alias.header]), [['write-for-agents', 'stale-alias', null], ['write-for-humans', 'alias', HEADER]], `${engine} ${record.case} resolves the aliases from the run's source`);
      assert.deepEqual(inspection.classifier.sourceSignatures, { [GUIDANCE]: SIGNATURE });
      if (record.case === 'via-canonical') assert.deepEqual([read.body, read.forms, read.skillLocal], [true, ['canonical'], []], `${engine} ${record.case}`);
      else if (record.case === 'local-truncated') assert.deepEqual([read.body, read.partial, read.forms, read.skillLocal], [false, true, ['skill-local'], ['write-for-humans']], `${engine} ${record.case}`);
      else if (record.case === 'stale-copy') assert.deepEqual([read.body, read.partial, read.staleAlias, read.forms], [false, false, true, []], `${engine} ${record.case}`);
      else assert.deepEqual([read.body, read.forms, read.skillLocal], [true, ['skill-local'], ['write-for-humans']], `${engine} ${record.case}`);
    }
  }
  const { outcomes } = reinspectRun({ runDir, out: quiet });
  assert.equal(outcomes.length, cases.length * 2);
  for (const outcome of outcomes) {
    assert.equal(outcome.ok, true, outcome.attempt);
    assert.equal(outcome.after.verdict, outcome.before.verdict, outcome.attempt);
  }
});
