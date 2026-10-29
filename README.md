# Peer skills and workflows

This repository contains shared agent skills for Claude Code and Codex, with
Node.js tools and Orca workflows. Install them as the `peer` plugin from Git,
or link this checkout's skills so edits here reach both engines.

## Writing skills

Use these skills for prose within any task; they need no plan or Orca Run.

| Skill | Use it to |
| --- | --- |
| [clarify-artifact](skills/clarify-artifact/SKILL.md) | Resolve consequential uncertainty about an artifact's reader, purpose or scope |
| [write-for-humans](skills/write-for-humans/SKILL.md) | Write explanations, documents and reports people can use |
| [write-for-agents](skills/write-for-agents/SKILL.md) | Write instructions, task briefs and handoffs a fresh agent can execute |
| [maintain-glossary](skills/maintain-glossary/SKILL.md) | Resolve consequential vocabulary ambiguity and maintain project meanings |
| [record-decision](skills/record-decision/SKILL.md) | Record or revise decisions as ADRs, or migrate existing records when asked |
| [write-issue](skills/write-issue/SKILL.md) | Write bug reports, proposed changes and exploratory issues with observable completion criteria |
| [write-pr](skills/write-pr/SKILL.md) | Explain the actual change and verification, accounting for associated issue criteria |

The audience skills apply [shared writing guidance](docs/writing-guidance.md)
and load one another for mixed artifacts. Load the appropriate skill before
drafting or substantially revising prose; use clarification when unresolved
reader, purpose or scope would materially change it.

`record-decision` honors explicit recording requests and repository requirements.
Offer an unsolicited ADR only when reversal would be costly, the choice would
surprise a future reader without its context, and a real trade-off exists.
Records preserve context, rationale, alternatives and consequences without
inventing acceptance or implying delivery. The [ADR format](docs/guidance/adr-format.md),
[glossary format](docs/guidance/glossary-format.md) and
[adoption guidance](docs/guidance/record-format-adoption.md) own record structure
and revision rules.

## Peer review

Ask to “conduct a peer review” for [peer-review](skills/peer-review/SKILL.md).
The host and one fresh, read-only companion assess the same work independently,
then seek explicit agreement. The existing writer applies agreed corrections
within its authority. Unresolved disagreement returns to the operator after at
most three paired discussion rounds.

## Peer decision making

Ask to “resolve this decision with a peer” for
[peer-decision-making](skills/peer-decision-making/SKILL.md). Two peers compare
options and return a joint recommendation with its reason, trade-off and
material uncertainty, or both positions when they cannot agree.

## Peer implementation

Ask to “implement this with a peer” for
[peer-implementation](skills/peer-implementation/SKILL.md). Two authorized writers
alternate checks and implementation on shared work until both assess the result
as complete. Non-executable work uses explicit inspection conditions.

The peer skills need Orca, but no plan or workflow binding. By default the
companion uses the opposite engine at equal or equivalent reasoning effort;
explicit operator choices override those defaults. Peer agreement preserves
existing execution, publication and formal review gates. The skills own their
protocol; [acceptance scenarios](tests/skills/scenarios) exercise
its boundaries.

## Context succession

Use [successor](skills/successor/SKILL.md) to enable automatic context replacement
for the current task, or request an immediate handoff by asking for “successor now”.
The default thresholds are 3 completed compactions or 40 turns. Successors
inherit the task's decisions, authority and unfinished work. Succession must be
enabled explicitly; discussing context limits does not enable it. Handoffs
retain task-scoped original messages in chain records that persist after the
task ends; treat those records as potentially sensitive.

The plugin and the linked workflow set both provide its support hooks for both
engines. Review new or changed Codex definitions in `/hooks` and verify live
delivery; installation checks establish definitions, not trust or delivery. See
[installation](docs/installation.md) and the
[mechanics reference](skills/successor/references/mechanics.md).

## Supervised plan workflow

Use these skills when running a repository plan through supervised Orca workers.
The coordinator dispatches fresh workers and reports each review outcome at the
operator gate. A review wave has four direct reviewers; findings go to two peer
adjudicators before the report. [The process](workflow/PROCESS.md) defines
execution releases; [Review](workflow/REVIEW.md) defines the rotation.

| Skill | Role |
| --- | --- |
| [bind-agent-workflow](skills/bind-agent-workflow/SKILL.md) | Establish, refresh or check the operator's local binding to a checkout |
| [plan-coordinator](skills/plan-coordinator/SKILL.md) | Coordinate workers, records and operator decisions |
| [plan-responsible-party](skills/plan-responsible-party/SKILL.md) | Implement, correct or land authorized work, alone or in an operator-directed pair |
| [plan-reviewer](skills/plan-reviewer/SKILL.md) | Review one assigned quality set without editing |
| [review-adjudicator](skills/review-adjudicator/SKILL.md) | Independently assess findings and reconcile with an equal peer |

## Install

Requires Node.js 22 or later. Binding tools also require Git 2.31 or later.
Peer skills, succession and supervised workers use Orca's installed
`orchestration` skill and its version-matched runtime guide.

Install the `peer` plugin from this repository's marketplace:

```sh
claude plugin marketplace add https://github.com/corrabora/peer-skills-and-workflows.git
claude plugin install peer@peer
codex plugin marketplace add https://github.com/corrabora/peer-skills-and-workflows.git
codex plugin add peer@peer
```

Packaged skills are `/peer:<skill>` in Claude Code and `$peer:<skill>` in Codex.
For development or writing-only use, link this checkout instead:

