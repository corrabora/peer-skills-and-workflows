# ADR-0001: Commands complete at admission

- Date: 2026-09-08
- Status: Accepted

## Context

Writer handoff cannot promise peer receipt. Completion must have one stable meaning.

## Decision

Commands succeed when all their units are admitted while the outbound path is live.
Errors are message-only so callers have one diagnostic surface. A writer failure
after admission ends the endpoint; it does not retract command success.

## Consequences

Success promises admission, never peer receipt. Callers cannot classify failures
without parsing message text.

