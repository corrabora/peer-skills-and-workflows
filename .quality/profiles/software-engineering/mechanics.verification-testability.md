# Verification Testability

Authority: `mechanics:corrabora/software-engineering/verification-testability`

Version: `1.0.0`

Portable proof obligations for named seams, meaningful substitutes, owning-tier evidence, controlled failures, scenario coverage, conformance, claim traceability, and retained baselines.

## Clauses

### VT1

**Named controllable seams.** Every substitutable or effectful boundary has a stable name and a controllable seam.

- Stable identifier: `mechanics:corrabora/software-engineering/verification-testability#VT1`
- Applicability: always considered
- Scenario prompts:
  - Replace or control each effectful boundary while exercising the behavior that consumes it.
- Evidence prompts:
  - Name each seam and show the observable boundary it controls.
- Consequence dimensions: `duration-and-detectability` `affected-scope`

### VT2

**Meaningful independent substitutes.** Where substitution is claimed, the seam is exercised by more than one meaningful independently implemented substitute; no interface is required without that claim, and a canned mock or second label over one implementation is not independent.

- Stable identifier: `mechanics:corrabora/software-engineering/verification-testability#VT2`
- Applicability: `fact:portable/implementation-language-declared` is present
- Scenario prompts:
  - Run the same observable contract scenario through each meaningful substitute.
- Evidence prompts:
  - Identify independently implemented substitutes and the scenario that would expose a substitution defect.
- Consequence dimensions: `contract-or-boundary-violation` `duration-and-detectability`

### VT3

**Proof at the owning collaborator tier.** Each proof lives at the collaborator tier that owns the behavior and the real collaborators it exercises, without prescribing a repository-specific tier roster.

- Stable identifier: `mechanics:corrabora/software-engineering/verification-testability#VT3`
- Applicability: always considered
- Scenario prompts:
  - Exercise the claim at the lowest boundary that still includes every collaborator the claim depends on.
- Evidence prompts:
  - Name the behavior owner, the real collaborators in the proof, and why that proof boundary is sufficient.
- Consequence dimensions: `duration-and-detectability` `affected-scope`

### VT4

**Controlled failure and nondeterminism.** Failures and nondeterminism that affect a behavioral claim are inducible, observable, and controllable.

- Stable identifier: `mechanics:corrabora/software-engineering/verification-testability#VT4`
- Applicability: always considered
- Scenario prompts:
  - Induce each relevant failure and scheduling or time variation without relying on chance.
- Evidence prompts:
  - Show the control used to induce each relevant failure or nondeterministic outcome and the observation that distinguishes it.
- Consequence dimensions: `duration-and-detectability` `reversibility-and-recovery-cost`

### VT5

**Complete scenario classes.** Verification covers happy, failure, boundary, seam, and concurrency scenarios whenever each class is relevant to the claim.

- Stable identifier: `mechanics:corrabora/software-engineering/verification-testability#VT5`
- Applicability: always considered
- Scenario prompts:
  - Execute one representative scenario from every class relevant to the behavior.
- Evidence prompts:
  - Map every behavioral claim to its relevant scenario classes and name any class whose premise is absent.
- Consequence dimensions: `affected-scope` `duration-and-detectability`

### VT6

**Cross-substitute conformance.** A claim spanning substitutes has wired conformance or parity scenarios and independent implementation proof; generic scenario wiring remains distinct from a product-specific implementation's claim proof.

- Stable identifier: `mechanics:corrabora/software-engineering/verification-testability#VT6`
- Applicability: `fact:portable/implementation-language-declared` is present
- Scenario prompts:
  - Run the same conformance scenario against each independent implementation and inject a defective substitute.
- Evidence prompts:
  - Show the shared scenario set, each independent implementation entry point, and the separate proof for implementation-specific claims.
- Consequence dimensions: `contract-or-boundary-violation` `affected-scope`

### VT7

**Bidirectional claim-to-gate trace.** Every behavioral claim traces to factual verification and acceptance gates in both directions without depending on workflow phase, hook, role, or lifecycle vocabulary.

- Stable identifier: `mechanics:corrabora/software-engineering/verification-testability#VT7`
- Applicability: always considered
- Scenario prompts:
  - Select a claim and a gate independently and trace each to its reciprocal evidence relationship.
- Evidence prompts:
  - Provide a bidirectional claim-to-gate map and the factual result for each gate.
- Consequence dimensions: `duration-and-detectability` `contract-or-boundary-violation`

### VT8

**Preserved behavioral baseline.** An established behavioral baseline is retained unless an intentional change is named and the changed behavior is re-proven.

- Stable identifier: `mechanics:corrabora/software-engineering/verification-testability#VT8`
- Applicability: always considered
- Scenario prompts:
  - Run retained regression scenarios and one deliberately changed scenario against the current subject.
- Evidence prompts:
  - Compare the prior behavioral baseline with current results and identify every intentional difference and its new proof.
- Consequence dimensions: `affected-scope` `reversibility-and-recovery-cost`
