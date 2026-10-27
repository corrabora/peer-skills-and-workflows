# Structural Design

Authority: `mechanics:corrabora/software-engineering/structural-design`

Version: `1.0.0`

Portable structural obligations for cohesive responsibilities, stable extension and substitution, explicit dependency direction, composition, effects, state ownership, and documented deviations.

## Clauses

### SD1

**Cohesive responsibility.** Each unit has one cohesive responsibility and one primary reason to change.

- Stable identifier: `mechanics:corrabora/software-engineering/structural-design#SD1`
- Applicability: always considered
- Scenario prompts:
  - Change one responsibility and observe whether unrelated behavior must change.
- Evidence prompts:
  - Show the responsibility boundary and the changes it contains or excludes.
- Consequence dimensions: `affected-scope` `reversibility-and-recovery-cost`

### SD2

**Localized extension.** Expected extensions add a localized alternative without rewriting stable behavior that is outside the extension point.

- Stable identifier: `mechanics:corrabora/software-engineering/structural-design#SD2`
- Applicability: always considered
- Scenario prompts:
  - Add a representative supported alternative through the declared extension boundary.
- Evidence prompts:
  - Identify the extension boundary and compare an added alternative with unchanged stable behavior.
- Consequence dimensions: `affected-scope` `contract-or-boundary-violation`

### SD3

**Observable-contract preservation.** Where a substitutable contract is declared, every replacement preserves that contract's observable behavior; no substitution mechanism is required where no such contract exists.

- Stable identifier: `mechanics:corrabora/software-engineering/structural-design#SD3`
- Applicability: always considered
- Scenario prompts:
  - Exercise the same contract scenario against each declared replacement.
- Evidence prompts:
  - Compare the observable contract across each meaningful replacement.
- Consequence dimensions: `contract-or-boundary-violation` `affected-scope`

### SD4

**Minimal explicit contracts.** A consumer depends only on the minimal explicit contract needed for its behavior.

- Stable identifier: `mechanics:corrabora/software-engineering/structural-design#SD4`
- Applicability: always considered
- Scenario prompts:
  - Change an unrelated capability and confirm consumers outside it remain unaffected.
- Evidence prompts:
  - Show which contract members each consumer requires and why no unrelated member is imposed.
- Consequence dimensions: `affected-scope` `contract-or-boundary-violation`

### SD5

**Policy-directed dependency flow.** Policy depends on stable abstractions, while replaceable implementation details depend toward those abstractions.

- Stable identifier: `mechanics:corrabora/software-engineering/structural-design#SD5`
- Applicability: always considered
- Scenario prompts:
  - Replace an implementation detail without changing the policy that consumes its contract.
- Evidence prompts:
  - Trace dependency direction from policy through each abstraction to its replaceable realization.
- Consequence dimensions: `affected-scope` `reversibility-and-recovery-cost`

### SD6

**Explicit composition and effects.** Composition choices and effect boundaries are explicit and kept outside invariant-bearing policy.

- Stable identifier: `mechanics:corrabora/software-engineering/structural-design#SD6`
- Applicability: always considered
- Scenario prompts:
  - Run policy with a controlled effect provider and observe the same policy decision.
- Evidence prompts:
  - Locate composition decisions and identify every boundary that performs an external effect.
- Consequence dimensions: `affected-scope` `contract-or-boundary-violation`

### SD7

**Owned state and concurrency.** Mutable state has one declared owner, and ordering or concurrency behavior is explicit wherever concurrent access exists.

- Stable identifier: `mechanics:corrabora/software-engineering/structural-design#SD7`
- Applicability: always considered
- Scenario prompts:
  - Exercise competing state transitions when concurrency is part of the subject.
- Evidence prompts:
  - Name the state owner and show the ordering, conflict, or synchronization contract where concurrent access exists.
- Consequence dimensions: `data-loss` `duration-and-detectability`

### SD8

**Intentional boundary evidence.** Every intentional boundary or structural deviation records its scope, rationale, and consequence.

- Stable identifier: `mechanics:corrabora/software-engineering/structural-design#SD8`
- Applicability: always considered
- Scenario prompts:
  - Review an exceptional structure and recover its declared rationale and bounded scope.
- Evidence prompts:
  - Provide the decision evidence for each intentional deviation and identify the boundary it affects.
- Consequence dimensions: `affected-scope` `safe-workaround-availability`
