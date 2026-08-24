---
name: renovate-triage
disable-model-invocation: true
argument-hint: "[<PR number or URL>]"
description: Reads each open Renovate dependency-bump PR's changelog, release notes, and CI status, computes a Risk verdict — safe, needs-review, or blocked — from a fixed hard-stop rule list rather than a weighted score, and posts (or updates in place) one PR comment per PR stating the verdict and reason; blocked PRs also get an Agent brief naming concrete call sites and changelog sections for a follow-up investigation. Resolves each changed file's datasource (npm, Docker, PyPI, Ansible Galaxy) from the target repo's own renovate.json rather than guessing from filenames, so custom regex managers are triaged correctly too. Use when the user types /renovate-triage with no argument to scan every open Renovate PR in the currently checked-out repo, or with a PR number or URL to check exactly one, or asks to triage, review, or assess the risk of Renovate dependency-bump PRs.
---

# renovate-triage

**Risk verdict**: A Renovate PR's classification into one of three tiers — `safe`,
`needs-review`, or `blocked` — computed by a fixed hard-stop rule list (an explicit
breaking-change callout, a failing CI check, or a major bump with no changelog found
anywhere, each alone forcing `blocked`) with a bump-size baseline underneath, rather than
a weighted score. Blast radius (how widely the dependency is used in the consuming
codebase) and CI-pending status can each escalate the baseline by one tier; dev-only vs.
production placement is reported as context but never changes the verdict — both are
escalated identically.

**Agent brief**: A `blocked`-verdict's handoff content, written into the same PR comment
as the risk verdict rather than a separate artifact. Addressed to an agent continuing the
investigation, not a human skimming for discretion — concrete starting points: which
call sites to inspect, which changelog or migration-guide sections to read.

**Datasource**: Renovate's own name for a dependency's versioning source and lookup
mechanism — `npm`, `docker`, `pypi`, `ansible-galaxy`, and others. A built-in manager
(e.g. npm) has a fixed default datasource; a `customManagers` entry declares its own via
`datasourceTemplate`. This skill resolves a changed file's datasource by reading the
target repo's own `renovate.json`, never by guessing from the file's name or extension —
a custom regex manager can point any file at any datasource.

**Datasource adapter**: A declarative bundle — where to look for a changelog or release
notes, and how to search the codebase for call sites — that evidence-gathering
dispatches to once a file's datasource is resolved. One adapter per datasource; a
resolved datasource with no adapter built is skipped and named, never given generic
best-effort evidence gathering.

The skill computes a Risk verdict for every open Renovate PR, or the single PR given as
an argument, reports in-session, and maintains exactly one idempotent comment per PR,
updated in place on later runs rather than duplicated. It never approves, merges, or
labels a PR — every merge decision stays the maintainer's.

## Dependencies

Requires an authenticated `gh` CLI — every step shells out to it (`gh pr list`, `gh pr
view`, `gh pr checks`, `gh api`, `gh pr comment`). Also requires `npm` and `node` — `npm`
to resolve an npm dependency's repository URL (`npm view <dep> repository.url`, used only
by the npm adapter), and `node` to run this skill's bundled resolution, verdict, and
validation scripts (`${CLAUDE_SKILL_DIR}/scripts/`). The docker, pypi, and
ansible-galaxy adapters query their own registries over HTTP via `curl` — ambient on any
machine capable of running Claude Code, like `git`, so it isn't listed as a precondition
the way `npm` and `node` are.

## When to use

- The user types `/renovate-triage` with no argument — every open Renovate PR in the
  currently checked-out repo gets a verdict in one pass.
- The user types `/renovate-triage <PR number or URL>` — re-check or spot-check exactly
  one PR without waiting for a full scan.
- The user asks to triage, review, or assess the risk of Renovate dependency-bump PRs.

## When not to use

- A PR whose resolved datasource (step 6) has no adapter built — anything beyond
  npm/docker/pypi/ansible-galaxy. This skill's evidence-gathering is designed around
  those four specifically; running it against an unhandled datasource would produce a
  verdict built on evidence it never actually gathered. A full-repo scan reports these
  PRs as skipped rather than silently omitting them — see step 9.
- A PR whose changed files span more than one resolved datasource, or include a file
  whose datasource can't be resolved locally (`unknown` — including one reachable only
  through an `extends` preset this skill never fetches). Reported as skipped, not
  triaged on a partial assumption about what the PR touches — see step 8.
