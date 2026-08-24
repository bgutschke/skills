# renovate-triage's Opportunity scan is default-on, with a `--no-opportunities` opt-out

`renovate-triage` scans a minor or major bump's full changelog range for relevant
*Opportunities* — a newly-added capability, or one the dependency now deprecates —
whenever `renovate-triage` runs, unless the caller passes `--no-opportunities`. Three
shapes were considered: opt-in (off unless asked), default-on with an opt-out flag (the
choice made), and unconditionally always-on with no flag at all.

Opt-in was the instinctive first choice: Opportunity scanning is a fuzzy, LLM-judged
pass layered onto a Risk verdict whose entire design center (`ADR 0012`) is a fixed,
auditable rule list precisely so every result traces to one named reason. Bolting a
speculative judgment call onto that by default risked diluting the trust a deterministic
verdict is built to earn. But two facts undercut that instinct once examined. First, the
scope is already narrow — Opportunity scanning only fires on minor/major bumps (patch
and indeterminate bumps are excluded), so it doesn't run on the majority of Renovate
traffic in most repos. Second, the marginal cost is small: the changelog text an
Opportunity needs is already fetched during evidence-gathering (for breaking-change
detection), so the new work is one more read-and-filter pass over data already in hand,
not a new fetch. Against that, opt-in has a real cost of its own — a flag nobody knows
to type is a feature nobody benefits from, and the whole point of surfacing Opportunities
is that a maintainer wouldn't have gone looking for them on their own.

Unconditional always-on (no flag in either direction) was rejected too: it forecloses
ever making the behavior optional later without a breaking change to the skill's
contract, and permanently welds Opportunity-scan cost to every future verdict-only run,
even for someone who never wants to see that section.

**Considered and rejected:**

- **Opt-in flag** (`--opportunities`, off unless asked). Rejected because a feature
  gated behind a flag nobody knows exists is a feature nobody uses — undiscovered value
  is no better than no value, and the actual per-run cost turned out to be small once
  the changelog-reuse fact was accounted for.
- **Unconditionally always-on, no flag either way.** Rejected because it removes the
  escape hatch entirely — anyone who finds the section noisy, or who runs
  `renovate-triage` in a context where only the verdict matters, has no way to suppress
  it without a future breaking change to add one.

## Consequences

- Every `renovate-triage` run now does Opportunity-scan work for each minor/major-bump
  dependency unless `--no-opportunities` is passed — callers who only want the Risk
  verdict, and who run the skill in a scripted or high-frequency context, need to know
  to pass the flag if that per-run cost matters to them.
- Because the section is default-on, its noise budget is tighter than an opt-in feature
  would need: an empty result must produce no output at all (no "no opportunities found"
  line), and every reported item must survive the same call-site relevance filter that
  keeps the Risk verdict's breaking-change detection from being a raw changelog dump —
  see `CONTEXT.md`'s `Opportunity` entry.
- If Opportunity-scan cost or noise later proves to outweigh its default-on discoverability
  benefit, flipping the default requires revisiting this ADR explicitly, not a silent
  behavior change — the trade-off recorded here (discoverability vs. verdict-trust
  dilution) is what should be re-weighed, not just the polarity of the flag.
