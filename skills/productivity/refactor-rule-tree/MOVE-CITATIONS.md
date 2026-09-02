# Discover inbound citations before finalizing a move

Referenced from `SKILL.md`'s Step 4, "Move — to a topic file": the search, classification,
and decision procedure that runs before any `move` verdict is finalized.

Use the Grep tool — not a shell `find`/`grep`, for the same reason Step 3's resolution runs
through a bundled script rather than one — to search the pass's own scope root (the config
directory for a personal pass, the project root for a project pass) for the rule's current
node's filename and every path form Step 3's resolver would treat as pointing at it,
excluding the same worktree and dependency directories the walk itself excludes. This search
is not bounded by which nodes Step 2's walk happened to open — a file the walk never reached
by any edge (another skill's `SKILL.md`, an agent or command file, a topic file nothing
mentions) can still turn up here, because it's a fresh search over the scope root's contents
rather than a replay of the walk's own edges.

Classify every hit with:

```bash
node scripts/classify-citation-hit-cli.js classify <rootScope> <hitPath>
```

`<rootScope>` is the scope Step 2's `init` already fixed for this pass — `personal` or
`project` — not the hit's own location. This wraps the same two modules Step 2's `visit`
classifies a walked node with (`classify-scope.js`, `classify-node.js`), for a hit that
arrived by Grep rather than by a walk edge and so has no parent node in the walk state for
`visit` itself to run against. It reports `editable: true` only when both hold: the hit's
own scope matches `<rootScope>`, *and* its class isn't resolve-only. A scope mismatch is
exactly the crossing Step 2 already refuses to open; a resolve-only hit — a skill's
`SKILL.md`, an agent or command file, code, configuration — is one this pass has no standing
to edit regardless of scope, for the same reason a resolve-only node is never opened for
findings in Step 2. Either reason reports `editable: false`; the two are not distinguished
any further than that in the result.

Write the hits as `[{ "citingPath": ..., "editable": ... }, ...]` (one `editable` value per
hit, from the command above) to a scratch file and run:

```bash
node scripts/decide-citation-action-cli.js decide <path-to-that-file>
```

- `move` — no citing file was found. The verdict stands as `move`, with nothing further to
  carry alongside it.
- `update` — every citing file is editable. The verdict still stands as `move`, but every
  one of those citations is now carried alongside this rule into Step 5's plan and Step 7's
  execution, to be updated in the same change as the move.
- `blocked` — at least one citing file is not editable. The verdict flips to `stay`,
  condition 4, instead — and the report names every blocking citation from
  `blockingCitations`. Never just that one citing file's move deferred: the whole move.

A citation left pointing at the rule's old location after the rule itself moved is strictly
worse than never having proposed the move — the old file would point at nothing, the exact
defect this pass exists to catch, except this time caused by the pass's own edit — and that
is the entire reason one non-editable citation blocks the whole move rather than the move
proceeding everywhere it safely could.
