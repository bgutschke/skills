# renovate-triage's sub-agent orchestration stops at the PR boundary

A full scan (no explicit PR target) dispatches one sub-agent per open Renovate PR, run in
parallel via the Agent tool; each sub-agent independently executes the complete flow —
datasource resolution through comment posting — for its own PR. An explicit single-PR
target runs inline, with no sub-agent spawned. Orchestration granularity never goes finer
than one PR per sub-agent: a datasource adapter's evidence-gathering, even across several
dependencies grouped into one PR, is never split into its own sub-agent.

**Considered and rejected:**

- **Dependency- or adapter-level sub-agents** (one sub-agent per dependency, or per
  adapter invocation, within a single PR). Rejected because a PR posts exactly one
  comment with one rollup verdict — splitting evidence-gathering below the PR level
  would require re-assembling that rollup from multiple sub-agent results for no
  benefit, adding coordination overhead around an otherwise deterministic, self-
  contained flow.
- **Sequential (non-parallel) PR processing.** Rejected because PRs are already
  self-contained triage units — own rollup, own comment, own idempotency marker — so no
  cross-PR coordination is needed, and processing them one at a time would make a scan
  across a large open-PR queue take proportionally longer for no benefit.

## Consequences

- A future signal needing cross-PR context (e.g. a scan-wide count of `blocked` PRs)
  requires an aggregation step over the sub-agents' results after they return, not an
  expansion of an individual sub-agent's own scope.
- A future fifth datasource adapter must fit inside the existing per-PR sub-agent flow —
  it must not introduce its own sub-agent layer underneath a PR's.
