# renovate-triage's datasource adapters key off authoritative registry metadata only

Each datasource adapter (docker, pypi, ansible-galaxy — mirroring npm's existing flow)
resolves a dependency's changelog source only from metadata the registry itself publishes
about that specific package, image, or collection — a GHCR image's linked repository, a
Docker Hub `source_url` field, a PyPI `project_urls` entry, a Galaxy collection's
declared `repository` field — never by guessing a plausible-looking repository from the
dependency's own name. No such metadata found reports as "no changelog found," the same
empty case npm's adapter already has, never a guessed fallback.

**Considered and rejected:**

- **Name-based guessing** (e.g. assuming `pihole/pihole`'s source lives at
  `github.com/pihole/pihole`). Rejected because it can attribute evidence to the wrong
  project without any signal that it happened — `pihole/pihole`'s actual source is
  `pi-hole/docker-pi-hole`, a differently-named repository, so a name-matched guess would
  silently read someone else's changelog. That risk is decisive specifically because a
  `blocked` verdict's major-bump-with-no-changelog hard-stop must stay trustworthy: a
  guessed changelog that happens to look clean would suppress a hard-stop that should
  have fired.

## Consequences

- A dependency an adapter can't find authoritative metadata for is reported identically
  to npm's existing empty-changelog case — never flagged as a lower-confidence result,
  since there is no partial result to distinguish it from.
- A future fifth adapter must identify which registry field is authoritative for that
  datasource before being built. Falling back to a name-matched guess when no such field
  exists is disqualified by the same reasoning as the rejected alternative above, not a
  case-by-case judgment call.
