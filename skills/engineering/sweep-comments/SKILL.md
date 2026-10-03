---
name: sweep-comments
disable-model-invocation: true
context: fork
agent: general-purpose
model: sonnet
background: false
argument-hint: "[--base <branch>] [--widen] [<file>...]"
description: "Deletes disallowed comments from the lines that the current branch added, compared with the repository's default branch, including the working tree. --base names another base branch. --widen sweeps the full content of each touched file. A list of files replaces the diff. A bundled classifier sorts every comment into a category. The sweep keeps doc comments, license headers, formatter directives, and comments that explain a why the code cannot state. A kept why about the repository's own code gets a reshape flag that names the symbol and proposes a rename, extraction, or type. It leaves lint and type suppressions in place and lists them. It deletes narration, banners, commented-out code, TODO and FIXME notes, justifications with no keep reason, and comments it cannot place. It edits no code, and never stages or commits. Returns a report: deletions per file, kept comments with reasons, reshape flags, suppressions, removed notes, and ambiguous deletions. Invoked by the user only, with /sweep-comments."
---

# sweep-comments

Look at every comment in scope. By default, the scope is the lines that this branch added.
If a comment is not on the keep list, delete it. You run as a forked subagent. You do not
see the conversation that started you. This file is your full brief.

You change comments only. You do not edit code, run a formatter, stage, or commit. The
developer reviews the working-tree diff and commits.

The shape of the keep list and the idea of the reshape flag come from the `no-comments`
skill and the Comment Sicko agent in the pstack plugin for Cursor, MIT licensed.

## When to use

- The user types `/sweep-comments`.

## When not to use

- The current directory is not a git repository. Say so and stop.
- The user wants a review that only reports and edits nothing. This skill deletes.
- The user wants lint or type suppressions removed. The sweep never deletes a suppression.
- The user wants the code reshaped so that a comment is no longer necessary. The sweep
  changes no code. It only proposes the reshape in a flag.

## Arguments

The arguments for this run are: `$ARGUMENTS`

The grammar is `[--base <branch>] [--widen] [<file>...]`. Every part is optional:

- `<file>...`: one or more file paths, relative to the current directory. The full content
  of each file is in scope. The diff is not read.
- `--base <branch>`: compare with this branch, not with the default branch.
- `--widen`: put the full content of each file that the diff touches in scope, not only
  the added lines.

A file path that starts with `--` reads as a flag, so the grammar cannot name it.

Resolve the scope in this order:

1. If one or more file paths are present, the scope is those files. Ignore `--base` and
   `--widen`.
2. Otherwise, the base is the `--base` branch. If there is no `--base`, the base is the
   repository's default branch.
3. If `--widen` is present, the scope is the full content of each file that the diff from
   the base touches. Otherwise, the scope is only the added lines of that diff.

If an argument starts with `--` and is not `--base` or `--widen`, reply with the grammar
and stop. If `--base` has no branch after it, do the same.

## Dependencies

Requires `node` to run the bundled classifier,
`${CLAUDE_SKILL_DIR}/scripts/classify-comments-cli.js`.

## The keep list

The keep list has four entries. If one of them applies, keep the comment:

1. A doc comment that defines a public contract, for example JSDoc, a Rust `///` line, or
   a C# `///` line.
2. A comment that explains a why the code cannot state. The why is an external dependency,
   platform, vendor, or protocol constraint. Or it is a non-obvious behavior that the code
   does not state. If a rename or extraction can make that behavior plain, add a reshape
   flag. Step 3 describes the flag.
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

## Step 1: Resolve the scope

Run `git rev-parse --is-inside-work-tree`. If it fails, reply that the directory is not a
git repository and stop. This check applies to every scope, a list of files too. The
developer reviews the deletions as a git diff.

If the arguments name files, make sure that each path is a file. Use `test -f <path>`. If
one is not a file, reply with its path and stop. Then go to Step 2.

For the other two scopes, run every later command from the repository root. The root is
the directory that `git rev-parse --show-toplevel` prints.

If the arguments have `--base <branch>`, find the ref:

1. Use the first of `<branch>` and `origin/<branch>` that
   `git rev-parse --verify --quiet <ref>^{commit}` accepts.
2. If neither resolves, reply that the base branch `<branch>` was not found and stop.

Otherwise, find the default branch:

1. Run `git symbolic-ref --quiet --short refs/remotes/origin/HEAD`. If it prints a ref,
   for example `origin/main`, use that ref.
2. Otherwise, try `origin/main`, `origin/master`, `main`, and `master`, in that order.
   Use the first one that `git rev-parse --verify --quiet <ref>` accepts.
3. If no ref resolves, reply that the default branch was not found and stop.

Run `git merge-base <ref> HEAD` and keep the result as `<base>`. The diff starts at this
merge base, not at the tip of `<ref>`. Thus commits that landed on `<ref>` later are not in
scope.

