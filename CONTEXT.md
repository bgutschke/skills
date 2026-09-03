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
*Avoid*: treating as an edit target for the rules auditor — including `CLAUDE.local.md`, since edit authority here is scoped by location (home vs. project directory), not by who wrote the content. `refactor-rule-tree` is a deliberate, narrower exception: it may edit a project rule file the user explicitly names as its root (see `ADR 0024`) — this does not reopen the rules auditor's own read-broad, write-narrow boundary.

**Contradiction**:
Two rule files, or two invocable units (see below), giving opposite guidance for the same trigger. The rules auditor's highest-severity finding.
*Avoid*: using loosely for any overlap — see *Unresolved overlap*.

**Unresolved overlap**:
Two invocable units that could both plausibly fire for the same request, with no stated precedence between them — a carving defect even when neither one's guidance is individually wrong.
*Avoid*: conflating with *Contradiction*, which requires actual disagreement, not just untie-broken competition.

**Invocable unit**:
A skill or an agent — anything with a `description` the model matches against to decide whether to fire automatically. The rules auditor's semantic-distinction check only compares invocable units that can be auto-invoked; a unit with `disable-model-invocation: true` (or an agent that only runs when named explicitly) is exempt from that check.
*Avoid*: "skill" alone when an agent is equally in scope.

### Rule tree refactor

**Rule tree**:
A root *Rule file* plus every file reachable from it by import or mention edge, walked in
one pass by `refactor-rule-tree`. Bounded by node class rather than a fixed depth — see
*Restructurable*, *Verify-only*, and *Resolve-only* — and stops hard at the boundary
between a *Personal rule file* and a *Project rule file* rather than crossing it.
*Avoid*: reading this as every rule file a machine happens to have — a tree is rooted at
one file the pass was pointed at, not the union of every personal and project file that
exists.

**Ownerless rule**:
A rule inside a *Restructurable* node that no skill or agent already owns, and for which
no topic file or new skill is warranted either. Left in place rather than deleted — a pass
that removed it would delete guidance that has nowhere else to live.
*Avoid*: reading "ownerless" as a defect the pass must resolve — it is the safe default
verdict for a rule that fails every extraction condition, not a finding demanding action.

**Pointer**:
A citation of a file path inside prose reached by a *Rule tree* walk — an `@`-import or a
bare mention, either one. Every pointer resolves to exactly one of four verdicts: *Live*,
*Dead*, *Unrouted*, or *Unverifiable*.
*Avoid*: restricting this to `@`-imports — a plain mention of a path is a pointer too, just
one whose target is already lazily loaded rather than always-on.

**Live**:
A pointer verdict: the cited path resolves to a real, current file. The base case — no
finding is raised.
*Avoid*: confusing with *Unrouted*, which runs the opposite direction — a target that
resolves fine when checked from the outside, but that nothing in the tree actually points
at.

**Dead**:
A pointer verdict: a well-formed, fully-qualified path that resolves nowhere once checked
against the citing file's own directory, the repo root, and the home directory.
*Avoid*: confusing with *Unverifiable* — anything merely ambiguous rather than well-formed
and fully-qualified (see that entry for the full list of ambiguous shapes) is never
*Dead*; a hand-rolled resolver that collapsed this distinction produced seven false *Dead*
verdicts against a real repository.

**Unrouted**:
A pointer verdict describing a target confirmed to exist inside the tree, but that nothing
anywhere in the tree cites. A dead-pointer hunt alone never surfaces this — it requires
knowing the full reachable set, not just checking one citation at a time.
*Avoid*: confusing with *Dead* — a dead pointer is a citation with no target; an unrouted
node is a target with no citation. They are inverses of each other, not two degrees of the
same problem.

**Unverifiable**:
A pointer verdict for a reference that cannot be cleanly resolved either way: a glob, an
angle-bracket placeholder, a bare family filename, an extension-only mention, a partial
path, or an unexpanded harness path variable. Reported with the ordered list of roots
tried, so a partial-path citation can be reported with its completion already computed.
*Avoid*: treating this as a softer synonym for *Dead* — a dead pointer is well-formed and
fully-qualified but resolves nowhere; an unverifiable one was never cleanly resolvable in
the first place. The fourth verdict exists specifically so a confirmation gate is never
asked to approve deleting a reference that was actually correct.

