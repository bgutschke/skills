# Evergreen worked examples assert facts only about synthetic, frozen fixtures

`audit-skills`' own worked example named two real shipped skills
(`skill-writing-standards`, `audit-rules`) and reported the specific violations found in
each as current fact. Because those are claims about live files, the example went stale
the moment either skill changed — `audit-rules`' cited symlink violation was fixed in a
later commit, leaving the worked example asserting something no longer true. A worked
example that demonstrates a mechanism's designed behavior is fine; a worked example that
asserts a still-true pass/fail fact about something mutable is not — see `CONTEXT.md`'s
**Evergreen worked example** entry for the precise distinction.

We resolve this by building entirely synthetic, frozen fixtures for any worked example
that makes a pass/fail claim, running the skill's real mechanism against them, and
discarding the fixture files once the example is written — never committing them, so
they can't be mistaken for real skills. A real skill's name may still appear in a worked
example where no compliance claim is made about it, or where the reference is to
something immutable and so can never "come back clean" later — `to-pr`'s worked example
safely cites a merged PR by number on exactly this basis.

## Consequences

- Any future compliance-audit-style skill's worked example follows this same pattern by
  default: synthetic fixtures for the pass/fail claims, a real name allowed only for an
  immutable reference.
- A worked example's real, fixed, permanent inputs — config intrinsic to the skill's own
  identity, such as a hardcoded floor list, rather than an arbitrary target the skill
  operates against — may be kept as-is; only claims about a *mutable target's current
  state* need genericizing. This is a legitimate variant of the pattern above, not a
  deviation from it.
- Issue #53 (`skill-writing-standards`' own worked example, same defect class) is resolved
  via that variant: its hardcoded floor-list sources stayed real in the narration, while
  the dated, issue-numbered framing and the fixed-count claim about
  `docs/skill-writing-best-practices.md`'s current subsections were removed.
