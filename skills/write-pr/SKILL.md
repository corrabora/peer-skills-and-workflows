---
name: write-pr
description: Write or substantially revise pull request titles and descriptions from the actual change and its verification, accounting for associated issue acceptance criteria. Use when preparing PR text, including within a larger task. Does not perform code review, implementation, or merging; mechanical text corrections do not need this skill.
---

# Write a pull request

Give a reviewer the problem, resulting behavior and evidence needed to assess
the proposed change. Produce the title and body in the requested destination;
the calling task owns publication and integration.

## Establish the change

Read the target repository's applicable contribution guidance and any PR
template that applies. Establish the repository, comparison base and proposed
revision from the task or accessible repository facts; inspect the complete
relevant diff rather than assuming the last commit is the whole change.
Supplied comparison artifacts may provide this evidence. Read the existing PR
when revising it, and inspect verification records against the revision they
actually cover.

For each associated issue, read its body, acceptance criteria (ACs), relevant
discussion and accepted clarifications. Preserve the governing criteria and
their identifiers. A disagreement between the issue, change and evidence must
remain visible until resolved; describing the PR does not authorize rewriting
the issue to fit the implementation.

Before drafting, load [write-for-humans](../write-for-humans/SKILL.md) through
the engine's supported mechanism; do not reinvoke it when already handling
the prose. It owns writing and consequential clarification. If a required
source or skill is unavailable, name its path or reference and what it
prevents; continue independent work without claiming the missing comparison
or acceptance coverage was established.

## Explain and substantiate

Write the title and opening around the concrete problem and final resulting
behavior. Include the rationale needed to assess the approach. Follow the
repository's title convention and template; a commit convention applies to
PR titles only when the repository makes that connection. Update stale text
when the change's scope has evolved.

For an associated issue, account for every AC. Connect each claimed
satisfaction to the behavior in this change and the evidence that demonstrates
it. Identify partial work, unmet criteria and missing proof explicitly. Use a
compact table when several criteria need tracking:

| Issue AC | Change and completion status | Evidence and result |
| --- | --- | --- |

For a single criterion, a paragraph may make the same connection. Preserve
access to the criterion's full meaning rather than weakening it in the
summary. One test may support several criteria; one criterion may require
several tests. A green suite alone does not establish which ACs it proves.

For test evidence, identify the relevant test or reproducible command, observed
result, and revision or retained run it covers. Check that the test demonstrates
the claimed behavior. Reuse relevant retained evidence from the producing
workflow; this skill prescribes no orchestrator and does not require rerunning
unchanged checks solely to write the PR. Stale or unrelated results cannot
establish current satisfaction. Distinguish checks run from checks proposed.

For exploratory ACs, connect the bounded investigation and its deliverable to
the findings, experimental evidence or repeatable checks that support them.
An inconclusive investigation can satisfy its agreed criteria without proving
a cause or delivering a fix. For a PR with no associated issue, explain the
change and its relevant verification directly; do not manufacture an issue or
an acceptance checklist.

Include compatibility, migration, rollout and reversal consequences when they
affect review. Add a before/after example or visual when it clarifies the
change. Keep file inventories, investigation history and generic risk fields
out unless the reviewer needs them or the repository requires them.

## Check and deliver

Compare the final title and body with the issue scope, full diff and cited
evidence. Make any unaccounted change or unresolved discrepancy visible. Use
closing language only when the PR fulfills the issue's completion criteria;
reference an issue without promising closure when work or proof remains.

Link evidence at destinations the PR's readers can access. Local comparison
and evidence snapshots supplied for drafting are inputs, not published
attachments; use their retained URLs, or name a missing publishable reference.
Deliver the requested text with material limits visible.
Drafting does not submit, approve or merge the PR. Return to the calling task
with its existing authority intact.
