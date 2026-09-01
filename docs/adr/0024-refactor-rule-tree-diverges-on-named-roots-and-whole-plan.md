# refactor-rule-tree diverges from the rules auditor on named roots and whole-plan review

`ADR 0003` set `audit-rules`' posture: read every rule file that could affect a session,
but propose edits only against files the user personally owns, never against a
project-shared file, because a project file is team-owned and a single contributor's
tool making unreviewed proposals against it exceeds what one person should decide alone.
`refactor-rule-tree` diverges from that posture in two places. Both are deliberate; read
side by side with `ADR 0003` and without this note, both could look like a reversal of
it. Neither is.

**Divergence one: an explicitly named project rule file is an edit target.** The pass
never discovers a project file by walking outward from something else and then proposing
changes against it — the only project file it ever edits is the one the user names
directly as the tree's root, and every edit it produces lands through the repo's own
pull-request review before it takes effect. `ADR 0003`'s rejected alternative was letting
a tool propose *unreviewed* changes against a project file it read incidentally while
auditing something unrelated to that file. It never considered a user handing a specific
project file to a tool by name and then reviewing the result the way any other change to
that file is reviewed. An explicitly named path landing through PR review is a case that
decision did not reach, not a case it decided and this skill overturns.

**Divergence two: one whole plan, not per-finding edits.** `audit-rules` proposes one
`Edit` per finding, each gated by the harness's ordinary permission prompt, because an
audit finding lives entirely inside one file at a time — accepting or rejecting one edit
never leaves anything half-migrated. Restructuring does not have that property. A rule
that moves goes through a delete on its old file and an addition to its new one, and an
interrupted run between those two steps leaves the rule deleted from the file it used to
live in and not yet written to the file it was moving to — while the harness is still
reading the old file, missing that rule, as live instruction for the rest of the session.
A partial run of an audit degrades to "some findings not yet acted on"; a partial run of
a restructuring can silently drop a rule from the tree. Presenting the whole plan before
writing anything, taking unlimited amendment, and executing only on a single confirmation
is what keeps that failure mode unreachable.

**Considered and rejected:**

- **Requiring the same personal-file-only restriction `ADR 0003` uses, with no named-root
  exception.** Rejected: it would make the skill useless for the exact project rule trees
  the specifying pass measured (a 37-file project tree, against a 4-file personal one),
  for a risk `ADR 0003` was never actually weighing — that decision addressed proposals
  made without the user pointing at the file at all.
- **Applying edits per rule as they're decided, matching `audit-rules`' per-finding
  shape.** Rejected for the reason in divergence two: an audit finding is self-contained
  inside one file, a rule move is not, and applying moves one at a time reintroduces the
  half-migrated state the whole-plan design exists to prevent.

## Consequences

- CONTEXT.md's *Project rule file* entry now names the rules auditor specifically in its
  "never an edit target" instruction, so it reads as that skill's own boundary rather than
  a repo-wide prohibition once `refactor-rule-tree` may edit one on request.
- A future skill that wants to propose changes against a project-shared file should check
  whether it fits divergence one's shape — a target the user names explicitly, reviewed
  through the repo's normal PR process — before treating `ADR 0003` as a blanket rule
  against ever doing so. `ADR 0003` remains the default for any skill that discovers a
  shared file on its own rather than being pointed at it.
- The plan invariant — every rule from the source files appears exactly once, with a
  verdict, re-checked on every amendment — exists because of divergence two. It is the
  mechanical guard against the exact failure mode a partial run would otherwise cause, so
  removing it means reopening this decision, not tightening an implementation detail.
