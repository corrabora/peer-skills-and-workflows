# <Plan> workflow state

- Run: `<run id>`; runtime `<id>`; PC `<terminal handle>`.
- Workflow source: `<absolute path>` at `<revision or content note>`, as loaded.
- Target: `<repository path>`; local binding `<checkout>/.peer-skills-and-workflows/binding.md`, sources checked `<when, result>`; current snapshot [control/binding/<NNN>](<run-root-relative path>); plan `<path>`; phase `<n>`.
- Run root: `<absolute path>`; scratch root `<absolute path, outside the checkout>`.
- Stage: <preparing | reviewing | adjudicating | at operator gate | correcting | landing>.
- Cycle `<NNN>`; candidate base `<commit or empty tree>`, tree `<tree>`; round `<r>`; wave `<NNN>-round-<r>`.
- Operator entry: [report.md](<run-root report.md, beside this file>), a <relative symbolic link | Markdown pointer> the PC created; verified `<when>` to open the current report.
- Current report: [<wave or revision> report](<run-root-relative path to the latest published report.md or revision>), the actual file the entry opens.
- Quality allocation: <selection, versions and where the four-set allocation is recorded>.
- Operator guidance: [operator-guidance.md](<run-root operator-guidance.md, beside this file>); in force `<OG IDs>`.
- Operator authorization in force: <scope and stop boundary in brief> (`<OG IDs>`).

## Configuration

<Effective profile and source layer for each role and seat, from
`tools/resolve.mjs`, and any operator overrides in force.>

## Live tasks

| Task | Dispatch | Role | Requested engine/model/effort | Effective | Status |
| --- | --- | --- | --- | --- | --- |

Naming exceptions: <any worker that could not be given its visible name, and why; or none>

## Pending

- Questions: <ids>
- Disposition: active `<finding ID or none>`; remaining queue `<IDs in order, parked marked>`.
- Next permitted action: <action>
