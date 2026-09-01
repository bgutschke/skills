---
name: curate-memory
disable-model-invocation: true
description: Runs one curation pass over the current project's memory store — reads the newest session transcripts, filters them to real user and assistant prose, and writes a complete candidate store beside the input plus one report listing every merge, drop, rewrite, and addition with its justification and a citation to the session that supports it. The input store is never opened for writing, and the pass adopts nothing: it prints the command to adopt the candidate store and the command to discard it. Use when the user types /curate-memory, or asks to curate, consolidate, clean up, de-duplicate, or prune their memory store or memory files.
---

# curate-memory

Perform one **curation pass** over the memory store belonging to the current project, and
write a **candidate store** beside it: duplicates merged, entries contradicted by a later
session replaced with the newest value, and guidance repeated in conversation but never
recorded surfaced as a new memory.

Two properties hold on every run, and everything below is arranged to keep them:

- **The input store is never opened for writing.** It is hashed before the pass and
  re-hashed after, and the pass reports the comparison.
- **The pass adopts nothing.** It writes to a new directory and prints the command to
  adopt it and the command to discard it. Which of those to run is the user's call.

## When to use

- The user types `/curate-memory`.
- The user asks to curate, consolidate, clean up, de-duplicate, or prune their memory
  store, memory files, or `MEMORY.md`.

## When not to use

- Writing or updating a single memory in the ordinary course of a session. That is the
  harness's own memory behaviour; this skill is the periodic sweep over the whole store.
- Auditing `CLAUDE.md`, `rules/*.md`, or installed skill and agent descriptions. Those are
  hand-authored and shared with other people; a memory store is model-written and belongs
  to one user, which is the reason this pass may write at all. Route that to `audit-rules`.
- Auditing `settings.json`, hooks, or permissions — structured configuration, not prose.
- Curating a project other than the one the working directory sits in. A pass reads one
  store and one project's transcripts, so unrelated corpora are never mixed.

## What one pass reads

Sessions recorded against the current project directory, newest first, plus sessions
recorded against every worktree this repository has — that directory being the one the
working directory encodes to, so a pass reads one project's history and never mixes in
another's.

A git worktree is its own project directory: its sessions are recorded separately from the
parent checkout's. Left there, they would be invisible to a pass run from the main
checkout — and for anyone who works mostly in worktrees, that is most of the history worth
mining, including work on worktrees deleted after their branch merged. `git worktree list`
alone is not enough for this, since it reports only what exists right now and a deleted
worktree drops out of it while its transcripts stay on disk. The plan script therefore
unions three sources of worktree paths — live worktrees from `git worktree list`, worktrees
this project's own transcripts record creating, and worktrees with no creation record found
by matching a session's original working directory back to this repo's toplevel — and folds
each one's transcripts into the same pool, tagged with which of the three found it.

A worktree's own memory *store* is located but never merged into the candidate store — a
memory written on a branch may only ever have been about that branch's task. A non-empty
one is reported in the preflight as an orphan for the user to decide on, never folded into
step 4's output.

Transcript records are filtered by class before anything reads them. Kept: real user prose
and assistant prose. Dropped: tool results and tool calls, assistant reasoning, re-injected
skill bodies, slash-command invocations, local command output, system reminders, and
harness bookkeeping. A system reminder appended to a message that also carries real prose
is stripped from the text rather than discarding the whole message.

Assistant reasoning is dropped rather than kept as prose because it is the model talking to
itself — a memory must never cite it as evidence that the user said or decided anything.

## Step 1: Preflight

Run the plan script. It resolves the store, reads and classifies every transcript, selects
the sessions, and writes the selected prose to a digest file:

```bash
node ${CLAUDE_SKILL_DIR}/scripts/curation-plan-cli.js --memory-dir <memory directory>
```

Pass `--memory-dir` the memory directory this session's own context states. Omit the flag
only when no memory directory is stated; the script then derives one by encoding the
repository toplevel to its project directory name.

Read the transcripts through this script and never through shell commands. A user hook
that rewrites `grep` or `ls` can return an empty result for a directory holding a hundred
files, and a pass that reads nothing looks exactly like a pass with nothing to find.

Print the preflight to the user as prose: the resolved store and how many memories it
holds, how many worktrees were found and by which source (`worktrees` in the script's
output), how many sessions are in the pool, how many were selected, how many were skipped
as near-empty, and the prose-token total. If `orphanStores` is non-empty, name each one and
say plainly that it is not part of this pass and is not being merged. Then **continue
without asking**. Everything the pass writes is additive and lands in a new directory, so
there is nothing here to confirm.

Stop and report only if the script exits non-zero — it found no session history for this
project, which a pass cannot proceed without.

## Step 2: Mine the digest

Read the input store in full: every memory file and the index.

Then dispatch **one** miner — a subagent that reads the digest file at
`paths.sessionDigest` and returns candidates. Give it the input store's contents in its
prompt, since it needs to know what already exists to propose a relationship to it. Run it
on this session's model rather than a cheaper tier: "is this memory stale?" is a nuanced
call whose failure is silent.

Each **candidate** carries:

| Field | Meaning |
|---|---|
| `intent` | `new`, `merge`, `replace`, or `stale` |
| `target` | the existing memory it acts on; absent for `new` |
| `type` | `user`, `feedback`, `project`, or `reference` |
| `claim` | one line stating what the candidate asserts |
| `body` | the proposed memory text, written out in full |
| `evidence` | a session id plus a short verbatim quote from that session |

