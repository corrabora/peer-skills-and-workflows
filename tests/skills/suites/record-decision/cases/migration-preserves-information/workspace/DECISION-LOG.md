# Decision Log

| ID | Date | Status | Title |
| --- | --- | --- | --- |
| [ADR-0013](#adr-0013-bounded-payload-output) | 2026-09-08 | Accepted | Bounded payload output |
| [ADR-0041](#adr-0041-explicit-occurrence-capture) | 2026-09-27 | Accepted | Explicit occurrence capture |

## ADR-0013: Bounded payload output

- Date: 2026-09-08
- Status: Accepted
- Authority: owner approval of a per-operation serialization bound.

### Context

Serializers returned an owned buffer before the caller could reject oversize
output. Checking size afterwards allocates what the bound is meant to prevent.
The team tried post-hoc checking and rejected it for that reason. The same
problem affected content encoding, where expansion could exhaust memory.

### Decision

Serialization and content encoding write into a shared refusing destination.
The sink latches its first limit refusal because a compressor can fail during
finalization without returning that failure. Its refusal outranks an adapter’s
reported success. This is a bound per operation, not an aggregate concurrency
bound. The separate staging contract owns aggregate retained output.

### Consequences

Encoder working memory is outside the bound. A bundled convenience codec also
builds a transient string for Display values before it can emit a length prefix.
Eliminating that allocation needs an upstream change or a locally owned codec;
neither is proportionate to the convenience codec. That exclusion remains
accepted. Exact numerical defaults are maintained in docs/protocol.md.

Rendering occurs once before admission and again at emission; the extra work is
accepted because an arithmetic size model could drift from the renderer. The
alternative of checking after minting an identifier was rejected because a
refusal would consume identity. The rejection must happen before minting.
The review meeting also renamed three private helpers and discussed lunch.
The run took 47 seconds on one laptop; the scratch capture has since been deleted.
The team repeated that checking size after allocation does not bound allocation.

## ADR-0041: Explicit occurrence capture

- Date: 2026-09-27
- Status: Accepted
- Authority: owner approval of explicit construction-time UTC capture.

### Context

Users need optional occurrence metadata without adding clocks to protocol
progression. The original clockless rationale remains binding for progression.

### Decision

An explicit construction call can capture UTC through a private source seam.
Occurrence is advisory: no clock synchronization, authenticity or causal-order
guarantee follows from it. Receive, codec and scheduling work stay clockless.

### Consequences

Unsupported capture fails explicitly. Runtime source injection is deferred.

### Amendment, 2026-09-28: Application-owned clock

The owner subsequently approved an application-selected shared clock passed
through construction configuration, defaulting to the system clock. This replaces
only the private source seam and its deferral; clockless protocol progression
and advisory-only meaning remain binding. Application wiring owns selection,
not each call or a global registry. Completed events retain no clock source.
A shared provider adds lifetime and concurrency obligations to configuration.

