# `to-pr` delegates diff/log reading to a subagent

`to-pr`'s "Composing the body" step grounds three template blanks — What changed, Testing,
and Why's ticket-reasoning fallback — in the same `git log`/`git diff` data, and a real
diff can be arbitrarily large. We decided `to-pr` delegates *only* that diff/log-reading
step to a subagent via the `Agent` tool, making it the first skill in this repo to
instruct itself to call `Agent` internally. Every other step (template fetch, documented-
convention lookup, merge-commit check, inferred-title-tier `gh pr list`) stays a direct
tool call, per the user's own personal `ROUTING.md` doctrine that single-fact lookups are
Read/Grep/Explore territory, not `Agent` territory — the diff/log step is the one
exception because, unlike those bounded lookups, it has no upper bound on size. The
saving this buys is context isolation (the raw diff lives in the subagent's context; only
condensed evidence returns to the parent), not a cheaper model — model tier is a separate
lever we deliberately didn't pull yet. The subagent returns template-agnostic structured
evidence (change summary, testing evidence, commit messages, ticket references) rather
than fields shaped like this repo's own template headings, since `to-pr` runs against
arbitrary target-repo templates it has never seen; the parent still owns mapping that
evidence onto whatever blanks the actual template defines. It runs on the session's own
model rather than Haiku, because the "never invent" grounding constraint that recurs
throughout `to-pr`'s `SKILL.md` is a nuanced judgment call (did the diff add a test, or
merely touch one?) where a weaker model's mistake fails silently into a merged PR
description. We also considered routing this to a non-Anthropic model (OpenAI, Gemini)
for further savings, but the `Agent` tool's model override is restricted to Anthropic's
own tiers and no connected MCP server bridges another provider — doing this for real
would mean a separate integration (its own API keys, its own billing, none of `Agent`'s
built-in isolation) that the stated goal didn't justify.

## Consequences

- This is a precedent, not a general license: a future skill reaching for this same
  pattern should clear the same bar — unbounded-size data behind an otherwise-bounded
  step — not just "this would save some tokens."
- Nothing here rules out moving the subagent to Haiku later; it's an explicit rejection
  of doing so *now*, before the evidence contract has been proven against real diffs. A
  later change should treat that as a considered, reversible follow-up, not a bug fix.
- The subagent's evidence categories (change summary, testing evidence, commits, ticket
  references) are the seam the parent's template-mapping logic depends on. Extending them
  to carry template-shaped fields instead would reintroduce the single-template coupling
  this decision explicitly avoided.
- The parent still runs `git diff --stat` itself even though the full diff is delegated
  away — a deliberate, cheap cross-check against the subagent's report, not leftover
  code. Dropping it should be a deliberate choice made with that context, not silent
  drift during a later cleanup.
- Cross-provider model support for this subagent (or any other) isn't available through
  Claude Code's `Agent` tool today; revisiting it means evaluating a separate integration,
  not flipping a config value.
