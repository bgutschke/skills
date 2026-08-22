# Copilot instructions

This repo ships Claude Code agent skills as a plugin. Skill authorship is the only content
type it ships today — there is no application code to review here.

## What to check on a skill PR

- **`SKILL.md` structure** — every skill must explicitly state when to use it, when *not*
  to use it, and include at least one worked example. Flag a skill missing any of the
  three.
- **Trigger specificity** — a skill's `description` must name concrete trigger phrases or
  situations ("fires when the user says X, Y, or asks to Z"), not a vague category like
  "helps with workflow tasks."
- **No emojis or marketing/hype language** in skill prose or generated artifacts, unless
  the user explicitly asked for them.
- **Registration completeness** — a new skill must appear in all four places: its
  `SKILL.md`, the `skills` array in `.claude-plugin/plugin.json`, its bucket's
  `README.md`, and the top-level `README.md`. Flag a PR that adds a skill in only some of
  these.
- **Model-invoked vs. user-invoked** — check that `disable-model-invocation: true` is set
  correctly for the skill's intended invocation mode, and that the README lists it under
  the matching section (**User-invoked** or **Model-invoked**).

These summarize `CODING_STANDARDS.md` and `AGENTS.md`; where this file and either of those
disagree, the other file is right.

## Commit messages

This repo follows [Conventional Commits](https://www.conventionalcommits.org/):
`type(scope): description`, lowercase, imperative, no trailing period, ≤72 chars (aim for
50). Scope is the bucket name (`engineering` or `productivity`) when a commit touches one
bucket, omitted for repo-wide changes. Flag a PR title or commit message that doesn't
follow this format — note it as feedback, not a blocker, since it isn't enforced by CI.

## Non-skill code

None exists yet. If a PR introduces it (hook scripts, CI config), there's no
repo-specific standard to apply — defer to that language's own idiomatic style.
