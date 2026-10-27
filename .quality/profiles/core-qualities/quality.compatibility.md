# Compatibility

Authority: `quality:corrabora/core-qualities/compatibility`

Version: `1.0.0`

The subject coexists with neighbors and exchanges versioned information with independent implementations and adjacent versions.

## Clauses

### CO1

**Co-existence.** The subject shares infrastructure without exclusive assumptions or unbounded interference with neighboring workloads.

- Stable identifier: `quality:corrabora/core-qualities/compatibility#CO1`
- Applicability: always considered
- Scenario prompts:
  - Run beside a representative neighbor under shared resource limits.
- Evidence prompts:
  - Measure interference in connections, storage, processor use, ports, queues, or other shared resources.
- Consequence dimensions: `affected-scope` `contract-or-boundary-violation`

### CO2

**Interoperability.** Every exchange surface has a specified, versioned contract sufficient for an independent implementation, and observed bytes and behavior conform to it.

- Stable identifier: `quality:corrabora/core-qualities/compatibility#CO2`
- Applicability: `fact:portable/serialized-boundary-change` is present
- Scenario prompts:
  - Exchange valid, boundary, and invalid messages with an independently implemented peer.
- Evidence prompts:
  - Compare schemas, encodings, units, error vocabulary, and observable behavior at the byte boundary.
- Consequence dimensions: `contract-or-boundary-violation` `affected-scope`

### CO3

**Version tolerance.** Supported adjacent protocol and schema versions interoperate across the stated upgrade window, with an explicit policy for unknown valid fields and version-breaking changes.

- Stable identifier: `quality:corrabora/core-qualities/compatibility#CO3`
- Applicability: `fact:portable/selected-format` is present
- Scenario prompts:
  - Exercise every supported version pair during upgrade and rollback conditions where promised.
- Evidence prompts:
  - Record an explicit outcome or non-applicability reason for each supported matrix cell.
- Consequence dimensions: `contract-or-boundary-violation` `safe-workaround-availability`
