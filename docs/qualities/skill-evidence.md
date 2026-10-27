# Skill evidence and evolution

Artifacts support the decisions they serve, mechanical checks establish only
what they can prove, and revisions have evidence matching their behavioral
claims. Apply these clauses through the [selection and assessment contract](README.md).

## AW-SK-EV1

**Artifacts retain their purpose and support for the needed lifetime.** Each
material artifact has an identifiable owner, reader and retention purpose;
references remain usable for as long as the consuming result depends on them.

- **Applies when:** work creates or changes plans, decisions, run records,
  reports, evidence, scratch outputs or handoffs used by skills.
- **Pass boundary:** maintained authority, retained run state and disposable
  scratch have distinct roles. Durable decisions state their meaning without
  depending on temporary records. Reports retain accessible support, and
  handoffs preserve the current state without becoming competing policy.
- **Scenario:** release a worker or remove disposable scratch, then follow the
  report's evidence and the next worker's handoff references.
- **Evidence:** inspect artifact ownership, links and retention instructions.
  Use a disposable fixture for destructive lifecycle probes. Empty scaffolding
  is not required where no reader or dependency needs an artifact.
- **Guidance:** [Rule 13: artifact lifetime](../skill-authoring-guidance.md#13-give-each-artifact-a-purpose-owner-and-lifetime).

## AW-SK-EV2

**Outputs make evidence, uncertainty and the next decision visible.** Required
output content serves assessment or coordination and supports the recipient's
next action without obscuring limitations.

- **Applies when:** work changes templates, report instructions, result schemas
  or human-facing explanations of a skill's output.
- **Pass boundary:** the recipient can identify the subject, conclusion,
  supporting observations, relevant limitations and any pending decision.
  Fields allow truthful unknown, inapplicable and unproven results where needed.
  A summary preserves access to necessary detail and substantive disagreement;
  polished formatting does not substitute for evidence.
- **Scenario:** produce a result with mixed outcomes and one unresolved
  disagreement, then determine the next permitted action from the output.
- **Evidence:** inspect representative filled outputs and their supporting
  records. Explain the consequence of an absent or misleading field rather than
  requiring every report to use the same headings or length.
- **Guidance:** [Rule 14: outputs](../skill-authoring-guidance.md#14-design-outputs-around-evidence-and-decisions).

## AW-SK-EV3

**Mechanics and judgment have appropriate owners.** Repeatable operations use
available reliable mechanisms where warranted, while workflow meaning and
authority remain explicit in their governing instructions.

- **Applies when:** work adds or changes helpers, validators, resolvers, runtime
  integration or instructions that interpret their results.
- **Pass boundary:** tool inputs, outputs and failure handling support correct
  use. The skill does not reconstruct an existing deterministic mechanism
  without a reason, and tooling remains proportionate to the demonstrated need.
  Structural validation is distinguished from behavioral assessment; a runtime
  limit does not silently replace a workflow's delegation or ownership policy.
- **Scenario:** return validly shaped but incomplete task data, then a tool
  error. Determine what each result establishes and what remains a judgment.
- **Evidence:** use relevant tool tests and inspect the consuming instructions.
  No helper is required solely because an action could theoretically be
  automated. Model behavior claims need the evidence described in `AW-SK-EV4`.
- **Guidance:** [Rule 15: tooling](../skill-authoring-guidance.md#15-put-repeatable-mechanics-in-tools-and-judgment-with-its-owner).

## AW-SK-EV4

**Behavioral revisions have proportionate, candid evidence.** A skill change
states the intended improvement and supplies evidence capable of establishing
its consequential behavioral claims under the affected supported conditions.

- **Applies when:** a new skill or revision changes effective selection, loading,
  task behavior, completion, authority or operator interaction; also when a
  change claims an improvement in reliability, cost or usability.
- **Pass boundary:** the author identifies the expected behavior and inspects
  the actual result and trace. Evidence covers the changed path and a relevant
  boundary or failure case without silently losing previously required
  behavior. Reports state the engines, runtime conditions, source/candidate
  identities and limitations actually observed. A single success is not
  presented as a reliability rate or proof of general superiority.
- **Scenario:** replay the failure or friction that motivated a revision and a
  neighboring case that already worked. For a new skill, use its intended task
  and a case outside or at the edge of its responsibility.
- **Evidence:** retain the input, expected result, actual result, relevant trace
  and source identities. Compare old and new behavior when claiming improvement;
  where the baseline cannot be reproduced, disclose that limit and narrow the
  claim. Inspect successful runs for unnecessary retries or repeated questions
  as well as outright failures.
- **Guidance:** [Rule 16: observed use](../skill-authoring-guidance.md#16-improve-skills-through-observed-use).

### Required behavioral proof

For a new executable skill, or a material change to how an agent selects,
loads, advances, obtains authority or declares completion, require a
representative execution of the affected path and a relevant boundary case on
each supported engine affected by the change. One scenario may establish
several clauses. A change confined to one engine's adapter need not rerun
unaffected engines when that scope is established. A shared instruction change
affects every engine that consumes that instruction.

Inspection suffices for changes established to preserve behavior, such as a
spelling correction or a repaired documentation link with an unchanged
destination. Use deterministic tests for changed mechanical behavior. Explain
the evidence choice in the ordinary change or verification record; a separate
assessment artifact or automated replay framework is not required.

An unavailable engine or missing execution remains unverified, not implicitly
passed. When the required proof is absent, report it under this clause and
follow the existing operator decision and proof procedures. Do not run live
mutations or external communications merely to satisfy a scenario: use
disposable fixtures or controlled substitutes, and state what those establish.

Evaluate correctness and operator usability before cost. Cost claims compare
equivalent tasks and include loaded dependencies; shorter source text alone
does not prove lower execution cost or better results. Repeat consequential
cases enough to investigate observed variability, without inventing a universal
sample count or quantitative reliability claim from a few successful trials.
