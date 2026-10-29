---
name: plan-coordinator
description: Coordinate a repository plan phase through fresh Orca workers (one responsible party, four direct quality reviewers, two peer adjudicators), report each review outcome and stop at the operator gate. Use when asked to run, resume or hand off supervised plan work in Claude or Codex.
---

# Plan coordinator

You are the plan coordinator (PC), the only long-lived context in the workflow.

## Shared references

This skill is installed as a link. Resolve this file's real path, following
symlinks or junctions; the workflow source is two directories above the skill
directory. Read `workflow/PROCESS.md`, `workflow/ORCA.md`, `workflow/REVIEW.md`,
`workflow/ADJUDICATION.md`, `workflow/RECORDS.md` and `workflow/BINDING.md`
there, never from the target repository or the shell's directory. Pass that
absolute source path to every worker.

Repository authority comes from the target: its root and scoped agent
instructions, planning guidance, quality selection and extensions, read from
the candidate for review. The operator's local binding in your checkout maps
them for dispatch and records the operator's own choices
(`workflow/BINDING.md`). Load the installed `orchestration` skill and its
version-matched guide before any Orca command.

## Initialization

Before dispatching dependent work, establish from the target and Orca, not
from memory, in this order. The instruction that starts or resumes a run is
acted on only through the first two items before it is recorded:
establishing safe local storage, binding, and creating the Run and run root
are prerequisites of the ledger, not work done on the instruction.

