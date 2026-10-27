# Succession mechanics

From this skill's real directory, the package helper is
`../../tools/successor.mjs`. Run it with Node.js 22 or later. Read its
`--help` before commands. Commands print JSON except `read-sources`, which
renders the retained message bodies as text. Except for hook delivery,
exit 0 means success/not due, 3 means an active chain is due, 1 means failure
and 2 means invalid CLI syntax. Any other result is a blocker to report.

The examples use `<helper>` for that absolute path. Substitute observed values;
do not treat angle-bracket fields as literal arguments. `--session` may be
omitted when the engine exposes its current identity in the environment.

## Discovery and storage

```text
node <helper> find --engine <claude|codex>
node <helper> init --engine <engine> --workspace <canonical checkout or folder> --task <short task title>
node <helper> status --root <chain root>
```

`find` returns the existing chain or `null`. Initialization locates the current
root session log through the shared `tools/succession.mjs` observer. If the
engine supplies no identity, use that tool's `marker`, then in a later call
`locate --engine <engine> --marker <printed marker>`. Supply the resulting
`--session` and `--log` to initialization. Never choose a log by recency alone.

Storage selection is deterministic:

- An owned Run: pass `--run-root <absolute existing run records>`. State lives
  under `control/successor/`; counts reuse `control/coordinator-counts.json`.
  Preserve the Run's existing policy by supplying its resolved thresholds.
- An ordinary task: default `--storage auto` uses
  `.agent-workflow/successions/<chain-id>/` when `.agent-workflow/` already
  exists, is a plain directory and is wholly untracked and ignored. A conflict
  is reported; nothing is untracked or silently redirected.
- When local storage is absent, or with `--storage external`, records live at
  `<machine base>/successions/<chain-id>/`. `machineBase` in
  `tools/lib/paths.mjs` owns the platform mapping. On macOS this is under
  `~/Library/Application Support/AgentWorkflow`. It is retained state beside
  `scratch/`, never inside scratch.

The helper also writes a small session-to-root pointer under
`<machine base>/successions/sessions/`. Hooks use it to find the one chain for
their exact engine/session, without reading unrelated workspaces. This index
contains no continuation content. An inaccessible application-storage location
is a setup failure to report, not a reason to put durable state in a temp dir.
`register` repairs a missing pointer for the recorded owner or confirmed
successor. It does not reset counts or claim another owner's chain.

`state.json` and the session pointers are version 1 formats owned and validated
by `tools/lib/successor.mjs`; counts keep the existing observer's v1 format.
Do not edit these JSON records by hand. Unknown versions and corrupt state
require restoration/reconciliation; the helper refuses to replace them with
empty state. A `.lock` means another mutation may be running. It records only
a PID; establish the creating host and process separately before recovering
an abandoned lock. If those facts are unknown, report the blocker; never delete
the lock just because a command timed out. These locks serialize file updates; they
do not fence an agent from editing task files.

## Check, change and finish

```text
node <helper> observe --root <root> --engine <engine>
node <helper> policy --root <root> --engine <engine> --turns 25
node <helper> disable --root <root> --engine <engine>
node <helper> complete --root <root> --engine <engine>
```

Both thresholds accept positive safe integers; use `--compactions` for the
other limit. Repeated initialization preserves policy. Counts come from root
session logs, deduplicate events and retain historical sessions. A truncated
already-established log can remain a lower bound; an unrecognizable log is an
error. A partial concurrent log write is refused: re-observe after it settles,
and report persistent failure. Disabled/completed chains keep their records.

## Original instruction evidence

After initialization, inspect the recorded owner's root log to establish where
this task begins. Use line 1 only when the entire session belongs to this task.
The scope rationale records that judgment; the helper does not infer task scope.

```text
node <helper> capture --root <root> --engine <engine> --from-line <first task line> --scope <why this range belongs to the task>
node <helper> capture --root <root> --engine <engine>
node <helper> source-index --root <root>
node <helper> read-sources --root <root>
node <helper> read-sources --root <root> --generation <n> --entry-id <indexed id>
node <helper> read-sources --root <root> --generation <n> --limitation-id <indexed id>
node <helper> reconcile-source --root <root> --engine <engine> --generation <n> --limitation-id <indexed id> --resolution-file <record>
```

