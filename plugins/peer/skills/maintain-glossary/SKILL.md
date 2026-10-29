---
name: maintain-glossary
description: Resolve consequential ambiguity in project vocabulary and maintain concise glossary entries, including during planning; migrate an existing glossary when asked. Reading settled vocabulary or explaining a term alone does not require an edit.
---

# Maintain a glossary

Preserve the meanings readers need to distinguish project concepts. A glossary
is not a specification, implementation inventory or history of naming debates.

## Resolve the meaning

Read relevant repository guidance, existing vocabulary and affected contracts or
decisions. Locate the context in which each term is used. Distinct meanings in
different domains can coexist; qualify their names rather than merging them.
Code establishes usage, not necessarily the project's intended meaning.

Add an entry only for a project-specific distinction whose ambiguity would
change understanding, scope or behavior. Reuse a shared definition at its owner.
Ordinary programming terms need no entry unless their local meaning differs in
a consequential way. If nothing needs recording, return without creating a file.

Use available sources and settled answers. Ask the operator or coordinator only
about consequential ambiguity, using a concrete case to distinguish meanings.
Keep the established meaning until a replacement is accepted. Leave unresolved
terms in the discussion or planning record, visibly pending; a glossary edit
cannot settle a product decision. If recording a decision is also part of this
task, load [record-decision](../record-decision/SKILL.md) for that work.

## Write and check

Before drafting, read [glossary format](references/glossary-format.md). Load
[write-for-humans](../write-for-humans/SKILL.md) through the engine's supported
mechanism. If existing records or controlling instructions differ from the
format, or migration is requested, also read
[record format adoption](references/record-format-adoption.md).
If a required dependency is unavailable, pause dependent drafting in replies
and files. The reply names the missing path, what it blocks and any independent
work done; it contains no dependent entry, layout or definition, even as an
example. Continue independent authorized work.

For missing shared writing guidance:

- **Good:** “`references/writing-guidance.md` is missing from the skill package.
  Restore it before I draft entries for the settled terms tenant and namespace.”

Write the canonical term and its distinguishing definition, usually one sentence.
Add an alias, contrast, example or link only when the definition alone would
leave a likely confusion. Keep detailed behavior at its maintained owner;
when pruning an existing entry, relocate still-needed detail within scope or
report the unresolved relocation rather than lose it.

Apply authorized edits without repeat approval, respecting a designated writer.
A discussion-only task returns proposed entries. A terminology change grants
no authority to rename code, migrate other documents or alter another repository.

Check that each changed entry preserves the settled meaning, follows the format
and distinguishes neighboring concepts. Verify necessary links and reconcile
affected uses within scope. The receipt identifies each unresolved term’s
competing meanings and a concrete case that separates them, or the missing
distinction when those meanings are unknown.
It also carries any remaining inconsistency that changes use. Keep each
qualification to one sentence and include it with proposed entries for inline
delivery. Completion covers the vocabulary needed for this task, not a catalogue
of the codebase.

For saved artifacts, reply with a [delivery receipt](references/writing-guidance.md#deliver):
where the result is, what is unresolved that changes its use, and what the user
must do. Add only requested explanations or governing mandatory reports.
