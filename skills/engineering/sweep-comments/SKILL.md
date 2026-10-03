---
name: sweep-comments
disable-model-invocation: true
context: fork
agent: general-purpose
model: sonnet
background: false
description: "Deletes disallowed comments from the lines that the current branch added, compared with the repository's default branch, including the working tree. A bundled classifier sorts every comment into a category. The sweep keeps doc comments, license headers, formatter directives, and comments that explain a why the code cannot state. It leaves lint and type suppressions in place and lists them. It deletes narration, banners, commented-out code, TODO notes, and justifications with no keep reason. It edits no code, and never stages or commits. Returns a report with a deletion count per file, each kept comment with its reason, and each suppression. Invoked by the user only, with /sweep-comments."
---

# sweep-comments

Look at every comment on the lines that this branch added. If the comment is not on the
keep list, delete it. You run as a forked subagent. You do not see the conversation that
started you. This file is your full brief.

You change comments only. You do not edit code, run a formatter, stage, or commit. The
developer reviews the working-tree diff and commits.

## When to use

- The user types `/sweep-comments`.

## When not to use

- The current directory is not a git repository. Say so and stop.
- The user wants a review that only reports and edits nothing. This skill deletes.
- The user wants lint or type suppressions removed. The sweep never deletes a suppression.
- The user wants the code reshaped so that a comment is no longer necessary. The sweep
  changes no code.

## Dependencies

Requires `node` to run the bundled classifier,
`${CLAUDE_SKILL_DIR}/scripts/classify-comments-cli.js`.

## The keep list

The keep list has four entries. If one of them applies, keep the comment:

1. A doc comment that defines a public contract, for example JSDoc, a Rust `///` line, or
   a C# `///` line.
2. A comment that explains a why the code cannot state. The why is an external dependency,
   platform, vendor, or protocol constraint. Or it is a non-obvious behavior that no
   rename or extraction can make plain.
3. A license or legal header.
4. A formatter directive, for example `prettier-ignore` or `fmt: off`.

Delete every other comment. This includes:

- narration that restates the code next to it
- section banners and separators
- commented-out code
- TODO, FIXME, and similar notes
- a justification with no keep-list reason, however long it is

Never shorten or reword a comment. Keep it whole, or delete it whole.

A lint or type suppression, for example `eslint-disable-next-line` or `@ts-expect-error`,
is not on the keep list. Do not delete it. A suppression changes build behavior, so its
removal is the developer's decision. List it in the report.

## Step 1: Find the base

Run `git rev-parse --is-inside-work-tree`. If it fails, reply that the directory is not a
git repository and stop.

Find the default branch:

1. Run `git symbolic-ref --quiet --short refs/remotes/origin/HEAD`. If it prints a ref,
   for example `origin/main`, use that ref.
2. Otherwise, try `origin/main`, `origin/master`, `main`, and `master`, in that order.
   Use the first one that `git rev-parse --verify --quiet <ref>` accepts.
3. If no ref resolves, reply that the default branch was not found and stop.

Run `git merge-base <ref> HEAD` and keep the result as `<base>`.

## Step 2: Classify

Run the classifier on the diff from `<base>` to the working tree:

```bash
git diff --no-color --no-ext-diff <base> | node "${CLAUDE_SKILL_DIR}/scripts/classify-comments-cli.js"
```

`git diff` does not show untracked files. Every line of an untracked file is an added
line. List untracked files with `git ls-files --others --exclude-standard`. If the list is
not empty, pass the paths to the classifier as arguments:

```bash
node "${CLAUDE_SKILL_DIR}/scripts/classify-comments-cli.js" <path>...
```

Each command prints a JSON array of records. A record has these fields:

- `file`: the path, relative to the repository root
- `startLine` and `endLine`: line numbers in the working-tree file
- `text`: the full comment text, with its markers
- `category`: one of the six categories below
- `rule`: on a suppression only, the rule it names, or `null`
- `code`: present only when code shares a line with the comment

If both arrays are empty, go to Step 5 and report zero deletions.

## Step 3: Decide each record

Act on each record by its category:

| Category | Action | Report section |
| --- | --- | --- |
| `doc-comment` | Keep | Kept, reason "doc comment" |
| `license-header` | Keep | Kept, reason "license header" |
| `formatter-directive` | Keep | Kept, reason "formatter directive" |
| `suppression` | Leave in place | Suppressions, with `rule` |
| `commented-out-code` | Delete | Files touched |
| `needs-judgment` | Apply the keep list | Kept or Files touched |

For a `needs-judgment` record, read the code around it in the file. If keep list entry 2
applies, keep the comment. Write the reason as one short clause that names the constraint.
An example is "Safari drops the event without the timeout".

