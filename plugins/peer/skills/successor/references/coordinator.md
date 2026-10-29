# Transfer an owned coordinator Run

Load this only when the caller owns an existing Orca Run. Preserve the caller's
governing workflow and its live runtime contract. A worker's copied Run ID
does not make it its coordinator. Read the installed orchestration skill's
version-matched Run and message-handling guidance before runtime operations.

Record the Run/runtime identities, observed owner generation, mode, current
writer, candidate, worker Task/Dispatch identities, inbox position, pending
asks and operator questions, effective configuration, review release, coverage,
round counts, peer positions and cleanup obligations in the continuation
record or accessible retained references. Preserve the workflow's operator
guidance and bindings. Succession changes neither a release nor writing authority.

Use the same yield/confirmation/retirement protocol as the main skill, with
these continuity checks in the successor:

1. Verify its fresh session and requested versus observed launch settings;
   load the governing coordinator skill, existing binding and Run records.
2. Reconcile Git, Tasks, Dispatches and resource ownership. Create no new Run
   or coordinator Task/Dispatch. Live workers retain their existing assignments.
3. After predecessor yield, bind the existing Run from the successor's own
   identity using the runtime's `run-use`, without identity overrides or legacy
   takeover. Verify owner and consumer generation with `run-current` and
   `run-show`, using current help for the exact commands.
4. Recover pending deliveries, preserving message identities. Process every
   delivered row before acknowledgment; retain unresolved questions. A queued
   reply does not establish that a worker received it. Service transferred
   worker questions within their existing authority while completing transfer.
5. Bind confirmation to the nonce, both sessions, Run identity and observed
   generation, settings, continuity checks and visible successor title.

The predecessor verifies the actual new Run owner before retirement. The
successor starts new coordination/task batches only after retirement and UI
confirmation. If any step fails, preserve the observed owner and pending
deliveries, retain the handoff and keep new dispatch paused. This discipline
preserves one active coordinator; it does not claim the runtime fences a stale
owner's actions. Use the runtime's recovery procedure for uncertainty.
