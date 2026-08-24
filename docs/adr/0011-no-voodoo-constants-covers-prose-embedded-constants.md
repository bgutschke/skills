# "No voodoo constants" covers a skill's own prose, not just bundled scripts

`docs/skill-writing-best-practices.md`'s "no voodoo constants" rule was worded to apply
only to "every configuration value or threshold in a bundled script." `to-pr`'s
inferred-title-convention sample cap — `-L 20` on a `gh pr list` call, embedded directly in
the skill's own prose rather than in a bundled script — had no inline justification, unlike
its neighboring 5-sample-floor and 80%-agreement-floor thresholds, both justified inline in
the same section. Read literally, the old wording didn't reach this case at all: `to-pr`
has no bundled script, so the rule had nothing to say about a numeric constant sitting
directly in its instructions.

The underlying reasoning the rule exists for — an author picked a threshold without a real
justification, and Claude has no better way to determine the right value at runtime than
the author did — doesn't depend on whether that threshold lives in a script file or in a
skill's own prose. We reworded the rule to drop the "in a bundled script" qualifier,
restating it as covering any configuration value or threshold a skill relies on, wherever
it physically lives.

**Considered and rejected:** treating `to-pr`'s cap as a one-off exception, fixing its
value and justification without touching the rule's stated scope. Rejected because the
same gap would recur in any future skill that embeds an unjustified numeric threshold
directly in prose rather than in a script — a scripts-only rule would leave `audit-skills`
unable to catch it, which is the same "gap only a `/grilling` session finds" problem this
whole fix bundle exists to close.

## Consequences

- `audit-skills`' compliance bar now checks prose-embedded numeric thresholds for a
  justification, not just constants inside bundled script files — a skill with no bundled
  script is no longer exempt from this rule by construction.
- A future skill author embedding a threshold directly in prose must justify it inline the
  same way a bundled script's constant would need a comment — there's no longer a
  location-based escape hatch.
