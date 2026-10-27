# A peer workflow for developing specifications and systems plans

Date: **2026-10-26**. Status: jointly recommended by Codex and Fable after integration review; proposed for operator consideration. Research inputs: the independently frozen [Codex study](spec-driven-development-codex.md) and [Fable study](spec-driven-development-fable.md). This recommendation does not create a skill or authorize implementation.

**We recommend piloting one small composing skill, `write-spec`.** It develops specifications in slices selected by uncertainty and consequence. For an open question that merits peer work, two agents independently propose obligations, examples, assumptions, alternatives and checks. One writer integrates the agreed contributions and the operator's decisions into the maintained specification. A fresh peer then tests a substantial candidate by trying to derive implementation work and acceptance evidence from it.

The decisive tradeoff is better discovery and accountable decisions against additional authoring, reconciliation and review cost. Independent discovery preserves different interpretations without requiring two complete documents on every revision. Peer agreement supplies a recommendation; the human retains goals, scope, value tradeoffs and commitment decisions unless those have already been delegated.

The proposed skill composes [peer-decision-making](../../skills/peer-decision-making/SKILL.md), [peer-review](../../skills/peer-review/SKILL.md), and [successor](../../skills/successor/SKILL.md) at their actual points of use. **The current plan-coordinator was excluded from the research, design and proposed evaluation baseline.**

## Why this direction is worth testing

The literature supports mechanisms, not a universal verdict that writing specifications improves software. Requirements engineering supplies distinctions between intent, environmental assumptions and implementable behavior; collaborative specification supplies examples and questions; systems engineering supplies verification and work-planning obligations. Their combination in an agent workflow remains our inference.

Recent findings reinforce that qualification. Hill's observational study did not find a defect benefit from specification artifacts, chiefly issue references. Tufano et al. found a benefit in one repeated contract-driven test-generation setting. Garg's small review pilot found attribution benefits and increased review time without better recall. Agarwal et al.'s interviews and repository analysis describe selective adoption and maintenance burdens. These results concern different treatments and outcomes; none evaluates the workflow proposed here. See the original [Hill study](https://doi.org/10.4230/LIPIcs.ESEM.2026.84), [Tufano study](https://arxiv.org/html/2608.17177v1), [Garg account](https://www.infoq.com/articles/when-spec-driven-development-pays-off/), and [Agarwal et al., v4](https://arxiv.org/html/2608.25202v4), with fuller limitations in the two research reports.

Bainbridge's analysis of automation motivates involving people in meaningful judgments while supporting their understanding of the system. Applying that argument to specification authoring is an inference: a concise decision brief should help the operator examine the relevant specification, not hide it behind a summary or demand ceremonial approval. [*Ironies of Automation*, §§1–2](https://ckrybus.com/static/papers/Bainbridge_1983_Automatica.pdf)

## What the skill would own

`write-spec` would own the authoring task, the current specification, and any requested plan derived from it. It would identify the consumer: an operator deciding what to pursue, an implementer executing accepted work, or an evaluator determining whether it succeeded. Those uses need different detail.

Keep the entry skill short. It would select the next useful activity, preserve authority, and load supporting references only when needed. Three references are sufficient starting candidates:

- **Discovery:** scope, consequential vocabulary, assumptions, examples, competing interpretations and obstacles.
- **Evidence and review:** requirement quality, quality scenarios, verification design, counterexamples and reconstruction review.
- **Planning and change:** work packages, dependencies, baselines, affected evidence, drift and continuity.

These are proposed responsibilities, not a required file tree for every project. A small specification can be one document. A system may need separate views, with a clear maintained owner for each fact. A template alone would not supply the discovery or maintenance behavior; a large fixed pipeline would impose cost before establishing its value.

## The authoring loop

### 1. Establish the next decision and its authority

Read the request, applicable instructions, current accepted specification, relevant system evidence and settled decisions. State the operational problem, intended outcome, system boundary and next commitment the specification should support. Distinguish observed behavior from desired behavior and a proposed choice from an accepted one.

Identify who can settle each uncertainty. An operator may decide a retention policy; an experiment may establish storage capacity; a supplier may confirm an interface guarantee. Agreement between agents cannot establish an unknown environmental fact.

Select the next slice by unresolved risk. A prototype, stakeholder inquiry, model, benchmark or narrower specification may be the useful next output. Document why that activity can change the decision. This applies Boehm's risk-directed refinement without importing his entire lifecycle. [Boehm, pp. 64–65, 67–69](https://www.cs.hmc.edu/~markk/SWE_copies/boehmspiral.pdf)

