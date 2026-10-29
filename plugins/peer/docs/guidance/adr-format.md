# ADR format

An architecture decision record preserves the choice, context, rationale and
consequences needed to revisit a decision. Establish that information before
making the prose concise; there is no sentence or word cap. Use this format for
new records, with [adoption guidance](record-format-adoption.md) for existing
ones. Before offering a record, apply
[record-decision's offer test](../../skills/record-decision/SKILL.md#when-to-offer-an-adr).

## Form

```markdown
# ADR-0007: Audit acknowledgement before success

- Date: 2026-10-25 (first recorded in this ADR)
- Status: Accepted

## Context

Successful operations must have durable audit evidence. A background write
could lose that evidence after the caller receives success.

## Decision

Wait for the audit store's acknowledgement before reporting success because
missing evidence is unacceptable. Reject background writes despite their
lower response latency.

## Consequences

Responses incur the store's latency, and its availability limits successful
operations. An acknowledgement establishes storage, not downstream processing.
```

Use **Context**, **Decision** and **Consequences** as the three standard headings:

- Context states the problem, consequential constraints and decision drivers.
- Decision opens with the choice and its main reason, then gives its scope and
  material alternatives actually considered, with the reasons they lost.
- Consequences states benefits, accepted costs, risks, qualifications and durable
  obligations. Link follow-up work to its owner when useful rather than copying a plan.

Each section can be one sentence. Fill it from evidence, without inventing
alternatives or costs to complete a template. If necessary information is
unknown, keep its heading and state the specific gap; unrecorded consequences
are not evidence that there are none. For explicitly requested or
repository-required records only, omit a genuinely inapplicable section or
merge its remaining content under another heading. Compactness alone is not
a reason to remove structure. A separate Alternatives section is optional
when it improves comprehension; no quota of alternatives applies.

Preserve important assumptions and constraints, rejected alternatives, material
costs and the boundaries of the choice. Exact numbers, algorithms or identifiers
belong when they are the choice or make its guarantee intelligible. Remove
incidental API inventories, duplicate contract detail, investigation history
and generic recitals that untouched obligations still hold. Keep why an
alternative lost, not who argued for it. State material risks without narrating
who raised them; retain authority evidence and useful follow-up ownership.
State surviving constraints when omission could broaden an exception or amendment.

Plans own sequencing and acceptance criteria; specifications own current
behavior. Keep commands, implementation recipes and live delivery status at
their owners. Link durable sources when needed, but the decision and its reason
must stand without a conversation or disposable review record.

## Metadata and standing

Include `Date` and `Status` on every new record. Date identifies the decision’s
earliest dated durable record, such as minutes, an approval note or this ADR;
state which it is. If this ADR first records an older decision, label its new
recording date and keep the unknown decision date explicit. Label known
acceptance or amendment dates separately when useful. Preserve a historical
date's recorded meaning. An unknown historical date stays unknown,
not today's date or an inferred implementation date.

Status is one of:

- `Proposed`: under consideration, not accepted direction.
- `Accepted`: accepted direction, not evidence of implementation or delivery.
- `Rejected`: considered and intentionally not adopted.
- `Superseded`: wholly replaced by an accepted later decision.
- `Standing unknown`: available evidence does not establish acceptance or rejection.

Writing a record never accepts it. Do not infer acceptance from code, age or
an unmarked legacy body alone. Preserve standing established by documented
historical conventions (see adoption guidance); do not turn unknown standing
into a new proposal. The title names the choice without implying acceptance.
If implementation status matters, point to its maintained owner; any copied
status must be an identified historical snapshot, not an unscoped claim about
current behavior.

Add `Authority`, `Scope` and relationship fields when supported and needed to
interpret the decision. Follow repository requirements for approval evidence;
name no approver the sources do not establish. Missing required authority
remains unresolved. Omit inapplicable optional fields rather than filling them
with `None`. A record can preserve known standing while identifying a different
unknown, such as an unrecorded rationale or date.

## Revision and relationships

A substantive change to the choice, scope or accepted cost gets one new ADR,
even when it affects several earlier records. Correct wording in place when
meaning and standing are unchanged. A proposal can be refined before acceptance;
record its actual standing without presenting deliberation as accepted history.

In the new record, link `Amends` or `Supersedes` to the affected records and
state what changes and why. Until the new choice is accepted, label these as
proposed relationships and leave the old decision in force. On acceptance,
update the old records and index in the same change:

- A partially amended record stays `Accepted`, with
  `Amended by: ADR-NNNN (<affected part>)`. State what still governs where the
  scope would otherwise be unclear.
- A wholly replaced record becomes `Superseded`, with `Superseded by: ADR-NNNN`.

Link each referenced ID to its record.

Keep the old rationale readable. `Refines` / `Refined by` can identify a bounded
clarification when that distinction helps; it does not exempt a substantive
change from a new record or required acceptance. Future changes do not accumulate
as inline amendment decisions. Preserve legacy inline amendments until an
authorized migration accounts for them.

## Location, index and numbering

Create `docs/adr/` when needed. Use `NNNN-short-decision-slug.md`, starting at
`0001`, with `# ADR-NNNN: <choice>` as its title. Keep existing filenames through
wording edits. Select after the highest number across current and legacy
locations; never reuse an ID.

Maintain root `DECISION-LOG.md` as a linked index, with a short purpose and one
row per record: linked ID/title, date, status and relevant amendment or
supersession links. It holds navigation, not duplicated ADR bodies or the
writing template. Use the same Status values as the records, with relationship
links alongside them. Show partial amendments alongside standing, for example
`Accepted; amended by ADR-0014 (completion boundary)`. See adoption guidance
when that path already contains legacy records or another index exists.

Update the index when adding a record or changing its title, date, standing or
relationships. Before finishing, check file/row coverage, matching titles,
dates and standing, working links and the exact scope of accepted amendments.
Keep legacy records discoverable without inventing their metadata or silently
migrating them. Report a pre-existing gap in one sentence only when this edit
displays or depends on it.

Recheck available numbers immediately before writing. On a branch, compare
against the integration target's current records when readable and resolve
collisions by renumbering the new record and updating its references within
scope. Numbers remain provisional until the record lands on the integration
target, including uncommitted work on that target. Recheck at integration because
another branch may land first. If this task does not integrate, the receipt
says “Recheck provisional ADR-NNNN against <target> before integration.” Use the
actual number and known target; if unknown, say “Recheck provisional ADR-NNNN
before integration; the target is unknown.” Omit the number-selection story
unless requested. Unreadable targets remain unchecked. This grants no merge or
publication authority.