- A repo whose Renovate config isn't found or isn't plain JSON (`renovate.json5` and
  JS-based configs aren't parsed) — reported as "detection unavailable," not silently
  skipped. See step 7.
- Any repo other than the one currently checked out. There is no `--repo` flag and no
  cross-repo scanning.
- Wanting the skill to approve, merge, or label a PR based on its verdict — it never
  does any of those, regardless of tier.
- Wanting migration-guide research on every PR. A migration or upgrade guide is
  consulted only as a targeted follow-up when a `blocked` verdict's Agent brief needs
  more detail than the changelog alone gives — never a broad web search, and never for a
  `safe` or `needs-review` verdict.

## Resolving what to check

1. **An explicit target was given** (PR number or URL): resolve it directly with `gh pr
   view <target> --json number,title,url,body,headRefName,author,files`. This is always
   a single-PR check, regardless of who authored it or what datasource it touches — an
   explicit target names a PR that must already exist, and the datasource-resolution
   check below still applies to it.
2. **No target was given**: list every open PR in the current repo — `gh pr list --state
   open --json number,title,url,body,headRefName,author,files` — and keep only the
   Renovate-authored ones: `author.login` equal to `renovate[bot]` or `app/renovate`.
3. **Zero PRs survive step 2**: report "no open Renovate PRs found" and stop — a clear
   confirmation the scan actually ran, not silence or an error.

## Orchestrating the scan

4. **No target was given** (step 2 produced one or more PRs): dispatch one sub-agent per
   PR via the Agent tool, run in parallel, each executing the complete per-PR flow below
   (datasource resolution through comment posting) independently for its own PR. PRs are
   already self-contained triage units — own rollup, own comment, own idempotency marker
   — so no cross-PR coordination is needed; each sub-agent reports its result back for
   step 21's summary. Adapters are never split out to their own sub-agent at
   dependency/datasource granularity — splitting evidence-gathering across a further
   sub-agent boundary would only add coordination overhead around an otherwise
   PR-scoped, deterministic flow.
5. **An explicit target was given** (step 1): run the flow inline in the current
   session, no sub-agent spawned — a quick spot-check shouldn't pay the parallel-
   orchestration overhead a full scan needs.

## Resolving each file's datasource

Runs once per PR, before any evidence gathering, using the PR's `files` list from steps
1–2:

6. Read the target repo's Renovate config — its root `renovate.json`, or
   `.github/renovate.json` if the former doesn't exist — and run `node
   ${CLAUDE_SKILL_DIR}/scripts/resolve-datasource-cli.js --file <path> [--file <path>
   ...]` for every file the PR changed. **Execute this script directly — it
   deterministically matches each file against the config's `customManagers[]` entries
   (`managerFilePatterns` regexes paired with a `datasourceTemplate`) and a small table
   of built-in managers' default file patterns (npm's four filenames are one entry in
   this table now, not the sole recognized case), never re-derived by hand.** `extends`
   preset chains are never fetched or resolved — only the config file's own local
   content is read. It prints `{ status, datasources }` JSON: `status` is `resolved` or
   `detection-unavailable`; `datasources` maps each file to its resolved datasource
   string, or `"unknown"` when the file matches neither a built-in pattern nor a
   `customManagers[]` entry — the same result a datasource reachable only through an
   unresolved `extends` preset gets, since that case is locally indistinguishable from
   "not managed at all."
7. `status: "detection-unavailable"` (no `renovate.json` found at either location, or it
   failed to parse as JSON): report the PR as "detection unavailable" in place of a
   verdict (explicit single-PR target) or under a dedicated "detection unavailable"
   heading (full scan), and stop for that PR — a config problem surfaces instead of the
   PR silently disappearing from the scan.
8. Any file resolving to `"unknown"`, or a PR whose files resolve to more than one
   distinct datasource, marks the PR out of scope: Renovate doesn't normally group
   across datasources, so a mix (or an unresolved file) is evidence of an unusual PR this
   skill isn't designed to read correctly, not a partial PR to triage anyway. Report it
   under a "skipped — mixed or unresolved datasource" heading, naming each file's
   resolved datasource.
9. A PR whose single resolved datasource has no adapter built — anything beyond
   npm/docker/pypi/ansible-galaxy — is reported under a "skipped — no adapter for
   `<datasource>`" heading, never given generic best-effort evidence gathering. A PR
   resolved to npm, docker, pypi, or ansible-galaxy proceeds to evidence-gathering below,
   using that datasource's adapter.

## Gathering evidence, per dependency

Steps 10–14 run once per dependency changed in the PR — for a PR Renovate grouped into
several dependencies, once per dependency in the group (see step 16 for how the
per-dependency results roll up). Steps 11 and 14 are the two facets a datasource's
adapter fills in (its changelog source, and its call-site search); steps 10, 12, and 13
are identical regardless of datasource.

10. Read the old and new version for this dependency from the PR's title or body (both
    fixed Renovate output formats naming the dependency and its version range,
    regardless of datasource).
11. Look for a changelog or release notes, per the PR's resolved datasource:
    - **npm**: in this fixed order, stopping at the first hit — (a) the dependency's
      GitHub Releases, via `gh api repos/<dep-owner>/<dep-repo>/releases` once the
      dependency's repository URL is resolved from its npm registry metadata (`npm view
      <dep> repository.url`); (b) the dependency's own `CHANGELOG.md` at its new release
      tag, read from the same repository.
    - **docker**: a source repository from registry-published metadata only, never
      guessed from the image name (`pihole/pihole`'s real source is
      `pi-hole/docker-pi-hole`, not a same-named repo) — a GHCR image's linked
      repository (`gh api orgs/<org>/packages/container/<image>`, its `repository`
      field), or a Docker Hub image's `source_url` field (`curl -s
      https://hub.docker.com/v2/repositories/<namespace>/<image>/`). Once a repository
      is found, the same GitHub-Releases-then-`CHANGELOG.md` order as npm's (a)/(b).
    - **pypi**: the package's declared source from PyPI's JSON API (`curl -s
      https://pypi.org/pypi/<package>/json`) — a `Source`, `Repository`, or `Changelog`
      entry (case-insensitive key match) in `info.project_urls`, or `info.home_page`
      only when it itself points at a GitHub or GitLab repository. Never a guess from
      the package name. Once found, the same GitHub-Releases-then-`CHANGELOG.md` order.
    - **ansible-galaxy**: the collection's declared `repository` field from the Galaxy
      API v3 collection metadata (`curl -s
      https://galaxy.ansible.com/api/v3/plugin/ansible/content/published/collections/index/<namespace>/<name>/`).
      Never a guess from the namespace or collection name. Once found, the same
      GitHub-Releases-then-`CHANGELOG.md` order.

    "No changelog or release notes found anywhere" (relevant to the major-bump hard-stop
    below) means the adapter's lookup — including its own registry-metadata step for
    docker/pypi/ansible-galaxy — came back empty at every stage.
12. If a changelog or release notes were found, scan them for an explicit
    breaking-change callout (a "Breaking Changes" heading, or prose stating a breaking
    change) and judge whether it's actually relevant to this codebase's usage — cross-
    reference the callout's described change (a removed export, a changed function
    signature, a changed default, a removed collection role) against the call sites
    found in step 14. A callout naming something this codebase never touches does not
    count as relevant.
