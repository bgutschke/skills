---
name: to-pr
disable-model-invocation: true
argument-hint: "[<PR number or URL>] [--ready|--draft] [--base <branch>]"
description: Open a new PR from the current branch (draft by default, title and body derived from its commits and diff) when none is open yet, or fill in an already-open PR's description using the target repo's own .github/PULL_REQUEST_TEMPLATE.md — falling back to a built-in What changed/Why/Testing structure. --ready/--draft toggle draft state at creation or on an existing PR; --base sets or retargets the base branch. Use when the user asks to open, create, or update a PR, fill in a PR description, or types /to-pr. Not for replacing real content written in a different structure, or producing a Screenshot no live browser session can capture.
---

# to-pr

Open a PR if the target branch doesn't have one yet; otherwise fill in the one that's
already open. Both paths compose the same way: ground every section in the actual diff
and commit history, respect the target repo's own PR template structure, and never
invent content. Neither path prompts for confirmation beyond the invocation itself —
running `/to-pr` is the only authorization step, since it has exactly one user.

## When to use

- The user asks to open, create, or update a PR, or to fill in / refresh a PR
  description.
- The user types `/to-pr`, with or without a target, `--ready`/`--draft`, or `--base`.
- Refreshing a body already filled in the template's own structure, after new commits
  landed since it was last filled, or after a diff or convention change makes an earlier
  fill stale — normal fill behavior, no confirmation needed.
- Flipping an existing PR's ready-for-review state or base branch via `--ready`,
  `--draft`, or `--base`, with no other change intended.

## When not to use

- An explicitly named target (a PR number or URL) that doesn't resolve to a real PR —
  report it as an error. Never fall back to opening a new one; a typo must never create
  an unrelated PR.
- Replacing real content written in a different structure than the target template, or
  content on a PR this fill isn't actually about — that's a rewrite, not a fill; confirm
  with the user before touching it.
- A template's Screenshot (or other visual-evidence) section — leave it exactly as the
  template has it. No live browser session backs this skill, so it cannot produce an "as
  it should appear" image.
- Closed or merged PRs, and GitHub's multi-template chooser folder
  (`.github/PULL_REQUEST_TEMPLATE/*.md`) — only the single-file
  `.github/PULL_REQUEST_TEMPLATE.md` is ever read.

## Argument grammar

Scan `args` for three optional pieces, in any order or position:

- A `--ready` or `--draft` token. Both together is an error: report it and stop.
- A `--base` token immediately followed by a branch-name value.
- One leftover token, the target (a PR number or URL). More than one leftover token is
  ambiguous — report it and stop.

## Routing

- **A target was given** (explicit PR number or URL): always resolve it directly with
  `gh pr view <target> --json body,url,number,headRefName,baseRefName,title,closingIssuesReferences`.
  This is always the update path — an explicit target names a PR that must already
  exist.
- **No target was given**: run `gh pr view --json
  body,url,number,headRefName,baseRefName,title,closingIssuesReferences` for the current
  branch. If it succeeds, take the update path against that PR, reusing this same
  result. If it fails (no PR open for this branch), take the create path.

## Create path

