# Coding standards

## Scope

This document sets the quality bar for skill authorship, the primary content type this
repo ships. A **Non-skill code** section below covers the release tooling and CI config
that support that shipping.

## Self-containment

A skill must not assume that any file outside its own bundle exists — `docs/adr/*.md`,
`CONTEXT.md`, `README.md`, another skill's directory, or any other path specific to the
layout of whatever repo the skill happened to be authored in. A skill executes against
whatever project the user is actually working in, not this repo, so a reference to a file
that only exists here becomes a dead citation the moment the skill runs elsewhere. This is
a correctness constraint, not a style nicety: the failure is a broken reference at runtime,
not prose that merely reads worse.

The concrete instance of this in this repo: never cite this repo's own decision records
(`docs/adr/*.md`, `CONTEXT.md`) from inside a skill's own instructions — not even by an
otherwise-valid absolute URL. The reasoning must already be stated inline for the skill to
be self-contained; and `docs/agents/domain.md` already tells anyone maintaining this repo
to check `docs/adr/` before touching an area, so an in-skill pointer back would be
redundant for that audience too. This doesn't extend to citing external, third-party
references (a library's docs, an upstream bug tracker) by absolute URL — those have no
such standing discovery path and stay fine.

## Style and content rules

- No emojis in skill prose or generated artifacts, unless the user explicitly asks for
  them.
- No marketing or hype language — in descriptions or bodies.

For guidance on `SKILL.md` structure, description design, and how this repo's standards
relate to `writing-for-agents`, see
[`docs/skill-writing-best-practices.md`](docs/skill-writing-best-practices.md) — that
content is sourced from, and periodically reconciled against, external authoritative
guidance, so it lives separately from this file's terse, in-house rules.

## Pre-merge checklist

Complete `AGENTS.md`'s "To add a skill" steps, then:

- **Meet the required structure and style bar** in
  [`docs/skill-writing-best-practices.md`](docs/skill-writing-best-practices.md) — when to
  use it, when not to, a worked example, and a well-designed `description`.
- **Dry-run the skill** against a realistic sample task before committing. `validate
  --strict` only checks structural validity — frontmatter, file layout — not that the
  skill actually does what it claims.
- **Check for outside-bundle references** — scan for citations to files outside the
  skill's own directory that assume this repo's layout (see Self-containment above). A dry
  run won't catch this: a dead citation is inert prose, never dereferenced when the skill
  actually runs.
- **Run `writing-for-agents` against the draft, or apply its concepts by hand if it isn't
  installed** — a real second pass over the actual text against that skill's concepts
  (context pointers, information hierarchy, leading words, pruning no-op sentences), not a
  mental note made while writing it. That guidance has no mechanical rubric to grep for, so
  a self-review is the easiest of these checks to skip under pressure; treat it the same as
  a `/code-review` pass — a genuinely separate look, not a box ticked from memory.

## Non-skill code

#10 introduced this repo's first non-skill code: `scripts/*.js` (plain CommonJS, one pure
function per file, tested with Jest) and the tooling config that drives it
(`commitlint.config.js`, `release.config.js`, `.github/workflows/`). No dedicated style
guide beyond what's idiomatic for plain Node.js/CommonJS — nothing here is complex enough
yet to need one invented ahead of time.

#31 added Markdown linting (`markdownlint-cli2`, config in `.markdownlint-cli2.jsonc`),
enforced locally by a Husky pre-commit hook (`lint-staged`, scoped to staged `.md` files)
and again in CI (`validate.yml`). The config disables or loosens several rules that fire
on patterns this repo uses deliberately — unwrapped prose, steps numbered continuously
across sections, angle-bracket placeholders in prose — rather than forcing a rewrite of
existing docs; each override is commented with its reasoning in that file.