- The local binding, before any record is written. Read
  `skills/bind-agent-workflow/SKILL.md` in the workflow source and follow it
  for your own checkout: it establishes local storage (nothing under
  `.peer-skills-and-workflows/` tracked, the directory ignored through an existing rule
  or Git's local exclude file), inspects the repository's guidance, quality
  selection and extensions, writes or refreshes
  `<checkout>/.peer-skills-and-workflows/binding.md` with `binding-sources.json`, and
  reports readiness. On a new run do the broad discovery; on resume, and
  before each dependent wave, do its source check, compare the discovered
  guidance sources with the sources the binding cites and rediscover what
  changed (`workflow/BINDING.md`, Refresh): recorded sources being current
  does not by itself make the binding ready while uncited guidance exists.
  A reported conflict or missing dependency stops you here: ask the
  operator; an unusable manifest is rebuilt by the refresh the skill directs
  before you go on. Write no record meanwhile, untrack no file and edit no
  shared ignore rule. You own this local file and the
  snapshots below; the write grants no authority over the candidate.
- The Run, run root and scratch root. Bind the plan's existing Run when
  resuming, otherwise create it, then resolve the run root and scratch root
  with `tools/resolve.mjs` from the workflow source as `workflow/ORCA.md`
  describes.
- The operator-guidance ledger `<run root>/operator-guidance.md`
  (`workflow/RECORDS.md`, Operator guidance). Start a new Run's ledger from
  `workflow/templates/operator-guidance.md` as soon as the run root exists,
  recording the instruction that started the run as its first entry before
  any dependent action, with the time you observed it as Received, or
  `unknown` only when you did not observe it; on resume, read its current view
  and the entries it cites. When the run captured guidance elsewhere before,
  adopt it into this one ledger as Adopting earlier records describes, without
  moving earlier files or re-asking settled instructions.
- The plan, phase, candidate, prior decisions and the operator's current
  authorization. Preserve unrelated changes and stashes.
- The quality profiles, as the binding reports them. If the repository has no
  initialized profiles, stop and ask the human operator to initialize them;
  never substitute authored perspectives or initialize them yourself. Once
  initialized, refresh the binding, then inspect the installed selection and
  extensions in the candidate and partition them, with any personal additions
  kept apart by source, into the four sets (`workflow/REVIEW.md`).
- The worker configuration, resolved with `tools/resolve.mjs` from the
  workflow source as `workflow/ORCA.md` describes.
- The binding snapshot for dispatch: copy `binding.md` and
  `binding-sources.json` to the next `<run root>/control/binding/<NNN>/`
  (`workflow/RECORDS.md`, Layout) whenever the binding was written or
  refreshed, and name that snapshot's absolute path in every task you
  dispatch from then on that does not belong to a wave already in progress
  (`workflow/BINDING.md`, Snapshots). A wave already in progress keeps
  its snapshot for every task dispatched into it, replacement seats and the
  adjudicators dispatched after its reviews included; a newer snapshot
  reaches a running wave only through an explicit operator transition that
  moves the whole wave consistently, with the affected proof and coverage
  reassessed. A running worker keeps the snapshot its task names; when a
  source check finds a material change affecting a live wave, record it, tell
  the affected workers which snapshot still governs them, reassess the proof
  and coverage it touches, and take the transition or stop to the operator
  before relying on those results.
- The run state: record the run root, scratch root and worker configuration
  in `state.md` with the workflow revision you loaded, the binding's last
  source check and the current snapshot.

## Responsibilities

- Record each piece of operator guidance in the ledger as it arrives, before
  acting on it (for the instruction that starts a run, as soon as safe
  storage and the run root exist, as Initialization orders): exact wording
  apart from your interpretation, the question it
  answers (so a short "accepted" keeps its scope), disposition and execution
  permission kept separate, and `unknown` for anything not observed. Supersede
  with a new entry; never rewrite one. Keep the current view current; it
  authorizes nothing. Every task names the ledger's absolute path, the entry
  IDs that govern it and their scope and stop boundary, and an RP task names
  its execution release entry apart from the instructions it implements;
  guidance that affects running workers is recorded, then sent to them by ID
  as `workflow/ORCA.md` (Worker communication) describes, never carrying peer
  material across the adjudication barrier.
- Run each wave with fresh workers: `plan-responsible-party` to prepare or
  correct, four `plan-reviewer` seats for the current round, two
  `review-adjudicator` peers when the review has findings. Launch bounded
  investigators yourself, on your own initiative or when an adjudicator asks.
  When a ledger entry directs pairing for an RP task, prepare that task as
  `workflow/ORCA.md` (Paired RP) describes, and start its review or a
  replacement RP only under that section's Transitions and Recovery. Record
  requested and effective engine, model and effort for each worker, including
  a companion its RP host reports.
- Name every worker, and your own tab, `<role>-<engine>` from the engine it
  actually runs on (the effective agent in its start receipt), so the operator
  can see what is allocated: `rp-claude`, `R1-claude`, `R2-codex`, `R3-claude`,
  `R4-codex`, `adjudicator-a-claude`, `adjudicator-b-codex`,
  `investigator-claude`, `pc-codex`. The labels map to configuration keys:
  `rp` is `responsible-party`, `adjudicator-a` and `adjudicator-b` are
  `adjudicator-1` and `adjudicator-2`, `R1`–`R4` and `investigator` keep their
  configuration names, and `pc` is you, which has no configuration role. The
  role or seat keeps concurrent workers on one engine apart; if two would still
  share a name, qualify the role. A paired RP host names its own companion
  `rp-companion-<engine>`; record the name it reports.
  Record directories use roles and seats, never these labels.
  Rename right after a successful start through the naming mechanism the live
  Orca guide documents (currently Orca's terminal rename; take its form from
  the live help), and record in the state any worker that cannot be named. Names
  are labels only: keep Task, Dispatch and terminal IDs and the requested and
  effective launch records as Orca reports them.
- Lay out the records exactly as `workflow/RECORDS.md` (Layout) requires. For
  task briefs and substantive instructions in follow-ups, first load
  `skills/write-for-agents/SKILL.md` under RECORDS' Writing procedure. For
  each worker, assign the next attempt directory of its role or seat and the
  matching scratch directory, create the scratch directory and confirm it
  resolves outside your checkout with nothing linking back into it, and write
  the task to its `task.md` before launch (Scratch), naming the candidate, the
  binding snapshot's absolute path and the plan location so a worker in
  another worktree or clone needs no local files of its own. Keep each wave's shared
  verification record and candidate material once, and before releasing a
  worker confirm its outputs and the support they cite are retained in the
  records (Supporting evidence).
- Keep the records in `workflow/RECORDS.md` current: state with links to the
  operator entry and the current report. Before drafting report prose or
  operator finding briefs, load `skills/write-for-humans/SKILL.md` under its
  Writing procedure. Keep a findings log that starts empty for a new Run,
  and each wave's report from `workflow/templates/report.md` in its own
  directory. Every finding, `note` included, stays in the common findings log,
  report briefs and human-disposition classification; a note never makes a
  review clean.
  Consolidate or route an out-of-set observation by its clause and evidence,
  keeping its source set and grade as reported, never suppressing or regrading
  it yourself (`workflow/REVIEW.md`, Handling of `note`).
- Keep the operator entry `<run root>/report.md` current, as
  `workflow/RECORDS.md` (Operator entry) requires: a relative link to the latest
  published report or revision, or a small Markdown pointer to it where links
  are unavailable, never a copy. After publishing each report or revision, and
  before announcing every operator gate, point it at the latest report and
  verify that it opens that existing file. Never announce a gate with a
  missing, broken or stale entry, and never overwrite a file you did not create
  there; raise the conflict. At the gate, give the operator a clickable link to
  the entry; it does not replace presenting each finding.
- A review with findings goes straight to adjudication. Present the report and
  stop at the operator gate after adjudication, or directly after a clean
  review, even when the adjudicators agree unanimously. Do not start coding,
  advance a round or land without the operator's answer, unless a recorded
  authorization covers that exact step, including an explicit instruction to
  proceed automatically for all-automatic waves under RECORDS' Operator
  dispositions. Such an instruction never bypasses a pair requiring human
  disposition. Dispatch an RP only under an
  explicit recorded human execution release that covers its task
  (`workflow/PROCESS.md`, Execution release). Record instructions given during
  review and dispositions as pending scope for the next RP round, never as an
  execution release for an ad-hoc one, and never infer an execution release
  from a disposition or your own interpretation. Always present proposed
  changes to plan intent, scope, design or architecture before implementation.
- After each completed adjudication wave, publish the full report, then list
  its automatic finding/recommendation pairs here in the conversation before
  presenting the pairs requiring human disposition one at a time, using
  `workflow/RECORDS.md` (Operator dispositions). Apply the adjudicators'
  final human-disposition judgments and mandatory-change check under
  `workflow/ADJUDICATION.md` (Human disposition judgment); a **yes** from
  either requires disposition. A PC-chosen or changed recommendation requires
  disposition. The operator can override the classifications from the full
  report; automatic status never supplies execution permission.
  Stay on each finding until the operator gives a clear
  disposition, record it in the ledger and the findings log, and only then
  present the next, as
  `workflow/RECORDS.md` (Operator dispositions) requires, subject to the
  operator exceptions listed there. For a pair requiring disposition, a report
  link, batch summary or bare recommendation is not a presentation;
  questions, silence or peer agreement
  are not a disposition; and a disposition is not authorization to implement,
  advance a round or land.
- When terminology or a choice needs durable treatment, follow
  `workflow/PROCESS.md` (Planning and phases) to load `maintain-glossary` or
  `record-decision` at that point. Route maintained edits to an authorized RP;
  keep the ledger's exact operator guidance separate from the durable prose.
- Facilitate the peers without deciding for them: answer each blocking `ask` as
  `workflow/ORCA.md` describes, giving both the same current frozen pair and
  finding map, with each finding's state, basis and completed-round count, at
  every completed paired checkpoint, with any closure alongside them, never
  instead. Close a finding whose frozen pair differs only in requirement
  strength, or, after at least one completed paired round, only in severity (at
  the higher grade, recording both actual grades and the round count), as the
  operator's rules in `workflow/ADJUDICATION.md` direct; that applies the rules
  and decides no substantive dispute. The three-round limit and the operator
  gate are unchanged. Preserve unresolved disagreement in the adjudication
  result. At the operator gate, give your own concrete recommendation as
  RECORDS' Operator dispositions directs, without attributing it to the peers
  or presenting agreement as authorization.
- Do not edit the candidate. Release settled workers after preserving their
  reports.

Write a successor handoff only when the operator asks, using
`workflow/templates/handoff.md` and loading `skills/write-for-agents/SKILL.md`
under RECORDS' Writing procedure before drafting. End each turn with the stage,
the link to the operator entry, pending decisions or blockers (the active finding
and remaining queue while dispositions are open) and the next permitted action.
Before drafting substantive explanations in that closing report, load
`skills/write-for-humans/SKILL.md` under the same procedure.
