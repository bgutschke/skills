# Externally-reconciled skill-authorship guidance lives in its own doc, not `CODING_STANDARDS.md`

`CODING_STANDARDS.md` set this repo's skill-authorship bar entirely in-house, with no
external source ever validating it against how Anthropic itself, or other maintained skill
collections, actually recommend writing skills. Building `skill-writing-standards` (#35) to
close that gap raised a second question beyond the issue's own acceptance criteria, which
only asked for a link to *somewhere* the findings could live: whether that somewhere should
be `CODING_STANDARDS.md` itself, extended in place, or a new dedicated doc.

We chose a new dedicated doc, `docs/skill-writing-best-practices.md`, and migrated three
pieces of existing content into it: the whole "Required SKILL.md structure" section, the
description-specificity bullet from "Style and content rules", and the "Relation to
`writing-for-agents`" scoping note. `CODING_STANDARDS.md` keeps everything nothing external
could ever inform — Self-containment, house style (no emojis/no hype), the pre-merge
checklist, and the non-skill-code notes — and its pre-merge checklist now links to the new
doc.

The reasoning is genre, not size. `CODING_STANDARDS.md` is terse and prescriptive —
"Every skill must...", "No emojis..." — sentences that state a rule and stop. A doc built
by reconciling external research is naturally descriptive: it cites sources, weighs
competing framings across those sources, and explains why a claim was adopted or rejected.
Mixing those two registers in one file degrades both — the prescriptive rules stop reading
as settled once they're interleaved with cited, occasionally-hedged research prose, and the
research prose gets flattened into false-terse rules if it's forced to match the
surrounding style. The three migrated sections are exactly the parts of
`CODING_STANDARDS.md` that were already externally-reconcilable in nature (structure,
description design, scope-boundary framing) even before an external-reconciliation
mechanism existed to act on them — moving them is completing a categorization the original
document already implied, not inventing a new one.

This is a larger change than #35's acceptance criteria strictly required — the issue only
asked for a link, not a migration — worth recording here precisely because a future reader
diffing `CODING_STANDARDS.md` against an older version will see content vanish outright
and may wonder whether it was lost by accident rather than relocated on purpose.

## Consequences

- Anyone updating "Required SKILL.md structure"-type guidance by hand, without running
  `skill-writing-standards`, now edits `docs/skill-writing-best-practices.md` directly —
  there's no `Edit` restriction on that file outside the skill's own run, only a norm that
  the skill is what keeps it current against external sources.
- `docs/skill-writing-best-practices.md`'s topic subsections (not one section per external
  source) are organized for the doc's actual reader — someone about to write a skill who
  wants to look up "what's our stance on X" — not for the convenience of the occasional
  reconciliation run. A future change to that organization should preserve this, not
  optimize for how `skill-writing-standards` happens to gather its findings.
- If `CODING_STANDARDS.md` and `docs/skill-writing-best-practices.md` ever appear to
  disagree, `docs/skill-writing-best-practices.md` is authoritative for anything in its own
  scope (structure, naming, description design, and the other topics it owns) —
  `CODING_STANDARDS.md`'s remaining content was deliberately chosen as content no dispute
  with an external source could ever touch, so a real conflict there would indicate the
  split was drawn in the wrong place, not that `CODING_STANDARDS.md` should win by default.
