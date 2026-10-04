---
name: blast-radius
argument-hint: "[<pull request number or URL> | <from>..<to> | <from>...<to>]"
description: "Finds what a change can break outside its own diff. Names the one fact the change is safe because of, rates each risk on a five-step evidence ladder, and tests that fact with a throwaway script that runs the real code. Reads a pull request by number or URL, or a ref range such as main..feature. With no argument, reads the current branch against the repository's default branch, working tree included. Use when the user types /blast-radius."
disable-model-invocation: true
---

# blast-radius

Find what a change can break outside its own diff. A caller list from a search misses
most of it. The real breakage sits where a search stops: inside a library the code calls,
in a data shape, behind a flag, a few hops downstream, or in the order things run.

The skill names the one fact the change is safe because of. It looks where a search
stops, and it rates every risk on a five-step evidence ladder. Then it tests the fact with
a script that runs the real code. The result is a fixed writeup.

The analysis runs in this conversation, because you can need an answer from the user
about intent in the middle of a run. Only the raw reading of the diff and the history
goes to a subagent.

The evidence ladder, the single safety fact, and the rule to prove by running code come
from the pstack plugin for Cursor, MIT licensed. `references/evidence-ladder.md` holds the
full credit.

## When to use

- The user types `/blast-radius`.

## When not to use

- The user asks for a general code review, or for bugs inside the diff. Point the user to
  `/code-review` and, for vulnerabilities, to `/security-review`, and stop. This skill
  looks outside the diff only.
- The user asks why the code is shaped the way it is. Point the user to the `why` skill
  and stop.
- The current directory is not a git repository. Say so and stop.
- The change is empty: the anchor lists no path. Say so and stop.

## Dependencies

Requires `node` to run the bundled anchor script.

Requires an authenticated `gh` CLI for the pull request path only: a pull request given
as the argument, and the body and the reviews of the branch's own pull request. A ref
range never needs `gh`. Without `gh`, a pull request argument stops with an error that
asks for `gh auth login` or for the ref range of the pull request. No other change can
stand in for the pull request.

## Argument grammar

The argument for this run is: `$ARGUMENTS`

The argument is optional and takes one of three forms:

- **A pull request number or URL**, for example `42`, `#42`, or
  `https://github.com/acme/shop/pull/42`. The skill reads that pull request's diff, its
  commits, its body, and its reviews. A URL that points at a tab or a comment of the pull
  request still reads the whole pull request. A pull request from a fork can need
  commits that the clone lacks. If so, the script fetches them from `origin` by name. The
  fetch writes no branch and changes no file.
- **A ref range**, for example `main..feature` or `v1.4.0...HEAD`. Two dots read the
  commits from the first ref to the second. Three dots read them from the merge base of
  both refs. An empty side means `HEAD`, as in `main..`.
- **Nothing.** The skill reads the current branch against the repository's default
  branch, from the merge base to the working tree, untracked files included.

Pass the argument to the anchor script as one shell argument. When the argument matches
none of the three forms, the script exits with an error that names it. Relay that error
to the user and stop. Do not guess a form.

## Step 1: Build the code anchor

Build the anchor inside a subagent, because raw `git diff` and `git log` output has no
size limit. The script reads the change that the argument names.

Call the **Agent** tool with:

- `subagent_type: "general-purpose"`
- `model: "haiku"`. The subagent runs one script and returns its output.
- `description: "Build blast-radius code anchor"`
- `prompt`: the brief below.

```text
Run, in the current git repository:
node "${CLAUDE_SKILL_DIR}/scripts/gather-change-anchor-cli.js" '<argument>'

Return exactly this, and nothing else:
ANCHOR: <the script's stdout, verbatim>

If the script exits non-zero, return "ERROR: " and its stderr.
Do not read the diff. Do not explain the change. Do not judge whether it is safe.
```

In the brief, replace `'<argument>'` with the argument in single quotes. With no
argument, drop `'<argument>'` from the command.

When the reply starts with `ERROR: `, relay it to the user and stop. Otherwise parse the
`ANCHOR:` line as JSON: `{ target, anchor, base, head, ghAuthenticated }`.

- `target`: the parsed argument. `kind` is `branch`, `pullRequest` with the
  `pullRequest` number or URL, or `range` with `from`, `to`, and `mergeBase`.
  `mergeBase` is true for three dots.
- `anchor.paths`: every file the change touches. A rename lists both names.
- `anchor.symbols`: the declared symbols the diff `added`, `changed`, and `deleted`. A
  changed symbol is one whose declaration line or body the diff edits.
- `anchor.commits`: the commits from the merge base to `HEAD`, newest first.
- `anchor.pullRequests`: the pull request numbers in the commit subjects, and the number
  of the branch's own pull request.
- `anchor.tickets`: the ticket identifiers in the commit subjects and bodies, the pull
  request body, and its reviews.
- `base`: the `ref` the change starts from and the `commit` the diff starts from. For the
  branch and a pull request, the commit is the merge base.
- `head`: the `ref` and the `commit` the change ends at. Null means that the change ends
  in the working tree.
