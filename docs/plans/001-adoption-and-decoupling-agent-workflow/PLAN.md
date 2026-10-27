# Plan: local adoption and decoupled agent workflow

Status: proposed. This plan defines the change; it does not implement it.

## Objective

Make agent-workflow a personal development aid that can operate in a shared
repository without asking other developers to adopt, understand or work around
its procedures. An agent-led binding workflow establishes and maintains the
operator's integration in the checkout's isolated `.agent-workflow/` directory.

Repository-owned quality-profiles, including repository extensions, are the
intentional shared integration point. Adopting agent-workflow requires no other
tracked integration changes in a target repository. Existing project guidance
continues to govern the work; this workflow adapts to it.

The operator chooses this process to meet personal quality objectives and
influences through the resulting work. Using different skills or development
practices is not itself a defect for other contributors to correct.

## Context and scope

The [initial plan](../000-initial-agent-workflow/PLAN.md) established the portable
roles and supervised review process. Its binding model requires a maintained
repository page, a root agent-instruction pointer, a shared ignore arrangement
and retirement of superseded skills. Those requirements create adoption work
and procedural coupling outside the operator's own workflow.

This plan replaces those adoption requirements. Its implementation must update
the assumptions spread across [BINDING.md](../../../workflow/BINDING.md),
[PROCESS.md](../../../workflow/PROCESS.md),
[RECORDS.md](../../../workflow/RECORDS.md),
[ORCA.md](../../../workflow/ORCA.md), the role skills and the
[README](../../../README.md). The initial plan remains a historical record;
the implemented contracts become the current guidance.

Apply the relevant lessons from the
[skill-writing research](../../research/matt-pocock-skill-writing.md): one
bounded job, explicit inputs and completion, inspect facts before asking
questions, reference authoritative sources, and keep deterministic mechanics
in tools. A general rewrite of the existing skills is outside this plan.

## Ownership and integration boundary

| Owner and location | Contents and authority |
| --- | --- |
| Target repository, tracked | Its quality-profiles selection, inherited profiles and repository extensions; its existing project, planning, verification and delivery guidance. These remain shared project obligations. |
| Operator's checkout, `.agent-workflow/` | The local binding, personal workflow preferences, existing worker configuration, local plans where appropriate, and run records. These organize the operator's use of the workflow. |
| Workflow package | Portable role behavior, review and adjudication contracts, binding procedure, defaults and tools. |
| Current task and operator instructions | Objective, plan and phase, candidate, scope, decisions and execution authorization. A reusable binding never grants a release for future work. |

Personal additions to quality objectives must be visibly distinguished from
repository requirements. They may add obligations to the operator's authorized
work; they neither weaken project requirements nor become requirements for
other developers. Preserve their source when allocating review sets and
reporting findings. Worker profiles remain execution settings, separate from
quality-profiles.

The binding references repository quality configuration and extensions instead
of copying them into a competing selection. Initialized quality-profiles remain
a prerequisite for dependent review. If they are missing, identify that
dependency and follow the existing operator initialization boundary; binding
does not invent profiles or silently initialize or change them.

No new root `AGENTS.md` or `CLAUDE.md` instructions, contribution policy, CI
integration, tracked binding page, shared ignore edit or repository skill
removal is required. Tracked quality configuration and extensions continue to
be managed through their own authorized workflow. Ordinary project changes
made to deliver a task are separate from adoption changes.

## Minimal local binding

Use `<coordinator checkout>/.agent-workflow/binding.md` as the maintained local
entry point. It is a compact source map and record of resolved choices, not a
second project handbook. It contains only what dispatch needs:

- Repository and checkout identity, the workflow source used, and when its
  sources were last checked.
- References to applicable project and planning guidance, quality selection
  and extensions, and any existing review or delivery requirements.
- Verification and evidence commands with their working directories, required
  proofs and evidence validity rules, citing the sources that establish them.
- Candidate and landing conventions, output locations, and explicit departures
  from package defaults. Use defaults where project guidance is silent rather
  than requiring a questionnaire about every workflow detail.
- The operator's continuing preferences and additional quality objectives,
  with their source and scope separated from discovered project facts.
- Unresolved decisions or inaccessible sources and the work each one blocks.

Keep observed facts, inferred defaults and operator decisions distinct. Store
enough source identity to detect changed or missing inputs, including local
edits; a branch name or last-checked timestamp alone is insufficient. Preserve
the exact wording of continuing operator choices when it matters, so deleting
an old run does not erase them. Run-specific authorization stays in that run's
guidance ledger.

