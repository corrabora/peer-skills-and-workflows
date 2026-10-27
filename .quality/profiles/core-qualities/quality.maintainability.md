# Maintainability

Authority: `quality:corrabora/core-qualities/maintainability`

Version: `1.0.0`

The subject can be understood, diagnosed, changed, reused, and proven without effort disproportionate to the change.

## Clauses

### MA1

**Modularity and orthogonality.** A change to one concern remains within a bounded cohesive set of owners, and unrelated concerns do not interact through hidden mutable state or ambiguous ownership.

- Stable identifier: `quality:corrabora/core-qualities/maintainability#MA1`
- Applicability: always considered
- Scenario prompts:
  - Apply a representative change stimulus and identify the artifacts expected to absorb it.
- Evidence prompts:
  - Verify semantic locality without unrelated coordinated edits.
- Consequence dimensions: `affected-scope` `reversibility-and-recovery-cost`

### MA2

**Reuse and composability.** Existing behavior is composed from one owner instead of reimplemented, and equivalent implementations preserve one shared observable contract.

- Stable identifier: `quality:corrabora/core-qualities/maintainability#MA2`
- Applicability: always considered
- Scenario prompts:
  - Exercise the shared contract against every implementation or consumer.
- Evidence prompts:
  - Identify duplicate owners and compare their behavior for divergence.
- Consequence dimensions: `affected-scope` `contract-or-boundary-violation`

### MA3

**Observability and diagnosability.** A maintainer can determine what occurred and why from structured telemetry, preserved error causes, and inspectable decision state.

- Stable identifier: `quality:corrabora/core-qualities/maintainability#MA3`
- Applicability: always considered
- Scenario prompts:
  - Introduce a named failure or decision outcome and diagnose its branch and cause from available telemetry.
- Evidence prompts:
  - Verify that the affected operation, selected branch, and cause are identifiable within a bounded exercise.
- Consequence dimensions: `duration-and-detectability` `reversibility-and-recovery-cost`

### MA4

**Modifiability and simplicity.** Likely changes have a local extension point, and complexity remains proportionate, without central case rewrites, speculative indirection, or avoidable cleverness.

- Stable identifier: `quality:corrabora/core-qualities/maintainability#MA4`
- Applicability: always considered
- Scenario prompts:
  - Apply a plausible extension and identify the minimal owners that must change.
- Evidence prompts:
  - Inspect whether the extension is additive and whether every abstraction has a current purpose.
- Consequence dimensions: `affected-scope` `reversibility-and-recovery-cost`

### MA5

**Testability and provability.** Behavior is provable at the tier where it lives because dependencies have controllable seams, failures can be induced, and nondeterminism can be supplied explicitly.

- Stable identifier: `quality:corrabora/core-qualities/maintainability#MA5`
- Applicability: `fact:portable/implementation-language-declared` is present
- Scenario prompts:
  - Name the behavior and induce its success, failure, boundary, and nondeterministic cases at the owning tier.
- Evidence prompts:
  - Verify the observable contract without requiring unrelated infrastructure or ambient state.
- Consequence dimensions: `affected-scope` `duration-and-detectability`
