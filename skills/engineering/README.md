# Engineering skills

Daily code work.

**Manual-only**

- [blast-radius](./blast-radius/SKILL.md) — find what a branch, a pull request, or a ref
  range can break outside its own diff. Names the one fact the change is safe because of,
  looks where a search stops (library source at the pinned version, run order, data
  shapes, flags, downstream hops), and rates each risk on a five-step evidence ladder.
  Reads the diff and history inside a subagent. Edits no tracked file. It can fetch a
  commit from a fork pull request.
- [sweep-comments](./sweep-comments/SKILL.md) — delete disallowed comments from the lines
  the current branch added, keeping doc comments, license headers, formatter directives,
  and comments that explain a why the code cannot state. Flags a kept why about our own
  code for a reshape, and lists removed TODO notes and ambiguous deletions. `--base` names
  another base branch, `--widen` sweeps whole touched files, and a file list replaces the
  diff. Runs in a forked subagent. Never edits code, stages, or commits.

**Also auto-invocable**

- [draft-commit-message](./draft-commit-message/SKILL.md) — draft a Conventional Commits
  message for staged changes, reading the diff and branch inside a Haiku subagent. Fires
  on an explicit draft/write-a-commit-message ask and on the message-drafting step of a
  plain "commit this" ask. Never stages or commits.
- [repo-catchup](./repo-catchup/SKILL.md) — report the current repository's commits over
  a date range as a one-line summary plus a Date/Owner/Ref/Description table, dropping bot
  and merge commits. Runs `git log` inside a delegated subagent.
- [to-pr](./to-pr/SKILL.md) — open a new PR (draft by default) from the current branch,
  or fill in an already-open PR's description from its own
  `.github/PULL_REQUEST_TEMPLATE.md`.
- [why](./why/SKILL.md) — answer why a piece of code has its shape from commits, pull
  requests, tickets, documents, chat, monitoring, and error reports, with every claim in a
  confidence tier and every source listed, reached or not. Runs one investigator per
  reachable source in parallel subagents.
