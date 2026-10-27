# Skill authoring guidance

Write the smallest set of instructions that makes the intended behavior
dependable. This guide explains authoring choices; [docs/qualities](qualities/README.md)
owns this repository's obligations and pass boundaries. The sixteen rules below
retain that mapping. Follow [shared writing guidance](writing-guidance.md) when
selecting and editing the prose.

## Authoring rules

### 1. Define the behavioral improvement and the task boundary

State the contract: given which inputs, the agent produces what result, under
which constraints, for whom? For a revision, name the behavior that needs to
change. Split independently useful jobs only when their inputs, ownership or
stopping points differ; complexity alone does not require another skill.

### 2. Write descriptions to support selection

Name the job and its meaningful trigger. Add an exclusion only to prevent a
likely routing mistake, such as confusing a dispatched review with an informal
explanation. Keep stages and configuration in the body. Check an intended
request and a neighboring request that should not select the skill.

### 3. Make required reading an explicit action

A required pointer names when to load a source, how to resolve it and what
work depends on it. State what to report if it is unavailable. Distinguish
reading a reference from invoking a skill, use the engine's supported mechanism
and respect invocation restrictions. A related-links list is not a loading
instruction.

### 4. Organize instructions around the current stage and branch

Keep common prerequisites before dependent work. Load substantial conditional
material only at the branch that needs it. Keep each concept's definition,
conditions and exceptions together. Evaluate the whole reading path: splitting
a file saves little when every task still loads every part, and too many
pointers can obscure one coherent action.

### 5. Define completion through observable results

Specify what must be established, with enough evidence for the recipient to
assess it. A bounded question and its proof are more useful than “investigate
thoroughly.” Allow honest incomplete or blocked results with the missing
dependency named; distinguish failure, inapplicability and unproven claims.

### 6. Protect prerequisites from premature advancement

Make consequential transition conditions explicit, especially where a tempting
later action could displace required investigation or proof. Strengthen the
completion condition before splitting contexts. Use separate workers when
ownership or independence requires them; another inline skill call creates no
independence. Preserve the workflow's existing role boundaries.

### 7. Use familiar terms and define important distinctions once

Prefer established vocabulary. Define a local concept at its owner when its
meaning changes behavior. For example, acceptance and execution permission need
a real distinction, not merely two labels. Avoid names that cost more explanation
than they save.

For a demonstrated recurring miss, define the rule at its owner and repeat its
one-sentence test at the relevant transition, rather than only its name.
Choose placements from observed reading and action traces; a reminder should
be usable without following its link again. This adapts
[Pocock’s leading words](https://github.com/mattpocock/skills/blob/49dd158d1076134a641b33efb035946536778336/skills/productivity/writing-for-agents/SKILL.md#leading-words):
compact concepts repeated to invoke their meaning. Trace-informed placement is
our adaptation; neither the source nor reading order proves a causal effect.
Compare the rule alone with the same rule plus reminders on matched tasks, checking
that necessary meaning survives.

### 8. State the correct action alongside essential boundaries

Give an agent a permitted next step at a limit: report missing evidence and
pause the dependent judgment. State mutation, communication and ownership
boundaries where needed. A concise prohibition is useful when it protects a
real constraint; positive phrasing is a clarity technique, not a reason to
remove safeguards. Phrase a reply requirement as its affirmative shape, in
order and length, with its necessary exceptions at the same owner.

### 9. Edit for behavioral value

Apply the shared editing pass to these instructions and their loaded references.
Keep a sentence only if it changes a decision, action or interpretation needed
for the task. Then test its phrases and words for necessity. Remove process
narration, generic encouragement, repeated framing and instructions already
owned elsewhere. Preserve useful complete prose, necessary exceptions and proof
obligations. For a disputed deletion, name the behavior at risk and test it;
shorter text alone proves no improvement.

### 10. Obtain changing facts from their authoritative source

Resolve commands, configuration and repository obligations from their owners
instead of copying them into every role. A reproducible comparison may need a
snapshot; record its source identity and scope separately from reusable policy.
Do not silently substitute current material for a task's pinned basis.

### 11. Compose behavior around clear ownership

Give shared policy one maintained home. Use a reference for definitions and a
skill for an independently useful active task. Reuse existing procedures with
explicit loading instructions. Keep a short reminder near an action only when
it prevents a consequential mistake; do not maintain a second version of the
rule. Extra entry points must earn their discovery and navigation costs.

### 12. Ask questions when their answers become useful

Inspect accessible facts and settled answers first. Ask the user, or designated
coordinator, for the smallest unresolved choice needed next. Explain what it
changes and recommend an option when supported. Resolve dependent questions in
order; continue independent authorized work. A missing consequential answer
stays unresolved, while existing authorization needs no repeated approval.

### 13. Give each artifact a purpose, owner and lifetime

Separate maintained guidance, run records and disposable scratch. Preserve a
settled result and necessary rationale at their owner; record investigation
history only when that history serves the artifact's purpose. Retain support
for as long as the result depends on it. Create no empty scaffolding or second
policy source, and never make durable meaning depend on temporary files.

### 14. Design outputs around evidence and decisions

Require only content the recipient needs to assess or act: the result, necessary
support, consequential uncertainty and pending decisions. Use fields where they
make required work visible, not to manufacture completeness. Preserve substantive
disagreement and permit truthful unknown or unproven outcomes. Link retained
detail instead of pouring it into every summary. Templates must not induce
invented facts or routine filler.

### 15. Put repeatable mechanics in tools and judgment with its owner

Use reliable existing mechanisms for parsing, validation, resolution and runtime
operations. Add a helper only for a demonstrated need. Keep the authority and
meaning of a tool result in the governing instructions; structural validation
cannot prove agent behavior, and a runtime limit cannot redefine role policy.

### 16. Improve skills through observed use

State expectations before trials, then inspect outputs and traces for correctness,
loading, missing inputs, questions, retries and usable completion. Cover the
changed path and relevant boundaries on affected engines as
[AW-SK-EV4](qualities/skill-evidence.md#aw-sk-ev4) requires. Retain inputs,
source identities, actual settings, failures and limits. Compare equivalent
old/new runs before claiming improvement; word counts are supporting evidence.
Capture the engine harness's accessible closing-message instructions and actual
launch settings before attributing a reply shape to the skill. If the complete
prompt is inaccessible, record that limit; do not substitute a model's account
of it. A diagnostic prompt replacement changes the harness and cannot prove
normal-harness compliance or isolate a sole cause.
Fix the smallest responsible owner without weakening required proof.

## Scope of adaptation

Repository guidance and selected quality profiles own project obligations.
Personal skills may help satisfy them without requiring other contributors to
adopt the same tools. Writing improvements alone do not authorize changes to
implementation, review, adjudication or operator ownership.

The [research report](research/matt-pocock-skill-writing.md) attributes the
influence of Matt Pocock's work and records its evidentiary limits. Apply its
lessons through observed behavior rather than importing unrelated workflows.
