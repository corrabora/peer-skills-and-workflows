# Conventional Commit Guidance

Commits use the conventional-commit shape and strongly prefer one line.

The convention governs commits to peer-skills-and-workflows itself; it does not
impose commit policy on repositories that install its skills.

## Subject Shape

```text
<type>(optional-scope)!: <description>
```

```text
feat(model): add claim taxonomy
fix(api)!: reject malformed subject signatures
docs(guidance): explain commit conventions
```

`!` marks a breaking change and requires a `BREAKING CHANGE:` callout later in
the message.

## Types

`build`, `chore`, `ci`, `docs`, `feat`, `fix`, `perf`, `refactor`, `revert`,
`style`, `test`.

- `feat` — user-visible or product capability
- `fix` — bug fix or incorrect behaviour correction
- `docs` — documentation-only change
- `refactor` — behaviour-preserving restructuring
- `test` — test-only change
- `build` — build system, dependency, or packaging change
- `ci` — CI/CD workflow change
- `chore` — housekeeping that fits no other type
- `perf` — performance improvement
- `style` — formatting or style-only change
- `revert` — revert of an earlier change

The set is configurable per repository, but adding to it should be rare: a type
nobody else uses makes history harder to read across repositories.

## Scope

Optional, short, lowercase, stable. Good scopes name the library, app, tool, or
document family affected. Avoid one-off scopes describing only the current
task — if the scope will not help a future search, omit it.

## Description

A short imperative phrase.

```text
feat(model): add claim taxonomy       ✓
feat(model): added claim taxonomy     ✗
feat(model): Adds claim taxonomy.     ✗
```

## Body

The default message is one line. Do not use the body to recite what Git already
records: changed files, file-by-file edits, test output, or a narrated diff.

When a commit genuinely coordinates several changes that need durable context,
every detail line is a bullet with an imperative description:

```text
refactor(model): split claim identity wiring

- move ClaimId to claim namespace
- add claim_id to SubjectClaim struct
```

Prose paragraphs and non-imperative bullets (`- moved ClaimId...`,
`- adds claim_id...`) are rejected. Use bodies sparingly; edits obvious from
the subject and diff rarely warrant one.

## Breaking Changes

```text
BREAKING CHANGE: REST resource paths changed from plural /entities/{id} to singular /entity/{id}
```

Required whenever the subject carries `!`. The callout may follow detail
bullets.

## References

A commit message is permanent and is read far from the machine that wrote it.
Use repository-relative references or public URLs. Avoid machine-local paths,
account-qualified home locations, and paths into another checkout. A reference
to another repository needs a URL that its reader can follow. Local file
references are checked against the candidate index, including staged additions,
rather than whatever happens to exist in the working tree.

## Footers

A repository may declare footers of its own — provenance, sign-off, issue
links. Declared footers are accepted as footers; anything else in the body must
be an imperative bullet or a breaking-change callout, so a repository that
declares none still gets prose rejected.

This repository currently declares no additional footers. There is no required
plan, provenance or work-item trailer. Add any future footer convention and its
validation together rather than silently accepting arbitrary body prose.

## Local enforcement

Run the standalone lint from the repository or a subdirectory:

```sh
node tools/commit-message.mjs <message-file>
```

Use an absolute script path when running from a subdirectory. The checker reads
the message and Git index without changing either. A valid message exits 0;
invalid content, unreadable input or a Git failure exits 1; incorrect arguments
exit 2. Findings point to this guidance. It uses Node.js and Git, with no extra
npm dependency, Rust workspace, task runner or release tooling.

The commit hook runs this message lint first, then the complete local gate:
skill metadata validation, generated writing references, package reference
checks, and the full `node --test` suite. A failed check or a check that cannot
run blocks the commit. Every attempt runs fresh checks; a previous passing run
does not release a later commit.
Personal skill installations are not a prerequisite for this gate.

Run all checks without attempting a commit with
`node tools/verify.mjs`, or the exact message-plus-checks sequence with
`node tools/commit-verify.mjs <message-file>`. Checks run from the workflow
checkout root. Tests exercise the working checkout and its installed
dependencies; they do not materialize the staged index. Keep a partially staged
change coherent independently of unstaged work. Run `npm ci` first when the
checkout's dependencies need installation.

Enable automatic checking once per clone, from this package's checkout:

```sh
node tools/install-hooks.mjs
```

Setup enables the tracked Node launcher in [.githooks/commit-msg](../../.githooks/commit-msg)
using local Git configuration. It preserves an existing hook arrangement by
refusing to replace another configured hooks directory or hide existing hooks.
In that case, have the existing commit-message hook invoke
[the complete commit gate](../../tools/commit-verify.mjs) with Git's message-file
argument and propagate its nonzero exit. Hook setup is independent of personal
skill installation and applies only to development of this package.

Git invokes the hook before creating a commit and a failing hook rejects the
attempt. Hooks are local to an installed clone and can be bypassed with Git's
`--no-verify`; they do not establish server-side enforcement.
[Git hook documentation](https://git-scm.com/docs/githooks#_commit_msg).
This adoption adds no branch restrictions, version stamping, push hook or
server policy.

### What the lint establishes

The lint enforces the subject shape and type list, lowercase scope, lowercase
subject opening and absence of a final subject period. It rejects common
non-imperative opening verbs in subjects and body bullets, requires at least
two words in a detail bullet, accepts indented continuations immediately after
a bullet, rejects body prose and undeclared footers, and requires a nonempty
`BREAKING CHANGE:` callout for a subject marked with `!`. A callout is also
accepted without `!`. A blank line ends a bullet's continuation.

Reference detection covers common home, mounted-volume and account-qualified
paths, plus directory-qualified filename tokens with an extension. It handles
slash and backslash separators, rejects traversal outside the repository, and
checks recognized local filenames against the index. Public HTTP(S) URL spans
are excluded. This is bounded pattern detection, not a complete prose or path
parser; references outside those patterns remain a review responsibility.

The imperative check uses a finite list of common inflections, not an English
grammar engine. Meaningful type and scope selection, actual imperative meaning,
conciseness, whether a body is warranted, and whether a change is breaking still
need author and reviewer judgment. There is no arbitrary subject-length limit.

Input must be UTF-8. The checker uses Git's configured comment marker to ignore
comment lines and cuts at Git's standard scissors marker before validating.
Diagnostics number the cleaned message lines. It never rewrites the file;
Git's own cleanup settings determine what Git stores.
[Git stripspace documentation](https://git-scm.com/docs/git-stripspace).

Fix a finding by correcting the message, then rerun the same command or commit
attempt. Generated merge, revert and fixup messages must also satisfy the
convention; they have no implicit exemption. Existing published history is not
rewritten or retrospectively gated by this hook.
