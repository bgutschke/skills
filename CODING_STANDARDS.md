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
  a worked example makes its behavior concrete. The example must demonstrate current,
  designed behavior — never narrate a bug that was found and fixed while building the
  skill.

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
- A skill's `description` names concrete trigger phrases or situations, not a vague
  category. ("Fires when the user says X, Y, or asks to Z" — not "helps with workflow
  tasks.")

## Pre-merge checklist

Complete `AGENTS.md`'s "To add a skill" steps, then:

- **Dry-run the skill** against a realistic sample task before committing. `validate
  --strict` only checks structural validity — frontmatter, file layout — not that the
  skill actually does what it claims.
- **Check for outside-bundle references** — scan for citations to files outside the
  skill's own directory that assume this repo's layout (see Self-containment above). A dry
  run won't catch this: a dead citation is inert prose, never dereferenced when the skill
  actually runs.
- **Run `writing-for-agents` against the draft** — a real second pass applying that
  skill's concepts (context pointers, information hierarchy, leading words, pruning
  no-op sentences) to the actual text, not a mental note made while writing it. That
  guidance has no mechanical rubric to grep for, so a self-review is the easiest of these
  checks to skip under pressure; treat it the same as a `/code-review` pass — a genuinely
  separate look, not a box ticked from memory.

## Non-skill code

#10 introduced this repo's first non-skill code: `scripts/*.js` (plain CommonJS, one pure
function per file, tested with Jest) and the tooling config that drives it
(`commitlint.config.js`, `release.config.js`, `.github/workflows/`). No dedicated style
guide beyond what's idiomatic for plain Node.js/CommonJS — nothing here is complex enough
yet to need one invented ahead of time.