**Precedence content**:
Prose stating which of two invocable units, or two pieces of guidance, takes priority for
a shared trigger — the kind of content `ROUTING.md`'s carving principle depends on. Never
proposed for extraction, regardless of how the rest of its file scores against the
placement decision.
*Avoid*: conflating with the rationale behind a routing decision — rationale is offered as
an optional extraction and dropped if declined; precedence content itself is never offered
at all, because a router that is not already loaded cannot route.

**Router exemption**:
The rule that *Precedence content* is excluded from extraction unconditionally, applied
without asking on every pass rather than re-proposed and re-declined every run.
*Avoid*: confusing with the placement decision's ordinary "fires on nearly every task" stay
condition — that one turns on observed firing frequency and can vary rule to rule; the
router exemption is categorical, keyed to content type, and needs no frequency judgment at
all.

**Restructurable**:
A *Rule tree* node the harness auto-loads — an eagerly-read *Rule file*. The placement
decision (stay, move to a topic file, become a skill, or delete) applies here and only
here.
*Avoid*: assuming file extension decides this — a `.md` file is restructurable only if the
harness actually auto-loads it; the same extension reached only by mention is *Verify-only*
instead.

**Verify-only**:
A *Rule tree* node holding prose the harness does not auto-load. Its pointers are still
checked, but its internal structure is left untouched — an already-lazy document has
already made the saving the placement decision exists to offer.
*Avoid*: confusing with *Restructurable* — the deciding fact is auto-load status, not
whether the content is prose; both classes can hold prose.

**Resolve-only**:
A *Rule tree* node confirmed to exist and never opened for findings — code, structured
configuration, model-written memory files, and another skill's own `SKILL.md`.
*Avoid*: assuming this class is only for non-prose files — a `SKILL.md` is prose but still
resolve-only, since auditing it is the skill auditor's job, not this pass's.

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
registry-published metadata, checked in this order: the image manifest's own OCI config
labels (`org.opencontainers.image.source`, then `.url`) — read from the registry API
itself, applicable regardless of which registry hosts the image, and the most durable of
the three signals since it's self-declared by the image's own build tooling; a GHCR
package's linked repository; or a Docker Hub image's `source_url` field, kept as a cheap
final check even though it's empty for ordinary Docker Hub images in practice. For a
Docker Official Image this is reliably a repository maintaining the Dockerfile and build
tooling, not the wrapped software's own project — its commit history speaks to
build/packaging concerns only, and it may have no GitHub Releases or `CHANGELOG.md` at
all.
*Avoid*: treating this repository as authoritative for the wrapped software's own
behavior changes — see *Upstream repository*. Also avoid assuming a name match between
the image and a plausible-looking GitHub repository is ever a resolution path here — `ADR
0015`'s guessing rejection still stands; OCI labels resolve this correctly even when the
image name and the real repository name diverge (e.g. `prom/node-exporter`'s actual
source is `prometheus/node_exporter`).

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
actually returning content — whether the adapter fetched that content itself, or is
reading the identical content Renovate's own PR body already rendered in its "Release
Notes" section (itemized entries sourced from the dependency's actual GitHub Releases),
since both are the same underlying source and the PR body's copy costs no extra fetch.
Never satisfied by a raw compare/diff view between two tags, even when that's the only
thing available (e.g. a repository with neither Releases nor a `CHANGELOG.md`) —
including when a bare compare/diff link is the only thing Renovate's own PR body offers
as its "Release Notes" section. A compare view's commit messages aren't curated for
user-facing disclosure the way release notes are — a repo can carry ten commits of
build-tooling noise across a bump that, upstream, was actually a security release, with
nothing in those commits saying so. When neither tier returns content, the result is "no
changelog found," identical to the case where no repository could be resolved at all.
*Avoid*: treating *any* PR-body "Release Notes" content as automatically suspect —only a
bare compare/diff link is the excluded case; genuine itemized release content the PR body
already carries is the same evidence the adapter would fetch itself, just already in
hand. Also avoid assuming this content is available for every dependency in a grouped
PR's full old→new range — see *Opportunity* and *Security advisory*, which still rely on
the adapter's own range-fetch for that.

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

### Memory curation

