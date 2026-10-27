// Engine adapters: how each engine is launched with a pinned model, effort
// and verbosity under the permission profile the retained trials used, and
// how its trace is read back. Model, effort and verbosity are passed through
// exactly as given; an effort or verbosity the engine does not document, or a
// model alias that would resolve to "latest", is refused here rather than
// substituted. Verbosity omitted is the engine's own default: no argument is
// passed, exactly as every run before the dimension existed.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// A full model identifier: lower-case name with at least one digit, so that
// aliases such as `opus` or `fable`, which drift to the latest model, are
// refused and every attempt records the exact model it asked for.
const MODEL_ID = /^[a-z0-9][a-z0-9.-]*[a-z0-9]$/;

/**
 * The package's documented Codex session instruction, relative to the source
 * tree under test. The suite applies it per invocation so that Codex is
 * measured in the environment the package documents.
 */
export const CODEX_SESSION_INSTRUCTION_FILE = 'docs/guidance/codex-session-instructions.txt';
const CODEX_SESSION_INSTRUCTION_KEY = 'developer_instructions';

/** The verbosity recorded for a run that passes none: the engine's own default. */
export const ENGINE_DEFAULT_VERBOSITY = 'engine-default';

const sha256Hex = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');
const strictUtf8 = new TextDecoder('utf-8', { fatal: true });

/**
 * Resolve the documented Codex session instruction under `sourceRoot`, the
 * same root the skill links point into. Returns the applied-environment
 * record: the canonical path, whether the file is present, the SHA-256 of
 * its raw bytes and of the effective text (exterior whitespace trimmed, UTF-8),
 * the effective text, and the exact argv entries Codex receives: `-c` and
 * `developer_instructions=` followed by the JSON encoding of the effective
 * text. An absent file (ENOENT) yields no entries and the reason `absent`,
 * so that an older source tree runs in its own environment. Any other read
 * failure, invalid UTF-8, or a present file that is empty after trimming
 * throws, naming the path and the reason; nothing is launched.
 *
 * `read(file, relative)` is the seam for reading the bytes before the tree
 * is materialized (a Git blob, or the directory a run will copy); it must
 * throw an error whose `code` is `ENOENT` for an absent file. `resolvedFrom`
 * is recorded as given.
 */
export function codexSessionInstruction(sourceRoot, { read = (file) => fs.readFileSync(file), resolvedFrom = 'materialized source' } = {}) {
  const file = path.join(sourceRoot, ...CODEX_SESSION_INSTRUCTION_FILE.split('/'));
  let raw;
  try {
    raw = read(file, CODEX_SESSION_INSTRUCTION_FILE);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return { file, resolvedFrom, present: false, rawSha256: null, effectiveSha256: null, effectiveText: null, applied: false, reason: 'absent', argv: [] };
    }
    throw new Error(`cannot read the Codex session instruction at ${file}: ${error?.code ? `${error.code}: ` : ''}${error?.message ?? error}`);
  }
  let decoded;
  try {
    decoded = strictUtf8.decode(raw);
  } catch {
    throw new Error(`the Codex session instruction at ${file} is not valid UTF-8`);
  }
  const effectiveText = decoded.trim();
  if (!effectiveText) throw new Error(`the Codex session instruction at ${file} is present but empty; remove the file to run without one, or give it the documented text`);
  return {
    file,
    resolvedFrom,
    present: true,
    rawSha256: sha256Hex(raw),
    effectiveSha256: sha256Hex(Buffer.from(effectiveText, 'utf8')),
    effectiveText,
    applied: true,
    reason: null,
    argv: ['-c', `${CODEX_SESSION_INSTRUCTION_KEY}=${JSON.stringify(effectiveText)}`],
  };
}

/**
 * The session-instruction record for one engine: Codex applies the documented
 * instruction when the source tree carries it; Claude receives no such
 * argument, and the record says so while still naming what the tree holds.
 */
export function sessionInstructionFor(engineName, sourceRoot, options = {}) {
  engineFor(engineName);
  const record = codexSessionInstruction(sourceRoot, options);
  if (engineName === 'codex') return record;
  return { ...record, applied: false, reason: 'claude receives no session instruction', argv: [] };
}

function parseLines(traceText) {
  const events = [];
  for (const line of traceText.split('\n')) {
    if (!line.trim()) continue;
    try {
      events.push(JSON.parse(line));
    } catch {
      events.push({ unparsed: line });
    }
  }
  return events;
}

/** The text of a tool_result's content: a string, or the text blocks of an array joined. */
function toolResultText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.filter((block) => block?.type === 'text' && typeof block.text === 'string').map((block) => block.text).join('\n');
  return '';
}

