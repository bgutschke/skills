---
name: skill-writing-standards
disable-model-invocation: true
description: Invoked via /skill-writing-standards to research external, authoritative sources on Agent Skills authorship (Anthropic's own docs plus other maintained skill collections) and reconcile the findings into docs/skill-writing-best-practices.md as proposed, human-reviewed edits.
---

# Skill writing standards

Research how skills are best authored, from outside this repo, and reconcile that
research into `docs/skill-writing-best-practices.md` — the descriptive companion to this
repo's own terse `CODING_STANDARDS.md`. This is a maintainer-only, occasional maintenance
action, not something that should fire while someone is simply writing a skill.

**Self-containment exemption:** `CODING_STANDARDS.md`'s "Self-containment" rule — never
cite this repo's own paths from inside a skill's instructions — does not apply to this
skill. That rule exists because a skill "executes against whatever project the user is
actually working in, not this repo"; this skill is project-scoped
(`.claude/skills/skill-writing-standards/`, never shipped in the plugin) and only ever
runs against this repo, so the failure mode the rule guards against cannot occur here.

**Scope boundary relative to `writing-for-agents`:** general agent-document craft is that
skill's territory, not this one's — see `docs/skill-writing-best-practices.md`'s own
"Relation to `writing-for-agents`" note for what it covers. This skill only researches and
reconciles guidance *specific to skill authorship*: trigger/description design, tool
scoping, example structure, when-to-use/when-not boundaries, and the other topics in that
doc.

## When to use

- The user types `/skill-writing-standards`.
- The user asks to re-check, refresh, or update this repo's skill-authoring guidance
  against Anthropic's current documentation or other external sources.

## When not to use

- While actually writing or reviewing an individual skill — that's
  `docs/skill-writing-best-practices.md` and `CODING_STANDARDS.md` themselves, read
  directly. This skill produces those documents; it isn't a substitute for reading them.
- Auditing whether an *existing* skill in this repo complies with the required structure or
  style rules — this skill only researches and reconciles external guidance, it never
  checks other skills against it.
- Any request framed as "how do I write a good skill" — that's answered by reading
  `docs/skill-writing-best-practices.md` directly, not by re-running the research.

## Floor-list sources (always checked)

Hardcoded so coverage doesn't depend on re-deciding what's authoritative on every run.
Re-verify these URLs still resolve to current content before each run — Anthropic's docs
have already been observed to move between `platform.claude.com` and `docs.claude.com` for
at least one of these pages.

1. Anthropic official — [Agent Skills best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)
2. Anthropic official — [Agent Skills overview](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview)
3. Claude Code specific — [Use Skills in Claude Code](https://code.claude.com/docs/en/skills)
4. Anthropic engineering blog — ["Equipping agents for the real world with Agent Skills"](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills)
5. Secondary/fallback only — obra/superpowers,
   `skills/writing-skills/anthropic-best-practices.md` on GitHub. Treat this as lowest
   priority: it is largely derivative of the four sources above rather than an independent
   authority, so weight any finding it uniquely contributes lower than the same finding
   confirmed by an official source.

Also surface any other notable source encountered along the way, even when it's outside
this list — record it under "Other notable sources found" in the doc rather than silently
dropping it, so it can be considered for promotion onto the floor list on a future run.

## Research mechanism

1. Dispatch one `general-purpose` sub-agent per floor-list source, all in a single message
   (multiple `Agent` tool calls in parallel) — never call `WebSearch`/`WebFetch` directly
   in this context, and never delegate to `mattpocock-skills:research`. The former would
   pull raw page content into the context that later has to reconcile and write the doc;
   the latter would make a repo-upkeep tool depend on a third-party plugin staying
   installed.
2. Each sub-agent researches only its one assigned source (fetching an adjacent page it
   notices is out of scope for it — flag it, don't fetch it) and returns **topic-tagged
   findings**, not raw fetched content: one distilled bullet per finding, tagged with which
   subsection(s) of `docs/skill-writing-best-practices.md` it bears on (naming, description
   design, tool scoping, required structure, examples, when-to-use/when-not boundaries,
   progressive disclosure, style and quality craft, evaluation and testing, Claude Code
   mechanics, or a new topic if none fit), plus a note of any other authoritative source it
   noticed in passing.
3. Wait for every sub-agent to report back before reconciling anything.

## Reconciling findings

4. Only this parent context reconciles findings and makes `Edit` calls — never a research
   sub-agent, and never a separate dedicated "writer" sub-agent. One writer, one voice, one
   `writing-for-agents` pass over the whole result.
5. For each topic subsection in `docs/skill-writing-best-practices.md` a source's findings
   touch: compare the finding against that subsection's current content and its
   **Last reviewed** date.
   - If the guidance is materially the same as what's already there, leave the subsection
     untouched — do not re-date it and do not add a restating bullet. A no-op finding is
     not a reason to touch the file.
   - If the guidance is new, adds nuance, or has changed, **edit the subsection in place**
     — fold the new material into the existing prose rather than appending a dated log
     entry, update its **Sources** line if a new source now backs it, and bump its **Last
     reviewed** date to the date of this run.
   - Never create a duplicate topic subsection. If a finding doesn't fit any existing
     subsection, either fold it into the closest existing one or add exactly one new
     subsection for it.
6. Findings noted as "outside the floor list" go under "Other notable sources found" —
   update that list the same way (edit in place, don't duplicate an already-listed source).
7. Before proposing any diff, run a `writing-for-agents` pass over the reconciled prose (or
   apply its concepts by hand if that skill isn't installed) — the same discipline
   `CODING_STANDARDS.md`'s pre-merge checklist already requires of every `SKILL.md` draft,
   more necessary here since this doc synthesizes several sources' phrasing into one voice.
8. Propose every change as an ordinary `Edit` tool call, reviewed through the harness's
   normal permission prompt. Never write directly without going through that prompt, and
   never touch any file other than `docs/skill-writing-best-practices.md` (this skill does
   not also re-touch `CODING_STANDARDS.md` on every run — that file's own content is edited
   independently of this skill, per its own pre-merge checklist).

## Worked example

A real run dispatched five sub-agents — one per floor-list source — in parallel. Each
returned topic-tagged findings rather than raw page content; for example, the Claude Code
sub-agent tagged its `allowed-tools`/`disallowed-tools` findings under `tool-scoping` and
noted in passing that it had seen (but not fetched) a link to the Agent Skills
best-practices page.

Reconciling across all five reports surfaced both agreement and source-specific gaps: four
sources independently described the same three-tier progressive-disclosure model in
near-identical terms (worth cross-referencing rather than repeating four times), while
`tool-scoping` turned out to be documented only by the Claude Code source — the general
Anthropic platform docs and the obra/superpowers fallback were both silent on
`allowed-tools`/`disallowed-tools` entirely, a genuine coverage gap rather than an
extraction miss (obra/superpowers' own research sub-agent explicitly re-checked and
confirmed the absence rather than assuming it). The obra/superpowers findings were weighted
accordingly: bullets it shared with an official source were treated as confirmation, not a
second independent citation, while its few genuinely distinct contributions (the
"plan → validate → execute" framing, the two-agent author/tester loop) were folded in and
attributed to it directly.

The reconciled result populated `docs/skill-writing-best-practices.md` with one topic
subsection per finding-cluster the sources converged on, each dated to the day of that
run, plus an "Other notable sources found" section surfacing `agentskills.io`, the
`anthropics/skills` reference-implementation repo, and the `skill-creator` plugin — none on
the floor list, all noticed by a sub-agent in passing.

A later run re-dispatched the same five sub-agents against the same five sources, each
asked explicitly to report only deltas against what the prior run had already captured.
All five reported back "no material changes detected" — including the obra/superpowers
sub-agent, which re-confirmed the same absence of tool-scoping content it had flagged
before, rather than assuming it. Comparing those five reports against
`docs/skill-writing-best-practices.md`'s existing topic subsections and their same-day
Last-reviewed dates correctly produced zero edits — the idempotency mechanism in step 5
held on a genuine second invocation, not just on paper.
