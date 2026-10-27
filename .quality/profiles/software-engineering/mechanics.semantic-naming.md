# Semantic Naming

Authority: `mechanics:corrabora/software-engineering/semantic-naming`

Version: `1.0.0`

Portable naming obligations that keep declarations, operations, concepts, context, constants, and foreign vocabulary semantically accurate.

## Clauses

### SN1

**Declarations state what values are.** A declaration names what its value is at the declaration's abstraction level.

- Stable identifier: `mechanics:corrabora/software-engineering/semantic-naming#SN1`
- Applicability: always considered
- Scenario prompts:
  - Read a declaration without its implementation detail and identify the represented concept.
- Evidence prompts:
  - Compare declaration names with the concepts their values represent.
- Consequence dimensions: `duration-and-detectability` `affected-scope`

### SN2

**Operations state effects or answers.** An operation's name states its full observable effect or the answer it returns.

- Stable identifier: `mechanics:corrabora/software-engineering/semantic-naming#SN2`
- Applicability: always considered
- Scenario prompts:
  - Invoke an operation and compare every observable result with the promise made by its name.
- Evidence prompts:
  - Compare operation names with their returned answers and externally observable effects.
- Consequence dimensions: `contract-or-boundary-violation` `duration-and-detectability`

### SN3

**One term per concept.** One established term denotes one concept, and one concept uses one term within its declared scope.

- Stable identifier: `mechanics:corrabora/software-engineering/semantic-naming#SN3`
- Applicability: always considered
- Scenario prompts:
  - Trace one concept across its consumers and verify the term stays stable and unambiguous.
- Evidence prompts:
  - Search the subject vocabulary for aliases and overloaded terms.
- Consequence dimensions: `affected-scope` `duration-and-detectability`

### SN4

**Meaning changes rename.** When an identifier's meaning changes, the identifier is renamed in the same change.

- Stable identifier: `mechanics:corrabora/software-engineering/semantic-naming#SN4`
- Applicability: always considered
- Scenario prompts:
  - Follow a changed concept through every touched use and confirm its name still states its meaning.
- Evidence prompts:
  - Compare changed meaning with touched declarations, uses, and explanatory material.
- Consequence dimensions: `duration-and-detectability` `contract-or-boundary-violation`

### SN5

**Established domain vocabulary.** Identifiers use deliberately established domain vocabulary instead of local synonyms.

- Stable identifier: `mechanics:corrabora/software-engineering/semantic-naming#SN5`
- Applicability: always considered
- Scenario prompts:
  - Navigate between two consumers of the same concept and observe the same established term.
- Evidence prompts:
  - Compare identifiers with the vocabulary source that owns their concepts.
- Consequence dimensions: `affected-scope` `duration-and-detectability`

### SN6

**Context matches travel distance.** A name carries enough qualifying context to remain unambiguous across the distance it travels.

- Stable identifier: `mechanics:corrabora/software-engineering/semantic-naming#SN6`
- Applicability: always considered
- Scenario prompts:
  - Move from a name's declaration to its farthest consumer and verify its meaning remains clear.
- Evidence prompts:
  - Inspect names at local and wide-travel boundaries for sufficient distinguishing context.
- Consequence dimensions: `duration-and-detectability` `affected-scope`

### SN7

**Constants name roles.** A constant names the semantic role of its value rather than restating the value itself.

- Stable identifier: `mechanics:corrabora/software-engineering/semantic-naming#SN7`
- Applicability: always considered
- Scenario prompts:
  - Change a constant's value without changing its role and verify the name remains accurate.
- Evidence prompts:
  - Explain the role named by each constant independently of its current literal value.
- Consequence dimensions: `duration-and-detectability` `reversibility-and-recovery-cost`

### SN8

**Foreign names stay at translation boundaries.** Externally imposed names are preserved only at their translation boundary and are translated to the subject's established vocabulary inside it.

- Stable identifier: `mechanics:corrabora/software-engineering/semantic-naming#SN8`
- Applicability: always considered
- Scenario prompts:
  - Carry an externally named value through ingress and verify foreign vocabulary does not spread past translation.
- Evidence prompts:
  - Identify each foreign naming owner and the boundary where its terms are translated.
- Consequence dimensions: `contract-or-boundary-violation` `affected-scope`
