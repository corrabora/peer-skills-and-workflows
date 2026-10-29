# A planning practice for iterative, agent-assisted development

Date: **2026-10-28–29**. Status: proposed practice for operator consideration, developed by the Codex host and Claude Fable 5.1 XHigh peer. Research inputs: the [Codex study](iterative-plan-building-codex.md) and [Fable study](iterative-plan-building-fable.md). This document proposes a practice; it does not implement skills or record operator adoption.

**Maintain a clear objective, a shallow map of the whole effort, and an executable next increment. Build or investigate that increment, observe the result, and revise the plan before committing to more detail.** Planning should make the next useful action possible while preserving the ability to change direction.

The proposed foundation combines XP's close planning and engineering feedback, risk-driven investigation, integrated delivery, and product discovery. The central trade-off is less apparent certainty about distant tasks in exchange for earlier evidence and less work committed to unsupported assumptions. It requires enough architecture, quality practice, and access to decision owners to make adaptation responsible.

We recommend piloting this through **one small planning entry skill**, provisionally called `build-plan`, with conditional operations for framing work, preparing an increment, investigating a question, and updating the plan. The practice should earn its cost before these operations become separate skills or mandatory ceremonies.

The existing implementation pair remains responsible for its checks and coding turns. The existing quality review remains the quality review. Planning owns the intent, selection and preparation of increments, and reconciliation of evidence. **The plan-coordinator and its workflow are excluded from this recommendation's design and evaluation baseline.**

## Why this direction deserves a pilot

The independent studies distinguish research findings from practitioner methods and this proposed adaptation. Short feedback loops recur across agile, XP, spiral development, and continuous delivery, but the literature does not establish one universally best planning method. The evidence is strongest for mechanisms and necessary capabilities; the particular combination proposed here still needs evaluation.

