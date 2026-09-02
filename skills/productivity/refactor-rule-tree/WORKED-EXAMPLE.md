# refactor-rule-tree worked example

- [The root file's rules](#the-root-files-rules)
- [The root file's pointers](#the-root-files-pointers)
- [Walking into ROUTING.md](#walking-into-routingmd)
- [Two cycles back to already-visited nodes](#two-cycles-back-to-already-visited-nodes)
- [What Step 5's report reads back](#what-step-5s-report-reads-back)
- [Move candidates and their inbound citations](#move-candidates-and-their-inbound-citations)
- [The assembled plan](#the-assembled-plan)

A seven-rule personal `CLAUDE.md`. It's managed by a dotfiles setup, so
`~/.claude/CLAUDE.md` is actually a symlink to `~/.dotfiles/claude/CLAUDE.md` — Step 2's
`init` canonicalizes it before seeding the walk state, so every later reference to either
name resolves to the one node this pass already knows.

## The root file's rules

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
5. "When a new topic file's name might collide with a sibling, disambiguate with a folder
   prefix rather than a longer name." — no near-universal trigger, not irreversible, and
   pairs with rule 6 below into a real cluster, so condition 3 doesn't hold either.
   Candidate for **move**, pending the inbound-citation check below.
6. "Prefer one topic file per subject over several thin ones on the same subject." — same
   shape as rule 5, same cluster (topic-file naming conventions), same pending candidacy.
7. "Before a major-version bump, run the pre-1.0 migration script
   `scripts/legacy-migrate.sh`." — no near-universal trigger (a major-version bump is rare),
   nothing irreversible about the rule going unread, and no sibling rule to cluster it with,
   so none of the three stay conditions hold — but before it's ever weighed as a move or a
   skill candidate, the user confirms `scripts/legacy-migrate.sh` was deleted the day the
   project passed 1.0. **delete**, reason: refers to a tool confirmed retired. This is a
   rule verdict Step 4 hands out on the user's word, not one Step 3's mechanical pointer
   check could ever reach on its own — nothing about the rule's own *text* is itself a
   citation for that script to resolve or fail to resolve against; the script only stops
   existing once someone who'd know says so.

Rule 2's router exemption is checked and applied before rule 2 is ever measured against
the four stay conditions — it would likely qualify for condition 1 anyway, but the
exemption is what guarantees it regardless of how often it's actually observed to fire.

## The root file's pointers

The same file cites six paths. `@ROUTING.md`, sitting beside it, resolves against the
file's own directory and comes back **live**. `` see `docs/old-conventions.md` `` resolves
against none of the three roots and doesn't complete against anything the repository
actually contains, so it comes back **dead** — proposed for cutting, gated by the same
Step 7 confirmation as the rules above, never applied on its own. `` `rules/*.md` `` is a
glob and comes back **unverifiable** with reason `glob`, never offered as a cut candidate
regardless of how the plan is amended. `` `conventions-crossrefs.md` ``, missing the
`docs/` segment that `@ROUTING.md`'s own mention of the same file (below) keeps, resolves
against none of the three roots either — but it completes as the unique suffix match
against `docs/conventions-crossrefs.md`, so it also comes back **unverifiable**, this time
with reason `partial-path` and a `completedPath` of the full `docs/conventions-crossrefs.md`
reported in the finding. It's still never offered as a cut candidate: only a `dead` verdict
is ever a candidate for that, and a citation that turned out to need completing, not
deleting, is exactly what the fourth verdict exists to protect from being misread as one.
A fifth, `` `../proj-wt/CLAUDE.md` ``, resolves **live** — a colleague's git-worktree
checkout of the very same repository really does have a file there — but Step 2's `visit`
reports it `excluded: true` rather than a new node: `git worktree list` names `../proj-wt`
as a checkout of this repository, so walking into it would re-report every finding in the
whole tree a second time under a different path. A sixth, ``
`~/work/some-project/CLAUDE.md` ``, resolves **live** — a real project's own root rule file,
sitting nowhere near the personal config directory or inside any worktree of it — but its
scope classifies **project** against a root whose own scope fixed to **personal** at `init`,
so `visit` reports `scopeCrossing: true`, `editable: false`, `shouldWalkOnward: false`. It's
recorded as a node — confirmed to exist, same as any other — but never opened with the Read
tool and never walked past; Step 5 lists it in the scope-crossing findings, not the rule or
pointer tables.

## Walking into ROUTING.md

`@ROUTING.md`'s `live` verdict is what Step 2 advances the walk on: an import edge out of
the root, whose own `autoLoaded` is `true`, so `ROUTING.md` classifies **restructurable**.
It holds three rules of its own — the router file the fixture set needs, distinct from the
root's own router-exempt rule 2 above. "When two skills could both fire for the same
request, route by whichever trigger is more specific. (This is because a broader match
hides the caller's actual intent.)" is precedence content. Its first sentence is never
proposed for extraction, unconditionally, by the router exemption, before it's ever measured
against the four stay conditions. The parenthetical is different — rationale for the
precedence decision, not the precedence statement itself — so Step 4 offers it once as an
optional move to a topic file; declined here, so it stays inline with the rule it explains,
and nothing is recorded to keep a later pass from asking again on some future run over the
same file. **stay**, both halves, for two different reasons: the first because the
exemption forbids the move outright, the second because the offer was simply turned down.
"Split a topic file once it exceeds ten rules, by sub-topic" and "when two topic files could
both hold a new rule, prefer the one already cited nearby" are a second pair — no
near-universal trigger, not irreversible, clustered together (topic-file lifecycle) —
candidates for **move**, pending the same inbound-citation check as rules 5 and 6.
`ROUTING.md` in turn mentions `` `docs/conventions-crossrefs.md` `` (a mention edge, `live`)
and `` `scripts/commit-lint.js` `` (also a mention edge, `live`). The first classifies
**verify-only** — `ROUTING.md`'s own `autoLoaded: true` doesn't matter here, because the
edge reaching it is a mention, not an import; its pointers get checked, but it holds no
rule table of its own in this plan. The second classifies **resolve-only**, reason `code`
— `visit` confirms it exists by canonicalizing its real path and reports
`shouldWalkOnward: false`; it is never opened with the Read tool and nothing further is
walked from it.

## Two cycles back to already-visited nodes

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
also comes back `alreadyVisited: true` rather than a second root node under a second name:
a second cycle, this one back to the root itself rather than to `ROUTING.md`.

## What Step 5's report reads back

Step 5's `report` reads back six nodes total: the root and `ROUTING.md`, both
restructurable; `docs/conventions-crossrefs.md` and `docs/legacy-notes.md`, both
verify-only — a verify-only node is still walked, only not restructured;
`scripts/commit-lint.js`, resolve-only; and `~/work/some-project/CLAUDE.md`, whose class is
irrelevant next to its `scopeCrossing: true` — that flag alone is what kept it from ever
being opened. The excluded worktree entry is kept separately, never counted as a node. That
list is what the rule, pointer, and scope-crossing findings below are built from, not
memory of the individual `visit` calls it took to discover them.

## Move candidates and their inbound citations

Rules 5 and 6 (root) and 8 and 9 (`ROUTING.md`) are the four move candidates left standing
after conditions 1–3, so each pair's inbound-citation search runs next — a Grep sweep of
`$CLAUDE_CONFIG_DIR`, not a replay of the six nodes above. For rules 5 and 6, the search for
the root's own filename and its dotfiles alias turns up exactly the citation Step 2 already
walked past: `docs/legacy-notes.md`'s `` `~/.dotfiles/claude/CLAUDE.md` ``.
`classify-citation-hit-cli.js classify personal docs/legacy-notes.md` reports it verify-only
(not resolve-only) and sharing the root's personal scope, so `editable: true`; feeding that
into `decide-citation-action-cli.js` returns `update`. Rules 5 and 6 keep verdict `move`
into a new `docs/topic-file-naming.md`, and `docs/legacy-notes.md`'s citation is repointed
at that new file in the same change.

For rules 8 and 9, the search for `ROUTING.md` turns up a second hit the walk itself never
reached by any edge: `~/.claude/skills/lint-yaml/SKILL.md` mentions `` `ROUTING.md` `` in a
line about precedence — a skill invented for this fixture, not a claim about any skill this
pass has actually read. `classify-citation-hit-cli.js classify personal
~/.claude/skills/lint-yaml/SKILL.md` reports it resolve-only on its basename alone, before
scope is even considered — this pass has no standing to edit a skill's body regardless of
where it sits — so `editable: false`; `decide-citation-action-cli.js` returns `blocked`,
naming that one file in `blockingCitations`. Both rules 8 and 9 flip to verdict `stay`,
condition 4, rather than moving into the `docs/topic-file-lifecycle.md` their cluster would
otherwise have justified.

## The assembled plan

The plan's rule table has ten rows — the root's seven plus `ROUTING.md`'s three — all ten
ids present exactly once, and `check-plan` against
`{"ruleIds":["push-via-pr","squash-precedence","commit-msg-hook","yaml-indent","topic-file-name-collision","one-topic-file-per-subject","legacy-migration-script","specific-trigger-wins","topic-file-split-size","topic-file-nearby-preference"],"entries":[...ten entries, one per id...]}`
returns `{"ok": true, ...}` before anything is shown to the user as final. The pointer
list carries every citation collected from every node the walk opened — the root's six
plus `ROUTING.md`'s two plus `docs/conventions-crossrefs.md`'s two plus
`docs/legacy-notes.md`'s one — reviewed by hand alongside the rule table, per Step 5,
since `check-plan`'s invariant covers only rules. The scope-crossing findings list carries
one row: `~/work/some-project/CLAUDE.md`, cited from the root, its own scope **project**
against the root's fixed **personal** — reported so the user learns the two trees are
connected, and nothing more, since the pass never read across into it to learn anything
else.