1. **Resolve the base branch**, unless `--base` overrides it:
   - Read the current branch's upstream tracking ref: `git rev-parse --abbrev-ref
     --symbolic-full-name @{u}` (ignore failure — no upstream configured).
   - Use it only if it names a branch with a *different* short name than the current
     branch (strip the remote prefix, e.g. `origin/feature-x` → `feature-x`, and
     compare). Same-name tracking is push/pull plumbing, not a target signal.
   - Otherwise fall through to the repo's default branch: `gh repo view --json
     defaultBranchRef -q .defaultBranchRef.name`.
   - Deliberately no ancestor-detection heuristic (comparing `git merge-base` distance
     across candidate branches) — guessing a target from commit-graph shape is exactly
     the fragility rejected for title derivation below, and base resolution shouldn't
     reintroduce it.
2. **Push the branch** if it needs it. If an upstream is already configured but local
   commits aren't on it (`git rev-list @{u}..HEAD --count` > 0), `git push` is
   unambiguous. If no upstream is configured, push to whichever single remote `git
   remote` lists (`git push -u <remote> HEAD`); more than one configured remote is
   ambiguous — report it and ask which one, rather than guessing `origin`. No
   confirmation once the remote is known.
3. **Derive the title** from the first commit ahead of the resolved base — see
   "Deriving the title" below.
4. **Compose the body** — see "Composing the body" below, fetching the template from the
   base branch resolved in step 1.
5. **Open the PR**: `gh pr create -B <base> --title "<title>" --body-file <file>
   --assignee @me`, adding `--draft` unless `--ready` was given.
6. **Report**: the new PR's URL, title, base, draft/ready state, which title tier fired
   (verbatim / documented convention / inferred convention), whether a merge commit was
   detected ahead of base (informational only — see "Deriving the title"), and that it's
   assigned to you.

## Update path

1. Fetch the PR's current body and metadata (already done during routing, above). The
   `url` field (`https://github.com/<owner>/<repo>/pull/<n>`) names the PR's own repo —
   this may differ from whatever repo happens to be checked out locally, since a target
   can be a full URL into any repo.
2. If `--base` was given, retarget first: `gh pr edit <target> --base <new-base>`. Do
   this before composing the body, so the template fetch in the next step reads the
   *new* base, not the stale one.
3. If `--ready` or `--draft` was given, toggle the PR's state: `gh pr ready <target>` for
   `--ready`, `gh pr ready <target> --undo` for `--draft`.
4. **Compose the body** — see "Composing the body" below, fetching the template from the
   PR's `baseRefName` (the one just retargeted to, if step 2 ran; the original one
   otherwise).
5. Write the completed body to a scratch file, then update the PR in one call,
   self-assigning it at the same time: `gh pr edit <target> --body-file <file>
   --add-assignee @me`.
6. **Report**: which blanks were filled, which checkboxes were checked, which sections
   were left untouched and why, any retarget or draft-state change applied, and that the
   PR is assigned to you — so the reasoning is visible before anyone reads the PR itself.

## Composing the body

Shared by both paths. "The template" means the target repo's own
`.github/PULL_REQUEST_TEMPLATE.md`, fetched from whichever base branch the calling path
already settled on (the create path's step 1, or the update path's `baseRefName`) — never
the head branch, and never a root or `docs/` variant:

```
gh api "repos/<owner>/<repo>/contents/.github/PULL_REQUEST_TEMPLATE.md?ref=<base>" \
  --jq .content | base64 --decode
```

- If the file exists, keep every heading, HTML comment, and checkbox exactly where it
  puts them.
- If the API call 404s, use the built-in fallback structure: `## What changed`,
  `## Why`, `## Testing`.
- Never delegate this to `gh pr create`'s own `-T`/`--fill`/`--fill-verbose` — `-T` dumps
  a local file's raw text with no blank-filling, and `--fill`/`--fill-verbose` autofill
  from commit messages with no template awareness. Always compose the full body and pass
  it via `--body-file`/`-F`.

On the update path only, preserve anything already appended after the template's own
structure — CI-generated sections, deploy-preview links, or anything else trailing the
body — byte-for-byte, at the end. Detect this positionally, by what comes after the
template's last section, never by matching a specific section name. The one exception:
drop any AI-attribution line — a trailer crediting an AI assistant or tool for writing or
generating the PR (e.g. "🤖 Generated with [Claude Code]", "Co-Authored-By: <bot>",
"Assisted by Copilot"). Recognize this by what it says, not a fixed list of tool names,
since it's an artifact of *how* the PR was authored, not the target repo's own content —
and never write one when composing a body. On the create path, there is nothing to
conflict with yet, so this step doesn't apply.

