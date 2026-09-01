# curate-memory annotates unverifiable memories, never drops them

A memory can go stale without any session ever contradicting it: it names a file, a
command, or a flag, and the repo moved on without comment. No transcript reflects that, so
mining history alone can't catch it. A *Curation pass* therefore checks any retained memory
that names something concrete against the working tree.

What the pass does with a failed check is the decision here. A failed check annotates the
entry in the report and leaves the memory in the *Candidate store*. It never drops it.

The reason is that a search which finds nothing is not proof of absence. The name may have
moved, may be constructed at runtime, may live in a sibling repo, may be spelled
differently in the file than in the memory, or may simply be missed by whatever the search
happened to run — this repo's own memory store already records that lesson twice, from two
separate incidents in which a filtered negative result was believed. Dropping on that
evidence trades a memory that is *possibly* stale for one that is certainly gone, and the
only party who can tell the difference — the user — never gets asked.

This is deliberately stronger than the upstream feature the technique is drawn from, which
has no working tree to check against and can only reason from transcripts. It is
deliberately weaker than deletion, and being weaker is the point: the pass is allowed to be
wrong about verification at no cost, because being wrong produces a note rather than an
absence.

**Considered and rejected:**

- **Dropping a memory whose named file, command, or flag can't be found.** Rejected on the
  above, and because the two errors aren't symmetric: a wrongly-kept memory is one line of
  noise the user deletes on sight, while a wrongly-dropped one is gone without the user ever
  learning it existed.
- **Dropping only where the check is unambiguous** — an exact path that resolves to
  nothing, say, rather than a bare identifier. Rejected because it reintroduces the same
  failure across a smaller surface under a harder-to-audit rule, and because an exact path is
  exactly the case where a file may have been renamed with the fact about it still true.
- **Keeping unverifiable entries silently, with no annotation.** Rejected in the other
  direction: the check is cheap and its result is among the most actionable things a pass
  can hand back, since the user usually knows at a glance whether the thing moved or
  vanished.
- **Recording the annotation in the memory's own frontmatter or body.** Rejected — the
  frontmatter is a fixed contract, and `ADR 0020` requires the candidate store to stay
  adoptable by a plain move, so a verification note written into the store would become
  permanent content that the next pass then has to reason about. It belongs in the report,
  which is read once.

## Consequences

- A candidate store can contain memories the pass believes are stale. That is intended: the
  report is where the pass makes its claim, and the store is where the user acts on it.
- The report has to name what the check looked for and failed to find, not merely that a
  check failed — otherwise the user can't do the one thing this decision exists to let them
  do, which is overrule it in a second.
- If a later version gains a verification signal that genuinely is proof of absence, this is
  the ADR to reopen. Nothing here rests on verification being hard; it rests on search
  results not being proof.
