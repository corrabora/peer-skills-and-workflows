// Deterministic inspection: a skill's body read or invocation is told apart
// from its name in a listing or a search hit, in both engines' trace shapes,
// on positive evidence only (a Read of its SKILL.md, a Skill invocation, or
// a command whose returned output shows the body), never from a path that
// appears only in an exclusion; file changes are read against the fixture;
// and the verdict separates a failed premise from a failed criterion.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, test } from 'node:test';
import { manifestOf } from '../lib/common.mjs';
import { ENGINES } from '../lib/engines.mjs';
import { classifySkillReads, fileChanges, inspectAttempt, outputShowsBody, pathArguments, shellTokens, simpleCommands, skillSignatures } from '../lib/inspect.mjs';
import { temporaryDirectory } from '../test-support/fixtures.mjs';

const scratch = temporaryDirectory('inspect');
after(() => fs.rmSync(scratch, { recursive: true, force: true }));

const SKILLS = ['clarify-artifact', 'write-for-humans', 'write-for-agents'];
const claudeTool = (name, input, output = null) => ({ kind: 'tool', tool: name, input, output });
const codexCommand = (text, output = null) => ({ kind: 'command', text, output });
const title = (skill) => skill.split('-').map((word, index) => (index === 0 ? word[0].toUpperCase() + word.slice(1) : word)).join(' ');
const body = (skill) => `---\nname: ${skill}\ndescription: the ${skill} skill\n---\n\n# ${title(skill)}\n\nBody of ${skill}. See [the other](../other-skill/SKILL.md).\n`;
const SIGNATURES = Object.fromEntries(SKILLS.map((skill) => [skill, { name: skill, heading: title(skill) }]));
const classify = (events) => classifySkillReads(events, SKILLS, { signatures: SIGNATURES });
const flags = (read) => ({ body: read.body, invoked: read.invoked, partial: read.partial, listing: read.listing });

// The command from the clarify-artifact baseline cell index-settles/codex/001, exactly as Codex recorded it, and its output: a
// directory listing, the three workspace paths the exclusion left, and the README. No skill body.
const RP_COMMAND = `/bin/zsh -lc "ls -la; rg --files --hidden -g '"'!.git/**'"' -g '"'!.agents/skills/**'"' -g '"'!.codex/**'"'; cat README.md"`;
const RP_SCRIPT = "ls -la; rg --files --hidden -g '!.git/**' -g '!.agents/skills/**' -g '!.codex/**'; cat README.md";
const RP_OUTPUT = 'total 8\ndrwxr-xr-x@  8 phillip  staff  256 Oct 14 12:02 .\ndrwxr-xr-x@  3 phillip  staff   96 Oct 14 12:02 .agents\ndrwxr-xr-x@  3 phillip  staff   96 Oct 14 12:02 .claude\n-rw-r--r--@  1 phillip  staff  335 Oct 14 12:02 README.md\nREADME.md\nminutes/2026-09.md\neditorial/INDEX.md\n# Kestrel Ridge Hut Association: working files\n\nThe association runs two mountain huts, Kestrel and Tarn, for members and\nbooked guests.\n';

test('shell text is split into words and simple commands the way a shell reads it, wrappers unwrapped', () => {
  assert.deepEqual(simpleCommands(RP_COMMAND), [
    ['ls', '-la'],
    ['rg', '--files', '--hidden', '-g', '!.git/**', '-g', '!.agents/skills/**', '-g', '!.codex/**'],
    ['cat', 'README.md'],
  ]);
  assert.deepEqual(simpleCommands('/bin/zsh -lc "cat \'/a b/skills/x/SKILL.md\'"'), [['cat', '/a b/skills/x/SKILL.md']]);
  assert.deepEqual(simpleCommands('FOO=1 env cat a.md | head -5 && ls; (cd x; cat y)'), [['cat', 'a.md'], ['head', '-5'], ['ls'], ['cd', 'x'], ['cat', 'y']]);
  assert.deepEqual(shellTokens('a "b \\" c" d\\ e').map((token) => token.word ?? token.op), ['a', 'b " c', 'd e']);
});

