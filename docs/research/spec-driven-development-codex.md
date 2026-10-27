# Spec-driven development as disciplined, revisable planning — Codex study

Research date: **2026-10-26**. Author: the Codex host. The initial study and position were frozen before reading the Fable peer's work; this delivery includes corrections from mutual review. Status: research and a proposed direction for later skill design. This study does not adopt a workflow or authorize implementation. See the [joint workflow recommendation](peer-spec-writing-recommendation.md) for the reconciled direction.

**The strongest basis for adapting spec-driven development is a maintained argument connecting stakeholder intent, explicit assumptions, observable behavior, design choices, and evidence.** Writing a specification is only one part of that practice. The useful mechanisms are collaborative discovery, precise examples and contracts, deliberate searches for counterexamples, risk-directed refinement, and propagation of changes into the plan and its verification obligations. The evidence supports particular mechanisms in particular settings; it does not establish that a larger specification, an AI-generated task list, or peer agreement makes a project successful.

For software and systems planning, I recommend a small authoring workflow in which two peers independently develop the next consequential part of a specification, reconcile their evidence and options, and bring value judgments to the human operator before treating them as settled. The resulting plan should explain **what evidence each work package will produce and which decision that evidence enables**. The initial workflow proposal below is preserved as an independent position; the joint recommendation refines it into independent discovery followed by one maintained draft.

## Scope, method, and evidence boundaries

This is a focused literature investigation, not a systematic review or a reproduced experiment. Searches covered foundational requirements engineering, collaborative specification, specification validation, requirements evolution, technical planning, and contemporary AI SDD. Citation trails led from original papers to author copies, university repositories, publisher excerpts, NASA and SEI publications, and maintained tool sources. Searches included adverse and null results. Social posts and aggregators were discovery aids, not evidence for technical claims.

The selection asks whether a source explains a usable mechanism, tests an outcome, or supplies a necessary boundary on the recommendation. The source guide below records exact reading locations and refresh routes. Paywalled standards are not used for uninspected clause-level claims. Book coverage is explicitly limited to the publicly supplied chapter. Current tool documentation is a dated snapshot; tool behavior was inspected as text and was not executed.

The repository's earlier research informed presentation and citation discipline only. **The current plan-coordinator and its governing workflow were excluded as research inputs and as a basis for the proposed design.** Existing peer and succession skills are integration contracts, not evidence that their mechanisms improve specifications.

Labels used below:

- **Evidence:** a result or mechanism reported by its primary source, with its limits.
- **Practice:** a procedure the source teaches or demonstrates, without implying a universal causal effect.
- **Adaptation:** this study's proposed application to our planning and agent setting.

## What “spec-driven” needs to mean

Three distinct claims often travel under the same name:

| Claim | What must actually be true | What would be insufficient |
| --- | --- | --- |
| Specifications guide development | A builder can recover the intended observable behavior and constraints. | A polished document with invented decisions. |
| Specifications remain authoritative | Changes to intent, design, tests, and implementation are reconciled against an identifiable accepted version. | Writing the spec first and abandoning it. |
| Specifications can generate or verify software | A transformation or checking process exists, and its semantic limits are understood. | Calling natural-language generation “execution” or treating generated tests as an independent oracle. |

