# Plan: portable plan workflow

A private, single-operator development aid. It is held to correctness and
practical usability, and to the applicable obligations of its own installed
quality profiles, proportionately: no commercial assurance, custody or release
machinery.

## Objective

One maintained source for the supervised plan workflow, installed once per user
for both Claude and Codex, so any repository can run a plan phase through fresh
Orca workers: a responsible party, four direct quality reviewers and two peer
adjudicators, coordinated by a long-lived plan coordinator. A review with
findings goes straight to adjudication; the coordinator then reports and stops
at the operator gate, as it does directly after a clean review. Unanimous
adjudication still stops at the gate.

## Portable boundary

The package owns the engine-neutral process: roles and ownership, wave and gate
sequencing, review seats and round rotation, the severity scale and the
handling of `note`, proof and coverage, peer adjudication, configuration
resolution, the run-record and scratch locations, the record layout and
formats, the report template, shared worker profiles and the tools that
install, validate and resolve them.

A target repository owns everything that carries authority there: plans and
their guidance, its quality profiles, its finding format (which may add fields
but keeps the package's severity semantics), which proofs its obligations
require, verification and evidence commands and what makes that evidence valid,
candidate form, landing rules and any local workflow settings. Each
target states these in a short binding page; the package describes what a
binding must answer, never a repository's answers.

The installed Orca orchestration skill and the guide served by its binary own
executable discovery and runtime operations. The package maps its process onto
Orca and does not restate runtime commands.

## Constraints

- Markdown, YAML and Node.js that both engines and every supported host can
  use; no plugin packaging, schema system, release infrastructure or assurance
  framework.
- Development and installation work natively on macOS, Windows and Linux with
  Node.js and npm. Tools use Node's path, filesystem, home-directory and
  temporary-directory APIs and argument-based process invocation, never Bash,
  Python, POSIX utilities, WSL or fixed machine paths.
- YAML is read with one maintained npm package, `yaml`, pinned in
  `package.json` and `package-lock.json` and installed by `npm ci` in the
  workflow source, beside the tools that load it. Runtime tooling never
  downloads it, and target repositories and skill directories need no copy. One
  shared reader turns skill frontmatter and configuration into bounded plain
  data, refusing what YAML 1.2 and the package's YAML 1.1 schema read
  differently ([README](../../../README.md#verify)); it claims no complete YAML
  conformance.
- Skills resolve shared references from the canonical source (following the
  installed link), never from the target checkout or the shell's directory.
  Installation links to the source; it never substitutes copies.
- Populated records are ephemeral, live in the coordinator checkout's ignored
  `.agent-workflow/runs/` directory, and never enter Git; durable repository
  documents never depend on them. Transient work runs in machine-local scratch
  outside every checkout; records keep only the evidence their reports cite.
- Shared worker profiles are editable configuration, separate from procedure,
  overridable per repository, plan, phase or worker. Effective runtime values
  are observed, not assumed.

## Phase 1: shared package and installation

Extract the workflow from its first repository-local draft into this package,
retool it to the four-direct-reviewer and operator-gate model, make its tooling
portable Node.js, and install it for both engines. The phase covers this
package and its user-level installation only.

Binding Undertone and quality-profiles is separate work, planned, verified and
landed under each repository's own guidance and binding. Both adoptions remain
open, including retiring their superseded local workflow skills; this phase
neither performs nor completes them.

Acceptance:

1. Four skills (`plan-coordinator`, `plan-responsible-party`, `plan-reviewer`,
   `review-adjudicator`) pass `node tools/validate.mjs`, and the validator
   rejects representative invalid skills with a failing exit status.
2. Every relative link in the README, PLAN, skills, workflow references and
   templates names an existing target whose canonical path, after resolving
   symlinks, lies inside the package; `node tools/install.mjs check` enforces
   this and rejects an escaping fixture.
3. `node tools/install.mjs check` reports each role linked from the Codex and
   Claude personal skill directories to this checkout with its shared
   references reachable through the link; `link` and `unlink` preserve foreign
   files and links.
4. `node tools/resolve.mjs` places each run's records at
   `<checkout>/.agent-workflow/runs/<run id>/` of the canonical checkout and its
   scratch under the host's per-user machine-local base, refusing a scratch
   root inside the checkout, with the host's path rules; keeps same-named
   checkouts and runs apart, refuses run IDs that are not one plain name,
   creates nothing, and applies configuration precedence as
   `workflow/ORCA.md` documents; `node --test` passes.
5. Portable instructions contain no target-repository paths, commands, profile
   names or crate vocabulary.
6. The report template has the resolution table
   (`ID | Severity | Issue | Sources | Recommended result | Resolution | Human decision | Proof`)
   followed by complete briefs that each begin with finding summary, underlying
   findings and recommendation.

The phase lands as one commit of this repository, made from the accepted tree
after review at the operator's direction; internal correction cycles are not
committed separately.

## Binding for reviewing this package

- Planning owner: this file.
- Quality selection: the installed quality profiles in `.quality/`, selecting
  Corrabora Defaults 1.0.0, which inherits Core Qualities 1.0.0 and Software
  Engineering 1.0.0. The coordinator partitions their governing clauses into
  the four review sets for each run, as `workflow/REVIEW.md` describes; no
  local guidance is added to any set.
- Finding format: the default in [workflow/REVIEW.md](../../../workflow/REVIEW.md#finding-format).
- Verification: `node tools/validate.mjs`, `node tools/install.mjs check` and
  `node --test`, run from this checkout after `npm ci`. There is no further
  gate or evidence collector; reviewers may rerun these cheap checks. Each
  candidate states which hosts actually ran them; simulated platform mappings
  are not a run on that platform. Native Windows and Linux verification is
  aspirational: it needs the operator to move the code to those systems, and
  its absence does not block correction, review, acceptance or landing.
  Cross-platform behavior stays the intent, and hosts that have not run the
  checks are reported as unverified. `node --test` relies on default test
  discovery, and run records under the ignored `.agent-workflow/` can hold
  copies of earlier test files that must stay out of the maintained suite.
  Node 24, the runtime these checks have run on, skips that hidden directory;
  a test glob, a renamed record directory or another runner would have to
  exclude it explicitly.
- Candidate: the staged index tree on the development branch; before the first
  commit the base is the empty tree.
- Landing: one commit of the accepted tree, at the operator's direction.
- Local files: `/.agent-workflow/` is ignored and untracked; it holds local
  workflow settings and run records. `/node_modules/`, which `npm ci` creates,
  is ignored and never staged. This package has no evidence tooling of
  its own.
