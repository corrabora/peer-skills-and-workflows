# Ephemeral records

Run records give fresh contexts continuity. They are never staged, landed or
cited as authority by maintained documents. Do not delete them on worker
release; the operator may still be reading them.

A new Run starts with an empty findings log and an empty
[operator-guidance ledger](#operator-guidance). Earlier runs' records are
history: they inform only when the operator brings them in.

## Writing

Before drafting or substantially revising prose, load the writing skill for
its purpose: [write-for-agents](../skills/write-for-agents/SKILL.md) for tasks,
handoffs and instructions another agent will execute;
[write-for-humans](../skills/write-for-humans/SKILL.md) for explanations,
findings, rationale and decision briefs, including those workers pass through
the PC to the operator. Mixed artifacts use each skill for its own sections.
Mechanical record updates and exact quotations need no rewriting.

Resolve skills under `skills/` in the workflow source supplied to the worker,
or the source the entry skill resolved, and load them through the engine's
supported mechanism. Each fresh worker loads its own dependencies; a PC's
earlier load supplies no worker context. Load conditional skills when their
branch applies, and do not reinvoke one already handling its sections. If a
required skill or reference is unavailable, name its path and the work it
blocks to the PC, or to the operator when acting as PC or binding directly.
Continue independent authorized work without drafting the dependent prose.
Report the dependency failure without previewing the blocked artifact's
findings, rationale or recommendations, including in replies.

The audience skills invoke [clarify-artifact](../skills/clarify-artifact/SKILL.md)
when needed. Workers route its question through their existing blocking `ask`
to the PC; the PC uses settled sources or asks the operator for an unresolved
choice. Once answered, return to the pending writing step within the same
assignment and authority. A clarification brief or writing receipt does not
complete the role's task or replace its lifecycle communication.

Apply the writing skills within the governing artifact format and role
boundaries. Preserve mandatory report content, complete finding briefs,
evidence limits, dissent and the role's required closing report; a saved-file
receipt alone does not satisfy those obligations. Keep operator quotations
exact and apart from interpretation. Writing skills supply authoring methods,
not new target-repository review clauses, execution permission or candidate
editing rights. Durable glossary and decision work follows
[Planning and phases](PROCESS.md#planning-and-phases).

## Where records live

Records live in the PC's own checkout, in its local workflow directory: each
run has its own root, `<checkout>/.peer-skills-and-workflows/runs/<Orca run id>/`, beside
the local binding ([BINDING.md](BINDING.md)) and the checkout's local
configuration ([ORCA.md](ORCA.md#configuration)). The
operator can watch progress there and clean up by removing a run's directory.
`tools/resolve.mjs` computes the run root from the canonical checkout path with
the host's path rules, accepts only a run ID that is one plain name (letters,
digits, `.`, `_` and `-`, starting with a letter or digit, never `..`), and
creates nothing.

Before writing any record, the PC establishes local storage through the
binding skill ([BINDING.md](BINDING.md#local-storage)): nothing under
`.peer-skills-and-workflows/` tracked and the directory ignored, through an existing rule
or the narrow rule it adds to Git's local exclude file, verified with Git.
When that reports a conflict, the PC writes nothing and asks the operator; it
never untracks files or edits a repository's shared ignore rules.

Ignored files do not travel with a clone and do not appear in other worktrees.
The PC resolves the run root once, from its own canonical checkout, and passes
that absolute path to every worker, in every worktree
([ORCA.md](ORCA.md#run-and-tasks)); no worker derives a root from its own
checkout or expects the directory to exist there.

This is retained state, not temporary storage or a cache: nothing evicts it,
releasing a worker never removes it, and only the operator decides when to
discard it. Removing the checkout, or a clean that includes ignored files,
removes its records too, so that is the operator's call as well. Records move
only at the operator's explicit direction, and a move keeps their contents
unchanged and their published links working, for example by leaving a link at
the old location.

Transient work does not belong here; it goes to the run's machine-local
[scratch](#scratch), outside the checkout.

## Layout

This layout is mandatory, and this page is its only owner: the PC and every
role skill follow it, the PC assigns each worker's exact paths from it, and
each worker checks the paths in its task against it and reports a mismatch to
the PC instead of guessing.

```text
<run root>/
  report.md                     PC: operator entry to the current report, a link, never a copy (Operator entry)
  operator-guidance.md          PC: the run's one ledger of operator guidance (Operator guidance)
  state.md                      PC: current position, linking the entry and the current report (templates/state.md)
  findings.md                   PC: cumulative findings and dispositions (templates/findings.md)
  control/                      PC: resolved configuration, scripts and coordination receipts
    binding/<NNN>/              PC: binding snapshot: binding.md and binding-sources.json as dispatched (BINDING.md, Snapshots)
  cycles/<NNN>/                 one per candidate
    rp/<NNN>/                   one per RP attempt: task.md, candidate.md (templates/candidate.md), report.md
      evidence/pair/<peer>/     paired RP only: host or companion; positions, handoffs, checks, completion assessments
    investigations/<NNN>/       investigator outside any wave: task.md, report.md
    waves/<NNN>-round-<r>/      one per review wave of this candidate, e.g. 001-round-1
      allocation.md             PC: the four-set clause allocation this wave used
      report.md                 PC: wave report (templates/report.md)
      revisions/<NNN>/report.md PC: report revised after an operator decision
      evidence/                 PC: shared verification record and candidate material, kept once
      reviews/<seat>/<NNN>/     R1–R4, one per attempt: task.md, review.md
      adjudication/
        checkpoints/<NNN>/      PC: each paired checkpoint's frozen pair, finding map and closures
        <peer>/<NNN>/           A or B, one per attempt: task.md, initial.md, responses/<NNN>.md, final.md
      investigations/<NNN>/     investigator serving this wave: task.md, report.md
  handoffs/                     PC, only on operator request
```

Any worker attempt directory may also hold `evidence/` and `probes/` for its
retained support ([Supporting evidence](#supporting-evidence)).

- **Names.** Structural directories and principal files are named exactly as
  shown. Ordinals are three-digit and zero-padded, starting at `001`.
  Response files number one attempt's frozen responses in sequence and restart
  at `001` in every new attempt, a continuation included: a replacement in
  `B/002/` that resumes at a finding's second discussion round writes
  `responses/001.md`. Checkpoint `001` holds the PC's initial paired reply, and
  each later paired checkpoint takes the next ordinal. Completed discussion
  rounds are counted per finding in the responses and checkpoints themselves,
  never inferred from a file name.
  Directories are named by role or seat (`rp`, `R1`–`R4`, `A` for
  `adjudicator-1`, `B` for `adjudicator-2`, `investigations`), never by engine,
  model or effort: those are metadata, recorded in `state.md`, the task and
  the worker's output. Visible worker labels stay `<role>-<engine>` as
  [ORCA.md](ORCA.md#launch-settings) describes.
- **Attempts.** Every new direct worker gets the next attempt directory of its role
  or seat: a first worker, a replacement for a failed or lost one, a landing
  RP and a rerun to produce evidence again alike. A predecessor's directory and
  files stay as they are and are never written again.
- **RP pairs.** An operator-directed companion belongs to its host's RP attempt,
  not a second `rp/<NNN>/` attempt. Each peer writes its pairing records in that
  attempt's `evidence/pair/host/` or `evidence/pair/companion/`; the RP host writes
  the companion's `task.md` there before launch, and the companion owns its
  remaining outputs there. The host still owns the attempt's `candidate.md` and
  `report.md`. The PC assigns these paths in the RP task and creates both
  matching scratch directories under the run's scratch root, applying the
  [Scratch](#scratch) containment and link checks. The host verifies the assigned
  companion paths before launch. This mapping supplies the pair's output and
  scratch locations; solo attempts keep their existing layout.
- **Waves.** Waves are numbered in order within their cycle and carry their
  review round, so repeated waves of one round never compete for a directory.
  Each wave's report sits in its own directory.
- **Tasks and outputs.** Before launch the PC writes each direct worker's complete
  task spec to `task.md` in its attempt directory, naming the binding snapshot
  the task uses; the worker reads it and never edits it. Each worker writes only its principal files and its own
  `evidence/` and `probes/`. Material of the PC's that has no place above
  goes in `control/`.
- **Nothing else.** Optional directories (`control/`, `investigations/`,
  `revisions/`, `evidence/`, `probes/`, `responses/`, `checkpoints/`,
  `handoffs/`) are created only when needed. Add no other structural
  directories, such as engine-named substitutes or top-level folders for
  notes, operator additions or instruction updates. Inside `control/`, `evidence/` and `probes/`,
  organize as the content needs.
- **Immutability.** A published report or response is never overwritten; a
  revision, including one that records an operator decision, is a new file.
  The run-root `report.md`, `state.md` and `findings.md` are living records
  instead, kept current in place: the entry only points at the current report
  ([Operator entry](#operator-entry)), and the other two follow
  [State](#state) and the [Findings log](#findings-log).
  `operator-guidance.md` is both: its entries are append-only and its current
  view is living ([Operator guidance](#operator-guidance)).
- **Instruction revision.** The PC records in `state.md` the workflow source
  identity it loaded, and each worker records the same in its principal output.
  Run `node "<workflow source>/tools/bind.mjs" inspect --repo "<checkout>"`
  and use its `workflowSource`: `path`, `digest` and `digestScope`, plus `head`
  and `dirty` when supplied. This read-only inspection needs no existing binding.
  A copied plugin has a content digest and no Git commit; a checkout also
  reports its commit and instruction-scope changes. Do not run ad hoc Git
  commands in an installed plugin to obtain a revision. If the helper or its
  source identity is unavailable or incomplete, record the identity as
  unverified with the reported cause; do not invent a commit or reuse an old
  digest as current. Simultaneous runs on different instruction revisions can
  then be told apart.
- **Prospective.** The layout governs directories created after it is adopted.
  Records written under an earlier layout keep their paths and published
  links; nobody migrates, renames or deletes them to match.

Evidence that a repository's own tooling writes stays where the binding says;
records reference it or keep a snapshot in an `evidence/` directory. A wave's
shared `evidence/` names the binding snapshot the wave used.

## Scratch

Transient work never happens inside the developer's checkout, including its
ignored `.peer-skills-and-workflows/` tree: editors and their plugins watch that tree
whether Git ignores it or not. Each run has a machine-local companion scratch
root, which `tools/resolve.mjs --run` reports as `scratchRoot`:
`<machine base>/scratch/repositories/<repository key>/runs/<run id>/`. The
machine base is the per-user application-data location of the host
(`~/Library/Application Support/PeerSkillsAndWorkflows` on macOS,
`%LOCALAPPDATA%\PeerSkillsAndWorkflows` on Windows, `$XDG_STATE_HOME/peer-skills-and-workflows` or
`~/.local/state/peer-skills-and-workflows` elsewhere), found through Node's host, home,
environment and path facilities. The repository key is the checkout's folder
name and a digest of its canonical path. `scratch/` is a namespace of its own:
it never holds run records, earlier record locations or links forwarding to
them, or a runtime's state. The resolver refuses a scratch root that would lie
inside the checkout, and creates nothing.

- **Assignment.** A worker's scratch directory has the same run-relative path
  under the scratch root as its attempt directory under the run root, for
  example `<scratch root>/cycles/001/waves/001-round-1/reviews/R2/001/`. The
  PC creates it for that worker alone, checks that its canonical path lies
  outside the canonical checkout and that nothing in it links back into the
  checkout, and passes both absolute paths in the task. The worker confirms
  both before working.
- **Use.** Writable probes, fixtures, copied source, generated output, build
  and test caches and temporary files go there. Point the temporary-directory
  variables (`TMPDIR`, `TMP`, `TEMP`) and any tool-specific output or cache
  settings of the commands you run into it; never redirect the user's home or
  an engine's configuration directory. Read-only inspection may read the
  checkout. A command that can write runs against a materialized candidate in
  scratch instead: a private copy of the pinned tree, checked against the tree
  ID, or a separate worktree outside the checkout where a copy does not
  suffice. Git refs, stashes and configuration stay protected
  ([PROCESS.md](PROCESS.md#roles)).
- **RP.** The RP's authorized implementation, staging and the binding's
  verification commands run in its assigned worktree; everything else it
  writes, including those commands' temporary output, goes to scratch.
- **No links.** No link from the checkout or the run records leads into
  scratch, and no record depends on it. Removing scratch, once a worker's
  support is retained, never breaks a record; when to remove it is the
  operator's call.

## Supporting evidence

Records, not scratch, carry the evidence for every claim.

- **Each finding stands on its own support,** whichever set raised it:
  expected and observed behavior, the candidate path and line or the
  situation, and how it was shown, by inspection or reproduction. Static
  inspection can suffice. No finding needs a new probe or test by default, and
  nobody reruns the repository's gates only to have evidence.
- **Retain before release.** Before sending `worker_done`, a worker copies
  what its claims rely on (commands, inputs, scripts, results and the candidate
  references they apply to) from scratch into its attempt's `evidence/`
  (captured results) and `probes/` (scripts and inputs that reproduce them),
  and links its report to those retained copies, never to scratch. A retained
  copy of a source or fixture tree is packaged as an archive, not left as a
  live tree. Keep failed attempts and limits that matter to a claim; leave out
  unrelated scratch, private transcripts, caches and whole scratch trees.
- **Shared once.** The verification record a wave relies on, and candidate
  material several of its workers need, are kept once by the PC in the wave's
  `evidence/` (or referenced there, when already retained in the RP's
  attempt). Workers cite them instead of copying them, and a worker's own
  `evidence/` holds only what is unique to it; a rerun that matches the shared
  record is noted, not copied.
- **Adjudicators** inspect the retained evidence independently and may
  reproduce or investigate in their own scratch where useful, retaining what
  they rely on the same way. The adjudication barrier and its full pair, map,
  states, bases and counts are unchanged
  ([ORCA.md](ORCA.md#adjudication-barrier)).

## Operator guidance

`<run root>/operator-guidance.md` is the run's one place where operator
guidance is captured, from [the template](templates/operator-guidance.md):
requests and constraints, clarifications, finding dispositions, policy and
design choices, authorizations, scope and stop-boundary changes, binding
decisions the operator makes during the run and run or worker overrides. A
continuing preference the operator wants kept beyond the run also reaches the
local binding ([BINDING.md](BINDING.md#the-binding-file)), quoted from its
entry. No other file or directory
captures it, such as per-cycle decision or authorization files. State,
findings, reports and tasks cite its entry IDs.

The ledger preserves wording and provenance; it confers no authority of its
own. Authority stays with the operator's instructions and the target's
maintained guidance ([PROCESS.md](PROCESS.md)). The ledger never overrides a
higher-priority instruction or adds an approval step to work already
authorized, and recording routine guidance needs no confirmation from the
operator. Maintained documents never cite it: a rule the operator wants kept
beyond the run reaches its owning document through an RP change. Guidance from
an earlier run applies only when the operator brings it in, as a new entry.

- **Writer.** Only the PC writes the ledger. Workers read the entries their
  task names, ask the PC when scope is unclear or missing, and never record or
  author an operator decision.
- **Entries.** Record each piece of guidance as it arrives, before acting on
  it, as the next entry: `OG-0001`, `OG-0002` and on, in order, never reused or
  renumbered. The instruction that starts a run is the one exception in
  degree: the ledger lives under the run root, so establishing safe local
  storage, the binding, the Run and the run root precede its entry as
  prerequisites ([BINDING.md](BINDING.md#local-storage)); the PC writes that
  entry as soon as the run root exists, before any dependent action, with the
  time it observed the instruction as Received, or `unknown` only when that
  time was not observed. Each entry keeps the operator's exact wording apart from the PC's
  interpretation; the date received and recorded; its source; and the
  question, proposal or brief it answers, linked, so that a short answer such
  as "accepted", "agreed" or "100%" carries exactly that scope. It then states
  scope and conditions, the disposition and the execution permission
  separately (accepting a finding or proposal permits no implementation, round
  or landing the wording does not grant), the stop boundary, and the entries
  it refines or supersedes.
- **Unknowns.** Record what is missing or ambiguous as `unknown` and ask the
  operator where it matters. Never reconstruct a quotation, a time or an
  approval that was not observed.
- **Append only.** An entry is never rewritten. A correction, clarification,
  revocation or change of direction is a new entry naming what it supersedes;
  the earlier wording stays.
- **Current view.** The top of the file holds a living view of the directives,
  authorizations with their stop boundaries, and dispositions currently in
  force, each by entry ID, and of entries superseded or spent. It is derived
  navigation, kept current like `state.md`. Updating it authorizes nothing;
  where it disagrees with an entry, the entry governs and the PC corrects the
  view.
- **Raw material.** Conversation excerpts, Orca receipts and other evidence of
  what the operator said stay where the layout allows, such as `control/`, and
  are linked from the entry they support; they are not competing records.
- **Propagation.** Every task names the ledger's absolute path, the entry IDs
  that govern it, and their scope and stop boundary in its own words
  ([ORCA.md](ORCA.md#run-and-tasks)). Guidance that arrives while workers run
  is recorded first, then sent to the workers it affects with its IDs
  ([ORCA.md](ORCA.md#worker-communication)). Each worker names the IDs it
  applied in its principal output.
- **Projections.** `state.md` names the entries in force; the findings log
  records each disposition by entry ID; a report or revision quotes the
  decisions it presents and cites their IDs, so it still reads on its own. The
  [operator entry](#operator-entry) remains the way to the current report; the
  ledger is not a report.

### Adopting earlier records

A run that captured guidance before this ledger existed adopts it into the same
single ledger; nothing else is created. The PC creates `operator-guidance.md`
and, in its earlier-records section, links each earlier source it has verified,
noting what it covers and that the list may be incomplete. It records as
entries the decisions still in force that it can establish, each linking its
source and quoting only wording that source preserves verbatim, otherwise
`unknown`; grades and decisions stay as the sources give them. Earlier files
are never moved, renamed, edited or copied wholesale
([Prospective](#layout)). Adoption is not a migration project: start from what
is known, do not re-ask settled instructions, and mark gaps rather than
reconstructing history. From then on, new guidance goes only to the ledger.

## Operator entry

Every run exposes `<run root>/report.md`, at the top of the run root that
`tools/resolve.mjs` resolves (never a root derived from a worker's or another
checkout), as the human operator's entry to the current report: the latest fully
published wave report or report revision. The operator opens this one path at
every gate instead of searching wave directories.

- **Form.** Prefer a relative symbolic link from the entry to the current
  report, for example to `cycles/<NNN>/waves/<NNN>-round-<r>/revisions/<NNN>/report.md`;
  it opens the actual report and copies nothing. Where the host or filesystem
  cannot create one, write a small Markdown pointer at the same path instead:
  which wave or revision is current, and one relative link to it. That costs
  the operator one extra click. Never copy a report body into the entry. A
  relative entry keeps working when the operator moves the whole run directory.
  A viewer may resolve the report's own relative links from the entry's
  location; the actual path, named in `state.md` and the report's opening,
  then serves.
- **Refresh and verify.** After publishing each wave report or revision, and
  before announcing every operator gate, clean review and completed adjudication
  alike, the PC points the entry at the latest fully written report and checks
  that it opens that existing, readable file. Never announce a gate while the
  entry is missing, broken or stale; correct it first, or tell the operator
  what failed.
- **Ownership.** The entry belongs to the PC, which updates only an entry it
  created, as `state.md` records. The reports it points to stay immutable in
  their wave directories. If something else already occupies the path, such as
  a regular file that is not the PC's pointer, leave it and raise the conflict
  with the operator rather than replacing it.
- **At the gate.** `state.md` names both the entry and the actual current
  report path, and the gate conversation gives the operator a clickable link to
  the entry. The link never replaces presenting each finding
  ([Operator dispositions](#operator-dispositions)).

## State

`state.md` names the Run and runtime, PC, workflow source and the revision
loaded, the local binding with its last source check and the current binding
snapshot, plan and phase, stage, cycle, candidate, round and wave, the run root
and scratch root, the operator entry with its form and the actual current
report path it opens, the operator-guidance entries in force with the
authorization and stop boundary they set, the resolved
configuration, live tasks and their requested and
effective engine/model/effort, any worker that could not be given its visible
name, pending questions, the finding under operator discussion with the
remaining disposition queue, and the next permitted action.
Keep it current at every transition, and reconcile it with Orca after any
interruption.

## Findings log

`findings.md` keeps one row per stable finding ID (`F-0001`, never reused) for
every finding of every severity, `note` included and whichever set raised it,
and records, separately: the source sets and grades as reported; the peer
result (agreed, by explicit assent, under the requirement-strength rule or
under the severity rule with both actual grades and the completed-round count
([ADJUDICATION.md](ADJUDICATION.md#reconciliation)); dissent; needs operator
decision); both human-disposition judgments and reasons, the resulting
classification and its basis ([ADJUDICATION.md](ADJUDICATION.md#human-disposition-judgment));
the operator's decision, summarized with the
[operator-guidance](#operator-guidance) entry IDs that hold its exact wording,
date and conditions; implementation status; and verification status. Do not collapse them into one
"closed" flag, and never keep an observation off the log because it is
informational or outside its reviewer's set.
Record each operator answer immediately, in the ledger first; a question or
silence is not a decision ([operator dispositions](#operator-dispositions)).

## Report

`report.md` is what the operator reads at the gate, using
[the template](templates/report.md): subject and coverage, a compact resolution
table, then a complete brief for every finding, `note` included. Each brief
starts with **Finding summary**, **Underlying findings** (links to the source
findings, with their sets and grades as reported) and **Recommendation**, then
the substantive rationale, applicable objectives and clauses, evidence and its
limits, initial and final peer positions, agreement and its basis (for the
severity rule: both actual grades, the agreed higher grade and the
completed-round count) or dissent, alternatives and tradeoffs, and the exact
operator decision, quoted with its ledger entry ID, or remaining work. The report must read on its own without
opening worker reports. The operator reaches the current one through the
run-root [operator entry](#operator-entry).

Include both human-disposition judgments and reasons and the resulting
classification and basis for every finding/recommendation pair, automatic
pairs included. Automatic is a peer classification, not an operator decision;
leave the latter unmade unless the operator actually supplied one. Keep each
automatic pair's full brief and supporting evidence available for operator
override.

## Operator dispositions

After each completed adjudication wave, never between peer discussion
responses, the PC validates and publishes the full report, refreshes and
verifies the [operator entry](#operator-entry), and then proactively takes the
operator through it in the active operator conversation. First list the
**automatic** finding/recommendation pairs, each with its ID, a concise problem
and its exact recommended action, before starting the disposition queue. Use
the adjudicators' final judgments and the mandatory-change check under
[ADJUDICATION.md](ADJUDICATION.md#human-disposition-judgment); never invent an
automatic classification. Tell the operator the full report supports review
and override of this list. No per-item confirmation or waiting period is
needed for automatic pairs. Record their classification in the findings log
and report, without inventing a human decision or ledger approval.

The queue contains the remaining pairs requiring human disposition, in report
order unless the operator chooses another, plus any automatic pair the
operator calls up for disposition. A changed recommendation, including one
the PC chooses from ambiguous options, requires disposition rather than
inheriting the old pair's automatic classification. A `note` uses the same
judgment as any other severity; being informational or from outside its
reviewer's set never makes the review clean.

1. **Present one finding.** The operator reads the published report alongside
   the conversation, so present the finding briefly without reciting its
   complete brief:

   - **Finding:** its ID, severity and the exact problem: what is wrong and
     where.
   - **Recommendation:** one concrete action. Give the adjudicators' agreed
     action when it is concrete. When they left alternatives, a conditional or
     vague remedy, or no agreement, choose one concrete action and label it as
     the PC's recommendation, not theirs.
   - **Why:** the reason, only when it does not follow plainly from the
     finding.
   - **Adjudicators:** whether they agreed, naming the requirement-strength or
     severity rule when either produced the agreement; otherwise say they did
     not agree and name the decisive difference.
   - **Decision needed:** the exact disposition asked for, with any condition,
     proof gap or proposed change to plan intent, scope, design or architecture that
     bears on it. When a finding is an unmet condition of an accepted
     correction, present that decision as standing and discuss the remaining
     work, not whether to reverse it, unless there are new grounds
     ([PROCESS.md](PROCESS.md#wave-cycle)).

   A report link, a batch summary, a recommendation on its own or decision
   questions about several findings at once do not substitute.
2. **Stay on it.** Answer questions and explore alternatives on that finding,
   giving any part of its complete brief the operator asks for, until the
   operator gives a clear disposition: accept, with any conditions;
   choose an alternative; reject or make no change; or defer explicitly.
   Discussion, questions, silence and peer agreement do not dispose of a
   finding, and an answer about one finding never disposes of another or
   accepts the batch. The operator may explicitly reorder the queue, park an
   item or dispose of several findings together; follow exactly what they say
   and record the disposition against each finding it covers.
3. **Record it at once.** Append the exact answer to the
   [operator-guidance ledger](#operator-guidance) with the brief it concerns,
   linked, and the recommendation and decision question exactly as you
   presented them, so a short answer keeps the scope of what was presented;
   then record the decision by entry ID in the findings log and in a new report revision,
   leaving published reports unchanged, refresh and verify the
   [operator entry](#operator-entry), and update `state.md` with the active
   finding and remaining queue.
   Then present the next finding. After an interruption, reconcile the state
   and resume at the active finding, presenting it again.

A disposition is not authorization to implement, advance a round or land; act
only within the exact authorization in force ([PROCESS.md](PROCESS.md#wave-cycle)).

When every queued finding is disposed of or parked, or the operator stops the
walk-through, summarize the automatic pairs and dispositions and ask for the exact next
authorization, or apply one recorded in the ledger that covers that exact step.
An all-automatic wave still lists its pairs and stops at this gate unless the
operator explicitly instructed the PC to proceed automatically. Record that
instruction in the ledger with the execution scope and stop boundary; proceed
only with the next steps it covers. Such an instruction never overrides a
required human disposition or permits the PC to downgrade one. The automatic
list and operator silence supply no execution release. An operator override is
recorded and applied through the same ledger, findings log and report-revision
procedure as other dispositions; do not erase the adjudicators' actual votes.
A clean review has nothing to present: report it
and stop at the gate for the operator's next authorization, without inventing a
finding.
