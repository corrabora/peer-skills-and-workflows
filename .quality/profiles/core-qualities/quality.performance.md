# Performance

Authority: `quality:corrabora/core-qualities/performance`

Version: `1.0.0`

Quality-significant operations respond within stated time, rate, resource, and capacity limits under named conditions.

## Clauses

### PE1

**Responsiveness.** Quality-significant operations have stated latency budgets at meaningful percentiles and meet those budgets under the stated load and payload conditions.

- Stable identifier: `quality:corrabora/core-qualities/performance#PE1`
- Applicability: always considered
- Scenario prompts:
  - Exercise an eligible operation under its stated load, payload class, percentile, and measurement point.
- Evidence prompts:
  - Report the latency distribution and the proportion of eligible operations meeting the threshold.
- Consequence dimensions: `duration-and-detectability` `affected-scope`

### PE2

**Throughput and timeliness.** The subject sustains stated request, event, and batch rates, and deadline-bearing work completes within its stated window.

- Stable identifier: `quality:corrabora/core-qualities/performance#PE2`
- Applicability: always considered
- Scenario prompts:
  - Offer the stated rate and exercise expiry, propagation, or scheduled work against its deadline.
- Evidence prompts:
  - Measure offered work, completed work, completion windows, and the eligible completion ratio.
- Consequence dimensions: `duration-and-detectability` `affected-scope`

### PE3

**Resource efficiency.** Memory, processor, storage, and connection use remain bounded and proportionate to the unit of work, with no leak or unrelated-state scaling across an operation boundary.

- Stable identifier: `quality:corrabora/core-qualities/performance#PE3`
- Applicability: always considered
- Scenario prompts:
  - Exercise representative and boundary workloads through steady state and recovery.
- Evidence prompts:
  - Measure resource ceilings per request, retained record, subject, or time window and detect drift.
- Consequence dimensions: `affected-scope` `reversibility-and-recovery-cost`

### PE4

**Capacity.** Operating limits exist for bounded resources and behavior at and beyond each limit is an explicit rejection, shedding, or backpressure decision.

- Stable identifier: `quality:corrabora/core-qualities/performance#PE4`
- Applicability: always considered
- Scenario prompts:
  - Exercise each stated boundary and at least one beyond-boundary case.
- Evidence prompts:
  - Show that admitted work meets its objective and excess work receives the defined response.
- Consequence dimensions: `affected-scope` `safe-workaround-availability`
