# Skill execution and control

A skill advances on established prerequisites, acts within its responsibility,
and gives the operator a useful role in unresolved decisions. Apply these
clauses through the [selection and assessment contract](README.md).

## AW-SK-EX1

**Completion is observable and permits truthful incompleteness.** Each meaningful
stage states the result and evidence needed to finish, including how to report
a blocked or partial result.

- **Applies when:** work defines or changes a task, stage, completion criterion
  or completion report.
- **Pass boundary:** the recipient can distinguish complete, failed, partial,
  inapplicable and unresolved outcomes where those states are relevant. The
  criterion demands the work required by the task and identifies its subject.
  A completion claim does not exceed the supplied evidence.
- **Scenario:** give the agent complete inputs, then omit one necessary fact or
  proof. Determine whether its report and next action preserve the distinction.
- **Evidence:** inspect criteria against task obligations and example outputs;
  for changed behavior, observe a normal result and the relevant incomplete
  case. Broad encouragement to be thorough cannot supply a missing criterion.
- **Guidance:** [Rule 5: completion](../skill-authoring-guidance.md#5-define-completion-through-observable-results).

## AW-SK-EX2

**Transitions preserve prerequisites and required independence.** Downstream
work begins only when its actual dependencies are satisfied, and separated
roles receive information consistent with their responsibilities.

- **Applies when:** work changes sequencing, stage gates, dispatch dependencies,
  assessment visibility or worker/context boundaries.
- **Pass boundary:** a missing prerequisite blocks the work that depends on it.
  Independent work can continue within existing authorization. Required
  independent assessments remain independent; splitting a document or loading
  another skill in the same context is not represented as context isolation.
  New worker boundaries have a concrete ownership or behavioral purpose.
- **Scenario:** provide a tempting downstream task before its required proof,
  or make a peer conclusion available before an independent assessment.
- **Evidence:** inspect dependencies and visibility rules; observe the affected
  transition or information boundary when materially changed. Account for
  context-transfer costs without weakening independence to save startup time.
- **Guidance:** [Rule 6: prerequisites](../skill-authoring-guidance.md#6-protect-prerequisites-from-premature-advancement).

## AW-SK-EX3

**Boundaries identify the permitted next action.** Instructions preserve role
ownership and execution authority and explain how the agent proceeds or reports
when it reaches a meaningful limit.

- **Applies when:** a skill may mutate artifacts, delegate, disclose assessment
  material, communicate decisions or advance work under authorization.
- **Pass boundary:** the agent can identify its allowed actions, stop boundary
  and escalation recipient. A recommendation or peer agreement cannot silently
  grant execution permission. Existing authorization remains usable within its
  scope. Restrictions have a practical response where one is needed; essential
  prohibitions remain explicit even when affirmative wording is also used.
- **Scenario:** contrast an accepted recommendation with no execution release
  and a next step already covered by a bounded authorization.
- **Evidence:** trace authority from instruction to task and result. Exercise
  materially changed boundaries through the affected engines. Do not grade the
  presence of the word “not”; assess whether the next action is correct.
- **Guidance:** [Rule 8: actions and boundaries](../skill-authoring-guidance.md#8-state-the-correct-action-alongside-essential-boundaries).

## AW-SK-EX4

**Questions respect available knowledge and decision dependencies.** The skill
uses accessible facts and established answers, then asks the appropriate person
or coordinator for the decisions or unavailable facts needed to proceed.

- **Applies when:** work changes discovery, interviewing, clarification,
  escalation, continuation or communication with an operator.
- **Pass boundary:** questions are relevant to unblocked decisions, preserve
  settled answers and expose consequential assumptions. A worker uses the
  designated communication owner. Required answers precede dependent action;
  unanswered questions do not stop unrelated authorized work or become assumed
  approval with elapsed time.
- **Scenario:** supply an answer in retained guidance, leave a separate decision
  unresolved, and include another choice that depends on that unresolved one.
- **Evidence:** inspect the discovery and questioning sequence or a relevant
  trace. Identify avoidable repeated questions, an inaccessible fact being
  guessed, or a decision taken before its prerequisite was established.
- **Guidance:** [Rule 12: questions](../skill-authoring-guidance.md#12-ask-questions-when-their-answers-become-useful).
