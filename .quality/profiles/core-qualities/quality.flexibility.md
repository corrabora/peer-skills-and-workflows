# Flexibility

Authority: `quality:corrabora/core-qualities/flexibility`

Version: `1.0.0`

The subject adapts to environments, load, deployment shapes, and substitutable components without source modification.

## Clauses

### FX1

**Adaptability.** Behavior that legitimately varies by environment varies through explicit configuration with stated defaults rather than environment-specific branches in core behavior.

- Stable identifier: `quality:corrabora/core-qualities/flexibility#FX1`
- Applicability: always considered
- Scenario prompts:
  - Vary the supported environment matrix through configuration while holding required behavior constant.
- Evidence prompts:
  - Verify successful behavior and declared defaults in every supported matrix cell.
- Consequence dimensions: `affected-scope` `contract-or-boundary-violation`

### FX2

**Scalability and elasticity.** The scaling model states how instances, state, writers, tenants, data, and traffic grow, and following that model increases capacity without redesign.

- Stable identifier: `quality:corrabora/core-qualities/flexibility#FX2`
- Applicability: always considered
- Scenario prompts:
  - Apply a growth stimulus, the stated scaling action, and the relevant state-placement constraints.
- Evidence prompts:
  - Measure throughput, latency, and resource use across multiple points on the scaling curve.
- Consequence dimensions: `affected-scope` `duration-and-detectability`

### FX3

**Deployability and installability.** Every supported deployment shape installs and initializes through repeatable supplied steps from a clean environment.

- Stable identifier: `quality:corrabora/core-qualities/flexibility#FX3`
- Applicability: always considered
- Scenario prompts:
  - Install each supported shape from a clean environment using only supplied artifacts and descriptions.
- Evidence prompts:
  - Record success, repeatability, initialization bounds, and any undeclared manual step.
- Consequence dimensions: `safe-workaround-availability` `reversibility-and-recovery-cost`

### FX4

**Replaceability.** Components declared substitutable preserve a complete shared contract, pass common conformance obligations, and are not bypassed by consumers reaching concrete implementations.

- Stable identifier: `quality:corrabora/core-qualities/flexibility#FX4`
- Applicability: always considered
- Scenario prompts:
  - Run the same contract and conformance corpus against every claimed implementation.
- Evidence prompts:
  - Verify equivalent observable behavior and absence of concrete-type reach-around across the seam.
- Consequence dimensions: `contract-or-boundary-violation` `affected-scope`
