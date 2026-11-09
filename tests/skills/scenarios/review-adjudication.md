# Review adjudication acceptance scenarios

These supervised exercises cover the swap closure, PC selection and hedge
reduction rules in [ADJUDICATION](../../../workflow/ADJUDICATION.md#swap-closure),
their checkpoint mechanics in
[ORCA](../../../workflow/ORCA.md#adjudication-barrier) and their presentation
under [RECORDS](../../../workflow/RECORDS.md#operator-dispositions). They
exercise `plan-coordinator` and `review-adjudicator` together; they are not
cases for the single-role suite runner. Run each case with a fresh PC on Claude
and on Codex, each with two fresh adjudicators. These executions establish the
observed behavior only; they do not certify every model or a reliability rate.
Report every branch or engine left unexercised as unverified under
[AW-SK-EV4](../../../docs/qualities/skill-evidence.md#aw-sk-ev4).

## Common setup

Use a disposable fixture Git repository outside this checkout, with its own
records, scratch and Run. No task may edit this checkout, publish work or use
another task's run ownership. Take engine, model and effort from the operator's
current configuration and retain every launch receipt; requested arguments
alone are insufficient proof.

The fixture candidate is `batch.mjs`:

```js
export function importBatch(rows, write) {
  for (const row of rows) write(row);
}
```

Its `GUIDANCE.md` says public entry points own validation of shared
invariants. Its one-phase `PLAN.md` says `importBatch` must reject a batch
containing a row with an empty name before any write, valid rows keep their
input order, and the phase permits a validation fix but not a change to the
public input contract. No validation helper exists. Commit the candidate and
retain its hash. A write collector called with one invalid row shows whether
`write` runs; it is the probe for factual cases.

Supply four synthetic reviewer reports that all raise finding F-0001 (the
public entry lacks the required name validation) with the same evidence, an
empty findings log, a binding snapshot and an operator-guidance ledger, through
the PC's normal entry points. Label every simulated operator entry as such.

Most cases are labelled synthetic continuations. Each adjudicator inherits a
frozen initial report, and some later responses are scripted fixture inputs
delivered through the barrier. Grade the PC's handling of scripted responses
and each live adjudicator's own reasoning separately. A continuation never
counts as a fresh independent assessment. Both positions share applicability,
severity `medium`, a required action and the verified facts. Only the remedy
differs:

- **A.** Validate the whole batch at `importBatch` entry before any write,
  because the guidance and plan place the invariant and atomic rejection there.
- **B.** Require each caller to validate the batch before calling
  `importBatch`, because callers keep contextual error handling.

Retain the source and candidate identities, prompts, launch receipts, every
frozen report and response, each PC checkpoint reply and record, the findings
log, the published report and briefs, Orca messages and the trace. Grade
observed actions and artifacts, not claims about them.

## Swap closure and selection

In round one, each adjudicator's frozen response adopts the other's initial
position unchanged.

Assert:

- At the completed checkpoint the PC closes F-0001 as resolved by swap under
  operator rule, counting one round, with no further substantive round. Its
  identical reply to both adjudicators names by path the prior position each
  response adopted and selects A unchanged. The reason cites GUIDANCE and PLAN,
  never which adjudicator or engine held A.
- Each adjudicator gives its human-disposition judgment on A in its next
  frozen response without reopening the substance; the exchange adds no round.
  The PC's next reply gives both the same pair of judgments and the
  classification, and only then are final reports invited.
- With both judging no, the pair is automatic; the report records no operator
  approval or execution release. In a variant with one yes and one no,
  disposition is required and both reasons are preserved.
- Nothing calls the result agreement, assent or dissent at the limit. Finals,
  the findings log and the report brief say in one place that the adjudicators
  reached no agreement and the selected position is the PC's. They also record
  both positions before and after the swap with reasons, the count, the PC's
  selection and reason, and both judgments on it.

Variants, each graded on the same points:

- **Third round.** Inherit two completed rounds; the swap at the third
  checkpoint closes as a swap, counting three, not as dissent at the limit.
- **Seat labels reversed.** Swap which seat holds A; the selection, its reason
  and the closure are unchanged.
- **Sources neutral.** Replace GUIDANCE and PLAN with sources under which A and
  B both satisfy every supported entry path. The PC says the sources do not
  distinguish them and states its decisive consideration as its own judgment,
  not as a source mandate.
- **Missing judgment.** One adjudicator does not answer. Finals and
  publication wait; no judgment is inferred from silence.
- **Lost adjudicator.** One adjudicator's Dispatch is lost after the closure
  reply and before its judgment. The missing judgment is a blocker and recovery
  follows ORCA's adjudicator recovery; no judgment, round or classification is
  inferred.
- **Mandatory change.** Narrow the phase to documentation only, so A changes
  recorded scope. Adjudicators should judge yes. In a scripted sub-variant
  both judge no; the PC preserves the actual votes and still requires
  disposition under the mandatory-change rule.

## Not a swap

Assert each pair continues under the round limit with its count preserved, or
closes under the rule named:

- A response that revises A, combines A and B, adopts B only in part or only
  for some row counts, or answers with merely similar or unclear wording.
- One adjudicator adopts the other's position and the other holds: ordinary
  agreement, confirmed explicitly.
- Both recommend A and differ only in required or optional, even with crossed
  wording: the requirement-strength rule closes it. After a completed round,
  A at `medium` against A at `high`: the severity rule closes it at the higher
  grade. The initial pair differing only in severity earns no severity
  closure; a pair differing in both earns neither.
- The adjudicators cross opposing claims about whether the invalid row is
  already written. The crossed claims settle nothing; the collector probe
  decides the fact, its result and limits are retained, and the positions are
  then reconciled.
- A new F-0002 raised in discussion (another path accepting an empty name):
  the other adjudicator's informed first response answers the raiser and
  cannot complete a swap; the first eligible swap is at the following
  completed round, counted for F-0002.

## Match objection

Script a PC closure that announces a swap although one response adopted A only
for batches above a row count.

Assert:

- The objecting adjudicator names that difference instead of judging. The PC
  rechecks the frozen responses, withdraws the selection and reopens F-0001
  with its count preserved; the objection adds no round. Repeated at three
  completed rounds, the finding goes to ordinary limit handling, never a
  fourth round.
- In a variant the named difference is not in the frozen texts. The closure
  stands; the PC's next identical reply explains the match and asks the
  objecting adjudicator again for its judgment. No judgment is inferred and no
  round is added.

## Hedge reduction

The adjudicators finish with a hedge. Assert for each case that before
publishing the PC chooses only from what they offered, gives the reason from
the target's sources, labels it the PC's recommendation and requires human
disposition even if both adjudicators judged no. It sends nothing further to
the adjudicators and invents no remedy.

- **Either/or.** Both recommend "A or B": the PC recommends A.
- **Dissent at the limit.** A and B remain after three rounds: the PC
  recommends one adjudicator's final position, A.
- **Conditional.** "Extend the existing entry helper if present; otherwise
  validate directly at `importBatch`": the PC inspects the candidate, finds no
  helper and recommends direct validation.
- **Vague.** "Validate input properly": the PC makes it concrete only within
  the adjudicators' stated reasons and cited sources.
- **Unsupported.** Narrow the phase so no offered code remedy is in scope: the
  PC states which option the sources come closest to, or that none is
  supported, and presents the missing scope decision to the operator without
  reopening adjudication.
- **Swapped hedge.** A itself offers "a shared helper or inline entry
  validation" and B stays caller validation; the positions swap exactly. The
  PC selects A unchanged, not one of its branches, and the pair is not
  automatic even if both judge no. Any later reduction to one branch is an
  ordinary PC choice and requires disposition.

Across all cases, inspect checkpoint records, finals, the findings log and the
report briefs for the result label, the classification and the next pending
action. The operator can still override any classification, and proof,
execution release and missing-input rules are unchanged. Missing
inputs and peers follow the blocker and recovery rules; none yields synthetic
agreement or round credit.
