---
name: renovate-triage
disable-model-invocation: true
argument-hint: "[<PR number or URL>]"
description: Reads each open Renovate dependency-bump PR's changelog, release notes, and CI status, computes a Risk verdict — safe, needs-review, or blocked — from a fixed hard-stop rule list rather than a weighted score, and posts (or updates in place) one PR comment per PR stating the verdict and reason; blocked PRs also get an Agent brief naming concrete call sites and changelog sections for a follow-up investigation. Use when the user types /renovate-triage with no argument to scan every open Renovate PR in the currently checked-out repo, or with a PR number or URL to check exactly one, or asks to triage, review, or assess the risk of Renovate dependency-bump PRs.
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

The skill computes a Risk verdict for every open Renovate PR, or the single PR given as
an argument, reports in-session, and maintains exactly one idempotent comment per PR,
updated in place on later runs rather than duplicated. It never approves, merges, or
labels a PR — every merge decision stays the maintainer's.

## Dependencies

Requires an authenticated `gh` CLI — every step shells out to it (`gh pr list`, `gh pr
view`, `gh pr checks`, `gh api`, `gh pr comment`). Also requires `npm` and `node` — `npm`
to resolve a dependency's repository URL (`npm view <dep> repository.url`), and `node`
to run this skill's bundled verdict and validation scripts
(`${CLAUDE_SKILL_DIR}/scripts/`). `git` is also used but, like the rest of a standard
shell, is ambient on any machine capable of running Claude Code, so it isn't listed here
— `npm` and `node` are not equally guaranteed.

## When to use

- The user types `/renovate-triage` with no argument — every open Renovate PR in the
  currently checked-out repo gets a verdict in one pass.
- The user types `/renovate-triage <PR number or URL>` — re-check or spot-check exactly
  one PR without waiting for a full scan.
- The user asks to triage, review, or assess the risk of Renovate dependency-bump PRs.

## When not to use

- A PR from any ecosystem other than npm/JS — pip, Go modules, Docker, or GitHub
  Actions. This skill's evidence-gathering (npm registry metadata, GitHub releases, a
  `CHANGELOG.md`) is designed around npm specifically; running it against another
  ecosystem would produce a verdict built on evidence it never actually gathered. A
  full-repo scan reports these PRs as skipped rather than silently omitting them — see
  step 5.
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
   a single-PR check, regardless of who authored it or what ecosystem it touches — an
   explicit target names a PR that must already exist, and the ecosystem check in the
   next section still applies to it.
2. **No target was given**: list every open PR in the current repo — `gh pr list --state
   open --json number,title,url,body,headRefName,author,files` — and keep only the
   Renovate-authored ones: `author.login` equal to `renovate[bot]` or `app/renovate`.
3. **Zero PRs survive step 2**: report "no open Renovate PRs found" and stop — a clear
   confirmation the scan actually ran, not silence or an error.

## Ecosystem scope check

Runs once per PR, before any evidence gathering, using each candidate PR's `files` list
from steps 1–2:

4. A PR is in scope only if every changed file is an npm-ecosystem file:
   `package.json`, `package-lock.json`, `yarn.lock`, or `pnpm-lock.yaml`. Changed files
   naming `requirements*.txt`/`Pipfile`/`pyproject.toml` (pip), `go.mod`/`go.sum` (Go
   modules), `Dockerfile`/`docker-compose*.yml` (Docker), or anything under
   `.github/workflows/` (GitHub Actions) mark the PR out of scope. A PR touching a mix of
   npm and non-npm files is treated as entirely out of scope — Renovate does not
   normally group across ecosystems, so a mix is evidence of an unusual PR this skill
   isn't designed to read correctly, not a partial-npm PR to triage anyway.
5. An out-of-scope PR is never silently dropped: on a full scan, list it in the final
   summary report (step 17) under a "skipped — non-npm ecosystem" heading, naming which
   file(s) triggered the exclusion. On an explicit single-PR target, report the same
   thing in place of a verdict and stop for that PR.

## Gathering evidence, per npm dependency

Steps 6–10 run once per dependency changed in the PR — for a PR Renovate grouped into
several dependencies, once per dependency in the group (see step 12 for how the
per-dependency results roll up).

6. Read the old and new version for this dependency from the PR's title or body (both
   fixed Renovate output formats naming the dependency and its version range).
