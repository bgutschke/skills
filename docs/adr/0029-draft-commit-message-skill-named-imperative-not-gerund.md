# The new commit-message skill is named `draft-commit-message`, not gerund form

`docs/skill-writing-best-practices.md` documents Anthropic's own recommendation for skill
names: gerund form (`processing-pdfs`, `analyzing-spreadsheets`), with imperative
(`process-pdfs`) or noun-phrase forms merely "acceptable alternatives." Taken at face
value, the skill being moved from the personal `/commit-msg` command should have been
named `drafting-commit-messages`.

We named it `draft-commit-message` instead. The three most recently shipped skills in
this repo — `audit-rules`, `curate-memory`, `refactor-rule-tree` — are all imperative
verb-noun, not gerund; no ADR records that as a deliberate choice, but it's the
collection's real pattern today regardless. The best-practices doc itself subordinates
its own form preference to a stronger rule: "pick one naming pattern and hold it across a
whole skill collection; inconsistency undermines exactly the searchability a good name
buys." Introducing gerund form here would add a third competing pattern (alongside
imperative and the `to-pr`/`renovate-triage` outliers) rather than converge toward one, so
joining the majority precedent won out over following the doc's example verbatim.

## Consequences

- This does not resolve the repo's broader naming inconsistency — `to-pr` and
  `renovate-triage` still fit neither the imperative nor the gerund pattern. A future
  session could either formalize "imperative verb-noun" as this collection's documented
  house style (updating `docs/skill-writing-best-practices.md` to say so explicitly) or
  do a wholesale rename toward gerund form; neither is decided here.
- Do not read `draft-commit-message`'s name as an oversight or a stale draft of "the
  gerund name we meant to use" — it's the considered choice, and renaming it toward
  gerund form later should be a deliberate follow-up to the point above, not a drive-by
  "fix."
