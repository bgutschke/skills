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

**Comment skeleton**:
The literal, section-by-section shape of the one PR comment `renovate-triage` posts per
PR (`renovate-triage/COMMENT-SKELETON.md`) — marker, tier line, per-dependency
breakdown, Security advisories, Agent brief, Opportunities, in a fixed order — copied
structurally on every run rather than re-derived from prose each time, the same
reference-by-file mechanism `pr-readiness`'s own report-skeleton file uses for its PR
comment. `scripts/validate-comment-body.js` mechanically enforces the parts of this
shape it can check (the marker, the tier line's label, the Agent brief's fence, the
Opportunities section's non-emptiness); section order and the table-vs-prose choice
aren't machine-checked, and rely on the skeleton file being followed by hand.
*Avoid*: calling this a "report skeleton" the way `pr-readiness` names its own file —
this section already calls the artifact "the same PR comment," never "report," so this
term should stay consistent with that.

**Datasource**:
Renovate's own name for a dependency's versioning source and lookup mechanism — `npm`,
`docker`, `pypi`, `ansible-galaxy`, `github-releases`, and others. A built-in manager
(e.g. npm) has a fixed default datasource; a `customManagers` entry declares its own via
`datasourceTemplate`. The skill resolves a changed file's datasource by reading the
target repo's own `renovate.json`, never by guessing from the file's name or extension
alone — a custom regex manager can point any file at any datasource.
*Avoid*: "ecosystem" for this going forward — once a single language can be reached via
more than one path (e.g. pip through a manifest file versus pip through a custom regex
manager embedded in a YAML file), "datasource" is the precise term; "ecosystem" conflates
the language with the mechanism Renovate used to find it.

**Datasource adapter**:
A declarative bundle — where to look for a changelog or release notes, and how to search
the codebase for usage sites — that evidence-gathering dispatches to once a PR's changed
file has a resolved *Datasource*. One adapter per datasource, replacing a hardcoded
evidence-gathering flow written out separately per ecosystem. For `docker`, one
resolution can consult two repositories — see *Packaging repository* and *Upstream
repository*.
*Avoid*: assuming an adapter is itself a sub-agent — the term names the evidence-gathering
strategy, not a claim about what process or context executes it. Also avoid assuming one
adapter run means one repository consulted.

**Packaging repository**:
For the `docker` datasource, the repository a Datasource adapter resolves directly from
registry metadata (a GHCR package's linked repository, or a Docker Hub image's
`source_url`). For a Docker Official Image this is reliably a repository maintaining the
Dockerfile and build tooling, not the wrapped software's own project — its commit
history speaks to build/packaging concerns only, and it may have no GitHub Releases or
`CHANGELOG.md` at all.
*Avoid*: treating this repository as authoritative for the wrapped software's own
behavior changes — see *Upstream repository*.

**Upstream repository**:
For the `docker` datasource, the project whose software is packaged into the image —
found by scanning the *Packaging repository*'s Dockerfile or version-pin files at the
target tag for an embedded GitHub release/tag/tarball URL pointing at a different
repository. When found, the adapter's GitHub-Releases-then-`CHANGELOG.md` lookup runs
there too, supplementing rather than replacing the packaging repository's own lookup —
each can independently carry breaking-change-relevant content (the packaging repository
for the image's build/runtime interface, the upstream repository for the software's
actual behavior). The major-bump *no changelog found anywhere* hard-stop requires both to
come up empty, not just one. When the embedded-URL scan finds no candidate, or finds more
than one with no way to tell which is authoritative, the adapter never guesses — it stays
with packaging-repository-only evidence.
*Avoid*: assuming every docker image has one — a GHCR image self-published by the
software's own project typically has no separate upstream to find, since the packaging
repository already is the upstream one.

**Security advisory**:
An explicit security disclosure found while gathering changelog evidence — an explicit
CVE identifier, a GitHub Security Advisory ID, a "Security" heading, or explicit
urgency/vulnerability language — always reported once found, with no call-site
cross-reference against the consuming codebase's actual usage. Reported in its own
comment section alongside but never merged into the *Risk verdict*, regardless of tier.
Unlike *Opportunity*, both its widened fetch (every release between old and new,
inclusive) and its reporting are unconditional, with no `--no-opportunities`-style
opt-out — a security fix can hide inside any skipped intermediate version, and a
heuristic usage check can produce a false negative for a vulnerability in baseline
behavior (e.g. an RDB-loading RCE that applies regardless of which APIs a caller uses),
so suppressing an urgent warning is a worse failure than one extra section on a PR that
turns out not to touch the affected feature.
*Avoid*: assuming this is cross-referenced against call sites the way an *Opportunity*
is — that was considered and rejected specifically because urgency and merge-risk are
different axes; letting a security disclosure change the verdict tier, or escalate it,
is the same mistake in the other direction — *Risk verdict* answers "is this safe to
merge," which a security fix usually already is.

**Changelog found**:
The result of a Datasource adapter's GitHub-Releases-then-`CHANGELOG.md` lookup order
actually returning content — never a fallback to a raw compare/diff view between two
tags, even when that's the only thing available (e.g. a repository with neither
Releases nor a `CHANGELOG.md`). A compare view's commit messages aren't curated for
user-facing disclosure the way release notes are — a repo can carry ten commits of
build-tooling noise across a bump that, upstream, was actually a security release, with
nothing in those commits saying so. When neither lookup tier returns content, the
result is "no changelog found," identical to the case where no repository could be
resolved at all.
*Avoid*: treating a compare/diff URL as satisfying this term just because Renovate's own
PR body links one as a fallback "Release Notes" section — Renovate's fallback and this
skill's evidence bar are different concerns.

**Opportunity**:
A relevant capability change found while scanning a minor or major bump's full release
range (every version between old and new, not just the latest) — either a newly-added
capability, or an existing capability the dependency now marks deprecated — cross-
referenced against the dependency's actual call sites in the consuming codebase and
reported only when relevant usage is found there. Reported per dependency, in its own
comment section, alongside but never merged into the *Risk verdict* — it never
escalates, de-escalates, or otherwise changes the verdict, regardless of tier or
placement (dev-only vs. production).
*Avoid*: conflating with *Agent brief* — that's investigative handoff for a `blocked`
verdict's hard-stop; an Opportunity is informational and appears (by default) regardless
of tier.
