# Installation

Run the installer from the checkout you want both engines to use:

```sh
npm ci
node tools/install.mjs link [<set>]
node tools/install.mjs check [<set>]
node tools/install.mjs unlink [<set>]
```

`writing` installs the seven [writing skills](../README.md#writing-skills).
`workflow` installs binding, the peer skills, successor and the four plan roles,
plus the writing set they depend on. Omit the set to select both.
`unlink workflow` leaves writing installed; `unlink writing` removes it even
when workflow links still depend on it.

Requires Node.js 22 or later and npm. The binding tools require Git 2.31 or
later; peer work, succession and supervised workers require Orca. The tools load
pinned dependencies from this checkout, not the target repository. Rerun `npm ci`
when `package-lock.json` changes. Tools never download missing dependencies
implicitly; YAML operations name `yaml`, and binding operations name `ajv`, when
installation is missing.

## Skill links

| Engine | Personal skill directory |
| --- | --- |
| Codex | `~/.agents/skills` |
| Claude Code | `~/.claude/skills`, or `skills` beneath an absolute `CLAUDE_CONFIG_DIR` |

A relative `CLAUDE_CONFIG_DIR` uses the default directory. Skills are directory
symlinks on macOS and Linux and directory junctions on Windows; junctions need
no administrator rights or Developer Mode. The installer uses its own checkout
as the source. Keep that checkout available: the installer never copies skills.

After updating or moving the checkout, rerun `link [<set>]`. It adds new skills
and repairs dangling links to the same skill in a former checkout after checking
the replacement's `SKILL.md`. Working links to another checkout and other
occupants stay untouched. Resolve reported collisions in your personal setup;
the installer does not guess engine discovery precedence. `unlink` removes only
links into this checkout. An uninspectable destination is reported with its
error code and preserved: `link` fails; `unlink` keeps that entry and continues.
Other filesystem errors stop the command.

Workflow skills resolve `workflow/`, `tools/` and `defaults.yaml` from their real
source directory. Writing skills read regular files in their own `references/`
directories. Edit the [shared guide](writing-guidance.md) and
[record formats](guidance), then run
`node tools/generate-writing-references.mjs`; the copies are generated.

`check [<set>]` verifies package references, the selected personal links and
required hook definitions. Links must point into this checkout, and `SKILL.md`
and required shared files must be readable regular files. Without a set it
checks both sets, so a writing-only installation should use `check writing`.
A successful check does not establish what a running engine session can read.

## Engine access

Confirm that the engine can locate and read the linked skill's required files
from the target repository. `check` validates filesystem access, not the running
session's permissions.

For files outside the skill directory, the previously exercised Claude setup
used `--add-dir <checkout>`; a bare Read allow rule did not supply the checkout's
location or permission to resolve its link. Whether this additional access is
still needed for the current skill-local references is unverified. An added
directory is also editable under the session's permission mode: automatic edit
approval can expose these live shared files to changes unless a permission rule
or protected path prevents them.

For Codex, also apply the printed session instructions as described in
[Codex environment](../README.md#codex-environment). Installation does not edit
Codex configuration.

## Successor support hooks

Workflow installation merges successor's `SessionStart`, `UserPromptSubmit`
and `Stop` commands into `~/.codex/hooks.json` and `~/.claude/settings.json`,
preserving unrelated entries. An absolute `CODEX_HOME` changes the Codex hook
directory; a relative value is rejected. An absolute `CLAUDE_CONFIG_DIR` changes
Claude's settings and skill directories. User hooks apply across repositories;
sessions without an enabled succession chain receive no instructions from them.
Writing-only operations do not install, check or remove these hooks.

The installer records entries it adds in `.agent-workflow-successor-hooks.json`
beside each settings file. Keep these receipts so `unlink` can remove only owned
entries. Pre-existing matching hooks are reused and remain after uninstall.
Rerunning `link` repairs missing owned entries; after a move it updates owned
hooks when the former skill target is missing. Working installations from
another checkout, changed definitions, malformed settings and overlapping locks
are reported and preserved. If hook removal fails, skill links remain for
reconciliation. Empty settings files may remain after removal.

Settings updates are atomic and check the before-state; installer locks do not
serialize outside editors. `check` verifies definitions, not runtime trust or
actual delivery. Review each new or changed Codex definition in `/hooks`, then
verify live delivery. Project-local hook copies may run alongside user hooks;
review obsolete copies before enabling both.
The [successor mechanics](../skills/successor/references/mechanics.md#hook-reminders)
owns hook verification and recovery. The installer never changes trust records.

## Git commit hook

`node tools/install-hooks.mjs` installs this package's Git commit gate, preserving
other hook arrangements. It is separate from agent support hooks. See
[Commit gate](../README.md#commit-gate) for checks and
[conventional-commit guidance](guidance/conventional-commits.md) for message rules.
