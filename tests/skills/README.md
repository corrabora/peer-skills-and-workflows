# Behavioral skill suites

Use `run.mjs` to exercise a skill against a pinned source tree, retain each
attempt and grade its result. Real engine runs are paid calls started by hand.
`node --test` and `node tools/verify.mjs` use a fake engine and make no paid or
network calls.

The suite files own case definitions and criteria:

| Suite | Focus |
| --- | --- |
| [clarify-artifact](suites/clarify-artifact/suite.json) | Consequential clarification and settled requests |
| [write-for-humans](suites/write-for-humans/suite.json) | Useful prose, fidelity, editing scope and delivery receipts |
| [write-for-agents](suites/write-for-agents/suite.json) | Executable briefs, dependencies, authority and completion |
| [maintain-glossary](suites/maintain-glossary/suite.json) | Project meanings, scoped edits and migration |
| [record-decision](suites/record-decision/suite.json) | ADR selection, standing, revisions and information-preserving migration |
| [write-issue](suites/write-issue/suite.json) | Bugs, agreed changes and bounded investigations |
| [write-pr](suites/write-pr/suite.json) | Full-change descriptions, issue criteria and verification evidence |
| [successor](suites/successor/suite.json) | Continuation writing, source fidelity and authority boundaries |

The peer skills, the paired responsible party and live succession also have
[acceptance scenarios](scenarios). A prose suite, offline helper test and live
Orca or hook exercise establish different evidence; none substitutes for another.
[AW-SK-EV4](../../docs/qualities/skill-evidence.md#aw-sk-ev4) defines this
repository's required behavioral proof.

## Running a suite

The header of [run.mjs](run.mjs) documents commands and options. Give a run
directory outside every checkout; the runner refuses one inside. Omitted model,
effort and replicate count come from [defaults.json](defaults.json).
The runner rejects unsupported efforts and model aliases such as `opus` before
launch, rather than substituting a model.

```sh
# Inspect the plan without launching or writing.
node tests/skills/run.mjs run --suite clarify-artifact --engine claude \
  --source-tree <tree-ish> --run-dir "<run directory>" --dry-run

# Run each standing engine into the same directory.
node tests/skills/run.mjs run --suite clarify-artifact --engine claude \
  --source-tree <tree-ish> --run-dir "<run directory>"
node tests/skills/run.mjs run --suite clarify-artifact --engine codex \
  --source-tree <tree-ish> --run-dir "<run directory>"
```

`--source-tree` names a Git tree-ish in this checkout or `--repo`; it never reads
the working tree. `--source-dir` instead takes a materialized source directory.
The dry run shows source identity, settings, per-attempt commands and expected
checks. `--case <id>`, `--replicates`, `--timeout-seconds`, `--model`, `--effort`
and `--executable <engine>=<path>` narrow or override the run.

A run directory may add the other engine or cases not yet run. Recorded attempts
are skipped, never overwritten. Changed source, suite or verbosity requires a
new directory; model and effort comparison arms also use separate directories.

The runner links the selected skills into each fixture's project skill
directories. Each fixture workspace is a Git repository with its initial state
committed. Checkout-specific Git environment variables are removed and temporary
output stays within the attempt. The [engine adapters](lib/engines.mjs) own the
exact launch arguments: Claude runs in print mode with an explicit tool
allowlist and no delegation or MCP servers; Codex runs ephemerally in the
`workspace-write` sandbox, ignoring user configuration.

When the pinned source includes
[Codex session instructions](../../docs/guidance/codex-session-instructions.txt),
the Codex adapter reads them from that source and passes them as a per-invocation
`developer_instructions` override. `run.json` and `command.json` retain the text,
hashes and exact argument. An absent file is recorded as absent; an empty,
unreadable or non-UTF-8 file stops launch. Claude receives no such argument.
The runner never edits user configuration.

### Verbosity and attestation

`--verbosity` has no default override. Omitted, the engine uses its own default
and the records say `engine-default`. A run without a verbosity record is also
read as `engine-default`.

| Engine | Override | Accepted values |
| --- | --- | --- |
| Claude | `--settings` with `outputStyle` | Any nonempty, case-sensitive style name |
| Codex | `-c model_verbosity=…` | `low`, `medium`, `high` |

Claude can silently resolve an unknown style to its default. When its init event
includes `output_style`, the attempt records the effective style and its
attestation source; otherwise effective verbosity is null. A mismatch is
recorded rather than failed. Codex's event stream does not attest verbosity,
model or effort; its launch arguments establish only what was requested.
Fake-engine tests prove argument construction and recording, not whether a
real engine honors a setting or produces shorter replies.

### Transport retries

A transport failure is retained and retried only by an explicit command, under
the cooldown, serial execution and retry cap in `defaults.json`:

```sh
node tests/skills/run.mjs retry --run-dir "<run directory>" --cell purpose-unsettled/codex/002
```

Retries keep the same settings and preserve earlier attempts as `retry-01`,
`retry-02`. An attempt that produced a behavioral reply is never retried, whatever its
verdict.

## Grading and certification

Each case declares deterministic checks, semantic criteria and any observe-only
criteria. Deterministic checks assess exit status, bounded writes, required reads
and artifact claims from the retained trace and workspace. Semantic criteria
need a named grader who inspects `final.txt`, `trace.jsonl`, `inspection.json`
and the workspace. An ungraded criterion never passes. Observe-only criteria
are reported but do not affect certification; they do not waive skill obligations.

A failed premise, such as the named skill not being loaded, is `premise-not-met`.
The engine did not reach the behavior under test, so it is neither a behavioral
pass nor failure. A timeout, crash, missing reply or substituted model is a
transport failure, also neither. A behavioral failure remains a failure.

Supply judgments by cell (`<case>/<engine>/<replicate>`):

```json
{
  "grader": "name or agent identity",
  "graded": "2026-10-27",
  "judgments": {
    "purpose-unsettled/claude/001": {
      "attempt": "001",
      "criteria": {
        "one-question": { "pass": true, "note": "Asks for the unresolved purpose." }
      }
    }
  }
}
```

`attempt` is optional; when supplied it must match the effective attempt or the
judgment is ungraded. Use `{ "applicable": false, "note": "…" }` for a criterion
whose condition the attempt never reached. Not-applicable is neither a pass nor
a failure and does not leave the cell ungraded.

```sh
node tests/skills/run.mjs report --run-dir "<run directory>" --judgments <file>
```

Each report is a new numbered JSON/Markdown pair under `reports/`. Without
judgments, it still reports deterministic results and ungraded semantic criteria.
`--engines` and `--replicates` override the report's default certification bar.

| Cell status | Meaning |
| --- | --- |
| `certified` | The required replicate count is met; all applicable certifying checks and criteria pass |
| `unstable` | At least one replicate failed a certifying check or criterion |
| `blocked` | A replicate has no behavioral result because a premise or transport failed |
| `ungraded` | Nothing failed, but a semantic judgment is missing |
| `incomplete` | Fewer replicates than required |

A case is certified only on every standing engine; a suite only when every case
is certified. Certification is scoped to that suite, source and recorded run
conditions, not a general reliability claim.

### Recomputing inspections and re-grading

Recompute from retained traces, exits and workspaces without launching engines:

```sh
node tests/skills/run.mjs inspect --run-dir "<run directory>" [--cell <cell>]
node tests/skills/run.mjs report --run-dir "<run directory>" [--judgments <file>]
```

Earlier `inspection.json` and `attempt.json` files are preserved as numbered
copies; the new inspection records their classifier versions and verdicts.
Transport status stays unchanged.

`inspect` and `report` also accept `--suite <directory or tree-ish>` to apply
revised expectations. The skill, installed skills and case IDs must match;
fixtures and prompts must be byte-identical. A revised deterministic expectation
must be applied with `inspect --suite` before `report --suite`. Accepted suite
revisions are retained under `suites-revised/<hash>/`; reports identify both
hashes and the changes. A changed prompt or fixture requires a new paid run.

## Retained results

Everything the run produces stays under its external run directory:

```text
<run>/
  run.json                 source, suite and requested settings
  source/                  materialized source; source-manifest.json beside it
  suites/<name>/           original suite snapshot
  suites-revised/<hash>/   accepted grading revisions
  attempts/<case>/<engine>/<replicate>/
    command.json           exact launch, environment, settings and identities
    prompt.md
    fixture-manifest.json
    workspace/             fixture and resulting edits
    trace.jsonl
    stderr.txt
    final.txt
    exit.json
    inspection.json        checks, reads, writes, artifact claims and classifier
    attempt.json           behavioral/transport result and setting attestations
    inspection.NNN.json    earlier inspections, when recomputed
    attempt.NNN.json
    retry-01/              retained transport retries
  reports/NNN-report.json
  reports/NNN-report.md
```

The suite and source hashes connect reports to the exact inputs. Preserve the
run directory while any assessment relies on it.

## Writing a case

`suites/<name>/suite.json` names the tested skill, installed dependencies and
ordered cases. Each `cases/<id>/` contains `case.json`, `prompt.md` and a
`workspace/` fixture. [The suite loader](lib/suite.mjs) owns the accepted schema.

Criteria assess observable behavior, not the skill's wording. Fixtures should
use a separate domain and must not echo skill instructions or shared guidance.
No fixture path may match Node's default test-file patterns, such as `*.test.mjs`
or a `test/` directory: the root gate would execute it. The loader rejects these
paths.

Use the deterministic expectations for:

- `exit`: the expected process exit status.
- `skillReads`: required or forbidden skill loads.
- `sourceReads`: required, forbidden or observed reads of source-relative files.
- `premise`: required skill or source reads that must occur before the tested
  behavior can be assessed; an observed read cannot be a premise.
- `writes.allowed` and `writes.required`: workspace-relative paths; `*` matches
  within one path segment, with no other glob syntax. A required pattern needs
  at least one created or modified file.
- `edits`: a passage bounded by unique `after` and optional `before` marker
  lines; bytes outside it must match the fixture.
- `claimedArtifacts`: enabled by default; claimed saved paths in the final reply
  must correspond to actual workspace files. Set false only deliberately.

A read requires positive trace evidence of the body returned, a successful
Read, or a named skill invocation. Searches, listings, exclusion globs and
unrecorded output do not prove a read. Source-file checks combine partial reads
and recognize generated skill-local aliases only when their bodies match the
canonical source after registered link rewrites. Stale copies never count.
The [inspector](lib/inspect.mjs) records the evidence and classification;
the [writing-reference map](../../tools/lib/writing-references.mjs) owns aliases.

Give semantic criteria stable IDs and conditions a grader can judge. Use
`"observe": true` for measurements that should not certify the tested skill.
Keep source ownership clear: a missing required dependency read is a failure
unless explicitly made a premise, not a reason to discard the trial afterward.

## Probes and offline tests

For a controlled observation, use a second suites root via `--suites-root`.
A probe mirrors one standing case with a byte-identical workspace and one
stated change; mark every semantic criterion observe-only. Retain the observation
in run records, then remove the probe. Probes never certify a standing suite.

[Harness tests](test) run against [the fake engine](test-support/fake-engine.mjs).
They check runner boundaries, trace classification, evidence retention, grading
and suite contracts offline. They do not establish real model behavior.
