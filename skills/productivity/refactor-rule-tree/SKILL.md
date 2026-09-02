---
name: refactor-rule-tree
disable-model-invocation: true
argument-hint: "[path]"
description: Runs one placement-and-pointer pass over a rule tree — the personal global rule file by default, or a given root path, plus every file the walk reaches by import or mention edge. A rule inside an auto-loaded node gets a verdict: stay inline, move to a topic file, become a model-invoked skill or hook, or delete. A node reached without being auto-loaded keeps its structure untouched; code, configuration, memory files, and another skill's SKILL.md are only confirmed to exist, never opened. Every pointer checked gets live, dead, or unverifiable; an uncited target is separately reported unrouted. Presents one complete plan before writing anything, and applies it only after confirmation and a mechanical check that every rule appears exactly once; a dead pointer is cut only then, an unverifiable one never. Never compares two files' guidance against each other. Use when the user asks to refactor, restructure, reorganize, or clean up a CLAUDE.md or rule file, or types /refactor-rule-tree.
---

# refactor-rule-tree

Walk a rule tree from one root and decide, rule by rule, where each one belongs, and
pointer by pointer, whether it resolves. The walk reaches every file the root imports or
mentions, but what it *does* with a file it reaches depends on that file's class: the
placement decision applies only to a **restructurable** node (one the harness actually
auto-loads); a **verify-only** node keeps its own structure untouched and only has its
pointers checked; a **resolve-only** node — code, configuration, a memory file, another
skill's `SKILL.md` — is confirmed to exist and never opened at all. Nothing is written
until the whole plan, across every restructurable node the walk reached, is agreed.

Three properties hold on every run:

- **One plan, not a stream of edits.** A rule that moves is deleted from the node it lives
  in and added to the node it's moving to. Applying that piecemeal can leave a rule
  deleted from the old node and not yet written to the new one, mid-run, while the old
  node is still being read as live instruction. Presenting the whole plan first and
  writing only after one confirmation keeps that state from ever being *proposed* — it
  does not make Step 7's own writes atomic, so an interruption mid-execution is still a
  problem to notice and repair by re-reading the affected files, not one this design
  claims to prevent outright.
- **A mechanical invariant, not a promise.** Before that confirmation, and again after
  every amendment, a bundled script checks that every rule the plan itself claims to have
  read out of a restructurable node appears in the plan exactly once, carrying one of the
  four verdicts. A rule counted twice or zero times fails the check and blocks execution
  outright — this is not a suggestion the plan can override. What it cannot catch is a
  rule Step 2 missed enumerating in the first place, since the check only ever compares
  the plan against itself; Step 2 asks for a careful, complete read for exactly this
  reason.
- **Bounded by node class, not by a depth limit.** A resolve-only node is a dead end —
  confirmed to exist, mechanically, without the Read tool ever opening it, and never
  walked onward — so the queue of nodes still to open shrinks every time the walk reaches
  one, rather than needing an arbitrary depth cutoff to stop it. A visited set, keyed by
  real path, is the other half of the bound: a node already in it is never opened twice,
  which is what makes a cycle between files terminate and a diamond (two nodes both
  pointing at a third) get walked once rather than reported twice. A verify-only node is
  still walked the same as a restructurable one — its pointers get checked either way —
  but the placement decision applies only to the restructurable kind.

## Dependencies

Requires `node` to run the bundled invariant checker (`scripts/plan-invariant-cli.js`),
which every plan must pass before execution writes anything; the bundled pointer resolver
(`scripts/verify-pointers-cli.js`), which every pointer collected while walking is checked
through rather than a shell `find`/`grep`; and the bundled walk tracker
(`scripts/walk-tree-cli.js`), which canonicalizes every node the walk reaches, excludes
worktree and dependency directories, and keeps the visited set that bounds the walk and
stops a cycle from being read twice.

## When to use

- The user types `/refactor-rule-tree`.
- The user asks to refactor, restructure, reorganize, split up, or clean up a `CLAUDE.md`
  or a rule file, or says a rule file has grown too large or become a dumping ground.