For Git-visible directory and workflow-source identities, measure nested
repositories and submodules through each available child's tracked plus
untracked/nonignored working contents, including deeper children and direct
child-directory or inner-file sources. Preserve link and containment
boundaries, administrative exclusions and the existing ignored/all-files
policy. Unavailable or uninitialized children make checks incomplete; queries
never initialize or update them. Report parent pins and child revisions
separately from content changes: content readiness does not imply pin
agreement. This measurement adopts no child instructions or shared-quality
imports; source authority and required coverage still need assessment. The
owning [binding contract](../../../workflow/BINDING.md) defines these boundaries
and recovery for incidental unavailable content.

Existing `.agent-workflow/config.yaml` and
`.agent-workflow/plans/<plan>.yaml` retain their worker-configuration purposes.
The latter is not a directory convention for plan documents. A task may keep
an unpublished plan locally when project guidance permits; shared deliverables
and durable project decisions use the project's normal locations and stand
without the local binding or run records.

## Agent-led binding workflow

Add a narrowly scoped `bind-agent-workflow` skill, usable explicitly for adoption
or refresh and loaded by the coordinator when establishing its binding. It
does not require a new Orca worker role or start a review run merely to bind a
repository. Shared binding procedure has one owner in `workflow/BINDING.md`.

1. **Inspect.** Resolve the intended checkout and installed workflow source.
   Read existing project instructions, quality selection and extensions,
   planning and contribution guidance, verification tooling and relevant CI.
   Reuse established operator choices and existing binding sources. Discovery
   does not execute arbitrary project commands or change project configuration.
2. **Establish local storage.** Confirm that nothing under `.agent-workflow/`
   is tracked. Reuse effective ignore coverage or add the narrow
   `/.agent-workflow/` rule to Git's local exclude file. Resolve its location
   through Git, including linked worktrees; do not assume `.git` is a directory.
   Preserve existing entries, make repeat adoption a no-op, and verify actual
   exclusion. This local Git metadata edit is the sole setup write outside
   `.agent-workflow/`; it creates no tracked integration change. If content is
   already tracked or exclusion cannot be established, explain the conflict
   without untracking files or changing shared ignore rules.
3. **Resolve.** Fill available facts from their sources and use documented
   defaults where applicable. Ask only for unresolved decisions or inaccessible
   facts needed by the next dependent work. Do not re-ask settled preferences
   or treat missing guidance as proof that no obligation exists.
4. **Write or refresh.** Maintain the local binding without overwriting
   unrelated local files or silently replacing operator choices. The agent
   performing binding owns this local artifact; in an active run that is the
   PC. This limited write does not grant candidate-editing authority or change
   the RP's sole ownership of implementation.
5. **Report completion.** Return the binding path, source-check result, material
   changes and any unresolved dependency. State whether it is ready for the
   intended next work. Writing a file alone does not establish readiness.

Routine discovery and factual refresh proceed as part of requested adoption
or workflow use. Changing a personal policy requires an operator decision;
existing authorization remains usable without an extra approval ceremony.

## Refresh and worker consistency

Refresh on use rather than installing a background scheduler. Perform broad
discovery on a new run and on explicit refresh. On resume and before a dependent
wave, check source identity and unresolved dependencies; rediscover affected
facts when guidance, quality selection, extensions, tooling, checkout context
or workflow contracts change. This cadence periodically re-establishes the
binding and finds newly added guidance, without requiring the operator to
remember a maintenance task.

The local binding is a maintained working view. Each dispatched task receives
a fixed binding snapshot with source identities and the applicable operator
guidance. The coordinator owns publication of these snapshots under existing
run records and passes absolute locations to workers in other worktrees.
Retain the snapshot a wave used alongside its evidence.

Tracked project guidance and quality obligations for review are read from the
candidate under review, not from the coordinator's mutable working tree. Local
preferences come from the supplied snapshot. Update reviewer and adjudicator
instructions that currently assume the binding itself is in the candidate.
The local artifact conveys sources and choices; it cannot override higher
authority or turn an inferred command into a project requirement.

All reviewers and adjudicators for a wave use the same candidate, binding
snapshot and obligation allocation. An unchanged candidate does not make old
coverage current when governing obligations change. Record the change and
reassess affected proof and coverage before relying on it. A refresh never
silently changes a running worker's contract; material conflicts affecting
active work return to the coordinator for an explicit transition or stop.
This does not delay a new operator instruction or ignore a discovered error.

## Coexistence and existing adoptions

Binding discovers existing maintained binding pages as sources where relevant;
it does not require moving, deleting or rewriting them. Shared guidance keeps
its existing authority. A conflict with the requested personal workflow is
reported for resolution rather than hidden by a local override.

