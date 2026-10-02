# `draft-commit-message` takes the meaning of each type from the repo doc

ADR 0027 says that the convention sources merge: a linter's rules govern what it can
check, and prose rules govern the rest. The script did not do this. It took every field
from one winning source. When a repo had a commitlint config, the script never read the
type rules in `CLAUDE.md` or `CONTRIBUTING.md`. When the doc won, the script kept only
the type names. In this repo, a fix to `release.config.js` got `fix` and cut a release by
mistake. The repo doc says that such a fix is `build`, `ci`, or `chore`.

This ADR refines ADR 0027. We decided to split the convention in two. The format rules are the type list, the scope
rule, the subject case, and the header length. They still come from one winning source,
in the priority order of ADR 0027. The meaning of each type always comes from the doc,
as *Type guidance*. The script fills `typeGuidance` for every source, also for a git-log
or fallback resolution.
A linter can check the name of a type, but it cannot check what the repo means by it.

The script reads the first heading that contains "type" inside the commit section of the
doc. If no type heading exists, it reads the full commit section. If no commit heading
exists, the field is `null`, because prose from an unrelated doc must not steer the type.
The text passes word for word, capped at 2,000 characters. The brief places it under the
built-in type definitions of ADR 0031, and the repo text wins on a conflict.

## Considered Options

- **Merge every field per source.** We rejected it. A per-field merge makes the format
  result hard to predict, and a linter already enforces the format fields it knows.
- **Let the script summarize the doc into type rules.** We rejected it. A summary decides
  the rules in code, but the subagent can read the prose itself.
- **Pass the whole doc.** We rejected it. Unrelated prose makes the brief larger for a
  fast model and can steer the type.

## Consequences

- A doc too thin to win the format rules still passes its type text. The `fallback` flag
  and the *Convention snippet offer* still depend only on the format resolution.
- Custom types outside the 11 fallback types still do not reach `typeEnum` from a doc.