These are analytical distinctions for this study, not a universal taxonomy. GitHub Spec Kit's manifesto makes the strongest claim, describing specifications and plans as generative sources and describing continuous refinement and operational feedback. Its claim that this eliminates the specification–implementation gap is the project's position; neither its prose nor code generation establishes semantic equivalence. [Spec Kit, “The Power Inversion” and “The SDD Workflow in Practice”](https://github.com/github/spec-kit/blob/67e0f7294e6e728ab60bf7b4590deb470448bc2d/spec-driven.md)

Zave and Jackson provide a more exact foundation. They separate desired requirements **R**, relevant domain knowledge **K**, and implementable specifications **S**. Their completion argument requires both that S with K entails R and that S with K is consistent. Customer validation of R and validation of environmental claims remain necessary; proof inside a model does not establish those premises. Their distinction between machine-controlled and environment-controlled phenomena explains why “the system guarantees X” can be impossible when X depends on an external actor. [Zave and Jackson, §§6.1–6.3](https://www.fceia.unr.edu.ar/asist/zave00.pdf)

**Adaptation:** preserve intent, assumed facts, and chosen means as distinguishable statements. A specification records intended behavior. A technical plan records how to produce, integrate, and evaluate it. A schedule adds resource and timing commitments. These can occupy one small document, but collapsing their meanings makes a plan look more certain than its evidence warrants.

## What the empirical literature establishes

The studies answer different questions and should not be pooled into a single “SDD works” verdict.

| Primary study | Result relevant to this task | Limits and practical implication |
| --- | --- | --- |
| **Hill, ESEM 2026**: 88,052 PRs in 119 repositories; 25,209 specification artifacts scored. | After propensity matching, defect introduction differed by −0.6 percentage points, p=0.133. The reported hypotheses did not receive support. | Artifacts were predominantly issue/ticket references; no sampled repository committed the SDD tool output being discussed. SZZ attribution, unobserved specifications, task selection, and LLM-applied formal-quality scoring limit causal interpretation. This challenges claims based on artifact presence, not every collaborative or executable specification method. [§§4–7](https://drops.dagstuhl.de/storage/00lipics/lipics-vol394-esem2026/LIPIcs.ESEM.2026.84/LIPIcs.ESEM.2026.84.pdf) |
| **Tufano et al., SpecOps 2026 / arXiv v1**: test generation for 90 historical Google bugs, five runs, same Gemini 3 Flash harness. | Explicit intermediate contracts raised detect@5 from 53.4% to 63.2%; detect@1 rose from 36.9% to 41.1% without statistical significance. Aggregate token use rose 38%. | Existing tests were removed; bugs were filtered to a narrow change shape. Human curation was deliberately bypassed. Qualitative assessments used an LLM judge. This is evidence for contract reasoning before test generation, not for human peer planning or universal productivity gains. [§§4–6, Tables 2 and 4](https://arxiv.org/html/2608.17177v1) |
| **Mund et al., ESEM 2015**: practitioner survey and a controlled study with 41 students deriving test cases. | Incorrect requirements damaged downstream test correctness. Negative phrasing did not show the same significant effect. | Limited tasks, student participants, and prohibited clarification constrain transfer. Semantic correctness deserves priority over mechanical style rules; a plausible test can faithfully encode a wrong requirement. [§IV](https://arxiv.org/html/1702.07656) |
| **Basili et al., 1996**: two experiments with NASA SEL professionals reading requirements from different perspectives. | The later experiment's simulated teams achieved better defect coverage with perspective-based reading; individual improvements were less consistent. | Teams were constructed by combining individual findings, not observed collaborative meetings. Learning, document type, training, and sample size matter. This motivates task-specific review questions, but does not establish benefits of two LLMs or any model pairing. [§§2.3, 4, 6](https://www.cs.umd.edu/~mvz/handouts/emp_pbr.pdf) |
| **Newcombe et al., CACM 2015**: AWS industrial experience with TLA+ and model checking. | The authors report discovering subtle design bugs and checking proposed optimizations in distributed services. Their table also records a missed liveness bug when liveness was not checked. | Experience report, not randomized comparison. Abstract design checking leaves implementation correspondence and performance behavior to additional evidence. [pp. 68–70](https://cdn.amazon.science/67/f9/92733d574c11ba1a11bd08bfb8ae/how-amazon-web-services-uses-formal-methods.pdf) |
| **He et al., ASE 2026**: five projects, three models, specification form and granularity varied. | The conference abstract reports advantages for structured pseudocode and module-level input as a quality/stability/token tradeoff. | Only the authoritative conference abstract was accessible here. Small projects and unavailable full methods prevent using it to prescribe a universal spec size or granularity. [Conference abstract](https://conf.researchr.org/details/ase-2026/ase-2026-research-track/219/From-Vibe-to-Spec-An-Empirical-Study-to-Demystify-Specifications-in-Code-Generation) |
| **Rosa et al., SANER 2026 Stage 1 registered report** | Defines a proposed human-in-the-loop Specification → Tests → Function experiment. | A reviewed study design is not a result. Its explicit intervention and efficiency measures are useful when designing our evaluation. [§§IV–VII](https://arxiv.org/abs/2601.03878) |
| **Agarwal, Singhal, Macvean, Vasilescu and Breaux, 2026 preprint v4**: *Spec-Driven Development as Prescribed and as Practiced*. | Combines practitioner discussions, 21 interviews and 266 repositories with the SpecMine corpus. Participants described selective adoption, perceived reliability benefits, greater planning/review effort, and checks commonly concentrated at change completion. | These are practitioner accounts and repository observations, not causal estimates. Recruitment, coding judgments and concurrent model improvements limit inference. The initial study described the earlier corpus release; mutual review identified this expanded version. [§§III, IV, VI; v4 dated 2026-10-15](https://arxiv.org/html/2608.25202v4) |

**Inference:** a credible adaptation must measure whether the intended practices happened and whether they helped the next consumer. Counts of documents, requirements, approvals, or citations cannot answer that. An operator approving a mistaken specification and two peers agreeing with it remain compatible with failure.

### Additions after mutual review: review cost and human judgment

Fable's independent research exposed a gap in this study's treatment of authoring and oversight costs. Garg's small pilot involved five reviewers and two banking services. A specification baseline did not significantly improve drift recall; it supported attribution to named requirements while review time rose from 26.7 to 48.4 minutes. Attribution in the comparison condition was structurally constrained by the absence of a named baseline. Confidence increased directionally, without statistical significance. The separate generation experiment was also preliminary and confounded by an extra model pass. These observations justify measuring review cost and attributable findings; they do not establish that the proposed workflow improves delivery. [Garg, “The Drift-Review Study” and “What It Costs and Where the Evidence Is Thin”](https://www.infoq.com/articles/when-spec-driven-development-pays-off/)

Bainbridge explains how automation can leave people responsible for difficult interventions while reducing opportunities to maintain the skills and situational understanding those interventions require. Her subject is automated industrial control, not specification approval. [*Ironies of Automation*, §§1–2](https://ckrybus.com/static/papers/Bainbridge_1983_Automatica.pdf) **Our adaptation:** involve the operator in concrete choices throughout authoring, with the relevant clauses, examples and consequences available. A concise decision brief should help the person inspect the specification, not substitute for access to it. The effectiveness of that interaction design remains to be tested.

Do not justify a large upfront specification with a universal cost multiplier for late fixes. Menzies et al. report no consistent delayed-issue effect across 171 projects. This study consulted their abstract for that bounded finding, not the full analysis. [*Are Delayed Issues Harder to Resolve?*](https://arxiv.org/abs/1609.04886) Risk-directed investigation has to earn its cost in the actual setting.

The [Fable study](spec-driven-development-fable.md) supplies the broader practitioner, human-factors and failure-mode literature. The [joint recommendation](peer-spec-writing-recommendation.md) turns the combined findings into a proposed authoring loop, with explicit handoff, drift handling and a compact failure-to-check mapping.

## Practices worth preserving in an authoring workflow

### 1. Start with an operational problem and grounded vocabulary

**Practice.** Requirements describe effects in the environment, using terms whose meanings are grounded in that environment. Control and observation boundaries matter. [Zave and Jackson, §§2–4](https://www.fceia.unr.edu.ar/asist/zave00.pdf)

**Adaptation.** Before decomposing work, the authors establish the actors, the operational situation, the desired outcome, existing behavior, and the relevant system boundary. Terms such as “delivered,” “available,” or “approved” need an observable meaning when different interpretations would change a test or responsibility. A label in a glossary is useful only if its referent can be recognized.

The check is a short walkthrough: given a concrete event, can each peer identify who observes it, who can respond, and how success is recognized? If not, record the uncertainty. An external dependency cannot become a system guarantee by placing it in a requirement sentence.

For an existing system, keep observed behavior and desired behavior separate. Current code may be useful evidence of compatibility constraints or defects, but observation does not establish stakeholder intent.

### 2. Discover rules through collaboration and examples before polishing notation

**Practice.** Adzic's seven patterns connect scope to goals, collaborative specification, key examples, refinement, automation preserving the specification, frequent validation, and evolving documentation. The publicly available chapter describes a practice distilled from successful teams; it does not isolate the causal contribution of each pattern. [Chapter 2](https://manning-content.s3.amazonaws.com/download/d/5a22dfb-908c-408d-aaa1-46873b6b18c9/adzic_ch02.pdf)

**Adaptation.** Have both peers propose rules, boundary examples, and unanswered questions from the same brief before exchanging drafts. The operator contributes intent and domain knowledge; the agents contribute candidate interpretations and probes. Reconciliation should retain each useful example and expose incompatible expected outcomes, rather than average the wording of two documents.

An example needs a precondition, an action or event, and a concrete observable result. If the result is unknown, it is a question. Matt Wynne's Example Mapping distinguishes stories, rules, examples, and questions, uses a short discussion to expose oversized or uncertain work, and discourages letting formal Gherkin authoring displace discovery. [“Known unknowns,” “Thinking inside the time-box”](https://cucumber.io/blog/bdd/example-mapping-introduction/)

A useful stopping check is whether a new example still changes the rule. Endless synonymous examples add little; a counterexample that changes the rule earns another discussion. Preserve critical negative and boundary cases without requiring a fixed number for every trivial rule.

### 3. Make requirements independently assessable

**Practice.** NASA's requirement guidance calls for clear responsibility, consistent terminology, quantified values with tolerances, rationale and assumptions, and verifiability. It treats unresolved values explicitly rather than silently completing them. [Appendix C](https://www.nasa.gov/reference/system-engineering-handbook-appendix/)

**Practice.** EARS distinguishes always-active, state-triggered, event-triggered, optional-feature, and unwanted-behavior requirements. Its origin paper reports an aero-engine regulatory extraction case; the author-maintained guide supplies the patterns. Grammar helps expose missing conditions but does not prove completeness or feasibility. [Mavin et al.; Mavin's guide](https://research.manchester.ac.uk/en/publications/easy-approach-to-requirements-syntax-ears/) [EARS patterns](https://alistairmavin.com/ears/)

**Adaptation.** A consequential requirement should carry an identity, its source or decision, relevant condition, obligated system or actor, observable response, and an acceptance method. Add units, tolerance, load, timing reference, and failure response when these affect evaluation. Keep rationale beside the requirement without mixing it into the obligation.

Check the set as well as individual sentences. Two clear obligations may conflict; all individual requirements may be testable while an end-to-end outcome is missing. Unknown limits remain proposed or unresolved, with an owner and the decision they block. Do not let agents invent precise numbers merely to satisfy a template.

### 4. Express quality attributes as situations with measures

**Practice.** SEI's Quality Attribute Workshop elicits, consolidates, prioritizes, and refines stakeholder scenarios before architecture is complete. Refinement identifies the stimulus, source, environment, affected artifact, response, and response measure, then connects these to business or mission goals and unresolved questions. [QAW, §§3.5–3.8 and Appendix A](https://www.sei.cmu.edu/documents/716/2003_005_001_14249.pdf)

**Adaptation.** Replace “fast,” “resilient,” or “easy to maintain” with the situation that matters. For example, a proposed response-time target must name the workload, percentile, observation point, and degraded conditions. The operator chooses the relevant service objective; peers investigate whether candidate designs can plausibly meet it and what measurement would establish that.

Systems plans also need budget interactions: latency across multiple services, power across hardware elements, recovery time across operational steps. Local component targets should have an argument for meeting the overall target. A diagram with every box labeled “high availability” provides no such argument.

### 5. Search for ways the desired outcome can fail

**Practice.** Van Lamsweerde and Letier analyze obstacles to goals and assumptions while alternatives remain open. Their methods distinguish eliminating, reducing, and tolerating obstacles and include changing goal refinements, responsibility assignments, and the environment. The paper demonstrates techniques in a safety-critical case rather than measuring a universal improvement rate. [§§4–7](https://www.cs.ucf.edu/~turgut/heng_than.pdf)

**Adaptation.** For each critical outcome, a peer constructs a plausible sequence in which all currently written local rules hold but the outcome fails. Investigate missing observations, external actor failures, concurrent actions, retries, partial completion, stale state, and restoration after failure. This is more discriminating than asking whether the draft “looks comprehensive.”

Record the sequence, the affected outcome, the contested premise, and candidate remedies. Some remedies change scope, allocate a duty to an operator, or accept residual risk; those belong in a human decision. “Add error handling” is incomplete until the required behavior under error is specified.

### 6. Use executable or formal checks where they address the uncertainty

**Practice.** AWS describes first stating safety and liveness properties, then modeling the design and its environment, including failure events, and checking the properties. It also explains that its use of formal specification did not solve sustained emergent performance degradation. [pp. 68–70](https://cdn.amazon.science/67/f9/92733d574c11ba1a11bd08bfb8ae/how-amazon-web-services-uses-formal-methods.pdf)

**Adaptation.** Choose the representation by the question. Tables help with rule combinations; state machines expose missing transitions; a concurrency model can expose invalid interleavings; a simulation or prototype can investigate physical timing or load. The plan names the model's scope, environmental assumptions, checked properties, bounds, and what remains outside the check.

A model checker reporting success is evidence about that model and configuration. A property test samples executions against a property. Neither establishes that the property expresses the right user need. Kiro's current documentation explicitly distinguishes property-based testing from proof and notes that a weak or incorrect property can pass. [“Strengths and limitations”](https://kiro.dev/docs/specs/correctness/)

Make a failed check diagnostic: determine whether the defect is in the requirement, the model/test, or the implementation. Changing the specification to make a check pass is a new proposal when it changes accepted behavior.

### 7. Design acceptance evidence with the specification

**Practice.** NASA's verification matrix connects each requirement with its verification approach; the handbook distinguishes testing, demonstration, inspection, and analysis. [Appendices B and D](https://www.nasa.gov/reference/system-engineering-handbook-appendix/)

**Adaptation.** For every material obligation, record what evidence could establish it, the relevant environment, and who can judge sufficiency. Planned evidence and observed evidence have different states. A task to “write tests” is not proof that the requirements are covered, and a test file's presence is not evidence that its assertions discriminate correct from incorrect behavior.

The plan should expose an unavailable test environment, external certification dependency, missing dataset, or prototype need early. Before code exists, perform a verification-design review: can a competent evaluator tell how a future result would pass or fail? If no credible method exists, change the claim or investigate the method before scheduling confident delivery.

For agent-generated test plans, inspect exact assertions, boundary inputs, and omissions. Tufano et al.'s failure analysis found both specification omissions and downstream tests that failed to realize covered contracts. [§5.3](https://arxiv.org/html/2608.17177v1) The adaptation is to assess the link between requirement and check, rather than infer coverage from a shared identifier.

### 8. Size specification effort by unresolved risk

**Practice.** Boehm's spiral chooses the next activity by objectives, alternatives, constraints, and residual risk. Prototypes, simulation, reference checks, or further specification can be appropriate. It explicitly permits different degrees of formality, completeness, and detail and closes cycles with review by the affected parties. [pp. 64–65, 67–69](https://www.cs.hmc.edu/~markk/SWE_copies/boehmspiral.pdf)

**Adaptation.** Select the next slice by the decision it can support. A stable boundary condition may need one sentence and a test example. A new distributed protocol may require a model. Uncertain demand may need stakeholder research before further design. The authors should identify the observation that would change their recommendation and choose work capable of producing it.

The stopping criterion is sufficient evidence for the next authorized commitment, with remaining uncertainty visible. It is neither “all fields filled” nor “zero questions remain.” Defer a low-impact detail deliberately, naming when it becomes necessary; do not smuggle a deferred architecture or safety decision into a later coding task as routine implementation.

### 9. Use distinct review tasks, not merely two approvals

**Practice.** Perspective-based reading asks reviewers to construct a view needed by a downstream role, such as a design or a test model, and uses difficulties in doing so to locate defects. [Basili et al., §1.2](https://www.cs.umd.edu/~mvz/handouts/emp_pbr.pdf)

**Adaptation.** Give peers concrete reconstruction work. One can attempt a minimal technical plan from the draft; the other can derive acceptance cases and failure scenarios. Both still assess the whole stated scope. If different reasonable interpretations produce different plans or expected outcomes, preserve that as a finding.

Record independent positions before exchange. Use source evidence and concrete counterexamples to resolve differences. A finding should say what claim is affected, why it matters to the next consumer, and what would repair or settle it. A preference, an unsupported claim, a contradiction, and a missing stakeholder choice need different treatment.

Two agents may share training biases and both lack domain knowledge. Independence of work is useful process discipline, not proof of independent error probabilities. Unresolved domain facts need observation or a qualified human, not another agreement round.

### 10. Preserve origin, rationale, and change impact

**Evidence.** Gotel and Finkelstein's investigation with more than 100 practitioners distinguished traceability before and after a requirements specification. Access to originating people and pre-specification information was a central difficulty. Linking requirements only to code misses why the requirement exists and how it was negotiated. [§§2, 6–8](https://discovery.ucl.ac.uk/id/eprint/749/1/2.2_rtprob.pdf)

**Adaptation.** Maintain a navigable chain from stakeholder source or decision to requirement, example/property, design choice, work package, and evidence. The useful question is “what needs reconsideration if this premise changes?” Store the relevant reason at the artifact that must survive, rather than requiring access to an entire chat history.

NASA's requirements-management guidance adds bidirectional allocation, checking the correctness of the relationship, impact assessment, baseline control, and communicating accepted changes. [§6.2.1.2](https://www.nasa.gov/reference/6-2-requirements-management/) Adapt the mechanism to the project's authority; do not import NASA's board structure into a small team.

When a baseline changes, identify affected assumptions, interfaces, acceptance criteria, tasks, estimates, and prior evidence. Mark evidence needing renewal. Preserve unaffected decisions instead of restarting the entire process. A link validator can find a missing target; semantic review must decide whether the target satisfies the obligation.

### 11. Keep the current explanation coherent as discovery proceeds

**Practice.** Parnas and Clements reject the expectation that real design will proceed perfectly rationally. Their proposed documentation presents a coherent current rationale, records missing information, and changes affected documents as knowledge develops. They criticize repetition, inconsistent terminology, and documentation organized around the history of discovery. [§§II, V.G–VII](https://www.laputan.org/pub/papers/Fake.pdf)

**Adaptation.** The current specification should be readable without the debate transcript. Retain decision history separately when it explains authority, alternatives, or reversibility. An author should be able to update a rule once and locate its downstream consequences. Copying the same obligation into many templates creates consistency work rather than additional assurance.

A successor needs the accepted baseline, source identities, unresolved questions and owners, current evidence, pending operations, and the next permitted action. That continuity requirement is an application to agent work; this paper did not study context replacement or AI memory.

### 12. Treat the technical plan as a specification of work and evidence

**Practice.** NASA's technical-planning guidance connects technical effort to objectives, resource constraints, responsibilities, interfaces, deliverables, sequence, reviews, and integration, verification, and validation. Planning evolves as results arrive; plan length is not its adequacy measure. [§6.1.1.2](https://www.nasa.gov/reference/6-1-technical-planning/)

**Adaptation.** Each consequential work package should identify its purpose, prerequisites, output, responsibility, relevant requirement or risk, and observable exit evidence. Dependencies should explain what information, resource, or artifact is consumed. Include investigative work explicitly: a benchmark or supplier inquiry may be the next deliverable, while implementation remains conditional.

A systems plan must account for hardware, people, facilities, interfaces, procurement, commissioning, operations, and retirement where relevant. A software task generator cannot infer their availability. Check integration order, cross-team handoffs, scarce test resources, migration and rollback, and how a failed assumption changes the remaining plan.

An implementer-facing plan has enough detail to execute within agreed boundaries. A decision-facing plan instead makes alternatives and evidence understandable. Distinguish those uses before calling either “ready.”

## What current SDD tools contribute

These are inspected mechanisms, not comparative product recommendations or demonstrations of adherence.

| Source snapshot | Mechanism worth studying | Adaptation and boundary |
| --- | --- | --- |
| **Spec Kit**, commit `67e0f7294e6e728ab60bf7b4590deb470448bc2d` | Its clarification command scans behavior, data, interactions, qualities, dependencies, edge cases, tradeoffs, terminology, and completion. It selects consequential unanswered questions and integrates answers into the spec. | Reuse the coverage questions and immediate integration of decisions. A fixed five-question quota is a UI choice, not evidence that a spec has become adequate. [clarify.md, Outline](https://github.com/github/spec-kit/blob/67e0f7294e6e728ab60bf7b4590deb470448bc2d/templates/commands/clarify.md) |
| **Spec Kit**, same commit | Its analysis command separately inspects duplication, ambiguity, underspecification, coverage, and cross-artifact inconsistency; planning captures researched alternatives and rationale. | Reuse explicit relationship checks. Keyword-inferred task mapping is a discovery aid, not proof of semantic coverage. Rules promoted to a local “constitution” still need legitimate authority. [analyze.md, Detection Passes](https://github.com/github/spec-kit/blob/67e0f7294e6e728ab60bf7b4590deb470448bc2d/templates/commands/analyze.md); [plan.md, Phases](https://github.com/github/spec-kit/blob/67e0f7294e6e728ab60bf7b4590deb470448bc2d/templates/commands/plan.md) |
| **Kiro**, documentation accessed 2026-10-26 | Requirements, design, and tasks are separate artifacts. Requirements-first and design-first routes coexist; analysis can surface contradictions, hidden assumptions, and edge cases across the requirement set. | Artifact separation and revisiting affected interactions are useful. The human must still judge derived requirements and preserve original intent. Automatically generated precision is not accepted intent. [Feature Specs](https://kiro.dev/docs/specs/feature-specs/); [Analyze Requirements](https://kiro.dev/docs/specs/analyze-requirements/) |
| **OpenSpec**, commit `6d04a1b58dedc95729d34e4f223d9d483aae210a` | Current behavior specifications are separate from proposed changes. Added, modified, and removed requirements form reviewable deltas. Its concepts guide offers lighter and fuller specification according to risk. | Use an identifiable baseline plus a change proposal for existing systems. Archiving or synchronizing a document is not evidence that its intended behavior was delivered. Concurrent deltas can still conflict semantically even when files merge. [Concepts, “Specs,” “Changes,” “Delta Specs”](https://github.com/Fission-AI/OpenSpec/blob/6d04a1b58dedc95729d34e4f223d9d483aae210a/docs/concepts.md) |

The useful commonality is explicit intent with a feedback path. Their exact file trees, command chains, and default approvals are implementation choices. None should become our methodology solely because it is convenient to copy.

## Worked adaptation: a retrying telemetry gateway

This is an original illustration, not an empirical result or a recommended production design. All numbers are hypothetical proposals requiring validation.

Suppose a field gateway forwards sensor observations to a central service over an intermittent link. The operator asks for “reliable delivery without duplicates.” Peers should first distinguish loss, duplicate transmissions, duplicate processing, and duplicate operator-visible readings. They are different behaviors.

| Item | Candidate content | Why it changes the plan |
| --- | --- | --- |
| Goal G-1 | Operators can reconstruct the accepted observation history after an outage. | Leads to a history-recovery scenario, not merely a network retry test. |
| Assumption A-1 | Device identity and observation identity survive a gateway restart. | Needs persistence evidence; if false, deduplication by identity is unreliable. |
| Requirement R-1 | After an observation is durably accepted by the gateway, restarts preserve its payload and identity until the service has durably accepted it. | Requires an explicit acceptance boundary and crash-point analysis. |
| Requirement R-2 | Repeated submissions of the same identity and payload create one logical stored observation. | Requires concurrency and retry cases, not a ban on duplicate network packets. |
| Open choice Q-1 | The same identity arrives with a different payload: reject, overwrite, or retain a conflict record? | The operator chooses the data-integrity policy after peers explain consequences. |
| Quality scenario Q-2 | After a proposed one-hour outage at a stated ingest rate, recover backlog within a proposed ten minutes while accepting new data. | Requires storage/capacity estimates and a representative load experiment. |
| Exception Q-3 | Local storage fills while disconnected. | Retention, backpressure, and operator alerting change both the contract and hardware sizing. |

The peers independently produce a state sketch and example set. They compare a crash after local acceptance but before transmission, a lost acknowledgement, a retransmission after service restart, concurrent duplicate submissions, and full storage. If the protocol permits the gateway to discard a record before durable remote acceptance, the counterexample changes the protocol proposal.

The next plan slice could contain:

1. **Clarify the acceptance and retention policy.** Output: operator disposition of Q-1 and Q-3, incorporated into the requirements. Dependent protocol and capacity commitments wait for these choices.
2. **Check the persistence assumption.** Output: a targeted crash experiment and its observed limits. If A-1 fails, return with alternatives rather than continue from a fictional premise.
3. **Explore protocol interleavings.** Output: a small state model, named safety/liveness properties, a recorded configuration, and counterexamples or bounded results. This does not replace implementation testing.
4. **Measure recovery capacity.** Output: measurements under the agreed load and outage profile. Include the hardware and test environment dependency.
5. **Derive an implementation increment.** Output: tasks linked to the accepted behavior and integration evidence. Only after the preceding results can the authors credibly narrow some estimates and interface choices.

This plan is useful before code exists because it says what must be learned, who decides, and what evidence permits the next commitment. A generated checklist saying “implement gateway, add retries, add tests” misses those relationships.

## Initial direction for the skill workflow

This position was developed before reading the peer study. It is a proposal to compare, not a joint conclusion.

Prefer one small entry skill, tentatively **`peer-spec`**, with references for discovery, requirement and evidence quality, and plan derivation. Avoid a large mandatory artifact tree. A small change can use one document; a complex system can split views while keeping one owner for each fact.

The entry skill would preserve a coherent specification across repeated slices:

1. Establish the intended use, current accepted context, scope, evidence, and decision authority.
2. Have two peers independently draft the next consequential slice, including examples, assumptions, alternatives, and verification obligations.
3. Reconcile findings and use **peer-decision-making** for an actual open choice. Give the human a concrete recommendation, tradeoff, and remaining uncertainty; integrate the answer before dependent commitments.
4. Produce the specification and technical plan at the level supported by that decision and evidence.
5. Use **peer-review** for a bounded candidate when reconstruction or consistency checking would reduce risk. A new review companion provides a fresh perspective; a coauthor's rereading should be identified as such.
6. Carry accepted changes forward, and use **successor** when explicitly enabled or requested for a long task. Preserve the current question and authority across transfer; never turn context loss into permission or reset a disagreement's round count.

The same two coauthors should not be portrayed as fresh independent reviewers of their own joint text. Conversely, loading every existing peer skill should not create nested or duplicate companions for the same decision. Skill ownership and fresh-companion requirements need to be resolved explicitly in the later design.

The operator owns goals, scope, value tradeoffs, externally meaningful commitments, and acceptance unless authority has been delegated. Peers can research, draft, check, and propose within existing authority. Human involvement should occur when an answer affects the work, not through routine requests to approve every paragraph. Previously settled choices remain settled until changed evidence or an explicit request warrants revisiting them.

Alternatives are a template-only skill, a single author followed by review, and mandatory complete independent specifications on every revision. The first lacks the discovery and evidence loop; the second is economical for routine work but can anchor the reviewer; the third preserves breadth at a high duplication cost. Independent drafting at consequential boundaries is the hypothesis worth piloting. This is an inference from the literature and the user's desired collaboration, not an experimentally established optimum.

## How to evaluate the adaptation

Before standardizing it, compare representative tasks with a defined neutral baseline: one author, a requirement-quality pass, and targeted review using the same brief and evidence. Exclude the plan-coordinator from both workflow design and the evaluation baseline. Include a small behavior change, a brownfield compatibility change, and a systems problem with an external dependency. Use comparable inputs and model settings, and preserve enough repetitions to see unstable outcomes.

Record consequential ambiguities discovered before handoff, unsupported assumptions promoted to decisions, independent findings retained or lost during synthesis, time spent by the operator, authoring effort, downstream clarification/rework, and whether a changed requirement reaches affected plan and verification artifacts. Count confirmed findings rather than raw criticism. Test a controlled interruption: a fresh context should recover the accepted decisions and next authorized action without reopening settled scope.

Have a downstream reader attempt to derive work and acceptance checks from the artifacts without the authors' conversation. Blind assessment where feasible reduces preference for a familiar style. Adjudicate semantic defects against stakeholder intent and source evidence, not agreement with the generated spec. Record failure and inconclusive results; a pilot can identify practical problems without supporting a general causal claim.

Evidence that would change this recommendation includes negligible unique peer contributions, high operator burden without reduced ambiguity, repeated correlated errors, or maintenance costs exceeding the value of traceability. In those circumstances, narrow independent drafting to higher-risk choices or use a single author with targeted review.

## Source guide and refresh instructions

Read the relevant primary passage before promoting a recommendation into a skill obligation. Dates below identify publication or inspected revision; all URLs were accessed on 2026-10-26. DOI links identify papers; the companion links used in the text provide accessible original text where available.

| Source | Reading location and reason to return |
| --- | --- |
| Zave & Jackson (1997), *Four Dark Corners of Requirements Engineering*, TOSEM 6(1), 1–30, [DOI](https://doi.org/10.1145/237432.237434) | §§2–4 for grounding and control; §§6.1–6.3 for requirements, domain assumptions, implementable specifications, satisfaction, and consistency. Original paper read from university mirror. |
| Parnas & Clements (1986), *A Rational Design Process: How and Why to Fake It*, IEEE TSE SE-12(2), 251–257, [DOI](https://doi.org/10.1109/TSE.1986.6312940) | §§II and V.G–VII for iterative discovery, maintained rationale, organization, terminology, and updates. |
| Boehm (1988), *A Spiral Model of Software Development and Enhancement*, Computer 21(5), 61–72, [DOI](https://doi.org/10.1109/2.59) | pp. 64–65 and 67–69: choose next work and specification detail by risk; review the resulting commitment. |
| Adzic (2011), *Specification by Example*, Manning, ISBN 9781617290084 | Public Chapter 2, pp. 17–28: seven process patterns. This study did not inspect the entire book's case evidence. |
| Wynne (2015), *Introducing Example Mapping*, Cucumber | Rules/examples/questions; timebox; unknown outcomes; relevant participants. An author practice account, not a controlled study. |
| Mavin, Wilkinson, Harwood & Novak (2009), *Easy Approach to Requirements Syntax*, RE 2009, 317–322; [DOI](https://doi.org/10.1109/RE.2009.9) | Original institutional abstract for the case and evidence claim; author's maintained guide for the pattern syntax. Full original methods were not inspected. |
| NASA, *Systems Engineering Handbook*, Rev. 2 (2016), online sections | Appendix C for individual/set quality; B/D for verification; §6.2 for change and allocation; §6.1 for technical planning. These are guidance, not project requirements adopted by this report. |
| Barbacci et al. (2003), *Quality Attribute Workshops*, 3rd ed., CMU/SEI-2003-TR-016, [DOI](https://doi.org/10.1184/R1/6582656.v1) | §§3.5–3.8 and Appendix A: prioritization and concrete scenario refinement. |
| van Lamsweerde & Letier (2000), *Handling Obstacles in Goal-Oriented Requirements Engineering*, TSE 26(10), 978–1005, [DOI](https://doi.org/10.1109/32.879820) | §§4–7: generation, resolution, and worked obstacle analysis. |
| Gotel & Finkelstein (1994), *An Analysis of the Requirements Traceability Problem*, ICRE, 94–101, [DOI](https://doi.org/10.1109/ICRE.1994.292398) | §§2, 6–8: empirical context, pre-specification origins, maintenance and access. |
| Basili et al. (1996), *The Empirical Investigation of Perspective-Based Reading*, Empirical Software Engineering 1, 133–164, [DOI](https://doi.org/10.1007/BF00368702) | §§1.2, 2.3, 4, 6: review tasks, simulated teams, threats, and qualified results. Author-hosted paper; distinguish earlier 1995 report records. |
| Mund et al. (2015), *Does Quality of Requirements Specifications Matter?*, ESEM; [author preprint](https://arxiv.org/abs/1702.07656) | §IV treatment, 41-student experiment, results, and limitations. Publication year differs from the preprint upload year. |
| Newcombe et al. (2015), *How Amazon Web Services Uses Formal Methods*, CACM 58(4), 66–73, [DOI](https://doi.org/10.1145/2699417) | pp. 68–70: properties, environment, case table, performance limitations. |
| Hill (2026), *Specification Artifacts in Open-Source Pull Request Workflows Do Not Reduce Defects: An Empirical Test of Spec-Driven Development Claims*, ESEM, [DOI](https://doi.org/10.4230/LIPIcs.ESEM.2026.84) | §§4–7 and [replication package](https://doi.org/10.5281/zenodo.19415187): inspect treatment definition before interpreting the headline. |
| Tufano et al. (2026), *Grounding AI Agents in Contracts*, [arXiv v1](https://arxiv.org/abs/2608.17177v1) | §§3–6: proposed human curation versus its exclusion in the actual evaluation; detection/cost tables and failure categories. |
| He et al. (2026), *From Vibe to Spec*, ASE, [DOI](https://doi.org/10.1145/3832783.3837515) | Conference abstract only in this study. Obtain the full paper before adopting its granularity result. |
| Rosa et al. (2026), *Understanding Specification-Driven Code Generation with LLMs*, [arXiv](https://arxiv.org/abs/2601.03878) | Stage 1 registered study design; check for Stage 2 results on refresh. |
| Agarwal, Singhal, Macvean, Vasilescu & Breaux (2026), *Spec-Driven Development as Prescribed and as Practiced*, [arXiv v4](https://arxiv.org/abs/2608.25202v4) | Expanded version identified during mutual review. Abstract, §§III-B, IV-D and VI for interviews, effort and limits; Appendix A retains SpecMine. Pin the version: earlier releases were corpus descriptions. |
| Garg (2026), *When Spec-Driven Development Pays Off*, [author's study account](https://www.infoq.com/articles/when-spec-driven-development-pays-off/) | Added after mutual review. Drift-review design and Tables 2–3; generation confound and limitations. Five reviewers and a narrow domain do not establish a general effect. |
| Bainbridge (1983), *Ironies of Automation*, Automatica 19(6), 775–779, [original paper](https://ckrybus.com/static/papers/Bainbridge_1983_Automatica.pdf) | Added after mutual review. §§1–2: retained human duties, skill and situational knowledge, and support for intervention. Application to spec gates is an inference. |
| Menzies, Nichols, Shull & Layman (2017), *Are Delayed Issues Harder to Resolve?*, EMSE 22(4), 1903–1935, [author preprint](https://arxiv.org/abs/1609.04886) | Added after mutual review. Abstract only here: 171-project finding challenges a universal delayed-issue effect. Read full methods before applying its result to a specific project. |
| GitHub Spec Kit, commit `67e0f7294e6e728ab60bf7b4590deb470448bc2d`, committed 2026-10-23 | `spec-driven.md`; `templates/commands/{clarify,analyze,plan}.md`. Refresh these specific mechanisms and record a new commit rather than silently changing citations. |
| Fission AI OpenSpec, commit `6d04a1b58dedc95729d34e4f223d9d483aae210a`, committed 2026-10-24 | `docs/concepts.md`, with README and workflows inspected for context. Recheck delta semantics and artifact state before any implementation. |
| Kiro documentation snapshot | Feature Specs updated 2026-08-04; Analyze Requirements 2026-09-02; Correctness 2026-08-04; overview 2026-10-15. Recheck capabilities and defaults separately from methodological claims. |

On refresh, preserve this dated report, identify which evidence or tool contract changed, and revise the affected recommendation with its reason. Seek original outcomes and denominators behind attractive percentages. New tool versions do not invalidate the foundational distinctions, and foundational authority does not establish the effectiveness of a new agent workflow.
