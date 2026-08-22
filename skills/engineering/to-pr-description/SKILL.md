---
name: to-pr-description
disable-model-invocation: true
argument-hint: "A PR number or URL, or nothing for the current branch's PR"
description: Fill in the blanks of an already-open GitHub PR's description using the target repo's own .github/PULL_REQUEST_TEMPLATE.md, falling back to a built-in What changed/Why/Testing structure when the repo has none. Use when the user asks to fill in, complete, or write a PR description, update a PR body, or types /to-pr-description. Not for opening a new PR, replacing real content written in a different structure, or producing a Screenshot no live browser session can capture.
---

# PR description

Fill the blanks of an already-open PR's description. This is a fill, not a rewrite: the
template's structure — the target repo's own or the built-in fallback — is fixed; only
its blanks move.

## When to use

- The user asks to fill in, complete, or write a PR description, or update a PR body.
- The user types `/to-pr-description`, with or without a PR number or URL.
- Refreshing a body already filled in the template's own structure, after new commits
  landed since it was last filled — normal fill behavior, no confirmation needed.

## When not to use

- Opening a brand-new PR — this skill only edits a PR that already exists and is open.
- Replacing real content written in a different structure than the target template, or
  content on a PR this fill isn't actually about — that's a rewrite, not a fill; confirm
  with the user before touching it.
- A template's Screenshot (or other visual-evidence) section — leave it exactly as the
  template has it. No live browser session backs this skill, so it cannot produce an "as
  it should appear" image.

## Resolving the target

`args` names the PR — a number or a full GitHub URL. Pass it as `<target>` below; when
`args` is empty, omit `<target>` entirely — `gh pr view` with no argument already
resolves the PR open for the current branch.

## Steps

1. Fetch the PR's current body and metadata:
   `gh pr view <target> --json
   body,url,number,headRefName,baseRefName,title,closingIssuesReferences`.
   The `url` field (`https://github.com/<owner>/<repo>/pull/<n>`) names the PR's own
   repo — this may differ from whatever repo happens to be checked out locally, since
   `args` can be a full URL into any repo.
2. Determine the structure to fill. Fetch `.github/PULL_REQUEST_TEMPLATE.md` as GitHub
   itself would apply it — from the PR's *base* branch, not its head branch, and never a
   root or `docs/` variant — via `gh api
   "repos/<owner>/<repo>/contents/.github/PULL_REQUEST_TEMPLATE.md?ref=<baseRefName>"
   --jq .content | base64 --decode`, using `<owner>/<repo>` and `baseRefName` from
   Step 1.
   - If the file exists, keep every heading, HTML comment, and checkbox exactly where it
     puts them.
   - If the API call 404s, use the built-in fallback structure: `## What changed`,
     `## Why`, `## Testing`.
3. Preserve anything already appended after the template's own structure — CI-generated
   sections, deploy-preview links, or anything else trailing the body — byte-for-byte, at
   the end. Detect this positionally, by what comes after the template's last section,
   never by matching a specific section name. The one exception: drop any AI-attribution
   line — a trailer crediting an AI assistant or tool for writing or generating the PR
   (e.g. "🤖 Generated with [Claude Code]", "Co-Authored-By: <bot>", "Assisted by
   Copilot"). Recognize this by what it says, not a fixed list of tool names, since it's
   an artifact of *how* the PR was authored, not the target repo's own content — and
   never write one when composing a body.
4. Ground every blank in something real on the branch, never invention:
   - **What changed** — summarize the actual diff and commit messages (`git log`, `git
     diff` against the base branch).
   - **Why** — see the ticket-reasoning step below.
   - **Testing** — concrete verification steps derived from what the diff actually
     touches (tests added, commands run, manual steps taken), not generic boilerplate.
   - Any other checkbox or blank the template defines — fill only what the diff
     demonstrably supports; leave the rest unchecked or untouched.
5. Fill **Why**'s ticket-reasoning by tracker convention, with exactly one fallback path:
   - Look for a documented tracker or commit-footer convention in the target repo — a
     `CONTRIBUTING.md`, `CLAUDE.md`/`AGENTS.md`, or a `docs/` page describing one.
   - If one exists, look for evidence tying *this* PR to a ticket in that convention's own
     terms: the `closingIssuesReferences` fetched above, the branch name, or a commit
     message footer matching the convention's format. Follow the convention exactly —
     e.g. a `Closes #<n>` / `Refs #<n>` footer, or a linked tracker URL.
   - Whether no convention is documented at all, or one is documented but no ticket
     applies to this PR, fall back identically: write **Why** as a plain prose summary of
     the diff and commit messages, with no ticket reference. One fallback path, not two.
6. Write the completed body to a scratch file, then update the PR:
   `gh pr edit <target> --body-file <file>`.
7. Report which blanks were filled, which checkboxes were checked, and which sections
   were left untouched and why — so the reasoning is visible before anyone reads the PR
   itself.

## Worked example

This is what actually happened dry-running this skill against its own PR,
[bgutschke/skills#20](https://github.com/bgutschke/skills/pull/20). Its body was still
the raw, unfilled template: `## What changed`, `## Why`, `## Testing`, nothing appended
after it.

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
- The filled body was written with `gh pr edit 20 --body-file <file>`, and the report
  listed all three sections as filled, none left untouched.
