---
name: write-issue
description: Write or substantially revise issue titles and bodies for bugs, proposed changes, and exploratory work, including acceptance criteria. Use when preparing issue text, including within a larger task. Does not perform triage, implementation, or plan decomposition; mechanical text corrections do not need this skill.
---

# Write an issue

Give the next reader enough context to understand the problem and take the
intended next action. Produce the issue's title and body in the requested
destination; the calling task owns publication and subsequent work.

## Establish the work

Read the target repository's applicable contribution guidance and any issue
template that applies. For an existing issue, read its body and relevant
discussion, including accepted clarifications. Read supplied evidence and the
affected contracts, decisions and vocabulary as needed. Establish whether the
issue reports a problem, requests an agreed change, or seeks investigation or
a decision. Do not turn a proposed solution into an accepted requirement.

Before drafting, load [write-for-humans](../write-for-humans/SKILL.md) through
the engine's supported mechanism. For sections directing an agent's work,
also load [write-for-agents](../write-for-agents/SKILL.md); do not reinvoke a
skill already handling its sections. Those skills own prose and consequential
clarification. If a required source or skill is unavailable, name its path or
reference and what it prevents; continue independent work without drafting
the dependent claims.

## State the problem and completion

Use a title naming the observable problem, intended outcome or question. Lead
the body with that subject and why it matters. Include only the context needed
to act, preserving necessary constraints and genuine dependencies. Follow the
repository's required structure; otherwise use only the sections the issue
needs.

For a bug report, describe the trigger, expected and observed behavior,
relevant environment and reproduction evidence. Distinguish the reporter's
account from a reproduction actually performed. Keep suspected causes as
hypotheses; a useful report need not already identify the cause or fix.

For implementation work, write acceptance criteria (ACs) as observable outcomes
that repeatable tests can demonstrate. Preserve agreed interfaces, values,
edge cases and scope boundaries. Describe the necessary behavior without
prescribing routine implementation choices. Give each criterion a clear
reference, retaining existing identifiers or numbering, so later changes and
evidence can account for it without changing its meaning.

For exploratory work, define the question, bounded investigation, evidence
needed and deliverable that finishes it. Criteria assess that work and its
supported conclusion; they must not require a preferred answer, an assumed
cause or an unagreed implementation. An inconclusive result can complete the
investigation when the agreed work was performed and its evidence and remaining
uncertainty are explained. Keep any resulting implementation proposal distinct
from the investigation's completion criteria.

Distinguish an inconclusive conclusion from incomplete agreed work. Missing
prerequisites or incomplete required evidence leave the affected criterion
unmet; do not invent an exception that relaxes the investigation's scope.

When completion criteria are unsettled, expose the decision needed instead of
inventing agreement or marking the issue ready for implementation. Preserve
the source issue's scope when revising; report a proposed scope change as such.

## Check and deliver

Read the issue as a fresh recipient: can they identify the intended next
action, its constraints and how completion would be demonstrated? Check the
criteria against the source request and evidence, and distinguish dependencies
from merely related work. Keep evidence references accessible to the issue's
readers; a local scratch path is not a usable tracker attachment.

Deliver the requested title and body, with unresolved facts that change their
use visible. Drafting does not label, assign, close or publish the issue, or
authorize the work it describes. Return to the calling task with its existing
authority intact.
