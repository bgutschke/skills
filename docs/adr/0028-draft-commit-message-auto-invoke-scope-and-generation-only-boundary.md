# `draft-commit-message` widens its trigger but keeps a hard generation-only boundary

The original slash command (`/commit-msg`) was manual-only and generation-only by design:
it never ran `git commit`, on the stated principle that committing is a separate,
explicit user request. Moving it to an auto-invocable skill reopens both questions,
because Claude Code already has its own default behavior for a plain "commit this" —
status/diff/log, draft a message, stage, commit — described in the harness's own system
prompt rather than anything in this repo. An auto-invocable `draft-commit-message` now
competes with that default on the same trigger.

We decided to widen the trigger to cover both an explicit "write/draft a commit message"
ask and the message-drafting step inside a plain "commit this" ask, so the
convention-aware logic (see ADR 0027) actually gets used in the common case — a
narrow, explicit-phrasing-only trigger would have made auto-invocation barely different
from typing the old command by hand. We kept the *Generation-only boundary* absolute
across both triggers: the skill only ever returns message text, never runs `git add` or
`git commit` itself, regardless of which way it fired. Staging and committing remain
either the harness's own default flow or a separate explicit ask, unchanged.

## Consequences

- A future contributor seeing `draft-commit-message` fire on a plain "commit this" should not read
  that as the skill taking over committing too — the two are deliberately decoupled, and
  collapsing them into one action was considered and rejected.
- If the harness's own default commit-message drafting changes shape later, this skill's
  trigger scope should be revisited deliberately rather than left to drift — the premise
  is that this skill's convention-aware drafting is strictly better than the generic
  default for the message-drafting sub-step, not that it should also absorb the rest of
  that flow.
- No jurisdiction entry for this exists in the user's personal `ROUTING.md` (outside this
  repo) yet; that file is where a future conflict between this skill and the harness
  default, or another commit-drafting tool, would need to be adjudicated.
