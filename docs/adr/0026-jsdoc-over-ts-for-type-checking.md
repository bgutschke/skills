# Type-check plain JS via JSDoc, not real `.ts` source

This repo's plain JavaScript — `scripts/*.js` and the scripts bundled inside shipped
skills (`skills/**/scripts/*.js`) — had no type checking at all. Bugs that a type checker
catches for free (a wrong argument order, a typo'd property name, a `null` that reaches a
`.map()`) surfaced only at runtime, or not until a reviewer noticed by eye.

Converting to real `.ts` source was the obvious first option, but it doesn't fit how this
repo's scripts execute. The scripts bundled inside shipped skills run on whatever Node
version the plugin installer's own machine happens to have — this repo doesn't control
that runtime the way it controls its own CI. Real `.ts` source needs either a build step
(emitting `.js` the installer's Node actually runs) or a `ts-node`-style loader at
runtime; both add a moving part to every skill install that wasn't there before, for a
repo whose entire shipped-code footprint is "plain scripts a plugin drops onto someone
else's machine." A build step in particular risks a compiled-output/source drift the repo
has no mechanism to catch if someone edits the emitted `.js` directly, or forgets to
rebuild before committing.

We adopted JSDoc-annotated plain JS instead: `// @ts-check` at the top of a file opts it
into `tsc`'s type checking of ordinary `.js`, using JSDoc comments (`@param`, `@returns`,
`@type`) for annotations. Nothing about how the file executes changes — it's still the
same `.js` file, run by the same `node`, with zero build step. A root `tsconfig.json` sets
`checkJs: false` globally (so unannotated files are inert) with `strict: true`, so a file
that does opt in is held to the same bar as if this were a native TS codebase — there's
no looser on-ramp tier to start from and later tighten. `npm run typecheck` runs `tsc
--noEmit` and is wired into CI (`validate.yml`) unconditionally, so a currently-empty
opt-in set still gets checked on every push and exits clean.

Opting in is mandatory the next time a file is touched for any reason — not just a
rewrite, any edit — and the obligation is scoped to that single file, not its containing
skill directory or `scripts/` as a whole: touching one file in
`skills/productivity/renovate-triage/scripts/` never obligates opting in its neighbors in
the same directory. The rule makes no distinction between maintainer-only tooling and
skill scripts that ship to users — both are "plain JS this repo maintains," and the
plugin-installer Node-version constraint that ruled out `.ts` applies to both equally.
Work already in progress at the point this convention was adopted is exempt from opting
in retroactively — the mandatory-on-touch rule takes effect for touches from this point
forward, not for edits already underway.

**Considered and rejected:**

- **Real `.ts` source, compiled to `.js` for skill scripts.** Rejected for the runtime
  mismatch above: a build step or loader is a new moving part on every plugin install,
  and a compiled/source drift the repo has no way to catch mechanically.
- **`.ts` source for maintainer-only tooling (`scripts/*.js`) only, JSDoc for shipped
  skill scripts.** Rejected as a split convention with no real justification — maintainer
  tooling runs on this repo's own controlled CI Node version, so a build step would work
  there, but having one type-checking convention for half the codebase and a different
  one for the other half is its own maintenance cost, for a benefit (avoiding JSDoc's
  more verbose annotation syntax in half the files) that doesn't offset it.
- **A looser `strict: false` (or partial-strictness) tier for newly opted-in files,
  tightened later.** Rejected because "later" has no forcing function in a repo with no
  dedicated type-debt tracking — a looser tier a file starts in is a looser tier it stays
  in indefinitely, which defeats the point of opting in at all.
- **Require opt-in repo-wide immediately (`checkJs: true` globally).** Rejected as a
  one-shot retroactive migration across every existing plain-JS file, with no test
  coverage change accompanying it — exactly the kind of drive-by rewrite this repo avoids
  doing outside of a file actually being touched for a real reason.

## Consequences

- A file with `// @ts-check` is held to `strict: true` from the moment it opts in; there
  is no intermediate looser tier to migrate through later.
- Touching any `scripts/*.js` or `skills/**/scripts/*.js` file for any reason — including
  a one-line bug fix — now carries an implicit "add `// @ts-check` and satisfy `tsc`"
  step, scoped to that file alone.
- `npm run typecheck` runs in CI unconditionally, so a regression in an already-opted-in
  file fails the build the same way a failing test would, even though the majority of
  this repo's plain JS remains unannotated and thus unchecked.
- Files in flight when this convention was adopted keep their untyped state until they're
  next touched — this ADR creates no retroactive backlog to clear.
