---
name: draft-commit-message
disable-model-invocation: true
description: Drafts a Conventional Commits message for the currently staged changes, matched to the target repo's own discovered commit-message convention (commitlint config, written doc, or git-log pattern) where one exists, falling back to a generic standards-based convention otherwise. Reads the diff and branch inside a Haiku subagent so the raw diff never enters the main session. Never runs git add or git commit — it only returns message text for review. Use when the user types /draft-commit-message or explicitly asks to draft, write, or generate a commit message.
---

# draft-commit-message

Draft a commit message for the currently staged changes, matched to whatever commit-message
convention the target repo actually has. Before drafting, the skill discovers that
convention itself — a commitlint config, a written convention doc, or a pattern in recent
git history — and only falls back to a generic, standards-based default when none of those
exist. See "Convention discovery" below for how.

The generic fallback, used only when discovery finds nothing: the Angular Conventional
Commits type enum (`build`, `chore`, `ci`, `docs`, `feat`, `fix`, `perf`, `refactor`,
`revert`, `style`, `test`), a lowercase imperative subject, a header at or under 72
characters (aiming for 50 — git's own classic subject-line convention, chosen over
Angular's own looser 100-character guidance since it's the tighter, more
widely-recognized limit), and no forced scope — a scope is included only when the change
obviously names one affected area, never invented to fill the slot.

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

## Dependencies

Requires `node` to run the bundled convention-resolution script
(`scripts/resolve-commit-convention-cli.js`), which Convention discovery step 4 invokes on
every run. `git` is also used but is ambient on any machine capable of running Claude
Code, so it isn't listed here. `commitlint` is checked opportunistically in Convention
discovery step 1 — not a hard dependency, since its absence or failure just skips that one
signal.

## Convention discovery

Runs once, inline in the main session, before the subagent is dispatched — these are
bounded, cheap reads with no isolation benefit from delegating them, and the subagent
should receive an already-resolved convention rather than go hunting the filesystem
itself.

1. **Commitlint signal**: run `commitlint --print-config json`, capturing stdout to a
   temporary file. If the command isn't found, exits non-zero, or its output isn't valid
   JSON, skip this signal entirely — don't pass a `--commitlint-config-file` flag in step
   4.
2. **Written-doc signal**: read `CLAUDE.md` at the repo root if it exists; otherwise
   `CONTRIBUTING.md` if that exists. Skip this signal if neither file exists.
3. **Git-log signal**: run `git log -n 30 --pretty=format:%s` to sample recent subject
   lines. An empty or very short repo naturally yields a thin sample — no special-casing
   needed, since the module below degrades gracefully on its own.
4. Run `node ${CLAUDE_SKILL_DIR}/scripts/resolve-commit-convention-cli.js`, passing
   whichever flags apply from steps 1–3: `--commitlint-config-file <path>`,
   `--doc-file <path>`, and one `--subject "<line>"` per sampled git-log line. **Execute
   this script directly — it deterministically resolves the three signals in priority
   order (commitlint config, then written doc, then git-log sample), degrading to the
   next source whenever the higher-priority one is absent or unusable. Never re-derive
   this priority order by hand, and never blend fields from more than one source
   yourself.**
5. Parse the JSON it prints — the **resolved convention**:
   - `source`: `"commitlint"`, `"doc"`, `"git-log"`, or `"fallback"`.
   - `typeEnum`: the allowed commit types.
   - `subjectCase`: `"lower-case"` or `"unspecified"`.
   - `headerMaxLength`: the header's maximum character count.
   - `scopeRule`: `{ "type": "free" }`, or `{ "type": "enum", "values": [...] }` when
     scope is restricted to a fixed vocabulary.
   - `fallback`: `true` only when `source` is `"fallback"` — no signal was found anywhere,
     and the generic convention described above is being used as-is.

## Delegation

Call the **Agent** tool with:

- `subagent_type: "general-purpose"`
- `model: "haiku"` — the diff is the only context needed and the drafting rules are fully
  stated below, so a fast model is enough.
- `description: "Draft commit message"`
- `prompt`: the brief below, with its FORMAT section filled in from the resolved
  convention (step 5) rather than sent verbatim.

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

- type: one of <resolved convention's typeEnum, comma-separated>.
- scope: <if scopeRule.type is "enum": one of <scopeRule.values, comma-separated>,
  included only when the change obviously names one of them — omit it rather than force
  one. Otherwise: optional — include only when the change obviously names one affected
  area or component; omit it rather than force one.>
- description: <if subjectCase is "lower-case": lowercase,> imperative mood ("add", "fix",
  "update" — not "added" or "adds"), no trailing period.
- Subject line (the whole "type(scope): description") at or under <resolved convention's
  headerMaxLength> characters.
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

A repo with its own commitlint config resolves differently at step 4 of Convention
discovery — say `--print-config json` reports a 100-character header limit and a
`scope-enum` restricted to `["api", "ui"]`. The resulting brief asks for a header at or
under 100 characters and a scope from that exact list rather than an unconstrained one,
so the subagent might return `fix(api): guard against a missing email field` instead of
the unscoped, 72-character-limited form above — same underlying change, formatted to the
repo's own rules instead of the generic fallback.

## Nothing staged

If the subagent reports "nothing staged", say so plainly and stop. Never fall back to
drafting a message from unstaged changes or from the last commit — the message must
describe what's actually about to be committed.
