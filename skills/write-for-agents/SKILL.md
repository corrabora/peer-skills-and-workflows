---
name: write-for-agents
description: Write or substantially revise prose that directs another agent's work, including skills, agent instructions, task briefs, handoffs, and operational sections of plans or specifications. Use even when writing is part of a larger task. Excludes code-only changes, mechanical text corrections, and explanations solely for people.
---

# Write for agents

Write instructions a fresh agent can execute with its promised inputs, existing
authority and a recognizable stopping point.

Before drafting, read [shared writing guidance](references/writing-guidance.md). Read the
governing sources and existing instructions. Load
[clarify-artifact](../clarify-artifact/SKILL.md) when the request and the
accessible governing sources leave a material choice about audience, purpose
or scope unresolved, or when the request contradicts an accessible governing
source; otherwise draft.

Load [write-for-humans](../write-for-humans/SKILL.md) for sections serving human
understanding or decisions. Use the engine's supported loading mechanism and
do not reinvoke a skill already handling its sections. For skill authoring, also
follow applicable skill-creation instructions and repository requirements.
Report a missing dependency by path and pause the work that needs it.

State the task, necessary inputs, result and scope. Give direct actions and
observable completion. State each obligation once: a completion check adds a
way to assess the result, not a second description of the task. Omit discarded
instructions and internal names the recipient never needs. At consequential
transitions, name the prerequisite and
what to report if it is missing. Carry accepted decisions and existing authority
forward; add no approval step unless the governing task requires one.

Keep each rule at one owner. For a required dependency, say when to load it,
where it resolves and what depends on it; load branch-specific detail only on
that branch. Keep a rule's conditions and exceptions together. Obtain changing
commands and configuration from their owners instead of copying them.

A handoff needs current state, exact work identity where relevant, accessible
evidence, unresolved dependencies and the next authorized action. Maintained
instructions need durable rules; omit the session's abandoned approaches and
investigation sequence. Spend detail on choices that affect execution rather
than mechanics a capable agent already knows.

Apply the shared editing pass. Walk the result with only the recipient's inputs,
including a relevant boundary or missing-input case: can it find the required
sources, act within authority and recognize completion? For each condition the
brief branches on, such as an exit status or file state, find where its source
defines the meaning. For undefined results, say “any other result: stop and
report it” rather than assigning a meaning. Trace prerequisites to the sources;
do not invent an input or approval gate. If a necessary prerequisite remains
unresolved, name it for the operator while continuing independent authorized
work. Routine implementation choices need no new approval. Check the whole
brief for contradictions with its own exceptions and permitted recovery paths.
Name the source for each statement a completion check assesses. Check a
step supplied by notes against those notes; cite a contract only for what it states.

Name the command's authoritative help or documentation. Include executable
instructions when the recipient needs them; verify that any recipe preserves
the task's inputs before its first write, including output, diagnostic and
promotion paths that alias an input. A help pointer or a post-run hash alone
does not establish preservation.

Run the execution and tool checks the governing authoring rules require.
Report inspection, mechanical validation and observed behavior distinctly in
the receipt or, for inline delivery, with the reply. Missing required proof
remains unverified. Authoring instructions does not execute them.

Before writing substantive explanation for the human operator, including what
verification covers or proves, load [write-for-humans](../write-for-humans/SKILL.md)
under the loading and already-handled rules above. If it cannot be loaded,
deliver only the independently completed artifact in its requested form, the
missing path, and bare check facts: each command actually run, its exit status
and the first stderr line, or “stderr empty” if empty. Mark unrun checks as
unrun and required proof still missing as unverified. Include no interpretation
of what checks cover or prove, even labeled raw or provisional: that explanation
would be used before its prerequisite was restored. Say the human explanation
is pending restoration of the missing path. Agent-only reporting does not
acquire this human-writing prerequisite.

For saved artifacts, reply with a [delivery receipt](references/writing-guidance.md#deliver):
where the result is, what is unresolved that changes its use, and what the user
must do. Add only requested explanations or governing mandatory reports.
