# Skill-writing best practices

Externally-sourced guidance on authoring a `SKILL.md`, reconciled from Anthropic's own
documentation and other maintained skill collections. `CODING_STANDARDS.md` holds this
repo's terse, in-house rules; this doc holds the descriptive, cited material those rules
build on, kept current by re-running `skill-writing-standards`
(`.claude/skills/skill-writing-standards/SKILL.md`) against the floor-list sources below.

Each topic ends with its own **Sources** and **Last reviewed** line, so staleness is
visible per-topic rather than for the doc as a whole.

## Relation to `writing-for-agents`

The [`mattpocock-skills:writing-for-agents`](https://github.com/mattpocock/skills) skill,
where installed, covers general document-writing craft for anything an agent consumes:
context pointers, information hierarchy, pruning, leading words. It applies to every
`SKILL.md` in this repo. This document does not restate that craft — it adds only what's
specific to authoring a skill, sourced from external authorities on that specific subject.

## Required SKILL.md structure

At the YAML level, a `SKILL.md`'s only required frontmatter fields are `name` and
`description` — `description` is merely "recommended" by the strictest reading, but
omitting it means Claude Code falls back to matching against the first markdown
paragraph, which is worse in every case. Anthropic's own minimal template is an H1 title
followed by an `## Instructions` section and an `## Examples` section.

This repo layers a stricter bar on top of that minimum. Every skill here must state,
explicitly:

- **When to use it** — the concrete situations that should trigger it.
- **When *not* to use it** — the boundary cases it declines, so the trigger doesn't creep.
- **At least one worked example** — a skill described only in the abstract is
  unverifiable; a worked example makes its behavior concrete. The example must demonstrate
  current, designed behavior — never narrate a bug that was found and fixed while building
  the skill.

Beyond that shape, sizing guidance is consistent across sources: keep `SKILL.md` itself
under 500 lines, and split into separate reference files once a skill approaches that
limit (see Progressive disclosure below). List any required packages/dependencies
explicitly rather than assuming they're installed, and verify that assumption against the
runtime the skill actually targets — the Claude API's code-execution sandbox has no
network access and no runtime package installation, while claude.ai can install from
npm/PyPI or pull from GitHub, and Claude Code has full network access matching the user's
own machine.

**Sources:** Anthropic — [Agent Skills overview](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview), [Agent Skills best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices), [Claude Code skills](https://code.claude.com/docs/en/skills), [engineering blog](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills)
**Last reviewed:** 2026-08-23

## Naming

Anthropic recommends gerund form for skill names — `processing-pdfs`,
`analyzing-spreadsheets`, `managing-databases` — because it names the activity clearly;
noun-phrase (`pdf-processing`) or action-oriented (`process-pdfs`) forms are acceptable
alternatives. Avoid vague names (`helper`, `utils`, `tools`), overly generic names
(`documents`, `data`, `files`), and the reserved words `anthropic`/`claude` anywhere in the
name — the latter is a hard validation constraint, not just style, alongside a 64-character
cap and a lowercase-letters/numbers/hyphens-only charset. Pick one naming pattern and hold
it across a whole skill collection; inconsistency undermines exactly the searchability a
good name buys.

Claude Code adds its own constraints on top of that: the reserved directory name `synced`
(any capitalization) is disallowed for user-authored skills, since Claude Code uses it for
skills synced from claude.ai. Name-collision comparison is case/spacing/invisible-character
-insensitive and normalizes look-alike Unicode forms (fullwidth letters, dash variants),
though a genuinely different-alphabet look-alike letter still counts as a distinct name.

**Sources:** Anthropic — [best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices), [overview](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview), [Claude Code skills](https://code.claude.com/docs/en/skills), [engineering blog](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills); obra/superpowers [anthropic-best-practices.md](https://github.com/obra/superpowers/blob/main/skills/writing-skills/anthropic-best-practices.md) (restates the above)
**Last reviewed:** 2026-08-23

## Description design

The `description` field is the sole discovery signal Claude uses to decide whether to
trigger a skill among potentially 100+ available skills — before a skill fires, only its
`name` and `description` occupy context (Claude Code's own accounting puts this at roughly
100 tokens per skill). A good description states both *what the skill does* and *when to
use it*, written in third person: "Extract text and tables from PDF files, fill forms,
merge documents. Use when working with PDF files or when the user mentions PDFs, forms, or
document extraction." — not "I can help you..." or "You can use this to...", since the
description is injected into the system prompt and an inconsistent point of view causes
discovery problems. `description` must be non-empty, ≤1024 characters, and contain no XML
tags. Vague descriptions ("Helps with documents", "Processes data") give Claude nothing to
match against and are called out explicitly as a failure mode to avoid.

This repo's own house rule already captures the what/when split concretely: a
`description` names concrete trigger phrases or situations, not a vague category ("Fires
when the user says X, Y, or asks to Z" — not "helps with workflow tasks").

Claude Code layers a truncation detail on top: the `description` plus a separate
`when_to_use` frontmatter field (trigger phrases/example requests) are concatenated and
shown in the skill listing, truncated at 1,536 characters combined — so front-load what
matters most for matching accuracy, since it's also what survives truncation. When the
overall skill listing overflows its budget, Claude Code drops full descriptions starting
with the least-invoked skills first, keeping only names — another reason to make a
description lean but keyword-rich rather than padded. Tune trigger wording empirically,
not just at write time: if a skill under-fires, check the description includes keywords
users would naturally say; if it over-fires, tighten specificity or reach for
`disable-model-invocation: true` instead (see When-to-use/when-not boundaries).

**Sources:** Anthropic — [best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices), [overview](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview), [Claude Code skills](https://code.claude.com/docs/en/skills), [engineering blog](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills); obra/superpowers [anthropic-best-practices.md](https://github.com/obra/superpowers/blob/main/skills/writing-skills/anthropic-best-practices.md) (restates the above)
**Last reviewed:** 2026-08-23

## Tool scoping

Claude Code, specifically, exposes two independent frontmatter levers here, and neither is
covered by the general Anthropic platform docs:

- `allowed-tools` pre-approves specific tools without a permission prompt, but **only for
  the turn that invokes the skill** — the grant clears on the user's next message, and it
  does not narrow the overall tool pool (everything not listed still falls back to normal
  permission settings). It accepts a space/comma-separated string or a YAML list, and
  supports path substitutions (`${CLAUDE_SKILL_DIR}`, etc.) so a bundled script can be
  pre-approved to run without a prompt, e.g. `allowed-tools: Bash(${CLAUDE_SKILL_DIR}/scripts/render.sh *)`.
- `disallowed-tools` removes tools from Claude's available pool while the skill is active
  (e.g. blocking `AskUserQuestion` for an autonomous/background-loop skill); it also clears
  on the next user message, and cannot remove `EndConversation` while any other tool
  remains.

Security implication worth stating plainly: neither field is gated by workspace trust, so
a skill checked into a repository can grant itself broad tool access on its own — review
`allowed-tools` on any skill authored by someone else before running it in an untrusted
repo. Injected shell commands (the `` !`command` `` / fenced ` ```! ` dynamic-context
syntax) never prompt for permission at all; a matching deny rule aborts the whole skill
invocation rather than pausing for approval, which is the practical reason to pre-approve
such commands via `allowed-tools` rather than leaving them to the default prompt flow.

Beyond Claude-Code-specific frontmatter, the general guidance is about referencing tools
correctly rather than restricting them: MCP tool references must be fully qualified as
`ServerName:tool_name` (e.g. `GitHub:create_issue`) — an unqualified name can fail to
resolve when multiple MCP servers are present.

**Sources:** [Claude Code skills](https://code.claude.com/docs/en/skills) (primary — `allowed-tools`/`disallowed-tools` are Claude-Code-specific and not documented on the general platform pages); Anthropic — [best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices) (MCP qualification only); obra/superpowers (checked, has no tool-scoping content — genuine gap in that source, not an extraction miss)
**Last reviewed:** 2026-08-23

## Examples

Anthropic's "Examples pattern": where output quality depends on seeing examples, give
concrete input/output pairs the same way you would in a regular prompt — a worked example
communicates desired style and level of detail more clearly than a prose description ever
can. The related "Template pattern" distinguishes a strict, must-follow output template
("ALWAYS use this exact structure") from a labeled default template a model can adapt with
judgment — pick whichever matches how much variation the task can tolerate. Both sources
converge on the same bar: examples must be concrete, not abstract.

**Sources:** Anthropic — [best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices), [overview](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview) (reserves a dedicated `## Examples` section in its own minimal template); obra/superpowers (restates the above)
**Last reviewed:** 2026-08-23

## When-to-use / when-not boundaries

Upstream of any frontmatter mechanism, the `description` field itself *is* the entire
trigger-boundary mechanism for general Agent Skills — there's no separate exclusion field
on the base platform, so precision in the "when to use" clause is the only lever available
there.

Claude Code adds two independent, purpose-built axes on top of description wording:

- `disable-model-invocation: true` — only the user can invoke the skill (via
  `/skill-name`); its description isn't even loaded into context for Claude's own
  decision-making. Reserve this for side-effecting or timing-sensitive workflows
  (deploys, commits, sending a message) — "you don't want Claude deciding to deploy
  because your code looks ready." If Claude attempts to invoke such a skill anyway, Claude
  Code blocks the call and tells Claude to suggest the user run it themselves rather than
  reproducing the steps another way.
- `user-invocable: false` — the inverse: only Claude can invoke it, useful for background
  knowledge that isn't itself a meaningful user action (e.g. a `legacy-system-context`
  skill). Its description stays resident in context either way.

`paths` (glob patterns) narrows automatic model-invocation to when Claude is actually
touching matching files — a scoping lever independent of description wording entirely.

Across every source, boundary-tuning is expected to be empirical, not fixed at write time:
watch for unexpected trajectories, overreliance on one file or section, or a skill firing
in contexts it shouldn't, then narrow the description or add `disable-model-invocation`/
`paths` in response — the same "observe, then adjust" loop that governs description design.

**Sources:** [Claude Code skills](https://code.claude.com/docs/en/skills) (the two-axis invocation-control mechanism is Claude-Code-specific); Anthropic — [best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices), [engineering blog](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills) (empirical-tuning framing); obra/superpowers (checked — has no boundary-scoping guidance distinct from description wording, a genuine gap)
**Last reviewed:** 2026-08-23

## Progressive disclosure

Every source converges on the same three-tier loading model, explained with the same
manual analogy ("a table of contents, then specific chapters, then a detailed appendix"):

1. **Metadata** (`name` + `description`) — always resident in context from startup,
   regardless of whether the skill ever fires.
2. **SKILL.md body** — loaded in full only once the skill is judged relevant; this is the
   tier the <500-line guidance targets.
3. **Bundled files** — reference docs, scripts, templates — loaded only when specifically
   referenced and read, or executed via Bash with only their *output* (never their source)
   entering context. Because agents have filesystem access, there is effectively no limit
   on how much can be bundled here: unused files cost zero tokens.

The authorship implication is to keep SKILL.md itself lean and push anything
specialized, rarely-needed, or purely factual (API references, large schemas, edge-case
procedures) into separate linked files — three concrete organizing patterns recur across
sources: a high-level guide with references out to `FORMS.md`/`REFERENCE.md`; splitting a
multi-domain skill into one reference file per domain so an unrelated domain's content
never loads; and keeping basic usage inline while linking out only for advanced/edge-case
features. Deterministic operations belong in an executable script rather than left as
prose Claude reproduces from scratch each run — more reliable, and only the output costs
tokens.

Two structural constraints keep this pattern from backfiring: keep every reference exactly
**one level deep** from SKILL.md (link every supporting file directly, rather than
chaining SKILL.md → advanced.md → details.md — Claude may only preview a nested file with
something like `head -100` and miss content buried further in), and give any reference
file over 100 lines a table of contents up front, so a partial read still reveals the
file's full scope.

**Sources:** Anthropic — [best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices), [overview](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview), [engineering blog](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills); [Claude Code skills](https://code.claude.com/docs/en/skills) (adds the explicit ≤500-line and "state what to do, not how or why" sizing bar); obra/superpowers (restates the above, with the sharper "one level deep" phrasing independently confirmed)
**Last reviewed:** 2026-08-23

## Style and quality craft

A cluster of concrete writing rules recurs across every primary source:

- **Concise is key.** The context window is a shared resource across the system prompt,
  conversation history, and every other skill's metadata — challenge every paragraph with
  "does Claude really need this, or does it already know it?" before keeping it.
- **Match degrees of freedom to task fragility.** High freedom (prose heuristics) when
  multiple valid approaches exist; medium freedom (parameterized scripts) when a preferred
  pattern exists but some variation is fine; low freedom (one exact script, "do not
  modify") when operations are fragile or must follow an exact sequence.
- **Use consistent terminology** — one term per concept throughout a skill, never
  switching between synonyms for the same thing.
- **Avoid time-sensitive information** — never write date-conditional instructions;
  document only the current method as primary content, and move deprecated approaches into
  a clearly labeled "old patterns" section instead.
- **Avoid offering too many roughly-equal options** — state one default with a narrow,
  named escape hatch for the genuine edge case, rather than listing several parallel
  choices for Claude to weigh itself.
- **No voodoo constants** — every configuration value or threshold in a bundled script
  needs a comment justifying why that value was chosen; if the author doesn't know the
  right value, Claude has no better way to determine it at runtime.
- **Solve, don't defer, in scripts** — handle expected error conditions (missing file,
  permission error) with sensible fallback behavior in the script itself, rather than
  letting an exception surface for Claude to puzzle out.
- **Implement feedback loops** — a "run validator → fix errors → repeat" pattern
  meaningfully improves output quality, whether the validator is an executable script or a
  reference document Claude compares its own output against by hand.
- **Plan-validate-execute for risky operations** — for batch, destructive, or high-stakes
  changes, insert a machine-verifiable intermediate output (e.g. a JSON change plan) that a
  script validates before anything is actually applied; validator error messages should be
  verbose and name valid alternatives rather than just rejecting.
- **Disambiguate execute vs. read-as-reference** for bundled scripts — a skill must state
  explicitly whether Claude should run a script directly or read its source as reference
  for the algorithm, since either intent is plausible for a bundled file.

**Sources:** Anthropic — [best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices), [engineering blog](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills); obra/superpowers (adds the "plan → validate → execute" and "solve, don't defer" framings independently, though both trace back to the same official source material)
**Last reviewed:** 2026-08-23

## Evaluation and testing a skill

Anthropic's recommended workflow is evaluation-driven and happens *before* writing
extensive documentation: run the target model on representative tasks with no skill and
record specific gaps, build roughly three test scenarios that target exactly those gaps,
measure a without-skill baseline, then write only the minimal instructions needed to close
that gap and re-measure against the baseline. An evaluation is a plain object with
`skills`, `query`, `files`, and `expected_behavior` fields; there's no built-in runner, so
authors build their own (Claude Code's `skill-creator` plugin automates this comparison —
see Other notable sources below). Test across every model the skill will actually run
under, since a weaker model may need more explicit detail than a stronger one generalizes
from.

A second, complementary pattern is a two-role authoring loop: one instance helps author or
refine the skill while a second, *fresh* instance actually uses it on real tasks (fresh,
because leftover authoring context would mask genuine written-instruction gaps) — observe
where the fresh instance explores unexpectedly, misses a connection, over-relies on one
section, or ignores bundled content entirely, then refine and repeat. When it skips a
rule, strengthen the imperative language ("MUST filter" instead of "always filter") or
move the rule to a more prominent position, rather than just repeating it.

**Sources:** Anthropic — [best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices), [engineering blog](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills); [Claude Code skills](https://code.claude.com/docs/en/skills) (`skill-creator` plugin automation); obra/superpowers (independently emphasizes eval-before-documentation and the two-agent loop, though both trace to the same official source material)
**Last reviewed:** 2026-08-23

## Claude Code mechanics

Claude-Code-specific plumbing worth knowing when authoring a skill that ships as (or
inside) a Claude Code plugin, as this repo does:

- **Locations and precedence.** Skills load from four locations — enterprise (managed
  settings), personal (`~/.claude/skills/<name>/SKILL.md`), project
  (`.claude/skills/<name>/SKILL.md`, this project only), and plugin
  (`<plugin>/skills/<name>/SKILL.md`). On a name collision: enterprise overrides personal
  overrides project; any of those override a same-named bundled skill; plugin skills are
  namespaced (`plugin-name:skill-name`) and never collide with anything. A nested
  `.claude/skills/` below the working directory scopes a skill to when Claude is touching
  that subtree, surfacing as a directory-qualified command (`/apps/web:deploy`) on a name
  clash.
- **Command name derivation** differs by location: for personal/project skills the
  directory name becomes the command (frontmatter `name` is a display label only there);
  for plugin skills, the frontmatter `name` (or directory-name fallback) supplies the final
  namespaced segment.
- **Session persistence.** Once invoked, a skill's content stays in context for the rest
  of the session as a single message and is not re-read on later turns — write standing
  instructions the model can keep following, not one-time setup steps. Auto-compaction
  re-attaches only the most recently invoked copy of each skill, capped at 5,000
  tokens/skill and a shared 25,000-token budget across all skills — older or less-recently
  used skills can be dropped entirely on compaction.
- **`context: fork`** runs a skill as a subagent — its content becomes that subagent's
  entire prompt, with no access to the parent conversation's history — and defaults to
  running in the background. Combined with `agent:`, it picks which subagent executes the
  skill; the built-in `Explore`/`Plan` agents skip `CLAUDE.md` entirely, so a forked skill
  routed to one of them sees only its own `SKILL.md` content plus that agent's system
  prompt.
- **Dynamic context injection** — `` !`command` `` inline or fenced ` ```! ` blocks run a
  shell command before the skill's content reaches Claude, substituting live output (e.g.
  inlining `git diff HEAD` so guidance is grounded in the actual working tree rather than
  guessed context).
- **Path substitutions** — `${CLAUDE_SKILL_DIR}`, `${CLAUDE_PROJECT_DIR}`,
  `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}` let a skill reference its own bundled
  files portably regardless of install location; using the same variable in both the body
  and an `allowed-tools` Bash rule lets a bundled script run without a permission prompt.

**Sources:** [Claude Code skills](https://code.claude.com/docs/en/skills) (sole source — this section is entirely Claude-Code-specific and not covered by the general platform docs)
**Last reviewed:** 2026-08-23

## Other notable sources found (not on the floor list)

Surfaced during this run beyond the four required sources plus the obra/superpowers
fallback — not yet reconciled into the topics above, listed here so a future run can
decide whether to promote any of them onto the floor list:

- **[agentskills.io](https://agentskills.io)** — described in Anthropic's own docs as "the
  official skills platform," an open standard published 2025-12-18 defining the
  cross-product frontmatter spec (`name`, `description`, `license`, `compatibility`,
  `metadata`, `allowed-tools`) that Claude Code's own frontmatter is a superset of. Worth
  treating as a primary source on a future run, since it's the normative spec rather than
  one vendor's restatement of it.
- **[anthropics/skills](https://github.com/anthropics/skills)** (GitHub) — Anthropic's own
  reference-implementation skills (e.g. the `document-skills/pdf` skill used as the worked
  example throughout the engineering blog post) — a source of real, load-bearing examples
  rather than prose guidance.
- **`skill-creator` plugin** ([anthropics/claude-plugins-official](https://github.com/anthropics/claude-plugins-official/tree/main/plugins/skill-creator)) and its
  companion post, ["Improving skill-creator: test, measure, and refine Agent
  Skills"](https://claude.com/blog/improving-skill-creator-test-measure-and-refine-agent-skills)
  — automates the with/without-skill baseline comparison, blind A/B version comparison, and
  description auto-tuning described under Evaluation and testing above.
- **[anthropics/claude-cookbooks](https://github.com/anthropics/claude-cookbooks/tree/main/skills)**
  — worked example code referenced from the engineering blog post.

One naming/URL discrepancy worth flagging for a future run rather than silently resolving:
the engineering blog links its "Skills docs" to `docs.claude.com/en/docs/agents-and-tools/agent-skills/overview`,
while the floor list (and this run) used `platform.claude.com/docs/en/agents-and-tools/agent-skills/overview` for the same page — the two domains may be aliases, or one may be superseding
the other. Re-verify both floor-list URLs still resolve to current content before the next
run, per the parent issue's own note that the floor list needs periodic re-verification.

**Last reviewed:** 2026-08-23
