---
name: bind-agent-workflow
description: Establish, refresh or check the operator's local binding of the agent workflow to one repository checkout, inside its ignored .peer-skills-and-workflows directory, by inspecting the repository's guidance, quality-profiles and verification tooling, securing local storage through Git's local exclude file, recording source identities and reporting readiness; a check reports whether the binding is still current and ready while leaving project files and workflow records unchanged. Use when asked to bind, adopt or refresh the agent workflow for a repository, to check whether an existing binding is current, ready or still established, or as the plan coordinator when initializing or resuming a run, in Claude or Codex. Not for reviewing, implementing or landing work.
---

# Bind agent workflow

You bind this workflow to one checkout for the operator who uses it. The
result is a local source map, `<checkout>/.peer-skills-and-workflows/binding.md` with
`binding-sources.json`, and a report of what it is ready for. You change
nothing the repository tracks and ask nothing of other contributors.

## Shared references

This skill is installed as a link. Resolve this file's real path, following
symlinks or junctions; the workflow source is two directories above the skill
directory. Before step 1, read `workflow/BINDING.md` there (the owner of the
binding's contents, defaults, readiness, local storage, refresh and
snapshots) and `workflow/templates/binding.md`. Use the source path a
coordinator supplied if it differs, and stop with a report if neither is
readable. Also read `workflow/RECORDS.md` (Writing) for skill loading and
returning to this task; this grants no run-record writing authority.

## Inputs

- The checkout to bind: the path given, else the top of the Git working tree
  you are in. Bind that checkout only; a linked worktree or a new clone binds
  itself.
- Mode: adopt (no binding yet), refresh (a binding exists) or check (report
  the storage state, source changes and readiness without changing project
  files or workflow records: no storage step, no binding or manifest write); and the next work the binding
  should be ready for, when stated.
- The operator's continuing choices and personal quality additions, from the
  existing binding, the request, or an active run's operator-guidance ledger.

## Work

1. **Inspect.** Run `node <workflow source>/tools/bind.mjs inspect --repo <checkout>`
   and read its JSON: checkout identity; `localStorage` (tracked local paths,
   whether Git excludes the `.peer-skills-and-workflows/` directory itself, the covering
   rule or the negation and partial effects, and whether the local rule is
   present, or unknown with `ruleError` naming the path and read cause); the
   existing binding with `binding.manifest` (usable, or its path and reason)
   and `binding.comparison`, whose scope is the recorded
   sources: `current` says whether those sources are present and unchanged, nothing
   about sources the binding never recorded; the quality selection with
   inherited profiles and extensions (a profile whose configured location
   resolves outside the checkout is reported `present: false` with
   `error: outside the checkout` and its location, and was not read: treat
   it as a missing dependency, never as the repository's installed
   selection); `candidates`, every guidance source found by name; and the
   workflow source identity. Git queries may update administrative caches,
   outside the CHECK promise. If `discovery.complete` is false, report a failed
   partial CHECK with `discovery.errors` paths, escaped names and causes, preserving
   independent facts. Do not establish coverage/readiness or read newly exposed
   candidates from that unverified discovery until the operator resolves the
   reported cause and a successful recheck establishes complete discovery:
   restoring access for an access failure, or obtaining a separately authorized
   rename to UTF-8 for a name that is not UTF-8 (BINDING.md, Path names). Never
   rename, untrack or edit project files yourself to clear it, and never look up
   an escaped name. When storage is occupied, binding-child facts
   are unavailable, not absent or current; do not read through the occupant.
   Read `binding.state` and `binding.sourcesState`: a link is an occupied child,
   even when dangling, and unavailable inspection has null presence and an
   error. Report `binding.conflict` and stop adoption or refresh until the
   operator resolves the entry or access; never follow linked binding children
   to read or write them. CHECK reports the conflict without changing it.
   A persisted manifest missing an evaluable workflow-source digest is unusable;
   report its path/reason and recommend factual refresh, preserving choices.
   Keep `recordedCheckout` and canonical `checkoutMatches` separate from content
   currentness. After copying or relocating a binding, refresh checkout-specific
   identity facts before readiness, preserving choices and snapshots; CHECK
   recommends that refresh without writing. A null match is unknown, with its
   reported cause, never a confirmed match.
   A nonzero source check may still return partial JSON: report unreadable
   sources, including the workflow source, with their causes/members and the
   work blocked. Git-visible identities cover available nested repositories
   and submodules, including direct child directories and named inner files;
   each child uses its own tracked plus untracked/nonignored working content.
   Report child revision/parent-pin discrepancies from `repositories` and
   `repositoryChanges` separately: content currentness does not establish pin
   agreement. Apply project pin requirements where relevant. Parent discovery
   does not enumerate all child guidance; assess known dependencies explicitly,
   without implicit instruction adoption or quality-profile imports.
   Unavailable/uninitialized or unsupported required child content keeps parent
   work blocked. Repair access/availability, work from the child's own checkout
   where appropriate, or obtain an operator support decision; a separate child
   binding alone does not establish parent readiness. Only when the inaccessible
   content is incidental may refresh record every required guidance path outside
   it individually instead of the encompassing directory, preserving all known
   obligations. CHECK only recommends this recovery and writes nothing; matching
   new siblings come through discovery, not narrowed recorded currentness.
   Supported child presence alone requires no refusal. Resolve the cause,
   obtain a successful recheck and assess discovered-guidance coverage before
   dependent progress; do not blindly
   retry or treat an incomplete report as current or ready. Read every listed source
   that can govern the next work: agent instructions at the root and in
   scope, planning, contribution and verification guidance, the quality
   selection and repository extensions, CI and hooks, an existing binding
   page or workflow notes. In refresh or check mode read what the comparison
   reports as changed or missing and every discovered guidance source the
   binding does not
   cite: a discovered source is new guidance to read and judge against the binding's
   coverage, never an obligation because it is listed. Run no project
   command and change no project configuration while inspecting.
