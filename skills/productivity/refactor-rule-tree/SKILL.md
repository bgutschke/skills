---
name: refactor-rule-tree
disable-model-invocation: true
argument-hint: "[path]"
description: Runs one placement pass over a single rule file — the personal global rule file by default, or a given path — and decides, for every rule inside it, whether it stays inline, moves to a topic file, becomes a model-invoked skill or a deterministic hook, or gets deleted. Presents one complete plan before writing anything, takes unlimited amendment and discussion, and only applies it after a single confirmation and a mechanical check that every rule from the source file appears in the plan exactly once. Never compares two files' guidance against each other, and never touches SKILL.md compliance, structured configuration, or memory files. Use when the user asks to refactor, restructure, reorganize, or clean up a CLAUDE.md or rule file, or types /refactor-rule-tree.
---

# refactor-rule-tree

Read one rule file end to end and decide, rule by rule, where it belongs. This is the
thinnest complete version of the pass: one file, no traversal of files it points to, no
checking whether those pointers even resolve. What it does do, completely, is the
placement decision itself — and it never writes anything until the whole plan is agreed.

Three properties hold on every run:

- **One plan, not a stream of edits.** A rule that moves is deleted from the file it lives
  in and added to the file it's moving to. Applying that piecemeal can leave a rule
  deleted from the old file and not yet written to the new one, mid-run, while the old
  file is still being read as live instruction. Presenting the whole plan first and
  writing only after one confirmation keeps that state from ever being *proposed* — it
  does not make Step 6's own writes atomic, so an interruption mid-execution is still a
  problem to notice and repair by re-reading the affected files, not one this design
  claims to prevent outright.
- **A mechanical invariant, not a promise.** Before that confirmation, and again after
  every amendment, a bundled script checks that every rule the plan itself claims to have
  read out of the root file appears in the plan exactly once, carrying one of the four
  verdicts. A rule counted twice or zero times fails the check and blocks execution
  outright — this is not a suggestion the plan can override. What it cannot catch is a
  rule Step 2 missed enumerating in the first place, since the check only ever compares
  the plan against itself; Step 2 asks for a careful, complete read for exactly this
  reason.
- **Single file, by design.** This pass never opens a file the root merely mentions.
  Deciding where a rule belongs and verifying that a pointer resolves are two different
  jobs; this pass does only the first, and only for the one file it was pointed at. A
  pass that also walks and verifies the files this one only leaves pointers toward is a
  natural next step, not something this one attempts.

## Dependencies

Requires `node` to run the bundled invariant checker
(`scripts/plan-invariant-cli.js`), which every plan must pass before Step 6 writes
anything.

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
  *recommend* a rule become a hook (Step 3), but it never opens or edits configuration
  itself; wiring a recommended hook in is left entirely to the user.
- **Model-written memory files.** Those are self-correcting through their own mechanism,
  not hand-authored prose a placement decision applies to.
- **More than one file.** A rule file that imports or mentions another file is not walked
  here — this pass reasons only about the rules physically inside the one file it was
  pointed at, and about whether a pointer *resolves* is not asked at all this pass.
- **Firing on its own.** `disable-model-invocation: true` is deliberate — a skill that
  rewrites rule files must never decide by itself that now is a good time to run.

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
read. Keep `siblingFiles` on hand for Step 3's topic-file naming check.

## Step 2: Read the file and enumerate every rule

Read the root file with the Read tool. Break it into **rules** — the smallest pieces of
guidance that could sensibly be judged and moved on their own. A rule is usually one
bullet, one sentence of running prose, or one fenced convention; a heading that only
introduces a group of rules is not itself a rule. Give each one a short, stable, kebab-case
id derived from its content (e.g. `no-auto-commit`, `squash-before-merge`) — this id is
what Step 4's invariant check tracks, so pick something a re-read of the same file would
regenerate the same way, not a row number that shifts if a line above it changes.

This enumeration is the one place the invariant check in Step 4 cannot help: the check
only confirms the plan is internally consistent with whatever list it was given, not that
the list itself covers everything in the file. Before moving on, re-scan the raw text once
against the enumerated list, line by line, and confirm nothing — including a bullet inside
a fenced block, or a rule folded into the middle of a longer sentence — was skipped.

## Step 3: Decide a placement for every rule

Every rule gets exactly one of four verdicts: **stay**, **move**, **skill**, or **delete**.
Work through this order for each one.

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
   command — names this rule's current file by path. Moving it would silently break that
   citation, and this pass never touches anything outside the one file it was pointed at,
   so it can't fix the citation up at the same time. Leave the rule where the citation
   still finds it.

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
own file" case Step 3's stay condition 3 already screens for on the way out; applying the
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

## Step 4: Assemble the plan and check it

Write the plan as one list, one row per rule from Step 2: its id, its current text (or a
short paraphrase), its verdict, and — for `stay`, the condition number from Step 3 that
applied; for `move`, the destination file and the trigger-phrase pointer being left
behind; for `skill`, the mechanism (model-invoked skill or hook) and, for a skill, the
standing cost statement; for `delete`, the reason.

Before showing this to the user, write `{ "ruleIds": [...], "entries": [{ "ruleId", "verdict" }, ...] }`
to a scratch file and run:

```bash
node scripts/plan-invariant-cli.js check-plan <path-to-that-file>
```

A non-zero exit means the plan is broken — a rule counted twice, a rule missing
altogether, an entry naming a rule that was never in the file, or a verdict outside the
four above — and must be fixed before the plan is ever shown as final. Present the check's
own `duplicates`/`missing`/`unknown`/`invalidVerdict` lists directly if any are non-empty;
don't paper over which rule triggered it.

## Step 5: Amend and discuss

Discussion and amendment are unlimited at this point — nothing has been written yet, so
there is nothing to undo. Re-run Step 4's check after every amendment, no matter how small
it looks; the invariant is what catches a rule quietly falling out during a renumbering or
a merge of two rows, not just during the first draft.

## Step 6: Confirm and execute

A single explicit confirmation triggers the whole plan at once — never a subset, and never
before the invariant check on the current version of the plan has passed.

- `stay` rules: no change.
- `move` rules: remove from the root file, add to the (new or existing) topic file, and
  add the trigger-phrase pointer to the root file in the same change.
- `skill` rules proposing a model-invoked skill: draft the skill's trigger and body from
  the rule's own text and confirm its intended location with the user — this pass doesn't
  assume any particular packaging convention, since one project's layout for a new skill
  is not every project's.
- `skill` rules proposing a hook: report the trigger event and the check/action; do not
  touch configuration.
- `delete` rules: remove from the root file.

## Worked example

A four-rule personal `CLAUDE.md`:

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
The plan for this file is four rows, all four ids present exactly once, and
`check-plan` against `{"ruleIds":["push-via-pr","squash-precedence","commit-msg-hook","yaml-indent"],"entries":[...four entries, one per id...]}`
returns `{"ok": true, ...}` before anything is shown to the user as final.
