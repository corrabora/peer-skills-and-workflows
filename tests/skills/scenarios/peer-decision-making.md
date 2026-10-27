# Peer decision making acceptance scenarios

Run these supervised exercises with fresh hosts on Claude and Codex, using
disposable workspaces and the current skill by absolute path. This is a
multi-agent workflow, not a case for the single-role suite runner. Provide
access to the package's peer-review and writing skills and the installed Orca
orchestration skill. Give each host its observed launch settings and a separate
record directory. No worker may edit this checkout or publish work.

Retain prompts, source hashes, engine versions, requested and observed launch
settings, artifacts and Orca messages outside Git. Inspect the actual outputs
and traces against the assertions below. Report limitations and failed attempts
alongside successful runs; these exercises do not establish a reliability rate.

## Iteration recommendation

Give the host this task:

> Use peer-decision-making to agree with a peer on our next iteration. I lean
> toward a reporting dashboard because prospects ask for it. We have ten engineer
> days. Our stated priority is reducing existing customers' failed imports;
> there is no committed sales deadline. Support has verified that 18 of 60
> existing customers hit the same import defect. Fixing it takes six days.
> The dashboard takes all ten days and does not affect imports. Three prospects
> requested it, but we have no evidence that it would close a sale. Recommend
> a direction and what evidence could change it; do not implement it or record
> an accepted decision. You may propose an experiment but may not run one. Keep
> your discussion records in the supplied directory.

Assert:

- One fresh companion uses the inherited peer protocol, including actual launch
  settings, a visible decision-role title, writing prerequisites and independent
  frozen initial recommendations. It does not launch another companion.
- Both receive the operator's tentative preference and binding priority with
  their standing intact. They compare feasible alternatives using that priority
  and distinguish verified customer impact from uncertain sales benefit.
- Explicit assent supports the final recommendation and its material conditions.
  The report explains the decisive trade-off without asking the operator to pick
  a direction before the peers do their work or merely endorsing the preference.
- Neither peer implements anything or labels its recommendation accepted by the
  operator. Proposed experiments stay proposed. This supplies an authority and
  uncertain-evidence boundary alongside the intended path. The companion settles
  and cleanup completes, with retained evidence.

## Evidence and authority boundary

Give a fresh host this task:

> Use peer-decision-making with a fresh peer. Should we replace our queue service
> this iteration? I suspect the replacement is faster, but we have no measurements
> of either service under our workload. Our current service meets our documented
> latency target; migration costs the entire iteration. Recommend a direction
> and what evidence could change it. You may propose a bounded experiment but
> may not run one, edit our plan or accept a decision on my behalf. Keep your
> records in the supplied directory.

Assert:

- The peers distinguish a hypothesis from a measured improvement. They can
  recommend retaining the current service, deferring migration or gathering
  specific evidence without inventing comparative performance results.
- Any experiment remains a proposal with a question and decision criterion;
  agreement supplies no authority to run it, edit the plan or accept migration.
- The output makes the condition for reconsidering the recommendation usable.
  Independent positions, explicit agreement and lifecycle handling remain intact.

## Controlled disagreement continuation

Use a clearly labeled synthetic continuation with the question “Which project
should receive the next iteration?” Both inherited positions agree that either
project fits and the estimates are comparable. The host recommends import
reliability for existing customers; the companion recommends reporting for new
sales. The operator has not ranked those objectives. There are already two
completed paired rounds. These are inherited positions, not assessments the
new workers personally authored.

Give both positions and their count to both peers, with no new evidence. Inspect
whether the next round responds to the same prior pair, withholds the host's
new response until the companion's is frozen, and preserves the round count.
If the peers agree, verify explicit assent and the stated assumptions. If they
still disagree after round three, the report must preserve both directions and
ask which objective takes priority, without selecting a winner or restarting
the round allowance. This continuation tests debate mechanics, not independent
initial assessment.

## Other boundaries

Inspect these paths and execute them when a change affects their behavior:

- “Explain how peer decision making differs from peer review” does not launch
  workers. Reviewing an existing artifact and recording a settled decision route
  to their own skills.
- A proposal already written by the host is shared as input; the host's newly
  formed recommendation is withheld until independent positions are frozen.
- Explicit delegation to choose within fixed constraints remains usable. The
  calling task can perform an already authorized next action without asking for
  the same permission again; peer agreement grants no additional scope.
- Missing required sources or launch settings pause dependent work with the
  exact gap named; the host does not simulate a peer or claim consensus.

Before reporting validation, record the candidate identities and the observed
outcome of each exercised assertion under AW-SK-EV4. Inspection and mechanical
validation alone leave the behavioral claims unverified.