const claude = {
  name: 'claude',
  efforts: ['low', 'medium', 'high', 'xhigh', 'max'],
  effortsSource: '`claude --help`, option --effort <level>',
  // Verbosity is Claude Code's output style: the `outputStyle` settings key,
  // a case-sensitive style name. The documented built-in styles are listed;
  // a custom style is named the same way, so any non-empty name is accepted.
  // `Default` is the unset state in the documentation ("no output style is
  // selected"), and a name that matches no style falls back to it silently,
  // which is why the init event's attestation is recorded.
  verbosities: ['Default', 'Concise', 'Explanatory', 'Learning', 'Proactive'],
  verbositiesSource: 'Claude Code settings key outputStyle, a case-sensitive built-in or custom output style name',
  acceptsCustomVerbosity: true,
  /**
   * `--settings` takes a JSON string whose keys override the same keys of the
   * loaded settings files for the session; keys it omits keep their file
   * values, so the attempt's project and local settings stay in force and
   * only the output style is set.
   */
  verbosityArgv(name) {
    return ['--settings', JSON.stringify({ outputStyle: name })];
  },
  verbosityMechanism: '--settings {"outputStyle":"<name>"}, beside --setting-sources project,local',
  /**
   * `claude -p` with the retained flag set: streamed JSON trace on stdout, no
   * session persistence, project and local settings only, acceptEdits with no
   * prompt surface, an explicit tool allowlist, no delegation or nested
   * engines, no MCP servers, and read access to the materialized source tree
   * so that the workspace's skill links can be followed. A requested
   * verbosity adds `--settings` with the output style directly after the
   * setting sources; nothing else moves.
   */
  command({ model, effort, workspace, sourceRoot, verbosity }) {
    return {
      argv: [
        'claude', '-p',
        '--model', model,
        '--effort', effort,
        '--output-format', 'stream-json', '--verbose',
        '--no-session-persistence',
        '--setting-sources', 'project,local',
        ...(verbosity?.argv ?? []),
        '--permission-mode', 'acceptEdits',
        '--permission-prompts', 'none',
        '--add-dir', sourceRoot,
        '--allowedTools', 'Read', 'Glob', 'Grep', 'Skill', 'Edit', 'Write',
        'Bash(cat:*)', 'Bash(ls:*)', 'Bash(pwd:*)', 'Bash(readlink:*)', 'Bash(realpath:*)', 'Bash(sed:*)', 'Bash(mkdir:*)', 'Bash(node:*)',
        'Bash(git status:*)', 'Bash(git show:*)', 'Bash(git diff:*)', 'Bash(git rev-parse:*)', 'Bash(git ls-tree:*)',
        '--disallowedTools', 'Agent', 'Bash(codex:*)', 'Bash(claude:*)',
        '--strict-mcp-config',
      ],
      cwd: workspace,
    };
  },
  /**
   * Normalized events. A tool call carries the text the tool returned
   * (`output`), taken from the `tool_result` block that answers its id, or
   * null when the trace holds no answer.
   */
  events(traceText) {
    const events = [];
    const pending = new Map();
    for (const raw of parseLines(traceText)) {
      if (raw.type === 'system' && raw.subtype === 'init') events.push({ kind: 'init', model: raw.model ?? null, effort: typeof raw.effort === 'string' ? raw.effort : null, outputStyle: typeof raw.output_style === 'string' ? raw.output_style : null, permissionMode: raw.permissionMode ?? null });
      else if (raw.type === 'system' && raw.subtype === 'permission_denied') events.push({ kind: 'denial', tool: raw.tool_name ?? null });
      else if (raw.type === 'assistant') {
        for (const block of raw.message?.content ?? []) {
          if (block.type === 'tool_use') {
            const event = { kind: 'tool', tool: block.name, input: block.input ?? {}, output: null };
            events.push(event);
            if (block.id) pending.set(block.id, event);
          } else if (block.type === 'text' && block.text) events.push({ kind: 'message', text: block.text });
        }
      } else if (raw.type === 'user') {
        const content = raw.message?.content;
        for (const block of Array.isArray(content) ? content : []) {
          if (block.type !== 'tool_result' || !pending.has(block.tool_use_id)) continue;
          pending.get(block.tool_use_id).output = toolResultText(block.content);
          pending.delete(block.tool_use_id);
        }
      } else if (raw.type === 'result') events.push({ kind: 'result', text: typeof raw.result === 'string' ? raw.result : null, isError: raw.is_error === true, subtype: raw.subtype ?? null });
    }
    return events;
  },
  /** The final reply: the text of the last result event, or null when there was none. */
  finalReply(attemptDir, events) {
    const results = events.filter((event) => event.kind === 'result');
    const last = results.at(-1);
    if (!last || last.isError || last.text === null) return null;
    return last.text;
  },
  effectiveSettings(events) {
    // The init event names the model; it names the effort only in some
    // versions, so effort stays unattested when the event lacks it. The
    // output style (`output_style`) is a documented field of the init event,
    // recorded as given when present and unattested when absent; the engine
    // reports the style it resolved, so a name that matched no style shows
    // up here as the default.
    const init = events.find((event) => event.kind === 'init');
    return {
      model: init?.model ?? null,
      modelAttestedBy: init?.model ? 'init event' : null,
      effort: init?.effort ?? null,
      effortAttestedBy: init?.effort ? 'init event' : null,
      verbosity: init?.outputStyle ?? null,
      verbosityAttestedBy: init?.outputStyle ? 'init event' : null,
    };
  },
};

