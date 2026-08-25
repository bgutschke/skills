# renovate-triage's PR comment shape lives in a skeleton file, not step 20's prose

`renovate-triage` now composes its one PR comment per triaged PR from a literal skeleton
file, `skills/productivity/renovate-triage/COMMENT-SKELETON.md`, referenced from
`SKILL.md` step 20 rather than described there in prose — the same reference-by-file
mechanism `pr-readiness` (a project-local skill in `bgutschke/raspberry-pi-ansible`) uses
for its own PR comment via a `REPORT-SKELETON.md` sibling file. The skeleton fixes a
tier line (`<TIER> — <reason>`, an upper-case text label) in place of the previous
`### Renovate Triage Verdict: <tier>` heading, a per-dependency table for 2+ grouped
dependencies (bullet prose kept for a single dependency), a new `## Security advisories`
section — structurally identical to the existing `## Opportunities`, present regardless
of verdict tier, and always sitting after the per-dependency breakdown and before the
Agent brief — and a fenced ` ```text ` body for the Agent brief. `scripts/validate-comment-body.js`
gained two matching checks: the tier line's label must match the computed verdict, and an
Agent brief heading must be followed by a ` ```text ` fence before the next heading.

Before this change, step 20 was the only place the comment's shape existed at all — a
paragraph of prose re-derived, in principle, from scratch on every run rather than copied
from a fixed artifact. That gap is what let a previous run's Agent brief go unfenced in
practice: nothing forced the shape to stay consistent from one comment to the next, and
nothing but eyeballing a rendered comment after the fact could catch a drift. Moving the
shape into its own file, and teaching the existing validator to check the two properties
that can be checked mechanically (a label, a fence), closes both the authoring gap and
the detection gap at once.

**Considered and rejected:**

- **Keeping the shape in `SKILL.md`'s prose, just written more carefully.** Rejected —
  more careful prose is still prose: nothing stops the next edit to step 20 from drifting
  away from what a previous run actually posted, since there's no single file a future
  edit can be diffed against. `pr-readiness`'s own report-skeleton precedent already
  established that a skeleton file, not tighter prose, is this tracker's answer to that
  problem.
- **A `### Renovate Triage Verdict: <tier>` heading, kept as-is, instead of a tier
  line.** Rejected because a heading forces a reader to scan a full sentence before
  reaching the reason; a short, upper-case tier label on its own line, with the reason
  clause immediately following it, answers "why" in the same line a bare heading doesn't.
- **An emoji-based tier indicator (`✅`/`⚠️`/`🛑`) instead of a text label.** The first
  design considered, since a symbol is recognizable without reading a word at all — but
  rejected because this repo's own `CODING_STANDARDS.md` prohibits emoji in skill prose
  or generated artifacts absent an explicit user request, and this skeleton composes
  exactly such an artifact (the PR comment it renders). An upper-case tier label
  (`SAFE`/`NEEDS-REVIEW`/`BLOCKED`) keeps the same one-line, at-a-glance scannability
  without the rule conflict.
- **A table for every PR's per-dependency breakdown, including a single-dependency PR.**
  Rejected because a one-row table carries all of a table's visual overhead (header row,
  column alignment) for none of its comparison benefit — bullet prose for one dependency
  reads at least as clearly and was already the shape in use.
- **An unfenced Agent brief, left as free-form prose the way it always had been.**
  Rejected because an unfenced Agent brief is exactly the bug that motivated this
  decision — prose blends into the surrounding markdown, with no visual or mechanical
  signal that this block is a distinct, copy-pasteable unit for an agent to act on.
- **Leaving the validator content-only (its existing four checks), treating the new tier
  line and fence as conventions enforced only by the skeleton file.** Rejected for these
  two properties specifically — a tier label either matches the verdict or it doesn't, a
  fence either wraps the content or it doesn't — because the cost of a mechanical check
  is small enough that leaving it to eyeballing, after the exact bug that motivated this
  ADR, would repeat the same mistake. Section order and the table-vs-prose choice stay
  unchecked; verifying those would need real markdown-structure parsing for a marginal
  payoff over what already reads clearly on the rendered comment page.
- **Merging Security advisories into the existing Opportunities section**, distinguished
  only by a label within it. Rejected in the grilling session that produced this spec
  (issue #73) — urgency and adoption-worthiness are different axes (`CONTEXT.md`'s
  `Security advisory` entry), and collapsing them into one section's subsections would
  make an urgent disclosure as easy to skim past as an optional capability note.

## Consequences

- A future change to the comment's shape edits `COMMENT-SKELETON.md` first, then updates
  `SKILL.md` step 20's pointer prose only if what feeds each section changed — not the
  other way around. The skeleton file is now the source of truth for the shape; step 20
  is a feed list, not a shape description.
- `scripts/validate-comment-body.js`'s two new checks are independent of whether a
  Security advisory section is present in the body at all. At the time this decision was
  made, `renovate-triage`'s flow had no step gathering Security advisory evidence yet (a
  separate, independent unit of work tracked as issue #75) — the skeleton documented that
  section's shape ahead of the logic that would populate it. Issue #75 has since landed
  its own step (step 15) that gathers this evidence; step 20 now feeds a dependency's
  finding into the skeleton's Security advisories section when one exists, and the
  label/fence checks remain unaffected either way.
- Every future comment-shape addition (a new section, a new inline indicator) needs an
  explicit decision about whether it's mechanically checkable the way the tier-label and
  Agent-brief-fence checks are — if it is, it belongs in
  `scripts/validate-comment-body.js` alongside them; if it isn't, it stays a
  skeleton-file-only convention, the same way section order and the table-vs-prose choice
  are today.
