# Safety

Authority: `quality:corrabora/core-qualities/safety`

Version: `1.0.0`

Hazards to people, property, and the environment are explicitly bounded, and physical-consequence integrations define safe failure behavior before use.

## Clauses

### SA1

**Scope declaration.** The affected boundary and possible physical consequences are declared so informational harms and physical hazards route to their appropriate obligations.

- Stable identifier: `quality:corrabora/core-qualities/safety#SA1`
- Applicability: always considered
- Scenario prompts:
  - Identify what the subject controls or gates and the consequence of an incorrect allow, deny, delay, or stale result.
- Evidence prompts:
  - Inspect deployment-boundary evidence and classify every credible harm path.
- Consequence dimensions: `physical-harm` `affected-scope`

### SA2

**Activation obligation.** Before a boundary can actuate or gate a physical-consequence process, its hazards, safe failure states, operating constraints, warnings, and verification obligations are defined.

- Stable identifier: `quality:corrabora/core-qualities/safety#SA2`
- Applicability: always considered
- Scenario prompts:
  - For each material hazard, exercise the initiating stimulus in normal, boundary, and fault environments.
- Evidence prompts:
  - Verify the safe state, response deadline, warning path, constraint, and exact acceptance evidence.
- Consequence dimensions: `physical-harm` `reversibility-and-recovery-cost`
