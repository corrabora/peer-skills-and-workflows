# Plan workflow process

This is the engine-neutral process shared by the four role skills. The target
repository's guidance and quality-profiles govern everything they cover; the
operator's local binding maps them for dispatch and fills silence with
package defaults ([BINDING.md](BINDING.md)), and the canonical
[severity scale](REVIEW.md#severity-scale) and the handling of `note`, proof
and coverage govern under every binding. [ORCA.md](ORCA.md) maps the process
onto the runtime, [REVIEW.md](REVIEW.md) owns review seats, rounds and
severity, [ADJUDICATION.md](ADJUDICATION.md) owns peer reconciliation and
[RECORDS.md](RECORDS.md) owns the record layout, scratch, ephemeral records,
the operator-guidance ledger and the report.
Worker configuration lives in [defaults.yaml](../defaults.yaml) and the
checkout's local settings; ORCA owns how it is resolved.

## Roles

| Role | Owns | Never |
| --- | --- | --- |
| Operator | Scope, plan intent, design and architecture decisions, dispositions, authorizations | — |
| Plan coordinator (PC) | Orca Run, effective worker configuration, review-set allocation, worker waves, finding map, records, reports, operator conversation | Edits the candidate, decides for the operator |
| Responsible party (RP) | Code, tests, maintained documents, candidate, verification evidence | Reviews or disposes of its own findings |
| Reviewer | One review set of one candidate, as a direct worker | Fixes, delegates, or reviews another set |
| Adjudicator | Independent assessment of all findings, then peer reconciliation | Edits the candidate, speaks with operator authority |
| Investigator | One bounded question, answered with isolated probes and a report | Writes the candidate, shared refs, stash or repository config |

The PC is the only long-lived context. Every RP, review, adjudication and
landing task is a fresh worker, released once its result is preserved. While an
RP is active it is the only writer of the implementation; nobody edits the
candidate while it is under review. An RP is one worker by default. When a
recorded operator instruction directs pairing and its scope covers the RP task,
the RP is a pair instead: the dispatched RP host and one fresh companion it
launches, implementing together under
[peer-implementation](../skills/peer-implementation/SKILL.md), with only the
current driver editing or staging. That instruction settles the pair's
alternating writing and the host's delegation without another approval; it is
not an execution release, and the host stays accountable for the RP task.
Pairing changes no other role's rights and no review, adjudication or operator
gate.

The PC launches investigators, on its own
initiative or at an adjudicator's request, each with a bounded question and
its own attempt and scratch directories ([RECORDS.md](RECORDS.md#scratch)); an
adjudicator asks the PC rather than starting one. Investigators work only there
and report; an RP incorporates a probe only under an authorized correction. Git worktrees share refs, stashes
and configuration, so no worker moves another's refs, touches stashes or
changes repository configuration.

## Binding

Before writing any record, the PC establishes the operator's local binding
in its own checkout with the `bind-agent-workflow` skill: local storage under
the ignored `.agent-workflow/` directory, then the binding file and its
recorded sources ([BINDING.md](BINDING.md)). Each task then receives a fixed
binding snapshot published under the run records
([BINDING.md](BINDING.md#snapshots)). Tracked guidance and quality obligations
are read from the candidate; local preferences, personal additions and
resolved choices come from the snapshot; a refresh never changes a running
worker's contract ([BINDING.md](BINDING.md#refresh)). The binding is the
operator's organization of their own work: it adds no requirement for other
contributors and never releases work by itself.

## Planning and phases

The target's planning guidance governs. Where it is silent, use this shape: the
plan overview owns the objective, constraints and acceptance outcomes; the next
coherent phase is refined enough to implement, and code, tests and the phase
document evolve together. Each phase is independently complete; a later phase
never supplies an earlier phase's missing correctness. Update the overview when
implementation changes the sequence or scope.

When drafting or refining a plan, the RP loads `write-for-humans` for its
objectives, rationale and acceptance outcomes, and `write-for-agents` for
sections directing execution, under [Writing](RECORDS.md#writing). The same
selection applies to maintained documents developed alongside code and tests.

When terminology leaves a consequential distinction unresolved, or the task
calls for glossary edits, the role doing that work loads
[maintain-glossary](../skills/maintain-glossary/SKILL.md).
Use its source investigation and clarification through the PC; keep unresolved
meanings pending. Only the RP applies authorized maintained edits, after the
meaning is settled. Reading established vocabulary creates no glossary task.

When a choice is discussed that may need durable rationale, the PC or RP loads
[record-decision](../skills/record-decision/SKILL.md) to assess whether to offer
an ADR; an explicit recording request or repository requirement selects it
directly. The PC carries any proposed recording work into the RP assignment
under the applicable execution release. The RP writes or revises the record
within that scope, preserving its actual standing. Routine dispositions stay
in the operator-guidance ledger; maintained rationale stands without it.
Neither a glossary entry nor an ADR settles a decision or releases execution.

A phase lands as one commit. Internal iterations do not enter delivered history.
The binding names the candidate form, from project guidance or the package
default ([BINDING.md](BINDING.md#defaults)): usually the staged index tree on
the phase base, or a temporary branch or worktree when the task needs one. Identify a
candidate by base commit plus tree (and commit when there is one), never by a
branch name alone. Uncommitted and ignored files do not appear in another
worktree; a probe that needs the candidate materializes it in its scratch,
outside the developer's checkout, and checks the tree.

## Quality profiles

Review sets come from the target's initialized quality profiles, read from the
candidate, with the operator's personal additions kept apart by source
([BINDING.md](BINDING.md#sources-and-authority)). Before the first dependent
wave the PC checks, through the binding, that the repository has them. If they
are missing, the PC stops and asks the human operator to initialize them; it
does not substitute authored perspectives, initialize profiles itself, or treat
silence as completion. Once the operator reports completion, the PC refreshes
the binding and inspects the installed selection and governing material before
partitioning it into the four sets ([REVIEW.md](REVIEW.md)).

## Wave cycle

1. **Prepare.** A fresh RP implements the phase or an authorized correction
   batch, runs the binding's verification and evidence, and returns the
   candidate with its manifest. Failed required proof is never a pass.
2. **Review.** Four fresh direct reviewers review the same candidate, one set
   each, for the current round ([REVIEW.md](REVIEW.md)). Each assesses the full
   phase diff from its base, not only the latest correction.
3. **Adjudicate.** A review with any finding, `note` included, goes straight to
   adjudication, without an intermediate gate: two fresh adjudicators assess
   all findings independently and then reconcile
   ([ADJUDICATION.md](ADJUDICATION.md)).
4. **Report and stop.** The PC writes the report ([RECORDS.md](RECORDS.md)) and
   stops at the operator gate. After adjudication it then presents the findings
   as a concise automatic-pairs list first, then takes the pairs requiring
   human disposition one at a time using the concise presentation in
   [RECORDS.md](RECORDS.md#operator-dispositions), until each queued pair has a clear
   disposition, subject to the operator exceptions in
   [RECORDS.md](RECORDS.md#operator-dispositions). A clean review comes here
   directly.

Each review therefore reaches the operator gate once: after adjudication when
it had findings, or directly when it was clean. The gate holds even when the
adjudicators agree unanimously. No further coding, round advance or landing
happens until the operator answers, unless recorded authorization already
covers that exact step. An explicit instruction to proceed automatically may
cover all-automatic waves under
[RECORDS.md](RECORDS.md#operator-dispositions); it never waives a required
human disposition. Disposing of a finding does not by itself
authorize that work; RP work needs an explicit
[execution release](#execution-release). The operator may authorize a batch in
advance (for example: implement the agreed recommendations, then repeat the
round); record its exact scope in the run's
[operator-guidance ledger](RECORDS.md#operator-guidance) and stop where it
ends.

Any change to plan intent, scope, design or architecture, whether it broadens or
tightens them, is presented to the operator before implementation, even when
peers agree and even inside a batch authorization. Agreement recommends; it
never authorizes. An RP that finds such a change necessary brings it to the PC
instead of implementing it.

When no single principled approach is established, keep the substantive brief
and its alternatives for the operator rather than picking one. A recorded
operator decision is not relitigated without new grounds: new evidence, changed
behavior or scope, an unmet condition of the decision, or a governing obligation
the earlier assessment missed.

## Execution release

An RP works only under an explicit human release: the operator's own
instruction to carry out that work, typically "proceed", recorded in the run's
[operator-guidance ledger](RECORDS.md#operator-guidance) with its scope and
stop boundary. This holds for every RP task: a phase, a correction batch or
the landing commit. Equivalent explicit wording releases work as well; no
exact word is required. Nothing else releases RP work: not accepting a finding
or proposal, an instruction about what to change, the PC's interpretation of
earlier guidance, a dispatch or task, or a release already spent at its stop
boundary. In the ledger, an execution release is an authorization entry whose
Exact wording holds the operator's explicit instruction and whose Execution
permission, Scope and conditions and Stop boundary name the RP work it
permits; not every authorization releases RP work, an entry's Execution
permission may say none, and a Kind label alone grants no authority.

Instructions the operator gives during a review round, the disposition
conversation included, are scope for the next RP round. The PC records them
as pending; they never start an ad-hoc round of their own. The operator may
release a bounded batch in one instruction, such as the accepted corrections
with the review that follows them; the release ends at its stop boundary.

Automatic recommendations, required or optional, also become pending scope
for the next RP round unless the operator overrides them. Identify each by
finding ID and published report revision, keeping its peer classification
apart from an operator disposition. Include them in the scope summary for the
next release; implement only the recommendations that release covers. An
explicit instruction to proceed automatically can supply that release within
its recorded scope and stop boundary, but never waive a required human
disposition. A pair classified as requiring disposition must receive it
before implementation, even under an automatic-progress instruction.

The PC dispatches an RP only under a release that covers the task, and the
task names that release entry apart from the instructions, dispositions and
automatic finding/recommendation pairs it
implements ([ORCA.md](ORCA.md#run-and-tasks)). Before changing anything, the
RP reads the release entry itself and checks that it records the operator's
explicit release, is not spent and covers the task's scope. If the release is
missing, ambiguous, spent or does not cover the task, the RP does no candidate
work and asks the PC. A release the operator gives a worker directly reaches
the ledger through the PC, like other direct guidance
([ORCA.md](ORCA.md#worker-communication)).

## Judgment

The PC, adjudicators and reviewers reason from verified facts, the target's
guidance and quality obligations (including whether a clause actually applies),
and the plan and phase objectives. An easier or faster remedy is not a reason by
itself. Neither is maximal machinery for a product the plan does not describe.
Severity follows consequence at the current target, not how many reviewers or
engines agree, on the canonical [severity scale](REVIEW.md#severity-scale),
whatever the binding's finding format: a failed in-scope clause is never
`note`, and a `note` is a finding like any other
([REVIEW.md](REVIEW.md#handling-of-note)).

## Landing

Landing follows a clean round 4 on the final candidate unless the operator
decides otherwise with the coverage actually present. A fresh RP prepares the
single phase commit from exactly the accepted tree through the target's normal
hook and landing path, then compares the committed tree with the accepted one.
Any difference is a new candidate. The landing RP works alone unless a recorded
pairing instruction's scope covers the landing task; a direction covering only
the phase does not, and an instruction that does needs no repeated approval.
A paired landing keeps the accepted tree unchanged, has one identified
committer and the same hook and tree comparison, and adds no change merely to
produce a failing check. Publishing, merging, deleting branches or
worktrees and starting the next phase are separate operator decisions.

## Continuity

Run state lives in Orca; resume a plan by binding its existing Run, not by
creating another, and check the binding's sources before dependent work
([BINDING.md](BINDING.md#refresh)). Run records live under the ignored
`.agent-workflow/runs/` directory of the PC's own checkout, beside the local
binding, and transient work in machine-local scratch outside it
([RECORDS.md](RECORDS.md)). They preserve continuity across fresh
contexts but are never authority: maintained documents state decisions and
rationale directly and stand when every record has been deleted. The PC
records every operator instruction once, in the run's
[operator-guidance ledger](RECORDS.md#operator-guidance), and workers learn of
it through their tasks and the PC's follow-ups. If ephemeral state is missing, say so, recover what the repository and
Orca can establish, repeat missing proof, and ask the operator for a lost
decision. Never invent memory.

Only the PC writes a successor handoff, and only when the operator asks for one
([handoff template](templates/handoff.md)).