## Step 2: Classify

Run the classifier for the scope from Step 1.

**A list of files.** Pass the paths as arguments, exactly as the user wrote them:

```bash
node "${CLAUDE_SKILL_DIR}/scripts/classify-comments-cli.js" <file>...
```

**Added lines, the default.** Run the classifier on the diff from `<base>` to the working
tree:

```bash
git diff --no-color --no-ext-diff <base> | node "${CLAUDE_SKILL_DIR}/scripts/classify-comments-cli.js"
```

`git diff` does not show untracked files. Every line of an untracked file is an added
line. Pass the untracked files to the classifier as arguments:

```bash
git ls-files -z --others --exclude-standard \
  | xargs -0 -r node "${CLAUDE_SKILL_DIR}/scripts/classify-comments-cli.js"
```

**Widened.** Pass the touched files that still exist, and the untracked files, to the
classifier as arguments:

```bash
{ git diff -z --name-only --diff-filter=d <base>; git ls-files -z --others --exclude-standard; } \
  | xargs -0 -r node "${CLAUDE_SKILL_DIR}/scripts/classify-comments-cli.js"
```

A comment on a line that the branch did not change is then in scope too.

Keep the `-z` and `-0` flags. They pass each path whole, also with a space or a non-ASCII
character in it. If there are no paths, `-r` runs nothing.

Each command prints a JSON array of records. A long path list can print more than one
array. A binary file yields no records. A record has these fields:

- `file`: the path, relative to the repository root. For a list of files, the path as the
  user wrote it.
- `startLine` and `endLine`: line numbers in the working-tree file
- `text`: the full comment text, with its markers
- `category`: one of the six categories below
- `rule`: on a suppression only, the rule it names, or `null`
- `code`: present only when code shares a line with the comment

If every array is empty, go to Step 5 and report zero deletions.

## Step 3: Decide each record

Act on each record by its category:

| Category | Action | Report section |
| --- | --- | --- |
| `doc-comment` | Keep | Kept, reason "doc comment" |
| `license-header` | Keep | Kept, reason "license header" |
| `formatter-directive` | Keep | Kept, reason "formatter directive" |
| `suppression` | Leave in place | Suppressions, with `rule` |
| `commented-out-code` | Delete | Files touched |
| `needs-judgment` | Apply the keep list | Kept, Reshape flags, Files touched, Removed notes, or Ambiguous deletions |

For a `needs-judgment` record, read the code around it in the file. If keep list entry 2
applies, keep the comment. Write the reason as one short clause that names the constraint.
An example is "Safari drops the event without the timeout".

The classifier does not always recognize a doc comment, a license header, or a formatter
directive. An example is a file in a language that the classifier does not know.
Then the record is `needs-judgment`. Keep it, and use the entry name as the reason, for
example "doc comment".

### Reshape flags

A kept why comment can describe a constraint outside the repository. Examples are a
dependency, a platform, a vendor, or a protocol. The code cannot state such a why, so the
comment needs no flag.

A kept why comment can also describe a surprise in the repository's own code. An example
is "price is in cents, because toItem multiplies by 100". A rename, an extraction, or a
type can make the code state this why. Keep the comment, because the code does not state
the why yet. Deletion now loses the information. Then add a reshape flag with these parts:

- the location of the comment, `<path>:<startLine>`
- the exact symbol that holds the surprise, for example `Item.price` or `parseOrder`. If
  its definition is outside the scope, find it in the repository with `git grep`. If the
  repository has no definition, name the symbol as the code next to the comment uses it
- one concrete proposal: a rename, an extraction, or a type, with the new name

A reshape flag changes no code. Do not edit the symbol, its callers, or the comment.

### TODO and FIXME notes

A TODO, FIXME, or similar note is not on the keep list. Delete it, also when it names a
reason. List it under "Removed notes" in the report with its full text, so that the
developer can move it to an issue tracker.

The classifier gives each line that starts with TODO, FIXME, XXX, or HACK a record of its
own. The line directly below a note
can continue the note. If it does, delete it too, and add its text to the note's row. If it
holds its own comment, decide it as its own record.

### Ambiguous comments

If you cannot decide whether a keep-list entry applies, delete the comment. The keep list
is a leash, not a default. List the comment under "Ambiguous deletions" in the report with
its full text. The developer then finds it in the diff and restores it if necessary.

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

Resolve each `file` against the directory that the classifier ran in. Read each file
before you edit it. Line numbers in a record match the file before any edit, so delete
from the bottom of a file to the top.

Do not run a formatter, a linter, `git add`, `git commit`, or `git stash`.

## Step 5: Report

Return this report as your final message, and nothing else. Always use this exact
structure:

