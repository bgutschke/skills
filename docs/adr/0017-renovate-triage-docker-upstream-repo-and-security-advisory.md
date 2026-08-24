# renovate-triage's docker adapter checks packaging and upstream repos, and reports security disclosures unconditionally

`renovate-triage`'s `docker` datasource adapter now supplements its existing
packaging-repo lookup (resolved from registry metadata, per `ADR 0015`) with a second,
upstream-repo lookup found by scanning the packaging repo's Dockerfile or version-pin
files at the target tag for an embedded GitHub release/tag/tarball URL pointing at a
different repository. The major-bump "no changelog found anywhere" hard-stop now
requires both tiers to come up empty, and a raw compare/diff view never counts as
"changelog found" at either tier. Any security disclosure surfaced while gathering that
evidence — an explicit CVE, a GHSA ID, a "Security" heading, or urgency/vulnerability
language — is now reported in its own comment section, unconditionally and without a
call-site cross-reference, since risk-of-merging and urgency-of-merging are different
axes and a security fix is usually low-risk and high-urgency at once.

This closes a gap found investigating a `redis` Docker image patch bump
(`8.10.0-alpine` → `8.10.1-alpine`). The adapter's changelog lookup resolved only the
packaging repository (`redis/docker-library-redis` — Dockerfile and build tooling), which
had no GitHub Releases and no `CHANGELOG.md`, so Renovate's own PR body fell back to a
raw compare/diff link touching only version-pin files. The actual upstream project,
`redis/redis`, had a full Release for the same version marked `Update urgency: SECURITY`,
fixing nine CVE-relevant issues including a remote-code-execution-capable bug — invisible
to the skill because it never looked at the repository that actually carried the
software's behavior.

**Considered and rejected:**

- **Treating the raw compare/diff link as a fallback "changelog found,"** since it's the
  only thing Renovate itself offers when a repo has neither Releases nor a `CHANGELOG.md`.
  Rejected because commit messages in a compare view aren't curated for user-facing
  disclosure — the `8.10.0...8.10.1` compare in the packaging repo touched only
  version-pin files and build tooling, with no signal at all that upstream had shipped a
  security release.
- **Cross-referencing a Security advisory against the codebase's call sites the same way
  an Opportunity is** — briefly written into `CONTEXT.md` as an untested extrapolation
  before being explicitly grilled. Rejected because Opportunity's cross-reference exists
  to cut noise on an informational finding, while a Security advisory exists to carry
  urgency; a heuristic call-site check can produce false negatives for a vulnerability in
  baseline behavior (the RDB-loading RCE applied regardless of which APIs a caller used),
  and silently dropping an urgent warning is a worse failure than one extra section on a
  PR that turns out not to touch the affected feature.
- **Gating the Security advisory's widened fetch the same way Opportunity's is gated**
  (`--no-opportunities`, minor/major bumps only). Rejected because the triggering case was
  itself a patch bump — the same gate that's reasonable for a discoverability feature
  would have reintroduced exactly the blind spot this decision closes.

## Consequences

- A future datasource adapter with a packaging/upstream split analogous to docker's must
  decide explicitly whether to add the same dual-repo lookup, rather than assuming
  single-repo resolution (`ADR 0015`) is universal — docker is the first case where it
  wasn't.
- Every adapter's evidence-gathering now does one more unconditional pass (security-
  disclosure detection) per PR regardless of bump size, on top of whatever changelog it
  already fetched for breaking-change and Opportunity detection. No new fetch is needed
  for the detection itself — it reads text already in hand — but the detection logic is
  now mandatory in every adapter, not opt-in the way Opportunity's is.
- A Security advisory section can appear on a `safe`-tier PR. This is intentional — see
  `CONTEXT.md`'s `Security advisory` entry — and must not be read as evidence the tiering
  logic is inconsistent.