test('a path named only in an exclusion is never a positive argument', () => {
  assert.deepEqual(pathArguments(['rg', '--files', '--hidden', '-g', '!.git/**', '-g', '!.agents/skills/**', 'docs']), { positive: ['docs'], excluded: ['!.git/**', '!.agents/skills/**'] });
  assert.deepEqual(pathArguments(['rg', '-n', 'x', '--glob=!skills/**', '--iglob', 'docs/**', '--exclude', 'skills', '--type-not', 'md']), { positive: ['x', 'docs/**'], excluded: ['!skills/**', 'skills', 'md'] });
  assert.deepEqual(pathArguments(['git', 'ls-files', '.', ':!.agents/skills', ':(exclude)docs', ':^notes']), { positive: ['ls-files', '.'], excluded: [':!.agents/skills', ':(exclude)docs', ':^notes'] });
  assert.deepEqual(pathArguments(['find', '.', '-path', './.agents/skills', '-prune', '-o', '-name', '*.md', '-not', '-path', './docs/*', '-print']), { positive: ['.', '*.md'], excluded: ['./.agents/skills', './docs/*'] });
  assert.deepEqual(pathArguments(['cat', '-', 'a.md']), { positive: ['-', 'a.md'], excluded: [] });
});

test('a skill body is recognized in command output by its name line and first heading, line-number prefixes allowed', () => {
  const signature = SIGNATURES['write-for-agents'];
  assert.equal(outputShowsBody(body('write-for-agents'), signature), true);
  assert.equal(outputShowsBody(body('write-for-agents').split('\n').map((line, index) => `${index + 1}\t${line}`).join('\n'), signature), true, 'a numbered read');
  assert.equal(outputShowsBody(`prelude\n${body('write-for-humans')}${body('write-for-agents')}`, signature), true, 'several files in one output');
  assert.equal(outputShowsBody(body('write-for-humans'), signature), false, 'another skill\'s body');
  assert.equal(outputShowsBody('Use write-for-agents; its name: write-for-agents is in this sentence. # Write for agents', signature), false, 'mentions inside a line');
  assert.equal(outputShowsBody('.agents/skills/write-for-agents/SKILL.md:2:name: write-for-agents', signature), false, 'a search hit is not the body');
  assert.equal(outputShowsBody(null, signature), false);
  assert.equal(outputShowsBody(body('write-for-agents'), null), false, 'no signature, no body read');
  assert.equal(outputShowsBody('# Only heading\n', { name: null, heading: 'Only heading' }), true, 'a file without frontmatter is matched on its heading');
});

test('the baseline\'s exclusion listing is no read of any skill, in the Codex form and in the Claude form', () => {
  const codex = classify([codexCommand(RP_COMMAND, RP_OUTPUT)]);
  const claude = classify([claudeTool('Bash', { command: RP_SCRIPT }, RP_OUTPUT)]);
  for (const [shape, reads] of [['codex', codex], ['claude', claude]]) {
    for (const skill of SKILLS) {
      assert.deepEqual(flags(reads[skill]), { body: false, invoked: false, partial: false, listing: false }, `${shape}: ${skill} must not count as read, searched or listed`);
      assert.deepEqual(reads[skill].how, [], `${shape}: ${skill} has no reading evidence`);
      assert.equal(reads[skill].evidence.length, 1, `${shape}: the exclusion is recorded for the grader`);
      assert.equal(reads[skill].evidence[0].basis, 'exclusion-only');
      assert.equal(reads[skill].evidence[0].result, null);
      assert.deepEqual(reads[skill].evidence[0].excluded, ['!.git/**', '!.agents/skills/**', '!.codex/**']);
    }
  }
  const fromTrace = classifySkillReads(ENGINES.codex.events([
    JSON.stringify({ type: 'thread.started', thread_id: 'x' }),
    JSON.stringify({ type: 'item.started', item: { id: 'item_3', type: 'command_execution', command: RP_COMMAND, aggregated_output: '', status: 'in_progress' } }),
    JSON.stringify({ type: 'item.completed', item: { id: 'item_3', type: 'command_execution', command: RP_COMMAND, aggregated_output: RP_OUTPUT, exit_code: 0, status: 'completed' } }),
    JSON.stringify({ type: 'item.completed', item: { id: 'item_4', type: 'agent_message', text: 'Reader, purpose, constraints.' } }),
  ].join('\n')), SKILLS, { signatures: SIGNATURES });
  for (const skill of SKILLS) assert.equal(fromTrace[skill].body, false, `${skill} through the Codex adapter`);
  const fromClaude = classifySkillReads(ENGINES.claude.events([
    JSON.stringify({ type: 'system', subtype: 'init', model: 'claude-opus-5-5' }),
    JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', id: 't1', name: 'Bash', input: { command: RP_SCRIPT } }] } }),
    JSON.stringify({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 't1', content: RP_OUTPUT }] } }),
    JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: 'Reader, purpose, constraints.' }),
  ].join('\n')), SKILLS, { signatures: SIGNATURES });
  for (const skill of SKILLS) assert.equal(fromClaude[skill].body, false, `${skill} through the Claude adapter`);
});

