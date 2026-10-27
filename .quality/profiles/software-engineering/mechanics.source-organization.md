# Source Organization

Authority: `mechanics:corrabora/software-engineering/source-organization`

Version: `1.0.0`

Portable source-organization obligations for predictable ownership, cohesive units, intentional public surfaces, colocated proof, contract-preserving reorganization, and concise, accurate code commentary.

## Clauses

### SO1

**Predictable semantic ownership.** Every behavior has a predictable semantic owner and can be found from that ownership boundary.

- Stable identifier: `mechanics:corrabora/software-engineering/source-organization#SO1`
- Applicability: always considered
- Scenario prompts:
  - Ask an unfamiliar maintainer to locate one behavior from its semantic role.
- Evidence prompts:
  - Navigate from a behavior's concept to its declared source owner without relying on accidental placement.
- Consequence dimensions: `duration-and-detectability` `affected-scope`

### SO2

**Cohesive source units.** Source units are cohesive around a type or tightly bound concern without prescribing one type per file or requiring files as a language construct.

- Stable identifier: `mechanics:corrabora/software-engineering/source-organization#SO2`
- Applicability: always considered
- Scenario prompts:
  - Change one concern and observe whether unrelated source units remain untouched.
- Evidence prompts:
  - Show the concern that binds each source unit and the unrelated concerns it excludes.
- Consequence dimensions: `affected-scope` `reversibility-and-recovery-cost`

### SO3

**Intentional public surfaces.** Public surfaces expose only intentional stable entry points and keep internal organization private.

- Stable identifier: `mechanics:corrabora/software-engineering/source-organization#SO3`
- Applicability: always considered
- Scenario prompts:
  - Reorganize an internal source unit while a consumer continues through the declared public surface.
- Evidence prompts:
  - Enumerate public entry points and identify the stability promise for each.
- Consequence dimensions: `contract-or-boundary-violation` `affected-scope`

### SO4

**No unrelated holding pens.** Unrelated behavior is not accumulated in a generic holding pen whose name does not state a narrow semantic owner.

- Stable identifier: `mechanics:corrabora/software-engineering/source-organization#SO4`
- Applicability: always considered
- Scenario prompts:
  - Locate a newly added behavior and verify its container name predicts its ownership.
- Evidence prompts:
  - Inspect broad containers and show the single narrow concern that justifies each one.
- Consequence dimensions: `affected-scope` `duration-and-detectability`

### SO5

**Proof travels with behavior.** Proof is located with the behavior it establishes or carries an explicit durable link to that behavior.

- Stable identifier: `mechanics:corrabora/software-engineering/source-organization#SO5`
- Applicability: always considered
- Scenario prompts:
  - Change a behavior and locate every proof that must move or be updated with it.
- Evidence prompts:
  - Trace each proof artifact to the exact behavior and claim it establishes.
- Consequence dimensions: `duration-and-detectability` `safe-workaround-availability`

### SO6

**Organization preserves contracts.** An organization change preserves declared public contracts unless the contract change is explicitly versioned and communicated.

- Stable identifier: `mechanics:corrabora/software-engineering/source-organization#SO6`
- Applicability: always considered
- Scenario prompts:
  - Exercise an existing consumer against the reorganized source through the unchanged public surface.
- Evidence prompts:
  - Compare public contracts before and after the organization change and identify any deliberate version transition.
- Consequence dimensions: `contract-or-boundary-violation` `reversibility-and-recovery-cost`

### SO7

**Informative implementation comments.** Implementation comments add information an experienced developer cannot readily recover from clear names, types, and ordinary language idioms. Explain intent, rationale, or a non-obvious algorithm at the level needed to understand or change it. Prefer clearer names or simpler structure when they remove the need for explanation; retain necessary rationale without introducing abstractions solely to eliminate comments.

- Stable identifier: `mechanics:corrabora/software-engineering/source-organization#SO7`
- Applicability: always considered
- Scenario prompts:
  - Read a commented block as a developer fluent in the language but unfamiliar with the local decision.
- Evidence prompts:
  - Identify the information each disputed comment adds, or show the specific code that already conveys it.
  - Before removing a comment, distinguish redundant narration from rationale or a warning needed for a correct change. Comment counts, density, and similarity scores alone establish no defect.
- Consequence dimensions: `duration-and-detectability`

### SO8

**Discoverable interface contracts.** Document intentional public interfaces at their declaration or through a discoverable authoritative contract. State purpose, observable behavior, and the caller obligations not evident from the signature, including relevant failure, side-effect, ownership, and concurrency semantics. Describe how to use the interface without requiring callers to read its implementation. Follow the ecosystem's documentation requirements without duplicating signature facts or internal mechanics.

