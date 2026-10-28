# Plan: Git-backed plugins for Codex and Claude Code

Status: implementation authorized by the operator.
Commit, push and publication remain separate actions. This plan targets Codex and
Claude Code. Other Claude surfaces and public plugin directories are outside
the initial support claim.

## Direction and rationale

Make this Git repository its own marketplace and its root one complete plugin,
`peer`. Keep the existing skill sources and package layout.
Provide each engine's native catalog and manifest, and retain the link installer
for development and writing-only installation.

Workflow skills find `tools/`, `workflow/` and `defaults.yaml` relative to their
real skill directory. A complete root plugin preserves that relationship in an
installed copy. Splitting writing and workflow into separate plugins would add
cross-plugin loading and overlapping skill discovery to solve a packaging
problem. Generating a second plugin tree would add duplication and release
machinery before a need for a smaller payload has been demonstrated. The cost
of the root package is that its installed copy also contains repository docs
and tests.

Use `peer` for both marketplace and plugin identity. Keep the existing npm
package name and Git repository; keep npm publication disabled.
One installation provides all sixteen current skills; the installer's writing
and workflow sets remain its own selection mechanism.

### Skill invocation

The plugin name supplies the skill namespace. The
[Claude skill documentation](https://code.claude.com/docs/en/skills) specifies
`/plugin-name:skill-name`, giving `/peer:peer-review` and
`/peer:write-for-humans`. Marketplace identity selects the installation source;
the plugin installation identifier is `peer@peer`.

The [OpenAI packaging guide](https://developers.openai.com/plugins/build/plugins)
also identifies the plugin name as its component namespace. Its
[skill guide](https://learn.chatgpt.com/docs/build-skills) documents explicit
selection through `/skills` or `$` in Codex CLI, plus implicit selection from a
matching task. Both engines support automatic selection when the skill permits
it, so users need not name the plugin in every request. Use qualified names
when explicitly selecting a packaged skill to distinguish it from other skills.
The tested Codex CLI accepts `$peer:write-issue`; Claude Code accepts
`/peer:write-issue`. Both reach the packaged audience skill and references.

## Sources and compatibility limits

This plan was developed against repository commit
`0d7d348302bf1eef39b02c753c1096c64bde2c12`. The repository's
[installation contract](../../installation.md),
[installer sets](../../../tools/lib/install.mjs) and
[successor hook implementation](../../../tools/lib/successor.mjs) establish
the current link-based behavior.

The [OpenAI packaging guide](https://developers.openai.com/plugins/build/plugins)
documents a portable root `plugin.json`, a native
`.agents/plugins/marketplace.json` catalog, Git marketplace registration, and
OpenAI-specific hook settings. The
[Claude manifest reference](https://code.claude.com/docs/en/plugins-reference)
documents `.claude-plugin/plugin.json`, while its
[marketplace guide](https://code.claude.com/docs/en/plugin-marketplaces)
documents Git distribution through `.claude-plugin/marketplace.json`.
These sources were inspected on 2026-10-27; they establish documented formats,
not successful installation of this package.

The tested targets are Codex CLI `0.165.0-alpha.1.2` and Claude Code `2.1.309`
on macOS 26.7.1, with Node.js 24.18.0. Codex desktop, other client versions,
and native Windows/Linux execution remain unverified, as does private Git
authentication.
Platform path mappings have deterministic tests; those tests do not establish
native host execution.

## Package contract

Add these files at the repository root, alongside the existing package:

| Path | Responsibility |
| --- | --- |
| `.codex-plugin/plugin.json` | Codex identity, skills and explicit Codex hooks |
| `.claude-plugin/plugin.json` | Claude identity and component declarations |
| `.agents/plugins/marketplace.json` | Native Codex catalog pointing to the root plugin |
| `.claude-plugin/marketplace.json` | Native Claude catalog pointing to the root plugin |
| Engine-specific files under `hooks/` | Successor event declarations using the installed root |

Prefer a root source of `./` in each catalog, expressed in its native schema.
Check shared identity, source and release metadata for consistency without
assuming the schemas are interchangeable. Use the Codex compatibility manifest
without a root `plugin.json`: the tested Codex version loads its hooks only
with that selection. Declare `hooks/codex.json` and `hooks/claude.json`
explicitly; omit `hooks/hooks.json` so neither host discovers the other's hooks.

All required skill references and executable dependencies must be available
inside the installed package or through an explicitly supported runtime
prerequisite. Keep Node.js 22+, Git where binding needs it, and Orca where peer,
succession or supervised work needs it. The plugin does not install Orca or
replace its version-matched orchestration guide.

Ship the pinned `yaml` and `ajv` dependency tree in
`tools/vendor/node_modules/`, with licenses and npm source/integrity provenance
in `tools/vendor/package-lock.json`. That lockfile is the sole runtime dependency
owner; keep root `package.json` as package metadata without dependencies or a
root lockfile. Both link and plugin modes load the exact vendored package
directory, refusing fallback to root or ambient dependencies.

Provide an explicit generator that copies the vendor `package.json` and lock
into a staging directory outside the package, runs `npm ci --ignore-scripts
--no-bin-links` there with an isolated npm cache, removes npm's hidden
installation lock, and only then replaces the payload and its manifest. The
manifest records SHA-256 hashes of both inputs and every payload file. Refuse a
linked vendor directory or a cache overlapping the package before running npm.
The offline gate checks package membership and versions against the vendor
lock, provenance, licenses and the manifest hashes. A separate generator check
verifies the current payload and compares a fresh regeneration; it needs
registry access or a populated npm cache.
Runtime use needs neither npm nor a network download. Missing payload diagnostics
direct maintainers to regeneration and users to reinstall; broken package code
and transitive failures retain their original errors.

Use commit-based updates without a manifest version. The tested Codex
`plugin marketplace upgrade peer` refreshes the installed unversioned `local`
cache. Claude needs marketplace refresh followed by `plugin update peer@peer`
and selects a cache directory named from the commit. Record the installed
commit and manifest identity; start a new session after updating. Existing-session
hot reload is outside the support claim. An update that changes content within
the workflow source identity, including hooks and plugin metadata, makes
affected bindings report it; they are refreshed through their normal contract.
Cache relocation or a new commit with identical content leaves that identity
unchanged.

Treat installed package contents as replaceable. Preserve retained records,
scratch and succession state through the storage contracts below.
An update must respect binding currency, active-chain source paths and evidence
lifetime; do not rewrite those identities merely to hide cache relocation.

## State storage

Use these paths in both plugin and development link modes. State directories
match the repository name so they remain recognizable independently of the
short invocation name `peer`.

| State location | Path |
| --- | --- |
| Checkout-local binding, configuration and run state | `<checkout>/.peer-skills-and-workflows/` |
| macOS machine-local base | `~/Library/Application Support/PeerSkillsAndWorkflows/` |
| Windows machine-local base | `%LOCALAPPDATA%\PeerSkillsAndWorkflows\` |
| Linux/other machine-local base | `$XDG_STATE_HOME/peer-skills-and-workflows/`, or `~/.local/state/peer-skills-and-workflows/` |
| Installer-owned hook receipt beside engine settings | `.peer-skills-and-workflows-successor-hooks.json` |

Keep the records, scratch, repository-key and run layouts beneath these
roots. Preserve the absolute-root validation and platform fallback
rules in [the path owner](../../../tools/lib/paths.mjs). Apply the namespace to
all state consumers: binding and source manifests, configuration overrides,
peer records, succession chains and counters, locks, hook ownership receipts,
temporary output and recovery paths. Audit hardcoded paths outside that owner,
including binding and successor helpers, skills, workflow contracts, templates,
installer advice and test fixtures. Exclude the checkout-local state directory
through the binding contract's existing protection checks, preserving unrelated
Git exclusions. Resolve state only within the assigned roots, including missing
state and recovery paths. Hooks remain inert without an enabled succession chain.
Keep retained state independent of host plugin-data cleanup and uninstall behavior.

## Phase 0: prove the installation contract

Use isolated engine profiles following the [installation guide](../../installation.md#plugin),
disposable target repositories and a Git-backed marketplace fixture containing
this package. Keep probe files and evidence outside tracked
deliverables. Consult the installed clients' authoritative help and the official
references above for current commands; do not change personal plugin settings
or interrupt unrelated ongoing work to conduct these tests.

Produce a compatibility result for each engine covering:

1. Native catalog discovery, root-source acceptance and manifest selection when
   both engine manifests are present, with local-directory loading distinguished
   from a real Git install into the host's cache.
2. Skill names and sibling loading under the `peer` plugin namespace, through
   explicit selection and a matching natural-language request: a writing skill
   reaches its audience skill and generated references; a workflow skill reaches
   its protocol, defaults and tools from the installed copy.
3. Dependency provisioning, including an operation that actually requires YAML
   and a disposable binding inspection that requires Ajv. Remove access to the
   author's checkout and dependency directory during the test.
4. Each successor event (`SessionStart`, `UserPromptSubmit`, `Stop`), the correct
   engine argument, root-path quoting, Node discovery, and any host trust step.
   Confirm inert behavior without an enabled chain.
5. State isolation for bindings, configuration, runs, succession chains, counters
   and receipts. Exercise missing state, overlapping run IDs, hook delivery and
   recovery. Writes stay within assigned roots, and unrelated fixture data
   remains unchanged. Test overlapping skill and hook registrations in
   disposable engine configuration.
6. A second Git revision reaching the installation through the host's update
   flow, including changed cache paths, session reload requirements and source
   identity handling.

Retain inputs, outputs, versions, source commits, installed paths and observed
limits. Settle the manifest variants, dependency route, update policy and
supported surface/OS matrix in this plan before Phase 1. Any failed required
case stops its dependent packaging work and requires a revised contract;
metadata validity cannot substitute for a missing runtime result. Keep a
subdirectory package as an alternative to investigate if root-source loading
fails, without moving or duplicating the maintained sources speculatively.

## Phase 1: deliver the complete Git package

Input: the successful Phase 0 contract. Add the native catalogs, manifests,
engine-specific hook definitions, selected dependency payload and isolated
state paths. Preserve the existing relative source layout and installer
ownership semantics; link mode uses the same state paths as plugin mode.

Extend offline verification to detect inconsistent names or versions, invalid
native catalog fields, missing or escaping component paths, incorrect skill
membership, and stale generated dependency output. Add a reproducibility
check for the bundle to the complete gate.
Test execution from a relocated copy without `.git` or developer dependencies;
exercise the actual YAML and Ajv paths rather than help output alone.
Add deterministic path tests for all platform mappings, binding exclusion and
storage selection, config resolution, succession, hook receipts and recovery.
Seed unrelated sentinel files and verify that normal operations, failed operations
and package cleanup leave them unchanged. Trace all writes in the disposable
integration fixture to establish that new state stays within its assigned roots.

Completion: the native validators available for the selected clients and
`node tools/verify.mjs` pass; a Git install of the candidate passes Phase 0's
loading, dependency and hook checks on both engines. No supported-runtime claim
is complete while one engine's required proof is missing.

## Phase 2: verify lifecycle and document release use

Input: the working package from Phase 1. Verify activation, deactivation,
removal and recovery in disposable configuration. Cleanup removes only owned
resources and preserves unrelated settings and retained records. Each selected
succession chain receives its event once.

When a link installation's user hooks and the plugin's hooks are both present,
each successor event runs twice, so detect that overlap. Use a supported host
query when one is available and reliable. Otherwise provide a clear manual
check; do not depend on undocumented private cache schemas or automatically
delete installations. Plugin installation must not create a succession chain
or record hook trust; users review hooks in each host. Keep the Codex
`developer_instructions` paragraph an explicit setup step unless a supported,
tested plugin mechanism supplies equivalent session instructions.

Update the README and installation guide with the tested Git registration,
installation, update, disable/removal and development procedures. Explain skill
names, runtime prerequisites, hook trust, session reloads, release identity and
the supported compatibility matrix. Document state locations and binding setup.
Instructions must distinguish marketplace
refresh from plugin refresh and specify how users verify the installed revision.
Document the chosen commit/version policy and its maintenance check. Public
directory submission and pushing a release remain separate actions.

Completion: installer regression tests and `node tools/verify.mjs` pass, and
retained executions on both engines show a representative installed skill path
and a relevant boundary case under
[AW-SK-EV4](../../qualities/skill-evidence.md#aw-sk-ev4). Include namespaced
dependency loading, missing-prerequisite reporting and the lifecycle/update
paths changed by this work. Deterministic validation proves package structure;
the execution traces establish the observed skill and hook behavior. Preserve
any unavailable platform or surface as unverified in the support matrix.

## Quality and execution authority

Implementation uses the repository's selected
[quality profiles](../../../.quality/config.json) and all sixteen
[local skill clauses](../../qualities/README.md), assessing applicability to the
changed packaging, discovery, dependencies and operator instructions. The
writing skills govern documentation and agent-facing changes. This planning
artifact changes no skill behavior and claims no installation certification.

Later phases depend on Phase 0's compatibility results. Peer agreement on this
plan supplies no implementation, formal review, landing or publication release
beyond the calling task's authority.
