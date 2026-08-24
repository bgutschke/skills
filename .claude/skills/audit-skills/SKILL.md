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

A real dry run, executed against two synthetic, frozen fixtures built solely for this
example: `invoice-line-splitter`, deliberately constructed with violations spanning both
source documents, and `spreadsheet-cell-merger`, a fully compliant skill exercising the
"Compliant" report path. Both are entirely invented — neither names nor makes a pass/fail
claim about any real shipped or maintainer skill in this repo — and neither fixture file
was ever committed; they existed only in a scratch location outside the repository for
the duration of this run. That means the violation and clean pass illustrated below can
never drift, unlike a worked example that names a real skill and reports its current
compliance as fact.

Step 4's checklist sub-agent returned a topic-tagged checklist covering required
structure, naming, description design, self-containment, and style. Step 5's two
parallel per-fixture sub-agents then checked each fixture against it:

**`invoice-line-splitter`**

1. Description written in first person ("I split multi-line invoice text into per-item
   rows...") rather than third person — `docs/skill-writing-best-practices.md`,
   Description design.
2. Description states only *what* the skill does, with no trigger phrase or
   when-to-use clause — `docs/skill-writing-best-practices.md`, Description design.
3. No "When to use" or "When not to use" section anywhere in the body —
   `docs/skill-writing-best-practices.md`, Required structure.
4. Marketing/hype language in both the description ("our revolutionary,
   industry-leading parsing engine") and the body ("best-in-class... with unmatched
   accuracy") — `CODING_STANDARDS.md`, Style and content rules.
5. Cites a decision record (`docs/adr/0002-my-team-chose-a-layered-parser-fallback.md`)
   from inside its own instructions, assuming a file outside its bundle exists —
   `CODING_STANDARDS.md`, Self-containment.

**Compliant**

- `spreadsheet-cell-merger` — no violations found: explicit "When to use"/"When not to
  use" sections, a third-person description naming concrete triggers ("merge cells,"
  "collapse repeated row labels"), a worked example depicting evergreen designed
  behavior, and no citation to anything outside its own bundle.

Step 6 aggregated these into the report shape above: one fixture came back with five
violations spanning both source documents, and the other — built clean on purpose —
exercised the "Compliant" single-line path. That's the mechanism doing its actual job:
finding a real cross-document mix of defects in one pass and correctly clearing the
other. Because both fixtures are synthetic and never committed, this passage stays
accurate no matter how this repo's own skills change later.
