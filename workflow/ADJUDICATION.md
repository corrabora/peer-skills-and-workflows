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
- Swapped positions close under [Swap closure](#swap-closure), after applying
  the sole-difference rules above.
- At most three completed rounds per finding. After the third without agreement
  or swap closure, preserve the dissent: each position, shared facts, disputed
  premises, alternatives and consequences, and remaining proof gaps.

No vote, forced compromise, deference to the PC, or assent inferred from
silence; the requirement-strength and severity rules are the operator's
settlements of single differences, and the swap rule settles positions that
cross without converging. These are not votes, compromises or inferred assent.
A missing peer or response is a blocker, not a round, a dissent, an optional
position or a grade; the PC recovers it as
[ORCA.md](ORCA.md#adjudicator-recovery) describes.

If a peer raises a new issue during discussion, it gets a stable ID. The other
peer's first response to it is necessarily informed by the raiser's position;
label it as an informed first response rather than staging an artificial blind
assessment. Discussion rounds for that issue follow as above.

## Swap closure

At a completed paired checkpoint, the PC compares both frozen responses with
the prior pair they answered. A swap occurs when each response adopted the
other peer's prior position whole and unchanged: applicability, remedy and
conditions, severity and requirement strength. The human-disposition judgment
is excluded from the match because it is reconciled separately.

- The prior pair may be the initial reports; the observed round counts as
  completed. A swap at the third round closes as a swap, not dissent at the
  limit. For a new issue, the informed first response answers the raiser;
  the first possible swap is at the completed discussion round that follows.
- The sole-difference rules take precedence: a pair differing solely in
  requirement strength, or after a completed round solely in severity, closes
  under those rules even with swapped wording.
- Revision, combination, partial or conditional adoption, an unclear match or
  merely similar wording is not a swap; the finding continues under the round
  limit. One-sided adoption is ordinary agreement to confirm explicitly.
- Facts and check results are never settled by swap; resolve them by
  verification, with an investigator when needed.

In the reply sharing the completed pair, the PC closes the finding with no
further round as **resolved by swap under operator rule**, naming by path the
prior position each response adopted. In the same reply it selects one of the
two swapped positions, unchanged, under [PC selection](#pc-selection), and
sends the identical selection and reason to both adjudicators. The selected
position is the PC's; the adjudicators reached no agreement. Reports state both
facts alongside **resolved by swap under operator rule** and never call it
agreement, assent or dissent at the limit.

The closure reply asks both adjudicators for their human-disposition judgment
on the selected position. Each answers in its next frozen response, which may
also address other open findings. It judges only whether that selection
requires human disposition, without reopening the substance or adding a
discussion round for this finding. The PC's next reply gives both adjudicators
the same pair of judgments and the resulting classification under
[Human disposition judgment](#human-disposition-judgment), including its
mandatory-change rule. Do not invite final reports until both judgments are
frozen; a missing judgment is a blocker, not a judgment.

An adjudicator that disputes the PC's match names, in that response and
instead of a judgment, what differs between the frozen texts. The PC rechecks
the frozen responses against the named difference. A real difference withdraws
the selection and reopens the finding with its completed-round count
preserved. Otherwise the closure stands: the PC's next identical reply to both
adjudicators explains why the frozen texts match and asks the objecting
adjudicator again for its judgment on the unchanged selection. The objection
adds no round: a finding reopened at three completed rounds goes to ordinary
limit handling, not a fourth round.

## PC selection

When this workflow directs the PC to select a recommendation, it chooses by
principle from the target's own sources: the applicable guidance,
specifications, quality selection and extensions, accepted decisions (ADRs when
present) and the plan and phase, read from the candidate, and the applicable
local preferences in the wave's binding snapshot. A source counts only as far
as it actually applies; selecting confers no new authority on it or on the PC.

The PC records its reason, citing the sources that decide the choice. Which
adjudicator or engine held an option, convenience and the PC's own preference
are not reasons. When the sources do not distinguish the options, the PC says
so and states its decisive consideration as its own judgment, not as a source
mandate.

The PC also selects when the adjudicators' result hedges: alternatives or an
either/or, a conditional or vague remedy, or dissent at the round limit.
Before publishing the report, it reduces the hedge to one concrete
recommendation using only what the adjudicators offered: one offered
alternative, a condition settled from the sources to one of its branches, or
one peer's final position. It makes a vague remedy concrete only within the
adjudicators' options, reasons and cited sources, and never invents a remedy.
The result is the PC's recommendation, labelled as such. It always requires
human disposition, inherits no automatic classification and asks nothing
further of the adjudicators. A swap selection that itself contains unresolved
options stays unchanged when selected; reducing them later is this ordinary PC
choice.

If the sources support none of the offered options or cannot settle the
condition, the PC invents none. It states the offered option the sources come
closest to supporting, or that none is supported, and presents the missing
fact or judgment as the decision asked of the operator. It may launch an
investigator for a missing fact before publishing. This reports a gap; it
neither reopens adjudication nor claims a supported resolution.

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
the PC requires human disposition. The sole exception to that PC-choice rule
is an unchanged swap selection: the adjudicators judge that exact selection
under [Swap closure](#swap-closure), and their judgments classify it under the
rules above. A missing judgment or peer is a blocker for the PC to recover,
not agreement or an automatic classification. Before
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

When every finding has agreed, been resolved by swap with both judgments on
the selection frozen and no match objection pending, or reached its limit,
both peers freeze final reports. Include initial and final positions, the
agreed rationale or dissent, the basis of each agreement (explicit assent,
the requirement-strength rule or the severity rule, with both actual grades
and the completed-round count), round history and proof limits. For a swap,
record both positions before and after with their reasons, the completed-round
count, and the PC's selected position and reason, reporting it as
[Swap closure](#swap-closure) requires, separately from agreement and dissent.

For every finding/recommendation pair, include both final human-disposition
judgments and reasons, the exact recommendation judged, the resulting
automatic or disposition-required classification and its basis, including
promotion or the mandatory-change rule where applicable. For a swap these
are the judgments on the PC's selection. Every kind of agreement, and a PC
selection, remains a recommendation.
The PC writes the report and applies the operator gate under RECORDS' Operator
dispositions. Proposed changes to
plan intent, scope, design or architecture are labelled as needing an operator
decision even when the peers agree.
