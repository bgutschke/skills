# renovate-triage resolves a file's datasource from renovate.json, never from its name

`renovate-triage` resolves each changed file's datasource by parsing the target repo's
own `renovate.json` — built-in managers' default file patterns, plus each
`customManagers[]` entry's `managerFilePatterns` paired with its `datasourceTemplate` —
rather than inferring it from the file's own name or extension. This became necessary
once a `customManagers` regex could point any file at any datasource: in
`bgutschke/raspberry-pi-ansible`, ten custom regex managers bump Docker image tags and
PyPI packages embedded inside ordinary YAML files, which a filename heuristic has no way
to see. `extends` preset chains are never fetched or resolved, so a datasource only
reachable through one resolves to `unknown` rather than guessed.

**Considered and rejected:**

- **The original filename/extension heuristic.** Rejected because it silently produced
  zero verdicts for exactly the repos this change was built for — any file outside a
  small hardcoded list was reported as out of scope, regardless of what Renovate
  actually did to produce the PR.
- **Fetching and resolving `extends` chains** to find datasources declared only in an
  inherited preset. Rejected for this pass as materially more scope (an external network
  fetch and a preset-merge algorithm) for a case handled safely by staying `unknown`
  rather than by guessing.

## Consequences

- Adding a future datasource adapter needs no filename heuristic to update — it only
  needs the target repo's own `renovate.json` to already declare that datasource,
  whether through a built-in manager or a `customManagers` entry.
- A repo whose `renovate.json` isn't found (root or `.github/`) or fails to parse as JSON
  reports as `detection-unavailable`, never a silently wrong resolution.
