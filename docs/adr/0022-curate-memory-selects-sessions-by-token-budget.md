# curate-memory selects sessions by a prose-token budget, not by a session count

A *Curation pass* has to decide how much history to read, and the unit that decision is
expressed in determines what a pass costs.

A session count doesn't bound cost. Sessions differ by orders of magnitude in size, so
"the newest 20 sessions" is a cheap pass in a quiet project and an expensive one in a
chatty project — and it means something different in the same project six months later. A
token budget bounds the thing actually being spent, so a pass costs roughly the same
everywhere, and the number the user tunes is the number they are billed in.

Selection is newest-first to a default of 150,000 prose tokens, with a hard cap of 100
sessions and a floor that skips sessions below roughly 500 prose tokens. Each of the three
has a measurement or a source behind it, taken over a 112-session store at design time:

- **150,000 tokens** — the 20 newest sessions came to 134k prose tokens and the 30 newest
  to 177k, so this covers roughly a month of active work.
- **100 sessions** — mirrors the documented per-run session limit of the upstream feature
  this technique is drawn from. It's a secondary guard for the case where sessions are
  individually tiny and the budget alone would pull in a very long tail.
- **500 prose tokens** — 16 of the 112 sessions fell below this; each was an aborted
  session or a single question, carrying nothing a curation pass could act on.

The budget counts prose tokens rather than raw bytes because transcripts are dominated by
tool results, which are the bulk of the file and near-zero signal for curation. Budgeting
on raw size would spend most of the allowance on text that is filtered out before any
reader sees it.

The budget is raisable, and raising it adds readers rather than enlarging them, so a deeper
pass is a wider fan-out and not a redesign.

Nothing persists between passes to record what an earlier one already read. Re-reading is
idempotent — each pass writes a fresh candidate store rather than appending to an existing
one — and a watermark would actively harm the pass: a memory can be made stale by a repo
change long after the session that produced it, and a pass that only looked at what is new
since last time would never revisit it.

**Considered and rejected:**

- **A session count.** Rejected on cost predictability, above.
- **A wall-clock window, such as everything from the last 30 days.** Rejected for the same
  reason as a count — it bounds an axis that isn't the cost — with the added failure that a
  month of inactivity yields an empty pass while a month of heavy work yields an unbounded
  one.
- **Reading everything.** Rejected on cost, not on ignorance of the size — prose is
  accounted for deterministically before any mining starts, and the figure is printed, so
  the user always knows what a full read would come to. The corpus measured was 58 MB, and
  the return on it falls away with age: the oldest sessions are the least likely to say
  anything about what is currently true.
- **A watermark of the last-read session, to make repeat passes cheap.** Rejected as above:
  cheapness isn't the binding constraint, and skipping old sessions blinds the pass to
  entries made stale by something old.
- **Oldest-first, or a sample spread evenly across the whole history.** Rejected — when the
  budget truncates, what survives should be the most current guidance, since the most
  recent statement is the one that wins any contradiction.

## Consequences

- The default budget is a starting point measured against one store, not a universal. A
  project whose sessions run much longer or shorter than that corpus's will cover a
  different span of history at 150,000 tokens; the plan the pass prints before it runs is
  what tells the user which of those they have.
- Every threshold above is stated with its justification where it is used, per `ADR 0011`,
  so a later reader can tell a measured value from a guess and re-measuring doesn't require
  archaeology.
- Because no state persists, two passes run back to back do the same work and produce the
  same candidate store. That is the intended behavior, not an optimization left on the
  table.
