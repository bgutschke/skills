---
name: draft-commit-message
disable-model-invocation: true
description: Drafts a Conventional Commits message for the currently staged changes — type, optional scope, lowercase imperative subject at or under 72 characters, and a body for any non-trivial change. Reads the diff and branch inside a Haiku subagent so the raw diff never enters the main session. Never runs git add or git commit — it only returns message text for review. Use when the user types /draft-commit-message or explicitly asks to draft, write, or generate a commit message.
---

# draft-commit-message

Draft a commit message for the currently staged changes, using a fixed, standards-based
convention: the Angular Conventional Commits type enum (`build`, `chore`, `ci`, `docs`,
`feat`, `fix`, `perf`, `refactor`, `revert`, `style`, `test`), a lowercase imperative
subject, a header at or under 72 characters (aiming for 50 — git's own classic
subject-line convention, chosen over Angular's own looser 100-character guidance since
it's the tighter, more widely-recognized limit), and no forced scope — a scope
is included only when the change obviously names one affected area, never invented to fill
the slot. This is the one convention the skill knows; it does not read a target repo's own
commitlint config, `CLAUDE.md`, or git history to find a different one.

Two properties hold on every run:

- **Generation only.** The skill only ever returns message text. It never runs `git add`
  or `git commit`, regardless of how it was asked. Staging and committing stay a separate,
  explicit action the user takes themselves.
- **Delegated reading.** The staged diff and branch name are read inside a subagent
  pinned to a fast model, not in the main session — a large diff should never spend the
  calling session's own context.

## When to use

- The user types `/draft-commit-message`.
- The user explicitly asks to draft, write, or generate a commit message for staged
  changes.

## When not to use

- The user asks to commit changes outright ("commit this"). This skill only drafts
  message text; if the user also wants the commit made, that's a separate, explicit step
  after reviewing the draft.
- Nothing is staged. See "Nothing staged" below — the skill still runs, but stops short of
  producing a message.

## Delegation

Call the **Agent** tool with:

- `subagent_type: "general-purpose"`
- `model: "haiku"` — the diff is the only context needed and the drafting rules are fully
  stated below, so a fast model is enough.
- `description: "Draft commit message"`
- `prompt`: the brief below, verbatim plus the convention rules.

### Brief for the subagent

```text
Draft a commit message for the currently staged git changes. Return the message as text.
Do not run `git add` or `git commit` — you are drafting only, never staging or committing.

STEPS:
1. Run `git diff --staged` to see all staged changes.
2. If nothing is staged, stop and report "nothing staged" — do not invent a message.
3. Run `git branch --show-current` to see the branch name (context only — never extract a
   scope or ticket ID from it).
4. Analyze the diff for the single logical change it represents.

FORMAT:
  type(scope): description

- type: one of build, chore, ci, docs, feat, fix, perf, refactor, revert, style, test.
- scope: optional — include only when the change obviously names one affected area or
  component; omit it rather than force one.
- description: lowercase, imperative mood ("add", "fix", "update" — not "added" or
  "adds"), no trailing period.
- Subject line (the whole "type(scope): description") at or under 72 characters, aiming
  for 50 — git's classic subject-line convention.
- Body separated from the subject by a blank line, for any non-trivial change.
- Body explains WHAT changed and WHY, never HOW — the diff already shows how.

NEVER include: a co-author trailer, a URL, or a company/product name.

EXAMPLES:
  feat(auth): add password reset flow

  fix(cache): evict stale entries on write

  refactor: extract validation into a shared helper

  A duplicate copy of the same checks had drifted between two call sites, so a
  fix applied to one silently missed the other.

OUTPUT:
Return only the commit message, or the literal string "nothing staged" if step 2 fired.
```

## After the subagent returns

- If it reported "nothing staged", relay that to the user and stop — do not draft
  anything.
- Otherwise, present the returned message to the user for review. Do not stage or commit
  it yourself, even if asked to "commit this" in the same turn — see "When not to use".

## Worked example

Staged changes: a single-line fix to a null check in a form validator, on a branch named
`fix-validator-crash`. The subagent's `git diff --staged` shows the added guard clause;
`git branch --show-current` returns the branch name, used only as background context, not
parsed for a scope. The subagent returns:

```text
fix(validator): guard against a missing email field

A submission with no email value reached the regex check unguarded, throwing
before the required-field message could render.
```

The skill presents this to the user as-is and stops — no `git add`, no `git commit`.

## Nothing staged

If the subagent reports "nothing staged", say so plainly and stop. Never fall back to
drafting a message from unstaged changes or from the last commit — the message must
describe what's actually about to be committed.
