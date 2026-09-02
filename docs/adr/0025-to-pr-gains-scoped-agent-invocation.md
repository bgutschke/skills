# `to-pr` gains scoped agent invocation, revisiting ADR 0002

`to-pr` shipped with `disable-model-invocation: true`, invocable only by a human typing
`/to-pr`. [ADR 0002](0002-no-confirmation-for-to-pr-create-path-actions.md) justified
skipping a confirmation step on that path by the skill having exactly one user, and
explicitly flagged that a second user would mean revisiting the decision. We decided to
add that second user — an in-session subagent whose own given task already implies
landing its work as a PR (finishing worktree-based implementation work, for instance) —
by removing `disable-model-invocation: true` rather than by inventing a workaround.
Claude Code's invocation model has exactly two axes (`disable-model-invocation`,
`user-invocable`) plus a `paths` glob scope; there is no lever meaning "a subagent may
invoke this deliberately, but no session may ever fire it spontaneously." We accepted
that tradeoff instead of building one, and closed the gap with narrower scope on the
skill's own instructions rather than a mechanical gate: an agent-invoked run may only
open a new PR as a draft (never `--ready`) or fill in the description of a PR its own
task already opened, may never retarget a base branch or toggle ready/draft state on an
already-open PR, and must never fire from an unattended or background context. The
resulting PR's link must be surfaced prominently in whatever report reaches the human,
so nothing opened on their behalf goes untracked. ADR 0002's no-confirmation stance still
holds under this second user, but for a different reason than before: it no longer holds
because there is only one user to surprise, but because the guardrails above substitute
for confirmation — the guardrails already restrict this path to an in-session subagent,
so a human is already watching its work unfold and sees the required report regardless of
any prompt, and adding one there would add friction without adding safety the guardrails
don't already provide.

## Consequences

- The trust model shifted from "there is only one user, so nothing needs confirming" to
  "the calling context is trusted to respect documented scope," the same soft-governance
  basis this skill already used for its "confirm with the user before touching it" rule
  around content written outside a target template's own structure. A future skill
  reaching for agent invocation should expect the same tradeoff, not a stronger
  guarantee.
- None of this is mechanically enforced. A subagent that ignores the guardrails and
  passes `--ready` or `--base`, or fires from a background context, will not be stopped
  by anything in `to-pr` itself. Catching that is a review-time concern, not a runtime
  one.
- If Claude Code's invocation model ever grows a lever distinguishing deliberate
  subagent invocation from spontaneous auto-fire, this decision should be revisited
  again — the prose guardrails would become a fallback rather than the only mechanism.
- The create path's lack of a confirmation step, human or agent, remains a single
  decision covering both callers. Splitting it — for instance requiring confirmation only
  for the agent path — would be a new decision, not an extension of this one.
