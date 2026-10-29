---
name: peer-implementation
description: Implement a task with one fresh peer using ping-pong pair programming, alternating checks and implementation until its objectives and requirements are satisfied. Use when asked to pair on implementation, from a small script to an entire plan or phase. Recommendation-only and review-only requests have separate peer skills.
---

# Peer implementation

Deliver one shared implementation with evidence that it meets the authorized
task. The calling agent is the **host** and launches one fresh **companion**.
Both are responsible for the whole result and alternate as **driver**, the
peer currently editing the deliverables. The other peer actively follows the
work, examines evidence and contributes reasoning. A companion assigned this
skill participates in that pair without launching another peer.

## Establish the task and pair

Before preparing the companion's brief, both roles read
[peer-review](../peer-review/SKILL.md). Reuse its required writing skills, Orca
setup, engine/model/effort selection, identifiable source snapshots, independent
frozen assessments, paired discussion rounds, explicit agreement, retained
records and cleanup. This skill owns implementation, writing authority, turn
handoffs, dispute escalation and completion; those rules replace peer-review's
read-only companion, host-only corrections and review stopping point. Reading
that source starts no separate review. Report an unavailable dependency and
pause work requiring it.

Read the request and governing sources to establish objectives, requirements,
acceptance evidence, existing work, authorized scope and stop boundary. Use the
target's applicable quality requirements and checks. A small task needs no plan,
workflow binding or formal review roster. A plan or phase brings its own
requirements and execution release. Ask the designated operator or coordinator
for consequential missing inputs that accessible sources cannot settle.

Establish writing authority for both peers and delegation authority for the
host before pairing. Resolve a role that fixes one writer with that role's
owner; start the pair after its authority permits alternating writers. If
authority remains with one writer, report that unmet prerequisite and return
the task to its owner. Retain
formal review, publication and operator-acceptance gates. Peer agreement supplies
neither additional execution release nor independent formal review credit.

Give the companion the task, relevant operator prompts, governing sources and
identities, starting work snapshot, authorized deliverables, both peers' writing
scope, this skill's path, its record and scratch paths and the protocol's communication
and completion instructions. Name its task for the role and purpose, such as
“Implementation peer — commit validation”. Share existing proposals and settled
decisions with their standing intact; withhold the host's new assessment until
both initial positions are frozen.

Each peer independently records its reading of the objectives, completion
evidence, approach and consequential risks. Freeze and exchange those positions,
then explicitly agree on the approach and first small behavior to establish.
For larger work, retain the task's sequence and requirements across turns.

## Define the next check

A **check** names one small observable condition, its observation point or
artifact, the verification procedure and expected results before and after the
change. Use an executable test or command for code behavior. For non-executable
work, use a precise inspection of a named artifact and record the actual unmet
condition. Keep inspection judgments distinguishable from executable results;
task-wide satisfaction belongs in completion assessment.

Derive each check from an agreed requirement. Settle an open or disputed policy
interpretation together before encoding it in a deliverable, including a test.
A routine check of a settled requirement needs no separate approval exchange.
Choose the next smallest unmet behavior, prioritizing exposed defects. Keep
whole-task objectives and remaining requirements visible as the checks advance.

## Alternate coding turns

The host opens by writing the first check, observing its expected failure and
handing it to the companion. Each subsequent driver:

1. Confirms the received work state and check, then makes that check pass by
   adding only the behavior it requires while preserving behavior already
   correct in the received work, even if incidental or unchecked; other unmet
   requirements, even settled ones, wait for their own checks.
2. Runs the relevant previously passing checks and refactors while they pass.
   Repairs any working behavior its change broke within this turn, checked or
   not.
3. Writes the next check for behavior missing from the received work and runs
   it to establish the expected failure. Each of its failing assertions must
   also fail on the received work; repair any that would not before handing
   off. Prior checks must still pass, and a broken test setup is not the
   expected failure.
4. Records and sends the handoff, yielding editing control to the other peer.

A **coding turn ends at the handoff** of that observed-failing check. The opening
turn has no received check to make pass. When the received check and relevant
prior checks pass and the driver finds no unmet requirement, its handoff says
“no next check” and leads to the receiver's examination below. These are the opening
and closing cases of the same loop. Tests are substantive implementation work;
contribution requires no quota of production edits.

