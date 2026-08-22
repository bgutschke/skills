---
name: to-pr-description
disable-model-invocation: true
argument-hint: "A PR number or URL, or nothing for the current branch's PR"
description: Fill in the blanks of an already-open GitHub PR's description using the target repo's own .github/PULL_REQUEST_TEMPLATE.md, falling back to a built-in What changed/Why/Testing structure when the repo has none. Use when the user asks to fill in, complete, or write a PR description, update a PR body, or types /to-pr-description. Not for opening a new PR, rewriting a body that already has real content, or producing a Screenshot no live browser session can capture.
---

# PR description

Fill the blanks of an already-open PR's description. This is a fill, not a rewrite: the
template's structure — the target repo's own or the built-in fallback — is fixed; only
its blanks move.

## When to use

- The user asks to fill in, complete, or write a PR description, or update a PR body.
- The user types `/to-pr-description`, with or without a PR number or URL.

## When not to use

- Opening a brand-new PR — this skill only edits a PR that already exists and is open.
- A PR body that already has real content in its blanks — filling would overwrite
  something a human wrote; confirm with the user before touching it.
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
   body,url,number,headRefName,title,baseRepository,closingIssuesReferences`.
   `baseRepository` names the PR's own repo (`owner.login`/`name`) — this may differ from
   whatever repo happens to be checked out locally, since `args` can be a full URL into
   any repo.
2. Determine the structure to fill. Fetch `.github/PULL_REQUEST_TEMPLATE.md` from the
   PR's own repo — the only location this skill checks, never a root or `docs/`
   variant — via `gh api repos/<owner>/<name>/contents/.github/PULL_REQUEST_TEMPLATE.md
   --jq .content | base64 --decode`, using `baseRepository` from Step 1. This works
   whether that repo is the one checked out locally or not, so it needs no separate
   local-file path.
   - If the file exists, keep every heading, HTML comment, and checkbox exactly where it
     puts them.
   - If the API call 404s, use the built-in fallback structure: `## What changed`,
     `## Why`, `## Testing`.
3. Preserve anything already appended after the template's own structure — CI-generated
   sections, deploy-preview links, or anything else trailing the body — byte-for-byte, at
   the end. Detect this positionally, by what comes after the template's last section,
   never by matching a specific section name.
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

A PR on this repo closes issue #9. This repo's `.github/PULL_REQUEST_TEMPLATE.md` has
three sections and no checkboxes: `## What changed`, `## Why`, `## Testing`. Nothing is
appended after the template on this repo's PRs yet, so there is nothing to preserve.

- `gh pr view 12 --json body,closingIssuesReferences` returns an empty body and
  `closingIssuesReferences: [{number: 9, ...}]` — GitHub's own linking already ties this
  PR to a ticket.
- This repo's `CLAUDE.md` documents the `Closes #<n>` / `Refs #<n>` footer convention, and
  the linked issue confirms #9 applies here, so **Why** ends with `Closes #9`.
- **What changed** is written from `git log` and `git diff main...HEAD`: adding the
  `to-pr-description` skill and this repo's first `PULL_REQUEST_TEMPLATE.md`.
- **Testing** is written from what the diff shows: `claude plugin validate . --strict`
  passing, plus a dry run of the skill itself against this same PR.
- The filled body is written with `gh pr edit 12 --body-file <file>`, and the report
  lists all three sections as filled, none left untouched.
