---
name: repo-catchup
argument-hint: "[--from <date|phrase|ref>] [--to <date|phrase|ref>]"
description: "Reads the commits in the current repository for a date range. Replies with a one-line executive summary and a Date, Owner, Ref, and Description table. Drops bot-authored and merge commits. Groups rows by team, with a CODEOWNERS file present, otherwise by individual contributor. --from and --to each accept an absolute YYYY-MM-DD date, a relative phrase such as \"yesterday\" or \"last week,\" or a git tag or branch name. When neither is given, defaults to the last seven days. Runs git log inside a delegated subagent, so a large range never floods the conversation. On a GitHub remote with gh authenticated, each row links to its merged pull request, or otherwise to its bare commit. Elsewhere it falls back to a plain hash. When the user types /repo-catchup, use this skill. When the user asks, in plain language, to catch up on this repository, use it too. Example requests: \"catch me up on this repo,\" \"what changed here recently,\" \"summarize commits since last week.\""
---

# repo-catchup

Report what changed in the current repository over a date range. The reply has one
executive-summary sentence, then a table with one row per commit. The skill always reads
the repository it runs in. It takes no separate repository argument.

On a GitHub remote, with `gh` installed and authenticated, a row backed by a merged pull
request links to that pull request. A row with no pull request still links to its bare
commit. On any other host, or with `gh` missing or unauthenticated, every row falls back to
a plain, non-clickable hash.

With a `CODEOWNERS` file present at the repository's root, `.github/`, or `docs/`, rows
group by team. A commit's team is whichever one owns the majority of its touched files. A
commit matching no team's rule falls back to its own author. With no `CODEOWNERS` file at
any of the three locations, every row falls back to its own author's name.

## When to use

- The user types `/repo-catchup`, with or without `--from`/`--to`.
- The user asks, in plain language, to catch up on this repository. This includes a
  request to summarize or review recent changes.
- Example requests: "catch me up on this repo," "what changed here recently,"
  "summarize commits since 2026-08-01".

## When not to use

- When the current directory is not a git repository, say so plainly and stop. Do not
  guess at another directory.
- When the user names a different repository to report on, decline. Suggest they run this
  skill from that repository instead. This skill only reads the one it runs in.
- When the user asks for a report scoped to one contributor or team, decline that scope.
  The same applies to a request that flags risk or breaking changes. This skill reports
  every contributor over the range, plain and descriptive, with no scoping flag and no
  judgment call.

## Dependencies

Requires `node` to run the two bundled scripts named in Delegation below.

The bundled scripts also need an authenticated `gh` CLI for one path only: linking a row to
its merged GitHub pull request, or to its bare commit, on a GitHub remote. No other part of
this skill needs `gh`. When `gh` is missing or unauthenticated, or the remote is not GitHub,
the scripts skip that enrichment on their own. The report still returns in full, with a
plain hash in the Ref column instead.

## Argument grammar

Scan `args` for two optional flags, in any order:

- `--from <boundary>`
- `--to <boundary>`

Each `<boundary>` value accepts one of three forms. The skill resolves the value in this
order:

1. An absolute date in `YYYY-MM-DD` form.
2. A relative phrase, anchored to today. Recognized phrases are `today`, `yesterday`,
   `last week`, `last month`, and `last year`. A numeric phrase also works, for example
   `3 days ago`, `2 weeks ago`, or `4 months ago`.
3. A git tag or branch name. The skill resolves it to that ref's own commit date.

The two flags resolve on their own. One side can use an absolute date. The other side can
use a relative phrase or a ref.

When a value matches none of the three forms, the bundled script raises an error that
names the value. Relay that error to the user plainly and stop. Do not guess a fallback
range.

When the request gives no boundary for a flag, leave that flag out. Do not guess a value.

A boundary value can contain spaces, for example `last week` or `3 days ago`. Keep it as
one shell argument. Quote it in the subagent brief, for example `--from "3 days ago"`.

## Delegation

Call the **Agent** tool with:

- `subagent_type: "general-purpose"`
- `model: "haiku"`. The two bundled scripts below already make every decision, so the
  subagent only runs one command and relays its output. A fast model is enough.
- `description: "Gather repo-catchup commits"`
- `prompt`: the brief below, with `<FROM>`/`<TO>` filled in from whatever `--from`/`--to`
  values apply. When a value is not set, omit that flag entirely from the command, so the
  script's own default applies.

### Brief for the subagent

```text
Run this exact command from the current directory and return its stdout verbatim, with
nothing else added:

node "${CLAUDE_SKILL_DIR}/scripts/gather-commits-cli.js" --from <FROM> --to <TO> | node "${CLAUDE_SKILL_DIR}/scripts/build-report-cli.js"

Omit a --from or --to token entirely rather than passing an empty value for it.

If the command exits non-zero, return its stderr text verbatim instead, prefixed with
"ERROR: ".
```

A `git log` over an arbitrary range has no size limit. This whole pipeline runs inside the
subagent for that reason. Only its final, compact result crosses back into this
conversation. A raw commit list never does.

## After the subagent returns

Parse the subagent's reply.

- When the reply starts with `ERROR: `, relay the rest of that line to the user plainly
  and stop. Do not retry or guess a fallback range.
- Otherwise, parse it as JSON: `{ range: { from, to }, rows, summary }`.

When `rows` is empty, reply with one plain sentence. State that nothing changed in the
repository between `range.from` and `range.to`. Do not show a table.

Otherwise, compose the reply in two parts:

1. **One-line executive summary**, written by you from `summary` and `range`. State the
   number of rows, the number of distinct owners, and the date range. When
   `summary.droppedBotCommits` or `summary.droppedMergeCommits` is above zero, mention the
   dropped bot or merge commits parenthetically. Otherwise, omit that mention.
