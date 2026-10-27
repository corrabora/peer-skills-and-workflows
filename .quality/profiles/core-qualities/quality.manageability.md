# Manageability

Authority: `quality:corrabora/core-qualities/manageability`

Version: `1.0.0`

A deployed subject can be controlled, administered, upgraded, observed, and supported by operators who did not construct it.

## Clauses

### MG1

**Operational control.** Lifecycle transitions are deliberate and lossless: accepted work is completed or handed off, load controls are invokable, and runtime-tunable settings take effect as declared.

- Stable identifier: `quality:corrabora/core-qualities/manageability#MG1`
- Applicability: always considered
- Scenario prompts:
  - Initiate drain, shutdown, shedding, backpressure, and runtime adjustment under representative in-flight load.
- Evidence prompts:
  - Measure completion bounds, accepted-work loss, and state visible at the operating boundary.
- Consequence dimensions: `data-loss` `reversibility-and-recovery-cost`

### MG2

**Administration.** Recurring administrative acts are supported, attributable operations with defined retry and recovery behavior rather than direct data surgery.

- Stable identifier: `quality:corrabora/core-qualities/manageability#MG2`
- Applicability: always considered
- Scenario prompts:
  - Exercise recurring onboarding, offboarding, limit, credential, and key-lifecycle journeys where applicable.
- Evidence prompts:
  - Verify intended state, attribution, retry behavior, and absence of unsupported direct mutation.
- Consequence dimensions: `privacy-or-security-exposure` `reversibility-and-recovery-cost`

### MG3

**Upgrade and migration.** Version upgrades and data migrations have a rehearsed forward path compatible with the supported topology and an explicit rollback or roll-forward posture.

- Stable identifier: `quality:corrabora/core-qualities/manageability#MG3`
- Applicability: always considered
- Scenario prompts:
  - Exercise every supported source-to-target version path in the relevant topology.
- Evidence prompts:
  - Record disruption, data meaning, protocol compatibility, and the tested recovery postcondition.
- Consequence dimensions: `data-loss` `contract-or-boundary-violation`

### MG4

**Monitoring and alerting.** A deployment exposes consumer-relevant health and saturation, and every condition requiring human action names that action and its urgency.

- Stable identifier: `quality:corrabora/core-qualities/manageability#MG4`
- Applicability: always considered
- Scenario prompts:
  - Introduce consumer-visible failures and saturation before the failure boundary is crossed.
- Evidence prompts:
  - Verify timely signals, accurate readiness, bounded cardinality, required action, and urgency.
- Consequence dimensions: `duration-and-detectability` `affected-scope`

### MG5

**Supportability.** A responder can collect safe diagnostics, follow an available recovery path, and escalate anticipated failures without access to implementation internals or unauthorized material.

- Stable identifier: `quality:corrabora/core-qualities/manageability#MG5`
- Applicability: always considered
- Scenario prompts:
  - Rehearse an anticipated failure with a responder unfamiliar with the implementation.
- Evidence prompts:
  - Measure time to safe diagnostics, correct recovery branch, and the stated recovery or escalation point.
- Consequence dimensions: `safe-workaround-availability` `privacy-or-security-exposure`