- `ghAuthenticated`: false means that the anchor holds no pull request text. Null means
  that the script did not check, because a ref range needs no `gh`.

The symbol lists come from a declaration pattern and indentation, not from a parser.
Treat them as the starting list to search from, not as the full set of what changed.

### The copied anchor builder

`scripts/build-code-anchor.js` and its test file are copies of the anchor builder that
the `why` skill ships. A skill must not load a file from another skill's bundle, because
the other skill can be absent where this one runs. The copy stays identical to the
original. `scripts/build-change-anchor.js` wraps it and adds what a change needs: the
paths and symbols read from the diff. `scripts/parse-change-target.js` parses the
argument. The CLI loads all three. Run only the CLI, and do not read the modules.

## Step 2: Read the change

Read the diff one file at a time, in the order of `anchor.paths`. When `head` is null,
compare the base with the working tree:

```bash
git diff <base.commit> -- <path>
```

Read an untracked file directly. It is new in full.

When `head` is not null, compare the base with the head commit. Read a file at the head
commit with `git show <head.commit>:<path>`, not from the working tree:

```bash
git diff <base.commit> <head.commit> -- <path>
```

Write down what the change does in plain words. Then write down what it does that the
diff does not spell out. Look for these:

- A default that moves: a new parameter default, a removed fallback, a changed constant.
- A call that now runs earlier, later, more often, or not at all.
- A value whose type, shape, unit, or encoding changes on its way out of the function.
- A library call that is new, or now gets different arguments.
- A deleted symbol from `anchor.symbols.deleted` that can still have a caller.

If the pull request body or a commit body states the intent, compare it with what the
diff does. A gap between the two is a risk. If the intent is unclear, and the answer
changes the safety fact, ask the user one question with **AskUserQuestion**. Do not
guess the intent.

## Step 3: Name the safety fact

The safety fact is the one fact the change is safe because of. When it is true, most of
the risks are cleared at once. Name exactly one.

Write it as one sentence that a script can test. Name the exact function, value, or
library call, and the condition that must hold. For example: `parseLimit` from `qs-lite`
1.4.2 returns a number, not a string, for `?limit=50`. A vague sentence is not a safety
fact, for example "the change keeps the behavior the same". It names nothing to test.

When two facts compete, pick the one that clears more risks. Record the other as a risk.

## Step 4: Look where a search stops

Start with the callers. Search for every symbol in `anchor.symbols` with `git grep -n -w`.
A deleted or renamed symbol needs a search for its old name. Then look in the five places
a caller search misses:

1. **Library source, at the pinned version.** For each library call the change adds or
   alters, find the version in the lockfile. Read the library's own source for that
   function, not its documentation. If the installed copy has the lockfile version, read
   it, for example under `node_modules/<name>/`. Otherwise fetch the source
   of that exact version into a temporary directory outside the repository, for example
   with `npm pack <name>@<version>`. Then look for a local patch of that library:
   `patches/`, `.yarn/patches/`, `patchedDependencies` in `package.json`, or the
   ecosystem's own patch tool. A patch changes the source you read. Other ecosystems
   follow the same rule. For Python, use `pip download <name>==<version> --no-deps`. For
   Go, read the module cache at `go env GOMODCACHE`.
2. **Run order.** Follow the moment the changed code runs, not only what it calls: microtasks
   and promises, effects and their cleanup, unmount, teardown, event order, retries, and
   process exit.
3. **Data shapes.** Follow a changed value out of the language. It can leave as an API
   request or response, a database column, or a serialized cache entry. It can also leave
   as a queue message, a file format, a URL parameter, or an environment variable. Find
   the reader on the other side.
4. **Flags.** Find each feature flag, configuration key, or environment switch that
   gates the changed code. Check the code path for each state of the flag.
5. **Downstream hops.** Follow the consumer of a changed return value or side effect for
   at least two hops past the first caller. The first hop is the caller search itself,
   so the second hop is the first place a search does not reach.

Log every search as you go: the command or query, and what it found. A search that found
nothing is a result. It becomes the basis of a cleared risk in Step 5.

## Step 5: Rate each risk

Read `${CLAUDE_SKILL_DIR}/references/evidence-ladder.md` in full before you rate. Follow
its steps, its rules, and its evidence rules exactly.

For each risk, record:

- **How it breaks:** the failure, in one or two sentences.
- **Where:** the real file and line, or the path in the library source with its version.
- **Likelihood:** low, medium, or high, with the reason in a few words.
- **Cost:** what breaks for whom, and how badly.
- **How to check:** the cheapest command, test, or read that settles it.
- **Step:** the ladder step the risk reached.

The five labels, in order: stated, pointed at the line, walked the failure path, ran real
code, reproduced in the running application.

Rate the safety fact on the same ladder, before the proof. Only the proof script in
Step 6 can raise the safety fact to `ran real code`.

Keep a risk you checked and cleared apart from the risks that stand. A cleared risk needs
one of these as its basis:

- a line that rules it out
- a walked path that stops short of the break
- a command that ran, and its output
- a search that found nothing

## Step 6: Prove the safety fact

