# Review report — <plan>, phase <n>, cycle <NNN>, wave <NNN>-round-<r>

**Status: <wave> complete; <stopped at the operator gate, or proceeding within an explicit recorded authorization, with its OG ID and scope>. <Stop boundary and any human dispositions still required.>**

Operator entry: [run-root report.md](<relative path from this file to the run root's report.md>)
opens the current report; this file is `<run-root-relative path of this report or revision>`.
Published reports are never edited; a later revision becomes current instead.

<Two or three sentences: what was reviewed, what the peers concluded, what the
operator is asked to decide.>

## Subject, coverage and evidence

- Candidate: base `<commit>`, tree `<tree>`, <commit or staged form>; previous candidate `<tree or none>`.
- Workflow instructions loaded: <the PC's revision; each worker's, noting any difference>.
- Binding snapshot: [control/binding/<NNN>](<relative path>); sources <current | changed: paths and affected coverage>.
- Round <r>. Seats:

  | Seat | Engine / model / effort (effective) | Set | Result |
  | --- | --- | --- | --- |
  | R1 | | | |
  | R2 | | | |
  | R3 | | | |
  | R4 | | | |

- Coverage of this candidate by earlier rounds: <which pairings reviewed it,
  which reviewed only predecessors, and whether the delta touches their sets>.
- Evidence: <shared wave record, linked, and result>; limits: <what it does not establish>.
- Adjudicators: <engine / model / effort, effective>; <rounds used, blockers>.

## Resolution table

| ID | Severity | Issue | Sources | Recommended result | Resolution | Human disposition required | Human decision | Proof |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [F-0001](#f-0001) | | | | | | | | |

## Automatic pairs

<List each automatic pair by brief ID, concise finding and exact recommended
action. Both adjudicators judged no human disposition required; this records
no human approval or execution release. The operator may override from the
complete briefs below. Write "None" when there are no automatic pairs.>

## Complete briefs

<a id="f-0001"></a>

### F-0001 — <short title>

**Finding summary.** <The issue in a few sentences.>

**Underlying findings.** [<seat> <local ID>](<relative link to source finding>) (<set and severity as reported>); …

**Recommendation.** <The recommended result.>

**Rationale.** <Why, from verified facts.>

**Applicable objectives and clauses.** <Plan/phase objectives and obligations, with applicability.>

**Evidence and limits.** <What was inspected or shown, and what remains unproven.>

**Peer positions.** Initial: <A> / <B>. Final: <A> / <B>. <Each with its severity and reasons.>

**Agreement.** <Agreed in round n on resolution and rationale; agreed in round n, required under the requirement-strength rule, with both positions above; agreed at the higher grade under the severity rule after n (at least 1) completed rounds, with both actual grades and their reasons above; or dissent preserved: residual positions and disputed premises.>

**Human disposition required.** <A: yes/no and reason with governing sources;
B: yes/no and reason with governing sources. Result: automatic (both no on the
same concrete resolution), or yes (both yes, promoted because either said yes,
or required by the mandatory-change rule despite the actual votes). Preserve
differing judgments; changes to recorded intent, scope, design or architecture
always require yes. Identify the exact recommendation judged.>

**Alternatives and tradeoffs.** <Options considered and their consequences.>

**Operator decision and remaining work.** <Exact decision needed, or why none is needed; a recorded decision quoted with its operator-guidance ID (`OG-<NNNN>`); remaining implementation and proof.>

## Operator decisions needed

<Each pair requiring human disposition, with its brief ID and the exact
question, including any automatic pair the operator has called up.>

## Proof and next permitted work

<Evidence state, blockers, the authorization in force with its `OG-<NNNN>` IDs, and the transition that awaits the operator.>

## Source records

<Links to the review, adjudication and investigation outputs and their retained evidence, and to the run's operator-guidance ledger for the cited IDs.>