```markdown
## Comment sweep

Scope: <scope line>

### Files touched

| File | Deleted |
| --- | --- |
| `<path>` | <count> |

### Kept

| Location | Reason |
| --- | --- |
| `<path>:<startLine>` | <reason> |

### Reshape flags

| Location | Symbol | Proposal |
| --- | --- | --- |
| `<path>:<startLine>` | `<symbol>` | <proposal> |

### Suppressions

| Location | Rule |
| --- | --- |
| `<path>:<startLine>` | `<rule>`, or "none named" |

### Removed notes

| Location | Text |
| --- | --- |
| `<path>:<startLine>` | `<text>` |

### Ambiguous deletions

| Location | Text |
| --- | --- |
| `<path>:<startLine>` | `<text>` |

Deleted <total> comments in <file count> files. The changes are unstaged.
```

The scope line is one of these, for added lines, widened, and a list of files:

```text
added lines since `<ref>` at `<short base hash>`
full content of touched files since `<ref>` at `<short base hash>`
<count> files named in the arguments
```

If the arguments name files and also have `--base` or `--widen`, add "(`--base` and
`--widen` ignored)" to the end of the scope line.

Keep the six sections in this order. If a section has no rows, write "None." under its
heading. Every location uses the line numbers from the classifier, before any edit. The
text in "Removed notes" and "Ambiguous deletions" is the record's full `text`. Replace each
line break with a space, and escape each `|` as `\|`.

Each record goes in one report section only. A TODO or FIXME note goes in "Removed
notes", never in "Ambiguous deletions".

Every deleted record counts in "Files touched", a removed note and an ambiguous deletion
too. A record that covers more than one line counts as one deletion. A continuation line
that you add to a note's row counts with the note, as one deletion. The last line is the
reply contract. It restates the total and says that the changes are unstaged. If the total
is zero, the last line reads "Deleted 0 comments. Nothing changed." This also applies when
every comment was kept.

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
  // item.price is in cents already, because toItem multiplies the API value by 100.
  for (const item of items) sum += item.price; // add price
  // const tax = sum * 0.19;
  // applyCoupon must run before the cap.
  sum = applyCoupon(sum);
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

The classifier returns ten records:

| Location | Category | Action |
| --- | --- | --- |
| `src/cart.ts:1` | `license-header` | Keep |
| `src/cart.ts:2` | `doc-comment` | Keep |
| `src/cart.ts:4-5` | `needs-judgment` | Delete: a banner and narration |
| `src/cart.ts:7` | `needs-judgment` | Keep, with a reshape flag: a surprise in our own code |
| `src/cart.ts:8` | `needs-judgment`, with `code` | Strip ` // add price`: narration |
| `src/cart.ts:9` | `commented-out-code` | Delete |
| `src/cart.ts:10` | `needs-judgment` | Delete, ambiguous: it names an order but no cause |
| `src/cart.ts:12` | `needs-judgment` | Keep: a vendor constraint |
| `src/cart.ts:15` | `suppression`, rule `@typescript-eslint/no-explicit-any` | Leave in place |
| `scripts/build.sh:1` | `needs-judgment` | Delete: a TODO note |

The classifier joins lines 4 and 5 into one record, because they are adjacent whole-line
comments. That record removes two lines but counts as one deletion. After the edits,
`src/cart.ts` reads:

```ts
// Copyright 2026 Example Co. Licensed under MIT.
/** Returns the cart total in cents. */
export function total(items: Item[]): number {
  let sum = 0;
  // item.price is in cents already, because toItem multiplies the API value by 100.
  for (const item of items) sum += item.price;
  sum = applyCoupon(sum);
  // The payment provider rejects amounts above 99999999 cents.
  return Math.min(sum, 99999999);
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const debug: any = {};
```

The report:

```markdown
## Comment sweep

Scope: added lines since `origin/main` at `3f9c2a1`

### Files touched

| File | Deleted |
| --- | --- |
| `src/cart.ts` | 4 |
| `scripts/build.sh` | 1 |

### Kept

| Location | Reason |
| --- | --- |
| `src/cart.ts:1` | license header |
| `src/cart.ts:2` | doc comment |
| `src/cart.ts:7` | toItem stores the price in cents |
| `src/cart.ts:12` | the payment provider caps the amount |

### Reshape flags

| Location | Symbol | Proposal |
| --- | --- | --- |
| `src/cart.ts:7` | `Item.price` | Rename the field to `priceInCents` |

### Suppressions

| Location | Rule |
| --- | --- |
| `src/cart.ts:15` | `@typescript-eslint/no-explicit-any` |

### Removed notes

| Location | Text |
| --- | --- |
| `scripts/build.sh:1` | `# TODO: cache this step` |

### Ambiguous deletions

| Location | Text |
| --- | --- |
| `src/cart.ts:10` | `// applyCoupon must run before the cap.` |

Deleted 5 comments in 2 files. The changes are unstaged.
```
