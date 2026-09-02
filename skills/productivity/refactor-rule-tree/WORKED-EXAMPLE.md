# refactor-rule-tree worked example

A four-rule personal `CLAUDE.md`. It's managed by a dotfiles setup, so
`~/.claude/CLAUDE.md` is actually a symlink to `~/.dotfiles/claude/CLAUDE.md` — Step 2's
`init` canonicalizes it before seeding the walk state, so every later reference to either
name resolves to the one node this pass already knows.

1. "Never push directly to `main`; always open a PR." — fires on nearly every git-touching
   task. **stay**, condition 1.
2. "Before merging, squash unless the project's own convention says otherwise." — states
   which convention wins when the project has its own opinion. Router exemption:
   precedence content, extracted from consideration entirely. **stay** (never a move
   candidate).
3. "When writing a commit message, use Conventional Commits — see `commit-msg` skill for
   the exact types." — a specific, nameable trigger ("writing a commit message"), and the
   check ("does the subject match `type(scope): description`") is the same every time with
   no judgment involved. **skill**, mechanism: hook, checking the commit message against
   the Conventional Commits pattern before the commit is created.
4. "Use two-space indentation in YAML files." — no near-universal trigger, not
   irreversible on a miss, and there's no sibling rule to cluster it with. **stay**,
   condition 3 (small, no intent to grow).

Rule 2's router exemption is checked and applied before rule 2 is ever measured against
the four stay conditions — it would likely qualify for condition 1 anyway, but the
exemption is what guarantees it regardless of how often it's actually observed to fire.

The same file cites five paths. `@ROUTING.md`, sitting beside it, resolves against the
file's own directory and comes back **live**. `` see `docs/old-conventions.md` `` resolves
against none of the three roots and doesn't complete against anything the repository
actually contains, so it comes back **dead** — proposed for cutting, gated by the same
Step 7 confirmation as the four rules above, never applied on its own. `` `rules/*.md` ``
is a glob and comes back **unverifiable** with reason `glob`, never offered as a cut
candidate regardless of how the plan is amended. A fourth, `` `../proj-wt/CLAUDE.md` ``,
resolves **live** — a colleague's git-worktree checkout of the very same repository really
does have a file there — but Step 2's `visit` reports it `excluded: true` rather than a
new node: `git worktree list` names `../proj-wt` as a checkout of this repository, so
walking into it would re-report every finding in the whole tree a second time under a
different path. A fifth, `` `~/work/some-project/CLAUDE.md` ``, resolves **live** — a real
project's own root rule file, sitting nowhere near the personal config directory or inside
any worktree of it — but its scope classifies **project** against a root whose own scope
fixed to **personal** at `init`, so `visit` reports `scopeCrossing: true`, `editable:
false`, `shouldWalkOnward: false`. It's recorded as a node — confirmed to exist, same as
any other — but never opened with the Read tool and never walked past; Step 5 lists it in
the scope-crossing findings, not the rule or pointer tables.

`@ROUTING.md`'s `live` verdict is what Step 2 advances the walk on: an import edge out of
the root, whose own `autoLoaded` is `true`, so `ROUTING.md` classifies **restructurable**.
It holds one rule of its own — "when two skills could both fire for the same request,
route by whichever trigger is more specific" — which is precedence content: router
exemption, **stay**, never measured against the four conditions. `ROUTING.md` in turn
mentions `` `docs/conventions-crossrefs.md` `` (a mention edge, `live`) and
`` `scripts/commit-lint.js` `` (also a mention edge, `live`). The first classifies
**verify-only** — `ROUTING.md`'s own `autoLoaded: true` doesn't matter here, because the
edge reaching it is a mention, not an import; its pointers get checked, but it holds no
rule table of its own in this plan. The second classifies **resolve-only**, reason `code`
— `visit` confirms it exists by canonicalizing its real path and reports
`shouldWalkOnward: false`; it is never opened with the Read tool and nothing further is
walked from it.

`docs/conventions-crossrefs.md` itself `@`-imports `` `docs/legacy-notes.md` `` — an
import edge, but out of a parent whose own `autoLoaded` is `false`, so the target still
classifies **verify-only**, not restructurable: an import edge only carries auto-load
forward when the node making it was itself auto-loaded, and nothing loaded
`docs/conventions-crossrefs.md`'s own imports in the first place. That same file also
mentions `@ROUTING.md` again — already in the walk state from two hops up, so `visit`
reports `alreadyVisited: true` and adds nothing; this is what keeps the cycle between
`ROUTING.md` and `docs/conventions-crossrefs.md` from being read, or reported, twice.
`docs/legacy-notes.md` cites the root file too, but by its dotfiles path,
`` `~/.dotfiles/claude/CLAUDE.md` `` — `visit` canonicalizes that to the exact same real
path the root's own `~/.claude/CLAUDE.md` symlink already resolved to at `init`, so this
also comes back `alreadyVisited: true` rather than a second root node under a second name.

Step 5's `report` reads back six nodes total: the root and `ROUTING.md`, both
restructurable; `docs/conventions-crossrefs.md` and `docs/legacy-notes.md`, both
verify-only — a verify-only node is still walked, only not restructured;
`scripts/commit-lint.js`, resolve-only; and `~/work/some-project/CLAUDE.md`, whose class is
irrelevant next to its `scopeCrossing: true` — that flag alone is what kept it from ever
being opened. The excluded worktree entry is kept separately, never counted as a node. That
list is what the rule, pointer, and scope-crossing findings below are built from, not
memory of the individual `visit` calls it took to discover them.

The plan's rule table has five rows — the root's four plus `ROUTING.md`'s one — all five
ids present exactly once, and `check-plan` against
`{"ruleIds":["push-via-pr","squash-precedence","commit-msg-hook","yaml-indent","specific-trigger-wins"],"entries":[...five entries, one per id...]}`
returns `{"ok": true, ...}` before anything is shown to the user as final. The pointer
list carries every citation collected from every node the walk opened — the root's five
plus `ROUTING.md`'s two plus `docs/conventions-crossrefs.md`'s two plus
`docs/legacy-notes.md`'s one — reviewed by hand alongside the rule table, per Step 5,
since `check-plan`'s invariant covers only rules. The scope-crossing findings list carries
one row: `~/work/some-project/CLAUDE.md`, cited from the root, its own scope **project**
against the root's fixed **personal** — reported so the user learns the two trees are
connected, and nothing more, since the pass never read across into it to learn anything
else.
