# Functionality

Authority: `quality:corrabora/core-qualities/functionality`

Version: `1.0.0`

The subject does the right things, does them correctly, and does all of them without introducing unneeded behavior.

## Clauses

### FN1

**Completeness.** Every behavior promised by the governing need or contract is delivered, including every admitted branch, parameter, case, and documented surface.

- Stable identifier: `quality:corrabora/core-qualities/functionality#FN1`
- Applicability: always considered
- Scenario prompts:
  - Enumerate promised behaviors and critical journeys, then exercise every named obligation.
- Evidence prompts:
  - Compare each promise with named evidence that demonstrates the corresponding behavior.
- Consequence dimensions: `affected-scope` `contract-or-boundary-violation`

### FN2

**Correctness.** For every admitted input, including boundary, empty, maximal, reordered, concurrent, and error inputs where relevant, behavior produces the specified observable result.

- Stable identifier: `quality:corrabora/core-qualities/functionality#FN2`
- Applicability: always considered
- Scenario prompts:
  - Exercise input classes, boundaries, failures, and permitted orderings against exact postconditions.
- Evidence prompts:
  - Use examples, properties, or a conformance corpus that covers the admitted input space.
- Consequence dimensions: `affected-scope` `reversibility-and-recovery-cost`

### FN3

**Appropriateness.** The delivered functions fit the actual need without missing steps that force workarounds or speculative surface without a named need.

- Stable identifier: `quality:corrabora/core-qualities/functionality#FN3`
- Applicability: always considered
- Scenario prompts:
  - Name the actor, goal, supported surface, and any workaround required to complete the goal.
- Evidence prompts:
  - Trace each delivered surface to a current need and show that the supported journey is complete.
- Consequence dimensions: `affected-scope` `safe-workaround-availability`