## When not to use

- **Comparing two files' guidance against each other.** Two rule files (or a rule file and
  a skill/agent description) giving opposite or overlapping guidance is a **Contradiction**
  or an **Unresolved overlap** — a different question, owned by the rules auditor
  (`audit-rules`, where installed). This pass only ever asks whether one file, taken
  alone, is well organized; it never opens a second source to compare against.
- **Auditing a `SKILL.md`'s own compliance** — its structure, naming, or description
  quality. This pass only confirms that a skill it proposes exists or was created; judging
  whether it's well-written belongs to the skill auditor (`audit-skills`, where installed).
- **Structured configuration** — `settings.json`, permissions, hook wiring. This pass may
  *recommend* a rule become a hook (Step 4), but it never opens or edits configuration
  itself; wiring a recommended hook in is left entirely to the user.
- **Model-written memory files.** Those are self-correcting through their own mechanism,
  not hand-authored prose a placement decision applies to — reached as a resolve-only
  node, confirmed to exist, and never opened.
- **A resolve-only node's own content.** Code, structured configuration, and another
  skill's `SKILL.md` are confirmed to exist by the walk and never read for findings —
  auditing what's inside one of those belongs to a different pass entirely (the skill
  auditor, for a `SKILL.md`; nothing in this repo, for code or configuration, because
  prose placement logic doesn't apply to either).
- **Firing on its own.** `disable-model-invocation: true` is deliberate — a skill that
  rewrites rule files must never decide by itself that now is a good time to run.
- **Crossing between personal and project scope, or moving a rule whose citations live
  outside the tree this pass may edit.** Neither boundary is enforced by this pass yet —
  the walk itself has no notion of scope, and a move never checks who else cites the rule
  it's relocating. Treat every plan this pass produces as scoped to the root it was
  pointed at until that enforcement exists; a plan that reaches across a scope boundary or
  proposes a move without checking inbound citations should be caught by hand, not
  assumed safe.

## Step 1: Resolve the root file

```bash
node scripts/plan-invariant-cli.js resolve-root [path]
```

With no argument, this resolves the **personal global rule file** —
`$CLAUDE_CONFIG_DIR/CLAUDE.md`, or `~/.claude/CLAUDE.md` when that variable isn't set —
the same discovery convention used elsewhere in this setup, rather than a path hardcoded
to any one machine's layout. With a path argument, that path is the root instead, personal
or project-scoped either way — the user named it explicitly, and whatever it produces
lands through whatever review process edits to that file normally go through.

The command also reports `exists` and lists the other files already sitting beside the
root (`siblingFiles`). Stop and tell the user if `exists` is false — there is nothing to
read. Keep `siblingFiles` on hand for Step 3's unrouted check at the root and Step 4's
topic-file naming check.

## Step 2: Walk the tree, node by node

```bash
node scripts/walk-tree-cli.js init <statePath> <rootFilePath>
```

Seeds a scratch walk-state file with the root as the walk's only node so far — always
**restructurable**, matching Step 1's own resolution of it — and start a queue of nodes
still to open, seeded with just the root. Every node in this queue has already been
confirmed walkable; a resolve-only node, below, never joins it.

While the queue isn't empty, pop one node and read it with the Read tool, then:

- If the node is **restructurable**, break it into **rules** — the smallest pieces of
  guidance that could sensibly be judged and moved on their own. A rule is usually one
  bullet, one sentence of running prose, or one fenced convention; a heading that only
  introduces a group of rules is not itself a rule. Give each one a short, stable,
  kebab-case id derived from its content (e.g. `no-auto-commit`, `squash-before-merge`) —
  this id is what Step 5's invariant check tracks, and it has to stay unique across the
  *whole* tree, not just within one node, since Step 5 assembles one plan from every
  restructurable node the walk reaches; disambiguate a coincidental collision (e.g. two
  files that both happen to state a rule named `yaml-indent`) by folding a path fragment
  into the id rather than leaving two different rules sharing one identity.

  This is the one place the invariant check in Step 5 cannot help — it only confirms the
  plan is internally consistent with the list it was given, not that the list covers
  everything in the node — so re-scan the raw text once against the enumerated list before
  moving on, confirming nothing was skipped.
