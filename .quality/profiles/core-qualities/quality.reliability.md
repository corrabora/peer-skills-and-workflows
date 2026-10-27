# Reliability

Authority: `quality:corrabora/core-qualities/reliability`

Version: `1.0.0`

The subject behaves predictably, remains available within a stated failure model, degrades deliberately, and recovers to a known-good state.

## Clauses

### RL1

**Stability and predictability.** Repeated, concurrent, reordered, and retried inputs produce outcomes within an explicit accepted set, including any permitted nondeterminism.

- Stable identifier: `quality:corrabora/core-qualities/reliability#RL1`
- Applicability: `fact:portable/concurrency-control-change` is present
- Scenario prompts:
  - Exercise duplicates, reordered delivery, concurrency, and retries where the interface admits them.
- Evidence prompts:
  - Assert the complete accepted outcome set and zero invariant violations across controlled schedules.
- Consequence dimensions: `reversibility-and-recovery-cost` `data-loss`

### RL2

**Availability.** The subject serves within a stated failure model that names tolerated faults, service-limiting faults, and restart posture.

- Stable identifier: `quality:corrabora/core-qualities/reliability#RL2`
- Applicability: always considered
- Scenario prompts:
  - Introduce each named failure mode while exercising consumer-visible eligible events.
- Evidence prompts:
  - Measure the good-event ratio over the stated window and record which failure modes the objective includes.
- Consequence dimensions: `affected-scope` `duration-and-detectability`

### RL3

**Fault tolerance and graceful degradation.** When a dependency fails or misbehaves, the subject exhibits a designed bounded response such as shedding, queuing, retry, disclosed staleness, or loud refusal.

- Stable identifier: `quality:corrabora/core-qualities/reliability#RL3`
- Applicability: always considered
- Scenario prompts:
  - Exercise a dependency-fault matrix covering timeout, refusal, lag, malformed response, and recovery where relevant.
- Evidence prompts:
  - Verify the degraded response, bounds, disclosure, and time to a terminal decision for every row.
- Consequence dimensions: `affected-scope` `duration-and-detectability` `safe-workaround-availability`

### RL4

**Recoverability.** After interruption at any admitted point, the subject returns to a recognized correct state and completes, compensates, or reports in-flight work without silent partial effect.

- Stable identifier: `quality:corrabora/core-qualities/reliability#RL4`
- Applicability: `fact:portable/persisted-state-change` is present
- Scenario prompts:
  - Interrupt each persisted transition point and restart under permitted duplicate delivery.
- Evidence prompts:
  - Verify accepted postconditions plus stated recovery-time and recovery-point bounds.
- Consequence dimensions: `reversibility-and-recovery-cost` `data-loss`
