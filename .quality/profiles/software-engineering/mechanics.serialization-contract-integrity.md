# Serialization Contract Integrity

Authority: `mechanics:corrabora/software-engineering/serialization-contract-integrity`

Version: `1.0.0`

Portable serialization obligations for ownership, semantic fidelity, canonical bytes and spelling, ingress normalization, nested formats, evolution, bounded decoding, and foreign-contract containment.

## Clauses

### SC1

**One representation owner.** Each serialized representation has one declared contract owner for its shape, spelling, and evolution.

- Stable identifier: `mechanics:corrabora/software-engineering/serialization-contract-integrity#SC1`
- Applicability: any of (`fact:portable/persisted-state-change` is present; `fact:portable/serialized-boundary-change` is present)
- Scenario prompts:
  - Change a serialized boundary and verify one owner determines the resulting representation.
- Evidence prompts:
  - Name the owner of each representation and locate the contract that defines it.
- Consequence dimensions: `contract-or-boundary-violation` `affected-scope`

### SC2

**Semantic encode/decode fidelity.** Encoding and decoding preserve the represented semantic value across every supported round trip.

- Stable identifier: `mechanics:corrabora/software-engineering/serialization-contract-integrity#SC2`
- Applicability: any of (`fact:portable/persisted-state-change` is present; `fact:portable/serialized-boundary-change` is present)
- Scenario prompts:
  - Encode, decode, and compare representative, empty, maximum, and nested values.
- Evidence prompts:
  - Provide representative and boundary round-trip vectors with semantic equality checks.
- Consequence dimensions: `data-loss` `contract-or-boundary-violation`

### SC3

**Canonical identity bytes.** Where encoded bytes participate in identity, signing, replay, or stable comparison, one canonical encoding exists for each semantic value.

- Stable identifier: `mechanics:corrabora/software-engineering/serialization-contract-integrity#SC3`
- Applicability: `fact:portable/selected-format` is present
- Scenario prompts:
  - Encode the same semantic value repeatedly and across independent implementations where byte identity is claimed.
- Evidence prompts:
  - Provide canonical vectors and show that equivalent values cannot produce competing accepted byte sequences.
- Consequence dimensions: `contract-or-boundary-violation` `privacy-or-security-exposure`

### SC4

**Canonical machine spelling.** Machine output emits one canonical spelling for each serialized value.

- Stable identifier: `mechanics:corrabora/software-engineering/serialization-contract-integrity#SC4`
- Applicability: `fact:portable/selected-format` is present
- Scenario prompts:
  - Emit each closed value through every supported machine-output path and compare exact spelling.
- Evidence prompts:
  - List the canonical emitted spellings and compare outputs from every writer.
- Consequence dimensions: `contract-or-boundary-violation` `duration-and-detectability`

### SC5

**Human-input normalization at ingress.** Lenient or normalizing human input is confined to ingress and becomes the canonical internal value before further storage, emission, or comparison.

- Stable identifier: `mechanics:corrabora/software-engineering/serialization-contract-integrity#SC5`
- Applicability: `fact:portable/selected-format` is present
- Scenario prompts:
  - Enter documented human variants and verify all subsequent output uses one canonical value.
- Evidence prompts:
  - Show accepted human-input variants, the ingress normalization step, and the one emitted canonical form.
- Consequence dimensions: `contract-or-boundary-violation` `duration-and-detectability`

### SC6

**Layer-owned nested representations.** A nested representation obeys the contract owner and format rules of each layer independently.

- Stable identifier: `mechanics:corrabora/software-engineering/serialization-contract-integrity#SC6`
- Applicability: `fact:portable/serialized-boundary-change` is present
- Scenario prompts:
  - Round-trip a nested value while checking the contract at both the container and nested layers.
- Evidence prompts:
  - Identify every nested layer and show which owner and format governs each one.
- Consequence dimensions: `contract-or-boundary-violation` `data-loss`

### SC7

**Explicit schema evolution.** Serialized contracts state explicit schema, version, compatibility, and evolution rules for every supported transition.

- Stable identifier: `mechanics:corrabora/software-engineering/serialization-contract-integrity#SC7`
- Applicability: any of (`fact:portable/persisted-state-change` is present; `fact:portable/selected-format` is present)
- Scenario prompts:
  - Exercise each promised adjacent-version transition in both directions where supported.
- Evidence prompts:
  - Provide the supported version matrix and the handling rule for additions, removals, and unknown valid data.
- Consequence dimensions: `contract-or-boundary-violation` `reversibility-and-recovery-cost`

### SC8

**Bounded unambiguous decoding.** Decoding is unambiguous and bounded, and malformed, unsupported, or trailing input is refused without partial acceptance.

- Stable identifier: `mechanics:corrabora/software-engineering/serialization-contract-integrity#SC8`
- Applicability: `fact:portable/serialized-boundary-change` is present
- Scenario prompts:
  - Decode adversarial boundary inputs and verify exact refusal with no partially accepted value.
- Evidence prompts:
  - Provide negative decoding vectors for malformed, truncated, oversized, ambiguous, unsupported, and trailing input.
- Consequence dimensions: `privacy-or-security-exposure` `contract-or-boundary-violation`

### SC9

**Foreign contracts stay at translation boundaries.** Foreign contract names and representations remain contained at an explicit translation boundary.

- Stable identifier: `mechanics:corrabora/software-engineering/serialization-contract-integrity#SC9`
- Applicability: `fact:portable/serialized-boundary-change` is present
- Scenario prompts:
  - Carry a foreign representation through translation and verify its spelling does not leak beyond the boundary.
- Evidence prompts:
  - Name the foreign contract owner and show the translation into internal semantic values.
- Consequence dimensions: `contract-or-boundary-violation` `affected-scope`
