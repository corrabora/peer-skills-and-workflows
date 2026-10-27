// A fake engine for the harness tests. The runner launches it in place of
// `claude` or `codex` through the executable seam; it reads the prompt from
// stdin like both engines, finds a `FAKE-ENGINE: {...}` directive in it, and
// emits the corresponding trace in that engine's event shape, writing files
// into the workspace where the directive says. Every tool call carries the
// output a real run would record (Claude: a `tool_result` block answering the
// call; Codex: the item's `aggregated_output`), read from the workspace, so
// the classifier sees what the engine saw. No network, no model.
//
// Directive fields (all optional): exit, reply (null for no reply),
// readSkills, shellReadSkills, readFiles, listSkills, searchSkills, invokeSkills,
// wildcardRead, excludedListing (an `rg --files` listing that excludes the
// skills directory, then `cat README.md`: the shape that fooled the first
// classifier), writes [{ path, text }], deletes [path], stderr, sleepMs,
// model (reported model, to simulate substitution), outputStyle (the style
// the Claude init event reports instead of the one `--settings` asked for),
// initOutputStyle: false (an init event without the field, as an engine that
// does not report it), crash (exit before any reply). The environment
// variable FAKE_ENGINE_OVERRIDE, when set to a JSON object, is merged over
// the prompt's directive; the harness tests use it to make a retry of the
// same prompt behave differently from the original attempt.

import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const engine = argv[0] === 'exec' ? 'codex' : 'claude';
const option = (flag) => { const index = argv.indexOf(flag); return index >= 0 ? argv[index + 1] : undefined; };
const requestedModel = engine === 'claude' ? option('--model') : option('-m');
const requestedEffort = engine === 'claude' ? option('--effort') : (argv.find((arg) => arg.startsWith('model_reasoning_effort=')) ?? '').split('=')[1]?.replace(/"/g, '');
// The output style Claude Code would resolve from `--settings`: the JSON's
// outputStyle when given, else the default; reported in the init event as
// the real engine's `output_style` is. Codex reports no setting back.
const requestedOutputStyle = (() => {
  if (engine !== 'claude' || option('--settings') === undefined) return 'default';
  try { const parsed = JSON.parse(option('--settings')); return typeof parsed.outputStyle === 'string' ? parsed.outputStyle : 'default'; } catch { return 'default'; }
})();
const cwd = engine === 'codex' ? option('-C') ?? process.cwd() : process.cwd();
const outputFile = engine === 'codex' ? option('-o') : undefined;

const prompt = fs.readFileSync(0, 'utf8');
const line = prompt.split('\n').find((candidate) => candidate.startsWith('FAKE-ENGINE:'));
const directive = { ...(line ? JSON.parse(line.slice('FAKE-ENGINE:'.length)) : {}), ...(process.env.FAKE_ENGINE_OVERRIDE ? JSON.parse(process.env.FAKE_ENGINE_OVERRIDE) : {}) };
if (directive.sleepMs) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, directive.sleepMs);
if (directive.stderr) process.stderr.write(`${directive.stderr}\n`);

const emit = (event) => process.stdout.write(`${JSON.stringify(event)}\n`);
const scope = engine === 'claude' ? '.claude' : '.agents';
const skillPath = (name) => path.join(cwd, scope, 'skills', name, 'SKILL.md');
const readFile = (file) => { try { return fs.readFileSync(file, 'utf8'); } catch { return ''; } };
const numbered = (text) => text.split('\n').map((text_, index) => `${index + 1}\t${text_}`).join('\n');
const skillNames = () => { try { return fs.readdirSync(path.join(cwd, scope, 'skills')).sort(); } catch { return []; } };
const workspaceFiles = () => {
  const files = [];
  const visit = (dir, rel) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!rel && ['.git', '.claude', '.agents', '.codex'].includes(entry.name)) continue;
      const relative = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) visit(path.join(dir, entry.name), relative); else files.push(relative);
    }
  };
  visit(cwd, '');
  return files.sort();
};

let itemId = 0;
const claudeTool = (name, input, output) => {
  itemId += 1;
  const id = `toolu_${itemId}`;
  emit({ type: 'assistant', message: { model: directive.model ?? requestedModel, role: 'assistant', content: [{ type: 'tool_use', id, name, input }] } });
  emit({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: output }] } });
};
const codexCommand = (command, output) => {
  itemId += 1;
  emit({ type: 'item.started', item: { id: `item_${itemId}`, type: 'command_execution', command, aggregated_output: '', status: 'in_progress' } });
  emit({ type: 'item.completed', item: { id: `item_${itemId}`, type: 'command_execution', command, aggregated_output: output, exit_code: 0, status: 'completed' } });
};
const shell = (claudeCommand, codexScript, output) => {
  if (engine === 'claude') claudeTool('Bash', { command: claudeCommand }, output);
  else codexCommand(`/bin/zsh -lc ${JSON.stringify(codexScript)}`, output);
};