**Provenance**:
Which of four sources a pool entry, worktree, or orphan store was discovered through:
`current-project` (the project's own directory — no worktree involved), `live-worktree` (a
running `git worktree list` result), `worktree-state-parent` (this project's own transcripts
recorded creating it), or `worktree-state-sibling` (only the worktree's own transcripts
recorded it, found by scanning another project's transcripts). A worktree entry or orphan
store always carries one of the last three; `current-project` is a pool-entry-only value,
since only a pool entry can describe a session that isn't a worktree at all.
*Avoid*: collapsing `worktree-state-parent` and `worktree-state-sibling` into one
"found-via-transcripts" value — they distinguish which side of the worktree relationship the
record was found on (this project's own history versus another project's), which is exactly
the distinction `readWorktreeStateRecords` exists to preserve run-over-run.

**Memory store**:
A project's `memory` directory together with the index that points at its contents — the
files the harness loads as background context at the start of a session. Model-written
and appended to incrementally over time, rather than hand-authored in one sitting. One
store belongs to one project, and to exactly one user.
*Avoid*: "memory file" for the whole thing — that names a single *Memory*. Also avoid
conflating with *Rule file*: both are prose loaded into context, but a rule file is
hand-authored and shared, which is why the rules auditor owns it and memory curation
deliberately does not.

**Memory**:
One file in a *Memory store*, holding one fact, carrying the harness's frontmatter
contract. The store's index entry for it is derived from it, not part of it.
*Avoid*: using it for an index line — that's a pointer to a Memory, not one. Also avoid
stretching it to a file that has accumulated several facts: that's a store defect to be
split, not a wider definition of the term.

**Curation pass**:
One run over one *Memory store*, reading that store plus past session transcripts for the
same project, and producing a *Candidate store* and a report. Never modifies the store it
read.
*Avoid*: "dream" — the term the upstream managed-agents feature this technique is drawn
from uses for it; say *Curation pass* instead. It carries no meaning for anyone who hasn't
read that one documentation page, and it names a metaphor rather than the work being done.

**Candidate store**:
What a *Curation pass* produces: a complete memory store, written beside the input and
never over it.
*Avoid*: "diff" or "patch" for this — it is a whole store rather than a list of edits
against one. Also avoid using it for the input store under any circumstances; the two are
never the same directory.

**Candidate**:
One proposed change within a *Candidate store*, carried together with the evidence that
justifies it.
*Avoid*: reading a candidate as a decision — it is a proposal.

### Commit message generation

**Discovered convention**:
The commit-message rules the `draft-commit-message` skill infers for the repo it's
running in, before generating anything: commitlint's resolved config (read via
`--print-config`, since an enum like *Commit scope* may be computed rather than a static
list), a written commit-convention doc (`CLAUDE.md`/`CONTRIBUTING.md`), or a pattern
sampled from recent `git log` subjects — checked in that priority order, and merged
rather than strictly overriding: a linter's structured rules govern what it can
mechanically check, prose rules govern what it can't (body content, footer syntax,
breaking-change notation).
*Avoid*: assuming only one source can apply at once — most repos supply more than one,
and the skill combines them rather than picking a single winner.

**Fallback convention**:
Used only when the skill finds no *Discovered convention*, drawn from two different
lineages rather than one coherent source: the Angular convention's type enum (`build`,
`chore`, `ci`, `docs`, `feat`, `fix`, `perf`, `refactor`, `revert`, `style`, `test` — the
bare Conventional Commits spec itself only formally defines `feat`/`fix`; the fuller list
comes from Angular's convention, which `@commitlint/config-conventional` and
semantic-release's `angular` preset both implement), plus git's classic 50/72 header-length
rule rather than Angular's own looser 100-character guidance. Subject is lowercase
imperative, scope is never forced.
*Avoid*: treating this as a lesser or partial *Discovered convention* — it's what runs in
one's total absence, never a blend of the two. Also avoid calling it "the Conventional
Commits spec" unqualified — the spec alone doesn't supply this type enum or a length rule.

**Generation-only boundary**:
The fixed rule that `draft-commit-message` only ever produces message text — it never
runs `git add` or `git commit`, regardless of whether it fired on an explicit request or
on the drafting step of a plain "commit this" ask.
*Avoid*: reading auto-invocation as license to also perform the commit — widening when
the skill drafts a message never changes whether it acts beyond that.

**Convention snippet offer**:
The follow-up `draft-commit-message` appends only when it used the *Fallback
convention*: a one-line note that no convention was found, plus an offer to draft a
short prose paragraph for `CLAUDE.md`/`CONTRIBUTING.md`, written only on explicit
confirmation. Self-terminating — once adopted, the next run's discovery step finds it as
a *Discovered convention* and the offer stops appearing.
*Avoid*: extending it to tooling (a commitlint config, a git hook) — it stays text only,
per the *Generation-only boundary*. Also avoid treating the drafted snippet itself as a
*Discovered convention* before it's written and found again — until then it's just
proposed text.
