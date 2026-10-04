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
range never needs `gh`. Without `gh`, a pull request argument falls back to the current
branch against the default branch, and the writeup says so.

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
`ANCHOR:` line as JSON: `{ target, anchor, base, head, ghAuthenticated, fallback }`.

- `target`: the parsed argument. `kind` is `branch`, `pullRequest` with the
  `pullRequest` number or URL, or `range` with `from`, `to`, and `mergeBase`.
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
- `fallback`: null, or the sentence that says which change the script read in place of
  the pull request. Copy it into the writeup.

The symbol lists come from a declaration pattern and indentation, not from a parser.
Treat them as the starting list to search from, not as the full set of what changed.

### The copied anchor builder

`scripts/build-code-anchor.js` and its test file are copies of the anchor builder that
the `why` skill ships. A skill must not load a file from another skill's bundle, because
the other skill can be absent where this one runs. The copy stays identical to the
original. `scripts/build-change-anchor.js` wraps it and adds what a change needs: the
paths and symbols read from the diff. When you fix the builder in one skill, fix it in
the other too.

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
diff does. A gap between the two is a finding. If the intent is unclear, and the answer
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
   at least two hops past the first caller.

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
a basis: a line that rules it out, a walked path that stops short of the break, or a
search that found nothing.

## Step 6: Prove the safety fact

Write one small script that tests the safety fact. Run it. Its result decides whether the
fact is `proven` or `unproven`.

The script runs the code in the working tree. When `head` is not null, compare
`head.commit` with `git rev-parse HEAD`. If they differ, or if `git status --porcelain`
prints a line, the working tree does not hold the change. Do not check out anything
yourself, because a checkout changes the user's files. Ask the user with
**AskUserQuestion** to check out `head.commit`, or to skip the proof. If the user skips
it, the fact is `unproven`, and the reason is "the change is not checked out".

### Make the throwaway directory

Create the directory outside the repository, from the repository root:

```bash
mktemp -d
```

The shell keeps no variable from one Bash call to the next. Start every later command in
this step with `PROOF_DIR=<the printed path>;`, the literal path.

Snapshot the files before anything runs:

```bash
PROOF_DIR=<the printed path>; { git status --porcelain=v1 --untracked-files=all; git diff HEAD --binary | git hash-object --stdin; git ls-files -z --others --exclude-standard | xargs -0 git hash-object --; } > "$PROOF_DIR/before"
```

The status lists every changed and untracked path. The first hash covers the content of
the uncommitted changes to tracked files. The last command hashes each untracked file,
because the change can include one. Ignored files are not covered. Never write the
script, its output, or a snapshot inside the repository.

### Write the script

The script must meet all of these:

- It loads the real code: the library at the version the application ships, and the
  exact function the safety fact names. Never a copy, a stub, or a reimplementation.
- It prints the version and the path of the library that it loaded, so that you can
  compare them with the lockfile.
- It calls that function with the input the safety fact names.
- It exits non-zero, with a message that names the expected and the actual value, when
  the fact does not hold. It exits zero only when the fact holds.
- It needs no network, no live service, and no secret.

The script lives outside the repository, so a bare import does not find the
repository's packages. Resolve them from the repository root. In Node, use
`createRequire` from `node:module` on the repository's `package.json`, and import a
repository file by its absolute path. In Python, run the script with the repository's
own interpreter or virtual environment. Use the language and runtime that the
application uses.

Write it into the throwaway directory, for example `<the printed path>/proof.mjs`.

### Run it

Run the script from the repository root, with a time limit, and keep the output. For a
Node script:

```bash
PROOF_DIR=<the printed path>; timeout 120 node "$PROOF_DIR/proof.mjs" > "$PROOF_DIR/output.txt" 2>&1; echo "exit: $?" >> "$PROOF_DIR/output.txt"
```

If `timeout` is missing, as on a stock macOS, drop `timeout 120` and give the Bash tool
a timeout instead.

Then read the output and decide:

- **Exit 0:** the fact holds. Compare the printed library version with the lockfile.
  If they differ, the script ran other code: the fact is `unproven`. If they match, set
  the safety fact to `Step: ran real code` and `Status: proven`.
- **Non-zero, and the message shows the fact is false:** the fact is `unproven` and
  keeps its step from Step 5. The run is also a finding. Add the risk "The safety fact
  does not hold" at `Step: ran real code`, with the script as its check.
- **Non-zero for another reason,** such as an import error, a wrong call, or a timeout:
  fix the script once. If the second run also fails for another reason, the fact is
  `unproven` and keeps its step. Raise no risk from a broken script.

If the script cannot be written with reasonable effort, or cannot run at all, the fact is
`unproven` and keeps its step. Reasonable effort ends when the fact needs a live service,
a network call, a secret, or a full running application to test. Say which in the
writeup.

Never call the fact proven without a run that exited 0.

### Check the tracked files

After the run, take the same snapshot into `$PROOF_DIR/after`, and compare the two:

```bash
PROOF_DIR=<the printed path>; { git status --porcelain=v1 --untracked-files=all; git diff HEAD --binary | git hash-object --stdin; git ls-files -z --others --exclude-standard | xargs -0 git hash-object --; } > "$PROOF_DIR/after"; diff "$PROOF_DIR/before" "$PROOF_DIR/after" && echo unchanged
```

No output other than `unchanged` means that nothing changed. Any other output lists the
lines that differ. In that case, show them to the user. Do not revert anything yourself.
The user decides. Report the result in the writeup either way.

Keep the directory after the run, so the user can rerun the script.

## Step 7: Write it up

Write the writeup in this structure, in this order. Drop no section. If a section is
empty, write "None."

```text
## What it does
Read: <the target: the branch against base.ref, pull request <number>, or the range>
<the fallback sentence, if fallback is not null>

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
- <the risk>: <the basis: a line, a walked path, or "<search> -> nothing">

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