if (engine === 'claude') emit({ type: 'system', subtype: 'init', cwd, model: directive.model ?? requestedModel, permissionMode: 'acceptEdits', effort: requestedEffort, ...(directive.initOutputStyle === false ? {} : { output_style: directive.outputStyle ?? requestedOutputStyle }) });
else emit({ type: 'thread.started', thread_id: 'fake-thread' });

for (const name of directive.listSkills ?? []) {
  const listing = `SKILL.md\n`;
  if (engine === 'claude') claudeTool('Bash', { command: `ls ${path.join(cwd, '.claude', 'skills', name)}` }, listing);
  else codexCommand(`/bin/zsh -lc "ls .agents/skills/${name}"`, listing);
}
for (const name of directive.searchSkills ?? []) {
  const hits = readFile(skillPath(name)).split('\n').map((text, index) => ({ text, index })).filter(({ text }) => /load/.test(text)).map(({ text, index }) => `${scope}/skills/${name}/SKILL.md:${index + 1}:${text}`).join('\n');
  if (engine === 'claude') claudeTool('Grep', { pattern: 'load', path: path.join(cwd, '.claude', 'skills', name) }, hits);
  else codexCommand(`/bin/zsh -lc "rg -n load .agents/skills/${name}/SKILL.md"`, hits);
}
for (const name of directive.readSkills ?? []) {
  if (engine === 'claude') claudeTool('Read', { file_path: skillPath(name) }, numbered(readFile(skillPath(name))));
  else codexCommand(`/bin/zsh -lc "cat '${skillPath(name)}'"`, readFile(skillPath(name)));
}
// A read of any file: a workspace-relative or absolute path, kept as written
// so that a path through a skill link (`.claude/skills/<name>/../../docs/x.md`)
// resolves as the operating system resolves it. `{ path, limit }` returns
// only the first `limit` characters, as a truncated read would. Claude's
// Read tool answers with numbered lines, Codex with the command's output.
for (const entry of directive.readFiles ?? []) {
  const spec = typeof entry === 'string' ? { path: entry } : entry;
  const file = path.isAbsolute(spec.path) ? spec.path : `${cwd}/${spec.path}`;
  const exists = fs.existsSync(file);
  const text = exists ? readFile(file) : '';
  const shown = spec.limit === undefined ? text : text.slice(0, spec.limit);
  if (engine === 'claude') claudeTool('Read', { file_path: file }, exists ? numbered(shown) : `File does not exist: ${file}`);
  else codexCommand(`/bin/zsh -lc "${spec.limit === undefined ? 'cat' : `head -c ${spec.limit}`} '${file}'"`, exists ? shown : `cat: ${file}: No such file or directory`);
}
for (const name of directive.shellReadSkills ?? []) {
  shell(`cat ${scope}/skills/${name}/SKILL.md`, `cat ${scope}/skills/${name}/SKILL.md`, readFile(skillPath(name)));
}
if (directive.wildcardRead) {
  const bodies = skillNames().map((name) => readFile(skillPath(name))).join('');
  shell(`cat ${scope}/skills/*/SKILL.md`, `cat ${scope}/skills/*/SKILL.md`, bodies);
}
if (directive.excludedListing) {
  // The command shape from the clarify-artifact baseline, cell index-settles/codex/001: a listing that excludes the skills directory, then the README.
  const listing = `${workspaceFiles().join('\n')}\n${readFile(path.join(cwd, 'README.md'))}`;
  const script = `ls -la; rg --files --hidden -g '!.git/**' -g '!${scope}/skills/**' -g '!.codex/**'; cat README.md`;
  shell(script, script, `total 8\n${listing}`);
}
for (const name of directive.invokeSkills ?? []) {
  if (engine === 'claude') claudeTool('Skill', { skill: name }, `Launching skill: ${name}`);
  else codexCommand(`/bin/zsh -lc "cat .agents/skills/${name}/SKILL.md"`, readFile(skillPath(name)));
}
for (const write of directive.writes ?? []) {
  const target = path.join(cwd, ...write.path.split('/'));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, write.text ?? '');
  if (engine === 'claude') claudeTool('Write', { file_path: target, content: write.text ?? '' }, `File written: ${target}`);
  else { itemId += 1; emit({ type: 'item.completed', item: { id: `item_${itemId}`, type: 'file_change', changes: [{ path: target, kind: 'add' }], status: 'completed' } }); }
}
for (const relative of directive.deletes ?? []) fs.rmSync(path.join(cwd, ...relative.split('/')), { force: true });

if (directive.crash) process.exit(directive.exit ?? 1);

const reply = directive.reply === undefined ? 'Done.' : directive.reply;
if (reply !== null) {
  if (engine === 'claude') emit({ type: 'result', subtype: 'success', is_error: false, num_turns: itemId + 1, result: reply });
  else {
    itemId += 1;
    emit({ type: 'item.completed', item: { id: `item_${itemId}`, type: 'agent_message', text: reply } });
    if (outputFile) fs.writeFileSync(outputFile, reply);
  }
}
if (engine === 'codex') emit({ type: 'turn.completed', usage: { input_tokens: 1, output_tokens: 1 } });
process.exit(directive.exit ?? 0);