Remove the requirement to retire other developers' or repository skills.
Workers load this package's intended skill from its resolved source. Preserve
the installer's protection of foreign files and links. If a naming collision
prevents reliable invocation, resolve it in the operator's personal setup or
report that specific blocker; do not guess engine precedence or change team
configuration. Neither adoption nor review demands that coworkers use these
skills.

Preserve existing local configuration, run records and historical snapshots.
A new clone establishes its own binding; a worker in another worktree uses the
coordinator-supplied snapshot rather than assuming local files were copied.
Removing local adoption requires no tracked repository rollback. Removing a
binding does not authorize deleting retained run evidence or shared quality
configuration.

## Phase 1: complete local adoption and binding lifecycle

Deliver this as one coherent phase: bootstrap, refresh and worker consumption
must work together before the old adoption requirements are removed. The phase
changes this package; it does not migrate unrelated repositories or their
personal skill installations.

Implementation work:

1. Replace the binding contract and add the focused skill and a compact binding
   template. Define source ownership, readiness, defaults, refresh triggers and
   snapshot lifetime once, linking to those definitions from consumers.
2. Add only the portable Node helpers needed for deterministic local setup and
   source checks. Keep binding judgment in the skill. Preserve existing config
   semantics, avoid a new general schema or service, and keep dependencies in
   the workflow source rather than target repositories.
3. Integrate bootstrap and refresh into coordinator initialization in the right
   order: establish safe local storage before writing a ledger or other record.
   Update process, Orca tasks, review and adjudication guidance, record layout
   and affected templates so every role consumes the correct binding snapshot
   and candidate sources. Preserve the single writer, independent review,
   proof requirements, canonical severity, operator gates and landing rules.
4. Register the binding skill in installation and validation, including the
   installer's currently fixed skill list and related count assumptions. It is
   an installed entry point, not another review seat or worker-profile role.
   Update README adoption, configuration and local-storage guidance; remove
   live instructions requiring tracked integration or retirement of team skills.
5. Verify the adoption and refresh outcomes below with disposable repositories
   and targeted tool tests. Exercise the skill on both supported engines,
   retaining actual runtime identities and results rather than claiming that
   Markdown validation proves agent behavior.

Acceptance:

| Scenario | Required outcome |
| --- | --- |
| Fresh repository with initialized quality-profiles and a local extension | Binding discovers both, cites their obligations and prepares the requested workflow without any tracked integration change. |
| Repository without a shared ignore rule | Local exclusion is established and verified; the tracked tree, index and existing exclude entries remain unchanged. Repeating setup creates no duplicate rule or needless binding rewrite. |
| Missing quality-profiles or a required source | The result identifies the dependency and affected work; no substitute quality policy or falsely ready binding is produced. |
| Existing project guidance and personal quality additions | Sources and scope stay distinct. Repository requirements remain authoritative, and personal choices are preserved across refreshes. |
| Guidance, verification or quality extension changes, including uncommitted changes | A later use detects the change, refreshes affected facts and identifies affected evidence or coverage. Newly added guidance is found by broad discovery. |
| Resume or refresh while a wave exists | Running workers retain the recorded contract; material changes are surfaced and handled before affected results are relied upon. |
| Review candidate differs from the coordinator checkout | Review obligations come from the candidate; local preferences come from the pinned snapshot. All review seats and both adjudicators use the same inputs. |
| Linked worktree or new clone | Git metadata and checkout identity resolve correctly. Workers receive accessible absolute snapshot paths; a new clone does not assume local binding state exists. |
| Existing tracked binding, unrelated skills or foreign install destinations | Existing material remains intact. Adoption adds no procedural requirement for coworkers and does not rely on ambiguous skill discovery. |
| Tracked `.agent-workflow/` content or unavailable local storage | Setup reports a concrete blocker without untracking, overwriting unrelated content or editing shared guidance. |

Run `node tools/validate.mjs`, package/link checks through
`node tools/install.mjs check`, and `node --test` after implementation, with
focused tests covering changed mechanics. Use temporary installation homes for
installation mutations. Report which engines and native hosts actually ran;
simulated path tests do not establish native Windows or Linux verification.
This plan adds no benchmark framework or claim of comparative performance.

Completion means a developer can adopt and refresh the workflow locally, run
its existing supervised process against repository quality-profiles and
extensions, and leave colleagues' tracked guidance and practices untouched.
Review and landing of the implementation follow the existing authorized
process; creating this plan does not release that implementation.
