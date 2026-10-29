---
name: record-decision
description: Record or revise project decisions as concise ADRs, or migrate existing records when asked. Offer a new ADR only for a costly-to-reverse, surprising choice with a real trade-off. An explicit request to document a decision also selects this skill; routine implementation and reading decisions alone do not.
---

# Record a decision

Preserve a choice, its context, rationale and consequences so a future
contributor can revisit it without reconstructing the discussion. Recording
grants neither acceptance nor implementation permission.

## When to offer an ADR

Before offering a new record, establish all three:

- Reversing the choice later would have meaningful cost.
- Without its context, a reasonable future reader would question the choice.
- Genuine alternatives existed, with a material benefit sacrificed for another.

For example, retaining a synchronous audit acknowledgement despite its latency
can qualify when loss of evidence is unacceptable and changing the service
contract later would be expensive. A database choice can qualify when its
lock-in buys a needed capability that explains an otherwise surprising choice.
Neither “architecture” nor a technology name alone passes the test.

Skip routine reversible library choices, obvious implementation steps, progress
updates and facts already owned by a contract or configuration. Adding a
required validation check or listing workspace members needs no ADR. Keep
necessary detail at its owner. If nothing qualifies, return to the task;
explain the skip briefly when the user asked for an assessment.

This screens unsolicited offers. Honor an explicit documentation request or
repository recording requirement without making the user justify it again.

## Establish and write

Read relevant repository guidance, existing decisions and the affected contract.
Find amendments before adding a second account of the same choice. Establish
what was chosen, why, and whether it is accepted, proposed or uncertain from
available sources; code alone proves no acceptance. Ask the operator or
coordinator only for a missing fact or decision that affects the record.

Before writing, read [ADR format](references/adr-format.md). Load
[write-for-humans](../write-for-humans/SKILL.md) through the engine's supported
mechanism for the prose. If existing records or controlling instructions differ
from the format, or migration is requested, also read
[record format adoption](references/record-format-adoption.md).
If a required dependency is unavailable, pause dependent drafting in replies
and files. The reply names the missing path, what it blocks and any independent
work done; it contains no dependent entry, layout or definition, even as an
example. Continue independent authorized work.

Establish the format's required content before applying the writing skill's
editing pass. Preserve material alternatives, costs, qualifications and change
relationships; cut repetition rather than decision information. Missing evidence
stays explicit. Keep implementation detail at its owner unless it is necessary
to understand the choice or its guarantee.

For a correction, preserve meaning and standing. For a changed decision, follow
the format's revision rules; an unaccepted replacement leaves the current
decision in force. Re-read before editing to preserve intervening work.

Write within the task's authority and designated writer ownership. An authorized
recording task needs no repeat approval; discussion-only work returns a draft.
Recording does not authorize the work described or migration of other records.

## Finish

Check the record against its sources for preserved meaning and actual standing.
Follow the format's numbering and index checks; reconcile affected references
within scope. A narrow correction does not authorize migrating legacy neighbors.
The receipt carries unresolved rationale or standing and the pending number
check, one sentence each. For an inline draft, include those qualifications
with the requested prose.

For saved artifacts, reply with a [delivery receipt](references/writing-guidance.md#deliver):
where the result is, what is unresolved that changes its use, and what the user
must do. Add only requested explanations or governing mandatory reports.
Return to the originating task.