- If the node is **verify-only**, skip rule enumeration entirely — Step 4's placement
  decision has nothing to apply here, and the node's own structure is left exactly as
  found.

Either way, also collect every **pointer** out of the node just read: every `@`-import,
and every plain-text citation of a file path, wherever it appears in the prose. An import
edge (`@`-import) carries the target into context *if* this node's own content is itself
loaded; an import edge out of a verify-only node does not make its target auto-loaded,
since nothing loaded this node's own imports in the first place. A mention edge (anything
else) means the target is only ever read when something goes and opens it. Keep the exact
citation text, backticks and all — Step 3's classification runs on the literal string.

Run Step 3 against this node's pointers next, then for every `live` verdict it returns,
advance the walk:

```bash
node scripts/walk-tree-cli.js visit <statePath> <thisNodeRealPath> <resolvedTo> <import|mention>
```

`<resolvedTo>` is exactly the field Step 3's `live` verdict already computed for that
pointer — never a raw citation re-resolved here; a `dead` or `unverifiable` pointer has no
real target and is never passed to this command. It reports one of three outcomes:

- `excluded: true` — the target sits inside a worktree checkout or a dependency directory
  (`.git`, `node_modules`, and the like). Recorded so it's never reported twice, but never
  classified and never queued — a duplicated checkout must not double every finding.
- `alreadyVisited: true` — the target's real path is already in the walk state, whether a
  second pointer from a different node names the same file (a diamond) or a pointer leads
  back to a node already open (a cycle). Nothing new to queue, and nothing to report
  twice — this is what makes a cycle between files terminate rather than loop forever.
- a new `node`, classified **restructurable**, **verify-only**, or **resolve-only** by
  weighing the edge just walked against the parent node's own auto-loaded status (an
  import edge only carries auto-load forward when the parent was itself auto-loaded — a
  file merely mentioned doesn't get its own imports auto-loaded just because something
  opened it). Queue it only if `shouldWalkOnward` comes back `true`. A **resolve-only**
  result is a dead end: canonicalizing its real path *is* the existence check this pass
  performs on code, structured configuration, a memory file, or another skill's
  `SKILL.md` — it is never opened with the Read tool, and nothing about it is queued.

The walk ends when the queue empties on its own — no depth limit needed, per the bound
described above.

## Step 3: Verify every pointer

```bash
node scripts/verify-pointers-cli.js verify <nodeFilePath> <pointers.json>
```

Called once per node opened in Step 2, against that node's own path. Write the pointers
collected from it to a scratch JSON file — a plain array of the raw citation strings — and
pass it alongside the node's path. The script classifies each one mechanically, resolves
it against the filesystem, and returns one of three script-assignable verdicts:

- **live** — a well-formed, fully-qualified path that resolves, in that order, against the
  citing file's own directory, the repository root, or the user's home directory
  (`$CLAUDE_CONFIG_DIR`, `$CLAUDE_PROJECT_DIR`, `$HOME`, and a leading `~` are all expanded
  before any of the three roots is tried).
- **dead** — a well-formed, fully-qualified path that resolves against none of the three
  roots and doesn't complete against any file the repository actually contains either.
  Reserved for exactly this case — never for anything merely ambiguous, because a
  hand-rolled resolver that skipped this distinction produced seven false dead verdicts
  against a real repository and zero true ones.
- **unverifiable** — a glob, an angle-bracket placeholder, a bare filename from the
  rule-file family (`CLAUDE.md`, `SKILL.md`, `README.md`, and similar — ambiguous without a
  directory to anchor it), an extension-only mention, an unrecognized `$VARIABLE`, or a
  **partial path**: one missing leading directory segments that the script still found as
  the unique suffix of a real file elsewhere in the repository. Report a partial path's
  completed path in full — never cut back down to what the citation actually said.

