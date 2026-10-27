---
name: peer-review
description: Review any work with one fresh, read-only companion, debate as equal peers, and resolve agreed changes within existing authority. Use when asked to conduct a peer review of code, research, designs, plans, writing or other work. Does not replace a formal reviewer or adjudicator assignment.
---

# Peer review

Bring an independent perspective to the work at hand, reach principled agreement
where possible, and return unresolved choices to the operator. The calling agent
is the **host** and participates in the review; the fresh worker is its
**companion**. A companion assigned this skill follows the assessment and debate
instructions below without launching another peer.

This skill needs no plan, Git repository, workflow binding or review roster.
Keep the caller's existing ownership, communication and approval boundaries.
If its role cannot delegate or write, route those actions through the designated
owner. Peer agreement does not confer authority to implement, publish or land.

## Establish the review

Identify the work, the question the review should answer, governing requirements,
available evidence and the caller's writing authority from the request and
accessible context. Use the task's applicable quality profiles, rubrics or
acceptance criteria; do not impose this repository's planning process on another
kind of work. Ask only for a consequential missing input, through the caller's
designated communication channel.

Before writing the companion's brief, load `write-for-agents`; before assessments,
discussion responses or the operator report, load `write-for-humans`. For prose
being assessed or revised, also load the writing skill for its audience. Use the
engine's supported skill loader, or read the installed skill's `SKILL.md` when
that is the supported mechanism; these writing skills are sibling directories
in this package. Both peers must load their applicable skills before dependent
work. Name an unavailable dependency and pause only the work that requires it.

Before the first snapshot, record write or command that writes, establish the
record and scratch locations. Use locations the caller assigns; a record
directory is not also scratch unless assigned as both. For unassigned locations,
resolve this skill's real directory through any installation link, then use
`tools/peer-records.mjs` from the package two directories above it. Its `--help`
defines the workspace, Run and stable task identifiers; reuse an existing Run,
or retain a storage-only identifier without creating a Run merely for naming.

Run it first without `--storage`; it reports external roots and any local candidate.
For unassigned records,
if it reports a local candidate, use [bind-agent-workflow](../bind-agent-workflow/SKILL.md)
in **check** mode, or current check evidence the caller supplies for this
checkout. Only a check finding the binding current permits local selection;
rerun the resolver with `--storage local` to re-verify the mechanical facts.
Otherwise use its external records root. Retain the selection and its evidence.
Do not adopt or refresh a binding to obtain local storage. If inspection or
resolution fails, report the condition and pause only dependent work; an
explicit `--storage external` resolution can support independent work without
claiming missing guidance is available.

Use the selected locations for the whole task and give each peer its own
subdirectory of both roots. Preserve existing records at their published paths.
Keep evidence a result relies on in records; temporary files belong in scratch
and may be discarded. A later change to binding currency affects new selections,
not the locations already in use.
These locations hold records and scratch only; they grant no authority to change
the work.

Before runtime operations, load the installed `orchestration` skill and its
version-matched guide, including its launch preferences and messaging references.
It owns commands, Run ownership, blocking ask/reply, lifecycle and cleanup. Use
real Orca workers; an inline second assessment is not an independent peer.
Reuse the caller's Run when it owns one, otherwise establish the review's Run
under that guide without taking another coordinator's ownership.

Default to the opposite engine: a Codex host launches Claude; a Claude host
launches Codex. Use the selected engine's operator-configured model unless the
operator specifies another. Match the host's reasoning effort, using the
supported equivalent when labels differ. Explicit engine, model or effort
choices override their respective defaults; same-engine review is valid.
Obtain current launch settings and supported values from the runtime and engine
configuration. If the opposite engine, host effort or equivalent setting cannot
be established, report that specific gap and ask for the missing choice rather
than guessing. Record requested and observed engine, model and effort; a launch
mismatch or unobservable effective setting needs disposition before relying on
the review, not a silent substitution or duplicate launch.

Give both peers the same identifiable snapshot of the work and supporting
sources. For work without a durable revision, save a copy or manifest with
content identities in the selected review records outside tracked deliverables.
Include the relevant operator prompts, settled decisions, constraints, review
question and evidence limits. Keep the host's initial assessment out of the
companion's brief. Give the companion this skill's path, its read-only role,
accessible snapshot and source paths, its own absolute record and scratch paths, and the
communication and completion instructions. It may run checks that leave the
work unchanged; it may not change the work or delegate the review.

