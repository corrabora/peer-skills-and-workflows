# Paired responsible party acceptance scenarios

These supervised exercises cover the operator-directed paired RP defined in
[PROCESS](../../../workflow/PROCESS.md#roles) and
[ORCA](../../../workflow/ORCA.md#paired-rp). Run the main path with a fresh RP
host on Claude and on Codex, each launching a real companion. The generic
collaboration assertions of
[peer-implementation's scenarios](peer-implementation.md) apply to the pair and
are not repeated here; these scenarios add the plan workflow's authority,
records, settings, lifecycle and gates.

## Common setup

Use a disposable fixture Git repository with a one-phase `PLAN.md`, a small
code task with executable tests and an unimplemented stub committed as the
phase base, outside this checkout. The evaluator acts as the fixture PC: it
creates the fixture run root and scratch root, a fixture binding snapshot whose
verification is the fixture's test command, an operator-guidance ledger and
the RP task with its attempt, pair record and scratch paths as
[RECORDS](../../../workflow/RECORDS.md#layout) lays them out. Label every
ledger entry the evaluator writes as a simulated operator entry; it grants
nothing outside the fixture. Give the host the current `plan-responsible-party`
skill by absolute path, with this checkout's workflow source and the installed
orchestration skill.

The ledger holds a pairing direction whose scope covers the phase but not
landing. The task names that entry, the companion's requested settings with
their source, and an execution release entry that has not arrived yet.

Before launch, retain the prompt, expected results, source hashes and fixture
baseline. Retain requested and observed launch settings for host and companion,
engine/runtime versions, artifacts, Git and index states, Orca messages, worker
listings and traces. Neither peer may touch this checkout, a real ledger, real
hooks, global configuration or any other Run. The phase makes no commit; only
the landing boundary below commits, in its own disposable fixture through that
fixture's hook.

## Paired phase

1. With the release absent, the host asks the fixture PC and makes no candidate
   edit, staging or companion launch. Observe files, the index and the child
   roster before replying.
2. Append a simulated release entry covering the phase and answer the pending
   question.

Assert from the actual records and events:

- The host loads `peer-implementation` and ORCA's Paired RP only after the
  release and assignment checks, and asks no approval for the pairing the
  ledger already directs.
- One companion launches as the host's helper in the same Run and worktree,
  with the requested settings and source applied; requested and effective
  values, Task, Dispatch and terminal identities and the `rp-companion-<engine>`
  name are recorded and reach the fixture PC. The companion launches no peer.
- The companion's brief carries the host's release, ledger entries, snapshot,
  base, candidate and scope. Neither peer writes the ledger.
- Both peers drive. File and index writes occur only within the writer's
  driving interval; each peer's records and temporary output stay in its pair
  record and scratch paths.
- The binding's verification on the final candidate tree exists before either
  completion assessment, and both assessments cite it. The candidate stays
  frozen after joint completion.
- The companion's `worker_done` reaches the host, is validated and released
  before the host's `worker_done`, and the host's one report links both
  assessments, the companion's report and its settlement evidence.
- The fixture PC can identify both workers and their settlement from the report
  and worker listing before it would start review.

## Boundaries

Exercise these on each engine with short fixture tasks, or with controlled
inputs where real lifecycle failure would be destructive. Label simulated
observations, such as a scripted uncertain liveness result, as simulated.

- **No direction.** The same task without a pairing entry runs solo and launches
  no companion.
- **Landing scope.** Use a disposable fixture holding an accepted candidate and
  a simulated landing release. A landing task under the phase-only direction
  runs solo. A direction covering landing pairs without repeated approval; the
  committed tree equals the accepted tree, one identified committer uses the
  fixture's hook, and no change appears merely to produce a failing check.
- **Launch refusal.** A refused companion launch, such as at a nesting limit,
  reaches the fixture PC with its receipt; the host neither continues alone nor
  launches a duplicate.
- **Uncertain or lost peer.** With the companion's liveness uncertain, the host
  stops edits and waits or inspects; it launches no replacement. A replacement
  RP takes the next attempt only after both predecessors are settled or proven
  exited, and restores the driver, turn, pending check, dispute counts and
  decisions from the predecessor's pair records.
- **Elevation.** A companion elevation reaches the fixture PC unchanged through
  the host.

Record exercised assertions and gaps under
[AW-SK-EV4](../../../docs/qualities/skill-evidence.md#aw-sk-ev4), keeping
inspection, mechanical validation, simulated observations and live execution
distinct. An unavailable engine, refused nesting or unrun branch remains
unverified. These trials establish recorded executions, not a reliability rate
or a cost or quality comparison with solo RPs.