7. Look for a changelog or release notes, in this fixed order, stopping at the first
   hit: (a) the dependency's GitHub Releases, via `gh api
   repos/<dep-owner>/<dep-repo>/releases` once the dependency's repository URL is
   resolved from its npm registry metadata (`npm view <dep> repository.url`); (b) the
   dependency's own `CHANGELOG.md` at its new release tag, read from the same
   repository. "No changelog or release notes found anywhere" (relevant to the
   major-bump hard-stop below) means both (a) and (b) came back empty.
8. If a changelog or release notes were found, scan them for an explicit
   breaking-change callout (a "Breaking Changes" heading, or prose stating a breaking
   change) and judge whether it's actually relevant to this codebase's usage — cross-
   reference the callout's described change (a removed export, a changed function
   signature, a changed default) against the call sites found in step 10. A callout
   naming something this codebase never touches does not count as relevant.
9. Check CI status for the PR: `gh pr checks <number>` — classify as `failing`,
   `pending` (checks exist but haven't finished), or `passing` (no failing or pending
   checks).
10. Compute blast radius: count the distinct tracked files in the current repo that
    import or require this dependency — `git grep -lE "['\"]<dep>(/|['\"])" -- '*.js'
    '*.jsx' '*.ts' '*.tsx' '*.mjs' '*.cjs'`. Treat the count as **large** when it exceeds
    10 distinct files. Ten is the point past which reviewing every call site by hand
    stops being realistic inside an ordinary PR review — below it, a maintainer could
    still plausibly open every usage site directly and check it themselves if they chose
    to, so a clean changelog is enough to stand on its own; above it, the sheer count is
    itself the practical reason a bump needs a closer look, independent of what the
    changelog says. This applies identically whether the dependency sits in
    `dependencies` or `devDependencies` — placement is reported as context (step 14) but
    never changes the verdict.

## Computing the verdict, per dependency

11. Compute the bump size and the verdict together by running
    `node ${CLAUDE_SKILL_DIR}/scripts/compute-verdict-cli.js --old-version <old>
    --new-version <new> --changelog-found <true|false> --breaking-callout
    <true|false> --ci-status <passing|pending|failing> --blast-radius-large
    <true|false>`, using the facts gathered in steps 6–10 — classifying the bump size
    itself needs no configurable threshold, since semver already defines the
    patch/minor/major boundary, so it's folded into the same deterministic call rather
    than judged separately. **Execute this script directly for each dependency — it
    deterministically implements the decision table below, so the table must never be
    hand-recomputed or re-derived from the prose.** It prints `{ bumpSize, verdict,
    reason }` as JSON. The rules it implements:
    - **Hard-stops**, checked first — any one alone forces `blocked`, and skips baseline
      and escalation entirely for this dependency: an explicit breaking-change callout
      relevant to this codebase's actual usage (step 8); a failing CI check (step 9); a
      major bump with no changelog or release notes found anywhere (step 7).
    - **Baseline**, only reached when no hard-stop fired: patch or minor bump with a
      changelog found → `safe`; major bump with a changelog found and no relevant
      breaking-change callout → `needs-review`, regardless of blast radius (a major
      bump's baseline is never `safe` — the version jump alone is enough to warrant a
      human glance even on a clean changelog); patch or minor bump with no changelog
      found → `needs-review` (this can't honestly reach `safe` — `safe` means a
      changelog was actually read and found clean, not merely that no danger signal
      happened to fire — but it also doesn't fit the major-bump hard-stop, which is
      specifically about major bumps).
    - **Escalations**, applied to the baseline, each by exactly one tier: large blast
      radius (step 10); CI pending rather than passing (step 9). `blocked` is reached
      *only* via a hard-stop — no combination of baseline and escalations ever produces
      it, even when both escalations fire on the same dependency. This keeps a genuinely
      dangerous signal (a hard-stop) from ever being diluted by, or confused with, an
      accumulation of merely-cautious ones: `needs-review` is the ceiling anything but a
      hard-stop can reach.

## Rolling up a grouped PR

12. A PR grouping several dependencies gets a per-dependency verdict breakdown (steps
    6–11 run once per dependency) plus one overall rollup verdict, shown at the top of
    the comment, equal to the worst (most severe: `blocked` > `needs-review` > `safe`)
    verdict among its dependencies — so one risky dependency in an otherwise-boring
    bundle is never hidden behind the others.

## Writing the Agent brief

13. Only for a dependency (or PR, if ungrouped) whose final verdict is `blocked`: name
    the concrete call sites to inspect (the file list from step 10's blast-radius grep,
    not just a count), and point to the specific changelog or release-notes section that
    triggered the hard-stop. If the hard-stop was a failing CI check, name the specific
    failing check(s) instead of a changelog section. If the changelog links a migration
    or upgrade guide and its own text isn't enough to say what needs to change at each
    named call site, fetch that guide now — the one point in this skill's flow where
    reading a migration guide is in scope — and cite the specific section relevant to
    the flagged change. Never write an Agent brief for `needs-review` — that tier means
    a human should glance and decide, not that information is missing.

## Posting the comment

14. Compose one comment body per PR: an HTML-comment marker (`<!--
    renovate-triage:verdict -->`, used for the validation gate below and the idempotency
    check in step 16, never shown in the rendered comment) followed by the verdict (with
    the per-dependency breakdown from step 12 for a grouped PR), the one-line reason each
    tier or hard-stop fired, each dependency's `dependencies`/`devDependencies`
    placement as context, and the Agent brief section when step 13 produced one.
15. Before any comment write executes for this run, validate every composed body: run
    `node ${CLAUDE_SKILL_DIR}/scripts/validate-comment-body-cli.js <verdict>
    <body-file>` for each PR's body from step 14. **Execute this script directly for
    every PR in the batch before posting any of them — it is the machine-checkable gate
    for the whole run, not a manual double-check.** It confirms the verdict is one of
    the three valid tiers, the idempotency marker appears exactly once, and an Agent
    brief section is present if and only if the verdict is `blocked`. A PR whose body
    fails validation is skipped for posting — report it in step 17 alongside the reason
    validation gave, rather than letting a malformed comment reach a real PR — while
    every other PR in the batch still proceeds.
16. For every PR whose body passed step 15's validation: search the PR's existing
    comments for the marker: `gh api repos/<owner>/<repo>/issues/<number>/comments
    --jq '.[] | select(.body | contains("renovate-triage:verdict")) | .id'`. If a match
    exists, update it in place — `gh api -X PATCH
    repos/<owner>/<repo>/issues/comments/<id> -f body=@<file>` — rather than posting a
    second one. If no match exists, create it — `gh pr comment <number> --body-file
    <file>`. Invoking the skill is sufficient authorization to write or update every
    comment touched in the run; there is no separate per-PR confirmation prompt beyond
    step 15's validation gate.

## Reporting

17. Report in-session, in addition to the PR comments: every PR checked, its verdict (or
    per-dependency breakdown for a grouped PR), whether its comment was created or
    updated, every PR skipped for being out of ecosystem scope (step 5), and every PR
    skipped for failing step 15's validation gate — each with the reason why. On a
    no-target scan that found zero open Renovate PRs, this report is exactly the "no
    open Renovate PRs found" line from step 3 — never silence.

## Worked example

A synthetic scenario set, fabricated for this dry run and discarded afterward — never
committed, so a fixture PR can't be mistaken for a real one — covering each hard-stop,
baseline, and escalation individually, plus the grouped-PR rollup:

| # | Fixture | Bump | Changelog | CI | Blast radius | Verdict | Why |
|---|---|---|---|---|---|---|---|
| 1 | `widget-format` | major | none found | passing | 2 files | `blocked` | hard-stop: major, no changelog anywhere |
| 2 | `fake-http-client` | minor | found, states a removed default export used in this repo | passing | 4 files | `blocked` | hard-stop: relevant breaking-change callout |
| 3 | `collection-utils` | patch | found, clean | failing | 3 files | `blocked` | hard-stop: failing CI |
| 4 | `term-color` | patch | found, clean | passing | 3 files | `safe` | baseline: patch/minor + changelog |
| 5 | `date-helpers` | minor | found, clean | passing | 14 files | `needs-review` | baseline `safe`, escalated: blast radius > 10 |
| 6 | `ui-toolkit` | major | found, no breaking-change callout | passing | 6 files | `needs-review` | baseline: major + changelog, no callout |
| 7 | `lint-core` | minor | found, clean | pending | 5 files | `needs-review` | baseline `safe`, escalated: CI pending |
| 8 | grouped: `bundler-core` (major, no changelog, failing CI) + `bundler-cli` (patch, clean, passing) | — | — | — | — | overall `blocked` | rollup = worst of the two (`bundler-core`'s hard-stop) |

Fixture 1 alone already fires a hard-stop, so its `blocked` verdict holds regardless of
its small blast radius — confirming hard-stops short-circuit baseline/escalation
entirely (step 11). Fixture 5 shows the blast-radius escalation on its own pushing an
otherwise-clean minor bump from `safe` to `needs-review`, without touching `blocked` —
confirming the `needs-review` ceiling from step 11. Fixture 8's `bundler-cli` verdict
(`safe`) never appears at the top level; only the rollup does, per step 12.

**Comment idempotency**, checked against one real open Renovate PR on this repo at dry-
run time (a synthetic fixture is an equally valid substitute when none is open): the
first run found no comment containing the `renovate-triage:verdict` marker, so step 16
took the create branch (`gh pr comment`). Re-running the skill against the same PR with
no new commits found the marker in the existing comment and took the update branch (`gh
api -X PATCH`) instead — the PR ended the second run with exactly one `renovate-triage`
comment, not two.