The script also reports **unrouted** names, separately from the per-pointer list: any file
already sitting beside this node (from Step 1's `siblingFiles` at the root; the script
recomputes the same check against whichever node's path it was given for every other node)
that no `live` pointer from it ever resolves to. This is a target-shaped finding, not a
citation-shaped one, so it never appears as a verdict on a specific pointer — a
dead-pointer check alone would never surface it, since it only ever looks in the direction
of a citation that already exists, not at what else sits nearby uncited.

A fifth notion, **outdated** — a `live` target whose stated claim is no longer true — is
never produced by this script. Confirming a claim requires knowing the current skill and
agent set and whether it still holds, which is judgment, not a mechanical check; apply it
by hand to each `live` pointer while assembling the plan in Step 5.

Resolution runs entirely inside this script rather than a shell `find`/`grep`, so a shell
hook that rewrites search commands can't make a real file look like it never existed.

Only a **dead** verdict is ever a candidate for cutting, and only after Step 7's single
confirmation — the same gate every rule verdict goes through. An **unverifiable** pointer
is never offered for cutting under any circumstance, regardless of its reason: the fourth
verdict exists specifically so this pass is never asked to approve deleting a reference
that might still be correct. **unrouted** names and **outdated** claims are reported for
awareness only and are never cut by this pass — an unrouted target has nothing wrong with
it, and an outdated claim needs a rewrite, which is outside what a placement-and-pointer
pass does.

## Step 4: Decide a placement for every rule

Applies only to a rule enumerated out of a **restructurable** node in Step 2 — a
verify-only node's rules were never enumerated in the first place, so there is nothing
here for one to apply to. Every such rule gets exactly one of four verdicts: **stay**,
**move**, **skill**, or **delete**. Work through this order for each one.

### First, the router exemption — checked before anything else

A rule stating which of two pieces of guidance or two invocable units wins for a shared
situation (**precedence content**), or a rule stating what this file's own owner does
*not* handle and who does instead (**negative-jurisdiction content**), is never proposed
for extraction — unconditionally, regardless of how it scores against the four stay
conditions below. The reasoning is structural, not a judgment call: a router that isn't
already loaded can't route. If the file isn't read, there's no chance for a "read the
topic file for X" pointer to ever get followed, because the thing that would have decided
to follow it is exactly what got moved out. This check runs once, silently, and is never
re-proposed on a later run just because it was true on this one.

The *rationale* behind a routing decision — why one unit was picked over another, as
opposed to the bare statement of which one wins — is different: extracting it is an
**optional** offer, made once per matching rule, and dropped without complaint if
declined. Nothing is stored between runs to remember that it was declined; a future pass
over the same file is free to offer it again.

### Then, does it qualify to stay?

A rule **stays** — verdict `stay` — if any one of these four holds. Name which one applied
in the report; more than one may apply, but naming the first that does is enough.

1. **Near-universal trigger.** It's relevant to nearly every task run against this
   context, not just a narrow situation — so lazy-loading it would cost a lookup on
   almost every turn anyway, trading a token saving that never actually materializes for
   a reliability loss that does.
2. **Irreversible on a miss.** Missing it produces an artifact that can't be quietly
   undone — a bad commit, a force-push, a destructive shell command, a message sent to
   someone. A rule this load-bearing has to be read whether or not the moment calls for
   it, because there's no second chance to catch the miss.
3. **Small, with no intent to grow.** It's one line, is not a member of an obvious cluster
   with other rules, and there's no reason to expect siblings to accumulate around it. A
   topic file exists to be a citable destination worth the extra hop; a file holding one
   line someone will never add to is that hop with nothing behind it.
4. **Cited by path elsewhere.** Something else in this setup — a skill, an agent, a
   command, or another node the walk reached — names this rule's current file by path.
   Moving it would silently break that citation; this pass does not yet check for or fix
   up an inbound citation as part of a move (see When not to use). Leave the rule where
   the citation still finds it.

If none of the four holds, the rule is a candidate to leave the file. Which of the
remaining three verdicts it gets depends on what kind of thing it actually is.

### Move — to a topic file

A candidate becomes verdict `move` when it's a **reference**: something worth having
around but not worth loading into every session, and not narrow enough in its own trigger
to be worth a whole skill (see below). Group every rule getting this verdict by subject —
the subject can be anything the rules are actually about, not just code style — and
propose one topic file per group.

Only propose a *new* topic file once a group holds **two or more** rules. A file created
to hold a single relocated line has the same lookup cost as the line had inline, minus the
convenience of it already being there — it's the exact "cluster too small to justify its
own file" case Step 4's stay condition 3 already screens for on the way out; applying the
same bar again here on the way to a new destination keeps the two consistent. A single
qualifying rule with no others to join is left where stay condition 3 already puts it:
`stay`, not `move`.

Before proposing a name, check it against `siblingFiles` from Step 1 and against any
other topic file this same plan is proposing — a name already in use in scope for this
pass is a collision and needs a different name, not a proposal to overwrite.

When a rule moves, the pointer left behind in the root file must state an **observable
trigger phrase** — "when doing X, see `topic-file.md`" — never a bare mention ("see also:
`topic-file.md`"). A bare mention is prose with no attached condition, and prose with
nothing marking when it matters is exactly the kind of line a read skips without
consequence; a trigger phrase gives a concrete situation to check against instead, the
same way a skill's own description has to state a triggering situation to ever fire.

### Skill — model-invoked skill or hook

A candidate becomes verdict `skill` when its trigger is a specific, nameable situation —
"before every commit," "when opening a PR," "when a test file is added" — rather than a
general reference someone would look up. Within this verdict, propose one of two
mechanisms:

- **Model-invoked skill**, when getting it right still needs judgment applied to the
  specific situation. State the standing cost plainly in the proposal: an auto-invocable
  skill's name and description sit in context on every single turn regardless of whether
  its trigger ever fires — on the order of a hundred tokens per skill by the harness's own
  accounting — so this is a cost paid on every task, not just the ones the rule is about,
  and the proposal should let the user weigh that against leaving the rule inline.
- **Hook**, when the rule needs deterministic enforcement — the same check, run the same
  way, every time, with no room for a judgment call to skip it. State the trigger event
  and the check or action in the proposal. This pass never opens or edits configuration to
  wire the hook in (see When not to use) — the proposal states what the hook should do,
  and creating it is left to the user.

### Delete

A candidate becomes verdict `delete` only when it is fully redundant with a rule already
staying — the same instruction, stated twice — or when it refers to something the user
confirms no longer exists (a command, a tool, a convention that was retired). Never delete
a rule just because it didn't qualify for `stay`; the failure to qualify only rules out
`stay`, it says nothing about whether the guidance is still wanted. A rule that qualifies
for none of `stay`, `move`, or `skill`, and isn't confirmed dead, is left as `stay` by
default rather than deleted — the safe outcome when nothing else fits is to leave it where
it already works, not to remove it.

## Step 5: Assemble the plan and check it

```bash
node scripts/walk-tree-cli.js report <statePath>
```

Run this first and cross-check its node list against what Step 2's own walk produced by
hand — the state file, not memory carried across however many `visit` calls the walk took,
is the definitive record of which node landed in which class. A tree with only a handful
of nodes may never surface a mismatch this way, but a larger one is exactly where an
unnoticed skip would otherwise slip through.

Write the plan as one list, one row per rule enumerated across every restructurable node
the walk reached in Step 2: its id, which node it currently lives in, its current text (or
a short paraphrase), its verdict, and — for `stay`, the condition number from Step 4 that
applied; for `move`, the destination file and the trigger-phrase pointer being left
behind; for `skill`, the mechanism (model-invoked skill or hook) and, for a skill, the
standing cost statement; for `delete`, the reason.

Before showing this to the user, write `{ "ruleIds": [...], "entries": [{ "ruleId", "verdict" }, ...] }`
to a scratch file and run:

```bash
node scripts/plan-invariant-cli.js check-plan <path-to-that-file>
```

A non-zero exit means the plan is broken — a rule counted twice, a rule missing
altogether, an entry naming a rule that was never enumerated out of any restructurable
node, or a verdict outside the four above — and must be fixed before the plan is ever
shown as final. Present the check's own `duplicates`/`missing`/`unknown`/`invalidVerdict`
lists directly if any are non-empty; don't paper over which rule triggered it.

Alongside the rule table, write a second list, one row per pointer collected from every
node opened in Step 2 (restructurable and verify-only alike): its raw citation, which node
it was cited from, its kind (import or mention), and its verdict. For a `live` pointer,
apply the `outdated` judgment described in Step 3 here — mark it and say what changed if
the claim no longer holds; `outdated` never appears in the rule table or the invariant
check above, since it's a note on a pointer, not a rule verdict. For a `dead` pointer,
propose cutting it. For an `unverifiable` pointer carrying a `partial-path` reason, show
the completed path in full and propose nothing — the completion is informational, not an
edit this pass offers to make. List any `unrouted` names as-is; they name a gap next to
the citing node, not an action this pass takes. The invariant check above covers only the
rule table — the pointer list has no mechanical equivalent, so review it by hand with the
same care Step 2 asked for the rules.

## Step 6: Amend and discuss

Discussion and amendment are unlimited at this point — nothing has been written yet, so
there is nothing to undo. Re-run Step 5's check after every amendment, no matter how small
it looks; the invariant is what catches a rule quietly falling out during a renumbering or
a merge of two rows, not just during the first draft.

## Step 7: Confirm and execute

A single explicit confirmation triggers the whole plan at once — never a subset, and never
before the invariant check on the current version of the plan has passed.

- `stay` rules: no change.
- `move` rules: remove from the node the rule currently lives in, add to the (new or
  existing) topic file, and add the trigger-phrase pointer to that same node in the same
  change. This does not yet update a citation to the rule's old location sitting in some
  other node the walk reached (see When not to use) — condition 4 in Step 4 is what keeps
  a rule with a known inbound citation from ever reaching this branch in the first place.
- `skill` rules proposing a model-invoked skill: draft the skill's trigger and body from
  the rule's own text and confirm its intended location with the user — this pass doesn't
  assume any particular packaging convention, since one project's layout for a new skill
  is not every project's.
- `skill` rules proposing a hook: report the trigger event and the check/action; do not
  touch configuration.
- `delete` rules: remove from the node the rule currently lives in.
- `dead` pointers proposed for cutting: remove the citation from the node that cited it.
- `unverifiable` pointers: never cut, regardless of reason.
- `outdated` pointers and `unrouted` names: no edit — both are reported for awareness, and
  rewriting a stale claim is outside what this pass's placement-and-pointer decision
  covers.

## Worked example

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

The same file cites four paths. `@ROUTING.md`, sitting beside it, resolves against the
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
different path.

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

Step 5's `report` reads back five nodes total: the root and `ROUTING.md`, both
restructurable; `docs/conventions-crossrefs.md` and `docs/legacy-notes.md`, both
verify-only — a verify-only node is still walked, only not restructured; and
`scripts/commit-lint.js`, resolve-only. The excluded worktree entry is kept separately,
never counted as a node. That list is what the rule and pointer tables below are built
from, not memory of the individual `visit` calls it took to discover them.

The plan's rule table has five rows — the root's four plus `ROUTING.md`'s one — all five
ids present exactly once, and `check-plan` against
`{"ruleIds":["push-via-pr","squash-precedence","commit-msg-hook","yaml-indent","specific-trigger-wins"],"entries":[...five entries, one per id...]}`
returns `{"ok": true, ...}` before anything is shown to the user as final. The pointer
list carries every citation collected from every node the walk opened — the root's four
plus `ROUTING.md`'s two plus `docs/conventions-crossrefs.md`'s two plus
`docs/legacy-notes.md`'s one — reviewed by hand alongside the rule table, per Step 5,
since `check-plan`'s invariant covers only rules.