test('a shell command whose output holds a SKILL.md body is a body read of that skill alone, with its positive paths as evidence', () => {
  const codex = classify([codexCommand(`/bin/zsh -lc "cat .agents/skills/write-for-agents/SKILL.md; rg --files --hidden .claude .agents -g 'AGENTS.md'"`, `${body('write-for-agents')}`)]);
  assert.deepEqual(flags(codex['write-for-agents']), { body: true, invoked: false, partial: false, listing: false });
  assert.equal(codex['write-for-agents'].evidence[0].basis, 'output-signature');
  assert.deepEqual(codex['write-for-agents'].evidence[0].paths, ['.agents/skills/write-for-agents/SKILL.md', '.claude', '.agents', 'AGENTS.md']);
  assert.match(codex['write-for-agents'].how[0], /body in output/);
  assert.equal(codex['write-for-humans'].body, false);
  assert.equal(codex['clarify-artifact'].body, false);

  const claude = classify([claudeTool('Bash', { command: 'cat .claude/skills/write-for-humans/SKILL.md' }, body('write-for-humans'))]);
  assert.deepEqual(flags(claude['write-for-humans']), { body: true, invoked: false, partial: false, listing: false });
  assert.equal(claude['write-for-agents'].body, false);

  const piped = classify([codexCommand('/bin/zsh -lc "rg --files .agents/skills | xargs cat"', SKILLS.map(body).join(''))]);
  for (const skill of SKILLS) assert.equal(piped[skill].body, true, `${skill} read through the pipe: the output shows it`);
  const wildcard = classify([claudeTool('Bash', { command: 'cat .claude/skills/*/SKILL.md' }, SKILLS.map(body).join(''))]);
  for (const skill of SKILLS) assert.equal(wildcard[skill].body, true, `${skill} read through the wildcard: the output shows it`);
  const python = classify([codexCommand('python3 - <<EOF\nprint(open(".agents/skills/clarify-artifact/SKILL.md").read())\nEOF', body('clarify-artifact'))]);
  assert.equal(python['clarify-artifact'].body, true, 'a scripted read whose output shows the body is a read');
  const partialRead = classify([codexCommand("/bin/zsh -lc \"sed -n '40,80p' .agents/skills/clarify-artifact/SKILL.md\"", 'Body of clarify-artifact, later lines only.\n')]);
  assert.deepEqual(flags(partialRead['clarify-artifact']), { body: false, invoked: false, partial: false, listing: true }, 'lines from the middle of the file show neither the name line nor the heading');
});

test('a reading command without recorded output, or a wildcard whose output shows no body, is not a body read', () => {
  const unanswered = classify([codexCommand('/bin/zsh -lc "cat .agents/skills/write-for-agents/SKILL.md"')]);
  assert.deepEqual(flags(unanswered['write-for-agents']), { body: false, invoked: false, partial: false, listing: true });
  assert.match(unanswered['write-for-agents'].how[0], /names SKILL\.md, no output recorded/);
  const emptyWildcard = classify([claudeTool('Bash', { command: 'cat .claude/skills/*/SKILL.md' }, 'cat: .claude/skills/*/SKILL.md: No such file or directory\n')]);
  for (const skill of SKILLS) assert.equal(emptyWildcard[skill].body, false, `${skill}: nothing came back`);
  const excludedSearch = classify([claudeTool('Bash', { command: "rg -n reader -g '!.claude/skills/**' ." }, 'docs/a.md:3:reader\n')]);
  for (const skill of SKILLS) assert.deepEqual(flags(excludedSearch[skill]), { body: false, invoked: false, partial: false, listing: false }, `${skill}: excluded from the search`);
  const pathspec = classify([codexCommand("/bin/zsh -lc \"git ls-files ':!.agents/skills'\"", 'README.md\n')]);
  for (const skill of SKILLS) assert.deepEqual(flags(pathspec[skill]), { body: false, invoked: false, partial: false, listing: false }, `${skill}: excluded by pathspec`);
});

