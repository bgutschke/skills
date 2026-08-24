---
name: audit-skills
paths:
  - "skills/**/SKILL.md"
  - ".claude/skills/**/SKILL.md"
description: Checks one or more SKILL.md files against this repo's Skill compliance bar — docs/skill-writing-best-practices.md's externally-sourced structure, naming, and description-design guidance, plus CODING_STANDARDS.md's house rules (self-containment, no emojis, no marketing language) — read live from both documents on every run, never against an embedded or duplicated checklist. Fires automatically, narrowly, right after a SKILL.md under skills/**/SKILL.md or .claude/skills/**/SKILL.md is created or substantively edited, checking just that one file. Also invocable as /audit-skills: with no argument it sweeps every skill in both the shipped skills/** tree and this repo's own maintainer-only .claude/skills/** tree; with a bare skill name it checks just that one skill.
---

# Audit skills

Check one or more `SKILL.md` files against this repo's Skill compliance bar — the
combined requirement set from `docs/skill-writing-best-practices.md` (externally-sourced
structure, naming, and description-design guidance) and `CODING_STANDARDS.md` (this
repo's own house rules: required structure, self-containment, no emojis, no marketing
language). Both documents are read live, in full, on every run — never an embedded or
duplicated checklist copy — so the check can never drift stale against either document
independently of the other. This skill only ever reports violations; it never edits
another skill's `SKILL.md` directly, mirroring `skill-writing-standards`' own
propose-only philosophy.

**Self-containment exemption:** `CODING_STANDARDS.md`'s Self-containment rule — never
cite this repo's own paths from inside a skill's instructions — does not apply to this
skill for the paths it directly depends on (`docs/skill-writing-best-practices.md`,
`CODING_STANDARDS.md`, `docs/agents/issue-tracker.md`). That rule exists because a skill
"executes against whatever project the user is actually working in, not this repo"; this
skill is project-scoped (`.claude/skills/audit-skills/`, never shipped in the plugin) and
only ever runs against this repo, so the failure mode the rule guards against cannot
occur here. The exemption is narrow: it does not extend to `docs/adr/*.md` or
`CONTEXT.md`, which stay uncited from this skill's own instructions the same as from any
other skill's.

## When to use

- Right after a `SKILL.md` under `skills/**/SKILL.md` or `.claude/skills/**/SKILL.md` is
  created or substantively edited — the `paths` scoping above fires this automatically,
  checking just that one file.
- The user types `/audit-skills` (with or without a skill-name argument).
- The user asks to check, audit, or verify an existing skill's compliance with this
  repo's structure or style bar.

## When not to use

- While a skill is still a rough, in-progress draft — wait until it's substantively
  written enough to check against the full bar; running this against an empty or
  half-started skeleton produces mostly noise.
- Checking whether a skill actually performs its task correctly — that's a dry run
  against a realistic sample task, per `CODING_STANDARDS.md`'s pre-merge checklist. This
  skill checks the written `SKILL.md` against the compliance bar, not runtime behavior.
- Checking `.claude-plugin/plugin.json` or `README.md` listing completeness — `claude
  plugin validate --strict` already covers that mechanically.
- Reconciling `docs/skill-writing-best-practices.md` itself against external sources —
  that's `skill-writing-standards`' job. This skill only checks existing skills against
  whatever the two documents currently say; it never edits either of them.
- Auto-fixing a violation, or filing a per-violation issue — this skill only reports,
  and only ever files one issue per skill that has violations, and only when asked.

## Resolving what to check

1. **Auto-fired** (via the `paths` frontmatter above): the target is exactly the one file
   that was created or edited.
2. **`/audit-skills` with no argument**: the target is every `SKILL.md` under
   `skills/**/SKILL.md` and `.claude/skills/**/SKILL.md` — a full sweep of both trees.
3. **`/audit-skills <skill-name>`**: resolve the name against both trees by directory
   name first; if that doesn't match anything, fall back to matching the `name` field in
   each candidate `SKILL.md`'s frontmatter. Check only the resolved skill.

## Mechanism

This is three sub-agent-shaped steps, no more, regardless of how many skills are being
checked:

4. Dispatch one sub-agent to read `docs/skill-writing-best-practices.md` and
   `CODING_STANDARDS.md` in full, fresh, and return a distilled, **topic-tagged
   checklist** — bullets, not raw doc content, each tagged with which document it comes
   from (e.g. "Description must state what and when, third person — best-practices.md"
   or "No marketing/hype language — CODING_STANDARDS.md"). This mirrors
   `skill-writing-standards`' own findings format for its research sub-agents.
5. Once the checklist is back, dispatch one sub-agent per target skill, **all in a single
   message** so they run concurrently. Give each sub-agent the checklist plus that
   skill's full `SKILL.md` content (and any bundled reference file it links, since
   progressive-disclosure structure is itself part of what's being checked). Ask it to
   return every violation found, each naming: the specific rule broken, which document
   that rule comes from, and the checklist topic it falls under. A skill with no
   violations should say so explicitly rather than returning nothing.
6. Aggregate every sub-agent's violations into the final report in this parent context —
   no dedicated aggregation sub-agent. This keeps the mechanism at exactly checklist +
   per-skill checks + (optional) issue filing, never more hops regardless of sweep size.

## Report shape

7. Group the report per skill. A skill with zero violations gets named on a single line
   under a "Compliant" heading — not its own subsection — so a full-sweep report stays
   scannable as the skill count grows. A skill with violations gets its own subsection
   listing each one, the specific rule it breaks, and which of the two documents that
   rule comes from.

## Issue filing

8. Report-only by default. Only when the user explicitly asks, file **one GitHub issue
   per skill that has violations** — never one batched issue for the whole run, never one
   per violation — each listing every violation found for that skill, via this repo's own
   issue-creation convention (`docs/agents/issue-tracker.md`: "publish to the issue
   tracker" means `gh issue create --title "..." --body "..."`). A skill with zero
   violations gets no issue.

## Worked example

A real dry run, executed against four fixtures: the two maintainer-only/shipped skills
already in this repo (`skill-writing-standards`, `audit-rules`); one constructed
violation — a copy of `audit-rules` renamed to `rule-auditor-pro`, with its description
rewritten to first-person marketing language ("Our revolutionary, best-in-class
rule-auditing engine... with industry-leading accuracy"), a citation to
`docs/adr/0006-release-automation-via-semantic-release.md` added to that description, and
its "When not to use" section deleted entirely; and one corrected fixture — a copy of
`audit-rules` with its own two genuine violations (found below) fixed, to exercise the
"Compliant" report path against a real known-good case rather than only the violation
path.

Step 4's checklist sub-agent returned a topic-tagged checklist covering required
structure, naming, description design, self-containment, style, and sizing. Step 5's
four parallel per-skill sub-agents then checked each fixture against it — and, notably,
neither of the two real, already-shipped skills came back clean:

**`skill-writing-standards`**

1. Its worked example narrates a specific historical dev-time event ("A real first run,
   executed 2026-08-23 against issue #35...") rather than depicting generic, evergreen
   designed behavior — `docs/skill-writing-best-practices.md`, Required structure.
2. The same section embeds dated, time-sensitive content (two literal `2026-08-23`
   timestamps, one issue-number reference) — `docs/skill-writing-best-practices.md`,
   Style and quality craft.

**`audit-rules`**

1. Cites a repo-layout-specific fact ("this repo's own `CLAUDE.md -> AGENTS.md`") inline
   as an example inside its general instructions — a Self-containment violation even
   though it isn't a `docs/adr/*.md`/`CONTEXT.md` citation, since a plugin consumer's own
   project has no such symlink at all — `CODING_STANDARDS.md`, Self-containment.
2. The frontmatter `description` states only *what* the skill does, with no trigger
   phrase or situation — that content exists only in the body's "When to use" section,
   not the description itself — `docs/skill-writing-best-practices.md`, Description
   design.

**`rule-auditor-pro`** (constructed fixture)

1. Marketing/hype language in the description ("revolutionary," "best-in-class,"
   "industry-leading") — `CODING_STANDARDS.md`, Style and content rules.
2. Description written in first person ("Our... engine") rather than third person —
   `docs/skill-writing-best-practices.md`, Description design.
3. Description cites `docs/adr/0006-release-automation-via-semantic-release.md`, a
   repo-specific path, with no stated exemption — `CODING_STANDARDS.md`,
   Self-containment.
4. Missing a "When not to use" section entirely — `docs/skill-writing-best-practices.md`,
   Required structure.

**Compliant**

- The corrected fixture — no violations found, once its two source violations were
  fixed: the description gained an explicit trigger clause ("Use when the user asks to
  audit... or types `/audit-rules`") and the repo-layout-specific symlink example was
  generalized to "A symlink counts as the file it points to."

Step 6 aggregated these into the report shape above. Three of the four fixtures came
back with violations — including both real, already-shipped skills, which had no prior
indication of drift — and the fourth, corrected specifically to fix those two skills'
genuine findings, came back clean, exercising the "Compliant" single-line path as well.
That's the mechanism doing its actual job: catching drift a reviewer hadn't noticed by
eye, not just detecting the defects it was built to detect.
