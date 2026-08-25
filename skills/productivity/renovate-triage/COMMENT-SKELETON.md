# Comment skeleton

The literal shape of the PR comment body `renovate-triage` composes and posts
(`SKILL.md` step 20) — copy this structure on every run rather than re-deriving it from
prose. Angle-bracketed text is a placeholder; everything else — headings, the marker,
the fence — is written exactly as shown. `scripts/validate-comment-body.js` mechanically
enforces the marker, the tier line's label, the Agent brief's fence, and the Opportunities
section's non-emptiness; it does not (and can't) check table vs. prose choice or section
ordering, so those still rely on this file being followed by hand.

## Contents

1. [Marker](#1-marker-always-first-never-rendered)
2. [Tier line](#2-tier-line-always-second)
3. [Per-dependency breakdown](#3-per-dependency-breakdown)
4. [Security advisories](#4-security-advisories-only-when-at-least-one-dependency-has-a-finding)
5. [Agent brief](#5-agent-brief-only-when-the-verdict-is-blocked)
6. [Opportunities](#6-opportunities-only-when-at-least-one-dependency-has-a-finding)
7. [Fixed order](#fixed-order)

## 1. Marker (always first, never rendered)

```text
<!-- renovate-triage:verdict -->
```

## 2. Tier line (always second)

```text
<TIER> — <one-line reason the tier fired>
```

`<TIER>` is fixed by the computed verdict, upper case, matching the tier name: `SAFE` for
`safe`, `NEEDS-REVIEW` for `needs-review`, `BLOCKED` for `blocked`. `<reason>` names the
specific hard-stop, baseline, or escalation that produced the verdict (step 17's `reason`
output) — never a bare restatement of the tier's name.

## 3. Per-dependency breakdown

**Single dependency** (an ungrouped PR) — bullet prose, unchanged from before this
skeleton existed:

```text
- **<dependency>**: `<old>` → `<new>`, <safe|needs-review|blocked>,
  <production|dev-only>, blast radius: <N> files
```

**2+ dependencies** (a grouped PR) — a table, one row per dependency, instead of one
bullet per dependency:

| Dependency | Old → New | Verdict | Placement | Blast radius |
|---|---|---|---|---|
| `<dependency>` | `<old>` → `<new>` | `<verdict>` | `<production\|dev-only>` | `<N>` files |

In either form, append ` [security advisory]` right after `<dependency>` (same cell for a
table row, same bullet for prose) when that dependency carries a Security advisory
finding — never a separate column or a separate bullet.

## 4. Security advisories (only when at least one dependency has a finding)

Omit this heading entirely when no dependency in the PR carries a Security advisory
finding — never an empty section or a "none found" placeholder. Otherwise:

```text
## Security advisories

### <dependency>

<the finding — what the advisory is, and where it was found>
```

One `### <dependency>` subsection per dependency with a finding; a dependency without one
gets no subsection. Structurally identical to the Opportunities section below — prose
only, never tabled. Present regardless of the verdict tier (a `safe` PR can still carry
one), and always sits after the per-dependency breakdown and before the Agent brief,
whether or not this PR has an Agent brief.

## 5. Agent brief (only when the verdict is `blocked`)

Never written for `needs-review` — that tier means a human should glance and decide, not
that information is missing. The body is fenced as a ` ```text ` block:

`````text
## Agent brief

```text
<call sites to inspect (the file list, not just a count), and the specific
changelog/release-notes section or failing CI check that triggered the hard-stop>
```
`````

## 6. Opportunities (only when at least one dependency has a finding)

Unchanged from before this skeleton existed: prose only, one `### <dependency>`
subsection per dependency with a finding, omitted entirely (no placeholder) when none,
never tabled.

```text
## Opportunities

### <dependency>

<the finding — a new capability or a deprecation, and why it's relevant to this
codebase's actual usage>
```

## Fixed order

1. Marker
2. Tier line
3. Per-dependency breakdown (table for 2+ dependencies, bullet prose for 1)
4. Security advisories — omitted when no dependency has a finding
5. Agent brief — only for a `blocked` verdict
6. Opportunities — omitted when no dependency has a finding

Sections 4 and 6 look alike (a `##` heading, one `###` subsection per dependency,
omitted when empty) but are never merged into one section or reordered relative to each
other — a Security advisory answers "is this urgent," an Opportunity answers "is this
worth adopting," and keeping them in their fixed positions keeps that distinction
legible at a glance.