Before grounding any blank, gather the diff evidence once per invocation. A real diff can
run arbitrarily large, unlike every other lookup this skill makes — dispatch a
`general-purpose` subagent to read it instead of pulling it into this session directly. Do
not override the subagent's model: the "never invent" grounding this evidence must hold
up under is a judgment call, not a mechanical extraction, and isn't a place to trade
quality for a cheaper tier.

Task the subagent to run `git log --first-parent <base>..HEAD` (full commit messages, not
just subjects) and `git diff <base>...HEAD` against the base branch the calling path
already resolved, then report back only what it can ground in that output, in clearly
labeled sections:

- **Change summary** — what the diff actually does, file by file or logically grouped;
  never what the change is *for*.
- **Testing evidence** — tests added or modified, commands the diff implies running, any
  manual verification steps visible in the diff or commit messages. Omit the category
  entirely rather than pad it with generic boilerplate.
- **Commit messages** — reproduce each one inside a fenced code block, character-for-
  character; never paraphrase, condense, or summarize, even under length pressure. The
  ticket-reasoning fallback below depends on exact footer text — blurring `Refs #9` into
  something that reads like `Closes #9` is exactly the failure this category exists to
  prevent.
- **Ticket references** — any ticket number or tracker URL appearing in a commit message
  or the diff itself.

The report is evidence, not prose for any specific template — the subagent doesn't know
which template this run will fill, so it must never assume a target's section names or
structure. Mapping the evidence onto the actual template's blanks stays this skill's own
job, below.

As a cheap cross-check before trusting the report, run `git diff --stat <base>...HEAD`
directly in this session — file list and line counts only, never the full diff — and
compare it against the subagent's change summary. A mismatch (fewer files mentioned than
`--stat` shows, for instance) means re-running the subagent, not composing the body from
an incomplete report.

Ground every blank in something real, never invention:

- **What changed** — the diff-evidence subagent's change summary.
- **Why** — see the ticket-reasoning step below.
- **Testing** — the diff-evidence subagent's testing evidence; if it omitted the
  category, leave **Testing** unfilled rather than inventing boilerplate.
- Any other checkbox or blank the template defines — fill only what the diff-evidence
  subagent's report demonstrably supports; leave the rest unchecked or untouched.
- A template's non-blank content — a fixed disclaimer, a Screenshot section — is left
  exactly as the template has it, filled only if the diff demonstrably supports it, never
  invented.

Fill **Why**'s ticket-reasoning by tracker convention, with exactly one fallback path:

- Look for a documented tracker or commit-footer convention in the target repo — a
  `CONTRIBUTING.md`, `CLAUDE.md`/`AGENTS.md`, or a `docs/` page describing one.
- If one exists, look for evidence tying *this* PR to a ticket in that convention's own
  terms: `closingIssuesReferences`, the branch name, the diff-evidence subagent's ticket
  references, or a commit message footer matching the convention's format. Follow the
  convention exactly — e.g. a `Closes #<n>` / `Refs #<n>` footer, or a linked tracker URL.
- Whether no convention is documented at all, or one is documented but no ticket applies
  to this PR, fall back identically: write **Why** as a plain prose summary built from the
  diff-evidence subagent's change summary and commit messages, with no ticket reference.
  One fallback path, not two.

## Deriving the title

Create path only — the update path never touches an existing PR's title.

