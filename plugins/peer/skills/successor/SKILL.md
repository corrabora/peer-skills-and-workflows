---
name: successor
description: Enable automatic succession for a task after too many turns or compactions, or hand the current work to a fresh successor now when context is degrading. Preserve decisions, authority and unfinished work across sessions, with clearly named current and retired agents in Orca. Use when asked to enable, adjust, inspect or stop succession; discussing context limits alone does not enable it.
---

# Successor

Keep the current task continuous while replacing an aging context. A **chain**
is that task's succession policy and retained records across agent sessions.
One session owns the task at a time. Invoking this skill to enable succession
authorizes future replacements within the task's existing scope, until the
task finishes or the operator disables succession. It grants no new authority
over the work, approvals, other workers or external communication.

This skill needs no plan or workflow binding. It supports root Claude Code and
Codex sessions with readable session logs and Orca launches. A dispatched
worker reports the need for replacement to its coordinator through its live
preamble; it does not replace itself, acquire the Run or reset its assignment.
Native subagent logs and runtimes without observable session identity are not
supported for automatic counting. Preserve an actionable continuation record
and report that limit; never present a guessed count as observed.

## Establish or resume the chain

Determine the current task, workspace, writing authority, session identity and
any existing chain from the request and accessible records. A supplied chain
root is authoritative; a successor must use it. Otherwise use `find` from the
helper described below. Repeated invocation uses the existing chain.

- **Enable:** retain the task's effective thresholds, defaulting to **3
  completed compactions or 40 turns** when no policy exists. Initialize and
  check immediately, including observations from before activation.
- **Now:** prepare the handoff at the next safe checkpoint regardless of counts.
- **Adjust:** apply positive integer thresholds without resetting observations,
  then check immediately. Reject invalid values.
- **Status:** report the current owner, counts, thresholds, record location and
  any transfer or observation blocker; leave policy unchanged.
- **Disable / task complete:** stop future reminders for the chain and retain
  its records. Finish or reconcile a transfer before changing its lifecycle.

Before using the helper, read [mechanics](references/mechanics.md). Resolve its
commands relative to this skill's real directory, including when installed as
a link. The helper owns storage, counters, session discovery, transfer records,
titles and exit meanings. Use its `--help`; report a missing dependency or
failed observation, preserving records instead of starting over.

Use an existing coordinator's Run records when it owns a Run. For ordinary
work, use the checkout's already established ignored `.peer-skills-and-workflows/`
directory, or application storage when that local storage is absent. Honor an
explicit external-storage choice. This requires no full repository binding.
Keep one authoritative root and pass its absolute path to every successor;
neither a new session nor a different working directory changes it. Records
are retained state: completing a task or retiring an agent never deletes them.

Before writing the continuation record or a launch brief, load the installed
`write-for-agents` skill; before a substantive operator explanation, load
`write-for-humans`. Use the engine's skill loader or read their installed
`SKILL.md` files; in this package they are siblings of this skill. If missing,
name the dependency and pause only the work that needs it.

## Preserve what the next context needs

Before summarizing instructions, use `capture` to preserve their source text from
this task's root session log. Establish the first task line and record why it is
the boundary; do not collect an unrelated earlier task. Capture at enablement,
after new operator instructions and before transfer. Each fresh generation sets
its own source boundary and inherits earlier generations unchanged. Use
`source-index` to locate entries; it contains metadata, not message text. Before
writing the continuation or launch brief, read the relevant retained message
text with `read-sources`, as described in mechanics. Its output includes the
message bodies without requiring field extraction. Read the task's original
brief as well as its corrections; an index or one restriction alone does not
cover the task. For large records, use indexed selections and check that their
returned text covers the instructions needed for the handoff.
Check the index's excluded-entry count against the task's actual beginning. If
the boundary omitted this task's earlier instructions, widen it with an earlier
`--from-line` and a corrected rationale; the previous capture remains retained.

