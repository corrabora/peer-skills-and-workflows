# Plan: planning and iteration workflows

Status: revised design. This plan specifies workflow changes; it does not
implement them or release their implementation. Refine each implementation
phase below before handing it to the iteration workflow.

## Objective and boundaries

Build a **planning workflow** that develops an objective into a reviewed overview
and a next phase ready for implementation. Rename the existing plan-coordinator
(PC) workflow to **iteration workflow**. Planning establishes objectives, scope,
architecture and acceptance; iteration owns implementation, correction,
verification, review and landing.

The coordinator is modal. In planning mode, it is the operator's direct planning
partner and sole writer: it investigates, reasons, drafts and revises while the
operator reads and reacts. In iteration mode, it coordinates fresh responsible
parties, reviewers and adjudicators through the existing cycle and operator gates.
Preserve the natural planning conversation throughout objectives, scope,
architecture and phase refinement.

The planning workflow owns our common planning practice. Consolidate the reusable
guidance from our repositories' `PLAN-GUIDANCE.md` files into its intrinsic
method: inspect, ask consequential questions, author, review, adjudicate and
refine. Apply that method wherever the workflow runs, including repositories
without a planning guide. A plan is useful when work needs sequencing; ordinary
small changes need no new plan format or ceremony.

Settle the architectural choices needed to make the next phase coherent.
Investigate uncertainty that prevents starting. Leave reversible implementation
choices to the work that can test them. Requirements, design and sequencing can
evolve together without requiring every future phase to be specified upfront.

Reuse the existing [local binding](../../../workflow/BINDING.md),
[Orca integration](../../../workflow/ORCA.md) and shared workflow contracts.
Binding is implemented; planning adds no second adoption system, orchestration
service, quality catalog or requirement that other contributors use this workflow.
Research informs authoring techniques; it does not impose an architecture-timing
policy or a mandatory risk-management process on a project.

### Whole-plan acceptance

- The common method produces a reviewed overview and a next phase with explicit
  readiness. Iteration consumes it and assesses phase and whole-plan completion
  separately.
- The renamed roles support creation, review, bounded revision and resumption
  with one writer and preserved operator authority, including the recovery
  transitions refined in phase 2.
- Planning is a direct conversation with the coordinator as sole writer. An
  on-demand peer review can refine the draft; formal planning review starts only
  when the operator releases the plan for it.
- Both workflows resolve reviewer membership from configuration, preserve quality
  coverage and independent adjudication, and impose no engine or model diversity
  requirement.
- Coordinators initiate their own succession at configured compaction or turn
  thresholds, preserving the Run, decisions and work in progress across fresh
  contexts through the existing handoff practice.
- Meaningful tests and required gates prove deliveries. Phases land coherent
  green commits, execution evidence stays outside Git, and code stands apart
  from plan identities.

## One common planning method

Add a new `PLANNING.md` contract under `workflow/` to own the shared method and
distribute it with the skills. It owns the plan and phase contract, planning
stages, readiness and completion rules, and the relationship between planning,
implementation and verification specified below. Both workflows load it at the
points where they create, review, execute or revise plans. Role skills assign
responsibility and load the relevant guidance; they do not maintain copies of
the method. Improvements to common practice belong at this shared owner.

Repository guidance supplies project facts and constraints: domain contracts,
architectural boundaries, compatibility requirements, document locations and
verification recipes. Initialized quality profiles and local refinements remain
binding. These determine what a particular plan must satisfy within the common
method. A local `PLAN-GUIDANCE.md`, where useful, becomes a concise supplement
that references the shared method and states only project-specific guidance.
Neither its absence nor its filename selects a different planning process.

Normalize existing guides by reconciling their reusable rules into the shared
method, then replacing duplicated procedure with a reference. Use the current
practice captured in this plan to resolve older differences; do not accumulate
every historical variant as an option. Preserve project constraints and quality
obligations. A contradictory legacy rule needs an explicit amendment through its
owner, not silent precedence or a repository-specific fork. Identify any
unresolved conflict before declaring affected work ready. A legacy rule conflicts
when following the shared method would break it; a local detail the method leaves
open is not a conflict. Migrating a guide under its own task authority is not
blocked by the conflict that migration removes.

