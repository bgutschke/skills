# curate-memory scopes transcripts by worktree-state records, not by git worktree list

A session run inside a worktree writes its transcripts under that worktree's own project
directory, keyed by the worktree's path rather than the parent repo's. A *Curation pass*
that reads only the current project's transcripts is therefore blind to every session that
happened on a branch — which, for anyone who works mostly in worktrees, is most of the
history worth mining.

The obvious source for "which worktrees does this repo have" is `git worktree list`. It is
insufficient, and not marginally so: it reports only the worktrees that exist right now. A
worktree deleted after its branch merged drops out of that list while its transcripts stay
on disk. In the repo this was designed against, `git worktree list` reported one worktree;
five more had existed and were gone, and seventeen sessions carried records pointing at
them. Scoping by the live list would have discarded the majority of the branch history —
and discarded it silently, since a deleted worktree leaves nothing behind for the list to
be visibly wrong about.

The transcript pool is therefore the union of three sources, all keyed on absolute paths:

1. **Live worktrees**, from `git worktree list` — still the cheapest and most direct
   source for what exists now.
2. **Worktrees this project created**, from the `worktree-state` records the harness writes
   into the *parent* project's transcripts. Each carries `originalCwd` and `worktreePath`,
   so a worktree that has since been deleted is still recoverable from the session that
   created it.
3. **Worktrees with no creation record**, found by scanning sibling project directories for
   a `worktree-state` record whose `originalCwd` is this repo's toplevel — covering
   worktrees created before such a record was written, or created by a tool that spawned
   them outside a session.

All three resolve forward: collect real absolute paths, encode each to its project
directory name, then test whether that directory exists. Nothing ever parses a project
directory name back into a path. The encoding maps both `/` and `.` to `-`, so decoding is
ambiguous, and a wrong decode would quietly attach one project's transcripts to another
project's pass — a failure that produces plausible output rather than an error.

The same walk also finds worktree memory *stores*, which is why their handling is recorded
here rather than separately: they are located, but never merged into the candidate store. In the corpus measured, all fourteen worktree project directories held zero
memories, and a memory written inside a throwaway worktree may have been about that branch
alone. A non-empty one is reported as an orphan for the user to decide on.

**Considered and rejected:**

- **`git worktree list` alone.** Rejected on the measurement above: it under-reported by
  five of six, and the sessions it missed were the branch work.
- **Scanning every project directory the harness knows about and keeping any whose sessions
  mention this repo.** Rejected — it makes the pool depend on the contents of unrelated
  projects' transcripts, and its failure mode is mixing corpora, which is the one thing a
  per-project pass must not do.
- **Reconstructing worktree paths by decoding project directory names.** Rejected as
  unsound rather than merely fragile: the encoding is not injective, so some names have
  more than one valid decode and nothing in the name says which was meant.
- **Caching discovered worktrees in persistent state** so a later pass needn't rediscover
  them. Rejected — discovery is cheap, and any cached list is wrong the moment a worktree is
  created or deleted outside a pass.
- **Merging worktree memory stores into the candidate store automatically.** Rejected: a
  memory written on a branch is as likely to be a note about that branch's task as a
  durable fact, and promoting it is a judgment the user should make once, not one the pass
  should make silently for every worktree it finds.

## Consequences

- The pool grows with worktree usage, so a heavy worktree user's pass reads more history
  than a single-checkout user's. That expansion is absorbed by the token budget rather than
  by trimming sources — see `ADR 0022`.
- Any worktree tool is supported for free, whichever layout it produces — nested, sibling,
  or flat: nothing depends on where worktrees live on disk, only on absolute paths recorded
  at the time the session ran.
- If the harness stops writing `worktree-state` records, or changes their field names,
  sources 2 and 3 both go quiet — and they go quiet the same way `git worktree list`
  already does, by returning less rather than by failing. A change to that record's shape
  breaks this decision and should be treated as such, not as an implementation detail.
