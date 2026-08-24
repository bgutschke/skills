# bgutschke/skills

A Claude Code plugin repo shipping agent skills, organized into bucket folders under `skills/`.

## Language

**Commit scope**:
The optional `type(scope): ...` segment of a Conventional Commits header. Three independent vocabularies share this one field, and a commit draws from at most one of them, picking the most specific one that applies: *skill scope* names the one skill a commit touches, by that skill's own directory name (e.g. `to-pr`); *bucket scope* (`engineering`, `productivity`) is the fallback when a commit spans multiple skills in one bucket or touches a bucket-level file; *maintenance scope* (`deps`, `config`) names what kind of automated dependency-tooling change a Renovate-authored commit is. Enforced dynamically — `commitlint.config.js` reads skill directory names off disk rather than from a hand-maintained list. See `AGENTS.md`'s Commit messages section for the full rule.
*Avoid*: treating "scope" as solely the bucket vocabulary — that's only one of three now; and don't assume the enum is a static list — it's computed from `skills/**` and `.claude/skills/**` at lint time.

### Rules auditor

**Rule file**:
A natural-language instruction file Claude Code loads automatically into context — the `CLAUDE.md` / `CLAUDE.local.md` / `rules/*.md` family, at any scope (personal, project, or managed-policy), including anything pulled in via `@`-import.
*Avoid*: "config file" (that's `settings.json` — structured, not prose); "memory file" (model-written, not hand-authored — out of scope for the rules auditor).

**Personal rule file**:
A rule file the current user owns and can edit directly — `~/.claude/CLAUDE.md`, `~/.claude/rules/*.md`. The rules auditor's only edit target.
*Avoid*: conflating with *Project rule file*, which the auditor only ever reads.

**Project rule file**:
A rule file that lives in the project directory rather than the user's home directory — `./CLAUDE.md` and `./.claude/rules/*.md` (typically shared with a team via version control), plus a repo's `CLAUDE.local.md` (typically gitignored and personal to whoever's working in that checkout, but still project-scoped by location, not home-directory scoped). The rules auditor reads all of these for cross-referencing but never proposes edits to any of them, regardless of who authored the content.
*Avoid*: treating as an edit target — including `CLAUDE.local.md`, since edit authority here is scoped by location (home vs. project directory), not by who wrote the content.

**Contradiction**:
Two rule files, or two invocable units (see below), giving opposite guidance for the same trigger. The rules auditor's highest-severity finding.
*Avoid*: using loosely for any overlap — see *Unresolved overlap*.

**Unresolved overlap**:
Two invocable units that could both plausibly fire for the same request, with no stated precedence between them — a carving defect (per `ROUTING.md`'s carving principle) even when neither one's guidance is individually wrong.
*Avoid*: conflating with *Contradiction*, which requires actual disagreement, not just untie-broken competition.

**Invocable unit**:
A skill or an agent — anything with a `description` the model matches against to decide whether to fire automatically. The rules auditor's semantic-distinction check only compares invocable units that can be auto-invoked; a unit with `disable-model-invocation: true` (or an agent that only runs when named explicitly) is exempt from that check.
*Avoid*: "skill" alone when an agent is equally in scope.

### Skill compliance audit

**Skill compliance bar**:
The combined requirement set a `SKILL.md` must satisfy: `CODING_STANDARDS.md`'s house
rules (required structure, self-containment, no emojis, no marketing language) plus
`docs/skill-writing-best-practices.md`'s externally-sourced structure, naming, and
description-design guidance. Checked live against both documents' current content, never
against an embedded or duplicated copy.
*Avoid*: "best practices" alone for this — that names only the externally-sourced half of
the two documents.

**Evergreen worked example**:
A skill's worked example that demonstrates the mechanism's designed behavior without
asserting a pass/fail fact about any target whose state can later change. A dated
timestamp, an issue number, or a claim about a real live file's current compliance
breaks this. Referencing an immutable external record (e.g. a merged PR, cited by number)
does not — it can never "come back clean" later and invalidate the narration the way a
live file can.
*Avoid*: assuming "narrates something that really happened" is itself the defect — the
defect is asserting a current-state fact about a *mutable* target, not historicity by
itself.

**Dependencies section**:
A skill's `## Dependencies` heading listing only its *non-ambient* external dependencies —
CLI tools that require authentication, or aren't installed on every machine capable of
running Claude Code (e.g. an authenticated `gh` CLI). Part of the Skill compliance bar;
checked mechanically by `audit-skills`.
*Avoid*: listing ambient tools (`git`, `base64`, and the rest of a standard shell) here —
that's noise, not signal, and the convention deliberately excludes them.

### Renovate PR triage

**Risk verdict**:
A Renovate PR's classification into one of three tiers — `safe`, `needs-review`, or
`blocked` — computed by a fixed hard-stop rule list (an explicit breaking-change
callout, a failing CI check, or a major bump with no changelog found anywhere, each
alone forcing `blocked`) with a bump-size baseline underneath, rather than a weighted
score. Blast radius (how widely the dependency is used in the consuming codebase) and
CI-pending status can each escalate the baseline by one tier; dev-only vs. production
placement is reported as context but never changes the verdict — both are escalated
identically.
*Avoid*: a binary safe/not-safe split — it collapses "changelog silent on breaking
changes" and "changelog explicitly warns of breaking changes" into one bucket, losing a
real confidence distinction. Also avoid a weighted/scored model — the hard-stop shape
was chosen specifically so every verdict traces to one named reason.

**Agent brief**:
A `blocked`-verdict's handoff content, written into the same PR comment as the risk
verdict rather than a separate artifact. Addressed to an agent continuing the
investigation, not a human skimming for discretion — concrete starting points: which
call sites to inspect, which changelog or migration-guide sections to read.
*Avoid*: attaching this to `needs-review` — that tier means a human should glance and
decide, not that information is missing.
