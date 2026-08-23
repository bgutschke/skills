# No confirmation for /to-pr's push, retarget, and draft-toggle actions

`/to-pr` pushes the current branch, retargets a PR's base, and toggles its draft state
without asking for confirmation first — a deliberate deviation from this repo's usual
guidance to confirm before actions that touch shared state. The invocation itself is the
authorization: typing `/to-pr --base release` already states the intent to retarget, and
a second prompt to confirm the same intent would add friction without adding safety.
This holds because the skill currently has exactly one user (its author), so there's no
one else who could be surprised by an action they didn't ask for.

## Consequences

- If this skill gains a second user, this decision should be revisited — a shared tool
  acting on shared branches without confirmation is a different risk profile than a
  personal one is.
- The update path's separate "don't rewrite real content written in a different
  structure" guardrail is unrelated to this decision and still applies: that guardrail
  protects against silently overwriting content the skill can't verify, not against
  taking an action without confirmation.
