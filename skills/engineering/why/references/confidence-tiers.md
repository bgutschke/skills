# Confidence tiers

Every claim in a `why` reply carries exactly one confidence tier. The tier decides the
words the claim can use and the reply section it goes in. The tiers are hard stops, not a
scale. Never give a claim a score or a percentage.

## The five tiers

| Tier | What the evidence is | Reply section |
| --- | --- | --- |
| Direct | A person wrote the why down in plain words: a commit body, a pull request body, a review comment, a code comment. | What we found |
| Supported | Two or more indirect pieces of evidence point at the same why, and none of them states it outright. | What we found |
| Inferred | One reading of the context. The evidence fits the claim, but it fits other claims too. | What we can reasonably infer |
| Speculative | A guess with thin evidence: one weak hint, or a common pattern elsewhere. | Competing hypotheses |
| Unknown | A search ran and found nothing on this point. | What we don't know |

## Phrasing per tier

- **Direct.** State the why as a fact and quote the source. Causal words such as
  "because", "was designed to", and "the reason was" are allowed. Example: "The limit is
  100 because the upstream API rejects larger pages ([#41](link): 'the vendor caps
  `pageSize` at 100')."
- **Supported.** State the why as a fact, name every piece of evidence, and show how the
  pieces converge. Causal words are allowed. Example: "The retry exists because of
  timeouts in the payment service. Commit `a1b2c3d` adds it the day after commit
  `d4e5f6a` raises the client timeout, and the review on [#52](link) mentions 'flaky
  checkouts'."
- **Inferred.** Hedge the claim and give the reasoning chain. Use "appears to", "is
  consistent with", or "suggests". Never use "because" or "was designed to". Example: "The
  null guard appears to protect the legacy import path. It landed in the same commit that
  added that import, but the commit body says nothing about it."
- **Speculative.** Mark the claim as a guess and name the evidence that can settle it.
  Example: "One possibility is a workaround for an old browser bug. No source mentions
  this. A ticket from that release can settle it."
- **Unknown.** Name the search and say that it found nothing. Never fill the gap with a
  plausible story. Example: "We searched the commit bodies and the review comments on
  [#41](link) for the constant `100` and found no rationale."

## Rules across all tiers

1. **Code is never evidence of its own intent.** The code shows what it does. It never
   shows why. "The function clamps to 100, so it was designed to cap the page" is not a
   finding. A code comment counts as evidence, because a person wrote it, but the code
   around it does not.
2. **A hypothesis in the question is one candidate.** When the user asks "is this here
   because of X?", X goes through the same tiers as every other candidate. Agreement with
   the user is not evidence.
3. **An absence is a gap.** A search that found nothing goes under What we don't know. It
   never turns into a story.
4. **Disagreement shows both sides.** When two sources disagree, show both, each with its
   citation and tier. The pair goes in the section of the higher tier of the two. Do not
   pick the tidier one. If the dates show it, say which one is newer.
5. **Every Direct and Supported claim has a citation the user can open.** A commit hash, a
   pull request link, a review comment link, or a file path with a line number.

## Confidence summary

The reply ends with one or two sentences that state the overall certainty. Name the
highest tier any claim on the main question reached. Example: "Confidence: Direct for the
limit itself, Unknown for why it was never raised."

## Credit

The five tiers, the phrasing rules, and the fixed reply structure in `SKILL.md` come from the `why`
skill in the pstack plugin for Cursor by Lauren Tan, MIT licensed:
<https://github.com/cursor/plugins/tree/23e4138daa01c42d4969f7a5465f82704e64f798/pstack/skills/why>.
This file restates them in its own words.
