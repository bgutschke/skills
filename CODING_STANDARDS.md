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
- When a skill's mechanism depends on a non-ambient external CLI tool — one that requires
  authentication, or isn't installed on every machine capable of running Claude Code —
  state it in a dedicated `## Dependencies` section, naming the tool and its precondition
  (e.g. "requires an authenticated `gh` CLI"). Ambient tools (`git`, `base64`, and the rest
  of a standard shell) don't need listing. This is narrower than, and distinct from,
  [`docs/skill-writing-best-practices.md`](docs/skill-writing-best-practices.md)'s existing
  package/runtime-dependency guidance, which is about install-ability and network access
  across the different sandboxes a skill might run in, not CLI-availability/auth
  preconditions on a single machine.

For guidance on `SKILL.md` structure, description design, and how this repo's standards
relate to `writing-for-agents`, see
[`docs/skill-writing-best-practices.md`](docs/skill-writing-best-practices.md) — that
content is sourced from, and periodically reconciled against, external authoritative
guidance, so it lives separately from this file's terse, in-house rules.

## Pre-merge checklist

Complete `AGENTS.md`'s "To add a skill" steps, then:

- **Run `audit-skills` against the new skill** — checks the required structure and style
  bar from [`docs/skill-writing-best-practices.md`](docs/skill-writing-best-practices.md)
  (when to use it, when not to, a worked example, a well-designed `description`) and this
  file's own Self-containment rule (citations to files outside the skill's own directory
  that assume this repo's layout) in one pass, replacing what used to be two separate
  by-eye checks.
- **Dry-run the skill** against a realistic sample task before committing. `validate
  --strict` only checks structural validity — frontmatter, file layout — not that the
  skill actually does what it claims. `audit-skills` doesn't cover this either — it checks
  the `SKILL.md` against the written bar, not whether the skill performs its task.
- **Run `writing-for-agents` against the draft, or apply its concepts by hand if it isn't
  installed** — a real second pass over the actual text against that skill's concepts
  (context pointers, information hierarchy, leading words, pruning no-op sentences), not a
  mental note made while writing it. That guidance has no mechanical rubric to grep for, so
  a self-review is the easiest of these checks to skip under pressure; treat it the same as
  a `/code-review` pass — a genuinely separate look, not a box ticked from memory.

## Non-skill code

`scripts/*.js` (plain CommonJS, one pure function per file, tested with Jest) and the
tooling config that drives it (`commitlint.config.js`, `release.config.js`,
`.github/workflows/`) have no dedicated style guide beyond what's idiomatic for plain
Node.js/CommonJS. See [ADR 0006](docs/adr/0006-release-automation-via-semantic-release.md)
for why this tooling exists and how it's wired together.

Plain JS is type-checked via JSDoc annotations, never real `.ts` source and never a build
step: a file opts in with a `// @ts-check` pragma at its top, and `npm run typecheck`
(`tsc --noEmit` against the root `tsconfig.json`) checks every opted-in file at
`strict: true` from the moment it opts in — there is no looser on-ramp tier. Opting in is
mandatory the next time a file is touched for any reason (a bug fix, a small edit, not
just a rewrite), scoped to that single file, not its containing skill directory or
`scripts/` as a whole — touching one file never obligates opting in its neighbors. The
rule applies identically to maintainer-only tooling (`scripts/*.js`, `.claude/skills/**`)
and shipped skill scripts (`skills/**`) — neither is exempt. It does not apply
retroactively: files already in progress when this convention was adopted keep their
existing untyped state until they're next touched. See
[ADR 0026](docs/adr/0026-jsdoc-over-ts-for-type-checking.md) for why `.ts` source was
rejected and the rest of this convention's rationale.

Markdown is linted with `markdownlint-cli2` (config in `.markdownlint-cli2.jsonc`),
enforced locally by a Husky pre-commit hook (`lint-staged`, scoped to staged `.md` files)
and again in CI (`validate.yml`). See
[ADR 0007](docs/adr/0007-markdownlint-overrides-tuned-to-existing-conventions.md) for why
several default rules are disabled or loosened.
