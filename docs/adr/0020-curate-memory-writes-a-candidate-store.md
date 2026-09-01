# curate-memory writes a candidate store, departing from the rules auditor's read-broad/write-narrow posture

`ADR 0003` set the posture for `audit-rules`: read every rule file that could affect a
session, but only ever *propose* edits, and only against files the user personally owns.
`curate-memory` writes. A *Curation pass* produces a *Candidate store* — a complete memory
store on disk, beside the input — rather than a list of proposed edits for the user to
apply by hand.

The distinction is ownership, not a difference in appetite for risk. `audit-rules` reads
rule files that are shared with teams and, at the managed-policy scope, set by someone
other than the user; proposing is the strongest move available there because no single
contributor should unilaterally rewrite a shared file. A memory store has exactly one
owner — the user running the pass — and nobody else reads it or is bound by it. There is
no third party for a write to surprise.

The write is further shaped so that it isn't a mutation of anything that already existed.
Everything the pass produces is additive and lands in a new directory; the input store is
never opened for writing under any flag. Adoption is a move the user types, and rejection
is a single delete of one directory that leaves the machine exactly as it was. The cost of
a bad pass is therefore the time spent reading it.

A whole store rather than a change list, because the thing under review is wording. A
merge of two memories has to be read as the sentence it will become; a summary line saying
two memories were merged asserts the outcome without showing it. Writing the store out
makes reviewing the pass the same act as reading a store.

**Considered and rejected:**

- **Proposing edits and applying them in place once approved**, matching `ADR 0003`
  exactly. Rejected because approval would then be per-edit against a store the user can't
  see whole until the edits have landed — the opposite of the property that makes a
  candidate store reviewable — and because in-place application makes a bad pass expensive
  to undo, where this shape costs one delete.
- **Emitting a patch or a structured change list instead of a store.** Rejected: a patch
  is reviewable as a change but not as a result, and the results here are sentences the
  user has to live with in every future session.
- **Writing candidates into the input store's own directory**, as siblings of the real
  memories. Rejected — it puts unadopted content where the harness looks for memories, so
  a pass could change what later sessions load before the user has approved anything.
- **Adopting automatically when the pass finds no contradictions.** Rejected: "no
  contradiction found" is a statement about what the pass looked at, not about whether the
  merged wording is right, and the wording is precisely the part only the user can judge.

## Consequences

- `ADR 0003` remains the default posture for any skill whose subject is a *shared*
  artifact; this is not a general relaxation of it. The test for a future skill is who owns
  the target, not whether writing would be more convenient.
- The pass can never be the thing that adopts. A flag that moved the candidate store into
  place would collapse both properties this decision rests on — a separate location, and
  reversibility by a single delete — so adding one means reopening this ADR rather than
  adding an option.
- Because the output is a real store, it has to be internally consistent on its own: its
  index is regenerated to match its own contents, or adoption by a plain move would install
  a store whose index points at files that aren't there.