Fowler describes concrete near-term planning with fluid longer-range plans. Boehm makes the next activity depend on consequential risk, which can justify either an experiment or more prior design. Jeffries places planning beside the engineering practices that make frequent change affordable. [Adaptive planning](https://martinfowler.com/articles/newMethodology.html), [Boehm's spiral](https://www.cs.hmc.edu/~markk/SWE_copies/boehmspiral.pdf), [XP practices](https://ronjeffries.com/xprog/what-is-extreme-programming/).

Recent AI evidence does not make a large generated backlog a reliable substitute for learning. DORA's observational findings associate AI adoption with greater throughput and instability. Anthropic's evolving harness experiments show both the usefulness of incremental verification and the need to remove process machinery as capabilities change. These sources motivate a measured pilot, not a promise of a particular speedup. [DORA 2025](https://services.google.com/fh/files/misc/2025_state_of_ai_assisted_software_development.pdf), [Anthropic 2025](https://www.anthropic.com/research/effective-harnesses-for-long-running-agents), [Anthropic 2026](https://www.anthropic.com/research/harness-design-long-running-apps).

The peer's research adds three useful qualifications. Change diffusion predicted failure in the systems studied by Mockus and Weiss; a small line count can conceal wide impact. Waterman and colleagues' interview study relates prior architectural effort to context and technical risk. Foote and Yoder explain how incremental growth can erode structure without continued design and consolidation. These support attention to reach, consequential design choices, and structural health, without establishing universal thresholds. [Change risk](https://mockus.org/papers/bltj13.pdf), [Agile architecture](https://citeseerx.ist.psu.edu/document?repid=rep1&type=pdf&doi=a6ea3073800f62c81415095d36b0b49b81a5f822), [Big Ball of Mud](https://www.laputan.org/mud/mud.html).

## Keep three views, with one maintained source for each fact

These are views of the work, not three mandatory files. A small task can fit in one brief. Reuse accepted requirements and project records instead of copying them into competing documents.

| View | What it answers | Level of detail |
| --- | --- | --- |
| Objective and constraints | Who benefits, what changes, why it matters, what must remain true, what investment is justified, and who owns consequential choices | Stable enough to steer the effort; revise when evidence or its owner changes it |
| Whole-effort map | What coherent capabilities may be needed, which external commitments and dependencies matter, and which assumptions could invalidate the approach | Rough sequence and alternatives; later work remains provisional |
| Current increment | What the pair will establish next, why it comes next, what it may change, and what evidence will settle its result | Precise enough to execute and evaluate within existing authority |

Keep a compact evidence and decision history alongside these views: the identified work state, actual observations, changed assumptions, reasons for plan changes, remaining questions and owners, and next action. Evidence should be inspectable; a completion label alone is insufficient.

## The planning loop

### 1. Frame the outcome without reopening settled intent

Recover the objective and governing sources from the request and existing artifacts. Establish the beneficiary, desired change, constraints, exclusions, and evidence of success. Identify the investment limit and consequential decisions still owned by the operator or another domain authority. A limit may be a budget, deadline, supported population, or a bounded experiment; do not manufacture a numeric target to fill a template.

Inspect the current system and its verification path. Understand relevant interfaces, deployed behavior, test limitations, and external dependencies. A high-level objective can be well understood while an important environmental assumption remains false.

### 2. Choose the next useful increment

Sketch enough of the end-to-end outcome to see missing capabilities and dependencies. Story mapping and integrated scopes offer ways to retain the whole journey while selecting a thin first result. The map supplies context; it does not commit the team to every possible future feature. [Patton's story mapping guide](https://jpattonassociates.com/wp-content/uploads/2015/03/story_mapping.pdf), [Shape Up scopes](https://basecamp.com/shapeup/3.3-chapter-12).

Identify the few decisions that would be expensive to reverse, their consequences and decision owners. Resolve them before dependent commitments require an answer; retain the rationale. For a consequential deferred choice, name the evidence or event that will make it due. Reuse existing decision records and omit empty ritual for trivial work. [Nygard on architecture decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions).

Choose between the following forms according to the uncertainty and cost of being wrong:

| Next action | Use it when | Its result must establish |
| --- | --- | --- |
| Delivery increment | The intended behavior is understood sufficiently to build safely, and running it will advance the objective | Integrated behavior plus the appropriate observation of its consequences |
| Spike or experiment | A specific unknown could change the approach, scope, or next commitment | An answer, its limits, and the decision it informs; an inconclusive result is valid |
| Walking skeleton | An end-to-end path through the real integration or delivery system is the consequential unknown | A thin working production foundation, with its intentionally limited behavior clear |
| Model or design investigation | Failure is costly or a system property is difficult to learn safely from ordinary implementation | Evidence about the important property, explicit assumptions, and implications for implementation |
| Domain or user inquiry | The unresolved question concerns value, policy, or actual use | An authoritative decision or observed evidence; agent agreement cannot supply it |
| Consolidation increment | Changes are becoming harder or the team's understanding no longer matches the implementation | A bounded structural improvement with preserved behavior and evidence addressing the identified difficulty |

A spike has a question, method, bounded investment, and stopping condition. Stop when the answer is adequate or the budget is exhausted; then decide whether to change approach, narrow scope, investigate further, or stop. Its code is disposable unless it independently meets production obligations. A walking skeleton is deliberately maintained production work. [Shore on spikes and walking skeletons](https://www.jamesshore.com/v2/books/aoad2/spike_solutions).

Neither “hardest first” nor “easiest feature first” is a universal rule. Prefer the smallest safe action with meaningful value or decision-changing evidence. Necessary foundation work should name its consumer or the uncertainty it resolves; otherwise it can expand without testing whether the investment matters.

Inspect or establish the end-to-end integration and verification path early. A walking skeleton is useful when that path is consequentially unknown; an existing brownfield path may only need to be exercised. A model, inquiry, or spike can come first when it resolves the blocking question more safely or cheaply.

### 3. Prepare the increment for paired implementation

The following fields are a prompt for necessary information, not a checklist that forces irrelevant prose.

```text
Purpose: outcome, requirement, or uncertainty advanced; why this comes next.
Starting point: relevant source and work identities; evidence already available.
Behavior or question: observable result, examples, and source of expected behavior.
Boundary: included work, expected reach, exclusions, invariants, and constraints.
Dependencies: required interfaces, environments, people, data, and decisions.
Evidence: procedure, observation point, expected result, limits, and needed independence.
Integration and exposure: how this becomes usable or informative; recovery as needed.
Authority and stop conditions: routine choices the pair owns; changes to route outward.
Return: actual evidence, remaining gaps, changed assumptions, and next recommendation.
```

An increment is ready when the pair can act within its authority and recognize its result **without inventing a consequential requirement**. Ordinary implementation uncertainty may remain. An investigation can be ready precisely because its technical answer is unknown. A delivery increment whose essential policy or test environment is unavailable may need a different next action.

Examples should expose rules and questions, not merely confirm the happy path. Tie expected results to governing intent or domain evidence. Tests generated from a mistaken expectation can all pass. [Example mapping](https://cucumber.io/blog/bdd/example-mapping-introduction/).

Distinguish three questions: where the expected behavior comes from; whether the executed check discriminates a relevant wrong result from the intended one; and whether the evaluator or test author needs independence from implementation. Record the source of expected behavior per increment, including an authorized design decision when the pair owns it. Separate test authors can still produce poor tests: ExecCritic's results depend on test quality as well as its separation of testing and repair roles. [ExecCritic, abstract and method](https://arxiv.org/html/2609.09133v1).

Use the existing review obligations, then choose stronger evaluation according to risk. Irreversible data changes, unresolved policy interpretation, and a check that could reward a proxy demo instead of the deliverable are explicit prompts to consider independent inspection, consumer acceptance, held-out examples, differential checks, or a model. Record the selected method and reason. The pilot should test these triggers; externally visible behavior alone does not impose a new human approval on every increment.

The pair should be able to read the brief without the planners' conversation, describe the first useful behavior or experiment, identify how success will be observed, and name what would make it stop. A consequential misunderstanding is a reason to improve the brief. Routine wording differences are not.

### 4. Build, integrate, and observe

Hand the current increment to [peer-implementation](../../skills/peer-implementation/SKILL.md) with the governing intent and evidence obligations. Let the pair determine its local check-and-code sequence. Keep the whole objective accessible as local checks advance. Use the existing quality review at its established point without awarding extra review credit to planning agreement.

Make the result observable at the relevant boundary: automated behavior, a representative environment, a real consumer, a user walkthrough, or controlled exposure. A working build, accepted increment, production release, and validated product outcome are different claims. Record which have actually been established.

Observe the intended deliverable itself. For integrated software delivery, run the relevant checks on its integrated state, normally the main line after authorized landing. If the pair's task ends with a candidate, record candidate verification separately and leave integration or exposure pending with its next owner. Passing checks grants no additional landing or publication authority.

Essential safety and correctness for exposed behavior belong in the increment. Do not defer them into an optional final hardening phase. For operational changes, the observation and recovery plan should be proportionate to the consequences. [Google SRE on canary releases](https://sre.google/workbook/canarying-releases/).

### 5. Replan when evidence changes the decision

Revisit the plan at increment completion, a material contradiction, an exhausted investigation budget, or a changed external constraint. Compare the expected evidence with what actually happened. Choose to continue, split, reorder, change approach, defer, or stop. Update affected behavior, checks, dependencies, and future options together; preserve the reason for the change.

Ask explicitly whether changes are becoming harder or understanding is diverging from implementation. If so, consider a bounded consolidation increment and record the response. Ordinary refactoring remains in the pair's engineering loop; essential quality is never postponed to an end-stage cleanup.

Agents may refine, split or reorder work and update the plan within the accepted objective, constraints, architecture and investment authority. Product policy, scope commitments, irreversible trade-offs, and accepted risk remain with their established decision owners unless already delegated. Record consequential plan changes, their reasons, supporting evidence, and who made them. Preserve existing authorization and do not ask for approval again merely because the plan was updated.

Changing a check to reflect an authoritative requirement is different from weakening the requirement to obtain a pass. A changed governing obligation goes to its owner unless that decision is already delegated. Corrections to a flawed check remain traceable to the requirement and receive applicable review. Recording an actual passing result is ordinary evidence reporting.

If value feedback is delayed, identify what remains unvalidated, when and by whom it will be observed, and how much dependent investment is justified meanwhile. Do not pretend every useful outcome can be measured during a coding turn.

The [customer-import example in the Codex study](iterative-plan-building-codex.md#worked-example-a-resumable-customer-import) shows this loop concretely: an interruption experiment informs the design; a thin running import reveals a misleading preview; that evidence changes the next increment instead of leaving the team to complete an obsolete feature list.

## How much process to use

| Situation | Proportionate response |
| --- | --- |
| Small, understood, reversible change | A concise brief and direct execution; the loop may take minutes |
| Uncertain product behavior | Early user or domain evidence, thin integrated behavior, and explicit pending value assumptions |
| New integration or brownfield migration | Inspect existing guarantees, investigate consequential compatibility and recovery questions, then expose a bounded slice |
| Safety-critical or difficult-to-reverse decision | More prior analysis, modeling, or design evidence before the affected commitment; iteration can happen in models and representative environments |
| Large effort with many consumers | A stronger whole-effort map and interface view, with explicit owners and integration milestones; still refine detailed work as evidence arrives |

Keep work in progress small enough to integrate and evaluate. One active delivery increment per pair, counting work awaiting required review as unfinished, is a starting pilot constraint, not a measured universal optimum. Additional concurrency needs independent dependencies and evaluation capacity, not just available agents. Consider expected subsystem and interface reach alongside reviewability and feedback; investigate and record unexpected expansion without treating a fixed file count as a universal cap. [Kanban Guide](https://kanbanguides.org/the-kanban-guide/), [DORA on small batches](https://dora.dev/capabilities/working-in-small-batches/).

## Skill boundary and evaluation

The proposed `build-plan` entry owns the current plan and selects the next useful planning operation. Investigation is conditional, with its own question and evidence record. Split these operations into separate skills only if the pilot reveals distinct invocation or ownership needs. [Peer-decision-making](../../skills/peer-decision-making/SKILL.md) supports consequential open choices; it should not become a compulsory debate over every increment. A candidate handoff can be tested by an implementer reconstructing the next action and its evidence, without creating a second quality-review workflow.

Pilot the practice on a small reversible change, an uncertain feature, and a consequential integration or migration. Use a neutral comparison: a concise objective, ordinary task decomposition, and the same implementation and quality practices. Record complexity, model versions, and interruptions so differences are not automatically credited to planning.

Measure time to useful evidence, time to an accepted outcome, planning and review effort, operator effort, rework from mistaken assumptions, unfinished-work age, and defects. Also record expected versus actual reach, the source of expected behavior, and how completion was observed. Keep product results alongside delivery results. An evidence-supported decision to stop can be successful learning. A small pilot diagnoses practical weaknesses; it cannot establish a general causal effect.

Retain steps that change decisions, expose important omissions, or make handoffs reliable at acceptable cost. Simplify steps that merely restate known information. If local optimization hides architectural or product coherence, strengthen the whole-effort view. If preparation delays learning without reducing downstream problems, reduce its detail. Re-evaluate the scaffolding when models, tools, or the work change.

If this direction is adopted, the next work is to implement the small entry skill and only the supporting guidance its conditional operations require, then run the pilot before expanding the skill set. Neither study establishes a universal iteration duration, document length, file-count limit, or benefit from adding planning peers to every task.

## Research and reconciliation provenance

The Codex host and a real Orca peer separately developed studies and froze initial positions before exchanging the full studies. Orca confirmed the requested and effective peer settings as `claude-fable-5-1` with `xhigh` effort. Two completed paired discussion rounds produced the common direction. The host added explicit attention to reach, difficult-to-reverse decisions, and consolidation. The peer withdrew universal evaluator-separation, skeleton-first, fixed-size, and human-only plan-edit rules; its publication study records the resulting evidence corrections.

The process had two disclosed limitations. The peer used six literature helpers despite the no-delegation instruction; it acknowledged the departure, stopped further delegation, verified the claims it reused, and retained the helpers' completed work. An audit found possible exposure to small host-edit fragments through shared-workspace metadata. Separately, a host status inspection accidentally exposed a preliminary peer outline after the host's position had frozen. No perfectly blinded comparison is claimed. The frozen originals, responses, source records and provenance account remain retained outside tracked deliverables; helper reports are not additional endorsements.

The recommendation rests on the cited evidence and the peers' reconciled reasoning. Their agreement does not establish an unknown empirical fact or constitute operator adoption.