The source record preserves message text and provenance, including pre-compaction
messages and steering. A user-channel message can be an injected launch brief,
quoted text or an operator prompt; its channel does not establish authority.
Reconcile its actual source, addressee and scope before treating it as an
instruction. Retain later amendments in order rather than making old restrictions
permanent. Missing or unsupported source input is a reported limitation, never
permission to discard a restriction. Resolve task-critical gaps before dependent
work. For a capture limitation, use `reconcile-source` as described in mechanics
to retain the supporting evidence and its effect on the next action. If the
evidence cannot settle a critical gap, hand off a waiting task whose next action
is to obtain that clarification. A reconciliation is an agent assessment, not
new operator authority; the raw limitation remains visible. Branch or rollback
ambiguity must never make an abandoned permission effective by file order alone.

Create `continuation.md` at the chain root when enabling succession. Update it
after consequential instructions, decisions, completed work or changed
blockers, and before transfer. Keep it concise enough to read in full:

- Task outcome and remaining scope; governing instructions and skill paths.
- Operator corrections, constraints, permissions and stop boundaries, with
  original wording or source references where interpretation matters.
- Settled decisions and necessary reasons; unresolved questions and their owners.
- Current artifacts and work identity, including uncommitted and unrelated work;
  completed versus prepared work; verification evidence and its limits.
- Running commands, workers, pending deliveries and cleanup obligations, when
  present; distinguish a live process from an uncertain observation.
- Current owner and Orca handle, effective engine/model/effort, chain root,
  generation, policy and next permitted action.

Consult original instructions and maintained sources when repairing lost facts;
do not recursively summarize the previous summary as the only evidence. State
what cannot be recovered. Compare the continuation and launch brief against
the operator's current constraints before freezing them. Current operator
instructions govern over older task notes; quote active prohibitions and stop
boundaries verbatim in the handoff, with their source. Preserve each
restriction's scope and duration, without inventing an expiry at handoff or
retirement. Keep outgoing-agent lifecycle duties separate from task restrictions
inherited by successors; preserve the addressee when quoting either. A next
action must satisfy every active constraint; distinguish
future task work from what the successor is permitted to do now.
Keep essential supporting evidence accessible for
the chain's lifetime, outside disposable scratch. Do not copy unrelated
transcripts, credentials or another task's private context into the handoff.

## Keep checks active

Check at invocation, after compaction or resume, before a new work batch and
at turn end. Use the helper's observed session events, never remembered turn
counts or summary size. Replayed events count once; a resumed session retains
its counts; a fresh successor starts its own counts while preserving its
predecessors' history. Report incomplete history as a known lower bound and
unavailable observations as unverified, never zero.

Set up the session-scoped hook reminders through the mechanics reference.
Verify actual hook delivery before calling reminders active. If the host has
not loaded/trusted hooks, say automatic reminders are unverified and continue
explicit checkpoint checks; do not silently call that automatic enforcement.
The hooks restore the record location and log-observed counts. A hook can run
before the current prompt or compaction is logged; follow its explicit check
before task work. It does not establish that the current event was counted,
perform the transfer or expand authority.

When either threshold is reached, start no new task batch. Reach a safe
checkpoint, preserve state, and transfer without another permission request.
Do not interrupt an in-flight write or abandon a running command. Record its
result or transfer its observable handle. Live coordinator workers may
continue within their existing assignments during the transfer.

## Transfer ownership

Before runtime operations, load the installed `orchestration` skill, resolve
its executable, and read its version-matched guide. For an ordinary ownership
handoff also read that executable's `orca-cli` guide. These own runtime
commands, launch receipts, retry and resource cleanup. Use a fresh agent in
the same workspace unless the operator requested relocation. Retain effective
engine, model and effort unless overridden; a missing or mismatched setting
needs disposition before relying on the successor. Never inherit the full
old conversation by forking or resuming it as the purported fresh context.

1. Refresh the continuation record and use `prepare` to refresh source capture
   and freeze the handoff, `instructions.json` and nonce. Preserve the exact
   launch request/receipt so an uncertain result is
   inspected or replayed through the runtime, never duplicated blindly.
2. Launch one successor with this skill's absolute path, chain root, nonce,
   handoff and instruction-source paths and digest, governing task skills,
   requested settings, predecessor handle
   and generation. Tell it to verify continuity and wait for yield before
   accepting, and wait for retirement before task work. For a coordinator,
   load [coordinator transfer](references/coordinator.md) before launch.