Update the planning authority described in `PROCESS.md` and `BINDING.md` as part
of implementation: the shared method is intrinsic workflow behavior, not a
fallback used only where repository guidance is silent. Binding discovers and
records project constraints and conflicts; it does not choose a planning method
or rewrite tracked guidance. Guidance migration is maintained work under its
own task authority, separate from establishing the local binding.
This plan delivers the shared method and migration procedure in this repository.
Updating another repository's guide is a separate task under that repository's
authority.

## The plan and phase contract

Use the same overview and phase contract across repositories. Keep existing file
locations where they support it: in this repository, `PLAN.md` is the overview
inside a numbered directory under `docs/plans/`; add phase documents there as
needed. A repository using a `00` overview and numbered phase files keeps that
layout. Future outcomes can remain in the overview until refinement is useful;
do not create empty phase files to complete a template.

The **overview** explains the objective and why it matters, scope and exclusions,
governing constraints, architectural responsibilities and boundaries, whole-plan
acceptance outcomes, and a provisional phase map with real dependencies. It owns
the overall direction and rationale. It does not duplicate phase mechanics.

The **next phase** states its objective, what it will demonstrate, dependencies,
behavioral contract, acceptance scenarios, verification intent and factual exit
criteria. Specify inputs, outputs, failures, limits and invariants where relevant.
Resolve exact interfaces or algorithms when other work or a promised property
depends on them. Private helpers, exhaustive file lists and exact test names need
not be invented before implementation.

Keep material questions beside the work they affect, stating what must be
resolved before starting or landing and who can resolve it. Use a separate linked
register only when the volume or relationships make one useful. A future choice
is not a current defect unless the next phase depends on it. Each phase supplies
its own correctness; a later phase cannot finish a cutover or repair missing
behavior that an earlier phase claims to deliver.

Validate existing surfaces and references against current source. Plans propose
changes; maintained contracts own current behavior and must change with the
implementation that changes it. Correct drift in affected behavior, callers and
documents, while keeping unrelated debt outside the phase. Reuse established
vocabulary and owners; record durable decisions and rationale at their maintained
owner. Plans reference those contracts without duplicating their authority.

### Ready to play and complete

Readiness is about sufficient direction to start; completion is about delivered
outcomes. Record them separately for the plan and each phase.

| Work item | Ready to play | Complete |
| --- | --- | --- |
| Plan | Objectives, scope, architectural direction, acceptance outcomes and sequencing are coherent and reviewed; at least the next phase is ready. Later phases may remain provisional. | The agreed overall outcomes are delivered and the accumulated changes, including interactions between phases, satisfy the applicable acceptance and quality obligations. |
| Phase | The outcome, boundaries, satisfied prerequisites and acceptance scenarios support a coherent increment. No unresolved consequential decision prevents starting. The particular revision satisfies the planning review gate below. | The changed behavior is proven by passing tests and applicable checks, required review is satisfied, and code, tests, maintained contracts and truthful delivery facts have landed together. |

