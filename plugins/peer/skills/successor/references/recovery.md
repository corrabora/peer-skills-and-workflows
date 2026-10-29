# Recover a stalled handoff

Read `status` and the retained launch/confirmation evidence first. Use the
recorded chain and nonce. Load the runtime's current recovery guide for liveness,
launch uncertainty and resource cleanup; a missing pane or timeout does not
prove exit. This reference governs only the succession helper's ownership state.
It does not authorize stopping another worker, closing unrelated UI or changing
an Orca Run's owner outside that runtime's contract.

Before choosing a recovery action or reporting a hold, read the retained original
task instructions and amendments, then the relevant continuation and working
notes. Reconcile conflicting next actions against those sources. Record that
reconciliation in a recovery assessment that preserves the task requirements,
unresolved dependencies, decision owners and active restrictions. Leave protected
task files unchanged.

| Recorded phase | Permitted recovery caller and action |
| --- | --- |
| `prepared` or `yielded` | Recorded predecessor may `cancel-transfer` after verified non-launch or exact successor exit, or an explicit operator decision settling a live/uncertain successor |
| `cancelled` | Same predecessor reconciles UI and runs `resume-cancelled`; the old nonce already rejects acceptance |
| `confirmed` | Only the designated successor may `finish-transfer`, after an explicit operator decision and verification below |
| Already committed retirement | Retry the original `retire`, or the original `finish-transfer` by its designated successor, to repair the derived receipt; do not increment generation again |

Policy authorization to use this skill is not the decision for a particular
uncertain transfer. An operator decision must identify this chain, nonce,
predecessor, successor and authorized owner. Preserve the actual request/reply
or other original decision source, including its scope. A cancellation decision
must settle what happens to a possibly live successor before the predecessor
resumes. A cancelled nonce fences the helper, not direct task-file writes.
If a launch's handle is unknown, investigate its retained request/receipt until
the exact participant or positive non-launch is established; do not invent one.

For either recovery path on a coordinator chain, load
[coordinator transfer](coordinator.md). Before `resume-cancelled` or
`finish-transfer`, reconcile the Run's actual owner, consumer generation and
pending deliveries through that runtime. The owner must be the predecessor
for cancellation recovery, or the designated successor for completion. Retain
the runtime evidence in the record below. A helper record alone does not
transfer or reclaim a Run; unresolved runtime ownership blocks coordination.

## Cancel, then resume the predecessor

1. Verify launch/runtime facts for the exact attempt. Record non-launch, exit,
   or the operator's disposition of a live/uncertain successor in the evidence
   record below. Preserve the original handoff and any new operator input.
2. Run `cancel-transfer` with that record. Verify `status` shows `cancelled` for
   the same nonce. The predecessor remains the recorded owner, but neither
   participant may do task work yet. Late `accept` now fails. A confirmed
   transfer cannot take this path.
3. Reconcile the exact UI surfaces. Apply and inspect the predecessor's
   `titles.current`. Give a launched successor `titles.cancelledSuccessor`,
   which includes `RETIRED`, attempted generation and cancelled nonce, and inspect
   it. A verified closed surface is acceptable only with positive exit evidence.
   Non-launch has no successor surface. Never rename a shared unrelated tab.
4. Write a `resume-cancelled` record with those current observations. Run the
   command and verify the predecessor is active at the same generation. The
   helper captures new original instructions and observes counts before that
   commit. Read the updated sources and refresh the continuation before task
   work; cancellation does not restore superseded instructions or reset counts.

If a successor appears after recorded non-launch, keep the nonce cancelled.
Retain the newly discovered exact participant and obtain a new scoped operator
disposition for `resume-cancelled`, even if that participant has since exited.
Preserve the original cancellation evidence. This exception cannot replace an
already identified participant.

If UI reconciliation, source capture or observation fails, stay cancelled and
report the precise blocker. Retry the same step after resolving it. A future
handoff uses a fresh nonce and fresh session; the cancelled successor is retired
for this task, regardless of whether its process still exists.

## Finish a confirmed transfer after the predecessor disappears

A confirmed transfer whose successor has died while the predecessor is live
has no recovery command under this policy. Hold task work and report that
state for an operator disposition; do not cancel a confirmed transfer.

The designated successor retains an explicit operator decision assigning this
same transfer to it. Establish current runtime facts and both actual handles;
record the predecessor as exited or unverifiable, never infer death from
silence. A known-live predecessor must be reconciled first. Verify the original
confirmation, source evidence, actual workspace and next permitted action.
Apply and inspect the predecessor's exact `titles.retired` RETIRED marker and the
successor's STARTING title before committing. An unavailable predecessor UI
that cannot be marked/verified remains a blocker under this policy.