2. **Establish local storage** (adopt and refresh) with
   `node <workflow source>/tools/bind.mjs exclude --repo <checkout>`.
   Continue on `ignored` or `added`. On `tracked`, `occupied`, `unwritable`
   or `unverified`, write nothing under `.peer-skills-and-workflows/` and report the
   conflict as the result (step 5), with the `overriddenBy` negation and the
   `children` a narrower rule would hide exactly as reported; do not untrack
   files, edit `.gitignore` or touch tracked content. Sequential repeat writes
   nothing, but after a possible concurrent setup outcome, wait for active
   calls to finish, inspect the actual occupant and Git coverage, and retry
   serially when that inspection justifies it. Null `overriddenBy` means
   uncertainty, not proof that no conflict exists. Preserve unrelated rules
   and real conflicts; do not blindly repair permissions or delete entries. An
   `occupied` result means a file, link or other entry holds the
   `.peer-skills-and-workflows` path: report its path, kind and the resolution the
   tool states, and never remove, unlink, overwrite or retarget it yourself;
   linked local storage is not supported. For `tracked`, offer separately
   authorized relocation or untracking, or forgoing adoption. For a confirmed
   ignore-policy conflict behind `unverified`, offer authorized resolution, or forgoing
   adoption. For ordinary access failures, the operator repairs access or the
   path before retrying. An `unwritable` result with code
   EPERM or EACCES inside an engine sandbox that keeps Git metadata
   read-only is resolved by the operator running that same command from an
   ordinary shell; say so in the report. If the local exclude file shows a
   cut-short line beside the rule, say so and leave it to the operator
   (`workflow/BINDING.md`, Local storage); the tool neither diagnoses nor
   deletes it. In check mode skip this step and report the `localStorage`
   facts from step 1: tracked content, an occupied path, a directory Git no
   longer excludes or a removed rule makes the binding not ready, and adopt
   or refresh (after the operator resolves an occupied path) is the next
   action.
   If `rulePresent` is null, report the local rule as unknown, preserve any
   independently established `ignored` coverage, and recommend that the operator
   restore access before retrying CHECK. Do not call it a removed rule, repair
   access yourself or discard valid coverage from another rule.
