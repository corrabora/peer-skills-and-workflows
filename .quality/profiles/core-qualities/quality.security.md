# Security

Authority: `quality:corrabora/core-qualities/security`

Version: `1.0.0`

Information and operations are protected so authorized identities alone may read or change them, consequential acts are attributable, and deliberate misuse is resisted.

## Clauses

### SE1

**Confidentiality.** Information is readable only by authorized principals and does not leak through responses, timing, caches, diagnostics, or auxiliary surfaces.

- Stable identifier: `quality:corrabora/core-qualities/security#SE1`
- Applicability: `fact:portable/sensitive-data-handling` is present
- Scenario prompts:
  - Exercise authorized and unauthorized actor classes across every relevant read and side channel.
- Evidence prompts:
  - Verify zero unauthorized disclosure and preservation of the declared custody boundary.
- Consequence dimensions: `privacy-or-security-exposure` `affected-scope`

### SE2

**Integrity.** State changes only through authorized, validated paths, with external input validated before reliance and tampering detectable where the trust model requires it.

- Stable identifier: `quality:corrabora/core-qualities/security#SE2`
- Applicability: `fact:portable/trust-boundary-crossing` is present
- Scenario prompts:
  - Attempt authorized, unauthorized, malformed, replayed, and tampered mutations at each trust boundary.
- Evidence prompts:
  - Verify zero unauthorized effects and validation before any decision or mutation.
- Consequence dimensions: `privacy-or-security-exposure` `contract-or-boundary-violation`

### SE3

**Accountability and auditability.** Every consequential action is attributable to a specific principal with enough structured evidence to reconstruct who acted, what occurred, when, and under which authority.

- Stable identifier: `quality:corrabora/core-qualities/security#SE3`
- Applicability: always considered
- Scenario prompts:
  - Perform consequential actions and later reconstruct them without ambient memory.
- Evidence prompts:
  - Recover the principal, action, authority, ordering information, and protected evidence from retained records.
- Consequence dimensions: `privacy-or-security-exposure` `duration-and-detectability`

### SE4

**Authenticity and non-repudiation.** Identities are verified at the point of reliance, and dispute-relevant actions retain durable proof binding the actor to the act.

- Stable identifier: `quality:corrabora/core-qualities/security#SE4`
- Applicability: always considered
- Scenario prompts:
  - Exercise identity claims at reliance points and later dispute representative consequential acts.
- Evidence prompts:
  - Verify the identity proof and durable binding between actor, authority, and action.
- Consequence dimensions: `privacy-or-security-exposure` `contract-or-boundary-violation`

### SE5

**Resistance.** External input is distrusted by default, work before verification is bounded, abuse opportunities are rate-limited where needed, and exposed attack surface is deliberately minimal.

- Stable identifier: `quality:corrabora/core-qualities/security#SE5`
- Applicability: always considered
- Scenario prompts:
  - Apply hostile, malformed, amplified, concurrent, and over-rate inputs at and beyond stated bounds.
- Evidence prompts:
  - Measure work, amplification, concurrency, and rate ceilings before trust is established.
- Consequence dimensions: `privacy-or-security-exposure` `affected-scope` `duration-and-detectability`
