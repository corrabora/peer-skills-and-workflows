# Record format adoption

Use the [ADR](adr-format.md) and [glossary](glossary-format.md) house formats.
Move existing records toward them in authorized, bounded work that
preserves meaning and standing. Installing a skill does not authorize migration.

## Ordinary recording

New ADRs use the house format and `docs/adr/`; number them after existing
records across old and new locations. Maintain root `DECISION-LOG.md` as the
index. If it already holds a legacy log, add links to the new files there
without replacing its bodies; conversion to an index-only page waits for
authorized migration. If another legacy log or index exists, retain it and
link between it and the root index so old and new records remain discoverable.
Preserve standing established by repository guidance or documented provenance
for a historical convention. For example, an unmarked record is Accepted when
that evidence establishes it used the earlier house format, which left Accepted
records unmarked. An unmarked body alone establishes no convention. Show legacy
standing or dates as unknown when evidence does not establish them.
Revise an existing record in place only as far as the task needs, including a
notice of an accepted replacement. A wording-only correction neither creates
an index nor reformats legacy records; check existing affected navigation and
report a gap only when the correction displays or depends on it.
Add terms to the existing glossary until it is migrated; avoid a second
vocabulary alongside it. Do not reformat neighboring records incidentally.
Mention a legacy record's format only when the task had to choose between
formats. A neighbor left untouched needs no mention.

Explicit repository or operator instructions govern the task. If they prescribe
a different format, use it and report the conflict with a concise proposed
reconciliation toward the house format. Apply that reconciliation when already
authorized; otherwise leave the controlling instruction intact. Existing style
alone is not a controlling instruction, and a format difference needs no new
approval when the task already authorizes resolving it.

## Requested migration

Identify the records, governing instructions and references in the authorized
batch. If its boundary is unclear, ask before converting the affected material.

- Preserve glossary terms and meanings when migrating a glossary. For ADRs,
  before rewriting, account for each record's choice, drivers and rationale,
  material alternatives, consequences, scope, standing, dates, authority and
  change relationships. Each consequential item remains in the record, moves
  to an identified durable owner with a usable pointer, or is shown redundant.
  Keep this accounting in review evidence, not as a checklist in every ADR.
  Apply the writing discipline after this preservation check; concise prose
  must not erase meaningful exceptions, unknowns or historical qualifications.
  Move still-needed detail only within scope; otherwise report it as pending.
- Keep existing decision numbers and a mapping for changed paths or anchors.
  Map legacy standing and accepted changes to the ADR format's explicit Status
  and linked relationships, including standing in navigation. A partially
  amended accepted record stays Accepted with the affected scope named;
  keep legacy inline amendments within their record by default, with their
  dates, authority and affected scope. Moving a shared log to files does not
  assign those amendments new IDs. Split an amendment into its own record only
  when the authorized migration scope calls for it.
  Unknown standing remains explicitly unknown; an ambiguous legacy status is
  not permission to invent acceptance. Report uncertainty that prevents a
  faithful conversion and continue with the clear records.
- Keep one authoritative copy. Move files where possible; update repository
  references and indexes. When splitting a shared log, leave a short navigation
  page at its old path with the old anchors pointing to the new records; when
  that path is `DECISION-LOG.md`, it becomes the root index. Keep
  an old-path pointer for an individual move when known outside links need it.
- Reconcile instructions and templates within authorized scope. Verify meanings,
  standings and links, then report the mapping, unfinished work and outside
  references that could not be checked. Describe known remaining format work
  without turning an ordinary edit into a repository-wide inventory.

Migration changes documentation; it does not accept decisions, change code or
migrate other repositories.