Write one small script that tests the safety fact, and run it. Its result decides whether
the fact is `proven` or `unproven`. Read `${CLAUDE_SKILL_DIR}/references/proof-script.md`
in full before you write the script. Follow its steps exactly: the checkout check, the
throwaway directory outside the repository, the snapshots before and after, the rules for
the script, and how to read its exit code.

Never call the fact proven without a run that exited 0.

## Step 7: Write it up

This template is strict. Always use this exact structure, in this order. Drop no
section. If a section is empty, write "None."

```text
## What it does
Read: <the target: the branch against base.ref, pull request <number>, or the range>

<what the change does, then what it does that the diff does not spell out>

## Safety fact
<the one fact, as one testable sentence>
Step: <ladder label>
Status: <proven or unproven>
Proof: <the absolute script path and its run command, or "none." and the reason>

<the script, in a fenced code block>

<its output with the exit line, in a fenced code block>

Tracked files: <unchanged, or changed and the paths that changed>

## Risks
### <short name of the risk>
- How it breaks: <the failure>
- Where: <path:line, or library source path at its version>
- Likelihood: <low, medium, or high>, <reason>
- Cost: <what breaks for whom>
- How to check: <the cheapest command, test, or read>
- Step: <ladder label>

## Cleared
- <the risk>: <the basis: a line, a walked path, "<command> -> <output>", or "<search> -> nothing">

## Before you merge
<the cheapest test or repro that catches the real bug. When a proof script ran, it is
that repro: name its path and its run command. Name a cheaper test only if one exists.>

Safety fact: <proven or unproven>. <the fact, in one line>
```

When no script ran, write "none." in place of the script and its output.

The last line is the reply contract. It names the status of the safety fact in one line,
so the user can read the result without the rest.

The writeup goes into the chat only. Never write it to a file. Never post it to the pull
request.

## Worked example

This fixture is synthetic. The repository, the library `qs-lite`, and the paths are
invented. The script and its output come from a real run in a scratch repository. That
repository installs the invented `qs-lite` 1.4.2 under `node_modules`, and the script loads
it from there. The paths in the output are shortened to `/work/shop` and
`/tmp/tmp.QOrjpUPzw4`.

The user types `/blast-radius` on a branch with one commit. The anchor lists
`src/listing.js` and the changed symbol `readLimit`. The diff:

```diff
-  const limit = Number(req.query.limit) || 20;
+  const limit = parseLimit(req.url.search, 20);
```

`parseLimit` comes from `qs-lite`, pinned at 1.4.2 in the lockfile. Its source,
`node_modules/qs-lite/index.js:4`, calls `Number.parseInt` and returns any number it
parses, zero included. The old `|| 20` turned zero into 20.

The proof script, `/tmp/tmp.QOrjpUPzw4/proof.mjs`:

```js
import { createRequire } from 'node:module';

const repo = process.cwd();
const require = createRequire(`${repo}/package.json`);
const path = require.resolve('qs-lite');
const { version } = require('qs-lite/package.json');
const { parseLimit } = require('qs-lite');
console.log(`qs-lite ${version} from ${path}`);

const actual = parseLimit('?limit=50', 20);
if (actual !== 50) {
  console.error(`FAIL: expected the number 50, got ${JSON.stringify(actual)} (${typeof actual})`);
  process.exit(1);
}
console.log(`OK: parseLimit('?limit=50', 20) returned ${actual} (${typeof actual})`);
```

The writeup, shortened:

````text
## What it does
Read: the branch against main

`readLimit` now parses the page size with `parseLimit` from `qs-lite`, in place of
`Number`. The diff does not spell out one shift: `?limit=0` now gives 0, not 20.

## Safety fact
`parseLimit` from `qs-lite` 1.4.2 returns a number, not a string, for `?limit=50`.
Step: ran real code
Status: proven
Proof: /tmp/tmp.QOrjpUPzw4/proof.mjs, run with `node /tmp/tmp.QOrjpUPzw4/proof.mjs`

<the script above>

```text
qs-lite 1.4.2 from /work/shop/node_modules/qs-lite/index.js
OK: parseLimit('?limit=50', 20) returned 50 (number)
exit: 0
```

Tracked files: unchanged

## Risks
### Zero page size returns an empty page
- How it breaks: `?limit=0` reaches `LIMIT $1` as 0, so the list comes back empty.
- Where: node_modules/qs-lite/index.js:4 at 1.4.2, then src/db/listings.js:14
- Likelihood: low, the web client never sends 0
- Cost: a client that sends 0 shows an empty list
- How to check: a unit test for `readLimit` with `?limit=0`
- Step: walked the failure path

## Cleared
- Other callers of `readLimit`: `git grep -n -w readLimit` -> src/routes/listings.js:9 only
- A flag that gates the route: `git grep -n -i flag src/routes` -> nothing

## Before you merge
Add a unit test that `readLimit` with `?limit=0` returns 20. Rerun the proof with
`node /tmp/tmp.QOrjpUPzw4/proof.mjs`.

Safety fact: proven. `parseLimit` from `qs-lite` 1.4.2 returns a number for `?limit=50`.
````
