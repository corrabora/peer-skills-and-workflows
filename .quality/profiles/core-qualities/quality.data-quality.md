# Data quality

Authority: `quality:corrabora/core-qualities/data-quality`

Version: `1.0.0`

Recorded information is accurate, complete, consistent, fresh enough, attributable, traceable, and durable for exactly its stated retention.

## Clauses

### DQ1

**Accuracy and precision.** Recorded values agree with their comparison authority at the required precision, with units, zones, and rounding policy explicit.

- Stable identifier: `quality:corrabora/core-qualities/data-quality#DQ1`
- Applicability: always considered
- Scenario prompts:
  - Compare representative and boundary values with the named authority using the stated units and precision.
- Evidence prompts:
  - Measure admitted error against the explicit tolerance; exact contracts require exact equality.
- Consequence dimensions: `data-loss` `contract-or-boundary-violation`

### DQ2

**Completeness and consistency.** Records are whole, required references resolve, and cross-record invariants hold at every observable boundary including concurrency, retry, and partial failure.

- Stable identifier: `quality:corrabora/core-qualities/data-quality#DQ2`
- Applicability: always considered
- Scenario prompts:
  - Exercise invariant-preserving transitions under concurrency, retry, interruption, and partial failure.
- Evidence prompts:
  - Evaluate invariants at every observable transaction boundary and reject any reachable invalid state.
- Consequence dimensions: `data-loss` `affected-scope`

### DQ3

**Freshness.** Consumers can determine value age, each derived or cached value has a stated staleness bound, and behavior after the bound is explicit.

- Stable identifier: `quality:corrabora/core-qualities/data-quality#DQ3`
- Applicability: always considered
- Scenario prompts:
  - Read eligible values before, at, and after the consumer-specific staleness bound.
- Evidence prompts:
  - Measure knowable age, eligible population, window, and the required over-bound response.
- Consequence dimensions: `duration-and-detectability` `affected-scope`

### DQ4

**Credibility and provenance.** Every assertion identifies its recording source, authority, and sufficient permitted provenance to judge trustworthiness without treating mere presence as proof.

- Stable identifier: `quality:corrabora/core-qualities/data-quality#DQ4`
- Applicability: always considered
- Scenario prompts:
  - Reconstruct the origin and authority of every representative assertion class.
- Evidence prompts:
  - Verify structured, resolvable provenance while preserving declared disclosure and retention boundaries.
- Consequence dimensions: `privacy-or-security-exposure` `contract-or-boundary-violation`

### DQ5

**Lineage.** Derived information can be traced to its inputs, logic version, and computation time so affected outputs can be enumerated and recomputation explained.

- Stable identifier: `quality:corrabora/core-qualities/data-quality#DQ5`
- Applicability: always considered
- Scenario prompts:
  - Select representative derived values, enumerate inputs, and repeat computation with the recorded logic version.
- Evidence prompts:
  - Verify blast-radius enumeration and explain whether and why recomputation differs.
- Consequence dimensions: `affected-scope` `duration-and-detectability`

### DQ6

**Durability and retention.** Information survives named faults and migrations for exactly its stated retention, and end-of-retention removal includes derived copies, indexes, and caches.

- Stable identifier: `quality:corrabora/core-qualities/data-quality#DQ6`
- Applicability: `fact:portable/persisted-state-change` is present
- Scenario prompts:
  - Exercise backup, restore, migration, named faults, and end-of-retention removal.
- Evidence prompts:
  - Compare meaning after recovery and verify recovery bounds plus complete derivative removal by its deadline.
- Consequence dimensions: `data-loss` `reversibility-and-recovery-cost`
