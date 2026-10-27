# Candidate <NNN>

- Repository: `<path>`; worktree `<path>`; branch `<name>` (navigation only).
- Workflow instructions loaded: `<source path>` at `<commit, tree or content note>`.
- Binding snapshot: `<absolute path from the task>`; verification commands and proofs taken from it.
- Phase base: `<full commit id, or the empty tree before the first commit>`.
- Candidate: tree `<full tree id>`; commit `<full id or "staged">`.
- Previous candidate: `<tree or none>`; delta summary: <…>.
- Paths: <changed paths or `git diff --cached --name-status` output>.
- Verification: <commands, hosts actually run on, retained record location, result per required check>.
- Failures observed and their handling: <…>.
- Corrections applied: <finding ID → change → tests>.
- Not done or limited: <…>.