3. Name the successor with the helper's `STARTING` title and verify the visible
   title as described below. Record its actual handle in the transfer evidence.
   Record `yield` after launch; from that point the predecessor performs only
   transfer verification, UI retirement and reporting, never task work.
4. The successor loads this skill and reads the frozen instruction evidence
   before interpreting the handoff. It verifies its fresh
   session and effective settings, reconciles the actual workspace and authority,
   and writes `confirmation.md` beside the handoff. It records the nonce, both
   identities and handles, observed settings, the instruction-source digest,
   source entries supporting the next action, any limits, continuity checks,
   visible successor title and next permitted action. It then runs `accept`.
5. The predecessor verifies confirmation and actual ownership facts. It applies
   and verifies its `RETIRED` title, runs `retire` with that exact title, gives the
   operator the successor's identity/handle and record location, then ends.
6. Read `status` and verify the committed owner is this successor, the generation
   is the expected next generation, and `lastRetirement` matches the handoff
   nonce and both identities. A `retirement.json` file alone grants no ownership.
   Only then apply and verify the new `CURRENT` title, check counts and continue
   the task. Carry forward the policy and record location and verify hook
   discovery for the new session. Capture this session's instruction sources
   with its own task boundary. A transferred task waiting for the operator
   remains waiting.

Keep the successor active through this acceptance handshake, checking the
committed state at bounded intervals. Waiting for ownership confirmation is
part of the handoff; it is not supervision of the successor's later task.
If transfer stalls, read [recovery](references/recovery.md) before changing its
state. It defines cancellation by the predecessor and operator-authorized
completion by the designated successor. Elapsed time supplies no approval.
If new operator input arrives after the source freeze, preserve it and reconcile
the transfer before proceeding. Do not rewrite frozen evidence or treat the
earlier confirmation as covering a later instruction.

A launch receipt establishes delivery, not continuity or completed succession.
If transfer or UI verification fails, retain the records and actual handles,
report the observed owner and precise blocker, and start no new work. Inspect
the recorded phase on retry; do not reset the nonce, create a second successor
or let a yielded predecessor take ownership back without reconciliation.

## Make current and retired agents unmistakable

Use the helper's exact titles: `CURRENT — <task> [<chain>] #<generation>`,
`STARTING — … #<next generation>`, and
`RETIRED — … #<old generation> → #<next generation>`. Keep the stable task label
and short chain ID so concurrent tasks and successive contexts stay distinct.
Honor the operator's task name within this structure.

Set the title on the surface that actually launched. Read current Orca help
for `terminal rename` and `terminal set-pane-title`; split panes need their
own pane title, since renaming their shared tab alone is ambiguous. Use the
launch's runtime-issued handle with `terminal rename` for an unsplit terminal
or structured-chat tab. If that runtime cannot resolve the chat handle for
renaming, report the unsupported surface rather than inventing a command.
Apply and verify the initial `CURRENT` title when enabling the chain. Inspect the
resulting surface metadata or UI; a successful command receipt alone is not
proof that the displayed title distinguishes these agents. Orca may expose a
process-controlled title separately from the custom tab or pane label. Use the
current CLI's layout inspection command (for example,
`terminal list --include-visual-layouts`). For an unsplit surface, find its
containing tab through the exact returned pane handle and tab identity, then
inspect that tab's custom title; its pane/process title can differ. A different
process title alone does not show that renaming failed. For a split pane,
establish which observation represents its custom pane label from current
runtime documentation or the actual UI; do not substitute its shared tab title.
If metadata cannot establish the label, inspect the actual UI. Report a blocker
when neither route establishes it. Never rename an unrelated shared tab or
invent a chat command when unsupported.

`RETIRED` means retired from this task and never used for further task work; it
does not claim the underlying process exited. Retain that visible marker and
the retirement record. If closing the exact predecessor surface is requested,
the successor does so only after confirmed retirement through the runtime's
appropriate cleanup operation; never close a whole workspace or unrelated
panes. Do not use an idle terminal or mere prompt acceptance as retirement.

Enabling finishes when scoped instruction evidence and a continuation exist,
counts have been checked, the current
agent is visibly identified and reminder coverage is reported accurately.
Transfer finishes when the successor is visibly current, the predecessor is
visibly marked `RETIRED`, and the recorded task can continue under one owner.