Planning readiness requires the [two clean rotation rounds](#rotation-rounds)
on the revision offered for handoff. Both rounds receive independent readiness
adjudication; findings and readiness objections must be resolved under operator
dispositions, and the operator's acceptance must be recorded.

Finishing a planning assignment produces a ready plan or an explicit account of
what remains unresolved; it does not complete the planned product. Readiness
also does not supply execution authority. The iteration coordinator checks both
before dispatch.

Track phase progress as scoped, ready, in progress or delivered, with readiness
and delivery reasons visible. An overview may contain phases at different
states. A prepared completion entry is not delivery until its commit lands.

### Tests, lints and green commits

**All checked-in code is green, all the time.** Red–green development happens
within a phase. A phase lands one coherent, independently working green commit,
including its tests, affected documentation and delivery facts. Corrections remain
inside that phase; no failing checkpoint or promised future repair enters the
phase's delivered history.

Requirements and acceptance criteria become meaningful tests. During planning,
state the behavioral claims and representative success, failure and boundary
scenarios. During implementation, develop them into tests that distinguish the
intended behavior from plausible defects. Plans may map criteria to those tests;
passing tests are the live evidence that the behavior continues to hold.

Use the target's existing lints and verification gates for rules they enforce,
including naming, structure and reference rules. Reviewers inspect whether the
tests actually prove the changed behavior and whether all applicable quality
obligations are satisfied. A green unrelated check cannot discharge a missing
acceptance test or required integration proof. Missing or failed required checks
keep the phase incomplete.

Commit the tests, fixtures, lints and maintained contracts. **Do not commit phase
execution evidence:** captures, logs, run counts, source/candidate manifests,
review reports, transcripts and pass receipts stay in the ignored local workflow
records or designated external run directories under
[RECORDS.md](../../../workflow/RECORDS.md). Do not copy their results into plans,
ADRs or delivery logs. Delivery records identify what landed; tests keep checking
its behavior. A durable decision explains its rationale without relying on a
phase's execution record.

Plans may reference code; production and test code do not reference particular
plans or phases in names, comments or code-level documentation. Code names and
comments express purpose, role, behavior and rationale so they remain meaningful
without the surrounding planning documents. Plan renumbering must not require
code edits.

Whole-plan completion assesses overall acceptance and cross-phase interactions
using the live tests, applicable lints and quality review. Reuse still-valid local
verification where the target permits and fill actual gaps. This need not be a
separate final implementation phase or a blanket rerun of every suite. It cannot
supply correctness missing from an earlier phase's own delivery claim.

## Planning stages

The coordinator conducts stages 1–3 with the operator in planning mode, using
the configured high reasoning effort. It investigates and updates the plan as
the conversation develops, leaving the operator room to read, review and react.
These stages delineate the questions being settled; they do not require separate
authors, dispatches or approval ceremonies. The operator may request
[peer review](#on-demand-peer-review) at any point during refinement.

### 1. Establish objectives and scope

Inspect the repository, applicable guidance, accepted decisions and current
implementation before asking the operator for facts. Apply the common method
with the project's constraints, identifying any legacy procedural conflict under
the reconciliation rule above. Identify the desired outcome, exclusions,
constraints and observable success. Distinguish existing behavior, accepted
intent and proposed changes.

Ask consequential questions whose prerequisites are already settled. Group
independent questions when useful; investigate discoverable facts and continue
independent work while dependent answers are pending. Carry settled answers
forward. End this stage when the coordinator can explain the objective and
acceptance outcomes without guessing at consequential operator choices.

### 2. Develop the overview and architecture

Explain the approach, ownership, important boundaries and interactions, and how
it fits the existing system. Map coherent, independently verifiable increments
and their dependencies. Use focused research or a disposable experiment when
feasibility needs evidence; a useful negative result may change the proposed
approach or leave a named question unresolved.

End this stage when the overall direction and sequence are coherent. Revisit
objectives or scope when a design exposes a real conflict. Do not manufacture
speculative infrastructure or require all future implementation choices to close.

### 3. Refine the next phase

Develop the next useful increment under the plan and phase contract above.
Check references against current source and identify proposed additions. Make
its acceptance scenarios specific enough to guide implementation and review.
Separate decisions required to start from choices the implementer can make
within the contract.

Apply a fresh-reader test: what consequential decision would a responsible
party still have to guess before beginning? Answer from existing sources first;
bring genuine choices to the operator. End this stage with a candidate whose
phase can be assessed for readiness.

### 4. Review readiness and hand off

Begin only on an explicit operator release for formal planning review. Record
the release's scope and candidate revision; a request to draft, refine or conduct
peer review does not supply it. Until then, remain in the planning conversation,
even when the coordinator judges the draft ready for review.
A release may cover specified corrections and subsequent review waves; carry
that authority forward to its stated stop boundary.

Freeze the released candidate and its governing inputs. Run the planning review
below, resolve findings and revise as authorized. The report identifies the exact
revision, coverage, readiness conclusion, remaining questions and the next
permitted action. A changed candidate receives renewed planning review before
claiming readiness. Stop when the requested readiness is established, or explain
the specific decision or investigation needed to progress.

These are stages of planning, not four mandatory review rounds. Questions and
drafting passes do not each launch a formal round. Planning can revisit an
earlier stage when new information changes its result.

## Roles, skills and review

Use the workflow names consistently in skills, role names and documentation.
The intended skill entry points are:

| Workflow | Coordinator entry point | Candidate writer | Direct review worker |
| --- | --- | --- | --- |
| Planning workflow | `planning-coordinator` | The coordinator | `planning-reviewer` |
| Iteration workflow | `iteration-coordinator` | `iteration-responsible-party` | `iteration-reviewer` |

The two coordinator entry points select modes of one active coordinator. Add
`planning-coordinator` and `planning-reviewer`, and use `peer-review` on demand.
There is no separate planning-author role or dispatch. The iteration skills
replace `plan-coordinator`, `plan-responsible-party` and `plan-reviewer`,
respectively; these are proposed names, not currently installed entry points.
Reuse `review-adjudicator` across
both workflows with an explicit planning mode. The planning coordinator handles
creation, review, revision and resumption. Shared planning guidance owns
interviewing and refinement; separate roles for objectives, scope and
architecture are unnecessary.

Keep one active coordinator per Run, with successive bounded contexts. Planning
and iteration share the Run, record root and operator-guidance ledger; record
the current mode explicitly. The active coordinator loads the appropriate
workflow skill when work changes between planning and iteration. A coordinator
context is replaceable without restarting the work or its review history.

| Role | Responsibility |
| --- | --- |
| Operator | Owns intent, consequential scope and architecture decisions, dispositions and execution authority. |
| Coordinator in planning mode | Owns the planning conversation, investigation, candidate writing, authorized maintained artifacts, dispatch, frozen inputs, records and readiness reporting; does not approve its own candidate. |
| Coordinator in iteration mode | Owns worker cycles, configuration, records, reports and operator gates; delegates candidate writing to the responsible party. |
| Iteration responsible party | Sole writer of the authorized implementation or correction candidate, its tests and maintained documents. |
| On-demand review peer | Read-only equal to the coordinator in assessing a frozen planning draft and discussing findings; has no operator authority. |
| Configured direct reviewers | Independently assess the same candidate against allocated quality clauses and planning readiness; report findings without edits or delegation. |
| Two peer adjudicators | Independently assess findings, coverage and readiness, then reconcile while preserving dissent; recommend without operator authority. |
| Investigator | Answers one bounded question through inspection, research or isolated probes; reports without editing the candidate. |

The planning coordinator writes within the operator's plan creation or revision
request and its stop boundary. It applies conversational direction within that
scope without a separate author dispatch or repeated writing release. Read-only
assignments remain read-only. The coordinator loads the writing skills for its
own plan edits and records consequential operator decisions as they arrive.

In iteration mode, continue the responsible-party, review, adjudication and
disposition cycle within recorded execution authority until the work is complete,
the operator stops it, or a gate or blocker requires a response. Preserve the
post-adjudication gate and the clean-review gate, including their existing scoped
batch-authorization rules. Mode selection alone does not release implementation
or landing. Formal planning review uses those same disposition boundaries;
authorized corrections are written by the coordinator between frozen waves.

Before changing writing ownership between modes, settle or suspend the current
writer and record the next owner. No coordinator edit overlaps an active RP's
writing assignment. A frozen formal review must finish or be explicitly withdrawn
before conversational edits resume; preserve its actual coverage and pending
decisions. A mode switch carries existing decisions and authority forward and
does not reset review progress or coordinator succession counts.

Use fresh workers and configured role and reviewer identities, with explicit
workflow, role, inputs, output and authority in each task. Only the coordinator
dispatches investigators. No candidate edits occur during formal review or
adjudication. Invoke writing, clarification, glossary and decision skills at their points of use under
[RECORDS' writing procedure](../../../workflow/RECORDS.md#writing) and
[PROCESS' planning guidance](../../../workflow/PROCESS.md#planning-and-phases).

### On-demand peer review

Use the general [peer-review skill](../../../skills/peer-review/SKILL.md) when
requested during planning. It owns companion selection, independent assessment,
equal-peer debate, the three-round limit, agreed corrections and escalation.
The skill applies to any work and is maintained independently of this plan's
workflow implementation. Its default companion uses the opposite engine at equal
or equivalent reasoning effort; explicit operator choices take precedence.

In planning mode the coordinator is the host and sole writer, so it applies
agreed changes within its existing planning authority. The companion remains
read-only. Objective, scope and architecture changes still need operator
disposition. Return to the planning conversation afterward; peer review is
optional and supplies neither formal rotation credit nor the operator's release
for formal planning review.

### Coordinator succession

Both workflows use these defaults in `defaults.yaml`:

```yaml
coordinator-succession:
  observed_compaction_threshold: 3
  agent_turns: 40
```

These limits apply only to the active coordinator. Other roles keep their fresh
worker contexts for each round or assignment; their turns and compactions do not
contribute to the coordinator's counts.

Resolve these positive integer thresholds through the existing configuration
layers, with later layers replacing individual values. An operator instruction
can change either value for the current run; record and apply it without resetting
counts. Include the effective values and their sources in the resolver output
and local state. Reject invalid values rather than silently applying defaults.

The thresholds measure different signals: observed compactions indicate context
rewriting, while turns bound the accumulated coordination history. Count each
observed completed compaction once for the current coordinator session. Count
each coordinator turn once when it starts, including turns started by orchestration messages;
tool calls and messages that merely steer an active turn do not add turns.
Use available session events and local turn records, not estimates from summary
size or remembered exchanges. Persist both counts and the session identity in
ignored local run state, so compaction and resumption cannot erase them. A resume
or workflow switch retains the counts; only a fresh coordinator session starts
new counts. When earlier observations are unavailable, identify a count as a
known lower bound and continue counting observed events without inventing history.

Succession is due when **either** count reaches its threshold. Check after an
observed compaction, at turn end and before dispatch; also check immediately
after a threshold override. Report counts against their thresholds and initiate
the existing [successor handoff](../../../workflow/templates/handoff.md) without
waiting for the operator to request it. This policy supplies standing authority
for coordinator succession; it adds no authority to revise, approve or land work.
Update the coordinator skills and handoff template's current operator-request-only
rule together when implementing this policy.

At the next safe coordination checkpoint, preserve the current state and prepare
the handoff, then launch a fresh successor with the effective coordinator launch
settings. The successor loads the handoff and governing skills, reconciles the
records with Orca and Git, binds the existing Run and confirms ownership. Only
then retire the predecessor. Preserve the current mode and writing authority,
decisions, pending questions, formal review and peer discussion positions,
coverage, worker identities, inbox position and cleanup obligations. Carry
the effective configuration forward and retain the predecessor's final counts.
Do not start a new work batch while succession is due. Live workers may continue
under their existing tasks and transfer with the Run; succession need not wait
for a phase or review round to finish. If transfer cannot be confirmed, retain
the handoff, report the observed owner and blocker, and keep new dispatch paused.

Use the existing Orca ownership-transfer and handoff mechanisms. Implementation
must establish how each supported engine supplies observable compaction and turn
boundaries; this plan does not assume that either model receives built-in lifetime
counters. Keep counter records and handoff evidence outside Git.

### Reviewer configuration and quality allocation

Both workflows take reviewer count and composition from the current run's
resolved configuration. Keep these concepts separate:

| Concept | Meaning |
| --- | --- |
| Reviewer profile | A reusable worker profile specifying engine, model and effort. It defines how a reviewer runs, not which qualities it reviews. |
| Reviewer set | A configured group of reviewer positions, each referring to a profile. It groups positions for configuration and records without adding an allocation boundary. |
| Reviewer seat | The identity assigned to one configured position for dispatch, records and rotation. Seat labels enumerate the resolved reviewers; they do not determine their number. |
| Quality set | A partition of the governing quality clauses, allocated to reviewer positions for a particular round and rotated between rounds. |

One or more nonempty reviewer sets form the roster; their membership determines
the number of independent workers. The default roster has two Claude reviewers
and two Codex reviewers, arranged as two reviewer sets. Sets need not correspond
to engines, and repeated use of a profile still creates distinct reviewer
positions and independent workers. These are equally valid compositions, with
effort supplied by each profile:

| Composition | Reviewer set 1 | Reviewer set 2 |
| --- | --- | --- |
| Default | Claude, Claude | Codex, Codex |
| One engine, several models | Claude Opus, Claude Fable | Claude Opus, Claude Sonnet |
| Two reviewers | Codex Sol | Claude Opus |

Profiles fully determine engine, model and effort for reviewers and the two
adjudicators. Neither workflow imposes engine or model diversity, and there is
no requirement to vary effort. Every reviewer and both adjudicators may use the
same profile. Independence comes from separate workers, separate assessments
and the peer barrier.

Extend the existing configuration layers to resolve reviewer-set membership
separately from the profile catalog. A `reviewer-sets` section in a
higher-precedence layer replaces the complete lower-layer roster; profile and
role layering keep their existing behavior. Resolve and record the effective
roster before dispatch, then assign a seat to each position. For new waves,
enumerate sets in configuration order and positions in list order. If the
existing `R1` naming scheme is retained, derive `R1` through `Rn` from the resolved
reviewer count. `R1`–`R4` describes the default roster, not a required or maximum
seat list. Invalid or empty membership and unresolved profiles cannot silently
fall back to defaults. Freeze reviewer configuration for a wave; apply authorized
reviewer changes to later waves and preserve each completed review's actual
configuration and candidate identity.

Upgrade `defaults.yaml` to retain the reusable `profiles` catalog and role
assignments while replacing the fixed `review-seats` map with reviewer-set
membership. Keep optional peer-review launch choices separate from the formal
roster and honor the peer-review skill's defaults and operator overrides. The
adjudicator and investigator assignments serve both workflows. The proposed default membership is:

```yaml
reviewer-sets:
  first: [fable-high, fable-high]
  second: [astra-high, astra-high]
```

These names reference the existing profiles; set names carry no engine or model
constraint. Update `tools/lib/config.mjs`, the resolver CLI and configuration
documentation together. Remove fixed-seat validation and make overrides resolve
against the configured membership. Handle existing `review-seats` configuration
through an explicit migration that preserves each configured profile assignment.
Existing run records retain their original seat identities and meaning.

Retain the four quality sets A–D independently of reviewer count. The run's
governing clauses determine their contents; changing the roster alone does not
repartition them. Allocate each governing clause to exactly one quality set,
preserving its identity and source. Keep that partition independent of reviewer
profiles and stable across rotation unless the governing obligations change.
Distribute all quality sets across the configured reviewer positions in every
round. A reviewer may receive several quality sets; extra reviewers may
independently review the same quality set. Neither case changes which set owns a clause. Derive a
rotation schedule from the actual roster and quality sets so assignments move
among positions, including across reviewer-set boundaries. Do not equate a
reviewer set with an engine or require one quality set per reviewer.

### Rotation rounds

Both workflows require **two clean rotation rounds**, regardless of reviewer
count or the number of distinct profiles. Every round uses the full configured
roster and covers all quality sets. With the default two-engine roster, exchange
assignments so each engine reviews every quality set across the two rounds.
For other rosters, rotate assignments among configured positions within the same
two-round requirement; every position need not review every quality set.

A review wave is one attempt at the current rotation round. Count the round only
when every configured reviewer has reported and the wave is clean under
[REVIEW.md](../../../workflow/REVIEW.md#rounds). Corrections and re-review repeat
the current rotation round; they do not advance it. Advance after a clean round
within operator authority. A clean second round completes the required rotation.

Record coverage by candidate, quality set, reviewer set, position and resolved
profile. Both clean rounds must cover the candidate offered for readiness or
landing. Corrections and configuration changes must not credit a new candidate
or profile with coverage it has not received. Revisit affected earlier coverage
under the existing rules for candidate coverage, retaining its rotation-round number.

### Review and adjudication

Every formal planning round uses the configured reviewers and two adjudicators,
including rounds with no reviewer findings. In both workflows, adjudication
receives the complete wave's reports from every configured reviewer position;
the expected inputs follow the roster, not a fixed count. Each peer freezes its
independent assessment before seeing the other's. Their readiness assessment
includes the fresh-reader test; it requires no additional reviewer or fabricated
finding.

The shared planning method supplies the workflow's output contract; the target's
initialized quality profiles and extensions supply quality obligations. Assess
each allocated clause's applicability before compliance. Review objectives,
scope, architecture, phase coherence and acceptance against that common contract
even when the target has no planning guide. This adds no competing quality
catalog. An overview is judged at overview depth; a ready phase is judged for
sufficient direction to start; a landing
candidate needs complete applicable proof. Future implementation proof is not
automatically a prerequisite for planning readiness.

Reuse [REVIEW.md](../../../workflow/REVIEW.md) for findings, severity, proof gaps
and coverage, and [ADJUDICATION.md](../../../workflow/ADJUDICATION.md) for peer
independence, reconciliation and dispositions. Preserve the existing discussion
limits and operator boundaries. Make planning's always-adjudicate branch
explicit and preserve iteration's clean-review path. Replace the fixed reviewer
count and full-rotation completion rule with the shared reviewer configuration
and the requirement for two clean rotation rounds above. Update both workflows'
dispatch, reports and completion checks together.

Honor existing scoped authorizations through their stop boundaries. Acceptance
of a plan is distinct from permission to implement it. If another round would
only repeat an unresolved question, report what would resolve it rather than
cycling or lowering the readiness standard.

## Handoff to iteration and implementation learning

The planning readiness report names the reviewed plan revision, phase, repository
baseline, readiness conclusion, dependencies, acceptance contract, unresolved
conditions and actual execution authority. Keep it in local run records, distinct from a
coordinator-successor handoff. Use existing local snapshots; maintained plans
carry their status and reasons and remain understandable without those records.

Before dispatch, the iteration coordinator checks that the phase is still ready
against current source, its prerequisites are satisfied and its authorization
covers the work. It then owns the existing implementation and review cycle. The
responsible party evolves phase details, tests and code together within the
agreed contract. The workflow must distinguish these ordinary implementation
choices from changes to accepted objectives, observable behavior, scope or
architectural constraints; implement that clarification in the shared process
before relying on it.

When a consequential change is needed, the iteration coordinator identifies the
affected work and brings the decision to the operator. For an authorized bounded
plan revision, switch to planning mode under the writing-ownership rule above and
suspend dependent implementation while its contract is being revised. Return the
revised candidate to formal planning review under the operator's review release
and reassess affected verification; keep unaffected work and delivered history
intact. A passing implementation does not justify weakening acceptance criteria
after the fact.

The responsible party includes the phase's delivery facts in its landing commit
under the target's existing convention. The iteration coordinator verifies the
landed commit and completion conditions, then identifies either the next phase
to refine or the whole-plan completion assessment. An unmet overall outcome
remains work even when all existing phase entries say delivered.

On resume, recover maintained intent and delivery from the repository and Git,
and current execution state from local records. Recheck readiness when source,
quality obligations or decisions change. Missing run evidence requires renewed
proof where needed, not invented history or a committed evidence archive.

## Implementation phases

### Phase 1: deliver planning through iteration completion

**Outcome:** in either supported engine, an operator can develop and review a
plan, hand a ready phase to the iteration workflow, and distinguish readiness
from phase and whole-plan completion. Creation, review-only and bounded revision
are supported; review-only work leaves the plan unchanged.

Implement the shared planning contract and concise formats for the overview,
phase and readiness report; consolidate the common `PLAN-GUIDANCE.md` practice
under its single owner. Update process and binding authority as described above, and provide a
guidance migration procedure that leaves local supplements focused on project
constraints. Add the planning coordinator and reviewer entry points and planning
adjudication mode; integrate the general peer-review skill. Implement modal
writing ownership, explicit release into formal planning review and the existing
operator gates across both workflows. Replace the current coordinator's blanket
prohibition on candidate edits with the mode-specific responsibilities above.
Reuse existing binding, Orca, worker profiles and local records. Implement
configurable reviewer sets, coordinator succession and the shared allocation and
rotation rules across the process, review, adjudication, Orca and records contracts,
`defaults.yaml`, the configuration resolver and their skill consumers. Migrate existing seat
assignments without changing the operator's selected profiles. Add the iteration
coordinator's entry readiness check and exit completion assessment, including the
boundary between ordinary implementation choices and consequential plan changes.
Rename the existing skills as specified above. Update installation, validation,
role routing, configuration references and maintained documentation together.
Preserve operator settings and run history through the migration, respecting
the installer's ownership rules for existing entries.

Use one real bounded objective in a disposable target to exercise the complete
path from interrogation and authoring through planning review, iteration and a
green phase commit. Turn the following behaviors into maintained test cases,
with assertions expressed in workflow terms rather than this plan's identity:

- The planning and iteration entry points install and route to their intended
  roles. Migration preserves operator settings and existing run history.
- In planning mode, the coordinator investigates and revises directly as the
  operator reacts, without a planning-author worker. It preserves settled
  decisions and invokes writing skills for its own edits. A draft judged ready
  and an agreed peer-review result both remain in conversation until the operator
  explicitly releases formal review.
- An on-demand peer review launches one read-only equal peer with the relevant
  operator background, exact draft and writing skills. Agreed changes within
  scope are applied and checked without another permission step; proposed
  objective, scope or architecture changes reach the operator even when agreed.
  Unresolved disagreement stops after three paired discussion rounds with both
  positions intact. A read-only invocation causes no edits, and peer review
  supplies no formal review credit or release.
- Iteration continues its delegated cycle within authority and stops at the
  existing gates. Mode changes transfer sole writing ownership without overlap;
  a frozen formal review cannot be silently edited. A successor preserves mode,
  writing authority, review release and pending decisions.
- In both workflows, either succession threshold independently triggers a fresh
  coordinator without another operator request. Exercise the defaults, layered
  overrides, an operator lowering a threshold below the current count and invalid
  values. Compactions and orchestration turns count independently; worker activity,
  tool calls, steering messages and replayed events do not inflate counts. Resume
  preserves counts, a fresh successor starts new counts, and unavailable history
  is marked as a lower bound.
- A successor takes ownership of the same Run before the predecessor retires,
  including during an active review. Live workers, pending operator decisions,
  effective settings, authorizations, round position and actual coverage survive
  the transfer without duplicate dispatch or writers. A failed takeover leaves
  the handoff recoverable and new dispatch paused; no completion is invented.
- Both workflows support the default roster and both alternative compositions
  above, including repeated profiles, different efforts and a roster with only
  two reviewers. Seat count follows membership, including configurations with
  more than four reviewers; overrides leave no unintended inherited reviewers.
  A run using one profile for every reviewer and both adjudicators remains valid and
  preserves independent assessments.
- Both workflows complete review rotation after two clean rotation rounds,
  including with four distinct profiles. Every round covers all quality sets;
  the default roster gives each engine every quality set across the two rounds.
  Correction waves repeat the current round instead of advancing it. Exercise
  fewer and more reviewers than quality sets, unbalanced rosters, changed
  membership or profiles, and candidate corrections without losing clauses or
  claiming unperformed coverage.
  Adjudication receives all configured reviewers' reports; a missing participant
  remains a gap regardless of how many other reports arrived.
- Repositories with no planning guide and those with project supplements use
  the same planning method, readiness rules and completion rules. Project
  constraints and quality obligations still govern the planned behavior.
- Guidance migration removes duplicated procedure while preserving project
  obligations. A contradictory legacy rule is surfaced for explicit amendment;
  binding alone changes no tracked guidance and cannot declare affected work
  ready while the conflict remains unresolved.
- Discoverable facts and settled decisions are reused; only consequential open
  choices reach the operator, in dependency order.
- An overview with a ready first phase and provisional later work can proceed;
  an ambiguous current contract or unmet prerequisite cannot.
- Clean planning reviews still receive two independent readiness assessments;
  disagreement, missing participants and required proof gaps remain visible.
- Routine implementation choices stay within the agreed contract; a changed
  objective or binding architectural constraint returns for a decision.
- Changed behavior gains acceptance tests, existing lints remain enforced, and
  a failed required check prevents landing. Red–green work stays uncommitted
  until the coherent green phase is ready.
- Phase results and review captures stay outside Git. Code and tests describe
  their purpose without plan identifiers or links; a plan may reference tests.
- Completed phases with an unmet overall acceptance outcome do not produce a
  whole-plan completion claim.

Select the [local skill clauses](../../qualities/README.md) and inherited
profiles for this implementation. Use deterministic tests for mechanical changes
and the [behavioral suite method](../../../tests/skills/README.md) for single-role
decisions from fixture inputs. Maintain repeatable supervised acceptance scenarios
for behavior that requires live Orca workers, including setup, actions and
assertions. Run those through the supervised exercise rather than the single-role
suite runner; this plan does not add a general multi-worker test runner. Settle
the scenario form during phase refinement.

Under [AW-SK-EV4](../../qualities/skill-evidence.md#aw-sk-ev4), exercise
the affected path and a relevant boundary on each affected supported engine.
Commit scenarios and checks; keep actual traces, results and identities in local
run evidence. Unavailable required execution remains unverified. Run
`node tools/verify.mjs` and the normal commit gate; a green offline suite alone
does not demonstrate the new orchestration behavior.

This phase is complete when those behaviors are demonstrated, the entry points
are usable on both engines, existing iteration behavior is preserved, and the
reviewed implementation lands green. It needs no later phase to make its handoff
or completion claims correct.

### Phase 2: strengthen revision and resumption from use

**Outcome:** the planning and iteration workflows can recover interrupted work
and exchange a bounded revision without losing decisions, duplicating writers or
repeating completed phases. Refine this phase from phase 1's use and the actual
remaining gaps.

Exercise implementation discovery followed by an authorized plan revision,
renewed readiness review and resumed execution. Cover unchanged-plan resume,
refused revisions, stale source or quality selection, interrupted workers and
missing local records. Reuse current recovery mechanisms and add only what the
observed gap requires. Preserve the iteration workflow's authority and review
boundaries and the one-green-commit phase rule.

This phase is complete when maintained tests and representative executions on
both engines demonstrate those transitions and recovery boundaries, required
checks pass, and the increment lands green. Assess the combined workflow against
the objective and whole-plan acceptance contract before declaring this plan
complete; retain execution evidence locally throughout.
