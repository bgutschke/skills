# bgutschke/skills

A Claude Code plugin repo shipping agent skills, organized into bucket folders under `skills/`.

## Language

**Commit scope**:
The optional `type(scope): ...` segment of a Conventional Commits header. Two independent vocabularies share this one field, and a commit draws from at most one of them: *bucket scope* (`engineering`, `productivity`) names which skills bucket a commit touches; *maintenance scope* (`deps`, `config`) names what kind of automated dependency-tooling change a Renovate-authored commit is. See `AGENTS.md`'s Commit messages section for the full rule.
_Avoid_: treating "scope" as solely the bucket vocabulary — that's only half of it now.
