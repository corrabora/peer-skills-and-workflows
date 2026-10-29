---
name: review-adjudicator
description: Independently assess every finding of a plan review wave, then reconcile with an equal peer adjudicator in at most three rounds per finding, recommending without operator authority or edits to the candidate. Use when dispatched as an adjudicator by a plan coordinator, in Claude or Codex.
---

# Review adjudicator

You are one of two equal peers in one adjudication wave. You investigate and
recommend; you do not decide for the operator or edit the candidate.

## Shared references

This skill is installed as a link. Resolve this file's real path, following
symlinks or junctions; the workflow source is two directories above the skill
directory.
Read `workflow/ADJUDICATION.md`, the canonical severity scale and handling of
`note`, proof and coverage under Finding format in `workflow/REVIEW.md`, and
the adjudication barrier in `workflow/ORCA.md` and `workflow/RECORDS.md`
(Writing, Layout, Scratch, Supporting evidence, Operator guidance) there. Use
the source path the PC supplied if it differs.

Repository authority comes from the target: its quality selection and
extensions, guidance, accepted decisions and the plan and phase, read from the
candidate. The binding snapshot your task names (`workflow/BINDING.md`,
Snapshots) supplies the review procedure, evidence validity rules, local
preferences and personal additions with their sources; the same snapshot the
reviewers and your peer use. The findings log and the operator-guidance
entries your task names record prior decisions and the scope of this wave;
they are not repository authority. Guidance that arrives mid-wave comes as a PC follow-up
naming its IDs and does not open the barrier. Ask the PC when scope is unclear.
Use the live Orca preamble for communication.

## Work

- First `ask` the PC to confirm your attempt and scratch directories and mode.
  In continuation mode, keep the preserved reports and round counts you are
  given.
- Confirm the candidate, all four reviews, the binding snapshot and the
  findings-log snapshot. Missing or mismatched inputs are a blocker for the PC,
  not something to work around.
- Assess every finding independently, `note` included, grading its severity on
  the canonical scale and saying whether each recommended action is required
  or optional, and judging whether the exact finding/recommendation pair
  requires human disposition under `workflow/ADJUDICATION.md` (Human
  disposition judgment). Freeze your initial report before seeing the peer's.
  Investigate code, callers, tests, the governing clauses and the retained
  evidence yourself; probe only in your scratch, outside the checkout, record
  what probes show and do not show, and retain what you rely on in your attempt
  directory before `worker_done`. Ask the PC when an input needs a separate
  investigator.
- Before drafting assessments, peer responses or the final report, load
  `write-for-humans` under RECORDS' Writing procedure. For consequential
  terminology ambiguity, follow `workflow/PROCESS.md` (Planning and phases) to
  load `maintain-glossary` and route unresolved meaning through the PC. These
  skills do not change the independent-assessment barrier or permit candidate
  edits; preserve both actual positions and the basis of any closure.
- Reconcile through the PC as `workflow/ADJUDICATION.md` describes, blocking in
  `ask` after every frozen response as the barrier in `workflow/ORCA.md`
  requires. Respond to the exact peer positions supplied, explain changes of
  view, assent explicitly only to a resolution and rationale you hold, say
  whether you hold each recommended action required or optional and its
  severity (requirement strength alone, and after at least one completed round
  severity alone, are settled by the operator's rules in
  `workflow/ADJUDICATION.md`), and preserve dissent after three completed
  discussion rounds. Reassess human disposition for the final pair; a **yes**
  from either peer promotes that judgment to **yes** without another round
  for that difference. Label proposals that change plan intent, scope, design
  or architecture as needing an operator decision.
- Never overwrite a published report, the peer's files, the reviews or the
  PC's records.

## Return

Write `initial.md`, `responses/<NNN>.md` and `final.md` in your attempt
directory. When the PC closes reconciliation, freeze a self-contained final
report with the workflow source and revision you loaded, the binding snapshot
you worked under, the operator-guidance IDs you applied, initial and final positions, agreed rationale or dissent, the basis of each agreement (for the
severity rule, both actual grades and the completed-round count), round
history and proof limits, both human-disposition judgments and their reasons,
and the resulting classification and its basis. Check PC follow-ups, send one
`worker_done` with the final report path and explicit outcome, and end the
turn. Waiting for the peer is not failure.
