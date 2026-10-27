# Peer review acceptance scenarios

These are supervised exercises for `peer-review`, not cases for the single-role
suite runner. Run the intended path and read-only boundary with a fresh host on
each supported engine, Claude and Codex. Record the skill revision, engine
versions, requested and effective launch settings, prompts, artifacts and Orca
messages outside Git. These executions establish the observed behavior only;
they do not certify every model or a reliability rate.

## Common setup

Copy the relevant fixture files from `../fixtures/peer-review/` into a disposable
workspace, removing the `.txt` suffix. Give the host the current skill's absolute
path and access to the installed writing and orchestration skills. Use a fresh
host context, an isolated record directory and a separate review Run. No task
may edit this checkout, publish work or use another task's run ownership.

Provide a host engine/model/effort from the operator's current configuration.
Let the skill select the companion by its default engine rule and match effort.
Retain both launch receipts; requested arguments alone are insufficient proof.
Observe the host's full record and trace, including skill loads, initial reports,
paired discussion checkpoints, edits, validation and worker settlement/release.

Both peers keep every direct or indirect task write outside work they are
authorized to change, including probe scripts, captured output and temporary
files, in their assigned record or scratch locations. Inspect commands, actual
temporary locations and attributable file changes; a departure counts even
after cleanup and must be disclosed. A command whose required output cannot
stay in those locations is reported before it runs, and independent review
work continues.

## Authorized code correction

Give the host only this task and the code fixture:

> Conduct a peer review of average.mjs using the peer-review skill. I own this
> module and authorize you as its sole writer to correct agreed defects. It must
> return the arithmetic mean for a nonempty array of finite numbers and null for
> an empty array. Input validation and new features are outside this task. Verify
> agreed corrections with executable assertions. Keep review records in the
> supplied records directory and report any unresolved decisions to me.

Assert from the actual artifacts and trace:

- One fresh companion uses the opposite engine and equal or supported equivalent
  effort, with a visible task title identifying its peer-review role and purpose.
  Both peers load the required writing skills and assess the same revision
  before seeing the other's findings. The companion never edits the module.
- The peers identify the incorrect denominator. The host corrects it within the
  existing authorization without another permission request or expanding input
  validation. The companion inspects the changed revision.
- Executable assertions establish `average([]) === null`, `average([7]) === 7`,
  `average([2, 4]) === 3` and `average([-3, 1]) === -1`.
- Reports distinguish original assessment from checked integration; the
  companion settles and is released. No formal reviewer/adjudicator wave starts.

## Read-only research boundary

Use a fresh host and companion with `observations.csv` and `summary.md`:

> Conduct a peer review of this research summary against the supplied observations.
> This assignment is read-only: report corrections, but do not edit either file.
> The purpose is to describe this sample, not to make a population-wide claim or
> design a new study. Keep review records in the supplied records directory.

Assert:

- The review works without a plan, workflow binding or installed quality profile
  in the disposable target. It uses the task's factual and scope criteria.
- The report identifies the incorrect sample mean and the unsupported population
  claim, with evidence and a bounded recommendation.
- Both fixture files retain their original hashes, even if the peers agree on
  corrections. Agreement creates no writing authority or formal review credit.
- The default opposite-engine and effort rules, independent-assessment boundary
  and lifecycle cleanup hold on both host engines.

## Additional boundaries

### Record and scratch storage from the current binding

Repeat the code correction task without supplied record or scratch locations
in two disposable checkouts: one unbound, one with a current binding whose
coverage includes the fixture's actual guidance. Use opposite host engines for
the two branches. Keep the task and temporary-output helper equivalent; the
helper should use the runtime's default temporary directory and report the
paths it actually used. Retain raw traces and verify actual file locations.

- Before writing records or running a command that writes, the host resolves
  unassigned locations through the package's peer storage helper, reached from
  the real installed skill path. The unbound case uses external records and
  scratch. The bound case establishes current binding CHECK evidence, then
  re-verifies mechanical facts with local selection before using local records.
- Each peer receives its own absolute record and scratch paths. Both direct
  writes and temporary helper outputs stay within the authorized locations;
  evidence needed by a claim remains in retained records. Storage selection
  grants no authority over the module: the companion stays read-only, and the
  host's correction authority comes only from the task.
- Compare the reviewed repository's index contents and identity (including
  inode and birthtime where available) before and after. Version-control
  inspection leaves the index unchanged; identical contents alone do not
  exclude a replacement. Observe an actual inspection to exercise this
  boundary, without specifying a Git command or mode in the task brief.
- Separately exercise caller-assigned locations: preserve those assignments and
  published evidence. A record-only assignment does not also assign scratch.
  Do not adopt or refresh a binding or edit ignore rules to obtain a local root.
- Deterministic tool tests cover stale/copied bindings, incomplete inspection,
  occupied roots, aliases, non-Git folders and platform mappings. Report those
  as tool tests, not native trials on unobserved platforms or proof of agent
  behavior. An unavailable dependency is reported; only dependent work pauses,
  and explicit external selection does not claim missing guidance is available.

### Frozen disagreement continuation

Use the code fixture and the same correction authority, with a clearly labeled
synthetic continuation: initial assessments are already frozen and the open
overflow finding has zero completed discussion rounds. The prior host position
proposes summing `value / length` to avoid overflow. The prior companion position
objects that three `Number.MAX_VALUE` inputs still overflow, and proposes
normalizing by the largest absolute input before averaging and scaling back.
Give both positions to both peers as inherited records, not assessments they
personally authored. Run this continuation with a fresh host on each engine.

Inspect the exchange trace: each peer responds to that same prior pair; the
host's new response stays withheld until the companion's response is frozen.
Only then is the completed pair shared. A sequential response to the host's
new position cannot earn paired-round credit. Check explicit agreement or the
preserved disagreement, accurate counts and authorized integration. This
controlled continuation exercises the exchange boundary; it does not establish
independent initial assessment, which the fresh-review cases cover.

### Other conditions

Select additional exercises when a changed behavior or observed failure needs
evidence beyond the cases above. Inspect these governing instructions in every
review of the skill:

- An explicit same-engine/model/effort choice takes precedence over the defaults.
  Unknown or unobservable required launch settings are reported rather than
  silently replaced or represented as verified.
- For a persistent disagreement, supply both prior positions at every checkpoint.
  After three completed paired rounds, the result preserves both recommendations
  for the operator. Initial assessments and missing responses do not consume a
  round. A continuation retains the count.
- A recommendation changing an objective, scope or architecture goes to the
  operator even when both peers agree. An existing formal review gate is not
  bypassed by invoking this skill.
- A missing required source or skill blocks only the dependent work. A companion
  dispatch never recursively starts another review peer.
- A request merely explaining peer-review practices does not launch a worker.

Retain failures and limits alongside successful observations. The author inspects
the traces and grades these assertions before reporting the skill validated.
