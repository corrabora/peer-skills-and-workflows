# Iterative plan building for agent-assisted software — Codex study

Research date: **2026-10-28**. Author: Codex host. Independently researched and initially frozen before reading the Claude Fable peer's study. This is research and a proposed practice, not an adopted workflow or an implementation of planning skills. The [joint recommendation](peer-plan-building-recommendation.md) records the reconciled direction; the [Fable study](iterative-plan-building-fable.md) preserves the independent perspective.

**Build a plan that purchases the next useful piece of evidence, then revise it against working software.** The most defensible foundation is a combination of adaptive planning, risk-directed investigation, small integrated increments, and continuous delivery. The plan should give paired agents enough intent, constraints, examples, and completion evidence to act independently on the next increment, while keeping later choices provisional. Fast generation makes the capacity to evaluate changes more important; it does not establish that a longer task list is a better plan.

The user's hypothesis is substantially supported as a design principle: short feedback loops, investigation of unknowns, and concurrent evolution of plans and code recur across the literature. Two qualifications matter. First, effective iteration requires engineering and organizational capabilities that make change affordable and bad news actionable. Second, agent scaffolding must itself be tested and simplified as models improve. The reviewed evidence does not establish a universally best methodology, an optimal iteration length, or that two agents outperform one in planning.

## Scope and method

This is a focused investigation, not a systematic literature review. Searches covered agile and XP planning, spiral development, incremental delivery, story mapping, discovery, flow, organizational performance, and 2025–2026 agent practice. I sought original method authors, research papers, first-party engineering accounts, and negative or qualifying results. Selection favored sources that explain a mechanism, measure an outcome, or expose a boundary that could change the recommendation. Company examples illustrate practices; they do not establish that a process caused corporate success.

The existing spec-driven development studies supplied format and citation conventions. Their conclusions were not treated as independent evidence. **The repository's plan-coordinator and associated workflow were excluded as research inputs.** The existing [peer-implementation skill](../../skills/peer-implementation/SKILL.md) was read only to understand the eventual handoff interface.

Labels distinguish **measured evidence**, **practice** prescribed or described by its originators, and **adaptation** proposed here. Survey associations, controlled experiments, and engineering experience reports are not interchangeable. The source guide records reading depth; some sources were read in relevant sections rather than cover to cover. Full books were not inferred from public excerpts. Primary PDFs and their content hashes are retained outside tracked deliverables.