```sh
node tools/install.mjs link             # install both sets and required support hooks
node tools/install.mjs check            # check references, links and hook definitions
```

Use one mode per engine: a linked `workflow` set and the plugin together run
each successor event twice.
[Installation](docs/installation.md) covers updates, removal, hook review,
link sets, state locations and the tested compatibility limits.

### Codex environment

In either mode, add this top-level `developer_instructions` setting to your
user `~/.codex/config.toml` or a trusted project's `.codex/config.toml`.
Preserve any existing instructions and refresh the paragraph when
[its maintained source](docs/guidance/codex-session-instructions.txt) changes.
`link` prints the setting; neither mode edits Codex configuration.

```toml
developer_instructions = "When an unresolved reader, purpose or scope, or a contradiction between the request and its governing source, requires one clarification question, asking it is not a skill-caused pause or block; do not cite a skill solely because you are asking it. Put the question in the reply. A claim one source makes about another stays attributed in the draft when that preserves the requested meaning; it alone creates no choice for the user. Keep existing reporting for actual missing dependencies, unavailable tools and permission or approval blocks."
```

## Configure

[defaults.yaml](defaults.yaml) assigns named worker profiles (agent, model,
effort) to plan roles and review seats. Local overrides live in
`.peer-skills-and-workflows/config.yaml` and
`.peer-skills-and-workflows/plans/<plan>.yaml`, with optional phase sections;
operator overrides take precedence.

```sh
node tools/resolve.mjs --repo <checkout> --run <orca-run-id> [--plan <name>] [--phase <id>]
```

The coordinator resolves settings from its own checkout and passes effective
values and absolute record paths to workers.
[Configuration precedence and launch checks](workflow/ORCA.md#configuration)
define the contract. Configuration and skill frontmatter use UTF-8 YAML 1.2 Core
with a restricted plain-data model; the [YAML reader](tools/lib/yaml.mjs) owns
accepted constructs and diagnostic rules.

## Bind a repository

Invoke `bind-agent-workflow` for the target checkout. It discovers repository
guidance, quality selection and verification requirements, then records a local
source map in the ignored `.peer-skills-and-workflows/` directory. Adoption
changes no tracked files. Check mode reports currentness and readiness without
changing project files or workflow records.

The coordinator establishes or refreshes this binding before dependent plan
work. Missing quality profiles require operator initialization. See the
[binding contract](workflow/BINDING.md) for storage, readiness and recovery.
Plan run records stay in the coordinator's checkout; disposable scratch stays
outside it. [Records](workflow/RECORDS.md) owns their layout and lifetime.

## Quality for this repository

Changes here follow the profiles selected in
[.quality/config.json](.quality/config.json), including inherited obligations.
Work that creates, changes or evaluates skills or their effective behavior also
uses the [local skill rubrics](docs/qualities/README.md), including applicable
behavioral proof under [AW-SK-EV4](docs/qualities/skill-evidence.md#aw-sk-ev4).
[Authoring guidance](docs/skill-authoring-guidance.md) explains those choices.
These requirements govern this package, not repositories installing it.

Edit [shared writing guidance](docs/writing-guidance.md) and record formats in
[docs/guidance](docs/guidance), then regenerate their skill-local references:

```sh
node tools/generate-writing-references.mjs
```

Both marketplace catalogs install the generated `plugins/peer` directory.
Edit the authoring files at the repository root, then regenerate and commit
the payload with them:

```sh
node tools/generate-plugin.mjs
```

The generator copies the runtime files selected in
[plugin-payload.mjs](tools/lib/plugin-payload.mjs), preserving their bytes and
executable modes. It excludes Git metadata, tests and authoring-only tools,
and refuses links in selected source paths or existing output. Do not edit
`plugins/peer` directly. Linked development installations continue to use the
authoring checkout.

## Verify

```sh
node tools/verify.mjs                   # complete local gate
node tools/validate.mjs                 # skill metadata
node tools/generate-writing-references.mjs --check
node tools/generate-plugin.mjs --check   # generated payload membership, bytes and modes
node tools/generate-vendor.mjs --check  # needs npm and registry access or --cache
node --test                             # offline tool and harness tests
```

The complete gate checks metadata, generated writing references, the vendored
dependencies, native plugin declarations, generated payload parity, package
links and all offline tests. Runtime references must also resolve inside the
installed payload. It does not require personal skill installation.
`install.mjs check [<set>]` additionally checks personal links and hook definitions.
The [behavioral suites](tests/skills/README.md) document paid model runs started
separately; offline checks do not establish model behavior.

## Commit gate

Commits follow [conventional-commit guidance](docs/guidance/conventional-commits.md).
Install the repository hook once per clone:

```sh
node tools/install-hooks.mjs
```

Each commit attempt lints the message and runs the complete local gate. The hook
tests the working checkout; when staging only part of a change, ensure the
staged change is complete. `node tools/commit-verify.mjs <message-file>` runs the
same gate directly. Git commit hooks are separate from the agent support hooks.

## Workflow references

| Reference | Owns |
| --- | --- |
| [Process](workflow/PROCESS.md) | Roles, phases, execution releases and landing |
| [Review](workflow/REVIEW.md) | Quality allocation, seats, rounds, findings and severity |
| [Adjudication](workflow/ADJUDICATION.md) | Independent assessment and paired reconciliation |
| [Orca mapping](workflow/ORCA.md) | Configuration, runtime mapping and worker communication |
| [Binding](workflow/BINDING.md) | Local source maps, readiness and snapshots |
| [Records](workflow/RECORDS.md) | Retained state, evidence, scratch and templates |

## License

Released under the [MIT License](LICENSE).
