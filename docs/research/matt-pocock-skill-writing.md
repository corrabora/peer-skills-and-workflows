# Research: Matt Pocock's skill-writing practices

Research date: 2026-10-08. Status: recommendations for discussion and later skill work; this report does not change the workflow's rules.

Matt's strongest transferable technique is to make the desired process unusually specific: a recognizable trigger, a small task, the context that task needs, and an observable end condition. Brevity serves that design. It is not an independent target. His seven-line wrappers work because substantial behavior has an owner elsewhere, while his debugging skill spends considerably more text on the step agents are most tempted to skip.

For this repository, the greatest opportunity is to make each role's current obligation easier to find and satisfy. Preserve our fresh workers, independent assessments, single writer, evidence requirements, and operator authority. Improve the wording and placement of those obligations, the pointers that load them, and the evidence that tells us whether a worker followed them. Copying Matt's interview or implementation workflows would import different authority and orchestration choices.

The user’s experience that these skills perform well motivates this study. Source inspection supports a coherent design approach and a history of fixes for reported failures; it does **not** establish comparative performance or prove that any individual wording change causes better results. No agent benchmark was run for this report.

Reading paths: [authoring rules](#rules-we-should-adopt-or-adapt), [maintenance evidence](#maintenance-history-provides-stronger-evidence-than-style-alone), [multi-engine adaptation](#multi-engine-and-orchestrated-adaptation), [our current skills](#concrete-opportunities-in-our-current-skills), and [validation approach](#how-to-determine-whether-the-rules-actually-help).

## Scope and source baseline

The research checkout is `/tmp/mattpocock-skills-research-2026-10-08`, outside this repository. Its pinned HEAD is [`b0618bc436ad893b3c5e84e55fba86586d34a404`](https://github.com/mattpocock/skills/tree/b0618bc436ad893b3c5e84e55fba86586d34a404), committed 2026-10-08. The manifest says version 1.3.1; Git describes the checkout as `v1.3.1-44-gb0618bc`, so this study includes changes after that release. Repository citations below use the full commit, rather than moving `main` links.

I read all 27 promoted `SKILL.md` files, selected supporting references and templates, repository authoring guidance, invocation policy, scope decisions, recent changesets and relevant Git history. I also read Matt's AI Hero skill documentation and release commentary, and checked current official engine documentation for invocation differences. The comparison uses our four role skills, shared process, review and adjudication rules, Orca mapping, records, templates, and metadata validator. Our baseline is commit `ca831e96000eef7e227493b6f5d4b5c24c3539f1` plus the working-tree plan relocation from the preceding task.

The [plugin manifest][manifest] defines the promoted population, rather than every folder found by a recursive search:

| Measured at the pinned checkout | Result |
| --- | --- |
| Promoted skills read | 27: 20 engineering, 7 productivity |
| Invocation classification | 16 user-invoked, 11 model-invoked |
| Codex sidecars | Present for all 27; all 16 user-invoked skills carry the explicit-only setting |
| Promoted primary files | 1,854 lines; median 71; range 7–170 |
| Other `SKILL.md` files | 11 in the non-promoted buckets; excluded from the main comparison |

Line counts include YAML, blank lines and examples. They are **not token measurements**, and exclude the references loaded by the skill. For example, `writing-for-agents` is only 81 lines but approximately 1,777 whitespace-separated words. A short wrapper's cost includes its dependencies. The useful measurement is the material loaded along a particular execution path.

Evidence labels in this report:

- **Explicit:** Matt's repository directly states the authoring principle or workflow rule.
- **Observed:** a recurring construction in the skills or a recorded maintenance change.
- **Recommendation:** our proposed adaptation, not a claim that Matt prescribes our workflow.

The repository is [MIT licensed][license]. This report analyzes mechanisms and attributes their sources; it does not vendor the skills. The scratch checkout is temporary. Its commit and the recovery commands at the end make the research reproducible without depending on that local directory.

## What the accompanying blog adds

The [AI Hero skills collection](https://www.aihero.dev/skills) is useful because it explains the author's intent and what successful use should look like. It is not a replacement for reading the pinned skill.

| First-party publication | What it contributes to this analysis |
| --- | --- |
| [v1 announcement, June 18](https://www.aihero.dev/skills/skills-changelog-v1-announcement) | Explains the user/model invocation split, extraction of shared interview and design references, and a reported 63% reduction in **skill-description** token cost. That number is not a measured reduction in whole-session cost or an accuracy improvement. |
| [Writing for agents](https://www.aihero.dev/skills-writing-for-agents) | Explains why editing should remove behaviorally idle sentences, why generic “streamlining” can cut functionality, and why replaying actual tasks matters. Its success signals concern behavior and useful structure, not a universal word limit. |
| [v1.2 announcement](https://www.aihero.dev/skills/skills-changelog-v12-wait-what-writing-for-agents-claude-code-plugin-and-more) | Explains Codex sidecars, the broader scope of `writing-for-agents`, and the move from repeating environment facts to looking them up. It also explains the listener-oriented naming of `wait-what`. |
| [v1.3 announcement, updated October 5](https://www.aihero.dev/skills-changelog-v13-implement-spec-pr-retro-and-glossary-md) | Explains the new whole-spec orchestrator, evidence-oriented PRs, environment retrospectives, and explicit skill loading. Matt prefers a tuned deterministic ticket loop over an agent loop, while treating the latter as a useful starting point. |
| [Grilling mistakes, updated May 25](https://www.aihero.dev/things-people-get-wrong-with-grill-me-and-grill-with-docs) | Explains scope limits, questions that need prototypes rather than conversation, and preserving decisions before switching contexts. It also exposes how much active human steering the interview workflows expect. |

The source set has evolved. The v1.2 release record places the `writing-great-skills` rename there, while the current writing-guide page says v1.1. Older material uses `CONTEXT.md`; the pinned skills use `GLOSSARY.md`. The May grilling article mentions roughly 120k tokens as a practical context threshold, while the current router mentions roughly 150k. Treat those numbers as dated heuristics, not portable engine limits. For exact current behavior, this report follows the pinned files and [changelog][changelog].

The blog's v1.3 orchestration discussion is particularly relevant: worktrees still permit semantic collisions at merge time, and a single large integration branch remains a tradeoff. Its parallel implementation model is not evidence that our sole-writer model should change.

## Rules we should adopt or adapt

### 1. Define the behavioral difference before drafting the skill

**Explicit and observed.** The authoring guide targets a repeatable process. The human-docs guide requires each page to explain the constraint that distinguishes the skill from ordinary agent behavior. `to-spec` synthesizes an existing conversation; `research` produces a cited answer; `prototype` answers one design question; `to-questionnaire` asks the sender about the recipient and the needed information. These are concrete jobs with different stopping points. [Writing guide][writing]; [docs guidance][docs-guide]; [spec][to-spec]; [questionnaire][questionnaire].

**Recommendation.** Start an authoring change with: “When given X, this role produces Y under constraint Z.” If that sentence still describes several independently useful tasks, inspect the boundary before adding instructions. For our reviewer, the distinctive outcome is an assessment of one allocated quality set against one identified candidate, supported by coverage and evidence. Fixing the candidate is a separate job with a different owner.

A narrow job can still be demanding. Do not equate “discrete task” with “trivial prompt.”

### 2. Write the description as a routing decision

**Explicit.** Matt treats descriptions and document links as the same kind of object: a small piece of loaded text that determines whether larger material is reached. He distinguishes actual branches from lists of synonyms, and places useful conceptual vocabulary early. [Writing guide, context pointers][writing].

**Observed.** Model-facing descriptions name cases where the agent should reach for the skill; user-facing ones summarize the command. `wizard` includes an exclusion for work the agent can already perform. `pr` has a very short trigger tied to one recognizable artifact. [Invocation policy][invocation]; [wizard][wizard]; [PR][pr].

**Recommendation.** State the job and the trigger boundary. Keep roster counts, engine choices and implementation mechanics in their owning references unless they materially distinguish the trigger. Test both a request that should activate the skill and a nearby request that should not. Our worker descriptions should continue to require coordinator dispatch; merely encountering the word “review” is insufficient.

### 3. Make required loading an action, not a mention

**Observed.** The repository changed vague cross-skill mentions into explicit tool-call instructions. The latest `grill-with-docs` wrapper specifies two calls, avoiding the ambiguity of putting two names into a tool that takes one. A recent router fix also requires reading the actual skill before claiming what it does or skipping it. [Invocation policy][invocation]; [wrapper][grill-with-docs]; [router][ask-matt]; [loading change][loading-change].

**Recommendation.** Give every required pointer an action, a condition, and a target: read the canonical severity definition before grading; load the current Orca guide before issuing a runtime command. A path under “related documents” does not establish that dependency.

Adapt the action to the installed engine. A literal tool named `Skill` is not a portable interface guaranteed by our environment. The transferable mechanism is explicit resolution and loading through a supported capability, followed by the required behavior. Never bypass an engine's invocation restriction by reading and executing an unavailable skill through a different route.

### 4. Separate ordered work from reference, then disclose by branch

**Explicit.** Matt distinguishes ordered steps, reference in the main file, and reference behind a pointer. A reference-only skill is valid. Material needed by all branches stays close; material needed only by one branch can move behind that branch's condition. Definitions, caveats and rules for the same concept belong together. [Writing guide][writing].

**Observed.** `prototype` selects either logic or UI guidance. `writing-for-agents` loads skill mechanics only for skill authoring. `codebase-design` discloses separate interface-alternative and deepening references. [Prototype][prototype]; [skill mechanics][mechanics]; [design][design].

**Recommendation.** Audit each role's reading path by phase. The coordinator currently loads six shared documents at entry. Recovery details, successor handoff instructions and some template guidance are candidates for later loading, provided the entry points remain explicit. Candidate identity, authority, lifecycle communication and independence constraints must be available before dependent work. Moving a file changes little if every role still loads every file unconditionally.

### 5. Give each stage an observable, sufficiently demanding end condition

**Explicit.** Matt separates clarity of completion from the amount of work completion requires. A precise output requirement can induce necessary investigation without prescribing every search. His debugging skill demands an already-run command that can detect the actual symptom before hypotheses; `to-questionnaire` finishes only when each requested information need has a question in the saved document. [Writing guide][writing]; [diagnosis][diagnosis]; [questionnaire][questionnaire].

**Recommendation.** Replace broad verbs such as “review thoroughly” with a bounded inventory and a result for each item. We already do this well with assigned clauses and coverage tables. Preserve the distinctions between compliant, noncompliant, inapplicable and indeterminate. The criterion must allow a truthful blocked or incomplete result; otherwise it rewards invented certainty.

A completion report should show which condition was satisfied, by what evidence, against which candidate. “Done” is a notification, not proof.

### 6. Protect the difficult stage from premature advancement

**Explicit.** The writing guide recommends sharpening the current stage's end condition before splitting a sequence. A split only hides later work if it creates a real context boundary; another inline skill call leaves the later instructions visible. [Writing guide][writing].

**Observed.** Diagnosis devotes a disproportionate share of its text to obtaining a usable failure signal. The remaining phases consume that signal. Matt spends words where an agent tends to take a shortcut, rather than giving every phase equal treatment. [Diagnosis][diagnosis].

**Recommendation.** Keep our independent reviewer and adjudicator tasks as real worker boundaries. A reviewer should receive the current review obligation, not an implementation-and-landing itinerary. The coordinator can retain the whole workflow. Add a new split only for an observed attention or ownership failure; every additional worker also costs startup, loading and coordination.

### 7. Use familiar vocabulary, with precise definitions for local terms

**Explicit.** Matt calls compact concepts that recruit learned behavior “leading words.” Examples include a tight feedback loop, a tracer bullet, a seam, and a frontier. Repeated concepts compress explanations and connect prompts to the material they should load. Invented terminology requires more definition. [Writing guide][writing].

**Observed.** The frontier recurs in interviewing, planning and implementation, always around settled prerequisites. Domain modeling checks terminology against code and records resolved meanings immediately. Reading a glossary is explicitly distinguished from actively revising the domain model. [Grilling][grilling]; [wayfinder][wayfinder]; [implementation graph][implement-spec]; [domain modeling][domain].

**Recommendation.** Prefer our existing terms: candidate, wave, seat, finding, evidence, release and operator gate. Keep one owning definition for each. Do not let a memorable word replace a required distinction: candidate needs its base and tree; agreement is not execution permission. Test vocabulary across both engines instead of assuming identical associations.

### 8. State the desired action; retain essential boundaries

**Explicit.** Matt prefers positive instructions to prohibitions, while allowing hard restrictions that cannot safely be expressed otherwise. His suggested explanation for the effect of negation is an authoring heuristic, not an experiment established by this study. [Writing guide][writing].

**Observed.** The skills themselves still use strong exclusions: planning stops before execution, a prototype omits production engineering, and a spec avoids reopening an interview. The policy is selective, not a ban on negative sentences. [Wayfinder][wayfinder]; [prototype][prototype]; [spec][to-spec].

**Recommendation.** Pair a boundary with the next correct action: “When the required evidence is stale, report the blocker to the PC and stop the dependent review.” Keep explicit restrictions on editing the candidate, exposing peer material too early, or inferring authority. Those communicate our role contract, not merely a stylistic preference.

### 9. Prune by behavioral effect, not word count

**Explicit.** The guide separates duplicated meaning, irrelevant or stale material, excessive scope, and instructions that change nothing relative to a model's default. It recommends removing whole idle sentences and resolving disputed cases by running the task. [Writing guide][writing].

**Recommendation.** For each proposed deletion, state what behavior might disappear and how we will notice. A clause redundant for one engine may still be needed by the other. Keep the shared instruction when it has demonstrated value on a supported engine; consider an adapter only when the difference is stable and worth maintaining.

Our authority and evidence instructions are not automatically clutter because they are repeated near a risky action. First establish one authoritative owner, then distinguish a short local reminder from a second independently maintained rule. Preserve intentional checkpoints until a replay shows the replacement is reliable.

### 10. Let the environment own facts it can answer cheaply

**Explicit.** Matt describes prose that restates configuration, commands or directory contents as a cache. A cache has to justify its cost and staleness risk. Instructions earn their place by recording otherwise inaccessible conventions, rationale and exceptions. [Writing guide, pruning][writing].

**Recommendation.** Continue resolving worker profiles through our configuration tool and Orca syntax through its version-matched guide. Do not copy current model names, launch flags or filesystem assumptions into every role. Record the **observed effective values** for a run separately from the policy that determines them.

A dispatch's pinned candidate and source revision are deliberate snapshots, not accidental duplication. They establish what a particular worker must evaluate. Changing their semantics to “whatever is current” would sacrifice reproducibility.

### 11. Compose shared behavior without making every document a skill

**Explicit and observed.** `grill-me` invokes the shared interview primitive; `grill-with-docs` adds the domain-modeling discipline. Matt also permits shared plain references and says passive glossary reading does not warrant running the active modeling skill. His repository rejects new skills when existing ones already compose the behavior. [Wrappers][grill-me]; [documenting wrapper][grill-with-docs]; [mechanics][mechanics]; [catalog scope][new-skills].

**Recommendation.** Retain four role entry points and plain shared workflow references unless an additional independently useful trigger justifies another skill. Extract reusable policy from copied role prose, but keep role-specific obligations near the role's work. A useful extraction makes a behavior change a one-place edit and preserves a clear route to load it.

### 12. Design questions around dependencies and existing knowledge

**Observed.** `grilling` asks questions whose prerequisites are settled, recomputes the available set after answers, and assigns fact gathering to the agent. Its current format lets “yes” accept the recommendation. Setup skips branches already resolved by inspection. Triage reads earlier notes instead of asking resolved questions again. [Grilling][grilling]; [setup][setup]; [triage][triage].

**Recommendation.** Ask the operator for decisions and inaccessible facts. Inspect the repository and current guidance for the rest. Carry accepted answers into later tasks rather than rediscovering them in every worker. Batch independent questions where useful; await an answer before acting on a genuinely dependent decision.

The useful principle is dependency-aware questioning, not perpetual interviewing. Our PC remains the operator-facing owner, and our existing authorizations and stop boundaries govern. Do not copy a confirmation sentence into every step or make workers independently re-approve settled scope.

### 13. Treat artifacts as contracts with a purpose and lifetime

**Observed.** The domain glossary, ADR, spec, implementation ticket, decision ticket, research note and handoff each hold a different kind of information. A wayfinder map indexes decisions rather than duplicating them. Handoffs point to existing artifacts. Durable briefs favor behavioral contracts over implementation instructions tied to moving file locations. [Domain][domain]; [wayfinder][wayfinder]; [handoff][handoff]; [agent briefs][briefs].

**Recommendation.** Preserve our distinction between maintained authority, ephemeral run records and disposable scratch. Durable plan text should state accepted intent directly. A current review finding still needs the exact path and line in its pinned candidate; Matt's advice against paths in long-lived tickets does not apply to that evidence address.

Record non-obvious decisions when made, but do not create empty scaffolding for its own sake. If a finding's support began in scratch, retain the cited evidence before releasing its worker. A pointer is only useful when the next reader can access its target for the required lifetime.

### 14. Make the output format induce useful work

**Observed.** Matt's PR template demands before/after evidence and consequences of merging. His review asks separately for standards violations and missing, extra or incorrect requirements. The questionnaire maps every needed answer to a question. These output requirements make missing work visible. [PR][pr]; [code review][code-review]; [questionnaire][questionnaire].

**Recommendation.** Keep a small operator summary backed by complete coverage and finding briefs. Fields should correspond to decisions or proof: candidate identity, applicable clause, expected and observed behavior, evidence limits, recommendation and unresolved disagreement. Do not impose Matt's 400-word sub-review limit on our complete coverage obligation. Use compact presentation at the top, with detail behind stable links.

Templates must accept “unknown,” “not applicable” and “not demonstrated” where those are truthful. A polished template populated with guesses defeats its purpose.

### 15. Put deterministic mechanics in tooling and policy in its owner

**Explicit and observed.** `retro` sends mechanically detectable violations toward checks and reserves reviewer prose for judgment. `wizard` provides a fixed script library so the agent writes the variable stages rather than reconstructing the mechanism. The repository deliberately leaves recursion limits and name resolution to the harness. [Retro][retro]; [wizard][wizard]; [recursion policy][recursion]; [name-collision policy][collisions].

**Recommendation.** Continue using our Node tooling for parsing, metadata, path containment and configuration. Consider additional checks only when a real failure justifies them. Invocation-policy consistency and stale reference detection are plausible candidates; a second general framework is not an automatic consequence of this research.

Orca owns runtime operations. Our workflow still owns its architectural constraints: which role may delegate, who writes, what a completed paired round means, and where operator authority is required. A generic harness depth limit cannot encode those semantics. Keep those policies even though Matt declines to add leaf-agent rules to his own catalog.

### 16. Maintain skills from observed failures and preserve human usability

**Explicit.** Matt's contribution bar requires an observed failure that fits his philosophy. His docs guidance looks for questions people actually ask and success signals they can see without opening the skill. `retro` studies session evidence before proposing environment changes. [Scope][scope]; [docs guidance][docs-guide]; [retro][retro].

**Recommendation.** Keep a small record of reproducible skill failures and the behavior each edit intends to change. Periodically inspect successful runs too: an agent may have completed the feature only after avoidable retries. Fix the smallest responsible instruction, reference, tool or environment gap. Do not turn every difficult run into another paragraph in every skill.

Operator documentation should explain how to start, what the output means, and where the next decision occurs. It can relieve the operator's memory burden without copying the worker runbook. A router becomes useful as workflows multiply; four role skills alone do not yet establish the need for a new router skill.

## Close readings: why the small details matter

| Construction | Mechanism visible in the source | How to use the lesson here |
| --- | --- | --- |
| `grill-me` and `grill-with-docs` are seven lines each | Two named entry points reuse the same substantive interview behavior; the latter activates a second discipline. Their apparent brevity depends on loading the referenced skills. | Give a role a clear entry point and one source for shared procedure. Inspect the full dependency path when assessing complexity. [Wrappers][grill-me]; [documenting wrapper][grill-with-docs]. |
| `diagnosing-bugs` has six phases but concentrates detail in the first | It makes establishing a symptom-sensitive feedback loop a prerequisite. It names a failure to resist, supplies alternatives, and defines an observable gate. | Spend detail on the transition most likely to go wrong: for us, candidate/evidence validation and the independent-assessment barrier. [Diagnosis][diagnosis]. |
| `grilling` models questions as a frontier | It prevents asking a dependent question before its prerequisite answer exists while allowing unrelated questions to proceed. | Dispatch only truly unblocked work. A waiting worker need not halt unrelated authorized work. [Grilling][grilling]. |
| `prototype` selects between two linked documents | The input question chooses the artifact and its detailed method; the common file retains common constraints. | Branch role references by the current job, such as implementation versus landing, without creating a second owner for the shared contract. [Prototype][prototype]. |
| `code-review` puts standards and spec into different contexts | The aggregation preserves the axes instead of allowing a strong result on one to conceal failure on another. | Preserve independent assessments and source identities. Our subsequent adjudication is a separate reconciliation stage, with its own authority limits. [Code review][code-review]. |
| `wait-what` names the listener's failure state | The requested repair includes orientation as well as simpler language. Shortening alone would not fix missing context. | Write operator reports around what the operator needs to decide. A compact report can still need one sentence of context. [Wait-what][wait-what]; [v1.2 explanation](https://www.aihero.dev/skills/skills-changelog-v12-wait-what-writing-for-agents-claude-code-plugin-and-more). |

These are mechanisms inferred from the instructions and their surrounding rationale. They are not measured causal explanations of model behavior.

## Maintenance history provides stronger evidence than style alone

The most useful history is not that the files became shorter. It is that a specific failure was translated into a narrowly targeted instruction or metadata fix.

| Recorded problem | Change visible in the pinned repository | General lesson |
| --- | --- | --- |
| Cross-skill prose did not reliably cause loading | Operative dependencies name the invocation tool; two dependencies become two calls. [Change][loading-change]; [policy][invocation]. | Test whether the dependency was actually loaded, not whether its name appeared in the answer. |
| `writing-for-agents` retained explicit-only Codex metadata after its invocation role changed | Commit [`4aaccb5`](https://github.com/mattpocock/skills/commit/4aaccb58d40559d7e3c59a029b2290ae5ba538de) removes the stale policy and updates the picker text. | Metadata and prose are one behavioral contract; they can drift independently. |
| The router asserted behavior and recommended skipping steps without reading the target | A new opening instruction requires reading the relevant `SKILL.md`. [Changeset][router-fix]; [reported case](https://github.com/mattpocock/skills/issues/614). | An index is navigation, not a substitute for the material it indexes. |
| A fresh implementation session could resolve the wrong work item | `implement` now fetches a supplied reference and states its title, asking if ambiguous. [Changeset][ticket-fix]. | Resolve input identity before starting. Our candidate tree and task identity checks serve the same purpose. |
| A failed run was trusted even though an attempted mutation might have changed nothing | Diagnosis now compares a forced mutation with a pristine copy before trusting that evidence. [Changeset][mutation-fix]. | Check that the evidence-producing setup actually happened. A red test is useful only if its cause is relevant. |
| Reviewers missed standards sources or their returned results were mishandled | The review now explicitly searches standards files, always includes two named conventional sources when present, and runs both reviewers in the foreground. [Changeset][review-fix]. | State how inputs are located and how results return; “parallel review” alone leaves both underspecified. |
| An affirmative response could reject the recommendation | Questions are now phrased so “yes” accepts the proposed answer. [Changeset][question-fix]. | Reduce ambiguity in the human control surface, not just in agent instructions. |

These records show intended fixes and, for the cited issue, a reporter's account of a session. They do not supply controlled before/after success rates. The root scope policy also means the catalog is curated for Matt's own use; its rejected-feature list is a design boundary, not a universal standard we should inherit.

## Multi-engine and orchestrated adaptation

### Discovery, loading and permission are separate concerns

Matt's collection is already multi-engine at this snapshot. The shared Markdown and paired metadata are relevant precedent. His invocation document describes an intentionally strict user/model distinction. Our system needs an additional conceptual distinction: an operator entry point, a role loaded for a coordinator-dispatched task, and a reference consumed inside another task. This is an authoring classification, not a proposal for three new file formats. [Invocation policy][invocation]; [manifest][manifest].

Current official documentation establishes that Claude's `disable-model-invocation: true` hides the description from ordinary discovery and prevents autonomous invocation; it also affects subagent preloading. Codex's `policy.allow_implicit_invocation: false` disables implicit selection while explicit invocation remains available. The Codex documentation does not, by that statement alone, prove every stronger reachability or token-cost claim in Matt's prose. [Claude invocation reference](https://code.claude.com/docs/en/skills#control-who-invokes-a-skill); [OpenAI optional metadata](https://learn.chatgpt.com/docs/build-skills#optional-metadata).

Accordingly:

1. Decide who needs to reach each skill before choosing metadata.
2. Keep a worker reachable through the dispatch path we actually support. Do not mark every role user-only just to reduce description cost.
3. Verify loading in both engines using their current supported mechanisms. Do not assume a universal `Skill` tool or identical visibility rules.
4. Keep discovery controls distinct from authorization to mutate, publish, commit or advance a workflow. A loaded skill does not grant any of those permissions by itself.
5. Treat metadata changes as compatibility work. Our [current validator](../../tools/lib/skills.mjs) accepts only `allowed-tools`, `description`, `license`, `metadata` and `name`; copying Matt's `disable-model-invocation` or `argument-hint` fields would currently fail validation. We also have no sidecar-policy parity check. Updating those contracts would require a deliberate, separately reviewed change.

### What transfers, what needs adaptation, and what to leave behind

| Matt's practice | Decision for our workflow | Reason |
| --- | --- | --- |
| Narrow descriptions, explicit loading, conditional references | Adopt and test | They apply to any text-driven role and fit our canonical-source design. |
| Observable end conditions and evidence-shaped output | Adopt | Our candidate, coverage and retained-proof contracts already provide a strong base. |
| Separate assessment contexts | Preserve and strengthen | We require four direct review seats and two independent initial adjudications, not just two review axes. |
| Fixed code-smell baseline in review | Do not import as an obligation | Our governing quality clauses come from the target's initialized profiles and allocation. Useful heuristics cannot silently become new requirements. |
| Shared skill body plus engine metadata | Adapt | Metadata can express discovery differences; verify it against our installer, validator and dispatch behavior. |
| Human remains the workflow dispatcher | Adapt | Our operator authorizes boundaries while the PC owns launches, dependencies, records and communication within that scope. |
| Parallel implementers on separate branches | Do not adopt as a writing-style change | This changes candidate ownership, integration and verification. Our sole-writer policy is intentional. |
| Implementation commits automatically after review | Do not import | Our accepted-tree landing task and operator authority are separate obligations. |
| Agent performs every reviewer-driven correction | Do not import | A finding is assessed and disposed of before an authorized correction batch; peer agreement does not authorize work. |
| Broadly reserve coding standards for the review stage | Adapt narrowly | Review can carry heavy assessment detail, but implementers still need applicable constraints to produce a valid candidate. Our reviewers may also need substantial investigation. |
| No skill-level recursion guards | Keep our role boundaries | Our rule that direct reviewers do not delegate is part of the review architecture, not just protection from infinite recursion. |
| Bash wizard templates and persistent prototype branches | Borrow the principle, not the machinery | Our tooling is native Node across supported hosts, and our record/scratch lifetime is already specified. |
| Plain-chat questioning and open-ended grilling | Treat as contextual choices | Use the active engine's supported interaction and the operator's preference. A worker may need to ask the PC rather than the human. |
| Fixed context-size heuristics | Do not standardize | Engine, task, version and context composition change the useful threshold. |
| Fewer sentences at all costs | Reject | Removing a required behavior is a regression even when it saves tokens. |

The relevant local owners are [PROCESS.md](../../workflow/PROCESS.md), [REVIEW.md](../../workflow/REVIEW.md), [ADJUDICATION.md](../../workflow/ADJUDICATION.md), [ORCA.md](../../workflow/ORCA.md) and [RECORDS.md](../../workflow/RECORDS.md). These remain authoritative; the table is an adaptation recommendation.

## Concrete opportunities in our current skills

Our architecture already implements many of the useful principles: four explicit roles, shared procedure, fresh worker contexts, pinned candidates, a complete coverage table, retained evidence, and one operator-guidance ledger. The main opportunity is organizing access to those rules, not replacing them.

| Current location | Source-inspection finding | Recommended next experiment |
| --- | --- | --- |
| [Coordinator](../../skills/plan-coordinator/SKILL.md), Shared references | It requests all six shared documents at startup. At this working-tree baseline those documents total 1,092 lines, before the 149-line coordinator skill and target guidance. This is a reading surface, not a measured token cost. | Map which sections are needed before the first dispatch, at review, at adjudication and only during recovery. Trial conditional pointers for branch-specific material. |
| Coordinator, Responsibilities | Records, naming, reporting, authority, peer reconciliation and lifecycle instructions form a long flat list. | Reshape navigation around actual stages and events, while retaining a small set of standing invariants. Start with one observed navigation failure if available. |
| All four role skills and shared procedure | Candidate identity, source resolution, operator guidance and mutation rules recur. Some repetitions implement deliberate checkpoints; others may restate their owner. | Build an ownership map before deleting. Retain short action-site checks and replace duplicate explanations with explicit pointers. |
| [Responsible party](../../skills/plan-responsible-party/SKILL.md) | Implementation, correction and landing share the same entry point and reference surface. | Present the three assigned-task branches explicitly; load landing detail only for landing. Keep the release and candidate checks common. |
| [Reviewer](../../skills/plan-reviewer/SKILL.md) | Its completion contract already demands all allocated clauses, applicability, compliance and evidence gaps. | Preserve it. Improve only observed access or reporting problems; do not replace it with a generic “review the code” prompt. |
| [Adjudicator](../../skills/review-adjudicator/SKILL.md) | Initial assessment and reconciliation have different visibility rules, with special closure rules and continuation behavior. | Make the current mode and permitted next action especially visible. Verify that shorter wording still preserves independent initials and paired-round counting. |
| [Candidate](../../workflow/templates/candidate.md) and [report templates](../../workflow/templates/report.md) | They already require identity, proof limits, provenance, peer positions and operator decisions. | Keep the complete records; test whether the operator can find the active decision quickly. Use compact summaries to improve reading without discarding evidence. |
| [Validator](../../tools/lib/skills.mjs) and [installer reference checks](../../tools/lib/install.mjs) | They validate syntax and links, not whether descriptions trigger correctly, dependent references are read, or a worker stops at the right boundary. | Add a small behavioral replay practice before expanding tooling. Static checks and behavioral checks answer different questions. |

A reasonable adoption order is: audit ownership and reading paths; trial one role's presentation change; compare baseline and revision across engines; then update an authoring reference only with rules that survived the trial. This report is the research input to that work, not an instruction to rewrite all skills immediately.

## How to determine whether the rules actually help

The report's recommendations need behavioral evidence. Matt's writing documentation describes manual use and diagnosis rather than a published automated evaluation suite. The inspected checkout contains no dedicated behavioral skill-evaluation suite; `tdd/tests.md` is guidance with examples, not such a suite. That absence does not imply he performs no private testing. [Writing documentation](https://www.aihero.dev/skills-writing-for-agents); [repository scripts][package].

For our first trial, use a small disposable repository with a fixed binding and candidate, fake external destinations, and retained traces. Compare the current role with one focused revision using the same inputs, engine, model and effort. Record those actual values, the skill/source revision, and the starting state. Repeat each selected case at least three times per engine as an initial check for obvious variability; that is a smoke test, not a statistically reliable performance estimate.

| Case | Expected observable behavior |
| --- | --- |
| Positive trigger and a nearby non-trigger | Select the intended entry point for supervised plan work; do not activate the role for a generic discussion merely containing the same words. |
| Fresh worker with a changed shell directory | Resolve the supplied canonical workflow source and assigned candidate; read required material from the correct locations. |
| Missing, mismatched or stale required evidence | Report the specific blocked dependency and the applicable proof obligation; do not claim a completed review. |
| One clause inapplicable; another fact indeterminate | Preserve both distinctions in coverage without manufacturing a finding or a pass. |
| A note outside the reviewer's set | Retain its clause, evidence and source grade; route it through the existing finding process. |
| Peer report present before initial assessment is frozen | Maintain the independent-assessment barrier and ask the PC to correct the input flow. |
| Disposition accepted, with no release for the next RP task | Record the disposition and stop at the existing authorization boundary; do not infer permission. |
| Existing bounded authorization already covers the next step | Proceed within it without asking for the same permission again. |
| A peer reply missing at a reconciliation checkpoint | Report the missing dependency; do not count a partial exchange as a completed round. |
| Resume with a summary that disagrees with retained source records | Inspect the source, preserve what can be established, and identify the unresolved gap without inventing history. |

Judge the trace and artifacts, not just the agent's claim that it obeyed. Look for required inputs actually read, premature advancement, unsupported conclusions, missed scope, unauthorized mutations, and re-asked settled questions. Evaluate operator usability by whether a reader can identify the candidate, proof limits, pending decision and next permitted action from the report.

Measure loaded context, redundant reads, total tool calls and elapsed time as costs **after** judging correctness. Do not remove an essential checkpoint because its deletion wins a token comparison. Inspect failures to locate the responsible layer: discovery, reference loading, step criterion, tool behavior, runtime permissions, or missing task inputs. This prevents fixing a dispatch bug by adding prose to every skill.

For an authoring change, the review questions are:

- What real failure or recurring friction does this address?
- What behavior changes, and on which branches?
- Which document or tool owns the rule after the change?
- What inputs must be loaded before the affected action?
- What observable result distinguishes completion, blockage and uncertainty?
- Does each engine still discover and load the needed material?
- Does the change preserve role ownership and existing operator authority?
- What replay result supports keeping it?

These are questions for reviewing a change, not a checklist to paste into every runtime skill.

## Inventory of the promoted skills inspected

“User” and “model” follow the pinned repository's classification; model-invoked skills remain user-reachable. The observation column records the writing mechanism most relevant here, rather than describing the entire skill.

| Skill | Mode | Relevant construction |
| --- | --- | --- |
| [ask-matt][ask-matt] | User | Router, branch decisions, source verification before recommendations |
| [diagnosing-bugs][diagnosis] | Model | Strong prerequisite, ranked alternatives, evidence and cleanup |
| [grill-with-docs][grill-with-docs] | User | Minimal composition of two independently owned disciplines |
| [triage][triage] | User | Named states, prior notes, separate facts and decisions |
| [improve-codebase-architecture][architecture] | User | Scope selection before exploration; human-selectable result |
| [setup-matt-pocock-skills][setup] | User | Discover first; conditional questions; idempotent edits |
| [tdd][tdd] | Model | Reference applied throughout a loop; confirmed test surfaces |
| [to-spec][to-spec] | User | Existing context synthesized into a bounded artifact |
| [to-tickets][to-tickets] | User | Verifiable slices, explicit dependencies and publication format |
| [wayfinder][wayfinder] | User | Decision work separated from implementation; incremental map |
| [implement][implement] | User | Small orchestration wrapper with identity resolution |
| [implement-spec][implement-spec] | User | Task graph, worker roles and pointer-based communication |
| [prototype][prototype] | Model | Artifact chosen by question; branch-specific references |
| [research][research] | Model | Primary-source standard and a specified written result |
| [domain-modeling][domain] | Model | Active versus passive use; vocabulary and decision ownership |
| [codebase-design][design] | Model | Shared definitions and optional deeper branches |
| [code-review][code-review] | Model | Independent axes with distinct briefs and preserved outputs |
| [pr][pr] | Model | Output template elicits concrete evidence and consequences |
| [retro][retro] | User | Failure-driven changes to the environment and rule placement |
| [wizard][wizard] | Model | Fixed mechanics, variable stages, explicit stage completion |
| [grill-me][grill-me] | User | One-operation entry point |
| [grilling][grilling] | Model | Dependency-aware questions, fact/decision separation |
| [handoff][handoff] | User | Portable continuation artifact with pointers |
| [teach][teach] | User | Mission-scoped state, reusable artifacts and feedback loops |
| [to-questionnaire][questionnaire] | User | Recipient-specific information contract and coverage criterion |
| [wait-what][wait-what] | User | Corrective trigger defined by the user's comprehension gap |
| [writing-for-agents][writing] | Model | Explicit theory of pointers, completion, vocabulary and pruning |

Supporting material inspected includes skill mechanics; the router's phase-boundary guide; TDD test and mocking examples; domain and ADR formats; prototype branches; design/deepening guidance; triage agent briefs; invocation and docs-authoring policies; scope and selected rejection records; plugin metadata; and selected changesets/commits. No repository installation, hook or workflow was executed from the research checkout.

To retrieve the same source after the temporary checkout disappears, run these commands from a research directory outside this repository:

```sh
git clone https://github.com/mattpocock/skills.git mattpocock-skills-research
git -C mattpocock-skills-research checkout --detach b0618bc436ad893b3c5e84e55fba86586d34a404
```

Recount the promoted population from `.claude-plugin/plugin.json`, not every `SKILL.md`. When updating this research, record the new commit and revisit both behavior and metadata. Live blog and official-documentation links were read on 2026-10-08 and may subsequently change.

[manifest]: https://github.com/mattpocock/skills/blob/b0618bc436ad893b3c5e84e55fba86586d34a404/.claude-plugin/plugin.json
[license]: https://github.com/mattpocock/skills/blob/b0618bc436ad893b3c5e84e55fba86586d34a404/LICENSE
[changelog]: https://github.com/mattpocock/skills/blob/b0618bc436ad893b3c5e84e55fba86586d34a404/CHANGELOG.md
[writing]: https://github.com/mattpocock/skills/blob/b0618bc436ad893b3c5e84e55fba86586d34a404/skills/productivity/writing-for-agents/SKILL.md
[docs-guide]: https://github.com/mattpocock/skills/blob/b0618bc436ad893b3c5e84e55fba86586d34a404/.agents/writing-docs.md
[to-spec]: https://github.com/mattpocock/skills/blob/b0618bc436ad893b3c5e84e55fba86586d34a404/skills/engineering/to-spec/SKILL.md
[questionnaire]: https://github.com/mattpocock/skills/blob/b0618bc436ad893b3c5e84e55fba86586d34a404/skills/productivity/to-questionnaire/SKILL.md
[invocation]: https://github.com/mattpocock/skills/blob/b0618bc436ad893b3c5e84e55fba86586d34a404/.agents/invocation.md
[wizard]: https://github.com/mattpocock/skills/blob/b0618bc436ad893b3c5e84e55fba86586d34a404/skills/engineering/wizard/SKILL.md
[pr]: https://github.com/mattpocock/skills/blob/b0618bc436ad893b3c5e84e55fba86586d34a404/skills/engineering/pr/SKILL.md
[grill-with-docs]: https://github.com/mattpocock/skills/blob/b0618bc436ad893b3c5e84e55fba86586d34a404/skills/engineering/grill-with-docs/SKILL.md
[ask-matt]: https://github.com/mattpocock/skills/blob/b0618bc436ad893b3c5e84e55fba86586d34a404/skills/engineering/ask-matt/SKILL.md
[loading-change]: https://github.com/mattpocock/skills/blob/b0618bc436ad893b3c5e84e55fba86586d34a404/.changeset/implement-skill-tool-wording.md
[mechanics]: https://github.com/mattpocock/skills/blob/b0618bc436ad893b3c5e84e55fba86586d34a404/skills/productivity/writing-for-agents/SKILL-MECHANICS.md
[prototype]: https://github.com/mattpocock/skills/blob/b0618bc436ad893b3c5e84e55fba86586d34a404/skills/engineering/prototype/SKILL.md
[design]: https://github.com/mattpocock/skills/blob/b0618bc436ad893b3c5e84e55fba86586d34a404/skills/engineering/codebase-design/SKILL.md
[diagnosis]: https://github.com/mattpocock/skills/blob/b0618bc436ad893b3c5e84e55fba86586d34a404/skills/engineering/diagnosing-bugs/SKILL.md
[grilling]: https://github.com/mattpocock/skills/blob/b0618bc436ad893b3c5e84e55fba86586d34a404/skills/productivity/grilling/SKILL.md
[wayfinder]: https://github.com/mattpocock/skills/blob/b0618bc436ad893b3c5e84e55fba86586d34a404/skills/engineering/wayfinder/SKILL.md
[implement-spec]: https://github.com/mattpocock/skills/blob/b0618bc436ad893b3c5e84e55fba86586d34a404/skills/engineering/implement-spec/SKILL.md
[domain]: https://github.com/mattpocock/skills/blob/b0618bc436ad893b3c5e84e55fba86586d34a404/skills/engineering/domain-modeling/SKILL.md
[retro]: https://github.com/mattpocock/skills/blob/b0618bc436ad893b3c5e84e55fba86586d34a404/skills/engineering/retro/SKILL.md
[recursion]: https://github.com/mattpocock/skills/blob/b0618bc436ad893b3c5e84e55fba86586d34a404/.out-of-scope/subagent-recursion.md
[collisions]: https://github.com/mattpocock/skills/blob/b0618bc436ad893b3c5e84e55fba86586d34a404/.out-of-scope/harness-name-collisions.md
[new-skills]: https://github.com/mattpocock/skills/blob/b0618bc436ad893b3c5e84e55fba86586d34a404/.out-of-scope/new-skills.md
[grill-me]: https://github.com/mattpocock/skills/blob/b0618bc436ad893b3c5e84e55fba86586d34a404/skills/productivity/grill-me/SKILL.md
[setup]: https://github.com/mattpocock/skills/blob/b0618bc436ad893b3c5e84e55fba86586d34a404/skills/engineering/setup-matt-pocock-skills/SKILL.md
[triage]: https://github.com/mattpocock/skills/blob/b0618bc436ad893b3c5e84e55fba86586d34a404/skills/engineering/triage/SKILL.md
[handoff]: https://github.com/mattpocock/skills/blob/b0618bc436ad893b3c5e84e55fba86586d34a404/skills/productivity/handoff/SKILL.md
[briefs]: https://github.com/mattpocock/skills/blob/b0618bc436ad893b3c5e84e55fba86586d34a404/skills/engineering/triage/AGENT-BRIEF.md
[scope]: https://github.com/mattpocock/skills/blob/b0618bc436ad893b3c5e84e55fba86586d34a404/SCOPE.md
[package]: https://github.com/mattpocock/skills/blob/b0618bc436ad893b3c5e84e55fba86586d34a404/package.json
[router-fix]: https://github.com/mattpocock/skills/blob/b0618bc436ad893b3c5e84e55fba86586d34a404/.changeset/ask-matt-read-skill-first.md
[ticket-fix]: https://github.com/mattpocock/skills/blob/b0618bc436ad893b3c5e84e55fba86586d34a404/.changeset/implement-ticket-reference.md
[mutation-fix]: https://github.com/mattpocock/skills/blob/b0618bc436ad893b3c5e84e55fba86586d34a404/.changeset/diagnosing-bugs-prove-mutation.md
[review-fix]: https://github.com/mattpocock/skills/blob/b0618bc436ad893b3c5e84e55fba86586d34a404/.changeset/code-review-standards-and-subagents.md
[question-fix]: https://github.com/mattpocock/skills/blob/b0618bc436ad893b3c5e84e55fba86586d34a404/.changeset/grilling-yes-accepts-recommendation.md
[architecture]: https://github.com/mattpocock/skills/blob/b0618bc436ad893b3c5e84e55fba86586d34a404/skills/engineering/improve-codebase-architecture/SKILL.md
[tdd]: https://github.com/mattpocock/skills/blob/b0618bc436ad893b3c5e84e55fba86586d34a404/skills/engineering/tdd/SKILL.md
[to-tickets]: https://github.com/mattpocock/skills/blob/b0618bc436ad893b3c5e84e55fba86586d34a404/skills/engineering/to-tickets/SKILL.md
[implement]: https://github.com/mattpocock/skills/blob/b0618bc436ad893b3c5e84e55fba86586d34a404/skills/engineering/implement/SKILL.md
[research]: https://github.com/mattpocock/skills/blob/b0618bc436ad893b3c5e84e55fba86586d34a404/skills/engineering/research/SKILL.md
[teach]: https://github.com/mattpocock/skills/blob/b0618bc436ad893b3c5e84e55fba86586d34a404/skills/productivity/teach/SKILL.md
[wait-what]: https://github.com/mattpocock/skills/blob/b0618bc436ad893b3c5e84e55fba86586d34a404/skills/productivity/wait-what/SKILL.md
[code-review]: https://github.com/mattpocock/skills/blob/b0618bc436ad893b3c5e84e55fba86586d34a404/skills/engineering/code-review/SKILL.md
