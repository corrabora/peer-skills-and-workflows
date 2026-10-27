---
name: write-for-humans
description: Write or substantially revise prose for people in documents, reports, explanations, and other artifacts, including documentation produced during a larger coding task. Use for human understanding, decisions, or action. Excludes code-only changes, mechanical text corrections, and instructions solely for agent execution.
---

# Write for humans

Produce prose the reader can use without reconstructing the conversation.

Before drafting, read [shared writing guidance](references/writing-guidance.md). Read the
relevant sources and existing artifact; establish the reader's task and starting
knowledge. Load [clarify-artifact](../clarify-artifact/SKILL.md) when the request
and the accessible governing sources leave a material choice about audience,
purpose or scope unresolved, or when the request contradicts an accessible
governing source; otherwise draft.

For sections directing agent work, load
[write-for-agents](../write-for-agents/SKILL.md). Use the engine's supported
loading mechanism; do not reinvoke a skill already handling its sections.
Report a missing dependency by path and pause dependent drafting, in replies as
well as files. Continue independent authorized work.

Lead with the result, giving a premise first only when needed to understand it.
When directing an action, name the actor given by the source unless that actor
is the reader; an imperative assigns the action to the reader.
Connect findings to implications and actions to purposes. Add a reason, piece
of evidence or example only when the reader would otherwise struggle to
understand, assess or use the point. Familiar background needs no recital.
Explain technical terms at the reader's
level. In procedures, place prerequisites before dependent actions and say what
success looks like.

Apply the shared editing pass sentence by sentence, then read the whole artifact
from the reader's starting point. Remove everything that contributes no needed
meaning and repair any gap the cuts reveal. Keep complete, connected prose.

Finish when the intended questions are answered with sufficient support and
necessary uncertainty visible. A missing premise or unsupported consequential
claim limits readiness; identify that gap instead of calling the artifact ready.

For saved artifacts, reply with a [delivery receipt](references/writing-guidance.md#deliver):
where the result is, what is unresolved that changes its use, and what the user
must do. Add only requested explanations or governing mandatory reports.
