# Plan: issue and pull request writing

This plan records the intended scope of the `write-issue` and `write-pr`
skills. It documents intent for review; it authorizes no work and claims no
acceptance or certification.

## Objective

Give an agent two writing skills for the text that surrounds a change: an
issue that tells the next reader what problem exists, what outcome or finding
would resolve it and how completion would be shown, and a pull request that
tells a reviewer what actually changed and which evidence supports each
completion claim. The skills keep the issue, the change and the PR coherent:
the PR accounts for every acceptance criterion of its associated issue, with
its qualifiers intact, and connects each claimed satisfaction to the behavior in
the complete change and to retained, criterion-specific evidence.

## Boundaries

- Issue writing covers bug reports, implementation work and exploratory work.
  Exploratory criteria assess a bounded investigation and its supported
  conclusion; an inconclusive finding can complete it, and incomplete agreed
  work or missing required evidence cannot.
- PR writing starts from the complete comparison, never the last commit alone.
  A green suite, a stale run or an unrelated check does not establish a
  criterion; closing language appears only when the issue's completion
  criteria are met. A PR without an issue gets a proportionate description and
  no manufactured checklist.
- Both skills compose the existing audience writing skills (`write-for-humans`
  and, for agent-directed sections, `write-for-agents`) and read the target
  repository's contribution guidance. An issue or PR template is used when the
  repository has one and is not required.
- Neither skill depends on the supervised plan workflow or any orchestrator.
  The calling task keeps publication, triage, review, merge and execution
  authority; drafting changes no tracker or forge state.
- The installer's `writing` set includes both skills. Global installation,
  live forge access and running tests to produce PR evidence are outside scope.

## Phase 1: skills, installer and representative suites

Deliver both skills, their README documentation, the installer set change and
one behavioral suite per skill.

Acceptance:

1. `skills/write-issue/SKILL.md` and `skills/write-pr/SKILL.md` pass
   `node tools/validate.mjs`, and `node tools/verify.mjs` passes on the
   candidate.
2. `WRITING_SKILLS` in `tools/lib/install.mjs` names both skills, so
   `node tools/install.mjs link writing` links them for both engines, and the
   installer tests cover an upgrade that adds them without replacing existing
   links.
3. The README lists both skills in the writing set, states when to use each and
   that the PR accounts for every criterion of an associated issue, and names
   the calling task as the owner of publication.
4. The `write-issue` suite in `tests/skills/suites/write-issue/` covers an
   implementation issue with observable, identifiable criteria, a bug report
   whose body gives the trigger, expected and observed behavior and
   environment and keeps the reporter's account apart from the reproduction
   performed, an exploratory issue that permits an inconclusive result without
   excusing incomplete work, and a neighboring mechanical edit that must not
   select the skill.
5. The `write-pr` suite in `tests/skills/suites/write-pr/` covers complete
   accounting of an issue's criteria against a multi-commit comparison, partial
   work with stale and irrelevant evidence, an inconclusive exploratory
   deliverable, and a small PR with no issue. Fixtures supply retained
   comparison and evidence snapshots with reader-accessible destinations, and
   required skill reads are deterministic checks.
6. Representative engine executions of the changed paths and a boundary case
   are retained with their source identity, inputs, outputs, grades and limits,
   under the skill evidence rubric. Suite certification follows
   `tests/skills/README.md` and is separate from this phase.

The phase lands as one commit of this repository at the operator's direction.