| Effort | Suitable situation | Expected work |
| --- | --- | --- |
| Direct edit outside this skill | Meaning is settled; change is routine, reversible and within existing authority. | Make the edit and perform the relevant check. |
| Light slice | Limited uncertainty and consequences, with understandable interfaces and checks. | Concise authoring, explicit examples and assumptions, and a reconstruction check proportionate to the risk. |
| Full slice | Consequential uncertainty, competing interpretations, new interfaces, difficult recovery or substantial external commitments. | Independent discovery, explicit evidence design, and fresh peer review before baseline commitment. |

Record the selected effort and its reason. A one-line authorization change can warrant full treatment. Sentence counts, page targets and question quotas do not establish adequacy. The operator can tailor the requested effort.

### 2. Discover independently where a real question is open

For a consequential framing or design choice, invoke `peer-decision-making` with the same identifiable brief and supporting sources for both peers. Each independently produces short candidate clauses or structured notes covering:

- Desired rules and observable outcomes, including boundaries and failures.
- Environmental assumptions, evidence for them, and consequences if they fail.
- Concrete examples, competing interpretations and alternative approaches.
- Possible checks and the unknowns that would prevent useful acceptance evidence.

These are contributions to specification writing, not two mandatory polished documents. Freeze the contributions before exchange. Preserve which candidate elements were adopted, rejected or left open, with a reason where it affects future decisions.

