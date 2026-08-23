# Coding standards

## Scope

This document sets the quality bar for skill authorship, the primary content type this
repo ships. A **Non-skill code** section below covers the release tooling and CI config
that support that shipping.

## Relation to `writing-for-agents`

The installed `writing-for-agents` skill covers general document-writing craft for
anything an agent consumes: context pointers, information hierarchy, pruning, leading
words. It applies to every `SKILL.md` in this repo. This document does not restate that
craft — it adds only what's specific to authoring a skill *here*.

## Required SKILL.md structure

Every skill must state, explicitly:

- **When to use it** — the concrete situations that should trigger it.
- **When *not* to use it** — the boundary cases it declines, so the trigger doesn't creep.
- **At least one worked example** — a skill described only in the abstract is unverifiable;
  a worked example makes its behavior concrete.

## Style and content rules

- No emojis in skill prose or generated artifacts, unless the user explicitly asks for
  them.
- No marketing or hype language — in descriptions or bodies.
- A skill's `description` names concrete trigger phrases or situations, not a vague
  category. ("Fires when the user says X, Y, or asks to Z" — not "helps with workflow
  tasks.")
- No relative-path references into this repo's own files (`docs/adr/*.md`, `CONTEXT.md`,
  `CODING_STANDARDS.md`, etc.) from inside a skill's own instructions. A skill executes
  against whatever project the user is actually working in, not this repo, so that path
  won't resolve there even though the file exists here. State the reasoning inline
  instead of citing it; if a citation is genuinely worth including, use an absolute,
  universally-resolvable URL (e.g. a GitHub issue link) — never a path relative to this
  repo.

## Pre-merge checklist

Complete `AGENTS.md`'s "To add a skill" steps, then:

- **Dry-run the skill** against a realistic sample task before committing. `validate
  --strict` only checks structural validity — frontmatter, file layout — not that the
  skill actually does what it claims.

## Non-skill code

#10 introduced this repo's first non-skill code: `scripts/*.js` (plain CommonJS, one pure
function per file, tested with Jest) and the tooling config that drives it
(`commitlint.config.js`, `release.config.js`, `.github/workflows/`). No dedicated style
guide beyond what's idiomatic for plain Node.js/CommonJS — nothing here is complex enough
yet to need one invented ahead of time.