The first capture in each generation requires its boundary and rationale.
Later captures extend that range without replacing earlier messages. A boundary
set too late can be moved earlier with `--from-line` and a new `--scope` rationale;
it cannot move later and discard evidence. Each widening retains the former
boundary, rationale and source digest. Inspect the excluded-entry count before
accepting the boundary; it is a cue to check scope, not proof of an omission.
Original text is retained separately from interpretation in
immutable `instructions/<sha256>.json` records. `state.json` names the current
record; a failed publication cannot replace that pointer with partial evidence.
Source records are v1, owned by `tools/lib/successor-instructions.mjs`.

The adapters retain Codex user `response_item` message text and Claude user
message text and queued-command steering. They exclude structurally identified
tool results, meta messages and compaction summaries. User-channel origin stays
unverified: neither adapter can prove that a message came from the operator
rather than an injected preamble. Interpret authority and addressees from the
original task context, not a channel label. A hash proves byte identity, not
completeness, authorship or understanding.

Claude entries retain their parent and captured instruction ancestry. Branches
or unresolved ancestry are limitations, not a reconstructed active conversation.
At a Claude compaction boundary, the adapter follows its recorded logical
parent. For manual compaction it also preserves the original `/compact` prompt
when the summary's prompt identity and the sole user child of that logical
parent agree. Summary prose supplies no instructions. Missing or conflicting
links remain limitations. Refreshing a capture retains earlier limitations and
their reconciliations even when this adapter can now trace the edge.
Codex `thread_rolled_back` markers likewise require reconciliation; their dropped
turns cannot be interpreted as ordinary later amendments. The adapter preserves
ambiguous text as evidence instead of guessing which permission remains active.
An active development capture made before the Claude ancestry fields were added
can be refreshed from its unchanged root log. The new record names the earlier
source digest in `lineageEnrichedFrom`; original text and old blobs are preserved.
Retired generations stay as originally recorded and are not retroactively
certified by this enrichment.

The index names each generation, scope, source line, event identity, byte size
and limitations; it omits message text. `read-sources` returns message bodies
literally alongside their provenance and limitations. Read that output before
summarizing instructions; if a tool truncates it, retrieve the missing entries
through indexed selections. `sources` retains the JSON interface for structured
processing; its message bodies are arrays named `texts`. Reading IDs, sizes or
hashes alone does not inspect retained instructions. Read large records in indexed selections without silently
discarding text; all captured text remains available. Retired generations are
carried unchanged and need no further access to retired logs. Current log
prefix changes, missing root identity, truncation, malformed records and
unsupported input remain explicit errors or limitations. Non-text input is not
archived by this text adapter; a capture containing it cannot establish complete
instruction evidence. Each indexed limitation needs a separate reconciliation
before preparation. This version does not repair
missing earlier-generation sources automatically.

While the chain is active, write a resolution record for `reconcile-source`.
Name the indexed limitation, accessible supporting evidence, what remains
unknown, and the next permitted action. Record recovered instruction content
with its original source, or explain with evidence why the input supplies no
task instruction. Retain supporting artifacts at the chain root when their
original location is disposable. If a critical gap remains unresolved, say so
and restrict the successor to obtaining clarification; recording a reconciliation
does not lift that restriction. Do not mark a limitation resolved merely to
make the command succeed.

The helper appends the resolution text, its digest, recording owner and time as
an `agent-assessment`. It preserves the raw limitation and all prior assessments;
the successor reads both and reconciles later assessments in order. The helper
checks references and byte identity, not whether the explanation is correct or
an operator actually authorized its proposed action. This command neither
changes ownership nor recovers an already frozen transfer.

`prepare` refreshes the current capture and freezes its bytes beside the handoff
as `instructions.json`, and records the handoff text's digest too. Both are
checked at yield, accept and retire. The launch brief passes the source path and digest. The
successor reads it first and records the digest and the source entries governing
its next action in `confirmation.md`; `accept` verifies byte identity and the
digest acknowledgment, not the truth of the agent's interpretation. `yield` and
`retire` also check for new predecessor input after the freeze. Such input
requires reconciliation of the existing transfer, not a new nonce or silent
reuse of a stale confirmation.

## Hook reminders