test('a body read or Skill invocation is distinguished from a listing or a search, in the Claude shape', () => {
  const events = [
    claudeTool('Bash', { command: 'ls -la .claude/skills/clarify-artifact' }, 'SKILL.md\n'),
    claudeTool('Bash', { command: 'ls /w/.claude/skills/write-for-humans/SKILL.md' }, '/w/.claude/skills/write-for-humans/SKILL.md\n'),
    claudeTool('Grep', { pattern: 'reader', path: '/w/.claude/skills/write-for-agents' }, '/w/.claude/skills/write-for-agents/SKILL.md:9:the reader\n'),
    claudeTool('Read', { file_path: '/w/.claude/skills/write-for-humans/SKILL.md' }, body('write-for-humans').split('\n').map((line, index) => `${index + 1}\t${line}`).join('\n')),
    claudeTool('Skill', { skill: 'write-for-agents' }, 'Launching skill: write-for-agents'),
  ];
  const reads = classify(events);
  assert.deepEqual(flags(reads['clarify-artifact']), { body: false, invoked: false, partial: false, listing: true });
  assert.equal(reads['clarify-artifact'].how.length, 1);
  assert.deepEqual(flags(reads['write-for-humans']), { body: true, invoked: false, partial: false, listing: true });
  assert.equal(reads['write-for-humans'].evidence.find((entry) => entry.result === 'body').basis, 'read-path');
  assert.deepEqual(flags(reads['write-for-agents']), { body: false, invoked: true, partial: true, listing: false });
});

test('shell reads, searches and listings are classified in the Codex shape, from what each command returned', () => {
  const events = [
    codexCommand('/bin/zsh -lc "ls .agents/skills"', 'clarify-artifact\nwrite-for-agents\nwrite-for-humans\n'),
    codexCommand('/bin/zsh -lc "ls .agents/skills/clarify-artifact"', 'SKILL.md\n'),
    codexCommand('/bin/zsh -lc "sed -n \'1,80p\' .agents/skills/write-for-humans/SKILL.md"', body('write-for-humans')),
    codexCommand('/bin/zsh -lc "rg -n purpose .agents/skills"', '.agents/skills/clarify-artifact/SKILL.md:7:purpose\n'),
  ];
  const reads = classify(events);
  assert.deepEqual(flags(reads['clarify-artifact']), { body: false, invoked: false, partial: true, listing: true }, 'listed, then a search hit showed a line of it');
  assert.deepEqual(flags(reads['write-for-humans']), { body: true, invoked: false, partial: false, listing: true });
  assert.deepEqual(flags(reads['write-for-agents']), { body: false, invoked: false, partial: false, listing: true }, 'listed by name only; the search hit nothing of it');
  const blindSearch = classify([codexCommand('/bin/zsh -lc "rg -n purpose .agents/skills"')]);
  for (const skill of SKILLS) assert.equal(blindSearch[skill].partial, true, `${skill}: a search over the skills directory with no output recorded may have shown lines of every skill`);
});

