# renovate-triage worked example

A synthetic scenario set, fabricated for this dry run and discarded afterward — never
committed, so a fixture PR can't be mistaken for a real one — covering each hard-stop,
baseline, and escalation individually, the grouped-PR rollup, one fixture per
datasource, each Opportunity-scan shape, the docker adapter's dual-repo lookup, the
docker adapter's OCI-label and PR-body-fallback tiers, and the Security advisory scan.
Step numbers below refer to `SKILL.md`.

## Contents

1. [Fixture table](#fixture-table)
2. [Walkthrough](#walkthrough)
3. [Comment idempotency](#comment-idempotency)

## Fixture table

| # | Fixture | Datasource | Bump | Changelog | CI | Blast radius | Verdict | Opportunity | Security advisory | Why |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `widget-format` | npm | major | none found | passing | 2 files | `blocked` | — | — | hard-stop: major, no changelog anywhere |
| 2 | `fake-http-client` | npm | minor | found, states a removed default export used in this repo | passing | 4 files | `blocked` | — | — | hard-stop: relevant breaking-change callout |
| 3 | `collection-utils` | npm | patch | found, clean | failing | 3 files | `blocked` | — | — | hard-stop: failing CI |
| 4 | `term-color` | npm | patch | found, clean | passing | 3 files | `safe` | — | — | baseline: patch/minor + changelog |
| 5 | `date-helpers` | npm | minor | found, clean | passing | 14 files | `needs-review` | — | — | baseline `safe`, escalated: blast radius > 10 |
| 6 | `ui-toolkit` | npm | major | found, no breaking-change callout | passing | 6 files | `needs-review` | — | — | baseline: major + changelog, no callout |
| 7 | `lint-core` | npm | minor | found, clean | pending | 5 files | `needs-review` | — | — | baseline `safe`, escalated: CI pending |
| 8 | grouped: `bundler-core` (major, no changelog, failing CI) + `bundler-cli` (patch, clean, passing) | npm | — | — | — | — | overall `blocked` | — | — | rollup = worst of the two (`bundler-core`'s hard-stop) |
| 9 | `ghcr.io/example-org/sample-image` | docker | minor tag bump | found via GHCR org linkage, clean | passing | 2 files | `safe` | — | — | docker adapter: registry-linked changelog, baseline patch/minor |
| 10 | `sample-transform-lib` | pypi | major | found via `project_urls.Source`, no breaking-change callout | passing | 5 files | `needs-review` | — | — | pypi adapter: baseline major + changelog, no callout |
| 11 | `example.sample_collection` | ansible-galaxy | patch | found via Galaxy `repository` field, clean | passing | 1 file | `safe` | — | — | ansible-galaxy adapter: baseline patch/minor + changelog |
| 12 | `legacy-widget` | docker | `latest` → `stable` (non-semver) | found, clean | passing | 3 files | `needs-review` | — | — | baseline: indeterminate bump size defaults to needs-review |
| 13 | `stream-utils` | npm | minor | found across full range, clean, one release adds `batchWithConcurrency()` | passing | 3 files | `safe` | **new capability**: `batchWithConcurrency()` — relevant, this repo's call sites already hand-roll the same batching it replaces | — | baseline: patch/minor + changelog; Opportunity found and relevant |
| 14 | `legacy-cache` | npm | major | found across full range, no breaking-change callout, one release deprecates `.get()` in favor of `.fetch()` | passing | 4 files | `needs-review` | **deprecation**: `LegacyCache.get()` — relevant, this repo's call sites still call `.get()` | — | baseline: major + changelog, no callout; Opportunity found and relevant |
| 15 | `chart-render` | npm | minor | found across full range, clean, one release adds `exportToPDF()` | passing | 2 files | `safe` | none reported — `exportToPDF()` found but filtered out, this repo's call sites never touch PDF export | — | baseline: patch/minor + changelog; Opportunity found but irrelevant, so omitted |
| 16 | grouped: `api-client` (minor, adds `retryPolicy` option) + `api-server-utils` (minor, deprecates `parseLegacyHeaders()`) | npm | — | — | — | — | overall `needs-review` | per-dependency: `api-client` **new capability** (relevant), `api-server-utils` **deprecation** (relevant) | — | rollup verdict as usual; Opportunities get one subsection per dependency, same shape as the verdict breakdown |
| 17 | `sample-cache` | docker | patch (`8.10.0-alpine` → `8.10.1-alpine`) | packaging repo: no Releases, no `CHANGELOG.md`; upstream repo found via `extract-upstream-repo` (embedded release URL in the Dockerfile), its changelog clean of breaking changes | passing | 2 files | `safe` | — (patch bump, Opportunity scan doesn't run) | **found**: upstream release text carries `Update urgency: SECURITY` and two CVE identifiers | docker dual-repo: packaging tier empty, upstream tier's changelog found (clean) → baseline `safe`; Security advisory found in the upstream tier, reported independent of tier and verdict |
| 18 | `sample-webapp` | docker | minor | packaging repo changelog found, clean; upstream extraction result `none` — no embedded GitHub URL in the Dockerfile or version-pin files | passing | 3 files | `safe` | — | — | docker adapter: no upstream candidate found, adapter stays packaging-repository-only rather than guessing; baseline unaffected |
| 19 | `sample-parser` | npm | patch | found, clean of breaking changes, but one release's notes name a GHSA ID | passing | 2 files | `safe` | — (patch bump, Opportunity scan doesn't run) | **found**: GHSA ID in the full old→new range | npm adapter: the full range is fetched unconditionally even at a patch bump, since the Security advisory scan needs it regardless of what Opportunity would ever read; advisory found and reported independent of the `safe` verdict |
| 20 | `sample-toolkit` | docker | major | packaging repo: no changelog; upstream repo found via extraction, but its own GitHub-Releases-then-`CHANGELOG.md` lookup is also empty — no changelog found anywhere at either tier | passing | 4 files | `blocked` | — | — | hard-stop: major bump, no changelog found at either the packaging or the upstream tier; Agent brief names both `owner/repo`s already checked |
| 21 | `sample-agent` | docker | minor | registry field (GHCR linkage) empty; resolved via the image's own `org.opencontainers.image.source` OCI label alone, clean | passing | 2 files | `safe` | — | — | docker adapter: OCI-label tier resolves the packaging repo when the existing registry field is empty |
| 22 | `sample-legacy-image` | docker | patch | OCI labels absent (`none` from both `.source` and `.url`); resolved via the existing GHCR linked-repository field instead, clean | passing | 1 file | `safe` | — | — | docker adapter, no-regression check: OCI-label tier falls through cleanly to the existing registry field when labels are absent |
| 23 | `sample-vpn-agent` | docker | minor | OCI labels absent, Docker Hub `source_url` empty, upstream extraction `none`; Renovate's own PR-body Release Notes section (Features/Bug Fixes/Maintenance, itemized) resolves `found` via the PR-body fallback | passing | 1 file | `safe` | — | — | docker adapter: PR-body fallback resolves "changelog found" once every registry-level lookup for this datasource comes up empty |
| 24 | `sample-abandoned-image` | docker | major | OCI labels absent, registry field empty, upstream extraction `none`; PR body's Release Notes section for this dependency is only a bare Compare Source link (`compare-link-only`) — no changelog found anywhere | passing | 3 files | `blocked` | — | — | hard-stop: major bump, no changelog found anywhere — the PR-body fallback's bare compare-link doesn't satisfy "changelog found," since a compare view's commit messages aren't curated for user-facing disclosure the way release notes are |
| 25 | `sample-parser-lib` | npm | minor | the dependency's repository (resolved from npm registry metadata) has neither GitHub Releases nor a `CHANGELOG.md`; Renovate's PR-body Release Notes section resolves `found` via the universal fallback | passing | 2 files | `safe` | — | — | npm adapter: the PR-body fallback applies outside docker too, once npm's own registry-metadata lookup comes up empty |
| 26 | grouped: `widget-alpha` (PR-body fallback resolves `found`, its own GitHub-Releases/`CHANGELOG.md` lookup empty) + `widget-beta` (own GitHub-Releases lookup already resolves; PR-body fallback never consulted) | npm | — | — | — | — | overall `safe` | — | — | grouped PR: per-dependency PR-body extraction stays scoped to each dependency's own section — `widget-alpha`'s fallback content never bleeds into `widget-beta`'s, nor is `widget-beta`'s richer lookup ever overridden by the fallback |

## Walkthrough

Fixture 1 alone already fires a hard-stop, so its `blocked` verdict holds regardless of
its small blast radius — confirming hard-stops short-circuit baseline/escalation
entirely (step 17). Fixture 5 shows the blast-radius escalation on its own pushing an
otherwise-clean minor bump from `safe` to `needs-review`, without touching `blocked` —
confirming the `needs-review` ceiling from step 17. Fixture 8's `bundler-cli` verdict
(`safe`) never appears at the top level; only the rollup does, per step 18. Fixtures
9–11 confirm the same hard-stop/baseline/escalation logic produces identical shapes of
verdict regardless of which adapter gathered the evidence — only *where* the changelog
and blast-radius facts come from differs by datasource, never how they're judged.
Fixture 12 confirms an indeterminate bump size defaults to `needs-review` on its own,
without needing a missing changelog or any other signal to fire.

Fixtures 13–16 confirm the Opportunity scan (step 16) never touches the verdict
alongside it: fixture 13's `safe` verdict and its new-capability finding are both
present in the same comment, computed independently; fixture 14's deprecation finding
sits next to a `needs-review` verdict without pushing it toward `blocked` — only a
relevant breaking-change callout, a failing CI check, or a major bump with no changelog
can do that (step 17), and a deprecation notice is none of those. Fixture 15 confirms
the call-site relevance filter actually filters — a real capability change that this
repo's code never touches produces no Opportunities section at all, not a low-priority
mention. Fixture 16 confirms the per-dependency Opportunities subsection shape from
step 18: each dependency in the group gets its own finding, exactly like the verdict
breakdown, without either the group producing a single merged list or one dependency's
finding leaking into the other's subsection.

Fixtures 17–20 confirm the docker adapter's dual-repo lookup and the Security advisory
scan each behave as designed. Fixture 17 confirms a packaging repository with nothing
to find doesn't end the lookup, since the upstream tier still resolves a clean
changelog carrying an unrelated security disclosure — the `safe` verdict (patch bump,
changelog found) and the Security advisory finding coexist in the same comment,
computed independently, exactly as step 15 requires. Fixture 18 confirms the
extraction never guesses when it finds nothing: a `none` result leaves the docker
adapter with only the packaging tier's own evidence, never a guessed second
repository. Fixture 19 confirms the Security advisory scan's
unconditional wide-fetch (step 11) runs at a bump size — patch — the Opportunity scan
(step 16) would never read on its own, so a disclosure hiding in a skipped intermediate
version is never missed just because the overall bump was small. Fixture 20 confirms
the major-bump/no-changelog hard-stop still fires when both docker tiers come back
empty, and that its Agent brief (step 19) names both repositories already checked by
`owner/repo`, so a follow-up agent doesn't re-derive the dual-repo resolution from
scratch.

Fixtures 21–26 confirm the docker adapter's OCI-label lead and the universal PR-body
fallback each behave as designed. Fixture 21 confirms the OCI-label tier resolves a
packaging repository on its own when the existing registry field is empty. Fixture 22 is
the no-regression check: with OCI labels absent, resolution falls through cleanly to the
existing registry field, exactly as it did before this work. Fixture 23 confirms the
PR-body fallback: every registry-level lookup for the datasource comes up empty, but the
PR body's own genuine itemized content still resolves "changelog found," so the bump
doesn't fall through to "no changelog found anywhere" just because no registry-level
source was found. Fixture 24 confirms the fallback's evidence bar holds: a bare
compare-link in the PR body's own Release Notes section is `compare-link-only`, not
`found`, so the major-bump hard-stop still fires — a compare view's commit messages
aren't curated for user-facing disclosure the way genuine release notes are, at this tier
exactly as at every other. Fixture 25 confirms the fallback isn't docker-specific — it
resolves "changelog found" for an npm dependency once npm's own registry-metadata lookup
comes up empty. Fixture 26 confirms per-dependency scoping on a grouped PR: one
dependency's genuine PR-body content is read only from its own section, never blended
with or substituted for the other dependency's already-successful registry-metadata
lookup.

## Comment idempotency

Checked against one real open Renovate PR on this repo at dry-run time (a synthetic
fixture is an equally valid substitute when none is open): the
first run found no comment containing the `renovate-triage:verdict` marker, so step 22
took the create branch (`gh pr comment`). Re-running the skill against the same PR with
no new commits found the marker in the existing comment and took the update branch (`gh
api -X PATCH`) instead — the PR ended the second run with exactly one `renovate-triage`
comment, not two.