Run `finish-transfer` from the successor's own engine/session, with the
operator decision and runtime/UI evidence. Never impersonate the predecessor
with its session flag. Verify committed owner, generation and nonce through
`status`, then apply and inspect CURRENT and follow the ordinary successor
continuation steps. New predecessor input after the freeze, damaged source
evidence or changed confirmation remains a blocker; recovery grants no waiver
of instruction continuity. Earlier confirmations lacking a stored hash must
be checked against retained actual evidence; the helper cannot retroactively
prove their original bytes.


## Evidence record and commands

Use the helper path from [mechanics](mechanics.md). All three commands take
`--root`, the caller's `--engine`/`--session`, the existing `--nonce`, and
`--record-file <absolute JSON path>`. `finish-transfer` additionally takes
`--retired-title <verified RETIRED title>`. Read `--help` for exact CLI syntax.

The JSON record has these fields; use actual observed values:

```json
{
  "version": 1,
  "action": "cancel-transfer",
  "chain": "chain-id",
  "nonce": "transfer-nonce",
  "generation": 1,
  "reporter": {"engine": "codex", "session": "predecessor-session"},
  "predecessor": {"engine": "codex", "session": "predecessor-session", "handle": "actual-handle"},
  "successor": {"engine": "claude", "session": "known-session-or-null", "handle": "actual-successor-handle"},
  "runtime": {"id": "observed-runtime", "host": "execution-host"},
  "observation": {"verdict": "exited", "at": "2026-10-24T00:00:00Z"},
  "assessment": "What the retained facts establish, their limits, and how the other participant is settled.",
  "launchEvidence": "launch",
  "runtimeEvidence": "runtime",
  "evidence": [
    {"id": "launch", "path": "/retained/launch-receipt.json"},
    {"id": "runtime", "path": "/retained/runtime-observation.json"}
  ]
}
```

`successor` is JSON `null` only for verified `not-launched`. For a known handle
whose provider session is unavailable, its `session` may be JSON `null` during
cancellation; a confirmed successor's engine/session must match state. The
observation describes the successor for cancellation/resumption and the
predecessor for completion. Accepted verdicts are `not-launched`, `exited`,
`live` and `unverifiable` for cancellation; resumption allows `not-launched`
only with no successor; completion allows only `exited` or `unverifiable` for
the predecessor. Retain launch intent and positive non-launch
evidence when no launch receipt exists. References name unique IDs in
`evidence`, whose paths must be regular, nonempty UTF-8 files.

For a required operator decision, add `decision` with `kind: "operator-decision"`,
this `action`, `chain`, `nonce`, both participant identities (including successor
handle), `authorizedOwner: {engine, session}`, the exact `quote`, and `evidence`
naming its original source in the evidence array. Use a dedicated decision ID,
distinct from launch/runtime/UI evidence IDs. The exact quote must occur in
that named source. For JSON/JSONL replies, retain both the original artifact
and its faithfully decoded plain-text reply body; reference the latter for the
quote so escaped newlines and quotation marks are preserved correctly.
The helper checks these bindings and referenced bytes; the agent must verify that the source actually
authorizes this disposition. Agent-authored prose is not operator approval.

For `resume-cancelled` and `finish-transfer`, add `ui.predecessor` and
`ui.successor`. A visible entry is `{handle, state: "visible", title, evidence}`
using the exact expected helper title and a retained observation reference.
For resumption only, an exited successor's verified closed surface is
`{handle, state: "closed", evidence}`; non-launch uses `ui.successor: null`.
Resumption must name the same runtime and participants as cancellation,
except for the newly discovered successor case above; an
earlier explicit cancellation disposition carries forward without asking again.
If new facts leave the successor live or uncertain without such a disposition,
retain a new operator decision for `resume-cancelled` before resuming.

For a coordinator chain, resumption and completion also require
`coordinator: {runId, ownerHandle, consumerGeneration, evidence}`. Use the actual
Run ID, reconciled owner's handle, positive integer consumer generation and
reference to the runtime observation; verify those values against the Run.
The helper enforces these fields for Run-stored chains; the obligation applies
to every coordinator chain, including externally stored chains.

The helper copies the record and every referenced file into an immutable,
hashed `recovery/<sha256>.json` bundle before publishing state. Keep sources
scoped to this transfer; do not collect unrelated logs. `state.json` retains
recovery history, cancellation and retirement identities. A publication failure
can leave an unreferenced evidence blob, but cannot grant ownership. Inspect
state before retrying. A committed retry accepts the identical record text or
no `--record-file`; changed supplied records fail. Use the next recovery action
for new facts. Committed receipt repair does not repeat a transition.
These bindings are accident guards, not authentication or proof of semantic
verification. No helper command launches, stops, renames or closes an agent.

## Report the recovery outcome

Load `write-for-humans` under the main skill's dependency rule before a substantive
recovery reply, including a hold. Name the committed owner or held phase, retained
records, any missing decision or evidence, and the next permitted action. Carry
the limits of the supporting observations into the reply: fixture or metadata
checks do not establish live process or graphical UI behavior, and reading a
rejection guard does not establish an attempted or refused operation. State
reminder coverage accurately; unverified hooks remain unverified after recovery.
