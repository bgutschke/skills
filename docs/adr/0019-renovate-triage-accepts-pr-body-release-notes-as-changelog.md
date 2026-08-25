# renovate-triage's docker adapter gains OCI image labels and PR-body release notes as changelog-resolution leads

Docker Hub's REST API `source`/`source_url` field — the packaging-repository signal `ADR
0015` originally relied on for non-GHCR images — is empty for ordinary Docker Hub images
in practice, not just edge cases (confirmed empty for both `adinhodovic/tailscale-exporter`
and `prom/node-exporter`, an unrelated image checked as a sanity check). It's a relic of
Docker Hub's old "automated builds" linking feature, not a currently-maintained signal.
When it comes up empty and no GHCR linkage or Dockerfile-embedded upstream URL applies
either, the adapter reported "no changelog found anywhere" even on PRs where the real
source was trivially resolvable.

The docker adapter's packaging-repository resolution now checks, in order:

1. **The image manifest's own OCI config labels** (`org.opencontainers.image.source`,
   then `.url`) — fetched directly from the registry API (anonymous token → manifest →
   platform-specific manifest → config blob → `Labels`), applicable regardless of which
   registry hosts the image. This is genuine registry-published, self-declared metadata —
   squarely within `ADR 0015`'s "authoritative metadata only" principle, not a revision of
   it. Verified against two unrelated images, one of which (`prom/node-exporter` →
   `prometheus/node_exporter`) diverges from its image name on both org and spelling —
   exactly the case a name-based guess would get wrong, and the OCI label gets right
   because it isn't guessing.
2. **The existing registry field** (GHCR's linked-repository field, or Docker Hub's
   `source_url`) — kept as a cheap secondary check, since it's occasionally still
   populated and costs nothing extra to try.
3. **Renovate's own PR-body Release Notes section**, read from data the flow already has
   in hand (`gh pr view --json body`), *provided it's genuine release-notes content*
   (itemized entries sourced from the dependency's actual GitHub Releases) rather than a
   bare compare/diff link — the latter is exactly the case `ADR 0017`'s `redis` incident
   already excludes, since a compare view's commit messages aren't curated for user-facing
   disclosure. This is the same underlying evidence the adapter's own GitHub-Releases
   lookup would have found, just already fetched by Renovate, so it likewise isn't the
   name-based guessing `ADR 0015` rejected.

This PR-body tier applies across all four datasource adapters, not just docker, since
Renovate renders this section for any datasource it resolves a source for — the OCI-label
tier is docker-specific, since only that datasource has image manifests. In every adapter,
the PR-body tier is the last one tried, after whatever registry-metadata lookup that
datasource already has, for the same reason it's checked last for docker: it's a
free-to-read fallback, not a replacement for a datasource's own richer registry lookup
when that lookup succeeds. It also only satisfies the "changelog found" check — the full
old→new range the Security advisory and Opportunity scans require still comes from each
adapter's own range-fetch, since the PR body isn't guaranteed to enumerate every
intermediate version for a wide bump.

**Considered and rejected:**

- **A name-based guess as a bounded, clearly-labeled last resort**, reached only when OCI
  labels, the existing registry field, and PR-body content all come up empty. Rejected
  because the OCI-label tier already covers the exact case guessing was meant to catch —
  and covers it *correctly* even where a guess would fail (`prom/node-exporter`). With that
  gap closed, the residual "nothing resolves at all" case should be rare enough that an
  honest "no changelog found" stays preferable to reintroducing the risk `ADR 0015` was
  written to avoid: a wrong guess silently feeding the major-bump hard-stop.
- **Trusting PR-body content for the Security/Opportunity scans too**, not just the
  "changelog found" check. Rejected because Renovate truncates very large changelogs, so
  the PR body can't be assumed to carry every release in a wide range the way a direct
  GitHub-Releases-range fetch can.
- **Restricting OCI-label reading to Docker Hub images only**, leaving GHCR's existing
  lookup untouched and separate. Rejected as arbitrary — the label is read identically
  from any registry's manifest, so it can serve as a cross-check on GHCR too, not just a
  Docker-Hub-specific patch.

## Consequences

- A docker PR whose only resolvable evidence is its image's own OCI labels or its PR
  body's genuine release notes now gets a baseline computed from that content, instead of
  falling through to "no changelog found anywhere" — but only when that content is
  genuine, not a compare/diff fallback or an absent/empty label.
- This closes a gap found on PR #197 in `bgutschke/raspberry-pi-ansible`
  (`adinhodovic/tailscale-exporter` `0.6.1` → `0.7.0`), whose posted comment stated "no
  changelog found" despite both the image's own OCI label and the PR body itself naming
  the real source.
- A future datasource adapter that wraps an OCI-image-like artifact should check for an
  equivalent self-declared source label before assuming a single registry-metadata field
  is the only lead available, the way this decision found for docker.