const codex = {
  name: 'codex',
  efforts: ['minimal', 'low', 'medium', 'high', 'xhigh'],
  effortsSource: 'Codex configuration key model_reasoning_effort',
  // Verbosity is the `model_verbosity` configuration key (`low | medium |
  // high`, "Optional GPT-5 Responses API verbosity override; when unset, the
  // selected model/preset default is used"), passed per invocation like the
  // effort key. Codex reports no setting back in its event stream.
  verbosities: ['low', 'medium', 'high'],
  verbositiesSource: 'Codex configuration key model_verbosity',
  acceptsCustomVerbosity: false,
  verbosityArgv(level) {
    return ['-c', `model_verbosity="${level}"`];
  },
  verbosityMechanism: '-c model_verbosity="<level>", beside the effort override',
  /**
   * `codex exec` with the retained flag set: the model and reasoning effort
   * as configuration overrides, the user's configuration ignored, no session
   * persistence, the workspace-write sandbox, JSON events on stdout and the
   * final message written to a file in the attempt. When the source tree
   * under test documents a Codex session instruction, its `-c
   * developer_instructions=...` override follows `exec`, before the model,
   * as the retained diagnostic placed it. A requested verbosity adds its
   * `-c model_verbosity=...` override directly after the effort override.
   */
  command({ model, effort, workspace, attemptDir, sessionInstruction, verbosity }) {
    return {
      argv: [
        'codex', 'exec',
        ...(sessionInstruction?.argv ?? []),
        '-m', model,
        '-c', `model_reasoning_effort="${effort}"`,
        ...(verbosity?.argv ?? []),
        '--ignore-user-config', '--skip-git-repo-check', '--ephemeral',
        '--sandbox', 'workspace-write',
        '--json',
        '-C', workspace,
        '-o', path.join(attemptDir, 'final.txt'),
        '-',
      ],
      cwd: workspace,
    };
  },
  /**
   * Normalized events. A command carries the output Codex aggregated for it
   * (`output`), or null when the item never completed.
   */
  events(traceText) {
    const events = [];
    const seen = new Set();
    const items = [];
    for (const raw of parseLines(traceText)) {
      if (raw.type === 'thread.started') events.push({ kind: 'init', model: null, threadId: raw.thread_id ?? null });
      else if (raw.type === 'error') events.push({ kind: 'error', message: raw.message ?? JSON.stringify(raw) });
      else if (raw.type === 'turn.failed') events.push({ kind: 'error', message: raw.error?.message ?? 'turn failed' });
      else if ((raw.type === 'item.started' || raw.type === 'item.completed') && raw.item) {
        const id = raw.item.id ?? `${items.length}`;
        if (raw.type === 'item.completed' || !seen.has(id)) {
          const index = seen.has(id) ? items.findIndex((item) => item.id === id) : -1;
          const item = { id, ...raw.item };
          if (index >= 0) items[index] = item; else items.push(item);
          seen.add(id);
        }
      } else if (raw.type === 'turn.completed') events.push({ kind: 'turn', usage: raw.usage ?? null });
    }
    for (const item of items) {
      if (item.type === 'command_execution') events.push({ kind: 'command', text: item.command ?? '', exitCode: item.exit_code ?? null, output: typeof item.aggregated_output === 'string' ? item.aggregated_output : null });
      else if (item.type === 'file_change') events.push({ kind: 'file_change', paths: (item.changes ?? []).map((change) => change.path) });
      else if (item.type === 'agent_message') events.push({ kind: 'message', text: item.text ?? '' });
    }
    return events;
  },
  /** The final reply: the `-o` file when the engine wrote it, else the last agent message, else null. */
  finalReply(attemptDir, events) {
    const file = path.join(attemptDir, 'final.txt');
    if (fs.existsSync(file)) {
      const text = fs.readFileSync(file, 'utf8');
      if (text.trim()) return text;
    }
    const last = events.filter((event) => event.kind === 'message').at(-1);
    return last?.text?.trim() ? last.text : null;
  },
  effectiveSettings() {
    // Codex's event stream does not attest the model, effort or verbosity it
    // ran with; the launch arguments are the only record.
    return { model: null, modelAttestedBy: null, effort: null, effortAttestedBy: null, verbosity: null, verbosityAttestedBy: null };
  },
};

