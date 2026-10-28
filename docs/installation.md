# Installation

Install the package as the `peer` plugin from Git, or link a checkout's skills
for development and writing-only use. Use one mode per engine: a linked
`workflow` set and the plugin together run each successor event twice (see
[Overlap](#overlap)).

Both modes need Node.js 22 or later. The binding tools require Git 2.31 or
later; peer work, succession and supervised workers require Orca and its
installed `orchestration` skill. The YAML and Ajv dependencies ship in
`tools/vendor/`, so neither mode runs npm or downloads anything at run time.

## Plugin

The repository is its own marketplace, `peer`, holding one plugin, `peer`:

```sh
claude plugin marketplace add https://github.com/corrabora/peer-skills-and-workflows.git
claude plugin install peer@peer

codex plugin marketplace add https://github.com/corrabora/peer-skills-and-workflows.git
codex plugin add peer@peer
```

Start a new session after installing or updating. Select a packaged skill as
`/peer:<skill>` in Claude Code or `$peer:<skill>` in Codex; a matching request
also selects it automatically. For Codex, add the
[session instructions](../README.md#codex-environment) yourself, then review the
plugin's three successor hooks in `/hooks`; installation never records hook
trust. Without an enabled succession chain, the hooks return nothing.

To try the plugin beside a linked installation, set an absolute, disposable
`CODEX_HOME` or `CLAUDE_CONFIG_DIR` for those commands and sessions, and sign in
to that profile before running models. Your linked setup stays untouched.

### Update

| Step | Claude Code | Codex |
| --- | --- | --- |
| Refresh the marketplace | `claude plugin marketplace update peer` | `codex plugin marketplace upgrade peer` |
| Refresh the installed plugin | `claude plugin update peer@peer` | done by the marketplace upgrade |
| Show the installed revision | `version` and `installPath` in `claude plugin list --json` | `git -C "${CODEX_HOME:-$HOME/.codex}/plugins/cache/peer/peer/local" rev-parse HEAD` |

Claude Code names each installed copy after the commit's first 12 hex digits;
Codex replaces its `local` copy in place. Start a new session after updating;
hot reload is unverified.
When an update changes the instructions, tools or plugin metadata, a bound
checkout reports its workflow source as changed: run `bind-agent-workflow` to
refresh the binding. Recorded paths of active succession chains are kept for
recovery, not rewritten.

### Disable and remove

| Action | Claude Code | Codex |
| --- | --- | --- |
| Disable or enable | `claude plugin disable peer@peer`, `claude plugin enable peer@peer` | set `enabled = false` or `true` under `[plugins."peer@peer"]` in `~/.codex/config.toml` (or `$CODEX_HOME`) |
| Remove the plugin | `claude plugin uninstall peer@peer` | `codex plugin remove peer@peer` |
| Remove the marketplace | `claude plugin marketplace remove peer --scope user` | `codex plugin marketplace remove peer` |

Removal leaves bindings, run records, scratch and succession state in the
[state locations](#state-locations).

### Overlap

A linked `workflow` set installs user hooks; the plugin declares the same three
hooks, and both run. Writing-only links install no hooks. Linked skills also
appear unqualified beside the `peer:` ones. Check `/hooks` in each engine for
successor commands from both sources. To keep the plugin, run
`node tools/install.mjs unlink` from the linked checkout, which removes only its
own links and hooks; otherwise remove the plugin. Nothing removes either
installation automatically.

### Tested compatibility

Plugin installation, update, disable and removal were exercised on macOS with
Codex CLI 0.165.0-alpha.1.2 and Claude Code 2.1.309, through each client's Git
marketplace commands against a local repository. Unverified: hosted Git
transport and authentication, Windows and Linux, the Codex and Claude desktop
apps, other client versions, Claude model sessions in a profile with the
marketplace installation enabled (sessions loaded the installed copy with
`--plugin-dir`), and Codex trust through the `/hooks` screen (tested through
its configuration record).

## Linked checkout

Run the installer from the checkout you want both engines to use:

```sh
node tools/install.mjs link [<set>]
node tools/install.mjs check [<set>]
node tools/install.mjs unlink [<set>]
```

`writing` installs the seven [writing skills](../README.md#writing-skills).
`workflow` installs binding, the peer skills, successor and the four plan roles,
plus the writing set they depend on. Omit the set to select both.
`unlink workflow` leaves writing installed; `unlink writing` removes it even
when workflow links still depend on it. The tools load their dependencies from
this checkout's `tools/vendor/`, never from the target repository; a missing or
damaged payload is reported by name.

### Skill links

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

### Engine access

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

### Successor support hooks

Workflow installation merges successor's `SessionStart`, `UserPromptSubmit`
and `Stop` commands into `~/.codex/hooks.json` and `~/.claude/settings.json`,
preserving unrelated entries. An absolute `CODEX_HOME` changes the Codex hook
directory; a relative value is rejected. An absolute `CLAUDE_CONFIG_DIR` changes
Claude's settings and skill directories. User hooks apply across repositories;
sessions without an enabled succession chain receive no instructions from them.
Writing-only operations do not install, check or remove these hooks.

The installer records entries it adds in
`.peer-skills-and-workflows-successor-hooks.json` beside each settings file.
Keep these receipts so `unlink` can remove only owned entries. Pre-existing
matching hooks are reused and remain after uninstall. Rerunning `link` repairs
missing owned entries; after a move it updates owned hooks when the former skill
target is missing. Working installations from another checkout, changed
definitions, malformed settings and overlapping locks are reported and
preserved. If hook removal fails, skill links remain for reconciliation. Empty
settings files may remain after removal.

Settings updates are atomic and check the before-state; installer locks do not
serialize outside editors. `check` verifies definitions, not runtime trust or
actual delivery. Review each new or changed Codex definition in `/hooks`, then
verify live delivery. Project-local hook copies may run alongside user hooks;
review obsolete copies before enabling both.
The [successor mechanics](../skills/successor/references/mechanics.md#hook-reminders)
owns hook verification and recovery. The installer never changes trust records.

## State locations

Both modes keep state outside the installed package:

| State | Location |
| --- | --- |
| Binding, configuration and run records of a checkout | `<checkout>/.peer-skills-and-workflows/` |
| Machine-local scratch and external records, macOS | `~/Library/Application Support/PeerSkillsAndWorkflows/` |
| Same, Windows | `%LOCALAPPDATA%\PeerSkillsAndWorkflows\` |
| Same, Linux and others | `$XDG_STATE_HOME/peer-skills-and-workflows/`, else `~/.local/state/peer-skills-and-workflows/` |
| Linked hooks' ownership receipt | `.peer-skills-and-workflows-successor-hooks.json` beside each engine's settings |

The binding keeps the checkout directory out of Git through the local exclude
file; see [Binding](../workflow/BINDING.md) and [Records](../workflow/RECORDS.md).

## Vendored dependencies

`tools/vendor/package-lock.json` pins the runtime dependencies and records
their npm source and integrity; `tools/vendor/manifest.json` records the hash
of each input and installed file. `node tools/verify.mjs` checks the payload
offline. After changing the vendor lockfile, regenerate the payload with npm and
registry access, or a populated npm cache passed with `--cache`:

```sh
node tools/generate-vendor.mjs            # replace node_modules and manifest.json
node tools/generate-vendor.mjs --check    # verify, and compare a fresh regeneration
```

## Git commit hook

`node tools/install-hooks.mjs` installs this package's Git commit gate, preserving
other hook arrangements. It is separate from agent support hooks. See
[Commit gate](../README.md#commit-gate) for checks and
[conventional-commit guidance](guidance/conventional-commits.md) for message rules.