13. Check CI status for the PR: `gh pr checks <number>` — classify as `failing`,
    `pending` (checks exist but haven't finished), or `passing` (no failing or pending
    checks).
14. Compute blast radius: count the distinct tracked files in the current repo using
    this dependency, searched per the PR's resolved datasource:
    - **npm**: files importing or requiring the dependency — `git grep -lE
      "['\"]<dep>(/|['\"])" -- '*.js' '*.jsx' '*.ts' '*.tsx' '*.mjs' '*.cjs'`.
    - **docker**: files naming the image — `git grep -l "<image-repository>" --
      '*Dockerfile*' 'docker-compose*.yml' 'docker-compose*.yaml'`.
    - **pypi**: files importing the package — `git grep -lE "^\s*(from|import)\s+<package>"
      -- '*.py'`.
    - **ansible-galaxy**: playbooks using the collection's fully-qualified name — `git
      grep -l "<namespace>\.<collection>\." -- '*.yml' '*.yaml'`.

    Treat the count as **large** when it exceeds 10 distinct files, regardless of
    datasource. Ten is the point past which reviewing every call site by hand stops
    being realistic inside an ordinary PR review — below it, a maintainer could still
    plausibly open every call site directly and check it themselves if they chose to,
    so a clean changelog is enough to stand on its own; above it, the sheer count is
    itself the practical reason a bump needs a closer look, independent of what the
    changelog says. This applies identically whether the dependency sits in a
    production or dev-only role — placement is reported as context (step 18) but never
    changes the verdict.

## Computing the verdict, per dependency

15. Compute the bump size and the verdict together by running
    `node ${CLAUDE_SKILL_DIR}/scripts/compute-verdict-cli.js --old-version <old>
    --new-version <new> --changelog-found <true|false> --breaking-callout
    <true|false> --ci-status <passing|pending|failing> --blast-radius-large
    <true|false>`, using the facts gathered in steps 10–14 — classifying the bump size
    itself needs no configurable threshold, since semver already defines the
    patch/minor/major boundary (and a non-semver version — common for a `docker` tag or
    an `ansible-galaxy` collection version — classifies deterministically as
    `indeterminate`), so it's folded into the same deterministic call rather than judged
    separately. **Execute this script directly for each dependency — it
    deterministically implements the decision table below, so the table must never be
    hand-recomputed or re-derived from the prose.** It prints `{ bumpSize, verdict,
    reason }` as JSON. The rules it implements:
    - **Hard-stops**, checked first — any one alone forces `blocked`, and skips baseline
      and escalation entirely for this dependency: an explicit breaking-change callout
      relevant to this codebase's actual usage (step 12); a failing CI check (step 13);
      a major bump with no changelog or release notes found anywhere (step 11) — this
      hard-stop is inapplicable to an `indeterminate` bump size, since "major" can't be
      asserted when the version strings don't parse as semver.
    - **Baseline**, only reached when no hard-stop fired: an indeterminate bump size (a
      non-semver old or new version) → `needs-review` unconditionally, mirroring the
      no-changelog-found case below — "I can't tell how big this bump is" must never
      silently resolve to `safe`; patch or minor bump with a changelog found → `safe`;
      major bump with a changelog found and no relevant breaking-change callout →
      `needs-review`, regardless of blast radius (a major bump's baseline is never
      `safe` — the version jump alone is enough to warrant a human glance even on a
      clean changelog); patch or minor bump with no changelog found → `needs-review`
      (this can't honestly reach `safe` — `safe` means a changelog was actually read and
      found clean, not merely that no danger signal happened to fire — but it also
      doesn't fit the major-bump hard-stop, which is specifically about major bumps).
    - **Escalations**, applied to the baseline, each by exactly one tier: large blast
      radius (step 14); CI pending rather than passing (step 13). `blocked` is reached
      *only* via a hard-stop — no combination of baseline and escalations ever produces
      it, even when both escalations fire on the same dependency, and even when the
      baseline came from an indeterminate bump size. This keeps a genuinely dangerous
      signal (a hard-stop) from ever being diluted by, or confused with, an accumulation
      of merely-cautious ones: `needs-review` is the ceiling anything but a hard-stop
      can reach.

## Rolling up a grouped PR

16. A PR grouping several dependencies gets a per-dependency verdict breakdown (steps
    10–15 run once per dependency) plus one overall rollup verdict, shown at the top of
    the comment, equal to the worst (most severe: `blocked` > `needs-review` > `safe`)
    verdict among its dependencies — so one risky dependency in an otherwise-boring
    bundle is never hidden behind the others.

## Writing the Agent brief

17. Only for a dependency (or PR, if ungrouped) whose final verdict is `blocked`: name
    the concrete call sites to inspect (the file list from step 14's blast-radius
    search, not just a count), and point to the specific changelog or release-notes
    section that triggered the hard-stop. If the hard-stop was a failing CI check, name
    the specific failing check(s) instead of a changelog section. If the changelog links
    a migration or upgrade guide and its own text isn't enough to say what needs to
    change at each named call site, fetch that guide now — the one point in this skill's
    flow where reading a migration guide is in scope — and cite the specific section
    relevant to the flagged change. Never write an Agent brief for `needs-review` — that
    tier means a human should glance and decide, not that information is missing.

## Posting the comment

18. Compose one comment body per PR: an HTML-comment marker (`<!--
    renovate-triage:verdict -->`, used for the validation gate below and the idempotency
    check in step 20, never shown in the rendered comment) followed by the verdict (with
    the per-dependency breakdown from step 16 for a grouped PR), the one-line reason each
    tier or hard-stop fired, each dependency's production/dev-only placement as context,
    and the Agent brief section when step 17 produced one.
19. Before any comment write executes for this run, validate every composed body: run
    `node ${CLAUDE_SKILL_DIR}/scripts/validate-comment-body-cli.js <verdict>
    <body-file>` for each PR's body from step 18. **Execute this script directly for
    every PR in the batch before posting any of them — it is the machine-checkable gate
    for the whole run, not a manual double-check.** It confirms the verdict is one of
    the three valid tiers, the idempotency marker appears exactly once, and an Agent
    brief section is present if and only if the verdict is `blocked`. A PR whose body
    fails validation is skipped for posting — report it in step 21 alongside the reason
    validation gave, rather than letting a malformed comment reach a real PR — while
    every other PR in the batch still proceeds.
20. For every PR whose body passed step 19's validation: search the PR's existing
    comments for the marker: `gh api repos/<owner>/<repo>/issues/<number>/comments
    --jq '.[] | select(.body | contains("renovate-triage:verdict")) | .id'`. If a match
    exists, update it in place — `gh api -X PATCH
    repos/<owner>/<repo>/issues/comments/<id> -f body=@<file>` — rather than posting a
    second one. If no match exists, create it — `gh pr comment <number> --body-file
    <file>`. Invoking the skill is sufficient authorization to write or update every
    comment touched in the run; there is no separate per-PR confirmation prompt beyond
    step 19's validation gate.

## Reporting

21. Report in-session, in addition to the PR comments: every PR checked, its verdict (or
    per-dependency breakdown for a grouped PR), whether its comment was created or
    updated, every PR skipped for a mixed or unresolved datasource (step 8), every PR
    skipped for having no adapter for its resolved datasource (step 9), every PR skipped
    for detection being unavailable (step 7), and every PR skipped for failing step 19's
    validation gate — each with the reason why. On a no-target scan that found zero open
    Renovate PRs, this report is exactly the "no open Renovate PRs found" line from step
    3 — never silence.

## Worked example

A synthetic scenario set, fabricated for this dry run and discarded afterward — never
committed, so a fixture PR can't be mistaken for a real one — covering each hard-stop,
baseline, and escalation individually, the grouped-PR rollup, and one fixture per
datasource:

| # | Fixture | Datasource | Bump | Changelog | CI | Blast radius | Verdict | Why |
|---|---|---|---|---|---|---|---|---|
| 1 | `widget-format` | npm | major | none found | passing | 2 files | `blocked` | hard-stop: major, no changelog anywhere |
| 2 | `fake-http-client` | npm | minor | found, states a removed default export used in this repo | passing | 4 files | `blocked` | hard-stop: relevant breaking-change callout |
| 3 | `collection-utils` | npm | patch | found, clean | failing | 3 files | `blocked` | hard-stop: failing CI |
| 4 | `term-color` | npm | patch | found, clean | passing | 3 files | `safe` | baseline: patch/minor + changelog |
| 5 | `date-helpers` | npm | minor | found, clean | passing | 14 files | `needs-review` | baseline `safe`, escalated: blast radius > 10 |
| 6 | `ui-toolkit` | npm | major | found, no breaking-change callout | passing | 6 files | `needs-review` | baseline: major + changelog, no callout |
| 7 | `lint-core` | npm | minor | found, clean | pending | 5 files | `needs-review` | baseline `safe`, escalated: CI pending |
| 8 | grouped: `bundler-core` (major, no changelog, failing CI) + `bundler-cli` (patch, clean, passing) | npm | — | — | — | — | overall `blocked` | rollup = worst of the two (`bundler-core`'s hard-stop) |
| 9 | `ghcr.io/example-org/sample-image` | docker | minor tag bump | found via GHCR org linkage, clean | passing | 2 files | `safe` | docker adapter: registry-linked changelog, baseline patch/minor |
| 10 | `sample-transform-lib` | pypi | major | found via `project_urls.Source`, no breaking-change callout | passing | 5 files | `needs-review` | pypi adapter: baseline major + changelog, no callout |
| 11 | `example.sample_collection` | ansible-galaxy | patch | found via Galaxy `repository` field, clean | passing | 1 file | `safe` | ansible-galaxy adapter: baseline patch/minor + changelog |
| 12 | `legacy-widget` | docker | `latest` → `stable` (non-semver) | found, clean | passing | 3 files | `needs-review` | baseline: indeterminate bump size defaults to needs-review |

Fixture 1 alone already fires a hard-stop, so its `blocked` verdict holds regardless of
its small blast radius — confirming hard-stops short-circuit baseline/escalation
entirely (step 15). Fixture 5 shows the blast-radius escalation on its own pushing an
otherwise-clean minor bump from `safe` to `needs-review`, without touching `blocked` —
confirming the `needs-review` ceiling from step 15. Fixture 8's `bundler-cli` verdict
(`safe`) never appears at the top level; only the rollup does, per step 16. Fixtures
9–11 confirm the same hard-stop/baseline/escalation logic produces identical shapes of
verdict regardless of which adapter gathered the evidence — only *where* the changelog
and blast-radius facts come from differs by datasource, never how they're judged.
Fixture 12 confirms an indeterminate bump size defaults to `needs-review` on its own,
without needing a missing changelog or any other signal to fire.

**Comment idempotency**, checked against one real open Renovate PR on this repo at dry-
run time (a synthetic fixture is an equally valid substitute when none is open): the
first run found no comment containing the `renovate-triage:verdict` marker, so step 20
took the create branch (`gh pr comment`). Re-running the skill against the same PR with
no new commits found the marker in the existing comment and took the update branch (`gh
api -X PATCH`) instead — the PR ended the second run with exactly one `renovate-triage`
comment, not two.
