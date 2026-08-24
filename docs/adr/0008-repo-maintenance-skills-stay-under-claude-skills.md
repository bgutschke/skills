# Repo-maintenance skills stay maintainer-only under `.claude/skills/`, never shipped

`CODING_STANDARDS.md`'s Self-containment rule forbids a shipped skill from assuming any
file outside its own bundle exists, because a shipped skill executes against whatever
project the user is actually working in, not this repo. A skill whose entire job is
checking or maintaining this repo's *own* documents — `skill-writing-standards`
(reconciles `docs/skill-writing-best-practices.md` against external sources), and now
`audit-skills` (checks `SKILL.md` files against that same doc plus `CODING_STANDARDS.md`)
— cannot satisfy that rule and still do its job: the paths it depends on
(`docs/skill-writing-best-practices.md`, `CODING_STANDARDS.md`,
`docs/agents/issue-tracker.md`) only exist in this repo by construction.

We resolve this the same way both times: keep the skill maintainer-only under
`.claude/skills/`, never listed in `plugin.json`'s `skills` array, with an explicit
Self-containment exemption noted in its own frontmatter explaining why the rule doesn't
apply. This is now a repeated pattern, not a one-off judgment call — worth recording so
the next instance doesn't re-litigate it.

**Considered and rejected:** shipping a portable version that bundles its own copy of the
rules it checks against, so plugin consumers could run it against their own repos. Rejected
both times because it defeats the point of the tool: `skill-writing-standards` exists to
keep `docs/skill-writing-best-practices.md` from going stale against external sources, and
`audit-skills` exists to check skills against whatever that doc currently says — a shipped
version would check against a duplicated, driftable snapshot instead of the live source,
reintroducing the exact staleness problem these tools exist to close.

## Consequences

- Any future skill whose function is inherently self-referential to this repo's own doc or
  skill tree gets the same treatment by default: `.claude/skills/`, not `skills/`, with a
  Self-containment exemption note — not re-decided from scratch each time.
- If a genuinely portable, other-repos-can-run-it version of one of these tools is ever
  wanted, that is a different skill with its own bundled rules, not a refactor of the
  maintainer-only original — the two have different jobs even when their names suggest
  otherwise.
