# Research: Superpowers' skill-writing practices

Superpowers' strongest transferable technique is to make skill authoring answer to an observed failure: reproduce the behavior without the proposed guidance, choose an instruction form suited to that failure, and compare repeated trials in realistic context. Its maintenance record is especially useful because it includes corrections to empirical claims, unsuccessful experiments, and the removal of process that did not earn its cost. **Recommendation:** our greatest opportunity is to apply that method to source fidelity and evidence-backed completion in the writing skills: require a draft's actor, scope and strength of claim to survive comparison with its source, then measure whether the smallest change improves that behavior without losing brevity or necessary qualification.

This is source inspection, not a benchmark. I read pinned source, supporting material and the author's accounts; I did not install Superpowers, execute its scripts, run its evals, or measure our skills. Reported upstream outcomes remain upstream reports, often small trials on particular models and fixtures. Neither forceful language nor an attractive workflow proves adherence. This report changes no local rules, review seats, acceptance authority, test criteria or execution release.

The labels distinguish **Explicit** guidance the sources state, **Observed** construction or maintenance evidence visible in them, and **Recommendation** adaptations for this repository. An observation about a script means inspection of its implementation, not a runtime verification.

## Scope and source baseline

Sources were read on **2026-10-15**. The core population is the 15 skills listed in the [main README][sp-readme], under the conventional Claude plugin `skills/` layout and the Codex manifest's explicit `./skills/` path. The historical repository's documented category tree defines a separate population; it is not an additional set installed by version 7. The authoring companion's two promoted skills and two example skills are also counted separately. A recursive inventory checked those populations for omissions; it did not define which files were promoted.

| Source and pinned default-branch revision | Population inspected | Invocation or entry mode at this source pin | `SKILL.md` lines / words |
|---|---|---|---:|
| [obra/superpowers][sp-root], `bb92a77741419a4ab5f06e711a283343f1ada0c3`, 2026-10-09; tag and plugin **7.0.0** | 15 promoted skills | All have name/description metadata without invocation-restricting flags; contextual selection or explicit invocation. The meta-skill is also bootstrapped on supported platforms. | 3,828 / 24,922 |
| [obra/superpowers-marketplace][market-root], `2cf27fa76667afa0ba724ad8141a6938a3834e32`, 2026-10-10; registry **1.0.13** | Registry, no skill bodies | Distribution catalogue; points to core 7.0.0 and the authoring companion | 0 / 0 |
| [obra/superpowers-skills][old-root], `cdcd624ad3fd8026deb692e565351854569798dd`, 2025-10-14 | 31 historical skills | Earlier bootstrap/search/read workflow, including `when_to_use` metadata; not current native invocation policy | 5,567 / 24,091 |
| [obra/superpowers-developing-for-claude-code][dev-root], `74afe935da49efe782907e837a27ce618498099a`, 2025-12-03; **0.3.1** | 2 promoted skills; 2 example skills | Contextual authoring/reference use; example modes are illustrative, not verified installations | 458 / 1,876 promoted; 122 / 657 examples |
| [prime-radiant-inc/superpowers-evals][eval-root], `e64684cd1fa270c464ac797747e45bbe8d127e8b`, 2026-09-11 | Selected authoring, micro-test and experiment documentation; no `SKILL.md` | Eval authoring/reference, not a promoted plugin skill population | Not included |

**Observed:** the core median is **225 lines / 1,269 words**, ranging from 65–681 lines and 425–4,871 words. These are newline and whitespace-word counts, including frontmatter and examples, not token measurements. They exclude loaded references, prompts, scripts and chained skills. The core `skills/` subtree alone contains 434,823 bytes, compared with the bodies' much smaller combined footprint. A short entry point is not necessarily a short invocation.

All **50 `SKILL.md` files** across those populations were read. Supporting inspection covered the core's skill references and templates, hooks and platform adapters, scripts as text, authoring/testing/porting guidance, release notes, and relevant design and history records. The companion contributes plugin examples, templates and a bundled documentation snapshot. The eval repository contributes measurement design, not a reproduced campaign. Other independently distributed marketplace products, the development branch, every historical implementation plan, and every eval scenario are outside this population. The Codex packaging script preserves metadata from an external distribution seed; that published package was not audited, so the table describes this source tree rather than every installed distribution.

Seventeen accompanying blog articles were read, from the September 2025 workflow account through October 2026. URLs, dates and brief extracts, source manifests, measured inventories, selected history patches and official-engine documentation references are retained with the investigation evidence. No separately cited talk or thread was identified in the README/release-note source trail. Superpowers and the authoring companion declare the **MIT licence**; this report attributes their mechanisms and does not vendor their skills. See the [core licence][sp-license].

## What the accompanying writing adds