The initial study and position were preserved before peer exchange. A later status inspection accidentally exposed a preliminary peer outline after that freeze; the host's position was not changed from that preview. The [joint recommendation's provenance account](peer-plan-building-recommendation.md#research-and-reconciliation-provenance) also describes helper use and shared-workspace metadata exposure on the peer side. This was separate research followed by discussion, with those limitations, rather than a perfectly blinded comparison.

## What the evidence supports—and what it does not

| Source and design | Relevant finding | Limit on interpretation |
| --- | --- | --- |
| Dybå and Dingsøyr, 2008 systematic review of research through 2005 | The search identified 1,996 publications and 36 empirical studies. The authors judged the overall evidence for benefits and limitations of agile adoption very low, citing study quality, inconsistency, and indirectness. | This is a historical baseline, not a verdict on all later research. It prevents treating the early agile canon as settled experimental science. [Review, especially §5.2](https://cs.ecu.edu/gudivada/research/papers/agile-software-development-systematic-review.pdf). |
| DORA 2025, interviews and global survey | More than 100 hours of qualitative data and nearly 5,000 respondents underpin the report. AI adoption is associated with greater delivery throughput and instability. Small batches moderate the relationship with product performance and friction favorably, while reducing some perceived individual effectiveness gains. | Observational, largely self-reported data. The report explicitly cautions that its regression comparisons should not automatically be called causal effects. No controlled comparison of our proposed agent planning practice. [Report, pp. 33–63 and methodology](https://services.google.com/fh/files/misc/2025_state_of_ai_assisted_software_development.pdf). |
| Bernardo et al., analysis of 162,653 PRs in 87 projects, complemented by 450 survey responses | Delivery time after adoption of TravisCI was shorter in only 51.3% of projects. A CI service did not reliably accelerate delivery of merged PRs. | Measures merge-to-release delay, with release-tag attribution limitations. Adoption of a service is not adoption of the complete integration practice. [Study, §§1, 4, 7](https://arxiv.org/html/2305.16365). |
| Kohavi et al., 2020 first-party synthesis of online experimentation | Authors working at Google, LinkedIn, and Microsoft report that roughly two-thirds of promising implemented ideas failed to improve their intended metrics; failure rates were higher in optimized search contexts. | An experience synthesis of many experiments, not randomized assignment of organizations to methodologies. The rate is context-dependent. It supports testing value assumptions, not predicting that two-thirds of our work will fail. [“Test everything” section](https://pmc.ncbi.nlm.nih.gov/articles/PMC7007661/). |
| Paradis et al., 2024 randomized trial with 96 Google engineers | Estimated about 21% less time on a specified enterprise task with AI, with a wide confidence interval. | A controlled task and internal tools, not longitudinal product delivery or modern paired agents. [Abstract, methods, limitations](https://arxiv.org/html/2410.12944v2). |
| METR, early-2025 randomized trial, 16 experienced developers and 246 tasks in familiar repositories | AI availability increased task time by 19%; participants nevertheless believed it had helped. | Particular developers, repositories, and early-2025 tools. Not a universal slowdown claim. [Original report](https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/). |
| METR, February 2026 follow-up | Raw estimates moved toward speedup, but the researchers judged the signal unreliable because of recruitment/task selection and concurrent-agent time measurement problems. | The update does not establish a reliable current effect size, nor does it justify indefinitely applying the earlier slowdown. [Research update](https://metr.org/blog/2026-02-24-uplift-update/). |
| Anthropic, November 2025 and March 2026 engineering experiments | Incremental work, durable progress state, and end-to-end evaluation addressed failures in long-running development. A later experiment removed explicit sprint scaffolding as a stronger model made it less useful. | Vendor experience on selected application-building tasks, with evolving prompts and models; not a controlled test of agile planning. [2025 harness](https://www.anthropic.com/research/effective-harnesses-for-long-running-agents), [2026 iteration](https://www.anthropic.com/research/harness-design-long-running-apps). |

These results suggest a more useful research question than “Does Agile win?”: **which feedback loops does a practice shorten, what does it cost, and which failures does it expose before further investment?** That question can be answered for our work without pretending that an industry-wide average determines the right process for a particular repository.

### Historical evidence reinforces the mechanism, with limits

Two further source checks were completed after the initial freeze, without changing the independent recommendation. Larman and Basili's history traces iterative development well before the Agile Manifesto. They explicitly present a chronology rather than a comparative analysis, and include approaches with substantial prior specification as well as more evolutionary ones. Their historical account supports continuity of the ideas, not a causal estimate of their superiority. [Larman and Basili 2003, opening and historical accounts](https://www.craiglarman.com/wiki/downloads/misc/history-of-iterative-larman-and-basili-ieee-computer.pdf).

MacCormack, Verganti, and Iansiti studied 29 projects from 17 Internet software companies. Their paper associates flexibility with early market feedback, architectural investment, and experience across product generations. The author-written summary describes comparative product ratings from 14 experts and a resource-productivity measure based on adjusted lines of code per person-day. This small observational historical study offers more than a success story, but neither causal proof nor an outcome measure we should copy. Its relevant lesson is that architecture can enable adaptation. Access was limited to the paper's abstract and the author's summary; the PDF mirrors failed. [Paper abstract](https://www.researchgate.net/publication/227447355_Developing_Products_on_Internet_Time_The_Anatomy_of_a_Flexible_Development_Process), [MacCormack's research summary](https://www.library.hbs.edu/working-knowledge/why-evolutionary-software-development-works).

## The planning mechanisms worth retaining

### Adaptive planning keeps a long view and a short commitment

**Practice.** The Agile Manifesto combines frequent valuable delivery, responsiveness to changing requirements, technical excellence, and periodic improvement of the process. Its unit of progress is working software. These are commitments about how work proceeds, not evidence that a particular ceremony improves outcomes. [Agile principles](https://agilemanifesto.org/principles.html).

Fowler's account gives the operational mechanism: an integrated, tested system reveals facts that documents and unfinished code can conceal. Long-range plans remain fluid; near-term plans become concrete enough to execute. Customer involvement makes scope adaptation possible within a budget. His argument assumes a capable team and an engaged customer; it is explicitly not a promise that process substitutes for skill. [“The New Methodology,” adaptive planning and iterations](https://martinfowler.com/articles/newMethodology.html).

**Adaptation.** Maintain three levels of resolution: the objective and constraints; a rough map of plausible increments and dependencies; and a precise next increment. Do not expand distant options into instructions just because an agent can generate them cheaply. Keep actual external commitments visible, including deadlines and interfaces. A provisional roadmap is still useful for exposing a missing dependency or an implausible total scope.

### XP supplies the engineering engine beneath iteration

**Practice.** Ron Jeffries describes XP planning as steering: the customer sets priorities using programmer estimates; release plans are revised as actual progress becomes known; iteration planning selects a smaller amount of work. This operates alongside customer tests, pair programming, test-driven development, continuous integration, simple design, and continual design improvement. These practices are mutually supporting: frequent reprioritization is easier when tests and refactoring keep changes affordable. [Jeffries, “What is Extreme Programming?”](https://ronjeffries.com/xprog/what-is-extreme-programming/).

**Adaptation.** Keep the existing implementation pair responsible for turning a slice into working behavior. Planning supplies the intended outcome, examples, constraints, and risks; the pair decides the local sequence of checks and code changes. Planning should not pre-write every test, function, or coding turn. That would duplicate the pair's work while making its discoveries look like deviations.

An acceptance example must have an authoritative source for the expected behavior. Two agents can agree on an incorrect interpretation, and tests generated from that interpretation can pass. Pairing helps examine an argument; external facts, operator decisions, and actual execution remain necessary evidence.

### Risk determines whether the next step is a spike, a model, or production code

**Practice.** Boehm's spiral begins each cycle with objectives, alternatives, and constraints, then resolves consequential risks before choosing the next development step. Resolution can involve prototypes, benchmarks, simulations, user investigation, or analysis. The method can justify more formal specification when stable requirements and severe failure consequences make that worthwhile. Its contribution is a decision rule for selecting effort, not a requirement to pass through every possible activity. [Boehm 1988, pp. 65, 69–71](https://www.cs.hmc.edu/~markk/SWE_copies/boehmspiral.pdf).

James Shore distinguishes a spike—a small technical experiment whose code is discarded—from a walking skeleton, the first thin end-to-end production implementation. The distinction prevents learning code from silently becoming an unsupported production foundation. Only the public excerpt of this chapter was read. [“Spike Solutions”](https://www.jamesshore.com/v2/books/aoad2/spike_solutions).

**Adaptation.** Before a spike, name the decision, unknown, plausible alternatives, observation method, effort limit, and result that changes the choice. Finish with evidence and a plan change, even if the result is inconclusive. “Investigate the database” is not sufficient. “Determine whether the current database can enforce this uniqueness invariant under concurrent requests; compare the two feasible approaches; stop at the agreed budget” is actionable.

Do not spike every uncertainty. If a production slice can answer the question cheaply and safely, build it. Conversely, an appealing demo should not displace investigation of a catastrophic feasibility risk. When a question is about user needs or business policy, technical experimentation alone cannot answer it.

### Slicing preserves user purpose while reducing commitment

**Practice.** Patton's story map holds the whole user journey in view and cuts release slices across it. A usable release comprises the tasks a particular user needs to reach a goal; later details remain visible without belonging to the first release. The map evolves with understanding and does not replace precise models where those are required. [Story Map Concepts and Process](https://jpattonassociates.com/wp-content/uploads/2015/03/story_mapping.pdf).

Shape Up contributes two complementary ideas. Shaping makes a solution bounded and concrete enough to pursue while leaving implementation detail open. During building, teams discover scopes that integrate frontend and backend work, rather than tracking disconnected lists by specialty. Basecamp's six-week cycle and separate shaping track are parts of its operating model, not experimentally established constants. [Principles of Shaping](https://basecamp.com/shapeup/1.1-chapter-02), [Map the Scopes](https://basecamp.com/shapeup/3.3-chapter-12).

**Adaptation.** Ask what can be demonstrated or used after the slice, and by whom. Prefer one complete path for one user or consumer over “all schemas,” then “all services,” then “all screens.” Infrastructure and migrations still need slices: a consumer successfully exercising the new path, a reversible migration of one bounded population, or a tested compatibility seam can be meaningful progress. Necessary enabling work should identify the next behavior it unlocks, so it cannot become an indefinite platform project.

“Small” is constrained by useful observation, integration, and review. Splitting one coherent behavior into ten dependent fragments can add overhead without buying earlier learning. A merged but disabled feature may provide engineering feedback before it provides product feedback; record which one has actually happened.

### Examples expose missing decisions before implementation

**Practice.** Example Mapping separates rules, examples, unanswered questions, and stories split out of scope. Matt Wynne uses the shape of the discussion to detect excessive complexity or uncertainty. His guidance permits minor questions to remain when the group judges they can be resolved during development; it does not demand exhaustive specification. [“Introducing Example Mapping”](https://cucumber.io/blog/bdd/example-mapping-introduction/).

**Adaptation.** Refine only the next slice. Include normal behavior and the consequential boundary or failure cases. An unknown expected result is a question, not a test oracle. Record who or what can answer it. A minor, reversible implementation choice may remain with the pair; an unresolved data-loss policy or externally visible behavior should be resolved or excluded before the pair builds against it.

### Continuous delivery makes small plans economically viable

**Practice and measured association.** DORA describes continuous delivery as keeping changes releasable safely and sustainably on demand, distinguished from deploying every change immediately. It depends on testing, automation, observability, and keeping the system deployable. Its research associates those capabilities with quality and delivery performance. [Continuous delivery](https://dora.dev/capabilities/continuous-delivery/).

Fowler defines continuous integration through frequent actual integration and automated verification, including prompt repair of a broken build. A CI service on isolated branches does not supply the same feedback. [Continuous Integration](https://martinfowler.com/articles/continuousIntegration.html).

**Adaptation.** The first increment should establish or exercise the real integration and verification path. For a new service, a walking skeleton should traverse its important boundaries and run in a representative environment. For an existing system, the corresponding step may be a characterization test and one safe change. Include deployability, compatibility, and observability in the slice when they affect its use. Defer optional behavior before deferring the correctness required for behavior already exposed.

### Flow controls how much work starts; discovery controls what deserves to start

**Practice.** The Kanban Guide requires explicit workflow boundaries, control of work in progress, and attention to work age, throughput, and cycle time. Its service-level expectation is a probabilistic forecast based on historical cycle time, or initially a guess—not a guarantee. [May 2025 guide](https://kanbanguides.org/the-kanban-guide/).

DORA's WIP guidance counts the whole path from idea to customer, including queues and otherwise invisible work. Increasing starts can worsen the actual bottleneck. [Work in process limits](https://dora.dev/capabilities/wip-limits/).

Torres's opportunity solution tree links a desired outcome to customer needs, candidate solutions, and assumption tests. This preserves alternatives instead of treating the first solution as the objective. It is a practitioner method, not a controlled productivity result. [Opportunity Solution Trees](https://www.producttalk.org/opportunity-solution-trees/).

**Adaptation.** Begin with one active delivery slice per implementation pair, counting unresolved review work as unfinished. This is a pilot default, not a universal law. Add parallel work when its ownership and integration boundaries are credible and downstream capacity exists. Keep discovery close enough to implementation to prevent starvation, but do not build a large inventory of polished plans whose assumptions have not survived contact with code or users.

## What effective organizations actually illustrate

The useful comparison is between mechanisms, not company prestige.

| Organization or setting | First-party practice | Transfer and boundary |
| --- | --- | --- |
| Etsy | The 2010 engineering account describes tests and paired reviews before deployment, automatic recording of each deploy, and correlation with application metrics. The 2012 overview reports more than 10,000 deployments in 2011. | Frequent release depended on seeing consequences and attributing failures. These historical reports do not establish current practice or isolate the cause of Etsy's business outcomes. [Tracking Every Release](https://www.etsy.com/codeascraft/track-every-release), [The Etsy Way](https://www.etsy.com/codeascraft/the-etsy-way/). |
| Google SRE | Small self-contained releases, reproducible builds, automation, and canary evaluation limit exposure and support rollback decisions. | A release plan needs observation and recovery, not just a deployment command. A canary's success only covers the population, duration, and signals observed. [Canarying Releases](https://sre.google/workbook/canarying-releases/). |
| AWS critical distributed systems | Engineers used TLA+ and model checking to expose subtle design defects and explore changes that were difficult to validate through ordinary tests. | Early learning may require an abstract model rather than an early public release. Model assumptions and implementation correspondence still matter; the paper discusses limitations for emergent performance problems. [Newcombe et al. 2015](https://cdn.amazon.science/67/f9/92733d574c11ba1a11bd08bfb8ae/how-amazon-web-services-uses-formal-methods.pdf). |
| Basecamp | Bounded shaping and integrated scopes constrain investment while preserving builders' judgment. | Adopt the distinction between enough direction and excessive detail; do not copy the calendar or organizational structure without testing fit. [Shaping](https://basecamp.com/shapeup/1.1-chapter-02), [Scopes](https://basecamp.com/shapeup/3.3-chapter-12). |
| Large online experimentation platforms | Success criteria, instrumentation, controlled exposure, and repeated experiments make rejection of plausible ideas routine. | Product learning needs an outcome measure. Low-traffic or specialized systems may require interviews, workflow observation, benchmarks, or customer acceptance instead of A/B tests. [Kohavi et al.](https://pmc.ncbi.nlm.nih.gov/articles/PMC7007661/). |

DORA adds two cross-organizational conditions. Loosely coupled teams can test and deliver without continual external coordination; changing the architecture's label does not ensure that capability. A high-trust culture that makes information available and treats failure as an opportunity for inquiry predicts stronger delivery outcomes. [Loosely coupled teams](https://dora.dev/capabilities/loosely-coupled-teams/), [Generative organizational culture](https://dora.dev/capabilities/generative-organizational-culture/).

**Inference.** A planning skill cannot compensate for a review queue nobody owns, inaccessible domain knowledge, or permission structures that prevent routine decisions. It can make those dependencies visible before agents start. Likewise, a learning process fails if its status model rewards adherence to an obsolete plan and discourages reporting contradictory evidence.

## What agents change

The durable principles survive, but their operating costs and failure patterns change.

1. **Generation can outrun evaluation.** The DORA AI Capabilities Model treats small batches as a way to translate generation speed into useful team outcomes, while acknowledging possible per-batch overhead. Size work by the ability to understand, verify, and integrate it, not by how much an agent can emit. [Model, pp. 44–51](https://services.google.com/fh/files/misc/2025_dora_ai_capabilities_model.pdf).
2. **Conversation memory is insufficient shared state.** Anthropic's 2025 account reports unfinished work, reconstruction costs, and premature completion across sessions. Preserve the current objective, identified code state, verified behavior, open questions, and next action in accessible artifacts. Its extensive fixed feature list is a harness choice, not evidence that all future plans should be fully expanded. [Long-running agent harness](https://www.anthropic.com/research/effective-harnesses-for-long-running-agents).
3. **Process detail can expire.** Anthropic's 2026 experiment removed sprint machinery as model capability changed, retained useful planning and evaluation, and still found core functionality gaps. This is direct counterevidence to making today's orchestration granularity permanent. The study does not prove that product feedback or release control became unnecessary. [Harness design, simplification and results](https://www.anthropic.com/research/harness-design-long-running-apps).
4. **Confidence and agreement are weak completion signals.** In this proposed practice, an agent's persuasive summary cannot substitute for executed checks or a real consumer's response. That is a design precaution, not a measured estimate of the error rate of this particular pair.

Planning should therefore formalize the intent and evidence boundary while leaving the pair room to solve the work. Require explicit changes when new facts invalidate that boundary. Avoid substituting a large volume of machine-generated requirements for real stakeholder understanding.

A supplemental March 2026 field report examines three modernization programs across successive versions of the Chiron platform. The authors report that faster early analysis and planning initially coincided with weaker downstream outcomes; later versions added acceptance validation and repository review alongside better results. This is suggestive industrial evidence, with substantial limitations: retrospective records and recall, changing task granularity, simultaneous model and workflow changes, modeled staffing effort, no post-release reliability measure, and authors who lead the supplying company. It does not isolate planning's effect or validate our proposed workflow. [Armesto and Kolb, v1, §§3–7](https://arxiv.org/html/2603.20028v1).

## Proposed plan-building practice

This section is an **adaptation** to pilot, not a prescription directly tested in the cited research.

### 1. Frame the outcome and investment

The operator and planning agents establish the beneficiary, the desired change, current evidence of the problem, constraints, exclusions, and an investment limit. Reuse an already understood objective; do not reopen settled intent. Record the evidence that would establish success or justify stopping. Identify who can decide product policy and irreversible trade-offs.

Result: a concise outcome brief. A small bug fix may need only a few sentences and a reproducer.

### 2. Inspect reality and choose the next uncertainty to reduce

Inspect the repository, deployment path, tests, interfaces, and relevant domain sources. Sketch the whole solution or user journey shallowly enough to expose dependencies. Identify assumptions whose failure would invalidate the proposed approach. Compare a small set of feasible alternatives, including reuse, reducing scope, or doing nothing when relevant.

Choose a spike or model only when its answer can change a consequential decision. Otherwise choose the smallest safe integrated behavior that advances the objective and teaches something useful. Risk and value both matter: neither “hardest first” nor “easiest demo first” is a universal ordering rule.

Result: a rough increment map, significant unknowns, and a reason for the next action.

### 3. Make the next increment executable

Specify its observable behavior or learning question, boundaries, authoritative examples, important invariants, prerequisites, verification, and integration/exposure approach. Include the expected evidence and the decision it will inform. Leave ordinary implementation detail to the pair.

The readiness question is: **can the pair act within its authority and recognize success without inventing a consequential requirement?** A ready spike needs a bounded question and method; it does not need the technical answer in advance. A ready delivery slice may retain ordinary implementation uncertainty. Neither needs a complete decomposition of the future project.

### 4. Execute and observe through the existing practices

Pass the identified current slice and its evidence obligations to peer-implementation. Keep quality review as an existing integration responsibility. The pair may discover that the slice is wrong or infeasible; the planning practice must accept that result as input. Completion of coding, quality verification, release, and validation of the desired outcome are distinguishable states.

Use the appropriate observation point: an automated test, representative environment, consumer integration, user walkthrough, controlled deployment, or longer product measurement. If real feedback is unavailable, say what remains unvalidated and limit further investment accordingly.

### 5. Replan from the evidence

At completion, a material contradiction, or exhaustion of the investigation budget, compare evidence with the intended result. Continue, split, change direction, stop, or route a decision to its owner. Update the current plan with the reason and source; mark displaced assumptions and options as superseded. Preserve the objective unless its owner changes it.

The next slice becomes detailed only now. A mechanical edit or a fully understood change can pass through these decisions almost immediately. The procedure should not force a separate meeting, second peer debate, or approval for every ordinary choice.

## Worked example: a resumable customer import

Assume the operator wants customers to import records without support intervention. The following choices and thresholds are illustrative, not facts about this repository.

| Point in the work | Plan and evidence | Consequence |
| --- | --- | --- |
| Frame | Target one existing customer segment and one file format. Preserve tenant isolation and accepted duplicate policy. Success requires a user completing the import and understanding rejected rows; speed is measured separately. | Mapping every future connector is unnecessary. An unsettled duplicate policy goes to its owner. |
| Inspect | Trace one current import through validation, persistence, and error reporting. Discover that interruption can leave an uncertain partial result. | Test recovery before committing to a general background-job architecture. |
| Spike | Use a representative fixture to determine what state survives interruption and whether the existing persistence mechanism can support an idempotent retry. Define the experiment and effort limit before running it. | Evidence chooses the first viable design or establishes that more investigation is needed. Prototype code is not automatically retained. |
| First integrated slice | One authenticated customer imports a bounded supported file, sees a result, and cannot affect another tenant. Include failure evidence and a representative running demonstration. | A real user can expose misunderstandings while scope remains small. |
| New information | Users interpret the preview as a completed import. Execution is correct, but the workflow is misleading. | Revise the next slice to fix the interaction; do not continue implementing scheduled connector features just because they were listed. |
| Next slices | Add interruption/retry behavior under the chosen policy, then expand size or formats only as evidence and priorities justify. Recheck compatibility and recovery at each exposure boundary. | Later work follows learning. Required safety for the currently exposed slice is never postponed to optional “hardening.” |

The initial plan is sufficient to start, yet it remains responsible for the whole objective. It names why future work exists without pretending to know its final implementation.

## Alternatives and decisive trade-offs

| Direction | Where it helps | Why it is not the default recommendation |
| --- | --- | --- |
| Detailed full-project specification and task graph | Stable contractual interfaces, severe irreversible consequences, tightly coupled systems with costly changes | Many details become commitments before the evidence exists; preparation and maintenance can delay useful feedback. Use selectively where risk justifies it. |
| Pure prompt-and-build | Small reversible, well-understood tasks with fast reliable checks | Missing intent and completion evidence make delegation fragile. Preserve a compact brief even when the process is nearly immediate. |
| Adopt Scrum unchanged | Teams needing its defined responsibilities and inspection cadence | Scrum is deliberately incomplete about technical practices. Its guide supports adaptation and usable increments, but adopting its roles and events is a larger organizational choice than this task needs. [2020 Scrum Guide](https://scrumguides.org/scrum-guide.html). |
| Adopt Shape Up unchanged | Established product teams able to shape bounded bets and vary scope | Its cadence and shaping/building separation may not suit uncertain infrastructure or an operator working with one pair. Reuse the useful mechanisms rather than assuming fit. |
| Adaptive planning with risk-directed slices | Changing knowledge, controllable increments, an accessible outcome owner, and a working verification path | Requires ongoing attention and honest reprioritization. It trades early schedule precision for earlier evidence and limits on wasted investment. |

The strongest objection to the proposed direction is local optimization: agents can complete small pieces while missing architectural constraints or a coherent product. The remedy is a persistent whole-objective view, early investigation of cross-cutting risks, and explicit end-to-end success evidence. If those cannot be obtained incrementally, increase design and investigation before committing to the affected work.

## Evaluate the practice before turning it into permanent ceremony

Pilot on a small reversible change, an uncertain feature, and a change with a consequential integration or migration risk. These are coverage examples, not a statistically powered experiment. Compare with recent similar work where possible, record differences in complexity and model versions, and avoid attributing every improvement to planning.

Measure time to the first useful running result and first decision-changing observation; total time to an accepted outcome; planning and review effort; unfinished work age; rework caused by mistaken assumptions; and defects or operational regressions. Count a justified stop as potentially valuable learning. Do not reward document volume, tests written, generated code, or completed tickets as substitutes for outcomes.

DORA's current delivery measures cover change lead time, deployment frequency, failed deployment recovery time, change fail rate, and deployment rework rate. Use them at a consistent service boundary over time; add product evidence because delivery measures alone do not show whether users benefited. [DORA metrics guide](https://dora.dev/guides/dora-metrics/).

Retain a planning step when it changes a consequential decision, exposes a defect in the intended work, or enables a reliable handoff at acceptable cost. Simplify it when it only restates what is already known. The initial skill design should be small enough to revise after this pilot, with separate entry points only for genuinely different decisions or artifacts.

## Source guide and refresh notes

All links were accessed during this investigation. **F** means the cited short source or excerpt was read; **P** means relevant portions of a longer source were inspected; it does not claim complete book or paper coverage.

| Sources | Access and use |
| --- | --- |
| [Agile Manifesto principles](https://agilemanifesto.org/principles.html); [Jeffries on XP](https://ronjeffries.com/xprog/what-is-extreme-programming/); [Fowler on adaptive methods](https://martinfowler.com/articles/newMethodology.html) | F. Foundational prescriptions and their mechanisms. Don Wells's original XP site timed out, so it is not used as inspected evidence. |
| [Boehm 1988](https://www.cs.hmc.edu/~markk/SWE_copies/boehmspiral.pdf) | P, especially process cycle and evaluation, pp. 65–71; PDF retained. Risk-directed selection, including cases for stronger prior design. |
| [Dybå and Dingsøyr 2008](https://cs.ecu.edu/gudivada/research/papers/agile-software-development-systematic-review.pdf) | P, abstract, methods outline, evidence evaluation §5.2; PDF retained. Historical evidence limitations. |
| [Larman and Basili 2003](https://www.craiglarman.com/wiki/downloads/misc/history-of-iterative-larman-and-basili-ieee-computer.pdf); [MacCormack et al. abstract](https://www.researchgate.net/publication/227447355_Developing_Products_on_Internet_Time_The_Anatomy_of_a_Flexible_Development_Process) and [author's summary](https://www.library.hbs.edu/working-knowledge/why-evolutionary-software-development-works) | P for the historical paper; F for the abstract and short author summary. Supplemental checks after the initial freeze. The MacCormack full paper was unavailable; its findings are qualified accordingly. |
| [DORA 2025 report](https://services.google.com/fh/files/misc/2025_state_of_ai_assisted_software_development.pdf); [AI Capabilities Model](https://services.google.com/fh/files/misc/2025_dora_ai_capabilities_model.pdf) | P. Report v2025.2 downloaded after web size limit; selected findings, causal-comparison caveat, and methodology inspected. Companion model v2025.1, especially pp. 44–51. Recheck annual report, errata, and survey methods before updating effect claims. |
| DORA [small batches](https://dora.dev/capabilities/working-in-small-batches/), [continuous delivery](https://dora.dev/capabilities/continuous-delivery/), [team coupling](https://dora.dev/capabilities/loosely-coupled-teams/), [WIP](https://dora.dev/capabilities/wip-limits/), [culture](https://dora.dev/capabilities/generative-organizational-culture/), [metrics](https://dora.dev/guides/dora-metrics/) | F/P, cited definitions and mechanisms. Maintained research summaries, not additional independent datasets. |
| [Bernardo et al.](https://arxiv.org/html/2305.16365) | P, abstract, results summary, validity limitations. Negative qualification on CI-service adoption. |
| [Shore spike excerpt](https://www.jamesshore.com/v2/books/aoad2/spike_solutions); [Patton map guide](https://jpattonassociates.com/wp-content/uploads/2015/03/story_mapping.pdf); [Wynne example mapping](https://cucumber.io/blog/bdd/example-mapping-introduction/) | F for excerpt and guides. Practice descriptions, not experiments. |
| Shape Up [shaping](https://basecamp.com/shapeup/1.1-chapter-02) and [scopes](https://basecamp.com/shapeup/3.3-chapter-12); [Torres discovery](https://www.producttalk.org/opportunity-solution-trees/); [Scrum Guide](https://scrumguides.org/scrum-guide.html); [Kanban Guide](https://kanbanguides.org/the-kanban-guide/) | P/F for relevant chapters/sections. No claim to reading the whole Shape Up book or validating the methods causally. |
| [Fowler integration](https://martinfowler.com/articles/continuousIntegration.html); [Etsy tracking](https://www.etsy.com/codeascraft/track-every-release); [Etsy overview](https://www.etsy.com/codeascraft/the-etsy-way/); [Google canarying](https://sre.google/workbook/canarying-releases/) | P/F. Technical practices and dated first-party accounts. |
| [AWS formal methods](https://cdn.amazon.science/67/f9/92733d574c11ba1a11bd08bfb8ae/how-amazon-web-services-uses-formal-methods.pdf); [Kohavi et al.](https://pmc.ncbi.nlm.nih.gov/articles/PMC7007661/) | P. PDF retained for AWS; cited experience, mechanisms, and limitations inspected. |
| [Paradis et al.](https://arxiv.org/html/2410.12944v2); METR [2025](https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/) and [2026](https://metr.org/blog/2026-02-24-uplift-update/) | P/F. Different interventions and settings; do not pool effect sizes. Refresh original experiments, not headlines. |
| Anthropic [2025](https://www.anthropic.com/research/effective-harnesses-for-long-running-agents) and [2026](https://www.anthropic.com/research/harness-design-long-running-apps) | P, failure modes, incremental work, evaluation, and removal of scaffolding. Vendor experiments; recheck against current models and representative tasks. |
| [Armesto and Kolb 2026, v1](https://arxiv.org/html/2603.20028v1) | P, study design, results, validity and conflict disclosures, §§3–7. Supplemental check after the initial freeze; retrospective industrial experience, not causal workflow evidence. |

Serrador and Pinto's 2015 study was discovered and its author-posted abstract inspected, but the full PDF could not be reliably retrieved. It is not used for a quantitative conclusion here. The present search also did not establish a controlled comparison of alternative planning workflows for paired frontier agents. That remains the central evidence gap the proposed local pilot should address.
