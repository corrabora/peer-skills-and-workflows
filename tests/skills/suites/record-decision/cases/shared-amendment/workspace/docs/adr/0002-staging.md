# ADR-0002: Requests wait outside the owner

- Date: 2026-09-11
- Status: Accepted

## Context

An owner waiting for its own queue can stop progress that releases capacity.

## Decision

Stage requests in bounded room and wait for admission outside the owner.
Permanent refusals are message-only to match the endpoint diagnostic surface.

## Consequences

Full capacity delays senders but does not block the owner. Permanent refusals
cannot be classified without parsing text.