Each peer uses its authorized record or scratch locations for every file it
creates outside the work it may change. Before running commands or checks,
direct their outputs there, including probe scripts, captured command or
runtime output, fixtures and tool-created temporary files; set
temporary-directory variables such as `TMPDIR` as needed. Inspect
version-control state with read-only forms that leave its index unchanged
(for Git, set `GIT_OPTIONAL_LOCKS=0`). If required
outputs cannot fit that scope, report the constraint before running the
affected operation and continue independent work. Retain evidence of any
departure and report its paths and effects; cleanup does not erase it.

Name the companion's task so its role and purpose are visible in Orca, such as
"Peer reviewer — retry behavior" or "Peer reviewer — research summary". Honor an
operator-supplied name and include the review purpose in the task title when the
name alone does not identify it; verify the visible title after launch.

## Assess independently

Launch one fresh companion. Each peer inspects the work against its actual
requirements, investigates consequential claims and records an initial assessment
before reading the other's. The host's familiarity with its own work is not a
second independent worker; describe the pair truthfully as host and companion.
Freeze both initial assessments before exchanging them. The companion reports
its path and waits through Orca's blocking ask/reply mechanism rather than ending
its task before the discussion.

For each finding, identify the relevant requirement, observed issue, consequence,
support and recommended action. Separate a demonstrated defect, missing evidence,
an unresolved decision and a preference. Use the task's severity scheme where
one applies. A clean assessment is valid; neither peer must manufacture findings.
Missing evidence remains a limitation rather than a pass.

## Discuss as equals

Map duplicate findings while preserving both sources and positions. Exchange
the full frozen initial assessments. Neither peer has a casting vote or owes
deference to the other. Engage the argument and evidence, revise a position when
warranted, and explain the change. Agreement means explicit assent by both to
the same resolution and rationale; silence, timeout or the host's preference
does not establish it.

For each disagreement, allow at most **three completed discussion rounds**. A
round consists of both peers responding to the same prior pair of positions.
The host freezes its response before reading the companion's new response, then
shares the completed pair for the next round. Ask the companion to respond only
to the prior pair; withhold the host's new response until the companion's is
frozen. Sending the host's response as the prompt for the companion's response
does not produce a paired round. Initial assessments count zero;
confirming agreement needs no invented debate. A missing response is incomplete,
not a completed round or agreement. Follow the runtime's recovery procedure.

If disagreement remains after three rounds, stop that exchange and bring the
issue to the operator with both recommendations, shared facts and disputed
premises. Proposed changes to objectives, scope or architecture also need
operator disposition even when both peers agree. Present open choices one at a
time, through the designated channel, while preserving unrelated authorized
work. Give concise progress summaries during the debate. New issues retain their
own identities; a continuation or replacement preserves existing round counts
and positions instead of restarting the allowance.

## Integrate and return

Apply mutually agreed changes automatically when the host already has writing
authority covering them. Route changes to the existing writer when another role
owns them. A read-only assignment remains read-only, and formal review or other
approval gates still apply. Operator decisions about changed boundaries precede
dependent edits; peer review supplies no formal rotation credit or review release.

Apply changes at completed discussion checkpoints, keeping each assessment tied
to the snapshot it actually reviewed. Identify the revised work, run applicable
checks and have the companion inspect the affected changes before claiming that
it verified the integration. Do not quietly alter a snapshot under assessment
or attribute unreviewed later changes to an earlier agreement.

Preserve the assessed revision, both positions, agreed actions, remaining choices,
round counts, actual launch settings and supporting evidence in the selected records.
The companion freezes its final report, follows the live preamble to settle its
task and stops. The host preserves that report and completes cleanup through
`orchestration` before ending the review. If work is interrupted, retain the
pending question and current state rather than claiming completion.

Return a concise result naming what was reviewed, what was changed or recommended,
the checks actually performed and any decision or evidence gap that remains.
Link retained detail when useful. Finish when the review and authorized agreed
changes are accounted for and remaining choices are clearly with their owner;
return control to the calling task without starting a formal review or unrelated
work.
