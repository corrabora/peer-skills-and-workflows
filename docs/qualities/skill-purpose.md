# Skill purpose and selection

A skill has a recognizable job, can be selected for that job, and fits coherently
with the other skills and references it uses. Apply these clauses through the
[selection and assessment contract](README.md).

## AW-SK-PS1

**A bounded task produces a useful result.** The skill identifies its inputs,
intended result, recipient and responsibility boundary sufficiently to tell
whether an assignment belongs to it and when its work ends.

- **Applies when:** a skill's job, assigned role or task boundary is created,
  changed or evaluated, including changes in a shared workflow definition.
- **Pass boundary:** a reader can describe the task contract without inventing
  missing scope. The instructions lead to that result and preserve responsibility
  for work owned by another role. Distinct branches have recognizable inputs
  and stopping points; demanding investigation can remain one coherent job.
- **Scenario:** assign the intended task, then an adjacent task such as fixing
  what an assessment finds. Determine which work belongs to this skill and
  where the result goes next.
- **Evidence:** inspect the task contract and caller's assignment together.
  For changed behavior, observe the relevant result and stopping point under
  the proof rules in `AW-SK-EV4`. Do not require one skill per procedural step.
- **Guidance:** [Rule 1: task boundary](../skill-authoring-guidance.md#1-define-the-behavioral-improvement-and-the-task-boundary).

## AW-SK-PS2

**Descriptions and invocation paths select the intended work.** The visible
description states the job and meaningful trigger, and the supported invocation
path reaches the skill for its intended caller.

- **Applies when:** a description, entry point, invocation policy, installation
  rule or dispatch path affecting skill selection is created, changed or
  evaluated.
- **Pass boundary:** an intended request or dispatch selects and reaches the
  skill; a neighboring request does not incorrectly acquire its workflow.
  Description, invocation controls and role assignment agree in each affected
  supported engine. Discoverability, loading and execution authorization remain
  distinct; selecting a skill grants no additional authority.
- **Scenario:** compare an assigned review with an informal request to explain
  review practices. Also check a deliberately restricted entry point through
  its intended caller rather than assuming it is universally available.
- **Evidence:** inspect descriptions and invocation settings, then exercise
  materially changed routing in the affected engines. Record actual selection
  and loading, not just a successful metadata validation.
- **Guidance:** [Rule 2: selection descriptions](../skill-authoring-guidance.md#2-write-descriptions-to-support-selection).

## AW-SK-PS3

**Vocabulary preserves distinctions that affect behavior.** Established terms
are used consistently, and necessary local concepts have a clear owning
definition available before the agent relies on them.

- **Applies when:** instructions, reports or interfaces introduce, change or
  rely on terms whose interpretation affects a skill's work.
- **Pass boundary:** the same concept has the same meaning across relevant
  instructions and handoffs. A reader can distinguish concepts such as candidate
  identity, acceptance and execution permission. New terms convey a useful
  distinction rather than merely renaming an existing concept.
- **Scenario:** trace one consequential term from assignment through execution
  to report, including any engine adapter or human-facing explanation.
- **Evidence:** compare definitions and uses; identify the concrete ambiguity
  and its consequence if they disagree. Familiar phrasing is acceptable without
  a glossary when no important meaning is left uncertain.
- **Guidance:** [Rule 7: vocabulary](../skill-authoring-guidance.md#7-use-familiar-terms-and-define-important-distinctions-once).

## AW-SK-PS4

**Composition has clear owners and useful entry points.** Shared behavior has
one maintained policy owner, and each skill entry point corresponds to a
recognizable active task rather than a passive reference alone.

- **Applies when:** work adds or splits a skill, extracts a shared reference,
  changes an invoked dependency, or changes ownership among consumers.
- **Pass boundary:** the owning rule and its consumers are identifiable. The
  composition supplies the intended behavior without contradictory copies or
  an unresolved invocation path. Role-specific responsibilities remain easy to
  find. A new entry point has a useful trigger and result; an existing skill or
  plain reference may satisfy the need.
- **Scenario:** change one shared policy and trace every consumer that must see
  it. Compare the work of following the extracted reference with understanding
  the same coherent task in place.
- **Evidence:** inspect ownership, references and entry points. Distinguish a
  short reminder from an independently maintained policy copy. Assess coupling
  to project practices: this package's personal workflow must not silently
  become a requirement for unrelated contributors.
- **Guidance:** [Rule 11: composition](../skill-authoring-guidance.md#11-compose-behavior-around-clear-ownership).
