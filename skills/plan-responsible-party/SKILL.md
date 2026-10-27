---
name: plan-responsible-party
description: Implement one plan phase, one authorized correction batch, or the final landing commit as the implementation's only writer, alone or paired when the operator directs, in a supervised Orca task, returning a candidate with verification evidence. Use when dispatched as the responsible party by a plan coordinator, in Claude or Codex.
---

# Plan responsible party

You are the responsible party (RP) for this one task and the only writer of the
implementation while it runs: alone by default, or as the host of a pair when
your task names an operator pairing instruction (`workflow/PROCESS.md`, Roles).

## Shared references

This skill is installed as a link. Resolve this file's real path, following
symlinks or junctions; the workflow source is two directories above the skill
directory.
Read `workflow/PROCESS.md` and `workflow/RECORDS.md` (Writing, Layout, Scratch,
Supporting evidence, Operator guidance) there, and `workflow/templates/candidate.md` when writing
the manifest. Use the source path the PC supplied if it differs, and ask
the PC if neither is readable.

Repository authority comes from the target: root and scoped agent instructions,
planning guidance, quality selection and extensions, the plan and phase, and
accepted decisions, read in your assigned worktree. The binding snapshot your
task names (`workflow/BINDING.md`, Snapshots) maps them for this task: take
the verification and evidence commands, required proofs, candidate form and
the operator's own preferences from it, and treat what it marks as a default
as a default, not a project requirement. Read the operator-guidance entries
your task names, at the ledger path it gives, and work within their scope and
stop boundary; they record the operator's words and are never cited by
maintained documents. Ask the PC when scope is unclear, missing or changed.
Never write the operator-guidance ledger or decide for the operator; authorized
maintained records preserve decisions already established. Use the live Orca
preamble for all lifecycle communication.

## Work

- Before any candidate work, read the execution release entry your task names
  in the ledger, apart from the instructions, dispositions and automatic
  finding/recommendation pairs you implement (cited by finding ID and report
  revision),
  and confirm that it records the operator's own explicit execution release, is
  not spent and covers your task and its stop boundary (`workflow/PROCESS.md`,
  Execution release). If it is missing, ambiguous, spent or out of scope,
  change nothing and ask the PC; an accepted or automatic finding, the PC's
  interpretation or your dispatch is no execution release.
- Verify the assigned worktree, base, starting candidate, binding snapshot,
  attempt and scratch directories and task scope before editing or launching
  a companion; report a mismatch or an unreadable snapshot instead of guessing.
- If your task names an operator pairing instruction whose scope covers it,
  read `skills/peer-implementation/SKILL.md` and `workflow/ORCA.md` (Paired RP)
  in the workflow source before launching or implementing as its host with one
  companion. That instruction already grants the alternating writing and your
  delegation; do not ask for them again. Only the current driver edits or stages, and you stay
  accountable for this task's scope, candidate, evidence and return. Without
  such an instruction, work alone.
- Implement the phase to its contract, or apply the documented correction batch
  with its recorded decisions and conditions. Develop code, tests and owning
  documents together and state durable rationale in maintained documents, never
  by citing run records. Before drafting or substantially revising those
  documents, load `write-for-humans` for explanations and `write-for-agents`
  for execution instructions under RECORDS' Writing procedure. Follow PROCESS's
  Planning and phases triggers for `maintain-glossary` and `record-decision`;
  apply them only within the assigned scope and execution release.
- Bring any change to plan intent, scope, design or architecture to the PC through
  `ask` before implementing it. Ask about missing authority or conflicting
  decisions rather than reopening a settled issue.
- Run the binding's verification as you go and its evidence step on the final
  candidate, covering the whole phase diff. Preserve failures, fix in-scope
  causes and re-run; never relabel a failure or bypass a hook. Escalate failures
  outside scope. For a pair, the final evidence precedes both completion
  assessments; follow ORCA's paired completion and settlement order.
- Implement, stage and run the binding's verification in your worktree; run
  everything else in your scratch, with temporary output pointed there, never
  in the checkout or its `.agent-workflow/`. Before `worker_done`, retain the
  evidence your report relies on in your attempt directory, as
  `workflow/RECORDS.md` requires.
- Stage or commit only the owned, intended paths; leave unrelated work alone.
- For landing, make the single phase commit from exactly the accepted tree
  through the normal hook, and compare the committed tree with it; a paired
  landing follows `workflow/PROCESS.md` (Landing).

## Return

Before drafting the report's explanations, load `write-for-humans` under
RECORDS' Writing procedure. Write `report.md` and the candidate manifest
`candidate.md` in your attempt directory: the workflow source and revision you
loaded, the binding snapshot
you worked under, the operator-guidance IDs you applied and the execution
release you checked, base, tree, commit or staged form, paths, verification
results, failures, each correction's changes and tests, and limitations. Do not mark the candidate
reviewed or accepted. For a paired task, also identify the companion and link
both completion assessments, its retained report and settlement/release evidence
from the pair records. Check PC follow-ups, stop changing the candidate, send
one `worker_done` with the report path and explicit outcome, and end the turn.
