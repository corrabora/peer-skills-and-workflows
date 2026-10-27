# Peer adjudication

Two fresh adjudicators are equal peers. Neither they nor the PC speak with
operator authority; their agreement is a recommendation.

## Independent assessment

Both receive the same inputs: the candidate, all four review reports, the
findings log as a read-only snapshot of prior decisions, the wave's binding
snapshot ([BINDING.md](BINDING.md#snapshots)) and the plan and phase; repository
guidance and obligations are read from the candidate, local preferences and
personal additions from the snapshot. Each
assesses every finding independently and freezes an initial report before
seeing the other's. Initial assessments are not discussion rounds and do not
count toward the limit below. Each inspects the retained evidence
independently and may reproduce or investigate in its own scratch where
useful, retaining what it relies on
([RECORDS.md](RECORDS.md#supporting-evidence)). An adjudicator that needs an
input investigated asks the PC, which launches the investigator.

For each finding an assessment establishes expected and observed behavior from
the candidate itself, the applicable obligations and whether they actually
apply, the consequence and its severity on the canonical
[severity scale](REVIEW.md#severity-scale), whatever the binding's finding
format, plausible alternatives and a recommendation with its blast radius,
stating whether the recommended action is required or optional (the input to
the requirement-strength rule below). A
`note` is assessed like any other finding; one routed from outside its
reviewer's set keeps its source grade in the record, and the assessment grades
it against the obligation it actually concerns. It distinguishes an
implementation defect, missing required proof, a contract ambiguity, an
accepted design and an unsupported concern. Against the findings log it
distinguishes a repeat of a decided issue (carry the decision
forward), an unmet agreed correction (unfinished work, not a reversal), a new
path outside an earlier decision (a new issue) and a reopening, which needs new
grounds stated explicitly. A prior decision cannot waive an obligation the target
inherits; report the conflict instead of suppressing it.

Each assessment also judges **Human disposition required: yes or no** for
the finding and its exact recommendation, with a reason grounded in the
repository's guidance, specifications, plan, quality objectives and recorded
design and architecture, including ADRs when present. Judge **no** only when
these sources establish one obvious, principled, on-plan, conflict-free
resolution. A recommendation that changes recorded intent, scope, design or
architecture always requires **yes**. Competing remedies, unresolved conflicts
or insufficient grounds for **no** require **yes**; severity and whether an
action is required or optional do not by themselves settle this judgment.

## Reconciliation

After both initial reports are frozen, the PC assigns stable finding IDs and maps
sources: reports of the same underlying issue merge, keeping every source ID;
competing remedies for one issue stay together as alternatives. Both peers then
receive the map and both full initial reports.

Resolve the separate human-disposition judgment under
[Human disposition judgment](#human-disposition-judgment). A difference settled
there does not keep substantive reconciliation open or prevent the
sole-difference rules below from applying to the remaining positions.

Peers actively seek principled agreement from verified facts, the target's
guidance, quality applicability and the plan and phase objectives. For each
unresolved finding:

- A discussion round means both peers respond to the same pair of previous
  positions. Do not hand one peer's new answer to the other within a round.
  The exchange runs through the blocking barrier in [ORCA.md](ORCA.md#adjudication-barrier).
- Each response engages the peer's argument and evidence, confirms or revises
  its own position, and explains any change.
- Agreement is explicit assent by both to the same resolution and rationale. When
  the initial assessments already agree, mutual confirmation closes the finding.
- Requirement strength alone does not keep a finding open. By operator rule,
  when both frozen positions recommend the same action and differ only on
  whether it is required or optional, the optional position affirms the
  required one: the finding closes as agreed with the action required, without
  a further round for that distinction (zero rounds when the pair is the initial
  reports). Report it as agreed, required under this rule, with both actual
  positions and their reasons; the optional peer endorsed the action, not
  necessarily its necessity. The rule needs both positions and applies only when
  requirement strength is their sole difference: a different remedy,
  incompatible conditions, a disputed fact, a different severity or opposition
  to the action continues through reconciliation, and so does a case where it
  is unclear whether anything else differs.
- Severity alone does not keep a finding open once discussed. By operator
  rule, when the current frozen pair differs solely in severity after at least
  one completed discussion round on that finding, the finding closes as agreed
  at the higher grade (`blocking` > `high` > `medium` > `low` > `note`), without
  a further round to confirm the grade. The PC closes it at that completed
  paired checkpoint, in the reply that gives both peers the same full current
  pair, finding map, states, bases and counts
  ([ORCA.md](ORCA.md#adjudication-barrier)). A completed round needs both peers'
  responses to the same previous pair: unlike the requirement-strength rule,
  the initial reports count zero and never earn this closure, and one
  response, a missing peer or a timeout is not a round. Peers may give
  different reasons for their grades as judgment on shared facts; a disputed fact about the consequence, or any difference in
  applicability, remedy, conditions, requirement strength or opposition to the
  action, is not solely severity and continues through reconciliation, as does
  a case where it is unclear whether anything else differs. Report it as
  agreed at the higher grade under the severity rule, with both actual grades
  and their reasons and the completed-round count; never say that a peer
  changed its grade or that the peers assented to each other's.
- A pair that differs in both requirement strength and severity has no sole
  difference: neither rule applies, alone or combined, and the finding
  continues through reconciliation.
- At most three completed rounds per finding. After the third without agreement,
  preserve the dissent: each position, shared facts, disputed premises,
  alternatives and consequences, and remaining proof gaps.

No vote, forced compromise, deference to the PC, or assent inferred from
silence; the requirement-strength and severity rules are the operator's
settlements of single differences, not any of these. A missing peer or response
is a blocker, not a round, a dissent, an optional position or a grade; the PC
recovers it as [ORCA.md](ORCA.md#adjudicator-recovery) describes.

If a peer raises a new issue during discussion, it gets a stable ID. The other
peer's first response to it is necessarily informed by the raiser's position;
label it as an informed first response rather than staging an artificial blind
assessment. Discussion rounds for that issue follow as above.

## Human disposition judgment

Reassess the judgment against the final finding/recommendation pair whenever
the remedy or its basis changes. Reconcile it separately from the substantive
resolution, requirement strength and severity: **no** from both adjudicators
on the same concrete resolution makes the pair **automatic**; **yes** from
either makes human disposition required. A disagreement on this judgment
immediately promotes the result to **yes** under the operator's rule, without
spending discussion rounds on that difference. Preserve both actual judgments
and reasons; promotion does not mean the peers assented to the same judgment.
Continue any substantive dispute through the normal reconciliation limit.

An automatic pair must have a settled concrete recommendation and both final
judgments of **no**; an unresolved remedy or a recommendation chosen later by
the PC requires human disposition. A missing judgment or peer is a blocker for
the PC to recover, not agreement or an automatic classification. Before
publishing, the PC checks the mandatory rule: a change to recorded intent,
scope, design or architecture requires disposition even if both peers said
no. Preserve their actual judgments and record the mandatory-change rule as
the basis for requiring disposition; do not silently rewrite their votes.
The PC cannot downgrade a required disposition. The operator may overrule any
classification from the full report; record that guidance through the usual
disposition procedure.
Automatic classification waives only a separate per-finding disposition;
execution release, proof and the operator gate apply as
[RECORDS.md](RECORDS.md#operator-dispositions) directs, including its bounded
exception for an explicit instruction to proceed automatically. That
instruction never bypasses a pair requiring human disposition.

## Result

When every finding has agreed or reached its limit, both peers freeze final
reports with initial and final positions, the agreed rationale or dissent, the
basis of each agreement (explicit assent, the requirement-strength rule or the
severity rule, with both actual grades and the completed-round count), round
history and proof limits, and each finding/recommendation pair's human
disposition judgment: both final votes and reasons, the resulting
automatic or disposition-required classification and whether it came from
matching judgments or promotion under the operator's rule. Every kind of
agreement is a recommendation.
The PC writes the report and applies the operator gate under RECORDS' Operator
dispositions. Proposed changes to
plan intent, scope, design or architecture are labelled as needing an operator
decision even when the peers agree.