3. **Resolve.** For each binding section fill observed facts with their source
   path, defaults named as defaults (`workflow/BINDING.md`, Defaults) where the
   project is silent, and operator decisions quoted. Keep repository
   obligations and personal additions apart. Ask the operator, or the
   coordinator when dispatched, only about decisions and inaccessible facts
   the next work depends on, after inspecting; never re-ask a settled choice,
   and never read missing guidance as proof that no obligation exists. A
   missing or unreadable quality selection is an unresolved dependency that
   blocks review; name it rather than inventing or initializing profiles.
   An inherited-profile lookup access or decode error names its actual location
   and cause; report it as inaccessible, not uninstalled, and recommend
   restoring access or the manifest's content, then rechecking
   (`workflow/BINDING.md`, Readiness). CHECK does not repair permissions.
4. **Write or refresh.** Before drafting the source map's operational prose,
   load `write-for-agents` under RECORDS' Writing procedure. Write `binding.md`
   from the template, preserving
   every operator choice already recorded and leaving unrelated local files
   alone. If refresh appears interrupted, preserve surviving content and
   consult available authoritative decisions and appropriately scoped recovery
   evidence (`workflow/BINDING.md`, Refresh). Report uncertainty and ask before
   replacing uncertain preferences; an absent section proves no intentional
   deletion, and a stale snapshot never overrides a newer decision. Fill the
   template's contract reference with the resolved workflow source's canonical
   path, the same path the Identity section records, so
   the link to `workflow/BINDING.md` resolves from the local file and from
   every snapshot copy the coordinator publishes; never leave the placeholder
   or a path relative to the package. Then record the sources it cites with
   `node <workflow source>/tools/bind.mjs sources --repo <checkout> --out <checkout>/.peer-skills-and-workflows/binding-sources.json <path>...`,
   listing the guidance, quality and verification paths the binding relies on
   and any personal source, each by the path you name it by. Record the
   sources the same way when step 1 reported the manifest unusable: that
   rewrites only the factual manifest and leaves `binding.md` and published
   snapshots alone. The tool writes nothing without `--out`, and reserves local
   `binding.md` for operator choices: if an output resolves to it, report the
   refusal and use `binding-sources.json` for the factual manifest. It refuses a
   requested export beneath the named local storage path when that path is
   occupied, including either binding child: report `refused.occupied` and
   wait for the operator to resolve it before retrying. It also refuses a
   destination in checkout/owning-child Git administration or tracked by the
   checkout or owning nested repository/submodule. A child unavailable for
   protection also refuses. Report the path and cause, use a permitted export
   destination or wait for operator resolution, and never initialize/update a
   child for the export. External scratch and permitted untracked destinations
   remain available (`workflow/BINDING.md`, Procedure). Report `written` as the
   requested path and, when present, `resolved` as the actual destination; a
   permitted export through a named tracked link changes its target, not the link.
   In check mode leave project
   files and workflow records unchanged. In an active run only the coordinator
   writes these files, and
   that write grants no authority over the candidate.
5. **Report.** Before drafting the operator explanation, load `write-for-humans`
   under RECORDS' Writing procedure. State the binding path; the source-check
   result in two parts,
   kept apart: whether the recorded sources are current (else unreadable, changed or
   missing sources, a changed workflow source, or an unusable manifest with
   its path and reason; in a `sources --compare` of your own, `missing` also
   covers recorded paths you did not list, so list every recorded path, or
   rely on `inspect`, before calling a recorded source gone) and whether
   discovery found candidate guidance sources the binding
   does not cite, with what you concluded about each; the local storage
   state; the material changes made; each unresolved dependency with the work
   it blocks; and whether the binding is ready for the intended next work,
   with its basis (`workflow/BINDING.md`, Readiness). Readiness needs both
   parts; a written file alone is not readiness. When a conflict stopped
   setup, report that conflict, what you inspected and what remains undone as
   the result; in check mode, report what a refresh would have to do.

You are done when that report is given. Reviewing, implementing, landing,
starting a run and publishing a snapshot belong to the coordinator and the
other roles.
