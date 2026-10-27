# Local binding — <repository name>

Operator's local source map for the agent workflow, under the binding contract
`workflow/BINDING.md` of the workflow source recorded below:
[BINDING.md](<workflow source canonical path>/workflow/BINDING.md).
Facts carry their source; defaults are named as defaults; operator decisions
are quoted. Nothing here is a project requirement or an execution release.

## Identity

- Checkout: `<canonical path>`; Git directory `<path>`; common directory `<path>`; linked worktree <yes | no>.
- Branch `<name>` at HEAD `<commit>` when last checked <date and time>.
- Workflow source: `<path>` at `<commit, or content digest for a copied source>`; uncommitted instruction changes: <paths or none>.
- Sources recorded in `binding-sources.json` beside this file; last source check: <date>; recorded sources: <current | changed or missing: paths | manifest unusable: reason>; discovered guidance sources not cited: <none | paths, with the conclusion about each>.

## Project guidance (observed)

- Agent instructions: <paths, or none found>.
- Planning: <path and the plan location it sets>, or default: PROCESS.md shape.
- Contribution, review and delivery requirements: <path → obligation>, or none found.
- Existing binding or workflow notes: <path → how it is used>, or none.

## Quality (observed)

- Selection: `.quality/config.json` → <profile IDs and versions>; inherits <IDs>; requires (reference only) <IDs>.
- Repository extensions: <path → scope of the obligations it adds>, or none.
- Status: <initialized | missing: dependency and the work it blocks>.

## Verification and evidence

| Command | Working directory | Establishes | Source |
| --- | --- | --- | --- |
| `<command>` | `<dir>` | <required proof> | <path, or default> |

- Evidence validity: <what reviewers validate>, from <source or default>.
- Output locations: <where the repository's tooling writes>, or none.

## Candidate and landing

- Candidate form: <staged index tree on the phase base (default) | branch | worktree>; probes materialize it in scratch.
- Landing: <one phase commit through the repository's hooks (default); message rules from <source>>.
- Departures from package defaults: <each, with its source>, or none.

## Operator choices

- <Continuing preference, quoted exactly where wording matters: "…" (source, date)>.
- Personal quality additions: <source path and scope, kept apart from repository clauses>, or none.

## Unresolved

- <Decision or inaccessible source → work it blocks>, or none.
- Ready for: <next work, with the basis>; not ready for: <work and why>.