Keep the partner involved while driving: explain the current change and share
consequential discoveries and check results as they arise. The non-driver
examines the shared work and responds with reasoning, questions and proposed
next checks, writing only its own records. Driving or not, each peer keeps every
file it creates outside the shared deliverables, including check output and
temporary files, in its authorized record or scratch locations, as peer-review
directs. Both peers work on the same current behavior; their responsibilities
cover the whole implementation.

A handoff identifies the turn, current work, received check's passing result,
relevant prior check results, next check and observed failure (or “no next
check”), unresolved state and next driver. Retain the record before sending it.
The sender stops editing; the receiver acknowledges the identified state before
editing. Acknowledgment transfers control, not acceptance of the whole task.

Keep runtime identities fixed while driving alternates. Use Orca's blocking
ask/reply to keep the same companion: its handoff uses `ask`, and the host's
handoff answers the companion's pending `ask`. While not driving, the companion
keeps one `ask` pending and asks again after any reply that is not a handoff. While driving, it uses `send` for acknowledgment
and discussion, checks for host mail after each check run, and uses `ask` to hand
over. The host labels each reply as acknowledgment, discussion or handoff;
acknowledgment and discussion replies leave its own driving turn open. Follow
the current orchestration guide for commands and waits.

## Resolve obstacles within the current turn

State an obstacle and examine it together. If the check needs to be smaller or
corrected within scope, agree on the replacement, preserve the original
requirement and its status, and continue the same turn. Use this path for a
preexisting defect that prevents the required passing state. Send an external
or out-of-scope blocker to its owner and retain the paused turn and evidence.
A turn's ending condition does not guarantee a maximum duration; report a stall
when progress depends on a changed check or an unavailable prerequisite.

For a disagreement, pause the current turn's implementation and use peer-review's
paired discussion procedure: at most **three completed rounds per dispute**,
each containing both peers' responses to the same prior positions. Initial
positions count zero; preserve counts across continuations. Agreement resolves
the dispute and resumes the same driver's turn. Discussion rounds, escalation
and operator waits never complete or count as coding turns.

After three unresolved rounds, **both peers elevate to the human operator**.
Each states its position, shared facts, decisive difference and requested
ruling through its operator-facing channel. Where a worker's channel reaches
only its coordinator, that coordinator relays the worker's elevation unchanged
to the human alongside its own. Keep the turn paused for the human decision.
The operator may answer either peer: the recipient records the decision's exact
content and source, relays it, and obtains the other's acknowledgment before
dependent work resumes. Proposed changes to objectives, scope, architecture or authority
also go to their designated owner before dependent edits.

## Preserve state and establish completion

Retain compact working state outside tracked deliverables: source identities,
requirements and evidence, decisions, current turn and driver, check and work
identities, handoffs, unfinished work, disagreements with both positions and
round counts, pending operator questions and next action. Reconcile changed
governing sources before dependent work. Scale records to the task; reuse its
existing records where they supply this state.

On interruption or replacement, follow Orca's recovery and ownership rules.
Restore the current work, driver, pending check and discussion state before
resuming. Runtime uncertainty remains uncertainty; restore the pair before
claiming joint completion. Use context succession when authorized by the
calling task.

After a “no next check” handoff, the receiver examines the candidate. A remaining
gap becomes its next observed-failing check and handoff, resuming the loop.
If it finds no gap, it tells the sender only that examination is complete. Only
then does each peer independently assess every in-scope objective and
requirement as satisfied with evidence, unsatisfied or unverified. Freeze both
assessments before sharing their conclusions. Resolve gaps through the check loop and
refresh affected assessments against the resulting candidate.

Claim completion when both explicitly agree that the identified final candidate
meets all in-scope requirements with the required evidence. Otherwise report
the partial or blocked result, unmet requirement or missing proof and its owner.
Passing checks alone do not establish whole-task completion, and an unreleased
part of a plan remains outside the implemented scope.

Retain initial and completion assessments, handoffs, discussion and check
evidence, actual launch settings and the companion's final report. The companion
settles after its final required work and report; the host completes Orca cleanup.
Return the implementation location, objectives met, checks actually performed
and unresolved requirements or decisions to the calling task's next owner.
Operator acceptance and any commit, publication or landing retain their existing
authority and gates.
