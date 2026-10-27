# Repository quality rubrics

These rubrics turn the [skill authoring guidance](../skill-authoring-guidance.md)
into assessable requirements for work on this repository's skills. They extend
the repository's installed quality-profiles; they neither replace those
profiles nor impose this repository's authoring practices on projects that
use the workflow.

The guidance explains purpose and rationale. These rubrics own the local
obligations, applicability conditions and pass boundaries. They use the
installed profiles' [scenario and evidence approach](../../.quality/profiles/core-qualities/scenarios-and-measures.md).
An example or evidence prompt suggests how to assess an obligation; it does not
create another obligation by itself.

## Selection for skill work

The [repository README](../../README.md#quality-for-this-repository) selects this
extension alongside the profiles selected by `.quality/config.json`. Selection
uses the existing repository-local guidance mechanism in
[the review contract](../../workflow/REVIEW.md#sets-and-seats). A person or
coordinator performs selection from the task scope. The Markdown files are the
maintained local authority; no generated profile is required.

At planning and review, inspect the objective and full candidate change, then
select all sixteen local clauses when the work creates, changes or evaluates
a skill or its effective behavior. This includes:

- Skill instructions, descriptions, invocation metadata and engine adapters.
- Shared workflow references, templates and dispatch instructions consumed by
  skills, including changes outside the skill directory.
- Tools or configuration that determine skill discovery, loading, permissions,
  task inputs, outputs or completion.
- Operator documentation that changes how a skill is selected or used.

Follow changed dependencies to their consuming skills. A filename alone does
not determine scope. Select the whole local roster for a mixed change with a
skill component, then assess each clause against the relevant subject and
branch. Work with no effect on skills, such as unrelated package maintenance,
does not acquire these obligations merely because it is in this repository.
If that effect cannot be established, record the selection uncertainty and
resolve it before claiming complete coverage.

A spelling correction can be assessed by inspection. A rubric-only or
research-only change needs assessment of its own content and any policy it
changes; it does not require executing every skill it discusses. Selection
does not make every clause applicable or require the same evidence for every
edit. An existing skill's full task contract supplies context, but this
extension does not expand a scoped task into a catalog-wide rewrite.

## Rubric roster

| Rubric | Stable clause IDs | Authoring rules covered |
| --- | --- | --- |
| [Purpose and selection](skill-purpose.md) | `AW-SK-PS1`–`AW-SK-PS4` | 1: task boundary; 2: selection description; 7: vocabulary; 11: composition |
| [Context and instructions](skill-context.md) | `AW-SK-CT1`–`AW-SK-CT4` | 3: required loading; 4: reading paths; 9: behavioral value; 10: authoritative facts |
| [Execution and control](skill-execution.md) | `AW-SK-EX1`–`AW-SK-EX4` | 5: completion; 6: prerequisites; 8: boundaries and next actions; 12: questions |
| [Evidence and evolution](skill-evidence.md) | `AW-SK-EV1`–`AW-SK-EV4` | 13: artifact lifetime; 14: useful outputs; 15: tools and policy; 16: observed use |

The IDs identify this repository's clauses independently of filename, title,
reviewer or round. Keep them stable when editing wording; a change in obligation
must be explicit in the change's description and coverage assessment. The four
documents are thematic groupings, not assignments to review sets A–D. The
coordinator allocates each selected local clause exactly once alongside the
installed obligations and records its source. Reference-only profiles remain
reference context under the existing inheritance rules.

## Assessment and findings

For each allocated clause, identify its subject, applicability and evidence.
Record one of these outcomes using the existing coverage table:

- **Applicable and compliant:** evidence establishes the stated pass boundary
  for the identified subject and conditions.
- **Applicable and noncompliant:** evidence demonstrates a failure; cite the
  clause and report its practical consequence.
- **Inapplicable:** explain which applicability condition is absent.
- **Indeterminate:** identify the unresolved fact or insufficient evidence;
  do not convert uncertainty into a pass or a failure by assumption.

Use the existing [finding format, severity and proof rules](../../workflow/REVIEW.md#finding-format).
There is no numeric score or average that can compensate for a failed clause.
Severity follows the actual consequence, not the rule number or a preferred
writing style. When a local clause and an installed clause describe the same
failure, retain both source identities in one issue where appropriate rather
than counting it twice.

Choose the earliest evidence that can establish the claim: inspection,
analysis, a deterministic check or a representative execution. Record the
candidate and source identities that the evidence covers. A metadata validator
can establish structural validity; it cannot establish correct selection or
runtime behavior. Evidence against an earlier candidate remains evidence about
that candidate until its relevance to the changed subject is established.

The behavioral proof requirement for materially changed skill behavior is
defined in [AW-SK-EV4](skill-evidence.md#aw-sk-ev4).
Other evidence prompts do not independently mandate additional execution.
Missing required proof follows the workflow's blocker and finding procedure;
an optional assurance gap remains a coverage gap. This distinction prevents
the rubric from turning every minor edit into a full multi-engine exercise.

## Proportionality and maintenance

Assess whether the intended behavior is clear, reachable, authorized and
supported. Do not fail a skill solely for its length, headings, use of a
negative sentence, number of references or lack of a particular template.
Longer instructions and repeated reminders can be justified by the task and
observed behavior. Neither a new skill nor a new tool is required when an
existing mechanism suffices.

When revising these rubrics, keep their obligations aligned with the guidance,
preserve the sixteen-rule mapping above, and distinguish a clarified assessment
from a newly required behavior or proof. Keep the extension repository-local;
adopting it elsewhere is that repository's decision.
