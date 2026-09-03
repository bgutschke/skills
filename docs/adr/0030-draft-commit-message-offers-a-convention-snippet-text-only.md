# `draft-commit-message` offers a convention snippet, never a tooling scaffold

Falling back to the *Fallback convention* (ADR 0027) is silent by default — the user
asked whether hitting it should also do something more, since a repo with no discovered
convention hits the same generic default on every run with no path to converging on its
own house style.

We decided to append a one-line note when the *Fallback convention* was used ("no commit
convention found in this repo — used Conventional Commits defaults (Angular's type list,
subject line under 72 characters)") plus an offer to draft a short prose paragraph for
`CLAUDE.md`/`CONTRIBUTING.md`, written only on explicit confirmation. The note names
"Conventional Commits" rather than "Angular convention" and drops the internal "aim for
50" detail from ADR 0027's own type-enum/length reasoning — that precision matters for
future maintainers reading this repo's own docs, but a user reading a one-line runtime
note needs the widely-recognized term and only the length fact they can actually act on
(the hard 72-character ceiling), not the full internal attribution. We rejected going further to a full scaffold — a commitlint config, a
`husky` hook, a new `package.json` dependency — because that is "set up lint tooling for
a repo," a materially larger and harder-to-reverse action than anything else this skill
does, not "draft a commit message." Staying text-only keeps the offer inside the
*Generation-only boundary* (ADR 0028) rather than quietly widening it: nothing gets
written to the target repo without the same kind of explicit, separate confirmation that
boundary already requires for staging and committing.

The note costs nothing extra to add: discovery already runs before every generation (ADR
0027), so the orchestrating skill already knows whether it found anything. The snippet
itself is only generated on explicit opt-in, so the common case — a repo that simply has
no convention and the user ignores the offer — has no added token cost at all. No
throttling logic was needed to keep the offer from nagging on every run in the same
repo: the moment a user accepts it, the snippet becomes a written doc, and the *next*
run's discovery step (ADR 0027) finds it as a *Discovered convention* and the offer stops
appearing on its own.

## Consequences

- Do not read the offer as this skill starting to own commit-linting setup — it is
  scoped to *suggesting* a written convention, and any future ask for actual
  enforcement tooling (commitlint, a git hook, CI wiring) is a distinct, larger task
  outside this skill's boundary, not a natural next step for it to grow into.
- The snippet targets whichever of `CLAUDE.md`/`CONTRIBUTING.md` already exists in the
  target repo; if neither exists, it defaults to proposing a `CLAUDE.md`, matching how
  *Discovered convention* (ADR 0027) already treats the two as equivalent written-doc
  sources.
