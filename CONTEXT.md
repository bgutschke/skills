# bgutschke/skills

A Claude Code plugin repo shipping agent skills, organized into bucket folders under `skills/`.

## Language

**Commit scope**:
The optional `type(scope): ...` segment of a Conventional Commits header. Two independent vocabularies share this one field, and a commit draws from at most one of them: *bucket scope* (`engineering`, `productivity`) names which skills bucket a commit touches; *maintenance scope* (`deps`, `config`) names what kind of automated dependency-tooling change a Renovate-authored commit is. See `AGENTS.md`'s Commit messages section for the full rule.
_Avoid_: treating "scope" as solely the bucket vocabulary — that's only half of it now.

### Rules auditor

**Rule file**:
A natural-language instruction file Claude Code loads automatically into context — the `CLAUDE.md` / `CLAUDE.local.md` / `rules/*.md` family, at any scope (personal, project, or managed-policy), including anything pulled in via `@`-import.
_Avoid_: "config file" (that's `settings.json` — structured, not prose); "memory file" (model-written, not hand-authored — out of scope for the rules auditor).

**Personal rule file**:
A rule file the current user owns and can edit directly — `~/.claude/CLAUDE.md`, `~/.claude/rules/*.md`. The rules auditor's only edit target.
_Avoid_: conflating with *Project rule file*, which the auditor only ever reads.

**Project rule file**:
A rule file that lives in the project directory rather than the user's home directory — `./CLAUDE.md` and `./.claude/rules/*.md` (typically shared with a team via version control), plus a repo's `CLAUDE.local.md` (typically gitignored and personal to whoever's working in that checkout, but still project-scoped by location, not home-directory scoped). The rules auditor reads all of these for cross-referencing but never proposes edits to any of them, regardless of who authored the content.
_Avoid_: treating as an edit target — including `CLAUDE.local.md`, since edit authority here is scoped by location (home vs. project directory), not by who wrote the content.

**Contradiction**:
Two rule files, or two invocable units (see below), giving opposite guidance for the same trigger. The rules auditor's highest-severity finding.
_Avoid_: using loosely for any overlap — see *Unresolved overlap*.

**Unresolved overlap**:
Two invocable units that could both plausibly fire for the same request, with no stated precedence between them — a carving defect (per `ROUTING.md`'s carving principle) even when neither one's guidance is individually wrong.
_Avoid_: conflating with *Contradiction*, which requires actual disagreement, not just untie-broken competition.

**Invocable unit**:
A skill or an agent — anything with a `description` the model matches against to decide whether to fire automatically. The rules auditor's semantic-distinction check only compares invocable units that can be auto-invoked; a unit with `disable-model-invocation: true` (or an agent that only runs when named explicitly) is exempt from that check.
_Avoid_: "skill" alone when an agent is equally in scope.
