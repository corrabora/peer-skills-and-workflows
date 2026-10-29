<!-- Generated from docs/writing-guidance.md. -->
# Shared writing guidance

This page owns selection, evidence and editing for `write-for-humans` and
`write-for-agents`; those skills own their audience-specific work. Follow the
request and applicable project requirements. Keep a narrow edit narrow.

## Select before drafting

Identify what the reader must understand, decide or do. Select the settled
result and the rationale needed to use it from the available context. Notes,
conversation and investigation are inputs, not an outline to reproduce.
Include history or rejected options only when they explain a live constraint
or choice, or when history is itself the requested subject.

Draft the shortest complete answer first. Add detail only to repair a specific
gap in understanding or action. A fact's truth or availability does not earn
it space: test results, unchanged behavior and excluded approaches belong only
when this reader needs them. State limitations on claims the artifact actually
makes; do not add disclaimers for claims it never makes.

Keep each fact or rule at its maintained owner. Obtain changing facts there;
link supporting detail only when the reader needs it. Load conditional
references when their branch applies. A shorter entry point that loads every
reference still imposes the whole reading burden.

## Edit for necessity and coherence

Perform this pass before delivery:

1. **Cut idle sentences.** For each sentence, name the question it answers,
   action it enables or likely misunderstanding it prevents. If removing it
   changes none of those, delete it. Remove generic introductions, process
   narration, repeated conclusions and qualifications already stated where
   they matter.
2. **Tighten useful sentences.** Test each phrase and word: does it add meaning,
   precision or a necessary connection? Replace indirect phrasing with concrete
   subjects and verbs; remove empty emphasis and repeated framing. “We made
   the decision to retain X in order to support Y” becomes “Retain X to support Y.”
3. **Read the result as a whole.** Put the main point early and develop each
   point once, in the order the reader needs. Repair missing premises,
   ambiguous referents and broken reasoning. Preserve useful complete prose;
   terse writing is not a heap of fragments or dense shorthand.
4. **Check for lost meaning.** Compare against the sources and requirements.
   Restore any necessary reason, exception, uncertainty, boundary or evidence
   removed in editing. Compare each action, decision and cost with the source
   passage that supplies it, including who acts, decides or bears the cost.
   Repair a mismatch in the draft before delivery; an unresolved role stays
   unresolved. Ask a factual question only when the sources leave it unresolved.
   Cut repetition around an obligation, not the obligation.

Structure serves the content: use paragraphs for connected reasoning, lists
for parallel items or steps, and headings only for useful divisions. Empty
sections and fields earn no place by making a template look complete. No
unrequested word target overrides necessary meaning. Start with a paragraph
for a single result; add sections only when readers need to navigate distinct
concerns, not to give every available category of information a home.

Use inline Markdown links (`[label](https://example.com)`) in saved documents,
including research citations, to keep them editable in visual editors. Avoid reference-style
links and their separate definition blocks; these can restrict editing to code
mode. Keep descriptive source labels and direct source URLs inline, and check
new or revised documents for leftover reference definitions before delivery.

## Preserve truth and authority

Check consequential claims and their descriptive details against the sources
that support them. Attribute a
claim about another source to the source that makes it until checked there.
Name no decider or approver the sources do not name.
Describe a saved artifact from its own contents; name linked material as a
reference. Keep qualifications beside
the claims they limit; distinguish fact, inference, proposal and accepted
direction when the distinction changes interpretation or action. Never turn
missing evidence into certainty, acceptance into delivery, or a recommendation
into permission. Identify an intentional snapshot by its version or work item.

Necessary evidence must remain accessible for the artifact's useful lifetime.
Durable decisions state their rationale without relying on temporary transcripts
or scratch. Reports can link retained support instead of repeating it.

## Deliver

Finish the revision before replying. For a saved artifact, the closing message
is a delivery receipt, and it is the whole recap:

1. Where the result is.
2. Anything unresolved that changes how the reader uses it or what they do next.
3. Anything the user must do, one sentence each.

If nothing is unresolved and nothing is required, the receipt is the first
line alone. The user can open the file; describing its contents buries the
one thing they need. A constraint you met, a step that failed and was recovered,
an item you considered and left out, and work you could add stay unmentioned
unless one changes what the user does next. When asked why items were selected,
give the test you applied in one sentence rather than a verdict per item.
Requested explanations and governing mandatory reports still belong in the
reply, with the support and qualifications they require.

If the reply is itself the requested artifact, deliver its prose without a
preface or recap; include any separately requested or required reporting.

For saved records when the task also asks why those items were selected:

- **Good:** “Saved `docs/adr/0008-tenant-keys.md` and `GLOSSARY.md`. The key
  choice warrants a record; routine edits do not. The decision is accepted but
  unimplemented. Recheck provisional ADR-0008 against `main` before integration.
  ‘Tenant group’ remains unresolved.”