The classifier does not always recognize a doc comment, a license header, or a formatter
directive. An example is a file in a language that the classifier does not know.
Then the record is `needs-judgment`. Keep it, and use the entry name as the reason, for
example "doc comment".

If you cannot decide whether a keep-list entry applies, delete the comment. The keep list
is a leash, not a default.

## Step 4: Delete

Edit each file with exact string replacement. Change no character outside the comment:

- **Whole-line comment.** The record has no `code` field. Remove every line from
  `startLine` to `endLine`, with its line break. Leave no blank line where the comment
  was. Keep any blank line that was there before.
- **Trailing comment.** The record has a `code` field, and the comment follows code on the
  same line. Remove the comment and the whitespace directly before it. The code stays.
- **Block comment between code.** Code stands before and after the comment on the same
  line. Remove the comment and the whitespace directly after it. The code stays.
- **Multi-line block.** Remove the whole block, from its opener to its closer. If the
  block's lines hold no code, remove the lines.

Read each file before you edit it. Line numbers in a record match the file before any
edit, so delete from the bottom of a file to the top.

Do not run a formatter, a linter, `git add`, `git commit`, or `git stash`.

## Step 5: Report

Return this report as your final message, and nothing else:

```markdown
## Comment sweep

Base: `<ref>` at `<short base hash>`

### Files touched

| File | Deleted |
| --- | --- |
| `<path>` | <count> |

### Kept

| Location | Reason |
| --- | --- |
| `<path>:<startLine>` | <reason> |

### Suppressions

| Location | Rule |
| --- | --- |
| `<path>:<startLine>` | `<rule>`, or "none named" |

Deleted <total> comments in <file count> files. The changes are unstaged.
```

If a section has no rows, write "None." under its heading. A record that covers more
than one line counts as one deletion. The last line is the reply contract. It
restates the total and says that the changes are unstaged. If the total is zero, the last
line reads "Deleted 0 comments. Nothing changed." This also applies when every comment
was kept.

## Worked example

This example is synthetic. The branch adds lines to two files, `src/cart.ts` and
`scripts/build.sh`. The default branch is `origin/main`. The added lines of `src/cart.ts`:

```ts
// Copyright 2026 Example Co. Licensed under MIT.
/** Returns the cart total in cents. */
export function total(items: Item[]): number {
  // ===== totals =====
  // loop over the items and add the prices
  let sum = 0;
  for (const item of items) sum += item.price; // add price
  // const tax = sum * 0.19;
  // The payment provider rejects amounts above 99999999 cents.
  return Math.min(sum, 99999999);
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const debug: any = {};
```

The added lines of `scripts/build.sh`:

```bash
# TODO: cache this step
npm run build
```

The classifier returns eight records:

| Location | Category | Action |
| --- | --- | --- |
| `src/cart.ts:1` | `license-header` | Keep |
| `src/cart.ts:2` | `doc-comment` | Keep |
| `src/cart.ts:4-5` | `needs-judgment` | Delete: a banner and narration |
| `src/cart.ts:7` | `needs-judgment`, with `code` | Strip ` // add price`: narration |
| `src/cart.ts:8` | `commented-out-code` | Delete |
| `src/cart.ts:9` | `needs-judgment` | Keep: a vendor constraint |
| `src/cart.ts:12` | `suppression`, rule `@typescript-eslint/no-explicit-any` | Leave in place |
| `scripts/build.sh:1` | `needs-judgment` | Delete: a TODO note |

The classifier joins lines 4 and 5 into one record, because they are adjacent whole-line
comments. That record removes two lines but counts as one deletion. After the edits,
`src/cart.ts` reads:

```ts
// Copyright 2026 Example Co. Licensed under MIT.
/** Returns the cart total in cents. */
export function total(items: Item[]): number {
  let sum = 0;
  for (const item of items) sum += item.price;
  // The payment provider rejects amounts above 99999999 cents.
  return Math.min(sum, 99999999);
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const debug: any = {};
```

The report:

```markdown
## Comment sweep

Base: `origin/main` at `3f9c2a1`

### Files touched

| File | Deleted |
| --- | --- |
| `src/cart.ts` | 3 |
| `scripts/build.sh` | 1 |

### Kept

| Location | Reason |
| --- | --- |
| `src/cart.ts:1` | license header |
| `src/cart.ts:2` | doc comment |
| `src/cart.ts:9` | the payment provider caps the amount |

### Suppressions

| Location | Rule |
| --- | --- |
| `src/cart.ts:12` | `@typescript-eslint/no-explicit-any` |

Deleted 4 comments in 2 files. The changes are unstaged.
```
