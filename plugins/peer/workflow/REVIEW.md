# Review seats and rounds

A review wave is four independent direct reviewers, launched by the PC as Orca
workers, each reviewing one set of the same candidate. Reviewers do not delegate
to sub-reviewers or coordinate each other; the PC and adjudicators consolidate.

## Sets and seats

The PC partitions the target's governing quality roster into the four review
sets A–D. It reads the repository's installed quality selection, the selected
profiles and their installed canonical and readable clauses, following
inheritance for governing obligations, and the repository's extensions, all
from the candidate under review; a profile that is only required supplies
reference context, not further obligations. Every governing clause belongs to
exactly one set, keeping its stable identity. The operator's personal quality
additions, from the binding snapshot, are allocated the same way with their
source preserved ([BINDING.md](BINDING.md#sources-and-authority)), so a
finding names whether it rests on a repository requirement or a personal
addition. The PC records the allocation in the run records, passes
each reviewer its set, and keeps the allocation stable across the rotation; if
the governing roster changes, it records the new allocation and which coverage
it affects. A repository without initialized quality profiles stops for the
operator first ([PROCESS.md](PROCESS.md#quality-profiles)).

Allocation is not a finding of applicability or compliance. Reviewers assess,
clause by clause, whether it applies to the candidate and then whether the
candidate complies, using the quality profiles' shared scenario and measure
guidance; a fact they cannot establish stays indeterminate rather than assumed.

Seats R1–R4 use the worker profiles the resolved configuration assigns them
([ORCA.md](ORCA.md#configuration)); the shared defaults give two Claude seats
and two Codex seats.

| Round | R1 | R2 | R3 | R4 |
| --- | --- | --- | --- | --- |
| 1 | A | B | C | D |
| 2 | B | C | D | A |
| 3 | C | D | A | B |
| 4 | D | A | B | C |

Every seat reviews every set over the four rounds, so every configured engine
does too.

## Rounds

A phase's review starts at round 1. The PC selects the round; reviewers do not
infer it from earlier reviews or evidence.

- **Repeat until clean.** A round is clean when its wave reports no findings of
  any severity, `note` included, or the operator gate settles every finding
  without a candidate change. Otherwise the RP corrects and the same round runs
  again on the new candidate.
- **Advance after clean.** With the operator's go-ahead, a clean round N advances
  to N+1 on the same candidate. A clean round 4 completes the rotation.
- **Corrections do not reset.** A changed candidate keeps the current round
  number. Record which candidate every wave reviewed.

Each wave reviews the full phase diff against the phase base. A clean result
covers only the candidate it reviewed. When the candidate changes after earlier
clean rounds, those results stay in the record against their own candidates;
the report states which engine and set pairings have reviewed the current
candidate, which saw only predecessors, and whether the delta touches what they
assessed. The rotation is complete on the final candidate only when it actually
received every round. Where the delta materially affects earlier coverage, the
PC recommends repeating the affected round and the operator decides.

## Reviewer inputs

Each reviewer's task names: the candidate (base, tree, commit or staged form),
round, seat and set with its clause allocation, the binding snapshot to work
under ([BINDING.md](BINDING.md#snapshots)), the evidence record to rely on,
its attempt and scratch directories ([RECORDS.md](RECORDS.md#layout)), and any
operator constraints. Repository obligations, guidance and accepted decisions
are read from the candidate; the review procedure, evidence validity rules,
local preferences and personal additions come from the snapshot, which cites
the sources that establish them.
The reviewer validates the evidence before reviewing as the binding requires;
missing, failed, stale or mismatched required evidence blocks the review and goes
back to the PC, and is also a finding under its proof obligation
([Handling of `note`](#handling-of-note)). Reviewers do not rerun the repository
gate. Focused probes run in the reviewer's scratch, outside the developer's
checkout ([RECORDS.md](RECORDS.md#scratch)), and the support a finding relies
on is retained in the records before release
([RECORDS.md](RECORDS.md#supporting-evidence)).

## Finding format

Use the finding format the binding snapshot names from the repository's own
guidance. Where it names none, each finding
carries **Severity** (below), **Clause** (the obligation and why it applies),
**Evidence** (expected and observed behavior; path and line in the reviewed
candidate, or the situation; how it was shown, by inspection or reproduction;
links to its retained support), **Summary**, **Consequence**,
**Recommendation** and **Rationale**. Give every finding a stable local ID so
the report can link it, and report each assigned topic as `clean` or
`findings` with the clauses assessed.

- **Severity**: one of `blocking`, `high`, `medium`, `low`, or `note`, as the
  severity scale below defines them. Grade the consequence at the current
  target, never by how many reviewers agree. A failed in-scope clause is never
  `note`; an observation outside the reviewer's assigned sets is filed as
  `note`, never dropped.

The severity scale and the handling of `note`, proof and coverage below govern
under every binding. A binding's format may add fields to a finding, but it
never replaces the five grades, their definitions and order, or that handling.
The binding still owns its own requirements: which obligations and proofs
apply, its verification commands and what makes its evidence valid.

### Severity scale

- `blocking` — the target cannot safely or coherently advance.
- `high` — a major invariant, boundary, or required outcome is absent.
- `medium` — the target is materially incomplete or ambiguous.
- `low` — bounded quality or maintainability debt worth correcting.
- `note` — non-clean feedback whose consequence is informational or small.

### Handling of `note`

`note` is non-clean feedback, not an untracked side channel: it appears in the
same list, findings log, and disposition flow as every other severity. Do not
suppress a valid issue because another set might own it; name the clause and
the evidence, and the coordinator consolidates or routes it. Do not invent
product intent when a requirement is ambiguous; identify the ambiguity and the
smallest decision needed. A missing required proof is a finding under its
proof obligation; any other evidence gap is recorded in the coverage table,
not as a finding.

- **Every severity is a finding.** A wave that reports a `note` is not clean,
  and the note goes through adjudication, the report and human-disposition
  classification like any other finding; being informational or outside the
  reviewer's set never exempts it. An out-of-set note carries its clause,
  evidence and stable local ID. Routing keeps the source set and grade as
  reported; adjudication then grades the issue against the obligation it
  actually concerns under this scale, and nobody regrades it by assertion.
- **Required proof.** Proof is required when the binding, plan or phase
  obligates it; the finding names that obligation and why it requires the
  proof. Missing, failed, stale or mismatched required proof goes to the PC as
  a blocker ([Reviewer inputs](#reviewer-inputs)) and is also a finding under
  that obligation; never review around unusable proof. A wrong or missing
  candidate identity, allocation or authority is a blocker for the PC, not a
  proof finding under an invented clause.
- **Coverage table.** Each review includes a table of its assigned clauses:
  clause, applicability, compliance (or the finding's local ID), evidence
  relied on, and gaps. An indeterminate fact, missing assurance that nothing
  requires, or an absent optional or native check stays there and does not
  become a finding by itself. The table records coverage; it adds no proof to
  collect and no tests to run.
