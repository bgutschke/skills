# `draft-commit-message` discovers each repo's convention instead of shipping one fixed style

The `draft-commit-message` skill moved here from a personal slash command (`/commit-msg`)
whose brief hardcoded one house style: a capitalized imperative subject and a ticket-ID
scope pulled from a Jira-style branch name. That style was right for the one project the
command was written against, and wrong for this repo — lowercase subjects, an enumerated
type list, scope drawn from a documented vocabulary, no tickets. A skill shipped from a
public plugin repo runs against repos it has never seen, so a single hardcoded style
would be wrong most of the time it's actually used.

We decided the skill discovers each repo's own convention before generating anything,
checking sources in priority order and merging rather than picking one winner:
commitlint's resolved config (via `--print-config`, since an enum can be computed rather
than a static list — this repo's own `scope-enum` reads skill directory names off disk),
a written commit-convention doc (`CLAUDE.md`/`CONTRIBUTING.md`), and a pattern sampled
from recent `git log` subjects when neither exists. A linter's structured rules govern
what it can mechanically check; prose rules govern what it can't — body content, footer
syntax, breaking-change notation. Only when none of these exist does it fall back to the
*Fallback convention*: the Angular convention's type enum (`build`, `chore`, `ci`, `docs`,
`feat`, `fix`, `perf`, `refactor`, `revert`, `style`, `test` — the same list
`@commitlint/config-conventional` and semantic-release's `angular` preset both implement,
and what this repo's own CLAUDE.md type list already matches), lowercase imperative
subject, no forced scope. The bare Conventional Commits spec itself only formally defines
`feat`/`fix`; everything else in "the" Conventional Commits type list people actually use
comes from Angular's convention, so naming it explicitly is more honest than calling it
"the spec." Header length uses git's classic 50/72 rule (at or under 72 characters,
aiming for 50) rather than Angular's own looser 100-character guidance — both this repo's
CLAUDE.md and the original command independently already chose 72/aim-50 over Angular's
100, a repeated signal about what's actually wanted when nothing else is discovered.

## Consequences

- The skill's `git diff`/analysis step still runs inside a Haiku subagent, unchanged from
  the original command, but the orchestrating skill now does convention discovery itself
  first — bounded reads (a config file, a doc, a `git log` sample) with no isolation
  benefit from delegating them — and hands the subagent an already-resolved rules brief
  rather than making it hunt the filesystem too.
- A repo with no discovered convention gets the *Fallback convention*, not a blend with
  whatever partial signal exists; see `CONTEXT.md`'s Commit message generation glossary
  entries.
- This is a precedent for any future skill that must produce output shaped by a target
  repo's own rules: prefer discovering those rules over shipping one opinionated default,
  once the skill is meant to run outside the repo it was designed in.
- The *Fallback convention*'s type enum and its length rule come from two different
  lineages (Angular's convention; git's own 50/72 tradition) rather than one coherent
  source. A future reader shouldn't read the mix as an oversight — it's deliberate, and
  changing one half should not silently drag the other along.
