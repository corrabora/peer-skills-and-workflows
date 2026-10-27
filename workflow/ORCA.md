# Orca mapping

Orca supervises every worker directly. The installed `orchestration` skill and
the version-matched guide its binary serves own executable discovery, commands,
flags, inbox handling, recovery and worker release; load them before any runtime
command and follow them over anything here. This page maps the process and owns
the workflow's own procedure for configuration, launch settings, investigators,
paired RPs and adjudication.

## Run and tasks

- One Run per plan unless the operator sets another boundary. Record its ID and
  runtime identity in `state.md`. On resume, bind the existing Run; create a new
  one only when none exists or the operator says so.
- Resolve the run root and scratch root once, from the PC's own canonical
  checkout, with
  `node <workflow source>/tools/resolve.mjs --repo <checkout> --run <run id>`:
  the run root `<checkout>/.agent-workflow/runs/<run id>/` exists only in that
  checkout ([RECORDS.md](RECORDS.md#where-records-live)), and the scratch root
  lies outside it ([RECORDS.md](RECORDS.md#scratch)). Pass the absolute run
  root, each worker's attempt directory and its scratch directory, laid out as
  [RECORDS.md](RECORDS.md#layout) requires, in every task, including tasks for
  workers in other worktrees; workers never derive a root from their own
  checkout.
- One Task per unit of work, one Dispatch per attempt. Title each Task so the
  worker list reads on its own: plan, phase, role, cycle, and for reviews the
  round, seat and set (for example `plan-03 ph2 review r2 R3/D`).
- Every task spec is self-contained: target repository and worktree, candidate
  identity, the role skill to use, the absolute path of the binding snapshot
  the task works under ([BINDING.md](BINDING.md#snapshots)) and the plan
  location, attempt and scratch directories, the absolute path of the run's
  [operator-guidance ledger](RECORDS.md#operator-guidance) with the entry IDs
  that govern the task and their scope and stop boundary stated explicitly
  (for an RP, its [execution release](PROCESS.md#execution-release) entry
  named apart from the instructions, dispositions and automatic pairs it
  implements, citing automatic pairs by finding ID and report revision; for a
  paired RP, also the items in [Paired RP](#paired-rp)), mutation boundaries
  and observable completion. Before drafting it or substantive
  follow-up instructions, the PC loads `write-for-agents` under
  [Writing](RECORDS.md#writing). The PC writes it to `task.md`
  in the attempt directory before launch.
- Use real dependencies only; review Tasks depend on the candidate, adjudication
  on the four reviews.

## Configuration

Worker settings are a catalog of named **worker profiles** (unrelated to a
target's quality profiles), each naming an agent (engine), model and effort,
plus **assignments** of each role and review seat to a profile name. Several
profiles may use one engine with different models or efforts, and every role
and seat chooses its profile independently. The roles
are `responsible-party`, `adjudicator-1`, `adjudicator-2` and `investigator`;
the seats are `R1`–`R4`.

Layers, lowest precedence first:

1. **Shared defaults:** [defaults.yaml](../defaults.yaml) in the workflow source.
2. **Repository:** `<checkout>/.agent-workflow/config.yaml`.
3. **Plan:** `<checkout>/.agent-workflow/plans/<plan>.yaml`.
4. **Phase:** the `phases: <id>:` section of that plan file.
5. **Operator:** an explicit instruction for the run or for one worker,
   recorded in the [operator-guidance ledger](RECORDS.md#operator-guidance).

Each file layer may contain `profiles`, `roles` and `review-seats` sections in
the shape of the shared defaults. A later layer replaces a same-named profile
whole and replaces individual role or seat assignments; everything else carries
through. Every role and seat must end assigned to a defined profile with all
three fields, or resolution fails.

Configuration files carry no version field. Unknown sections, roles, seats and
profile fields, and values of the wrong shape, fail resolution rather than
being ignored. A change to the shape or to the shared defaults ships together
with the matching documentation and tool change and is announced to the
operator, so a local file written for the old shape fails loudly instead of
being reinterpreted. The resolver reads only and prints JSON: the workflow
source, the canonical checkout, its local workflow directory and (with `--run`)
the run root and scratch root; each consulted layer and whether it was present;
each role's and seat's profile, agent, model and effort with the layers that
assigned it (`assignedBy`) and defined the profile (`profileFrom`); and the
merged profiles with their source layer.

`.agent-workflow/` is the checkout's ignored local workflow directory: the
local binding ([BINDING.md](BINDING.md)), configuration and plans at its top,
run records under `runs/` ([RECORDS.md](RECORDS.md#where-records-live)). It
does not travel with a clone and does not appear in other worktrees, so the PC
alone resolves configuration, from its own checkout; workers reach their
assigned records and binding snapshot only through the absolute paths the PC
passes them. Repository and plan settings are the
operator's local choices; the RP edits maintained configuration such as the
shared defaults under the single-writer rule.

At initialization, and whenever the plan, phase or an operator instruction
changes, the PC resolves the configuration with `tools/resolve.mjs`, adding
`--plan`, `--phase`, and operator overrides as `--profile <name>=<agent>,<model>,<effort>`
and `--assign <role-or-seat>=<profile>`. It records the effective result and
which layer supplied each assignment in `state.md`, and passes each worker its
resolved values. If the repository's local configuration cannot be read or is
malformed, the PC reports that to the operator rather than falling back to
defaults.

## Launch settings

Launch each worker with the agent, model and effort its resolved profile names.
If a resolved model or effort is unknown or cannot be honoured, stop and ask the
operator before launching; never launch a substitute. After launch, record the
effective values the start receipt reports beside the requested ones. If they
differ or cannot be observed, say so in the state and report, never present the
requested values as observed, and do not relaunch on a different model without
the operator. Each actual discrepancy goes to the operator for a decision on
that case; there is no standing rule to continue or stop.

Give each worker a visible name `<role>-<engine>` from the engine it actually
runs on, as the coordinator skill describes, so the operator can see what is
allocated. The name is a label only: Task, Dispatch and terminal identities
and the requested and effective launch records stay as Orca reports them, and
record directories are named by role or seat, never by engine
([RECORDS.md](RECORDS.md#layout)).

## Worker communication

Workers follow their live preamble for lifecycle commands, ask the PC blocking
questions through Orca, read follow-ups at checkpoints, and send one
`worker_done` with the real report path and explicit outcome. A heartbeat is not
progress and an enqueue is not proof of reading.

When a source check before or during a wave finds a material change to the
guidance, quality selection, extensions or tooling a running worker relies on,
the PC records it, tells the affected workers which snapshot still governs
their task, and decides with the operator whether their results are relied on,
repeated or stopped ([BINDING.md](BINDING.md#refresh)); it never swaps a
running worker's snapshot.

When the operator gives guidance that affects running workers, the PC records
it in the ledger first and then sends each affected worker a follow-up naming
the entry IDs and what changes for it. In an adjudication wave the follow-up
carries the same guidance to both peers and nothing from the other peer outside
the [barrier](#adjudication-barrier)'s checkpoints. A worker that finds its
scope unclear or missing asks the PC. Copies and summaries of operator guidance
in other records or messages add no authority of their own. Direct operator
instructions and higher-priority guidance still govern, even before they reach
the ledger: a worker that receives operator guidance directly passes it to the
PC, which records it and carries it to the other affected workers as above,
with no added approval step.

## Investigators

The PC launches an investigator on its own initiative or when an adjudicator
asks for one, using the worker profile assigned to the `investigator` role
unless the operator directs otherwise. The task states one bounded question,
the candidate identity, its attempt directory and its exclusive scratch
directory ([RECORDS.md](RECORDS.md#scratch)), and the mutation boundaries in
[PROCESS.md](PROCESS.md#roles). The PC passes the report to whoever asked.
The assignment tells the investigator to read [Writing](RECORDS.md#writing)
from the supplied workflow source and load `write-for-humans` before drafting
its explanation, preserving observed results and proof limits.
Investigators never write the authoritative candidate.

## Paired RP

A paired RP ([PROCESS.md](PROCESS.md#roles)) is one RP Task whose host
launches its companion as its own helper in the same Run and the RP's
worktree, through the live guide's worker-launched helper procedure. The
companion's questions, escalations and `worker_done` reach the host.

- **Settings.** The host runs on its resolved `responsible-party` profile. The
  companion has no configuration role, and none is added; the resolver rejects
  unknown roles. The PC applies peer-review's defaults to the host's resolved
  profile: opposite engine, the selected engine's operator-configured model and
  the host's effort or its supported equivalent. Recorded operator choices
  override their respective fields; resolve the model for the selected engine.
  If the PC cannot establish the requested values, it asks the operator before
  dispatching the RP.
- **Task.** The RP task also names the pairing entry, apart from the execution
  release, with its scope; the companion's requested settings and their source;
  and the pair record and scratch paths ([RECORDS.md](RECORDS.md#layout)).
  The host writes the companion's brief to its `task.md` before launch, under
  [Writing](RECORDS.md#writing): the workflow source, ledger path and entries,
  release entry, binding snapshot, worktree, base, starting candidate and scope
  of its own task; its pair paths; `skills/peer-implementation/SKILL.md`; and
  the RP rules that bind it: it never writes the ledger, follows the RP's
  scratch rules, stages owned paths only while driving, asks through the host
  and launches no peer.
- **Launch and identity.** [Launch settings](#launch-settings) apply to the
  companion, with the host recording its requested and effective values in its
  pair records. The host titles the companion's Task as its own with
  `companion` added, names it `rp-companion-<engine>` from its effective
  engine, and reports those values and the companion's Task, Dispatch and
  terminal identities to the PC right after launch and in its report; the PC
  records them in `state.md`. A discrepancy or unobservable value goes to the
  PC before the pair relies on the companion.
- **Launch failure.** If Orca refuses or fails the launch, including at a
  nesting limit, the host gives the PC the exact receipt through `ask` and
  follows the live guide's recovery within existing authority. It neither
  continues alone nor launches a duplicate. Unresolved capacity, settings or
  scope goes through the PC to the operator; safe authorized recovery needs no
  repeat approval.
- **Completion.** Before either peer's final completion assessment, the
  binding's verification and evidence step must cover the final candidate.
  Either driver may run it; the RP host validates and retains the result once,
  and both peers assess against it. After joint completion, freeze the
  candidate and stop edits. The host validates the companion's `worker_done`
  against its child Dispatch, retains its support and completes its release
  through the live guide. The host then finalizes one RP report before sending
  its own `worker_done` to the PC, linking both assessments, the companion's
  final report, identities, settings and settlement/release evidence. Pair
  agreement supplies no formal review credit.
- **Elevation.** Routing through the host gives it no veto. The host relays the
  companion's elevation, question or operator-facing position to the PC
  unchanged alongside its own, and the PC relays it unchanged to the operator
  ([Worker communication](#worker-communication)).
- **Transitions.** The PC starts a review wave on the candidate, or a
  replacement RP, only after the host's `worker_done` or proven exit and
  evidence that the companion is settled and released or proven exited, so
  that no pair member can still edit. It checks both identities against the
  host's report and the live guide's worker listing.
- **Recovery.** Uncertain liveness of either peer means wait and inspect; it
  never permits another writer, a stop or a relaunch. When an established
  companion fails or is lost after launch, the host stops edits, retains the pair state and
  gives the PC the exact receipt through `ask`; it neither continues alone nor
  replaces the companion within the attempt. When the host fails or is lost,
  the PC follows the live guide's recovery for the host and its companion.
  Either way, continuing the pair takes a replacement RP: the next RP attempt
  with a fresh host and companion, started only after both predecessors are
  settled or proven exited, under the same unspent release, pairing entry and
  binding snapshot without another approval. It receives the predecessor's
  pair records and restores the driver, turn, pending check, dispute positions
  with their round counts and recorded decisions before any edit, and reports
  what cannot be recovered rather than reconstructing it. Missing state or
  authority goes through the PC to the operator.

## Adjudication barrier

Adjudicators stay in their Dispatch through the whole wave and use blocking
`ask` as the barrier between stages:

1. First, ask the PC to confirm attempt and scratch directories and mode
   (fresh assessment or continuation, see recovery below).
2. After freezing the initial report, ask "assessment ready" with its path.
3. The PC answers both pending questions with the same finding map and the
   same pair of frozen initial reports, and closes explicitly any finding that
   pair already settles under the requirement-strength rule in
   [ADJUDICATION.md](ADJUDICATION.md#reconciliation), with zero discussion
   rounds. Include both human-disposition judgments and the result under
   [ADJUDICATION.md](ADJUDICATION.md#human-disposition-judgment); a disagreement
   on that judgment promotes it to yes without another round for that
   difference.
4. After freezing each discussion response, ask "response ready" with its path
   and stay blocked. When both responses of the round are frozen, the PC replies
   to both peers with the same finding map and the same current frozen pair
   (the two responses just given, by path), stating for each finding whether it
   is open, agreed (and on which basis) or at its round limit, and its
   completed-round count, plus both human-disposition judgments and their
   resulting classification for the current recommendation. A finding that
   pair settles under the
   requirement-strength rule, or, now that a round has completed on it, under
   the severity rule ([ADJUDICATION.md](ADJUDICATION.md#reconciliation)), is
   closed in the same reply, counting the round just completed, without a
   confirmation round. When no finding remains open, that reply also closes
   reconciliation explicitly; closure accompanies the pair and never replaces
   it, since each final reports the other peer's current position and reasons.
5. Only after closure does each peer freeze its final report and send
   `worker_done`.

The PC keeps what it sends at each checkpoint, the frozen pair, finding map
and any closure, in the wave's adjudication checkpoints
([RECORDS.md](RECORDS.md#layout)).

Initial assessments are not discussion rounds; each finding has at most three
completed discussion rounds ([ADJUDICATION.md](ADJUDICATION.md)). Service both
peers concurrently: while one question waits for its peer, inspect the inbox
without consuming it as the guide describes, and answer clarification questions
that block the other peer. A timeout means keep waiting; it is never a failure
or a completed round.

## Adjudicator recovery

When an adjudicator's Dispatch fails or is lost, the PC starts a replacement
Dispatch in the next attempt directory of that peer
([RECORDS.md](RECORDS.md#layout)); the predecessor's directory and frozen files
are preserved and never written again.

- **Continuation.** If the predecessor froze an initial report, the replacement
  receives it and every completed discussion response with the round count per
  finding, continues from the next round, and writes no new initial.
- **Fresh assessment.** If no initial was frozen and the predecessor had no
  peer exposure (it never received the peer's initial, the finding map or any
  response), the replacement writes a fresh independent initial.
- **Uncertain independence.** If it is unclear whether the predecessor saw peer
  material before freezing an initial, the PC asks the operator how to proceed.

A replacement uses the predecessor's recorded effective engine, model and
effort, not whatever the configuration resolves to now, and the PC verifies the
replacement's effective launch values match. If that configuration is
unavailable or the match cannot be verified, the operator decides before the
recovery goes ahead. A replacement also receives its wave's binding snapshot,
never a newer one published since ([BINDING.md](BINDING.md#snapshots)).

## Settlement

The PC validates each direct worker's `worker_done` against the expected Dispatch;
a paired RP host handles its child as [Paired RP](#paired-rp) describes. Before
releasing the worker, confirm that its outputs are in its attempt directory and that the
support they cite is retained in the records, with no link into scratch
([RECORDS.md](RECORDS.md#supporting-evidence)). Release settled workers rather
than reusing their contexts across waves, and do not keep workers alive while
the operator considers a report. Releasing a worker never authorizes deleting
worktrees.