export const ENGINES = { claude, codex };

export function engineFor(name) {
  if (!Object.hasOwn(ENGINES, name)) throw new Error(`unknown engine '${name}'; the engines are ${Object.keys(ENGINES).join(', ')}`);
  return ENGINES[name];
}

/**
 * Throws unless `engine` documents `effort`, `model` is a full identifier
 * and `verbosity` is either omitted (null: the engine's default) or a value
 * the engine accepts: for Codex one of its documented levels, for Claude any
 * non-empty style name, since custom output styles are named freely.
 */
export function validateSettings(engineName, model, effort, verbosity = null) {
  const engine = engineFor(engineName);
  if (typeof model !== 'string' || !MODEL_ID.test(model) || !/[0-9]/.test(model)) {
    throw new Error(`model '${model}' is not a full model identifier for ${engineName}; give the exact model (for example '${engineName === 'claude' ? 'claude-opus-5-5' : 'gpt-6.1-sol'}'), not an alias`);
  }
  if (!engine.efforts.includes(effort)) {
    throw new Error(`effort '${effort}' is not supported for ${engineName}; supported: ${engine.efforts.join(', ')} (${engine.effortsSource})`);
  }
  return { engine: engineName, model, effort, verbosity: validVerbosity(engineName, verbosity) };
}

/** The verbosity as validated for `engineName`: null for omitted, else the value; throws for anything the engine does not accept. */
function validVerbosity(engineName, verbosity) {
  const engine = engineFor(engineName);
  if (verbosity === null || verbosity === undefined) return null;
  if (typeof verbosity !== 'string' || !verbosity || verbosity.trim() !== verbosity) {
    throw new Error(`verbosity '${verbosity}' is not a usable value for ${engineName}: give a non-empty name without leading or trailing whitespace, or omit --verbosity for the engine default (${engine.verbositiesSource})`);
  }
  if (!engine.acceptsCustomVerbosity && !engine.verbosities.includes(verbosity)) {
    throw new Error(`verbosity '${verbosity}' is not supported for ${engineName}; supported: ${engine.verbosities.join(', ')} (${engine.verbositiesSource}); omit --verbosity for the engine default`);
  }
  return verbosity;
}

/**
 * The verbosity record for one engine: what was requested (`engine-default`
 * when nothing was), whether an argument is passed, the exact argv entries
 * the engine receives, and the mechanism and its documentation source. The
 * value is validated first; an unsupported one throws as `validateSettings`
 * does.
 */
export function verbosityFor(engineName, verbosity = null) {
  const engine = engineFor(engineName);
  const valid = validVerbosity(engineName, verbosity);
  const base = { mechanism: engine.verbosityMechanism, source: engine.verbositiesSource };
  if (valid === null) return { requested: ENGINE_DEFAULT_VERBOSITY, applied: false, argv: [], ...base };
  return { requested: valid, applied: true, argv: engine.verbosityArgv(valid), ...base };
}

/**
 * The launch for one attempt: argv, cwd, the session-instruction record and
 * the verbosity record the argv carries. `settings.sessionInstruction` is
 * the record already resolved for the run; when it is not given, it is
 * resolved here from `settings.sourceRoot`. `settings.verbosity` is the
 * requested value (a string, or null/omitted for the engine default) or an
 * already built record. `executables[engine]`, when given, replaces the
 * engine's own executable name (argv[0]) with that path or argv prefix; it is
 * the seam the harness tests use to run a fake engine, and lets an operator
 * point at a specific installed binary.
 */
export function launchFor(engineName, settings, executables = {}) {
  const engine = engineFor(engineName);
  const sessionInstruction = settings.sessionInstruction === undefined ? sessionInstructionFor(engineName, settings.sourceRoot) : settings.sessionInstruction;
  const verbosity = settings.verbosity !== null && typeof settings.verbosity === 'object' ? settings.verbosity : verbosityFor(engineName, settings.verbosity ?? null);
  const launch = engine.command({ ...settings, sessionInstruction, verbosity });
  const substitute = executables[engineName];
  if (substitute !== undefined) {
    const prefix = Array.isArray(substitute) ? substitute : [substitute];
    launch.argv = [...prefix, ...launch.argv.slice(1)];
  }
  return { ...launch, sessionInstruction, verbosity };
}
