# Skills state non-ambient CLI dependencies in a dedicated `## Dependencies` section

`to-pr`'s entire mechanism shells out to an authenticated `gh` CLI, and `audit-skills`'
optional issue-filing step does the same, but neither `SKILL.md` said so anywhere — and
neither `CODING_STANDARDS.md` nor `docs/skill-writing-best-practices.md` had a convention
for stating this kind of precondition at all. The closest existing guidance (in
`docs/skill-writing-best-practices.md`) is about package/runtime-environment assumptions —
network access, install-ability — across the different sandboxes a skill might run in, not
about whether a CLI tool is present and authenticated on the machine actually running it.
An undocumented dependency like this fails silently and late: a skill runs several steps
in before an unauthenticated `gh` call surfaces the problem, instead of a reader learning
it upfront.

We adopted a scoped convention: a dedicated `## Dependencies` section, listing only
*non-ambient* dependencies — CLI tools that require authentication, or aren't installed on
every machine capable of running Claude Code. `git` and `base64` don't qualify; an
authenticated `gh` CLI does.

**Considered and rejected:**

- **List every CLI tool a skill invokes, ambient or not.** Rejected as noise: it would
  bury the one precondition a reader actually needs to check (auth, installation) under a
  list of tools present on every dev machine by default, and `audit-skills` would have
  nothing useful to distinguish "worth flagging" from "always true."
- **Leave the gap undocumented, as before.** Rejected because it's exactly the kind of
  precondition that breaks a skill run silently, and a compliance check can't mechanically
  look for something with no defined shape — `audit-skills` needs a named, consistent
  section to check for, not prose it has to interpret loosely.

## Consequences

- `audit-skills`' compliance bar grows to check for a `## Dependencies` section on any
  skill whose mechanism invokes a non-ambient CLI tool, in both the shipped `skills/**`
  tree and this repo's own maintainer-only `.claude/skills/**` tree — the convention
  doesn't distinguish between the two.
- A future skill that only uses ambient tools (`git`, standard shell utilities) needs no
  `## Dependencies` section at all; the section's absence is not itself a violation, only
  an undocumented non-ambient dependency is.
- If a skill's non-ambient dependency changes (a tool swapped out, a new one added), the
  `## Dependencies` section is the single place that needs updating to keep the skill
  accurate.
