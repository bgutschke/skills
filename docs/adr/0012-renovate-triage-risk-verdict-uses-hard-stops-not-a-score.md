# renovate-triage's Risk verdict uses a fixed hard-stop rule list, not a weighted score

`renovate-triage` computes each Renovate PR's Risk verdict — `safe`, `needs-review`, or
`blocked` — from a small, named set of hard-stop rules (an explicit breaking-change
callout, a failing CI check, or a major bump with no changelog found anywhere) plus a
bump-size baseline, rather than from a weighted or scored model summing multiple signals
against a threshold. `ADR 0001` (risk-tiered `minimumReleaseAge`) is the closest prior
art in this area, but it operates one layer earlier: it controls *when* a Renovate PR
becomes visible at all, by delaying majors and vulnerability fixes differently on the
Renovate config side. This decision is about what happens once a PR is already visible —
how the skill should react to it — a genuinely different layer, even though both start
from the same premise that not every Renovate bump carries equal risk.

A weighted score was the obvious alternative: assign points to each signal (breaking
change, CI status, blast radius, bump size) and sum them against thresholds. It was
rejected because an opaque number forces the maintainer to trust the model's arithmetic
rather than read one concrete reason the comment can name directly, and because a score
lets a genuinely dangerous signal get diluted by averaging it against unrelated positive
ones — a real breaking-change callout sitting next to a small blast radius and clean CI
would produce a middling score under most weighting schemes, when the callout alone
should be decisive. A hard-stop model can't do that by construction: any one hard-stop
alone forces `blocked`, full stop, with no other signal able to pull it back down.

**Considered and rejected:**

- **A weighted/scored model.** Rejected for the dilution problem above, and because
  tuning point values and thresholds has no natural stopping point — a score is never
  falsifiably wrong the way a fixed rule either fires or doesn't, so weight-tuning could
  continue indefinitely without ever converging on something the maintainer could fully
  trust.
- **A binary safe/not-safe split**, considered even before the three-tier shape existed.
  Rejected because it collapses "changelog silent on breaking changes" and "changelog
  explicitly warns of one" into the same bucket, losing a real confidence distinction —
  recorded separately in `CONTEXT.md`'s `Risk verdict` entry, but the same reasoning that
  rules out a score also rules out flattening the tiers.

## Consequences

- Any future signal added to the verdict logic must be classified explicitly as either a
  new hard-stop (evaluated before baseline, alone sufficient for `blocked`) or a new
  escalation (applied to a baseline, capped at raising it to `needs-review`, never past
  it) before it's wired in — there is no third, numeric-contribution path for a signal to
  take.
- `needs-review` stays the ceiling any combination of baseline and escalations can reach;
  only a named hard-stop can produce `blocked`. A future signal that seems to need finer
  gradation than three tiers should prompt revisiting this decision explicitly, rather
  than smuggling a partial score in underneath the existing tier labels.
- Every threshold the hard-stop/escalation logic relies on (e.g. the blast-radius file
  count) needs its own inline justification in the skill's own prose, per the
  prose-embedded-constants rule — a hard-stop model doesn't remove the need to justify
  the few numeric boundaries it still has, it just keeps their count small and each one
  independently named.
