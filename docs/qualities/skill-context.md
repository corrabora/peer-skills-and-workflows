# Skill context and instructions

An agent reaches the information needed for its task, at the right time and
from an appropriate source. Apply these clauses through the
[selection and assessment contract](README.md).

## AW-SK-CT1

**Required context is explicitly reachable before use.** An instruction that
depends on another source names the required reading or loading action, its
trigger and a resolvable target.

- **Applies when:** a skill depends on another skill, workflow reference,
  project source, template or runtime guide, including changes to how a caller
  supplies those dependencies.
- **Pass boundary:** the agent can resolve the intended source in the supported
  execution context and loads it before dependent work. Missing required
  material has an explicit recovery or reporting path. Reading a summary does
  not substitute for a required source; another loading path does not bypass
  an invocation restriction.
- **Scenario:** start a fresh worker with a different working directory or
  worktree, then repeat with a required reference unavailable.
- **Evidence:** inspect resolution instructions, caller inputs and actual link
  targets. For changed loading behavior, observe which source was loaded and
  what happens when it cannot be loaded. A link's existence proves reachability
  at that location, not that the agent read it.
- **Guidance:** [Rule 3: explicit reading](../skill-authoring-guidance.md#3-make-required-reading-an-explicit-action).

## AW-SK-CT2

**Reading paths match the current stage and branch.** Common prerequisites and
standing boundaries are available before action; conditional material has an
explicit entry point where its branch becomes relevant.

- **Applies when:** instructions or supporting references organize multiple
  stages, branches, recovery paths or task modes.
- **Pass boundary:** following an applicable branch reaches all of its necessary
  instructions without depending on an unstated read. Definitions and relevant
  exceptions remain discoverable together. Unconditional loading of substantial
  branch-specific material has a task-based justification.
- **Scenario:** trace both the routine path and a recovery or delivery path,
  noting each source loaded and each prerequisite used.
- **Evidence:** inspect the complete reading path, including transitive
  references. Identify a concrete omission or unnecessary dependency before
  proposing restructuring. File count or a long main file alone does not
  establish a failure.
- **Guidance:** [Rule 4: stage and branch](../skill-authoring-guidance.md#4-organize-instructions-around-the-current-stage-and-branch).

## AW-SK-CT3

**Instruction changes preserve useful behavior and remove identifiable waste.**
Added material contributes to the task, and pruning preserves applicable
constraints, exceptions and checkpoints.

- **Applies when:** work expands, compresses, reorganizes or removes skill
  instructions or their loaded references.
- **Pass boundary:** the author can connect substantive additions to an action,
  decision or demonstrated need, and account for required behavior affected by
  deletions. Obsolete or conflicting text is corrected. Intentional reminders
  retain one policy owner; no word or token budget takes precedence over the
  task contract.
- **Scenario:** compare the previous and revised path for a difficult boundary
  that the edited text governs, including a relevant exception.
- **Evidence:** inspect the semantic change and prior failure evidence when
  available; exercise material behavioral changes under `AW-SK-EV4`. A new skill
  may justify instructions from its task and risks without claiming a prior
  incident. Stylistic preference or repetition alone is insufficient evidence
  of debt.
- **Guidance:** [Rule 9: behavioral value](../skill-authoring-guidance.md#9-edit-for-behavioral-value).

## AW-SK-CT4

**Changing facts retain a source and a freshness boundary.** Runtime and project
facts are obtained from their authoritative owners, while deliberate snapshots
identify the task or comparison they govern.

- **Applies when:** skill work uses configuration, available commands, runtime
  interfaces, project obligations, candidate identities or recorded effective
  values.
- **Pass boundary:** the skill distinguishes reusable policy from observed
  facts. The source, refresh condition and snapshot scope are sufficient to
  avoid silently using stale facts or changing a live task's basis. Repository
  quality-profiles and extensions remain identifiable as project obligations;
  personal additions retain their own scope.
- **Scenario:** change a configuration or governing source between tasks, and
  compare that case with a worker completing an assignment against a pinned
  candidate and binding snapshot.
- **Evidence:** inspect source ownership and refresh instructions; compare the
  recorded identity and effective values with the task they support. A current
  branch name or a timestamp alone does not identify reviewed content.
- **Guidance:** [Rule 10: authoritative facts](../skill-authoring-guidance.md#10-obtain-changing-facts-from-their-authoritative-source).