Ask for at most 15 candidates, ranked, de-duplicated within the batch. A bound is what
makes the volume reaching this conversation grow with the number of miners rather than with
the size of the history, which is what lets a later pass read more sessions without
redesign. 15 is set a little above the size of a store worth curating — the store this was
designed against held 9 memories — so one miner can propose a change to every entry and
still add a few, but cannot propose a wholesale rewrite that step 3 could not re-decide
entry by entry in one sitting.

## Step 3: Decide

Do this yourself; never delegate it. A miner sees one slice of history and cannot know what
a later session said, so its `intent` is a proposal — re-decide every relationship against
the whole store and every candidate:

- **merge** two memories only when they state the same lesson. Write the merged sentence
  out; that wording is the thing the user is being asked to approve.
- **replace** when a later session contradicts an existing memory. The newest statement
  wins.
- **drop** only on evidence that the memory is wrong or has been superseded — never on a
  search that failed to find something a memory names. A search that finds nothing is not
  proof of absence, and a wrongly-dropped memory is gone without the user learning it
  existed.
- **split** a file that has accumulated several facts into one file per fact.
- **add** a memory for guidance a session gave that the store never recorded.

Every decision needs a justification and a citation, so discard any candidate whose
evidence you cannot point at in the digest.

## Step 4: Write the candidate store

Write a complete store at `paths.candidateStore` — every memory that survives, not only the
ones that changed. It has to stand on its own, because adopting it is a plain move.

Each memory is one file holding one fact, carrying the frontmatter contract the harness
reads:

```markdown
---
name: <short-kebab-case-slug>
description: <one-line summary, used to decide relevance during recall>
metadata:
  type: user | feedback | project | reference
---

<the fact; for feedback and project, follow with **Why:** and **How to apply:** lines>
```

Match the input store's actual shape wherever it differs from this — the store on disk is
the authority on its own contract.

Write no provenance, no verification note, and no pass metadata into any memory. The
frontmatter is a fixed contract, and anything added here becomes permanent content the next
pass has to reason about. All of it belongs in the report.

Then regenerate the index wholesale from the candidate memories you just wrote — one line
per memory, derived from that memory's own frontmatter:

```markdown
- [Title](file.md) — hook
```

Never copy the input index forward and patch it. The index is derived data, and patching is
how it drifts from the files it points at.

## Step 5: Write the report

One report at `paths.report`, opening with the preflight figures from step 1, then one
entry per decision — including the ones taken against a miner's proposal, since a rejected
candidate is a decision the user may want to overturn:

```markdown
### merge: retry-budget + retries-are-capped

**Result:** one memory, `retry-budget`.
**Justification:** both state the same lesson — the retry cap is per request, not per
call. Keeping two costs context every session and asserts the same thing twice.
**Citation:** session 7f2a9c14 — "the cap is per request; three calls inside one request
still share three retries"
```

Every entry states its intent, what the store now holds, why, and the session that supports
it. An entry with no citation does not belong in the report, and the change it describes
does not belong in the candidate store.

## Step 6: Verify and hand off

Re-hash the input store and confirm the pass changed nothing, passing the digest the
preflight printed:

```bash
node ${CLAUDE_SKILL_DIR}/scripts/curation-plan-cli.js --memory-dir <memory directory> --verify-store <digest>
```

A non-zero exit means the input store changed during the pass. Say so plainly and name the
candidate store as unsafe to adopt; do not print the adopt command.

Otherwise close by printing both commands, and adopt nothing yourself:

```bash
# adopt — keeps the previous store alongside, so the move is reversible
mv <store> <store>-superseded && mv <candidateStore> <store>

# discard
rm -rf <candidateStore> <report> <sessionDigest>
```

## Worked example

A pass over a fabricated store belonging to `/home/dev/work/checkout-api`, whose project
directory holds 35 transcripts and whose store holds four memories. A branch was worked in
a worktree at `/home/dev/work/checkout-api/.claude/worktrees/retry-budget-fix` and later
deleted; its 6 transcripts survive under its own project directory, recovered from a
`worktree-state` record in the parent's transcripts. Two memories — `retry-budget.md` and
`retries-are-capped.md` — state the same lesson in different words, and a later session
revised a figure that a third one records.

The preflight, printed before any mining:

```text
Store: ~/.claude/projects/-home-dev-work-checkout-api/memory (4 memories)
Worktrees: 1 found (worktree-state-parent) — no orphan stores
Pool:  41 sessions (35 current project, 6 worktree) — 8 selected, 6 skipped as near-empty,
       27 beyond the session limit
Prose: 47,300 tokens across 214 messages
Filtered out: 3,180 tool results, 2,460 tool calls, 1,905 reasoning blocks,
              6,120 system reminders, 240 skill bodies, 190 slash commands
```

The corpus is 34 MB on disk; the 47,300 prose tokens are what survives classification.
Budgeting on raw size would have spent the whole allowance on tool results.

One miner returned nine candidates. Three survived step 3:

- **merge** `retry-budget.md` and `retries-are-capped.md`. Both say retries are capped per
  request rather than per call. The candidate store holds one file, `retry-budget.md`,
  and the merged sentence is written out in it for the user to read.
- **replace** the body of `deploy-window.md`. It records a 30-minute window; session
  `c41f0ba2` says "we moved the deploy window to 15 minutes after the incident". The newest
  statement wins.
- **add** `no-force-push-shared.md`. Three separate sessions carry the same correction and
  the store never recorded it.

A fourth candidate was rejected: the miner proposed dropping `runbook-location.md` because
it names a path it could not find. Nothing in the digest says that file moved or was
deleted — only that a search missed it — so the memory stays in the candidate store, and
the report records the rejection and the reason.

The input store re-hashed to the digest the preflight printed. The pass closed by printing
the adopt and discard commands, and ran neither.