**Explicit:** the [October 2025 introduction](https://blog.fsck.com/2025/10/09/superpowers/) explains why knowledge quizzes were insufficient: agents could recite a technique yet abandon it under pressure. That motivates action scenarios with time, sunk-cost and authority pressures. Its retrospective also acknowledges that much extracted advice described behavior the model already performed. This supports testing the need for a rule before polishing it; it does not establish that every pressured departure is wrong.

**Observed:** the [plugin-naming experiments](https://blog.fsck.com/2025/10/23/naming-claude-plugins/) are a useful counterweight to confident prompt folklore. Initial naming effects changed on repetition, and a scenario framed as requiring an interactive tool admitted a simpler noninteractive solution. **Recommendation:** a test must require the intended behavior for a real task reason. A skill invocation is not itself a quality improvement when the task can be completed correctly without it.

**Explicit:** the [early Codex port](https://blog.fsck.com/2025/10/27/skills-for-openai-codex/) describes an agent stalled by an instruction to use a tool it did not have. The [OpenCode account](https://blog.fsck.com/2025/11/24/Superpowers-for-OpenCode/) similarly treats loading and tool mapping as porting work. These are historical accounts, not current installation instructions. They make a durable point: an abstractly clear workflow can fail at its first unavailable action.

**Observed:** the [version 6 account](https://blog.fsck.com/2026/06/15/Superpowers-6/) corrected a cost comparison after an older installed skill contaminated the intended baseline. Its linked experiment record also distinguishes savings from prompt construction, model selection and fixture changes. **Recommendation:** pin the loaded bytes and execution environment, not just the repository under discussion. Published cost percentages are not evidence of savings for our suite.

**Explicit:** [Dorodango](https://blog.fsck.com/2026/02/10/dorodango/) and [Greenfield and Iterative Development](https://blog.fsck.com/2026/04/24/greenfield-and-iterative-development/) expose the mismatch between elaborate greenfield planning and incremental changes. The [version 7 retrospective](https://blog.fsck.com/2026/10/09/what-a-year/) puts understanding the user's intent ahead of presenting an implementation menu. The current brainstorming skill reflects that change. The opportunity here is proportionate clarification, with known answers retained, rather than a universal longer interview.

**Observed:** [Agentic slop PRs](https://blog.fsck.com/2026/03/31/slop-prs/) describes policy left in a pull-request template that CLI-driven contributors did not encounter. Moving guidance to an actual entry point addresses exposure. It does not turn exposure into permission or prove compliance. The [skills announcement](https://blog.fsck.com/2025/10/16/skills-for-claude/) and [MCP design essay](https://blog.fsck.com/2025/10/19/mcps-are-not-like-other-apis/) supply the broader rationale for progressive disclosure: give the agent enough information to select a capability, then load the instructions it needs.

## Rules we should adopt or adapt

### 1. Establish a discriminating baseline before writing a remedy

**Explicit:** [writing-skills][sp-writing] asks for a failure without the skill, a minimal intervention, and retesting under pressure. Its newer micro-test section requires a no-guidance control, realistic surrounding instructions, repeated fresh contexts and manual inspection of flagged results. **Observed:** the [cost experiment record][eval-cost] declines a proposed placeholder remedy when the baseline does not exhibit the alleged failure.

**Recommendation:** name the source-fidelity or output failure, then demonstrate it under our existing suite before changing prose. A control that already succeeds cannot show the proposed rule helped. Preserve failed and inconclusive candidates as evidence so another pass does not purchase the same unsupported idea.

### 2. Match instruction form to the failure

**Explicit:** writing-skills distinguishes discipline slips, wrong output shape, omitted fields and conditional behavior. It recommends a boundary for the first, a positive recipe for the second, a required slot for the third, and an observable predicate for the fourth. **Observed:** its cited wording trials are narrow dispatch-prompt experiments; follow-up commits explicitly soften overbroad empirical claims.

**Recommendation:** test a source comparison step for attribution drift, an explicit evidence field for omitted receipts, and a condition such as unresolved audience affecting content for clarification. Do not turn this into a ban on negative wording: prohibition of unauthorized acceptance or editing is a real role boundary. Nor should a required field force a long visible checklist into every short answer.

### 3. Make descriptions route to the procedure

**Explicit:** writing-skills warns that a description summarizing a workflow can become a shortcut that replaces reading the body. It favors trigger conditions. **Observed:** its historical example concerns a two-review workflow; version 7's SDD now uses one task reviewer with two verdicts. The example illustrates a failure hypothesis, not today's reviewer count.

**Recommendation:** descriptions should identify when the skill changes the work and exclude neighboring scopes where needed. Test selection and actual loading separately. Do not remove every capability word merely to satisfy a trigger-only slogan: current official discovery guidance and the bundled authoring reference also use descriptions to explain what a skill does.

### 4. Put the required action at the point of use

**Observed:** maintenance removed repeated integration lists and recaps, while retaining unique requirements at the step where they matter. The [July recap removal][history-recap] deletes material that restated earlier instructions; the [current debugging skill][sp-debug] places verification in its fix-verification step.

**Recommendation:** keep one authoritative requirement and an explicit conditional load where its dependency becomes necessary. Follow the approved local ownership and shared-reference structure; do not import Superpowers' full chain of skill-to-skill invocations. A shorter file is beneficial only if the necessary action remains discoverable and performed.

### 5. Tie a claim to evidence that proves that particular claim

**Explicit:** [verification-before-completion][sp-verification] requires identifying the proving command, running it, reading the result and checking whether it supports the claim. It distinguishes a passing linter from a successful build and an agent's report from independently checked work.

**Recommendation:** adapt the sequence to writing: identify the claim, locate its authoritative source, compare actor/scope/strength, then state only what is supported. For reviewed candidates, use evidence tied to the exact candidate and relevant check. Do not require each reviewer to rerun a paid suite or mistake freshness for needless duplication; our existing evidence and acceptance rules govern that decision.

### 6. Recheck support after transforming evidence

**Explicit:** [diagnosing-superpowers][sp-diagnose] separates redaction from the final claim audit. After scrubbing, citations must still support the report; a valid path and line number are insufficient. Removed evidence must cause a limitation or claim change rather than an unsupported conclusion.

**Recommendation:** apply the same principle after summarizing, narrowing or rephrasing source material. A sentence can retain a citation while changing who made a decision, whether it was accepted, or how broadly it applies. This is a particularly concrete mechanism for the source-attribution gate already accepted here, rather than a new requirement to trust the presence of links.

### 7. Brief a fresh worker with its contract and necessary context

**Explicit:** [SDD][sp-sdd] gives workers the complete task brief, relevant interfaces, global constraints, current context and expected return. Fresh workers avoid inheriting the controller's entire history. Implementers return a bounded status plus an artifact path; reviewers receive a prepared evidence package.

**Recommendation:** retain our dispatch identities, sole-writer scope, candidate identity, evidence paths and role-specific return contract. Compress narration and repeated history, not the constraints a worker cannot reconstruct. Verify the actual dispatch contains required context; a template that exists but is not supplied cannot help.

### 8. Encode mechanical invariants in tools; keep judgments with their owner

**Observed:** SDD scripts locate per-plan artifacts, check commit-range ancestry and reject empty review ranges. A completion helper records progress only after a supplied command exits successfully. These are narrower guarantees than correct implementation or acceptance.

**Recommendation:** use tools for artifact identity, required-field presence and evidence integrity where authorized; keep sufficiency, severity, source meaning and acceptance with their designated actors. A green command cannot decide that the command was appropriate. A controller's desire to proceed cannot replace an operator decision.

### 9. Make questions expose consequential uncertainty

**Explicit:** [brainstorming][sp-brainstorm] now asks about intent before supplying options, distinguishes chosen defaults from agreed requirements, and uses a fresh builder's questions to find missing decisions. The controller screens questions already answered or delegated as routine implementation choices.

**Recommendation:** strengthen clarify-artifact's use of available context and its test for whether an answer would change the artifact. Preserve already settled premises and existing authorization. Use a builder-style sufficiency check as a hypothesis to test, not a new mandatory subagent or approval round.

### 10. Preserve exact decisions while removing unnecessary implementation

**Observed:** the [September writing-plans change][history-plans] replaces complete routine function bodies with exact signatures, required values, test assertions and a rationale only where a choice remains. It replaces time-sized steps with steps having a checkable result.

**Recommendation:** shorten agent briefs by removing implementation the recipient can determine, while preserving externally decided names, boundaries, outputs and checks. For human writing, keep the result and the conditions needed to interpret it. Concision must not silently convert a proposal into an accepted decision or erase an exception.

### 11. Test the plausible wrong answer, not just the happy path

**Explicit:** the [eval authoring guide][eval-authoring] requires checks that distinguish a root-cause fix from a symptom patch and warns about ordering checks that pass vacuously when the later action never happens. It separates invalid fixtures and capture failures from behavioral failure.

**Recommendation:** include source-backed but overstrong summaries, correct-looking output missing a dependency, a cited passage that supports another actor, and a skill mentioned but never read. A test that cannot fail these plausible wrong answers cannot establish the proposed mechanism's effect.

### 12. Treat maintenance as falsification as well as accumulation

**Observed:** Superpowers' record includes removed review loops, abandoned wording remedies, corrected cost estimates, and a later targeted check that differs from the removed broad review. More rules are not automatically a better process.

**Recommendation:** preserve the reason and evidence for each local change, compare the smallest authorized unit, and retire redundancy only when retained behavior is demonstrated. No upstream experiment authorizes changing our standing engines, replicas, criteria or gates.

## Close readings: why small details matter

**Observed — a required slot versus nearby advice.** In the [SDD cost experiments][eval-cost], putting model selection in the dispatch structure succeeded where advice allowed expensive defaults. That is an omission problem: the field creates an action location. The same record reports that smaller prompts did not deliver the initially expected cost savings. Structure can improve handoff fidelity without proving a billing benefit.

**Observed — the baseline of a review matters.** SDD records the base commit before a task starts, and its [package helper][sp-review-package] checks a nonempty ancestral range. By contrast, the general requesting-code-review example still offers `HEAD~1` as one possible base. For a multi-commit task those are different scopes. **Recommendation:** our reviews must continue to name the exact candidate and comparison base; a convenient command example cannot choose their scope.

**Observed — a file is not automatically the whole brief.** The [task-brief script][sp-task-brief] extracts a task section while avoiding heading-like text inside code fences. Global constraints are a separate controller responsibility. This division makes a useful audit question: did the worker receive both the task and its governing constraints? It also shows why output-file existence alone is a weak check.

**Explicit — a source mismatch is a finding.** The diagnosis prompts establish which transcript represents the requested session, distinguish human input from parent-agent messages, and report coverage and uncertainty. They do not equate skill involvement with causation. **Recommendation:** preserve those distinctions when attributing an instruction or explaining a failed test; a message's grammatical role does not establish its decision authority.

**Observed — brevity targets are not descriptions of the corpus.** Writing-skills offers word-budget heuristics, yet is 3,814 words itself; using-superpowers is 492 words before its platform references. Its bundled best-practices document uses other size guidance. These are authoring heuristics with different contexts, not measured optimal limits. Measure the loaded path and the resulting behavior.

**Observed — internal guidance can disagree.** The pressure-testing reference exempts pure reference material from its behavior-testing loop, while the main writing skill discusses retrieval/application checks for reference skills. The old persuasion material cites broad compliance research, but that is not evidence that its rhetoric improves engineering outcomes here. Neither discrepancy warrants importing a blanket testing exemption or universal persuasion rule.

## Mandatory use and verification machinery

The system combines discovery metadata, context injection, imperative instructions and a few deterministic helpers. Calling the whole combination enforced would obscure where an agent can still depart from it.

| Mechanism | Explicit instruction or observed implementation | Actual boundary of the mechanism |
|---|---|---|
| [using-superpowers][sp-using] | Check relevant skills before action or response, load them, announce use, prioritize process skills | Prose controls agent behavior only if followed. Its first exception tells an already dispatched worker with a specific task to skip this controller-oriented bootstrap. |
| [Claude SessionStart hook][sp-hooks] and [bootstrap script][sp-bootstrap] | Hook runs at startup, clear and compact; script emits the meta-skill and loading prelude as context | Automates exposure. It does not intercept every action, validate approval or prove that another skill was loaded. |
| Platform adapters | Pi injects context in its lifecycle; Hermes registers skill descriptions; OpenCode distinguishes child sessions and skips controller bootstrap there | Platform-specific registration and injection. Source inspection does not prove identical runtime behavior on all versions. |
| Codex source manifest | Explicit skills directory and empty `hooks` object | Current source relies on native discovery; old Codex bootstrap instructions and release notes do not establish a live SessionStart hook. |
| [Verification skill][sp-verification] | Match a completion claim to fresh, relevant evidence before making it | A prose gate, not an executable judge of whether the evidence proves the claim. |
| [Brainstorming][sp-brainstorm] | Understand intent, choose proportionate depth, expose assumptions, obtain the applicable approval before implementation; explicit opt-out and spike paths exist | The gate is represented in text. The browser companion presents material and records interaction; it does not decide the semantic scope of approval. |
| [SDD][sp-sdd] and [execution][sp-execute] | Task briefs, constrained implementer returns, scoped review, progress ledger, bounded fix rounds and controller decisions | Scripts can validate paths/ranges/exit codes. Role adherence, review sufficiency and whether to proceed remain instructions and judgments. |

**Explicit:** verification's insistence on a new command before a success claim protects against stale evidence. **Recommendation:** transfer its claim-to-proof discipline while respecting our evidence reuse rules. Repeatedly running an unchanged suite is not inherently stronger evidence, and a reviewer here must not manufacture fresh implementation work to satisfy a literal slogan.

**Explicit:** current SDD uses one task reviewer that returns separate specification and quality verdicts; it restricts reviewer mutation, child delegation and redundant testing. Implementers return one of `DONE`, `DONE_WITH_CONCERNS`, `BLOCKED` or `NEEDS_CONTEXT`, with detail in a report file and a short controller-facing message. The controller prepares a task-specific review package and scopes later fix/review exchanges. **Observed:** the README still describes two-stage review in places; the pinned skill and templates define the current mechanism.

**Explicit:** SDD also gives its controller substantial authority to classify findings, park some issues and continue after bounded review loops, subject to named hard stops. That is an important non-transferable part of the design. Our four direct review seats, paired independent adjudicators and operator acceptance gate are different authorities, not verbose versions of the same workflow. Likewise, Superpowers' cleanup of transient ledgers does not replace our durable run-record policy.

**Recommendation:** make mandatory local skill use observable through the existing suite's read evidence and then evaluate the produced work. An announcement proves neither loading nor adherence. A loaded skill proves neither correctness nor permission. Do not treat Superpowers' asserted instruction hierarchy as the engine's actual hierarchy; platform and user instructions retain their real precedence.

## Maintenance history provides stronger evidence than style alone

| Evidence | Failure or uncertainty addressed | What the change supports—and does not prove |
|---|---|---|
| [Release notes][sp-releases], versions 2–4 | Repository split, native skill discovery, duplicated loading, workflow summaries substituted for bodies | Installation and selection are part of skill design. Historical loading commands are not current recommendations. |
| [November 2025 feedback draft][sp-feedback] | A successful response was mistaken for proof that the intended provider was active; mocks reproduced an implementation mistake | Reported failures motivate discriminating checks. Proposed remedies in this draft are not proof of current implementation or measured effectiveness. |
| Versions 5.0.1–5.0.6 | A review step omitted from a checklist/diagram was added; a broad review loop was later removed after reported trials showed overhead without quality gain | Parallel representations drift; a repaired checklist can still encode an unhelpful step. The later version-7 builder check is a narrower question, not proof the old loop should return. |
| [June wording corrections][history-scope] and [second correction][history-trend] | The original explanation overstated a small experiment | Claims were narrowed to dispatch-prompt tests, noise was acknowledged, and a control comparison became a trend. This is evidence for careful attribution, not a general causal law about negation. |
| [June experiment record][eval-cost] | Cost attribution, ineffective constraints, missed defects and false matches | Failures receive space alongside successes. Whole-run success could conceal a weak reviewer; fixture changes could explain apparent savings. |
| [July per-plan workspace change][history-workspace] and [eval write-up][sp-workspace-eval] | A subsequent plan could encounter artifacts from an earlier plan | Structural separation reduces reliance on recognizing stale state. The tested baseline already rejected stale ledgers; the write-up does not demonstrate a previously measured unsafe-adoption rate. |
| Versions 6.3–6.4.1 | Duplicate worker-spawned review, repeated fix context, empty diff ranges, incomplete inline execution guidance, artifact collisions | Name ownership, scope evidence and implement the actual path. These repairs do not grant our workers new delegation or acceptance rights. |
| [September plan rewrite][history-plans] | Plans repeated implementation instead of conveying decisions | Exact interfaces and assertions survive while routine bodies disappear. Reported probe results are upstream evidence, not our measured writing improvement. |
| [Version 7 brainstorming rewrite][history-brainstorm] | Process and menus could precede understanding what the user wanted | Intent and consequential defaults move earlier. A concise skill can still require a meaningful sufficiency check. |

**Observed:** the historical `superpowers-skills` tree helps distinguish removal from relocation. Testing-skills-with-subagents, root-cause tracing, condition-based waiting and related techniques survive as supporting material in the core; not every useful procedure needs its own discoverable skill. Other historical utilities are absent from the current core. The authoring companion's bundled official documentation is a dated snapshot, so it is evidence of the author's reference strategy rather than current engine authority.

## Multi-engine and orchestrated adaptation

### Discovery, loading and permission are separate concerns

**Observed, checked against official documentation on 2026-10-15:** Codex exposes discovery metadata before loading a skill's full instructions; invocation can be explicit or inferred. `agents/openai.yaml` can disable implicit invocation without disabling explicit use. This source pin's frontmatter therefore cannot describe all externally packaged Codex policy. [Official Codex skill documentation](https://learn.chatgpt.com/docs/build-skills).

**Observed, checked against official documentation on 2026-10-15:** Claude Code defaults to user and model invocation. `disable-model-invocation` and `user-invocable` control different access paths. Conventional plugin skill paths support discovery, while SessionStart can add context. Those facilities do not by themselves certify task completion. [Claude Code skills](https://code.claude.com/docs/en/skills), [plugin reference](https://code.claude.com/docs/en/plugins-reference), [hooks reference](https://code.claude.com/docs/en/hooks).

**Recommendation:** test three questions separately: could the engine discover the skill, did it load the required instructions, and was the contemplated action authorized? Then test adherence and output quality. A successful forced-load case answers neither implicit discovery nor permission. A hook making instructions visible is not a bypass around tool approval or the operator gate.

### What transfers, what needs adaptation, and what to leave behind

**Recommendation — transfer:** failure-driven authoring, precise handoffs, source-backed claims, condition-specific loading, independent review evidence, useful negative results, and checking the exact artifact under discussion.

**Recommendation — adapt:** map actions to the tools actually available in each dispatched environment; preserve source/candidate/dispatch identities; use durable records and the live Orca lifecycle; keep test reuse within our binding. The [porting guide][sp-porting] rightly treats tool mappings as implementation work, but its general bootstrap ideal is qualified by actual platform code and the Codex manifest. Runtime capability evidence outranks a stale universal tool recipe.

**Recommendation — leave behind:** global installation and update recipes, automatic commits or publishing, blanket approval repetition, a universal 1% relevance threshold, controller acceptance authority, historical forced destructive-test rituals, and model choices from unrelated experiments. Do not copy a graph into a skill and call it a state machine: the DOT diagrams are instructions for readers, not an execution engine.

## Concrete opportunities in our current skills

These are **Recommendations**, not edits or a replacement plan. They are grounded in the current local skills and the existing ownership model. Several mechanisms already exist; the opportunity is to test their weakest boundary, not restate them everywhere.

| Local skill | Recommendation | Predicted observable difference |
|---|---|---|
| [plan-coordinator](../../skills/plan-coordinator/SKILL.md) | Audit the dispatch contract for candidate identity, role ownership, necessary global constraints and expected evidence; preserve all review seats and the operator gate | Fresh workers receive sufficient context without inheriting the whole conversation; an upstream controller shortcut never becomes local acceptance |
| [plan-responsible-party](../../skills/plan-responsible-party/SKILL.md) | Couple each readiness claim to the authorized change and matching verification artifact; distinguish completed work from unresolved acceptance | A narrow task returns a concrete candidate with named gaps, without widening scope or claiming the operator accepted it |
| [plan-reviewer](../../skills/plan-reviewer/SKILL.md) | Make checked evidence and coverage limits easy to distinguish from inference; retain the no-edit, no-delegation and evidence-reuse boundaries | A plausible report or unrelated green check cannot produce a pass; missing evidence remains explicit |
| [review-adjudicator](../../skills/review-adjudicator/SKILL.md) | Preserve independent initial judgments and bind each reconciliation to the finding and candidate; report uncertainty without controller-style unilateral closure | Peer agreement does not erase an unsupported premise or acquire operator authority |
| [write-for-humans](../../skills/write-for-humans/SKILL.md) | Test a compact comparison of source actor, scope and strength immediately before final wording; keep the result first | A short, polished answer retains whether a decision was proposed, accepted or conditional, without appending a ritual checklist |
| [write-for-agents](../../skills/write-for-agents/SKILL.md) | Test whether a fresh recipient can identify allowed actions, dependencies, decision owners and end conditions from the brief | Compression removes narration while preserving constraints; an incomplete dependency or invented permission stays visible |
| [clarify-artifact](../../skills/clarify-artifact/SKILL.md) | Reuse settled context; ask only unresolved questions whose answers materially change content; screen fresh-reader concerns against supplied premises | The skill asks about consequential ambiguity while leaving complete, sufficiently specified requests actionable |
| [record-decision](../../skills/record-decision/SKILL.md) | Preserve the real decision owner, acceptance state, alternatives and reasons when compressing a record; retain its existing record/offer threshold | A suggested option does not become an accepted decision; an explicit request is still honored without unnecessary threshold debate |
| [maintain-glossary](../../skills/maintain-glossary/SKILL.md) | Check proposed definitions against source usage and ownership; separate ambiguity from permission to normalize terminology | Distinct meanings remain distinct, and unresolved ownership is reported instead of silently settled |

## How to determine whether the rules actually help

**Recommendation:** use the repository's [existing skills-suite method](../../tests/skills/README.md) as the measurement. Keep the standing two-engine, three-replica regime, frozen inputs and recorded engine identities. Under the current cycle's rules, only designated certifying criteria can justify candidate rewrites; observation-only quality signals remain observations. The upstream micro-test recommendation of five or more repetitions is not authority to replace that regime or run a new campaign here.

Start from the measured local failure and change the smallest authorized unit. Preserve the prompt, fixture, materialized skill bytes, dependencies, capture and grader inputs. Distinguish a premise that was not met or an environment failure from a behavioral failure. Inspect the actual artifact and transcript; listing or mentioning a file is not reading it. Retain the suite's distinction between regrading an existing artifact, a justified transport retry and a new behavioral sample.

| Proposed mechanism | Cases it predicts should discriminate | Evidence needed |
|---|---|---|
| Source comparison before final wording | Actor substitution, proposal turned into obligation, narrower evidence generalized, qualification removed | Semantic comparison with the authoritative source, including scope and strength; citation presence alone is insufficient |
| Required evidence slot | Readiness claimed with a missing dependency or irrelevant successful check | Correct candidate identity, relevant receipt and an honest gap; a filled field alone is insufficient |
| Positive output recipe | Concise but complete reply, result-first explanation, mixed human/agent artifact sections | Preserved essential content and correct audience treatment across verbosity settings |
| Conditional clarification | Settled context, contradictory premises, missing source material, consequential unresolved audience | Necessary questions asked and unnecessary ones avoided, without discarding known constraints |
| Explicit loading at the relevant step | Skill named but unread; reference needed only on one branch | Actual read/load evidence before the dependent action, plus correct output; forced loading is not a discovery test |
| Precise fresh-worker contract | Worker given a narrow task with cross-task constraints or missing evidence | Scope adherence, sufficient context, correct return artifact and preserved decision ownership |

These predictions connect to the existing writing and clarification cases; they do not assert that new fixtures or certified cases already exist. Count success only when the intended behavior improves under the approved criteria, and check the relevant regressions. Report quality, verbosity and cost separately. The [upstream experiment record][eval-cost] warns that session duplication, quoted counterexamples, fixture differences and controller rescue can all make a simple aggregate misleading.

## Comparison with the Pocock findings

**Observed:** the [Pocock analysis](matt-pocock-skill-writing.md) and this corpus agree on routing descriptions, deliberate loading, bounded artifacts, observable end conditions, positive instructions with essential boundaries, and keeping deterministic mechanics in tools. Both favor concise context that preserves decisions and dependencies.

They differ in emphasis and construction. Pocock's measured population had 27 promoted skills, including 16 user-only entries and 11 model-invocable entries, with a median of 71 lines. Superpowers' 15 current bodies have no such frontmatter split and a median of 225 lines, embedded in a more connected coding workflow with bootstrap adapters, pressure testing and review machinery. Neither comparison controls for task scope or loaded dependencies, so it cannot establish which set is more efficient.

Superpowers adds unusually useful failure and maintenance evidence. It also complicates simple style rules: a prohibition can protect a discipline boundary while a recipe better shapes an output; strong initial process may later be removed; a small body can depend on extensive material; exact test assertions can remain after full implementation bodies disappear. **Recommendation:** carry forward the Pocock report's behavioral pruning and ownership principles, using Superpowers' experimental discipline to decide which local changes earn adoption.

## Inventory of every skill read

The constructions below are **Observed**. Modes describe the pinned source, not verified installation behavior. **Context/explicit** means contextual selection or explicit invocation without source frontmatter disabling either; **bootstrap** means special lifecycle exposure where supported. Historical **search/read** describes the old documented loader, not native engine policy. Counts above include the two companion examples; they are not promoted core skills.

### Current core: 15 promoted skills

| Skill | Mode | Most relevant construction |
|---|---|---|
| [brainstorming](https://github.com/obra/superpowers/blob/bb92a77741419a4ab5f06e711a283343f1ada0c3/skills/brainstorming/SKILL.md) | Context/explicit | Intent before options; explicit defaults; proportionate depth and a screened builder check. |
| [diagnosing-superpowers](https://github.com/obra/superpowers/blob/bb92a77741419a4ab5f06e711a283343f1ada0c3/skills/diagnosing-superpowers/SKILL.md) | Context/explicit | Session identity, scoped analysts, evidence citations, independent redaction and post-redaction support audit. |
| [dispatching-parallel-agents](https://github.com/obra/superpowers/blob/bb92a77741419a4ab5f06e711a283343f1ada0c3/skills/dispatching-parallel-agents/SKILL.md) | Context/explicit | Independent problem domains, narrow briefs, expected returns and integration review. |
| [executing-plans](https://github.com/obra/superpowers/blob/bb92a77741419a4ab5f06e711a283343f1ada0c3/skills/executing-plans/SKILL.md) | Context/explicit | Inline execution with task-start/task-done artifacts, progress ledger and final review. |
| [finishing-a-development-branch](https://github.com/obra/superpowers/blob/bb92a77741419a4ab5f06e711a283343f1ada0c3/skills/finishing-a-development-branch/SKILL.md) | Context/explicit | Three normal completion choices; deletion only on explicit request; cleanup follows workspace ownership. |
| [receiving-code-review](https://github.com/obra/superpowers/blob/bb92a77741419a4ab5f06e711a283343f1ada0c3/skills/receiving-code-review/SKILL.md) | Context/explicit | Verify technical feedback before acting; distinguish unclear feedback from a supported objection. |
| [requesting-code-review](https://github.com/obra/superpowers/blob/bb92a77741419a4ab5f06e711a283343f1ada0c3/skills/requesting-code-review/SKILL.md) | Context/explicit | A scoped brief with base/head, requirements and review-only instructions. |
| [subagent-driven-development](https://github.com/obra/superpowers/blob/bb92a77741419a4ab5f06e711a283343f1ada0c3/skills/subagent-driven-development/SKILL.md) | Context/explicit | Fresh task workers, complete briefs, report files, one task reviewer with two verdicts, bounded fixes. |
| [systematic-debugging](https://github.com/obra/superpowers/blob/bb92a77741419a4ab5f06e711a283343f1ada0c3/skills/systematic-debugging/SKILL.md) | Context/explicit | Root-cause investigation before fixes; hypothesize and test; reconsider architecture after repeated failures. |
| [test-driven-development](https://github.com/obra/superpowers/blob/bb92a77741419a4ab5f06e711a283343f1ada0c3/skills/test-driven-development/SKILL.md) | Context/explicit | Demonstrate the intended failure before implementation; tests exercise real behavior. |
| [using-git-worktrees](https://github.com/obra/superpowers/blob/bb92a77741419a4ab5f06e711a283343f1ada0c3/skills/using-git-worktrees/SKILL.md) | Context/explicit | Recognize existing/native isolation first; directory choice and baseline checks precede work. |
| [using-superpowers](https://github.com/obra/superpowers/blob/bb92a77741419a4ab5f06e711a283343f1ada0c3/skills/using-superpowers/SKILL.md) | Bootstrap where supported; context/explicit | Bootstrap relevance check with a dispatched-worker exception and platform tool references. |
| [verification-before-completion](https://github.com/obra/superpowers/blob/bb92a77741419a4ab5f06e711a283343f1ada0c3/skills/verification-before-completion/SKILL.md) | Context/explicit | Claim-specific proof before success language; common evidence substitutions called out. |
| [writing-plans](https://github.com/obra/superpowers/blob/bb92a77741419a4ab5f06e711a283343f1ada0c3/skills/writing-plans/SKILL.md) | Context/explicit | Exact interfaces, global constraints and assertions; routine implementation left to the implementer. |
| [writing-skills](https://github.com/obra/superpowers/blob/bb92a77741419a4ab5f06e711a283343f1ada0c3/skills/writing-skills/SKILL.md) | Context/explicit | Baseline-driven authoring, routing descriptions, form matched to failure, micro-tests and pressure tests. |

### Historical library: 31 skills

| Skill (category/name) | Mode | Most relevant construction |
|---|---|---|
| [architecture/preserving-productive-tensions](https://github.com/obra/superpowers-skills/blob/cdcd624ad3fd8026deb692e565351854569798dd/skills/architecture/preserving-productive-tensions/SKILL.md) | Historical search/read | Retain valid competing approaches and name the contexts that select them. |
| [collaboration/brainstorming](https://github.com/obra/superpowers-skills/blob/cdcd624ad3fd8026deb692e565351854569798dd/skills/collaboration/brainstorming/SKILL.md) | Historical search/read | Questions, alternatives and incrementally reviewed design; earlier, simpler workflow. |
| [collaboration/dispatching-parallel-agents](https://github.com/obra/superpowers-skills/blob/cdcd624ad3fd8026deb692e565351854569798dd/skills/collaboration/dispatching-parallel-agents/SKILL.md) | Historical search/read | Separate independent domains and give each worker a bounded task. |
| [collaboration/executing-plans](https://github.com/obra/superpowers-skills/blob/cdcd624ad3fd8026deb692e565351854569798dd/skills/collaboration/executing-plans/SKILL.md) | Historical search/read | Execute three-task batches with human checkpoints; differs from current inline execution. |
| [collaboration/finishing-a-development-branch](https://github.com/obra/superpowers-skills/blob/cdcd624ad3fd8026deb692e565351854569798dd/skills/collaboration/finishing-a-development-branch/SKILL.md) | Historical search/read | Four-option completion menu including discard; current menu changed. |
| [collaboration/receiving-code-review](https://github.com/obra/superpowers-skills/blob/cdcd624ad3fd8026deb692e565351854569798dd/skills/collaboration/receiving-code-review/SKILL.md) | Historical search/read | Technical verification and pushback before implementation of feedback. |
| [collaboration/remembering-conversations](https://github.com/obra/superpowers-skills/blob/cdcd624ad3fd8026deb692e565351854569798dd/skills/collaboration/remembering-conversations/SKILL.md) | Historical search/read | Delegate history search and return relevant prior decisions with context. |
| [collaboration/requesting-code-review](https://github.com/obra/superpowers-skills/blob/cdcd624ad3fd8026deb692e565351854569798dd/skills/collaboration/requesting-code-review/SKILL.md) | Historical search/read | Review request template with implementation, requirements and commit range. |
| [collaboration/subagent-driven-development](https://github.com/obra/superpowers-skills/blob/cdcd624ad3fd8026deb692e565351854569798dd/skills/collaboration/subagent-driven-development/SKILL.md) | Historical search/read | Fresh implementer and review for each task; older contract and review structure. |
| [collaboration/using-git-worktrees](https://github.com/obra/superpowers-skills/blob/cdcd624ad3fd8026deb692e565351854569798dd/skills/collaboration/using-git-worktrees/SKILL.md) | Historical search/read | Directory preference, ignore checks, setup and clean baseline. |
| [collaboration/writing-plans](https://github.com/obra/superpowers-skills/blob/cdcd624ad3fd8026deb692e565351854569798dd/skills/collaboration/writing-plans/SKILL.md) | Historical search/read | Detailed task instructions with code and explicit test commands; later reduced. |
| [debugging/defense-in-depth](https://github.com/obra/superpowers-skills/blob/cdcd624ad3fd8026deb692e565351854569798dd/skills/debugging/defense-in-depth/SKILL.md) | Historical search/read | Layer validation where bad state can enter or propagate. |
| [debugging/root-cause-tracing](https://github.com/obra/superpowers-skills/blob/cdcd624ad3fd8026deb692e565351854569798dd/skills/debugging/root-cause-tracing/SKILL.md) | Historical search/read | Trace a failure backward to the initiating bad input. |
| [debugging/systematic-debugging](https://github.com/obra/superpowers-skills/blob/cdcd624ad3fd8026deb692e565351854569798dd/skills/debugging/systematic-debugging/SKILL.md) | Historical search/read | Four phases constrain premature fixes and shotgun attempts. |
| [debugging/verification-before-completion](https://github.com/obra/superpowers-skills/blob/cdcd624ad3fd8026deb692e565351854569798dd/skills/debugging/verification-before-completion/SKILL.md) | Historical search/read | Fresh command evidence before completion assertions. |
| [meta/gardening-skills-wiki](https://github.com/obra/superpowers-skills/blob/cdcd624ad3fd8026deb692e565351854569798dd/skills/meta/gardening-skills-wiki/SKILL.md) | Historical search/read | Audit naming, links, indexes and consolidation; maintenance checks as a workflow. |
| [meta/pulling-updates-from-skills-repository](https://github.com/obra/superpowers-skills/blob/cdcd624ad3fd8026deb692e565351854569798dd/skills/meta/pulling-updates-from-skills-repository/SKILL.md) | Historical search/read | Earlier update workflow with Git state handling; not permission for updates here. |
| [meta/sharing-skills](https://github.com/obra/superpowers-skills/blob/cdcd624ad3fd8026deb692e565351854569798dd/skills/meta/sharing-skills/SKILL.md) | Historical search/read | Separate contribution workflow for publishing a learned skill. |
| [meta/testing-skills-with-subagents](https://github.com/obra/superpowers-skills/blob/cdcd624ad3fd8026deb692e565351854569798dd/skills/meta/testing-skills-with-subagents/SKILL.md) | Historical search/read | Baseline and pressure scenarios; capture rationalizations and retest. |
| [meta/writing-skills](https://github.com/obra/superpowers-skills/blob/cdcd624ad3fd8026deb692e565351854569798dd/skills/meta/writing-skills/SKILL.md) | Historical search/read | TDD framing, discovery terms, reference layout and pressure testing. |
| [problem-solving/collision-zone-thinking](https://github.com/obra/superpowers-skills/blob/cdcd624ad3fd8026deb692e565351854569798dd/skills/problem-solving/collision-zone-thinking/SKILL.md) | Historical search/read | Deliberately combine distant concepts to expose useful alternatives. |
| [problem-solving/inversion-exercise](https://github.com/obra/superpowers-skills/blob/cdcd624ad3fd8026deb692e565351854569798dd/skills/problem-solving/inversion-exercise/SKILL.md) | Historical search/read | Reverse assumptions and inspect what the inversion reveals. |
| [problem-solving/meta-pattern-recognition](https://github.com/obra/superpowers-skills/blob/cdcd624ad3fd8026deb692e565351854569798dd/skills/problem-solving/meta-pattern-recognition/SKILL.md) | Historical search/read | Compare multiple domains to distinguish a reusable pattern. |
| [problem-solving/scale-game](https://github.com/obra/superpowers-skills/blob/cdcd624ad3fd8026deb692e565351854569798dd/skills/problem-solving/scale-game/SKILL.md) | Historical search/read | Vary scale dramatically to reveal hidden assumptions and limits. |
| [problem-solving/simplification-cascades](https://github.com/obra/superpowers-skills/blob/cdcd624ad3fd8026deb692e565351854569798dd/skills/problem-solving/simplification-cascades/SKILL.md) | Historical search/read | Find a simplifying insight that removes multiple components. |
| [problem-solving/when-stuck](https://github.com/obra/superpowers-skills/blob/cdcd624ad3fd8026deb692e565351854569798dd/skills/problem-solving/when-stuck/SKILL.md) | Historical search/read | Route a stuck state to a suitable problem-solving technique. |
| [research/tracing-knowledge-lineages](https://github.com/obra/superpowers-skills/blob/cdcd624ad3fd8026deb692e565351854569798dd/skills/research/tracing-knowledge-lineages/SKILL.md) | Historical search/read | Follow decisions, prior attempts and historical context before changing established practice. |
| [testing/condition-based-waiting](https://github.com/obra/superpowers-skills/blob/cdcd624ad3fd8026deb692e565351854569798dd/skills/testing/condition-based-waiting/SKILL.md) | Historical search/read | Wait for an observable condition instead of a guessed delay. |
| [testing/test-driven-development](https://github.com/obra/superpowers-skills/blob/cdcd624ad3fd8026deb692e565351854569798dd/skills/testing/test-driven-development/SKILL.md) | Historical search/read | Red–green–refactor and explicit checks against tests that never failed. |
| [testing/testing-anti-patterns](https://github.com/obra/superpowers-skills/blob/cdcd624ad3fd8026deb692e565351854569798dd/skills/testing/testing-anti-patterns/SKILL.md) | Historical search/read | Counterexamples for mock-driven assertions, production test hooks and incomplete mocks. |
| [using-skills](https://github.com/obra/superpowers-skills/blob/cdcd624ad3fd8026deb692e565351854569798dd/skills/using-skills/SKILL.md) | Earlier bootstrap/search/read | Earlier mandatory search/read startup protocol and skill naming conventions. |

### Authoring companion: two promoted skills and two examples

| Skill or example | Mode | Most relevant construction |
|---|---|---|
| [examples/full-featured-plugin/skills/workflow](https://github.com/obra/superpowers-developing-for-claude-code/blob/74afe935da49efe782907e837a27ce618498099a/examples/full-featured-plugin/skills/workflow/SKILL.md) | Illustrative contextual/explicit | Small numbered workflow showing how an example plugin skill is structured. |
| [examples/simple-greeter-plugin/skills/professional-greeting](https://github.com/obra/superpowers-developing-for-claude-code/blob/74afe935da49efe782907e837a27ce618498099a/examples/simple-greeter-plugin/skills/professional-greeting/SKILL.md) | Illustrative intended auto-discovery | Worked greeting behavior and examples; body lacks YAML frontmatter, so native discovery is not established. |
| [skills/developing-claude-code-plugins](https://github.com/obra/superpowers-developing-for-claude-code/blob/74afe935da49efe782907e837a27ce618498099a/skills/developing-claude-code-plugins/SKILL.md) | Context/explicit | Plugin lifecycle, templates, validation and documentation refresh references. |
| [skills/working-with-claude-code](https://github.com/obra/superpowers-developing-for-claude-code/blob/74afe935da49efe782907e837a27ce618498099a/skills/working-with-claude-code/SKILL.md) | Context/explicit | Route technical questions to a bundled official-documentation snapshot; freshness is a separate concern. |

## Recovery commands and pinned references

The following reconstruct the five inspected source trees in a **new, empty scratch directory outside a working checkout**. They do not install a plugin or execute repository code. The investigation initially detached each clone at its default-branch HEAD; these commands use the recorded full hashes so recovery does not follow a moving branch.

```sh
git -c core.hooksPath=/dev/null clone --no-checkout https://github.com/obra/superpowers.git superpowers
git -C superpowers -c core.hooksPath=/dev/null checkout --detach bb92a77741419a4ab5f06e711a283343f1ada0c3
git -c core.hooksPath=/dev/null clone --no-checkout https://github.com/obra/superpowers-marketplace.git superpowers-marketplace
git -C superpowers-marketplace -c core.hooksPath=/dev/null checkout --detach 2cf27fa76667afa0ba724ad8141a6938a3834e32
git -c core.hooksPath=/dev/null clone --no-checkout https://github.com/obra/superpowers-skills.git superpowers-skills
git -C superpowers-skills -c core.hooksPath=/dev/null checkout --detach cdcd624ad3fd8026deb692e565351854569798dd
git -c core.hooksPath=/dev/null clone --no-checkout https://github.com/obra/superpowers-developing-for-claude-code.git superpowers-developing-for-claude-code
git -C superpowers-developing-for-claude-code -c core.hooksPath=/dev/null checkout --detach 74afe935da49efe782907e837a27ce618498099a
git -c core.hooksPath=/dev/null clone --no-checkout https://github.com/prime-radiant-inc/superpowers-evals.git superpowers-evals
git -C superpowers-evals -c core.hooksPath=/dev/null checkout --detach e64684cd1fa270c464ac797747e45bbe8d127e8b
```

Blog and engine pages are dated web sources, not immutable Git artifacts. The investigation evidence retains their URLs, read dates and short extracts. Repository links throughout this report resolve to the recorded commits; the history links deliberately name the commit that made the discussed change.

[sp-root]: https://github.com/obra/superpowers/tree/bb92a77741419a4ab5f06e711a283343f1ada0c3
[sp-readme]: https://github.com/obra/superpowers/blob/bb92a77741419a4ab5f06e711a283343f1ada0c3/README.md
[sp-license]: https://github.com/obra/superpowers/blob/bb92a77741419a4ab5f06e711a283343f1ada0c3/LICENSE
[sp-writing]: https://github.com/obra/superpowers/blob/bb92a77741419a4ab5f06e711a283343f1ada0c3/skills/writing-skills/SKILL.md
[sp-debug]: https://github.com/obra/superpowers/blob/bb92a77741419a4ab5f06e711a283343f1ada0c3/skills/systematic-debugging/SKILL.md
[sp-verification]: https://github.com/obra/superpowers/blob/bb92a77741419a4ab5f06e711a283343f1ada0c3/skills/verification-before-completion/SKILL.md
[sp-diagnose]: https://github.com/obra/superpowers/blob/bb92a77741419a4ab5f06e711a283343f1ada0c3/skills/diagnosing-superpowers/SKILL.md
[sp-sdd]: https://github.com/obra/superpowers/blob/bb92a77741419a4ab5f06e711a283343f1ada0c3/skills/subagent-driven-development/SKILL.md
[sp-brainstorm]: https://github.com/obra/superpowers/blob/bb92a77741419a4ab5f06e711a283343f1ada0c3/skills/brainstorming/SKILL.md
[sp-using]: https://github.com/obra/superpowers/blob/bb92a77741419a4ab5f06e711a283343f1ada0c3/skills/using-superpowers/SKILL.md
[sp-hooks]: https://github.com/obra/superpowers/blob/bb92a77741419a4ab5f06e711a283343f1ada0c3/hooks/hooks.json
[sp-bootstrap]: https://github.com/obra/superpowers/blob/bb92a77741419a4ab5f06e711a283343f1ada0c3/hooks/session-start
[sp-execute]: https://github.com/obra/superpowers/blob/bb92a77741419a4ab5f06e711a283343f1ada0c3/skills/executing-plans/SKILL.md
[sp-releases]: https://github.com/obra/superpowers/blob/bb92a77741419a4ab5f06e711a283343f1ada0c3/RELEASE-NOTES.md
[sp-porting]: https://github.com/obra/superpowers/blob/bb92a77741419a4ab5f06e711a283343f1ada0c3/docs/porting-to-a-new-harness.md
[sp-workspace-eval]: https://github.com/obra/superpowers/blob/bb92a77741419a4ab5f06e711a283343f1ada0c3/docs/superpowers/specs/2026-07-06-sdd-plan-scoped-workspace-eval-results.md
[sp-review-package]: https://github.com/obra/superpowers/blob/bb92a77741419a4ab5f06e711a283343f1ada0c3/skills/subagent-driven-development/scripts/review-package
[sp-task-brief]: https://github.com/obra/superpowers/blob/bb92a77741419a4ab5f06e711a283343f1ada0c3/skills/subagent-driven-development/scripts/task-brief
[sp-feedback]: https://github.com/obra/superpowers/blob/bb92a77741419a4ab5f06e711a283343f1ada0c3/docs/plans/2025-11-28-skills-improvements-from-user-feedback.md
[market-root]: https://github.com/obra/superpowers-marketplace/tree/2cf27fa76667afa0ba724ad8141a6938a3834e32
[old-root]: https://github.com/obra/superpowers-skills/tree/cdcd624ad3fd8026deb692e565351854569798dd
[dev-root]: https://github.com/obra/superpowers-developing-for-claude-code/tree/74afe935da49efe782907e837a27ce618498099a
[eval-root]: https://github.com/prime-radiant-inc/superpowers-evals/tree/e64684cd1fa270c464ac797747e45bbe8d127e8b
[eval-cost]: https://github.com/prime-radiant-inc/superpowers-evals/blob/e64684cd1fa270c464ac797747e45bbe8d127e8b/docs/experiments/2026-06-10-sdd-cost-experiments.md
[eval-authoring]: https://github.com/prime-radiant-inc/superpowers-evals/blob/e64684cd1fa270c464ac797747e45bbe8d127e8b/docs/scenario-authoring.md
[history-recap]: https://github.com/obra/superpowers/commit/153d6186c5c35e29ee2be2e4a9ecc1a1e2899bfc
[history-plans]: https://github.com/obra/superpowers/commit/8ca22dba9a94f28898bbce59f2537ff4d87c747d
[history-scope]: https://github.com/obra/superpowers/commit/fdb0f4259582bcfec7c2ec6b7368841908a1b3e7
[history-trend]: https://github.com/obra/superpowers/commit/1aa45d20d25a1db2cfa114a48c313c44839e875b
[history-workspace]: https://github.com/obra/superpowers/commit/6df8ba145873f72d3307f128745c7aea00f589c4
[history-brainstorm]: https://github.com/obra/superpowers/commit/bb92a77741419a4ab5f06e711a283343f1ada0c3