2. **A table** with columns `Date | Owner | Ref | Description`. One row per entry in
   `rows`, already sorted by owner then date:
   - **Date**: the first 10 characters of `row.date` (its `YYYY-MM-DD` portion).
   - **Owner**: `row.owner` verbatim.
   - **Ref**: `` `row.ref.label` `` as inline code. When `row.ref.url` is not `null`,
     render it as a markdown link instead. A `null` URL still renders as a plain code span,
     with no link.
   - **Description**: one short, plain sentence in your own words, built from
     `row.subjects`. Do not copy the commit message verbatim. When `row.body` is not
     `null`, add a why-clause from it, in your own words, never copied verbatim. Add as
     many clauses as the body supports. There is no fixed sentence-count cap. When
     `row.body` is `null`, write the subject-only sentence exactly as before.

The report goes into the chat reply only. Never write it to a file. Never publish it as an
artifact.

## Worked example

This fixture is synthetic. It is not this repository's own history. The repository's remote
is GitHub, and `gh` is authenticated. A `CODEOWNERS` file at `.github/CODEOWNERS` names two
teams:

```text
/backend/ @acme/backend-team
/frontend/ @acme/frontend-team
```

`--from v1.4.0 --to 2026-01-07` resolves. The `v1.4.0` tag points at a commit dated
2026-01-01, so the ref form and the absolute form resolve together in one call. The
subagent's pipeline returns:

```json
{
  "range": { "from": "2026-01-01", "to": "2026-01-07" },
  "rows": [
    {
      "date": "2026-01-02T10:00:00+01:00",
      "owner": "@acme/backend-team",
      "ref": { "label": "#42", "url": "https://github.com/acme/widgets/pull/42" },
      "subjects": ["add password reset handler"],
      "hashes": ["148f3f4ae5c5e04b46f6500db4311d48ac26d703"],
      "body": "Users locked out of a stale session had no way back in on their own. This adds a self-service reset link."
    },
    {
      "date": "2026-01-03T11:00:00+01:00",
      "owner": "@acme/backend-team",
      "ref": { "label": "058fee1", "url": "https://github.com/acme/widgets/commit/058fee1654cd41717ae2b92af8a34092c7d52dc8" },
      "subjects": ["fix off-by-one in pagination offset"],
      "hashes": ["058fee1654cd41717ae2b92af8a34092c7d52dc8"],
      "body": null
    },
    {
      "date": "2026-01-04T12:00:00+01:00",
      "owner": "@acme/frontend-team",
      "ref": { "label": "#57", "url": "https://github.com/acme/widgets/pull/57" },
      "subjects": ["update nav bar layout"],
      "hashes": ["7dc2c10d4b9c86b03022d47c3bc40871cd8a025a"],
      "body": null
    },
    {
      "date": "2026-01-01T09:00:00+01:00",
      "owner": "Ada Lovelace",
      "ref": { "label": "e62c56c", "url": "https://github.com/acme/widgets/commit/e62c56c2d75d9776bac22580ed8d2c5af30bef7b" },
      "subjects": ["seed repo with CODEOWNERS"],
      "hashes": ["e62c56c2d75d9776bac22580ed8d2c5af30bef7b"],
      "body": null
    }
  ],
  "summary": { "totalCommits": 5, "droppedBotCommits": 1, "droppedMergeCommits": 0, "rowCount": 4 }
}
```

Before returning this result, the pipeline dropped one raw commit. A `dependabot[bot]`
commit was bot-authored.

The password-reset commit and the pagination fix each touched a file under `backend/`.
CODEOWNERS attributes both to `@acme/backend-team`, though two different people authored
them. Merged pull request #42 covers the password-reset commit, so its row links to that
pull request. That pull request also carries a body, so the row's Description adds a
why-clause drawn from it. The pagination fix has no matching pull request and no commit
body. Its row links to its bare commit instead and keeps the subject-only sentence.

The nav-bar commit touched a file under `frontend/`, so CODEOWNERS attributes it to
`@acme/frontend-team`. Merged pull request #57 covers it too, so its row links to that
pull request.

The CODEOWNERS-seeding commit touched only `.github/CODEOWNERS` itself. No rule in the
file matches that path, so it falls back to its own author, Ada Lovelace.

The reply:

> 4 commits from 3 owners between 2026-01-01 and 2026-01-07 (1 bot commit omitted).

| Date | Owner | Ref | Description |
| --- | --- | --- | --- |
| 2026-01-02 | @acme/backend-team | [#42](https://github.com/acme/widgets/pull/42) | Added a password reset flow, because a stale session gave a locked-out user no way back in. |
| 2026-01-03 | @acme/backend-team | [058fee1](https://github.com/acme/widgets/commit/058fee1654cd41717ae2b92af8a34092c7d52dc8) | Fixed an off-by-one error in the pagination offset. |
| 2026-01-04 | @acme/frontend-team | [#57](https://github.com/acme/widgets/pull/57) | Updated the navigation bar layout. |
| 2026-01-01 | Ada Lovelace | [e62c56c](https://github.com/acme/widgets/commit/e62c56c2d75d9776bac22580ed8d2c5af30bef7b) | Added the CODEOWNERS file. |

With no `CODEOWNERS` file at any of the three locations, every row falls back to its own
author's name instead of a team. On a non-GitHub remote, or with `gh` missing or
unauthenticated, every `ref.url` comes back `null` instead. The table then shows a plain
code span, for example `` `9f8e7d6` ``, with no link.

A range with no commits, `--from 2026-02-01 --to 2026-02-07` returning `rows: []`, gets a
different reply, with no table:

> Nothing changed in this repository between 2026-02-01 and 2026-02-07.
