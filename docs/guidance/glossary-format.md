# Glossary format

A glossary records project meanings that readers could otherwise confuse.
Use this house format for new glossaries; follow
[record format adoption](record-format-adoption.md) for existing ones.

Create a root `GLOSSARY.md` only when there is a settled term to record. Use
`# Glossary`, then one H2 per canonical term in alphabetical order. Define what
it is and what distinguishes it, usually in one sentence. Add a short context
sentence only when the title and entries leave the domain unclear.

```markdown
# Glossary

## Allocation

Stock assigned to a warehouse.

## Order

A customer's purchase confirmed by payment authorization.

## Reservation

A temporary hold on stock while a customer pays; it can expire without becoming
an order. Also called a hold.
```

Most entries need only the definition. Include aliases, terms to avoid,
contrasts, examples or links only when omission would leave a likely confusion.
Use ordinary prose; no labeled fields are required. Do not repeat a distinction
in both a definition and a separate contrast, or add an example that merely
restates it. Keep implementation details and changing policy values in their
owning contracts. Link them only when needed to understand the term.

Preserve one meaning per term within a context. Qualify homonyms, such as
`## Account (billing)` and `## Account (sign-in)`. Add a scoped `GLOSSARY.md`
only when a separately owned context has enough distinct vocabulary to warrant
it; link it from the root and identify its context. One homonym does not require
a new document. Reuse externally owned definitions rather than copying them.

Links use paths relative to the glossary and the destination renderer's heading
anchors. Preserve existing anchors or update affected references when renaming.
Unresolved meanings stay in discussion or planning until settled; a neat
definition is not evidence of agreement.
