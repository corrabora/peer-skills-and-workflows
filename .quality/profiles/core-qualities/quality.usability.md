# Usability

Authority: `quality:corrabora/core-qualities/usability`

Version: `1.0.0`

People can discover, learn, operate, recover, and automate the available interaction surfaces in differing environments.

## Clauses

### US1

**Discoverability.** A person can determine what the subject offers and whether it fits their need from its visible description and interaction surfaces.

- Stable identifier: `quality:corrabora/core-qualities/usability#US1`
- Applicability: always considered
- Scenario prompts:
  - Begin at the shipped entry point and locate a named capability without inspecting its implementation.
- Evidence prompts:
  - Observe successful capability discovery using only the available description and self-description surfaces.
- Consequence dimensions: `affected-scope` `safe-workaround-availability`

### US2

**Learnability.** The path from no prior knowledge to first success is short, documented, complete, and honest about prerequisites.

- Stable identifier: `quality:corrabora/core-qualities/usability#US2`
- Applicability: always considered
- Scenario prompts:
  - Have a competent newcomer complete a first-success journey from a clean environment.
- Evidence prompts:
  - Record completion, missing knowledge, prerequisite accuracy, and recovery from any failed step.
- Consequence dimensions: `affected-scope` `safe-workaround-availability`

### US3

**Operability and defaults.** Routine tasks require proportionate effort, use consistent vocabulary, and begin from defaults that do not surprise in a harmful direction.

- Stable identifier: `quality:corrabora/core-qualities/usability#US3`
- Applicability: always considered
- Scenario prompts:
  - Exercise recurring tasks in clean and previously configured environments, including dangerous defaults.
- Evidence prompts:
  - Observe task outcome, required steps, consistency, and recovery burden.
- Consequence dimensions: `reversibility-and-recovery-cost` `safe-workaround-availability`

### US4

**Error prevention and recovery.** Irreversible effects are difficult to trigger accidentally, errors name corrective action, and partial failures state the resulting condition.

- Stable identifier: `quality:corrabora/core-qualities/usability#US4`
- Applicability: always considered
- Scenario prompts:
  - Induce representative mistakes, irreversible requests, and partial failures.
- Evidence prompts:
  - Verify prevention or explicit blast radius, resulting state, and actionable correction.
- Consequence dimensions: `reversibility-and-recovery-cost` `safe-workaround-availability`

### US5

**Self-descriptiveness and assistance.** Responses explain current state and requirements with actionable detail, and descriptive surfaces match the behavior that is available.

- Stable identifier: `quality:corrabora/core-qualities/usability#US5`
- Applicability: always considered
- Scenario prompts:
  - Exercise success, refusal, and degraded states using only information available at the interaction boundary.
- Evidence prompts:
  - Verify that each response identifies the condition, required action, and available state without implementation archaeology.
- Consequence dimensions: `duration-and-detectability` `safe-workaround-availability`

### US6

**Accessibility.** Interaction surfaces remain meaningful without color or interactivity and provide machine-readable forms where text scraping would otherwise be required.

- Stable identifier: `quality:corrabora/core-qualities/usability#US6`
- Applicability: always considered
- Scenario prompts:
  - Exercise relevant non-color, non-interactive, assistive, and constrained environments.
- Evidence prompts:
  - Verify equivalent meaning and task completion across the supported human-readable and machine-readable paths.
- Consequence dimensions: `affected-scope` `safe-workaround-availability`