- Stable identifier: `mechanics:corrabora/software-engineering/source-organization#SO8`
- Applicability: always considered
- Scenario prompts:
  - Use an interface from its declaration and documentation without inspecting its implementation.
- Evidence prompts:
  - Identify a caller decision supported by the documentation, or a missing contract fact that forces implementation inspection.
  - Check required public documentation against the applicable ecosystem convention; an obvious signature does not waive that requirement.
- Consequence dimensions: `contract-or-boundary-violation` `affected-scope`

### SO9

**Explicit non-obvious constraints.** Record constraints needed for a correct change when types, contracts, and clear code do not express them: units, ranges, coordinate systems, invariants, aliasing, ownership, lock order, timing assumptions, and external quirks. Explain the relevant hazard or reason at unsafe operations, intentional rule suppressions, workarounds, and surprising choices. Keep local essentials beside the affected code and link to a durable specification or decision for longer rationale.

- Stable identifier: `mechanics:corrabora/software-engineering/source-organization#SO9`
- Applicability: always considered
- Scenario prompts:
  - Attempt the apparently simpler implementation or vary an unstated unit, lifetime, ordering, or external assumption.
- Evidence prompts:
  - Name the constraint, the change that would violate it, and where a maintainer learns it.
  - Check that each disputed safety or workaround comment explains the actual hazard; a label such as "safe" or "required" is insufficient.
- Consequence dimensions: `contract-or-boundary-violation` `duration-and-detectability`

### SO10

**Comments remain true at their owner.** Keep comments with the declaration or behavior they describe; place shared contracts at their common owner and reference them from dependents. When behavior or assumptions change, verify the affected comments and linked documentation, and correct or remove invalid claims in the same change. Preserve still-valid explanation without requiring a textual edit merely because nearby code changed.

- Stable identifier: `mechanics:corrabora/software-engineering/source-organization#SO10`
- Applicability: always considered
- Scenario prompts:
  - Change or move a behavior and inspect the explanatory claims that cover it, including claims outside the edited lines.
- Evidence prompts:
  - Compare each affected claim with the resulting behavior and assumptions. Cite the contradiction or missing update for a stale-comment finding.
  - Verify that a maintainer can find shared rationale from each dependent location without maintaining competing copies.
- Consequence dimensions: `contract-or-boundary-violation` `duration-and-detectability`

### SO11

**Concise direct prose.** Write comments in concise, direct language. Use imperative phrasing for instructions and present-tense statements for facts; follow the ecosystem's established form for documentation summaries. Lead with the useful point and include only detail needed to use or change the code correctly. Remove filler, signature recitals, and tutorial narration of familiar language features while preserving necessary qualifications.

- Stable identifier: `mechanics:corrabora/software-engineering/source-organization#SO11`
- Applicability: always considered
- Scenario prompts:
  - Shorten an explanation while retaining every fact needed for a correct use or change.
- Evidence prompts:
  - Show the removable words or repeated facts and the resulting wording; length alone is not a finding.
  - Check that the opening summary states the contract or constraint directly and that any claimed mood violation accounts for the ecosystem convention.
- Consequence dimensions: `duration-and-detectability`

### SO12

**Actionable deferred work.** A TODO or FIXME identifies the unresolved work, a responsible owner or durable tracking reference, and an observable condition for resolution. Keep the local consequence understandable without opening the tracker. Remove resolved notes and repair or transfer abandoned ones without losing an unresolved obligation. Identifier syntax and tracking systems follow the consumer's conventions.

- Stable identifier: `mechanics:corrabora/software-engineering/source-organization#SO12`
- Applicability: always considered
- Scenario prompts:
  - Revisit a deferred-work note after its original author is unavailable or its removal condition becomes true.
- Evidence prompts:
  - Locate the responsible context and decide from the stated condition whether the note can be resolved.
  - Treat formatting patterns as discovery aids; substantiate missing ownership, context, or resolution conditions from the actual note.
- Consequence dimensions: `duration-and-detectability` `affected-scope`

### SO13

**Current source commentary.** Keep retired implementations and authorship or change chronology in version history or durable decision records. Source comments explain the current contract, constraint, or rationale and do not archive commented-out executable code or narrate the author's edits. Preserve required legal notices, tool directives, and clearly identified examples or counterexamples that serve the current documentation.

- Stable identifier: `mechanics:corrabora/software-engineering/source-organization#SO13`
- Applicability: always considered
- Scenario prompts:
  - Read a changed source unit without knowing when, by whom, or in which editing session it was written.
- Evidence prompts:
  - For an archival-comment finding, identify the retired code or edit-history claim and distinguish it from a necessary current rationale, example, directive, or legal notice.
- Consequence dimensions: `duration-and-detectability`
