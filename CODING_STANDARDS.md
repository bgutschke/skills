# Coding standards

## Scope

This document sets the quality bar for skill authorship — the only content type this repo
ships today. A **Non-skill code** placeholder section below reserves scope for anything
else (hook scripts, CI config) once it exists.

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

## Pre-merge checklist

Complete `AGENTS.md`'s "To add a skill" steps, then:

- **Dry-run the skill** against a realistic sample task before committing. `validate
  --strict` only checks structural validity — frontmatter, file layout — not that the
  skill actually does what it claims.

## Non-skill code (placeholder)

No non-skill code exists in this repo yet. Once it does, standards for it are decided
per-language at that time, deferring to that language's own idiomatic style guide rather
than inventing rules now.