Use collaborative examples to expose missing rules and unknown outcomes. Use obstacle analysis to construct a sequence in which the written local rules hold but the desired outcome still fails. These sources motivate the discovery tasks; the independent two-agent adaptation is a hypothesis to evaluate. [Adzic, Chapter 2](https://manning-content.s3.amazonaws.com/download/d/5a22dfb-908c-408d-aaa1-46873b6b18c9/adzic_ch02.pdf), [Wynne, Example Mapping](https://cucumber.io/blog/bdd/example-mapping-introduction/), [van Lamsweerde and Letier, §§4–7](https://www.cs.ucf.edu/~turgut/heng_than.pdf)

Do not invent alternatives merely to invoke a peer skill. Investigate factual gaps directly. Routine settled work can remain single-author. Full independent drafts are an option when competing designs or the operator's request justify the cost.

### 3. Bring consequential choices to the operator when they matter

Consult accessible sources and previous answers before asking. Present the next unresolved choice when its answer affects the work; continue independent work that does not depend on it. A short coherent batch can be useful, but no fixed cap certifies that discovery is complete.

A decision brief should contain:

| Element | What the operator needs |
| --- | --- |
| Choice and reason | The concrete issue and why it affects this commitment. |
| Options and recommendation | Viable alternatives, decisive tradeoff and the peers' rationale or remaining disagreement. |
| Evidence and uncertainty | What is known, assumed, disputed or still awaiting investigation. |
| Affected meaning | Links to the proposed clauses, examples and cumulative consequences in the current artifact. |
| Disposition | Decision owner, answer, accepted scope, conditions and source/date. |

Keep the complete current specification available. Do not turn a decision list into the only information the operator can inspect. Record the answer accurately and update dependent clauses before treating the decision as settled. Never invent numeric targets to satisfy a template.

The peer protocols retain their equal standing, frozen positions, explicit assent and bounded disagreement rounds. They do not confer authority to settle a human-owned tradeoff. When evidence cannot resolve such a choice, give the operator both positions and the premise that separates them.

### 4. Write one coherent candidate and design its evidence

One canonical writer integrates the contributions. Keep desired outcomes, environmental knowledge or assumptions, and chosen interface behavior distinguishable. Zave and Jackson's satisfaction argument explains why the assumptions matter: implementable behavior must support the desired outcomes under those assumptions, and the combination must be consistent. A natural-language trace table is not itself a proof. [*Four Dark Corners*, §§6.1–6.3](https://www.fceia.unr.edu.ar/asist/zave00.pdf)

For each material obligation, preserve its identity and source, conditions, responsible system or actor, observable response, and intended evidence. Add units, tolerance, timing reference, workload and failure response where they change the check. A missing verification method is a gap to resolve, not a reason to quietly remove the obligation. A named evaluator also needs a meaningful sufficiency criterion. [NASA, Appendices C and D](https://www.nasa.gov/reference/system-engineering-handbook-appendix/)

Use a form that exposes the relevant uncertainty: EARS for conditional requirements, examples or decision tables for business rules, state models for transitions, and quantitative scenarios for qualities. A quality scenario should identify the stimulus and source, environment, affected part, response and measure. [Mavin's EARS patterns](https://alistairmavin.com/ears/), [SEI Quality Attribute Workshops, §§3.5–3.8](https://www.sei.cmu.edu/documents/716/2003_005_001_14249.pdf)

Check the whole set for conflicts, missing end-to-end outcomes and unsupported assumptions. For critical properties, seek a counterexample or an intentionally wrong candidate that the proposed check should reject. Choose formal models, simulations or prototypes only where they address the uncertainty, and record their bounds. Planned evidence, a passing model check and an observed production outcome are different states.

### 5. Review a substantial candidate by reconstruction

For a full slice, invoke `peer-review` with a new fresh companion before treating the candidate as ready for the requested commitment. Give the pair concrete downstream work: derive a minimal implementation and integration plan, derive acceptance cases, or walk through an operational failure and recovery. Select perspectives appropriate to the slice; two reviewers need not create three additional roles.

A useful finding names the affected claim, the interpretation or missing evidence, the consequence, and a repair or decision that would settle it. Differences in wording alone need no debate. Check negative cases, external duties and the semantic relationship between requirements and tests, rather than counting shared identifiers.

Perspective-based reading motivates these reconstruction tasks. Its original experiments combined individual readers into simulated teams; they do not establish expected results for LLM peers or deliberation meetings. [Basili et al., §§1.2, 2.3 and 4](https://www.cs.umd.edu/~mvz/handouts/emp_pbr.pdf)

A coauthor can inspect the integration of their contributions. That inspection is useful, but it is not a fresh independent review of the joint candidate. Each named skill invocation retains its own companion lifecycle; loading shared protocol does not launch a nested peer.

### 6. Derive the plan as work that produces evidence

A plan should explain what must be learned or built, what it depends on, and how its result supports the next commitment. NASA's technical-planning guidance connects technical objectives, resources, responsibilities, interfaces, sequencing and evaluation; applying those obligations selectively gives a stronger plan than a list of coding tasks. [NASA, §6.1](https://www.nasa.gov/reference/6-1-technical-planning/)

Each consequential work package needs:

- Purpose and linked requirement, decision or risk.
- Inputs and prerequisites, including external interfaces, people, equipment and test environments.
- Responsible owner or an explicitly unresolved ownership question.
- Output and evidence method, environment, evaluator and exit criterion.
- Dependency or next decision enabled by that evidence.

Investigative work belongs in the plan. An unavailable test facility, unconfirmed supplier behavior or unresolved capacity assumption can make an experiment or inquiry the next deliverable. Keep implementation commitments conditional where their premises are unsettled. Systems plans may need procurement, commissioning, operations, migration, rollback and retirement work as well as software.

For example, a retrying service may promise that accepted events survive a restart. One peer could interpret “accepted” as receipt of an HTTP response; the other could require durable local storage. The operator's decision changes the contract. The plan then needs crash-point evidence, remote acknowledgement semantics, and a test environment. A missing production alert path requires provisioning or an explicit scope decision; a test stub cannot discharge that obligation.

### 7. Establish a baseline, then reconcile change

Baseline acceptance identifies the version, accepted scope, decision authority and any conditions still open. It does not prove delivery or authorize implementation beyond the existing task. A handoff includes that baseline, applicable original constraints, relevant evidence and unresolved questions with owners. A fresh implementation context may help complex work and should be tested as an option; the research does not establish it as a universal prerequisite.

At a relevant checkpoint or proposed change:

1. Identify behavior absent from the spec, an unmet obligation, a false assumption or a changed external constraint.
2. Trace the impact into interfaces, examples, checks, tasks, estimates and previously accepted evidence.
3. Repair and log deviations that merely restore accepted behavior within existing authority.
4. Bring changed intent, commitments, value tradeoffs or accepted risk to the responsible human before dependent work.
5. Update the coherent current specification and retain the accepted delta, rationale and superseded decision. Mark evidence that needs renewal.

The purpose is recoverable meaning and correct change impact, not accumulating copies. Requirements-management guidance supports impact analysis; Parnas and Clements support a coherent maintained explanation; OpenSpec provides a concrete delta mechanism. None makes an archived document proof that behavior was delivered. [NASA, §6.2](https://www.nasa.gov/reference/6-2-requirements-management/), [Parnas and Clements, §§V.G–VII](https://www.laputan.org/pub/papers/Fake.pdf), [OpenSpec concepts, pinned revision](https://github.com/Fission-AI/OpenSpec/blob/6d04a1b58dedc95729d34e4f223d9d483aae210a/docs/concepts.md)

## How the existing skills fit

| Skill | Trigger and contribution | Boundary to preserve |
| --- | --- | --- |
| `peer-decision-making` | A genuine open framing or design choice benefits from independent candidate construction and comparison. It returns a supported recommendation or explicit dissent. | It does not write the canonical specification or accept the decision. `write-spec`, as caller, integrates under existing authority. A fresh companion receives the same sources before seeing the host's new position. |
| `peer-review` | A bounded candidate needs independent reconstruction and consistency review; full slices include it. | Use a fresh companion. Coauthor rereads and replacement contexts do not acquire independent-review credit. Apply only agreed corrections within existing authority. |
| `successor` | The operator explicitly enables continuity for expected long work or requests a handoff. A single optional offer can be useful when no policy exists. | No automatic activation merely because a slice is full, and no repeated approval question. Preserve an existing policy. A dispatched worker reports replacement needs to its coordinator. |

When succession is enabled, retain the original instruction sources, baseline and proposed deltas, accepted decisions, open questions and owners, source identities, evidence, peer positions and round counts, active workers and pending operations, and the next permitted action. Replacement must not reset disagreement rounds or turn lost context into permission.

Use `maintain-glossary` only for consequential unresolved vocabulary, and decision records where the project's existing policy warrants them. A routine wording choice does not need a new ADR. Writing follows the project's audience guidance and the recorded [inline Markdown link rule](../writing-guidance.md), so research and specifications remain compatible with visual editing.

## Failure signatures the skill should check

This is an adaptation checklist drawn from the practices above; the studies retain the source-specific arguments and limits.

| Signature | Discriminating check or response |
| --- | --- |
| Precise numbers appeared without a source or decision. | Trace each consequential target to evidence or operator disposition; keep proposals marked. |
| Two peers agree but the user need remains uncertain. | Identify the unresolved intent or domain fact and its owner; agreement cannot supply it. |
| Every sentence looks testable but the overall outcome can fail. | Construct an end-to-end counterexample across component boundaries. |
| Tests repeat the specification's mistake. | Challenge both the expected result and the check against stakeholder intent and deliberately wrong candidates. |
| Independent notes contain many paraphrases but few different insights. | Count confirmed unique contributions; narrow the peer work if its cost is not justified. |
| An operator is repeatedly asked to approve settled matters. | Recover the governing decision and delegated authority; surface only changed consequences. |
| A short decision list hides important cumulative changes. | Link affected clauses and examples and keep the full current artifact accessible. |
| A task exists but its environment or dependency does not. | Name the missing resource and produce investigative or provisioning work before claiming readiness. |
| A delta merges cleanly but conflicts with another accepted behavior. | Review semantic interactions and renew affected evidence. |
| A new context reopens accepted scope or forgets a pending decision. | Reconcile original instruction sources and the continuation record before dependent work. |

## Pilot and refresh before standardizing

Compare the proposed workflow with a neutral baseline: one author, an explicit requirement-quality pass and targeted review, using the same brief, sources and comparable model settings. Include a small behavior change, a brownfield compatibility change and a systems slice with an external dependency. Record effort selection and its reason. Do not use the excluded plan-coordinator as either the design template or comparison baseline.

Have a downstream reader derive work and acceptance checks without the authors' conversation. Where practical, conceal which method produced the artifact. Judge semantic defects against domain evidence and stakeholder intent, not conformity to the generated specification. Record confirmed unique peer contributions, missing assumptions, downstream clarification and rework, operator time, authoring/review time and token cost, and whether an intentional change reaches affected plan and verification artifacts. Include a controlled interruption to check continuity. Keep inconclusive and negative results.

Continue or expand the workflow if independent contributions improve the next consumer's understanding at an acceptable cost. Narrow it to higher-risk questions if findings add little or operator effort rises without corresponding benefit. Rework or stop the approach if correlated errors, stale specifications or maintenance burden dominate. Decide acceptable tradeoffs before evaluating the pilot; no universal threshold is established by this research.

The two studies provide the refresh map: exact paper versions, reading sections, access limitations and tool snapshots. Revisit the relevant primary passage before turning a practice into a mandatory skill rule. In particular, check later results for the registered studies, new replications of the small agent experiments, and revised tool contracts. Preserve the old dated research and explain what changed rather than silently replacing its evidence.

## Basis of the joint recommendation

The Codex host and a real Orca peer independently researched and froze their studies and initial positions before exchange. Orca's launch receipt confirmed the requested Fable peer as `claude-fable-5-1[1m]` with `xhigh` effort. The peer could not independently observe effective effort inside its session; verification here rests on Orca's recorded effective launch settings. Both then froze independent cross-assessments and exchanged one paired discussion round. The host moved from ambiguous double drafting to independent discovery with a single maintained draft; the peer moved away from fixed question/page rules, automatic succession and universal fresh-context handoff. Both supported risk-proportionate peer work, concrete human decisions, explicit evidence and a bounded pilot.

The original independent snapshots and discussion records are retained outside tracked deliverables. The delivered studies identify corrections made after exchange. Agreement on this recommendation is not operator adoption; the next proposed work, if adopted, is to implement the small entry skill and references and evaluate them on the pilot cases above.