Never use `gh pr create`'s own `--fill-first`: it has a documented, open bug
([cli/cli#10604](https://github.com/cli/cli/issues/10604)) where, on a branch containing
a merge commit, `git log`'s default traversal can surface a commit from the *merged-in*
branch as "first" instead of the actual first commit made on the current branch. Instead,
run the equivalent yourself with `--first-parent`, which sidesteps this unconditionally:

```
git log --reverse --first-parent <base>..HEAD --format=%s
```

The first line is the first commit's subject.

Regardless of commit count, check for a merge commit ahead of base: `git log
--first-parent <base>..HEAD --merges`. If non-empty, report it to the developer as
informational — it doesn't block creation or change title derivation (already immune to
it via `--first-parent` above, even when that first-parent commit is itself a merge); it
just surfaces non-linear history before it becomes a rebase-merge conflict at merge time.

If the `%s` log above has only one line, the branch is single-commit: the title is that
subject, verbatim — done, skip the tier selection below entirely.

On a multi-commit branch, pick a formatting tier, in priority order, and apply at most
one:

- **Documented convention.** Check the target repo for a documented PR-title convention
  the same way the "Why" step above checks for a documented ticket-reasoning convention.
  A documented commit-message format convention (e.g. Conventional Commits in
  `AGENTS.md`/`CLAUDE.md`) counts as a documented PR-title convention too, unless the
  repo's docs distinguish PR titles from commit messages explicitly.
- **Inferred convention**, only if no documented one applies: `gh pr list --state merged
  --base <resolved-base> --json title -L 20`. Fewer than 5 results: skip this tier
  entirely, not enough history to call anything established. Otherwise compare the
  sampled titles across three dimensions *together*: a leading prefix format
  (Conventional-Commits `type(scope): `, a ticket bracket like `[ABC-123]`, an emoji, or
  none), the capitalization of the first word after any prefix, and the presence or
  absence of a trailing period. Established only if at least 80% of the sample share the
  same combination of all three. Any failure fetching this history (API error, timeout,
  rate limit) falls back silently to the plain default below — this tier is a
  nice-to-have signal, never load-bearing.
- **Plain default**: the first commit's subject, verbatim.

Whichever tier applies (documented or inferred), it only ever *reformats* the first
commit's already-grounded subject into that shape — never invents substantive content (a
ticket number the skill has no evidence for, for instance). If the detected shape needs
information the skill can't ground in something real, skip adapting and fall through to
the plain default instead.

## Worked examples

**Update path**, dry-run against this skill's own predecessor PR,
[bgutschke/skills#20](https://github.com/bgutschke/skills/pull/20) — its body was still
the raw, unfilled template (`## What changed`, `## Why`, `## Testing`, nothing appended
after it):

- `gh pr view 20 --json body,closingIssuesReferences` returned an empty body and
  `closingIssuesReferences: []` — GitHub's own linking found no ticket, because this
  repo's commit footers use `Refs #9`, which GitHub doesn't auto-link the way `Closes`
  does.
- This repo's `CLAUDE.md` documents the `Closes #<n>` / `Refs #<n>` footer convention.
  The commit history's actual footer — `Refs #9`, not `Closes #9` — is the evidence, so
  **Why** ends with `Refs #9`, not the `Closes #9` a naive reading of the linked issue
  might suggest.
- **What changed** was written from `git log` and `git diff main...HEAD`: adding the
  `to-pr-description` skill and this repo's first `PULL_REQUEST_TEMPLATE.md`.
- **Testing** was written from what the diff and history actually showed:
  `claude plugin validate . --strict` passing, plus this same dry run.
- The filled body was written and the PR self-assigned in one call — `gh pr edit 20
  --body-file <file> --add-assignee @me` — and the report listed all three sections as
  filled, none left untouched, and the new assignee.

**Create path title derivation**, dry-run read-only against this repo's real history
(no PR opened by this check): `git log --reverse --first-parent main..HEAD --format=%s`
on a multi-commit working branch returns several conventional-commit subjects. Before
checking the inferred tier, the documented-convention check finds this repo's own
Conventional Commits rule in `CLAUDE.md` — so the documented tier applies and the
inferred-tier query never runs. Confirming what that inferred tier *would* have found
had no documented convention existed: `gh pr list --state merged --base main --json
title -L 20` returned 9 merged PRs, 8 of which share the `type(scope): ` or `type: `
prefix format, lowercase first word, and no trailing period (89%, above the 80% floor) —
so on an undocumented repo this same branch would have landed in the inferred tier
instead of the plain default, with the same result either way, since the first commit's
subject already matches that shape verbatim. Because the documented tier's reformatting
is a no-op whenever the first commit already conforms to it, the title in both cases is
simply that first commit's subject, unmodified.
