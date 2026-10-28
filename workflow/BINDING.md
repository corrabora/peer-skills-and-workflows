# Local binding

The operator binds this workflow to a repository locally, in the ignored
`.peer-skills-and-workflows/` directory of their own checkout. Adoption changes nothing
tracked and asks nothing of other contributors: the repository's own guidance
and its quality-profiles, which it owns and shares, govern the work, and the
binding maps them for dispatch. This page is the one owner of the binding's
contents, defaults, readiness, local storage, refresh triggers and snapshots;
[PROCESS.md](PROCESS.md), [ORCA.md](ORCA.md), [REVIEW.md](REVIEW.md),
[ADJUDICATION.md](ADJUDICATION.md), [RECORDS.md](RECORDS.md) and the role
skills refer here. The `bind-agent-workflow` skill performs the procedure
([Procedure](#procedure)); `tools/bind.mjs` supplies its deterministic steps.

## Sources and authority

| Source | Owns | Authority |
| --- | --- | --- |
| Target repository, tracked | Root and scoped agent instructions, planning, contribution, verification and delivery guidance; the quality-profiles selection in `.quality/`, inherited profiles and repository extensions such as local rubrics | Project obligations: binding on every task here, read from the candidate under review |
| Operator's checkout, `.peer-skills-and-workflows/` | `binding.md` and `binding-sources.json`; `config.yaml` and `plans/<plan>.yaml` worker configuration; run records under `runs/`; a local plan where project guidance allows one | The operator's organization of their own use: never a project requirement, never authority over tracked guidance |
| Workflow package | Role behavior, review and adjudication contracts, this binding procedure, defaults and tools | Procedure and defaults where project guidance is silent |
| Current task and operator instructions | Objective, plan and phase, candidate, scope, decisions and execution release, in the run's [operator-guidance ledger](RECORDS.md#operator-guidance) | Run-specific authority; a reusable binding never releases future work |

Personal additions to quality objectives are allowed and visibly distinct
from repository requirements: the binding records their source and scope, the
PC allocates them beside the repository's clauses keeping that source, and a
finding names which it comes from. They add obligations to the operator's
authorized work; they neither weaken a project requirement nor become one for
other developers. Worker profiles remain execution settings, separate from
quality-profiles ([ORCA.md](ORCA.md#configuration)).

No adoption step adds root `AGENTS.md` or `CLAUDE.md` instructions, a
contribution policy, CI integration, a tracked binding page, a shared ignore
edit or the removal of repository or personal skills. Tracked quality
configuration and extensions change only through their own authorized
workflow. Project changes made to deliver a task are ordinary work, not
adoption.

## The binding file

`<checkout>/.peer-skills-and-workflows/binding.md`, from
[templates/binding.md](templates/binding.md), is a compact source map and a
record of resolved choices, not a second project handbook. It holds only what
dispatch needs:

- Repository and checkout identity (canonical path, Git directory, branch and
  HEAD at the last check, linked-worktree status), the workflow source used
  (path, commit or content digest) and when sources were last checked.
- The applicable project and planning guidance, the quality selection with its
  inherited profiles and repository extensions, and any existing review or
  delivery requirement, each as a path in the checkout with the obligation it
  establishes.
- Verification and evidence commands with their working directories, the
  proofs the obligations require and what makes evidence valid, each citing
  the source that establishes it.
- Candidate and landing conventions, output locations and explicit departures
  from the package defaults below.
- The operator's continuing preferences and additional quality objectives,
  with source and scope apart from discovered project facts, quoted exactly
  where wording matters so deleting a run never erases them.
- Unresolved decisions or inaccessible sources, each with the work it blocks.

Every statement is marked as an observed fact (with its source), an inferred
default (named as such) or an operator decision. Run-specific authorization
stays in that run's ledger, never in the binding.

`binding-sources.json`, written by `node tools/bind.mjs sources --out`, is
the manifest of recorded source identities. With `--compare` and `--out`
together, comparison results appear only in stdout, never in the saved manifest.
The manifest uses the format
`agent-workflow/binding-sources` at version 1. Its fields are `format` and
`version`; the checkout's canonical path, `head` and `branch` and the
`generated` time; the `workflowSource` identity; and `sources`, one entry per
recorded source under its normalized lookup path: the path the operator
named, relative to the checkout (`docs`, `./docs` and `docs/` are one entry),
or absolute for a personal file outside it, never a resolved link target, so
distinct aliases stay distinct and a source that is a link keeps its name and
is resolved afresh at every check. Readers accept those lexical spelling
variants on either side of a comparison, normalize them before matching and
grouping repository facts, and emit canonical lookup paths (no redundant `.`
segments or trailing `/`). Each entry carries its kind and Git state,
the working-tree blob or directory digest beside the index and HEAD blobs,
and for a link its own target and the location it resolves to, so an
uncommitted edit, a retargeted or broken alias and a missing source all
show; a branch name or timestamp alone identifies nothing. The working-tree
blob is the id of the file's raw bytes and is what comparisons use. The index
and HEAD blobs are what Git stores, after its built-in conversions such as
end-of-line normalization, so a file Git reports clean can have a working blob
that differs from them. A committed file's `modified` therefore compares the
content as Git would store it with HEAD: `true` for an uncommitted edit,
staged or not, `false` when the content matches HEAD, `null` when HEAD has no
such file. Raw bytes identical to the HEAD blob match it unless a
`working-tree-encoding` attribute applies, because Git would then re-encode
them before storing.
Where a `filter` attribute applies to the path, only its driver
could tell what Git would store, and the tool never runs one; where Git cannot
apply its conversions, there is nothing to compare. In both cases `modified`
is `unknown`, with a fixed `modifiedUnknown` reason, and the raw identity and
other facts are reported as usual. For a link, `modified` compares the link's
own stored target with HEAD. The location a
lookup resolves to is part of its compared identity: when an alias among its
ancestors is retargeted so the same lookup reaches another file, the source
is reported changed even when that file's bytes are identical, because its
provenance changed. A file beneath a directory alias inside the checkout is
classified by Git at the location its ancestors reach, under its own lookup
path; a lookup whose ancestors leave the checkout is identified by content
with state `external`. A directory inside the checkout is identified by the
working blob ids of its Git-visible regular files plus each link member’s
current target text and target type (`digestScope: git-visible`). Directory
and dangling links retain that identity without directory-link traversal;
a link to a regular file also includes its followed content. A directory
Git ignores and tracks nothing beneath, such as personal additions kept under
`.peer-skills-and-workflows/`, by the names and contents of its regular files
(`state: ignored`, `digestScope: all-files`, links inside it not followed),
so edits there are not hidden by the ignore rule. An alias that cannot be
resolved, a link loop for example, is that entry's `unreadable` result with
its error code; the other entries and facts are still reported. Readers
ignore additional fields, so the format may grow additively; a file without
this format marker, at another version, without that structure or with two
entries for one normalized lookup path (`docs` and `docs/` are one path;
`docs` beside its alias `guides` are two) is unusable: `inspect` and
`sources --compare` report it as `usable: false` with the file's path and
the reason, never as current and never as an ordinary source change, and
the binding is not ready until it is rebuilt. Rebuilding is a
refresh: `sources --out` rewrites only this factual record, and `binding.md`
with the operator's choices and every published snapshot stay as they are.

Persisted binding readers also require an evaluable `workflowSource` identity:
a complete SHA-256 digest, not a missing identity, an empty object or an
incomplete source result. They report its absence or invalidity with the
manifest path and a refresh instruction. Generic internal source-only manifest
construction and comparison may still omit this identity; that does not make
such a manifest usable as a persisted binding record.

The workflow source's identity is its commit and branch when it is a Git
checkout, Git-reported instruction-scope status paths in `dirty` (a rename
as its two paths), and a digest of the instruction parts
(`workflow/`, `skills/`, `tools/`, `defaults.yaml`, `README.md`,
`package.json`, `docs/writing-guidance.md`, `docs/guidance/adr-format.md`,
`docs/guidance/glossary-format.md` and `docs/guidance/record-format-adoption.md`,
the shared guide and record references the writing skills require; no other
`docs/` file is a part). Generated regular files under each writing skill’s
`references/` directory are included by `skills/`; their canonical owners remain
in the listed `docs/` scope. The package gate checks the generated bodies
against those owners after the registered relative-link rewrites. For a Git checkout the
digest covers the Git-visible files under those parts, tracked and
untracked but not ignored, so an incidental ignored file does not change it;
for a copied source it covers every regular
file under them. Entries are ordered by code unit, never by locale, so the
same content has the same identity on every host. Without child boundaries
or link members, a copy of exactly the visible regular files has the checkout's
identity; a plain copy does not preserve child Git membership or boundaries. Git-visible link members
retain their working target text/type and followed regular-file content,
without recursive directory-link traversal; child repositories follow the policy below.
Under content-access failure, `dirty` is unverified and potentially incomplete:
Git may report an unreadable path modified without establishing a content edit.
Inaccessible content, including members of a denied directory, is established
neither edited nor unchanged; empty or absent `dirty` does not prove clean.
Partial diagnostics and independently readable facts remain useful, but the
failed check cannot establish readiness.

The recorded workflow identity also identifies the code computing the source
identities. After it changes, reassess the comparison and refresh derived
facts before relying on currentness, preserving operator choices and published
snapshots. A `changed` entry beside `workflowSourceChanged: true` may reflect
recomputation rather than edited source text. A computation change alone needs
no manifest-version bump while representation and supported-reader semantics
remain compatible; incompatible formats still follow the refusal policy above.
Any future promise of comparison across different computation logic needs an
explicit comparison, migration or refusal rule and corresponding proof.

Git administrative entries named `.git`, whether directories or files, and
aliases resolving into them are excluded from content hashing, including
generic directory walks and workflow
source identities. An explicitly named administrative source is reported as
`excluded`, without a digest.

Git-visible directory and workflow identities include available nested Git
repositories and submodules. Each child supplies its own tracked plus
untracked/nonignored membership and actual working contents, recursively for
further children. Names, content and repository boundary kinds enter the
digest, not commits or Git administrative files; `files` counts identity
entries, including child-boundary markers. Direct child directories and
explicit files beneath children use the owning child's Git context. Ordinary
and followed-file neighbors retain their coverage; directory-link members
are not traversed. Explicit directory aliases retain the named-source behavior
above. Existing containment, ignored-directory/all-files and copied-source
policies are unchanged; this support does not expand those policies.

Each affected source may also carry `repositories`: child paths (relative to
the checkout or workflow source), `kind` (`nested` or `submodule`) and `head`.
At both source-entry and workflow-source locations, an omitted `repositories`
field is compatible; a present field must be an array (empty is valid) of
objects with string `path` and `kind`. Null, arrays as members and malformed
members make the manifest unusable before comparison. Additional fields are
allowed and preserved; validation never coerces values or inserts defaults.
Submodules additionally report the parent's `indexPin` and `headPin`, with
`indexPinMatchesChild` and `headPinMatchesChild` (null when no comparison is
available). Comparisons expose the current facts in `repositories` (with the
owning `source` path, or null for the workflow identity) and their before/after differences in
`repositoryChanges`. Repository differences compare the declared `source`,
`path`, `kind`, `head`, `indexPin`, `headPin`, `indexPinMatchesChild` and
`headPinMatchesChild` values; object key order and unknown additive fields
do not constitute a difference, and comparison does not strip or coerce input.
These facts remain separate from content `changed` and
`workflowSourceChanged`: staging, committing unchanged child content, or
changing only a parent pin does not masquerade as a child text edit. Readiness
measures available working content and never asserts parent-pin agreement;
report discrepancies separately and apply any project pin requirement to the
intended work. No query initializes, fetches, updates, stages or configures a
child repository.

An expected child with an absent/uninitialized checkout, a non-directory
occupant, an unmerged gitlink or an invalid Git working-tree boundary is
incomplete (`unsupported` or `unreadable`, naming the member and actual cause),
never trusted as missing or empty content. This also holds for explicit files
beneath unavailable submodules. True file deletion in an available child and
removal of an untracked nested repository remain genuine absence. Repair
availability or access, work from the child's own checkout where appropriate,
or obtain an operator support decision; none of these alone establishes
coverage or readiness of the parent. Required guidance stays blocked until
covered and successfully rechecked.

Only when unavailable or unsupported content is incidental, refresh may record
all required guidance paths outside it individually instead of the encompassing
directory. Preserve every known obligation, require a successful recheck and
assess discovered-guidance coverage before dependent progress. CHECK writes
nothing and can only recommend that refresh. New siblings matching discovery
patterns surface through `candidates`, not the narrowed recorded-source
comparison; arbitrary undiscovered names are not promised. Parent discovery
does not recursively enumerate child repositories: explicitly assess known
child guidance and record the paths the work needs. Content measurement does
not adopt instructions or import quality profiles from a child. The presence
of a supported child alone is no reason to refuse or narrow a binding.

Expected content-access failures produce an `unreadable` source entry with
the actual available cause and failing member where known, including in
`workflowSource` for both Git-visible and copied sources. The diagnostic
`error` is the available error code, otherwise the actual diagnostic text;
`message`, where emitted, describes the cause. Readable source entries and
independent inspect facts survive in partial JSON, but the command exits
nonzero and an incomplete comparison cannot be current, even if the same
error repeats. Unreadable content is never treated as deleted or assigned a
substitute digest. A failed check does not establish readiness: report its
partial facts and blocked work, resolve the cause, and require a successful
recheck before dependent progress; do not blindly retry. Unrelated failures
still refuse the command loudly. `complete: false` marks an incomplete source
manifest or comparison; comparisons list affected unreadable or unsupported
entries (including the workflow identity) in `unreadable`,
never in `unchanged`. A previously recorded incomplete identity also prevents a
successful comparison until a refresh records a complete source set.

`config.yaml` and `plans/<plan>.yaml` keep their worker-configuration purpose
([ORCA.md](ORCA.md#configuration)); `plans/` is not a place for plan
documents. Shared deliverables and durable decisions use the project's normal
locations and stand without the binding or any run record.

### Git capture capacity

The shared Git adapter sets `LC_ALL=C` for each spawned Git process so callers
can classify its diagnostic messages consistently, including the non-repository
case for copied workflow sources. It also sets `GIT_OPTIONAL_LOCKS=0`, so
status reads never refresh an index: an installed plugin's `.git` bytes are
part of the content Codex hook trust covers. It changes neither the caller's
environment nor persistent Git configuration; unrelated Git failures still fail
loudly.

Each Git call captures at most 16 MiB of output through the shared Git adapter.
If a call exceeds that bound, the command fails with an `ENOBUFS` diagnostic
and may produce no JSON; this is a failed check, never readiness evidence.
This can affect broad discovery in `inspect`, directory or workflow-source
enumeration, and other operations whose individual Git output exceeds the
bound. Named-source child lookups query relevant ancestors and selected
subtrees, but the per-call bound still applies. There is no fixed supported
file count: output size depends on path lengths and the particular Git query.

Retrying unchanged input does not remove the limit. Use a smaller supported
scope only where the command permits it, such as explicitly selected paths
for `sources`, and account for all guidance required by the intended work.
Do not drop required guidance to obtain a successful check. Recording fewer
paths does not necessarily reduce `inspect` output, because it still performs
broad discovery. If required coverage cannot be established within the bound,
report the affected operation and blocked work; resolve the capacity constraint
before rechecking and relying on that coverage.

### Extremely deep hand-added values

Additional fields in the manifest are permitted, and the reader accepts deeply
nested values in them. Command output cannot always include them: an extremely
deep value, for example one nested thousands of levels, added by hand to
recorded workflow or repository facts can exceed the capacity of JSON output.
A command whose output includes such a value then fails without JSON:
`inspect` reports the recorded workflow identity, and `inspect` and
`sources --compare` report a recorded repository fact in `repositoryChanges`
when its declared facts differ. This is a failed check, never a readiness
result. Recover by regenerating the manifest from current facts with
`sources --out`, listing the established source paths. The regenerated
manifest records only observed facts, so the hand-added values are not carried
over; the operator's choices in `binding.md` are unchanged.

The tool's own manifest writer does not produce such structures. This binding
workflow serves individuals maintaining their own local factual records, not
adversarial manifest input, so further hardening of output for intentionally
extreme nesting is deferred: the failure is loud, never reports readiness and
has a factual rebuild path. This known limitation adds no depth limit or
refusal for additional fields and promises no unlimited output capacity.

### Path names

Git stores a path name as bytes, while these tools represent paths as Unicode
text, so they support only names that are valid UTF-8. A name that Git lists
in an enumeration (discovery, a directory or workflow-source identity, or the
child gitlinks beneath them) and that is not valid UTF-8 is never decoded with
replacement characters or looked up under a substituted name, which could
miss the file or merge it with another name. It is reported instead with its
bytes escaped (printable ASCII as itself, `\` doubled, every other byte as
`\xHH`) and the fixed cause `path name is not valid UTF-8; such names are not
supported`. The escaped name is display text, never a host path: it is
reported relative to its repository with `/` separators and is never passed
through host path functions, which on Windows would read its `\` as a
separator. In discovery it is an enumeration error, so `discovery.complete` is
false; the error's `path` is the checkout, its `name` the escaped name
relative to it, and its `message` names it too. In a source or workflow
identity it makes the entry `unsupported`, with `member` the escaped name
relative to the checkout or workflow source, after the `/`-separated location
of the child repository that lists it, if any; the manifest and any comparison
are then incomplete and never current. Names that are valid UTF-8, including
ones that contain U+FFFD itself, are unaffected. Renaming the file to a UTF-8
name is the remedy; until then, treat the check as failed like any other
incomplete result. This rule covers those Git enumerations only, not other Git
output, command-line arguments or the direct filesystem walks of copied
sources and ignored all-files directories.

Because broad discovery covers the whole repository, a name that is not UTF-8
anywhere in it blocks readiness, even one that could never be guidance, such
as a test fixture. Renaming a tracked file is a project change that the
repository's owner authorizes separately; adoption never renames, untracks or
edits project files to clear the block. Until the rename is made, adoption
reports the blocked work and the name that blocks it, or the operator may
forgo adopting the repository, which changes nothing in it.

## Defaults

Where project guidance is silent the binding uses these package defaults,
each named as a default rather than presented as a project requirement, so
adoption needs no questionnaire:

- **Planning:** the shape in [PROCESS.md](PROCESS.md#planning-and-phases).
- **Review:** the procedure, seats, rounds, finding format and canonical
  severity scale of [REVIEW.md](REVIEW.md); peer adjudication of
  [ADJUDICATION.md](ADJUDICATION.md). The severity scale and the handling of
  `note`, proof and coverage govern under every binding; a repository format
  may add fields.
- **Verification and evidence:** the commands the repository documents for
  its own checks, run from the checkout root; the RP retains their results in
  its attempt directory ([RECORDS.md](RECORDS.md#supporting-evidence)), and
  reviewers validate that record instead of rerunning the gate.
- **Candidate:** the staged index tree on the phase base, identified by base
  and tree, materialized outside the checkout for probes
  ([RECORDS.md](RECORDS.md#scratch)).
- **Landing:** one phase commit of the accepted tree through the repository's
  normal hooks, at the operator's direction ([PROCESS.md](PROCESS.md#landing)).
- **Local files:** `.peer-skills-and-workflows/` as [Local storage](#local-storage)
  describes; records under `runs/` ([RECORDS.md](RECORDS.md#where-records-live)).

A default never overrides project guidance that speaks to the same question,
and an inferred verification command is never reported as a project
requirement: the binding cites the guidance that establishes each command or
marks it as a default.

## Readiness

A binding is ready for a stated next work item when the sources it relies on
resolve and their identities are recorded, local storage is established, the
quality selection the work needs is initialized and cited with its
extensions, verification and evidence commands are identified or marked as
defaults, and no unresolved decision or inaccessible source blocks that work.
Readiness is stated for the intended work, not in general: a binding ready
for implementation may be not ready for review while quality-profiles are
missing. Writing the file does not make it ready; the completion report states
readiness with its basis.

Initialized quality-profiles remain the prerequisite for dependent review. A
missing or unreadable selection is reported as a dependency with the work it
blocks. So is a `.quality/config.json` the quality tool would refuse, which
`inspect` reports `present: false` with an `invalid JSON` or `invalid
structure:` reason naming the member location, and selects nothing from it:
the tool accepts UTF-8 text without a byte order mark holding one object
whose only member is `profiles`, a nonempty array of objects whose only
members are the strings `profileId` and `path`, with nonempty, distinct IDs
and no duplicate member at any depth. Malformed UTF-8 (`invalid JSON: not
UTF-8`) and an unpaired surrogate escape (`invalid JSON: unpaired surrogate`)
are refused before any lookup rather than replaced; supplementary characters,
raw or as escaped surrogate pairs, are ordinary text. The reason never
repeats repository text. The config selects the repository's obligations, so
it is held to the same checkout boundary as the profiles: it is
canonicalized, links and `..` resolved, before it is read. One that resolves
outside the checkout is not read and is reported `present: false` with
`error: 'outside the checkout'`, its canonical `location` and no selection;
one reached through a link inside the checkout is read, and `resolved` names
its checkout-relative canonical origin. Expected inherited-profile lookup
access errors retain the actual code and location alongside independent
inspection facts: restore access and recheck, rather than treating
inaccessible profiles as uninstalled. When no readable installed manifest
declares an inherited or required ID, no folder named after the ID resolves
it, and some candidate manifest cannot be read or decoded, the ID is
`error: 'unresolved'` with `path: null` and an `inaccessible` list of those
manifests' paths, locations and causes, because unread or undecodable bytes
may or may not declare it. The cause is the access code, or the fixed
`invalid JSON` for bytes that are not UTF-8, hold an unpaired surrogate escape
or do not parse, without the parser's text; restore access or the manifest's
content, then recheck. A manifest that decodes but declares another ID is not a
match. A configured or fallback-located manifest that is not UTF-8 or holds an
unpaired surrogate escape is reported `present: false` with `invalid JSON: not
UTF-8` or `invalid JSON: unpaired surrogate`, like the config, never read as
replaced text. `not installed` means a complete search
found no match. A quality
dependency diagnostic alone does not add a nonzero exit policy; an incomplete
recorded required-source check still fails. Truly missing profiles need
operator initialization as [PROCESS.md](PROCESS.md#quality-profiles) requires; binding never invents,
initializes or changes profiles. The binding references the repository's
selection and extensions where they live; it copies none of them into a
competing selection. An installed profile must live in the checkout: the
configured location of each profile manifest is canonicalized, `..` segments
and links resolved, before it is read, and one that resolves outside the
checkout is not read at all but reported as an unavailable dependency with
its location and reason, because a file the candidate does not own cannot
establish the repository's obligations. A configured location elsewhere
inside the checkout is read as configured; where profiles live within the
checkout is the repository's choice, not the binding's. ID lookup applies the
same canonical checkout guard before directory traversal or manifest reads. Blocked lookup
locations appear separately as `blockedLocations`; an unresolved inherited
or required ID stays unresolved, without reading outside the checkout to
guess an association. Legitimate in-checkout locations remain supported.

## Local storage

Local workflow files live only under `<checkout>/.peer-skills-and-workflows/`. Before
any binding or record is written, `node tools/bind.mjs exclude --repo <checkout>`
establishes that storage: it refuses when anything under `.peer-skills-and-workflows/`
is tracked; inspects what holds the path before any probe or write and
refuses when a file, link or other entry occupies it, since only a plain
directory is local storage; creates the empty local directory when it does
not exist yet, so that Git can evaluate a directory rule; reuses an ignore rule
that already
excludes the directory itself, as Git reports for the directory; and
otherwise appends the narrow rule `/.peer-skills-and-workflows/` once to Git's local
exclude file (`info/exclude` of the repository's common Git directory, found
through Git so a linked worktree and a `.git` file resolve correctly),
preserving every existing entry, then verifies with Git that the directory is
excluded. Only the directory's own exclusion counts, because everything
beneath an excluded directory is excluded and nothing in it can be
re-included: a rule that matches some children, such as `*.md`, a
file-specific rule or a contents-only `/.peer-skills-and-workflows/*`, is not coverage,
since other records would stay visible to ordinary staging, and a negation
that matches the directory is the opposite of coverage. The result names the
covering rule with its source, or on failure the negation that overrides the
local rule and which representative records (`binding.md`,
`binding-sources.json`, a run report) a narrower rule would hide, so partial
effects are reported as they are. Repeating the step sequentially changes
nothing, in every state: a rule already present in the exclude file is never appended
again, even while it is ineffective. That local Git metadata edit, with the
empty directory, is the only setup write outside the directory's contents; it
alters no tracked file, no index entry and no shared ignore rule. `inspect`
reports the same facts without changing project files or workflow records.
Git queries may perform incidental administrative cache bookkeeping; that is
outside the inspect/CHECK no-write promise. CHECK never stages, commits, moves
refs or repairs the binding, and never adds the setup-only exclude rule.

The separate local-exclude read reports `rulePresent: false` for an absent
file or a readable file without the rule. Other read failures report
`rulePresent: null` with `ruleError` naming the path and actual cause; this
does not invalidate independently established `ignored` coverage from another
rule. CHECK reports the unknown local rule and recommends restoring access
before retrying, without treating it as removed or repairing it itself.

Concurrent setup calls are uncoordinated. If another call creates the local
directory first, setup re-inspects the occupant and continues with
`directoryCreated: false` only for an actual plain directory; files, links,
other occupants and access failures still refuse setup. Concurrent calls may
append duplicate identical narrow exclusion rules, with equivalent exclusion
coverage; sequential repeat remains a no-op. After a collision or uncertain
concurrent outcome, wait for active setup calls to finish, inspect the occupant
and Git's coverage, then retry serially if needed. Preserve real conflicts and
unrelated rules; do not blindly repair permissions or delete entries.
When setup finds the exact rule after its first coverage check, it checks
coverage again before deciding. An `unverified` result with null `overriddenBy`
is uncertainty, not proof that no conflict exists; inspect the actual state
after active calls finish before deciding whether serial retry is justified.

If content is already tracked (`tracked`), something other than a plain
directory occupies the path (`occupied`: a file, a link to a directory or
file anywhere, or another kind of entry, named with its path, kind and link
target; linked local storage is not supported), the exclude file cannot be
written (`unwritable`), Git still does not exclude the directory while the
rule is in the exclude file (`unverified`, typically because a shared ignore
file negates it with higher precedence, or coverage is uncertain during
concurrent setup; the written rule stays in place and a retry adds nothing),
setup stops and reports the concrete conflict with the
work it blocks. It never untracks files, unlinks, overwrites or retargets an
occupant, overwrites unrelated content or edits shared guidance; resolving
the conflict is the operator's decision, for an occupied path by moving or
removing the entry and repeating setup. `inspect` reports an occupied path
the same way, before inspecting any binding child: binding presence and source
state are unavailable, not absent or current. Checkout, quality and discovery
facts remain available. Tracked content requires separately authorized
relocation or untracking, or forgoing adoption. Conflicting ignore rules
require authorized project-policy resolution, or forgoing adoption. For an
ordinary access failure, the operator repairs access or the path, then retries.
One common cause of `unwritable` is an engine sandbox that keeps Git metadata read-only (Codex's
workspace-write sandbox does); the operator then runs the same `exclude`
command once from an ordinary shell and repeats the binding, which finds the
rule in place.

The coordinator resolves machine-local scratch with `tools/resolve.mjs` before
scratch-dependent work. A failure at that stage blocks that work; scratch
resolution is not part of binding local-storage setup.

Inside a plain local directory, `inspect` reports `binding.state` and
`binding.sourcesState` using `lstat`: `absent`, `file`, `link` (with target
text, or null and an error), `directory`, `other`, or `unavailable` (with the
error code). Presence is false only for absence and null when inspection is
unavailable. Linked binding children, including dangling links, are conflicts
pending operator resolution: do not follow them to read, adopt or refresh.
Persisted manifest reads, including `sources --compare`, refuse a linked file.
Report the path and target; the operator moves or removes the entry, or
restores access, before retrying. A `sources --compare` file named beneath
the checkout's local storage, under any spelling that names it for an export
([Procedure](#procedure) step 4), is also not read while that storage path is
occupied: the outer-directory guard below applies to this one explicit read,
and the comparison is `usable: false` and `current: false` with
`reason: 'local storage path occupied'` and the `occupied` conflict, under the
command's unchanged exit policy. A directly named file outside local storage
is compared as given; that comparison describes the named file, not binding
readiness. The manifest output helper also refuses a
linked binding output child. CHECK reports these facts and leaves entries and
targets untouched. This child policy is separate from the outer-directory
occupied-path guard, which inspects no children.

The rule is added by one append of a comment line and the rule line to the
exclude file; nothing already in the file is rewritten, so every existing
entry survives exactly. If that append is interrupted (a crash or power loss
during the write), the file can end in a cut-short line; a retry sees no
complete rule, appends the comment and rule again and reports `added`, and
the fragment stays, where Git reads it as an ordinary pattern. The tool does
not detect or delete such a fragment, since the same text could be an
intentional rule: inspect `info/exclude` by hand when setup follows an
interruption, and remove a fragment yourself. No interruption of this write
has been observed; this names the window, not a measured rate.

## Refresh

Refresh happens on use, not on a schedule:

- **New run or explicit refresh:** broad discovery. `node tools/bind.mjs inspect`
  lists every tracked and untracked (not ignored) candidate guidance source by name,
  root and scoped agent instructions, guidance documents, the quality
  selection and verification tooling included, as `candidates`, so newly
  added guidance is found; the skill compares that list with the sources the
  binding cites, reads what is new or changed and updates the affected facts.
  A warning from Git's discovery enumeration, or a listed name that is not
  UTF-8 ([Path names](#path-names)), makes `discovery.complete` false,
  with `discovery.errors` naming the affected path and cause (`path: null`
  when Git's warning does not name it; `message` keeps the warning; an
  unsupported name has the checkout as `path` and the escaped name as `name`), and `inspect`
  exits nonzero while retaining independent facts. This is a failed partial
  CHECK: do not use unverified discovery to establish coverage or readiness,
  or read newly exposed entries, until the operator resolves the reported
  cause and a successful recheck establishes complete discovery. For an
  access failure the operator restores access; for an unsupported name they
  obtain a separately authorized rename to UTF-8. Adoption changes no project
  file to clear either cause.
- **Resume, and before each dependent wave:** a source check.
  `node tools/bind.mjs inspect` compares the recorded identities of the
  sources the manifest lists with their current state, uncommitted edits and
  retargeted aliases included, and names changed and missing sources and a
  changed workflow source; its `current` speaks for the recorded sources
  only, and an unusable manifest is reported instead of compared. Additions
  come from the same discovery: the skill compares `candidates` with the
  sources the binding cites, and a comparison the operator extends with
  `sources --compare <manifest> <path>...` names `added` paths and is not
  current while they exist. That listed comparison speaks for the paths it
  lists: a recorded path omitted from the invocation is reported `missing`
  whether or not it still exists on disk, so the currentness of the whole
  recorded set comes from `inspect`, or from a comparison that lists every
  recorded path. Every currently absent recorded source is reported `missing`
  with `current: false`, including one that was already absent when recorded.
  True absence is a complete factual result and may be recorded with `--out`;
  it does not become unchanged/current on repeated checks. Unavailable child
  content remains an incomplete result, not true absence. Readiness for the
  dependent work therefore has
  two parts, stated apart: the recorded sources are current, and the
  discovered guidance sources have been assessed against the binding's coverage.
  A discovered guidance source is read and judged; listing it makes it no
  obligation. Changed facts are rediscovered; a changed obligation is recorded with the evidence
  and coverage it affects, and the PC reassesses that proof and coverage
  before relying on it ([REVIEW.md](REVIEW.md#rounds)). An unchanged candidate
  does not make old coverage current when its governing obligations changed.
- **Personal choices** survive every refresh: a refresh rewrites discovered
  facts and defaults, never an operator decision, and asks only about new
  unresolved decisions. Changing a personal policy needs the operator's word;
  existing authorization stays usable without a new approval step.

If a binding refresh appears interrupted, preserve the surviving content.
Consult available authoritative operator decisions and recovery evidence
scoped to that binding and time, such as a relevant snapshot when one exists.
An absent section does not prove intentional deletion, and an older snapshot
does not override newer decisions. Report uncertainty and ask before replacing
uncertain preferences; normal adoption need not have a ledger or snapshot.

A refresh never changes a running worker's contract. Workers keep the
[snapshot](#snapshots) their task names; a material change affecting active
work returns to the PC, which surfaces it and transitions or stops that work
explicitly before its results are relied on. This never delays a new operator
instruction or ignores a discovered error.

## Snapshots

Each dispatched task works from a fixed binding snapshot. The PC publishes it
under the run records, `<run root>/control/binding/<NNN>/` holding copies of
`binding.md` and `binding-sources.json` ([RECORDS.md](RECORDS.md#layout)),
and passes its absolute path in every task, so a worker in another worktree
or clone, where local files do not exist, still reads the same contract. A
snapshot lives as long as the run records; a wave's evidence names the
snapshot it used.

Under a snapshot, tracked project guidance and quality obligations are read
from the candidate under review, never from the PC's working tree, and local
preferences, personal additions and resolved choices come from the snapshot.
All four reviewers and both adjudicators of a wave use the same candidate,
snapshot and allocation: every task dispatched into a wave already in
progress, a replacement seat and the adjudicators dispatched after its
reviews included, names that wave's snapshot. A newer snapshot, published
after a refresh, applies from the next wave, or to the current one only
through an explicit operator transition that moves the whole wave
consistently with the affected proof and coverage reassessed
([Refresh](#refresh)); publishing it meanwhile is allowed and changes no
running task. The snapshot conveys sources and choices; it cannot override
higher authority or turn an inferred default into a project requirement.

## Coexistence

Discovery treats an existing maintained binding page, older workflow notes or
same-named skills in the repository as sources where relevant and never moves,
rewrites or retires them. Shared guidance keeps its authority; a conflict
between it and the operator's requested workflow is reported for resolution,
not hidden by a local override. Workers load this package's skills from the
resolved workflow source, so no repository or personal skill needs retiring;
the installer leaves foreign entries intact
([README](../README.md#install)). If a naming collision prevents reliable
invocation, resolve it in the operator's personal setup or report that
blocker; engine discovery precedence is not guessed and team configuration is
not changed. Neither adoption nor review asks coworkers to use these skills.

A new clone or linked worktree starts without local binding state and
establishes its own; existing configuration, records and snapshots are
preserved. Removing local adoption needs no tracked rollback, and removing a
binding authorizes deleting neither retained run evidence nor shared quality
configuration.

For copied or relocated manifests, `inspect` exposes `recordedCheckout`,
`recordedCheckoutCanonical` and `checkoutMatches`; `sources --compare` exposes
the same diagnostics in its comparison. Canonical equality accepts equivalent
lexical paths and checkout aliases. Unresolvable or missing identity is null
with `checkoutMatchError`, not a claimed match. These facts are separate from
content currentness: equal measured content stays current after relocation.
Refresh checkout-specific identity facts before readiness, preserving operator
choices and historical snapshots; CHECK recommends that refresh without writing.

## Procedure

The `bind-agent-workflow` skill, loaded explicitly for adoption, refresh or a
check and by the PC when establishing its binding, follows these steps; it
needs no Orca worker and starts no review run. Adopt and refresh write;
check leaves project files and workflow records unchanged: it performs steps 1,
3 and 5 only, skips the storage step and writes neither the binding nor the manifest, and reports storage that is
no longer established or a manifest that is unusable as not ready, with adopt
or refresh as the next action.

1. **Inspect.** Resolve the intended checkout and the installed workflow
   source; run `node <workflow source>/tools/bind.mjs inspect --repo <checkout>`
   and read the sources it lists that bear on the work: agent instructions,
   planning, contribution and verification guidance, the quality selection and
   extensions, CI and hooks, an existing binding with its manifest state and
   the comparison of its recorded sources, and the candidate guidance sources it
   does not yet cite. Reuse established operator choices. Discovery executes no project
   command and changes no project configuration.
2. **Establish local storage** with `node tools/bind.mjs exclude --repo <checkout>`
   ([Local storage](#local-storage)) before writing anything there; a
   reported conflict, an occupied path included, stops the procedure with
   that conflict as the result. In check mode report the storage state
   `inspect` found instead.
3. **Resolve.** Fill facts from their sources and defaults from
   [Defaults](#defaults). Ask only about unresolved decisions and inaccessible
   facts the intended next work needs; never re-ask a settled preference or
   treat missing guidance as proof that no obligation exists.
4. **Write or refresh** `binding.md` from the template, filling its contract
   reference with the resolved workflow source's canonical path so the link
   to this page resolves from the local file and from every snapshot copy,
   and record the sources
   with `node tools/bind.mjs sources --repo <checkout> --out <checkout>/.peer-skills-and-workflows/binding-sources.json <path>...`,
   without overwriting unrelated local files or replacing operator choices.
   The skill names the manifest path explicitly: the tool writes nothing
   without `--out`. The checkout's local `.peer-skills-and-workflows/binding.md` is reserved
   for operator choices: a destination resolving to it is refused with a reason
   directing factual manifest output to `binding-sources.json`. Requested paths
   beneath the checkout's named `.peer-skills-and-workflows/`, after lexical normalization,
   also refuse before mkdir/write when that storage path is a link or other
   non-directory entry; `refused.occupied` reports its path, kind and resolution.
   This includes both binding children and any spelling of the checkout: the
   ancestors above the named `.peer-skills-and-workflows` are resolved, never that entry,
   so an alias of the checkout or of its parents is recognized without following
   the occupant. A name counts as the storage entry or a binding child when
   the filesystem treats it as that entry, not only when it is spelled so: on
   a case-insensitive volume `.PEER-SKILLS-AND-WORKFLOWS` and `Binding.md` are those
   entries, also when the entry itself is stored under such a spelling. When
   either name exists, `lstat` identity decides, and two names reaching one
   inode are one entry only when they share a stored name: a hard link is
   listed under a name of its own and stays a separate, ordinary destination,
   so reserving the binding file does not extend to its hard links. Names that
   do not exist yet are decided by whether the volume folds case; a
   case-sensitive volume keeps such names, hard links included, as distinct
   neighbors. The binding
   file is reserved under every such spelling, before it exists as well, and a
   linked binding child is refused under them. It permits
   external scratch exports and other untracked output,
   but refuses resolved checkout or owning-child Git administrative destinations
   (actual Git and common directories, including linked worktrees), and files
   tracked by the checkout or owning nested repository/submodule. Aliases and
   `..` segments are resolved. Relevant child ancestors are checked, including
   ignored nested repositories; unavailable or unmerged child boundaries and
   protection-query failures refuse with their cause before any output write.
   An external repository unrelated to this checkout is outside this guard.
   On success, `written` retains the requested absolute path; `resolved` names
   the destination when it differs. A named tracked symlink to a permitted
   external target remains allowed: the target receives the manifest and the
   link itself stays unchanged. Protection follows the resolved target.
   Report `refused` with its path and reason; choose a permitted export path or
   have the operator resolve the child/access conflict before retrying. Never
   initialize or update a child to make an export succeed, and do not assume Git
   can recover uncommitted child bytes. Administrative contents remain excluded
   from source hashing and CHECK inventories. The agent performing
   binding owns this local artifact; in an active run that is the PC, whose
   limited write grants no candidate-editing authority and leaves the RP the
   sole implementation writer.
5. **Report** the binding path, the source-check result in its two parts
   (recorded sources current, changed, missing or unusable; discovered
   guidance sources assessed), material changes, each unresolved dependency with the
   work it blocks, and whether the binding is ready for the intended next work
   ([Readiness](#readiness)).