The package's `node tools/install.mjs link workflow` installs these required
hooks in each engine's user settings, alongside the skill, so they are available
across repositories. `check workflow` checks their definitions; `unlink workflow`
removes only installer-owned entries. Read the package [installation contract](../../../README.md#install)
for settings locations, ownership and repair. Inspect the host's discovered
hooks before adding a project copy: multiple configuration layers can run
the same command. Installation does not establish human trust or live delivery.

```text
node <helper> hook-config --engine <engine>
```

This prints a configuration fragment, changing no settings. Its three command
hooks use `SessionStart`, `UserPromptSubmit` and `Stop`, and read JSON events
from stdin. Merge these entries into the host's supported hook configuration,
preserving every unrelated hook and avoiding duplicate commands. Use the
current engine documentation and effective settings to locate that file:
[Codex hooks](https://learn.chatgpt.com/docs/hooks) and
[Claude Code hooks](https://code.claude.com/docs/en/hooks).
The configuration is session-scoped by the pointer lookup: unregistered,
disabled and completed sessions return no instructions.

For a linked Git worktree, verify the discovered hook's source path as well as
the active config layer. Codex can read ordinary settings from the worktree
while resolving project hooks from the main checkout; a loaded worktree config
does not prove its adjacent hooks were discovered. Check the installed runtime
before choosing a destination. A main-checkout hook can affect other worktrees,
so do not redirect installation there without authority covering that scope.

Only configure hooks within the operator's setup authority. Codex requires
the human to trust a new non-managed hook definition through `/hooks`; never
bypass that trust. Claude may require reloading the session's settings.
Prepare the exact fragment before requesting any required setup action.
Verify a real event reaches the helper and returns the chain reminder before
claiming delivery works. An isolated synthetic hook test establishes protocol
behavior, not that the live host loaded the configuration.

`SessionStart` restores the reminder on resume and after compaction;
`UserPromptSubmit` refreshes it on new prompts. `Stop` asks for one continuation
when due or observation failed, honoring `stop_hook_active` to prevent a loop.
No hooks launch agents or mutate the task. Persisted counts remain sourced
from the session log, so a hook replay never increments them. The host may fire
a prompt or compaction hook before recording that event. A not-due reminder
therefore requests an explicit `observe` check before task work; it is not
permission to continue based on the earlier count. No elapsed-time wait or
hook event alone proves that the log has caught up. If a required observation
remains unavailable, report it under the explicit-check rules above. Hooks and
explicit checks share the lock; a concurrent-write error is reported, not zeroed.

The generated command quotes executable and helper paths for POSIX shells or
Windows command shells. It refuses unsafe Windows metacharacters instead of
emitting an ambiguous command. Check the runtime's actual shell when installing
on Windows; an adapter test on another OS does not establish that integration.

## Transfer commands

Capture the task's source instructions and write `continuation.md` first, then:

```text
node <helper> prepare --root <root> --engine <predecessor engine>
node <helper> yield --root <root> --engine <predecessor engine> --nonce <nonce>
node <helper> accept --root <root> --engine <successor engine> --nonce <nonce>
node <helper> retire --root <root> --engine <predecessor engine> --nonce <nonce> --retired-title <verified RETIRED title>
```

`prepare` freezes the continuation record under `handoffs/<nonce>/handoff.md`
inside the chain root and returns exact UI titles. It does not launch anything.
Between `yield` and `accept`, the successor verifies continuity and writes
`confirmation.md` beside that handoff. Confirmation includes actual Orca
handles, settings and visible titles, plus Run ownership checks for a coordinator.
The helper checks phase, nonce, distinct fresh session identity and presence of
confirmation; the agents must verify the facts in that confirmation.

The predecessor verifies its exact `RETIRED` title before `retire`; the helper
requires that title as an explicit attestation. Retirement observes the new
session before atomically committing its owner/generation and `lastRetirement`
metadata in `state.json`. That committed metadata contains the nonce, generation,
both identities, title and timestamp. `retirement.json` is a derived receipt,
written afterward; its existence alone never proves transfer.

After an error, inspect `status`. If the matching retirement is committed, the
same predecessor may repeat `retire` with that nonce and exact title to recreate
the receipt; this does not change ownership or restore task authority. If state
still shows the confirmed transfer, resolve the reported failure and retry the
same transfer. Counts reporting follows the committed owner even if a new-session
observation persisted before a failed state commit. Never manually fabricate a
commit from an older receipt. A disappeared predecessor still requires ownership
reconciliation; this receipt retry does not authorize a successor to retire it.

The successor checks the committed owner, generation and nonce through `status`
before applying and verifying its `CURRENT` title. Older records without
`lastRetirement` cannot establish this new completion check; report the gap for
reconciliation. Neither a recorded title nor a confirmation file independently
proves actual UI or runtime state. Preserve those observations with the handoff.