test('the engine adapters carry each tool call\'s output and feed the same classification from their raw traces', () => {
  const claudeTrace = [
    JSON.stringify({ type: 'system', subtype: 'init', model: 'claude-opus-5-5' }),
    JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', id: 't1', name: 'Bash', input: { command: 'ls .claude/skills/clarify-artifact' } }] } }),
    JSON.stringify({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 't1', content: [{ type: 'text', text: 'SKILL.md' }] }] } }),
    JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', id: 't2', name: 'Skill', input: { skill: 'clarify-artifact' } }] } }),
    JSON.stringify({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 't2', content: 'Launching skill: clarify-artifact' }] } }),
    JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', id: 't3', name: 'Bash', input: { command: 'cat .claude/skills/write-for-humans/SKILL.md' } }] } }),
    JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: 'Which reader?' }),
  ].join('\n');
  const claudeEvents = ENGINES.claude.events(claudeTrace);
  assert.deepEqual(claudeEvents.filter((event) => event.kind === 'tool').map((event) => event.output), ['SKILL.md', 'Launching skill: clarify-artifact', null], 'text blocks joined; an unanswered call has no output');
  const fromClaude = classifySkillReads(claudeEvents, SKILLS, { signatures: SIGNATURES });
  assert.deepEqual(flags(fromClaude['clarify-artifact']), { body: false, invoked: true, partial: false, listing: true });
  assert.deepEqual(flags(fromClaude['write-for-humans']), { body: false, invoked: false, partial: false, listing: true }, 'no output came back for the cat');

  const codexTrace = [
    JSON.stringify({ type: 'thread.started', thread_id: 'x' }),
    JSON.stringify({ type: 'item.started', item: { id: 'i1', type: 'command_execution', command: 'cat .agents/skills/clarify-artifact/SKILL.md', aggregated_output: '', status: 'in_progress' } }),
    JSON.stringify({ type: 'item.completed', item: { id: 'i1', type: 'command_execution', command: 'cat .agents/skills/clarify-artifact/SKILL.md', aggregated_output: body('clarify-artifact'), exit_code: 0, status: 'completed' } }),
    JSON.stringify({ type: 'item.completed', item: { id: 'i2', type: 'agent_message', text: 'Which reader?' } }),
  ].join('\n');
  const codexEvents = ENGINES.codex.events(codexTrace);
  assert.equal(codexEvents.find((event) => event.kind === 'command').output, body('clarify-artifact'));
  const fromCodex = classifySkillReads(codexEvents, SKILLS, { signatures: SIGNATURES });
  assert.equal(fromCodex['clarify-artifact'].body, true);
  assert.equal(fromCodex['write-for-humans'].body, false);
});

test('skill signatures come from the materialized source: frontmatter name and first heading', () => {
  const root = fs.mkdtempSync(path.join(scratch, 'src-'));
  fs.mkdirSync(path.join(root, 'skills', 'alpha'), { recursive: true });
  fs.writeFileSync(path.join(root, 'skills', 'alpha', 'SKILL.md'), '---\nname: alpha\ndescription: a\n---\n\nIntro line.\n\n## Alpha heading\n');
  fs.mkdirSync(path.join(root, 'skills', 'bare'), { recursive: true });
  fs.writeFileSync(path.join(root, 'skills', 'bare', 'SKILL.md'), 'No frontmatter and no heading.\n');
  assert.deepEqual(skillSignatures(root, ['alpha', 'bare', 'missing']), { alpha: { name: 'alpha', heading: 'Alpha heading' }, bare: { name: null, heading: null }, missing: null });
  assert.equal(outputShowsBody('anything', { name: null, heading: null }), false, 'a file with neither part cannot be recognized in output');
});

