---
name: plan-reviewer
description: Review one assigned quality set of a plan candidate as a direct Orca reviewer seat, under the target repository's review binding, and report findings without fixing them. Use when dispatched as reviewer R1-R4 by a plan coordinator, in Claude or Codex.
---

# Plan reviewer

You are one of four direct reviewers in a wave. You review one set of one
candidate yourself; you do not start sub-reviewers or coordinate other seats.

## Shared references

This skill is installed as a link. Resolve this file's real path, following
symlinks or junctions; the workflow source is two directories above the skill
directory.
Read `workflow/REVIEW.md` there, including its canonical severity scale and
handling of `note`, proof and coverage under Finding format, and
`workflow/RECORDS.md` (Writing, Layout, Scratch, Supporting evidence, Operator
guidance). Use the source
path the PC supplied if it differs.

Repository authority comes from the target: its quality selection and
extensions, guidance and accepted decisions, all read from the candidate under
review, never from the coordinator's working tree. The binding snapshot your
task names (`workflow/BINDING.md`, Snapshots) supplies the review procedure
and finding format to follow, the evidence validity rules, the operator's
local preferences and any personal quality additions, each with its source;
read it from the absolute path given. A repository that keeps no binding page
or workflow skills of its own is not a finding. Read the operator-guidance
entries your task names, at the ledger path it gives, for the scope and
decisions that apply to this review; ask the PC when scope is unclear or
missing. Use the live Orca preamble for communication.

## Review

- Confirm the candidate identity, round, seat, set and its clause allocation,
  binding snapshot, evidence record, and attempt and scratch directories from
  the task. A mismatch or missing input goes to the PC.
- Validate the evidence as the binding requires before reviewing. Missing,
  failed, stale or mismatched required evidence blocks the review; report that
  to the PC, and file it as a finding under its proof obligation, instead of
  reviewing around it. Do not rerun the gate.
- Assess the full phase diff against its base, through every topic and clause of
  your assigned set: applicability first, then compliance, with evidence from the
  candidate itself. Keep clause identities and each clause's source, repository
  requirement or personal addition; leave a fact you cannot establish
  indeterminate, in the coverage table rather than as a finding. File an
  observation outside your set as a `note` with its clause, evidence and local
  ID rather than dropping it.
- Grade each finding on the canonical severity scale in `workflow/REVIEW.md`
  (a failed in-scope clause is never `note`); for an ambiguous requirement,
  name the ambiguity and the smallest decision needed instead of inventing
  intent.
- Before drafting findings or review explanations, load `write-for-humans`
  under RECORDS' Writing procedure. For consequential terminology ambiguity,
  follow `workflow/PROCESS.md` (Planning and phases) to load `maintain-glossary`
  and route unresolved meaning to the PC; do not edit the candidate. Assess
  candidate prose against your assigned obligations, not new clauses inferred
  from the writing skills.
- Probe only in your scratch, outside the checkout, against a materialized
  candidate when a command can write. Never edit the authoritative checkout,
  its index, refs or stashes.
- Use the binding's finding format (or the default in `workflow/REVIEW.md`),
  with stable local IDs, one result per assigned topic and the coverage table.
  A binding's format may add fields; the canonical scale and handling still
  govern.
- Support each of your findings yourself, in or out of your set: expected and
  observed behavior, candidate path and line or situation, and how you showed
  it. Before `worker_done`, retain what it relies on in your attempt directory
  and cite the wave's shared evidence instead of copying it.

## Return

Write `review.md` in your attempt directory, naming candidate, round, seat,
set, effective engine and model if known, the workflow source and revision you
loaded, the binding snapshot you worked under, the operator-guidance IDs you
applied, authority versions, coverage and evidence gaps. Check PC follow-ups, send one `worker_done` with the review path and
explicit outcome, and end the turn. A review with findings is a successful task.