function workspaceWith(files) {
  const dir = fs.mkdtempSync(path.join(scratch, 'ws-'));
  for (const [relative, content] of Object.entries(files)) {
    const target = path.join(dir, ...relative.split('/'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  return dir;
}

test('file changes are created, modified and deleted files against the fixture, ignoring engine and Git directories', () => {
  const workspace = workspaceWith({ 'README.md': 'a\n', 'docs/keep.md': 'keep\n', 'docs/gone.md': 'gone\n' });
  const fixture = manifestOf(workspace);
  fs.writeFileSync(path.join(workspace, 'README.md'), 'changed\n');
  fs.rmSync(path.join(workspace, 'docs', 'gone.md'));
  fs.mkdirSync(path.join(workspace, 'notes'));
  fs.writeFileSync(path.join(workspace, 'notes', 'new.md'), 'new\n');
  for (const hidden of ['.git', '.claude', '.agents']) {
    fs.mkdirSync(path.join(workspace, hidden), { recursive: true });
    fs.writeFileSync(path.join(workspace, hidden, 'state'), 'x');
  }
  assert.deepEqual(fileChanges(workspace, fixture), { created: ['notes/new.md'], modified: ['README.md'], deleted: ['docs/gone.md'] });
});

const exitOk = { status: 0, signal: null, timedOut: false, seconds: 1 };
const effective = { model: 'claude-opus-5-5', modelAttestedBy: 'init event', effort: null, effortAttestedBy: null };

function caseWith(deterministic) {
  return { id: 'c', deterministic: { exit: 0, skillReads: {}, premise: [], writes: {}, ...deterministic }, semantic: [] };
}

test('the verdict separates a failed premise from a failed criterion, and a listing or search never breaks a forbidden read', () => {
  const workspace = workspaceWith({ 'README.md': 'a\n' });
  const fixture = manifestOf(workspace);
  const inspect = (deterministic, events, exit = exitOk) => inspectAttempt({ caseDef: caseWith(deterministic), skills: SKILLS, events, finalReply: 'Which reader?', workspace, fixtureManifest: fixture, exit, effective, signatures: SIGNATURES });

  const bodyRead = claudeTool('Read', { file_path: '/w/.claude/skills/write-for-humans/SKILL.md' }, body('write-for-humans'));
  const listed = claudeTool('Bash', { command: 'ls .claude/skills/clarify-artifact' }, 'SKILL.md\n');
  const searched = claudeTool('Grep', { pattern: 'purpose', path: '/w/.claude/skills/clarify-artifact' }, '/w/.claude/skills/clarify-artifact/SKILL.md:5:purpose\n');
  const rules = { skillReads: { 'write-for-humans': 'required', 'clarify-artifact': 'forbidden' }, premise: ['skillReads.write-for-humans'], writes: { allowed: [] } };

  const pass = inspect(rules, [bodyRead, listed, searched]);
  assert.equal(pass.verdict, 'pass');
  assert.equal(pass.checks.find((check) => check.id === 'skillReads.clarify-artifact').detail, 'clarify-artifact: searched, listed');
  assert.equal(pass.classifier.version, 9, 'every inspection names the classifier that produced it');
  assert.deepEqual(pass.classifier.signatures, SIGNATURES);
  assert.deepEqual(pass.finalReply, { chars: 13, questionMarks: 1 });

  const fail = inspect(rules, [bodyRead, claudeTool('Read', { file_path: '/w/.claude/skills/clarify-artifact/SKILL.md' })]);
  assert.equal(fail.verdict, 'fail');
  assert.equal(fail.checks.find((check) => check.id === 'skillReads.clarify-artifact').pass, false);

  const invoked = inspect(rules, [bodyRead, claudeTool('Skill', { skill: 'clarify-artifact' })]);
  assert.equal(invoked.verdict, 'fail', 'a Skill invocation is a read');

  const premise = inspect(rules, [claudeTool('Bash', { command: 'ls .claude/skills/write-for-humans' }, 'SKILL.md\n')]);
  assert.equal(premise.verdict, 'premise-not-met', 'the required skill was only listed');
  assert.equal(premise.checks.find((check) => check.id === 'skillReads.write-for-humans').kind, 'premise');

  const both = inspect(rules, [claudeTool('Skill', { skill: 'clarify-artifact' })]);
  assert.equal(both.verdict, 'premise-not-met', 'a failed premise outranks a failed criterion');

  assert.equal(inspect(rules, [bodyRead], { ...exitOk, status: 1 }).verdict, 'fail');
  assert.equal(inspect(rules, [bodyRead], { ...exitOk, status: null, signal: 'SIGTERM', timedOut: true }).verdict, 'fail');
});

test('write expectations are checked against the fixture copy', () => {
  const workspace = workspaceWith({ 'README.md': 'a\n', 'docs/out.md': 'old\n' });
  const fixture = manifestOf(workspace);
  const inspect = (deterministic) => inspectAttempt({ caseDef: caseWith(deterministic), skills: SKILLS, events: [], finalReply: 'Done.', workspace, fixtureManifest: fixture, exit: exitOk, effective });

  assert.equal(inspect({ writes: { allowed: ['docs/out.md'], required: ['docs/out.md'] } }).verdict, 'fail', 'required file not written yet');
  fs.writeFileSync(path.join(workspace, 'docs', 'out.md'), 'new\n');
  assert.equal(inspect({ writes: { allowed: ['docs/out.md'], required: ['docs/out.md'] } }).verdict, 'pass');
  assert.equal(inspect({ writes: { allowed: [] } }).verdict, 'fail', 'nothing may change');
  assert.equal(inspect({ writes: {} }).verdict, 'pass', 'no write rule, no check');
  fs.writeFileSync(path.join(workspace, 'stray.md'), 'x\n');
  const stray = inspect({ writes: { allowed: ['docs/out.md'] } });
  assert.equal(stray.verdict, 'fail');
  assert.match(stray.checks.find((check) => check.id === 'writes.allowed').detail, /outside the allowed set: stray\.md/);
});
