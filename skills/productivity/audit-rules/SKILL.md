---
name: audit-rules
disable-model-invocation: true
description: Reads every active rule file and installed skill/agent description, and reports contradictions and unresolved overlaps between them, proposing edits only to files the user can edit directly.
---

# Audit rules

Read every rule file and invocable-unit (skill/agent) description that could affect a
session, and report two kinds of defect: **Contradiction** — two sources giving opposite
guidance for the same trigger — and **Unresolved overlap** — two auto-invocable units
that could both plausibly fire for the same request, with no stated precedence between
them. This is a read-broad, write-narrow tool: it reads everything, but only ever
proposes edits to files the user can edit directly — their own personal rule files, and
skills/agents they author themselves — never to project-shared, third-party, or managed-
policy files, since those are owned by more people than whoever is running this skill,
and a single contributor's tool making unreviewed proposals against them would exceed
what any one person should decide alone.

## When to use

- The user asks to audit, review, or check their rules, `CLAUDE.md` files, or installed
  skills/agents for contradictions, conflicts, or overlap.
- The user types `/audit-rules`.

## When not to use

- Auditing auto-memory / feedback files (`~/.claude/projects/*/memory/*.md`) — those are
  model-authored and self-correcting differently than a hand-authored rule file; out of
  scope for this skill.
- Auditing `settings.json` permission or hook configuration — that's structured config,
  not prose guidance, and needs different contradiction logic than this skill applies.
- A request to audit only one file, or one skill/agent pair — this always runs the full
  active set. There is no partial-scope mode; a routine `/audit-rules` always means a
  full sweep.

## Read scope

Gather all of the following before comparing anything. Missing categories (e.g. no
managed-policy file on a non-enterprise machine) are expected — report zero found for
that category rather than inventing content.

**Rule files**

1. Personal: `~/.claude/CLAUDE.md` and `~/.claude/rules/*.md` — the auditor's only edit
   target.
2. Project: `./CLAUDE.md`, `./.claude/rules/*.md`, and the repo's own `CLAUDE.local.md`
   if present — resolved from the current working directory's project root. Read-only;
   never an edit target, even when a finding's other side is personal. A symlink (this
   repo's own `CLAUDE.md -> AGENTS.md`) counts as the file it points to.
3. Managed-policy: check for a `CLAUDE.md`/`rules/*.md` colocated with the platform's
   managed-settings directory — macOS `/Library/Application Support/ClaudeCode/`, Linux
   `/etc/claude-code/`, Windows `C:\ProgramData\ClaudeCode\`. Most machines have none.
4. For every file found in 1–3, follow its own `@path` imports (e.g. `@ROUTING.md`)
   resolved relative to the importing file's directory, and read those in too — an
   imported file inherits the scope (personal/project/managed) of whatever imported it.

**Invocable units (skills and agents)**

5. Start from what this session already surfaced: the skill listing and the Agent tool's
   agent-type listing already in context give a live, deduplicated set of descriptions —
   use them as the starting point rather than re-deriving the same list from disk.
6. Cross-check each one's actual frontmatter, since the prose listing can hint at but
   doesn't authoritatively state `disable-model-invocation`. Read the source `SKILL.md`
   from `~/.claude/skills/*/`, `./.claude/skills/*/`, and every *enabled* plugin's
   `skills/**/SKILL.md` under `~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/`
   — cross-reference `~/.claude/plugins/installed_plugins.json` for which plugins are
   actually enabled, so a cached-but-disabled plugin's skills aren't audited as if live.
   Do the same for agents: `~/.claude/agents/*.md`, `./.claude/agents/*.md`, and each
   enabled plugin's `agents/*.md`.
7. Classify each unit's overlap-check eligibility: a skill is exempt when its frontmatter
   sets `disable-model-invocation: true`. An agent is exempt when its own description
   states it's delegate-initiated, advisory-only, or otherwise never auto-invoked — or
   when a routing doc the user maintains (e.g. `ROUTING.md`) documents it as manual-only.
   Exemption applies **only** to the overlap check in the next section — an exempt unit
   is still compared for Contradictions and for stale references (step 9).

## Comparing for defects

8. **Contradiction** — compare every pair of rule files, and every pair of invocable-unit
   descriptions, for opposite guidance triggered by the same situation (e.g. one says
   "always squash before merging," another says "never squash when merging"). Two pieces
   of guidance about *different* triggers are not a contradiction even if topically
   related.
9. **Unresolved overlap** — among invocable units *not* exempt per step 7, compare every
   pair's trigger conditions. If both could plausibly fire for the same request and no
   rule file states which one should win, flag it — even when neither unit's own
   guidance is individually wrong. This is a carving defect: verbs should not overlap,
   and when they do, something needs to state the precedence.
10. **Stale references** — while reading each unit in step 6, note any reference (by
    name) to another skill or agent that isn't in the current active set from step 5 —
    evidence it was renamed or removed. Report this as its own line, distinct from the
    two headline categories; it survives even for units exempt from the overlap check.

## Determining the fix, per finding

11. If the finding's only sensible edit target is a personal rule file, or a skill/agent
    the user authored, propose the fix as an ordinary `Edit` tool call — the harness's
    own permission prompt is the entire confirmation mechanism; do not build a separate
    one.
12. If the finding is a Contradiction whose only editable side is a project-shared,
    third-party, or managed-policy file, propose **no diff** against that file, ever.
    Report the finding with whichever alternative applies:
    - Third-party skill/agent → note that the actionable lever is tightening the user's
      own `ROUTING.md`/`CLAUDE.md` to disambiguate on their side.
    - Managed-policy file → note that this needs escalation to whoever administers the
      policy; there is no unilateral fix.
    - If the *other* side is a personal file, propose the edit there instead — the
      personal file is always in scope for a diff even when the counterpart isn't.
13. If the finding is an Unresolved overlap between two units the user owns, propose the
    fix as a carving addition — typically a new row in the user's own `ROUTING.md`
    stating which unit takes precedence for the shared trigger. If one side is
    third-party, the same third-party-note rule from step 12 applies; no edit lands on
    the third-party unit.

## Reporting

14. Report directly in the conversation — no persistent report file or audit log.
15. Keep **Contradiction** and **Unresolved overlap** as two visibly separate headed
    sections so a real disagreement is never conflated with a carving gap where nobody's
    guidance is actually wrong. Add a brief third section for anything from step 10
    (stale references) only when one was found.
16. For each finding, name the two sources, the shared trigger, and the specific
    disagreement or overlap — then either the proposed `Edit` call, or the report-only
    note from step 12/13.

## Worked example

Dry run against a constructed six-fixture set — no unit-test seam exists for a
pure-prose skill, so this dry run stands in for one, covering every case the
read/write-authority split needs to get right:

- `personal/CLAUDE.md` — "Always squash commits before merging a PR," "Always use spaces
  for indentation," "Never add a `Signed-off-by` trailer."
- `personal/rules/no-auto-commit.md` — "Never auto-commit; only commit when the user
  explicitly asks."
- `project/CLAUDE.md` — "Never squash commits when merging a PR," "Always use tabs for
  indentation."
- `managed-policy/CLAUDE.md` — "All commits made by an agent must include a
  `Signed-off-by` trailer."
- Third-party skill `auto-commit-helper` — "Fires after every file edit to automatically
  commit the change... without being asked."
- Two user-authored auto-invocable skills, `deploy-helper` ("Fires when CI reports a
  flaky test...") and `diagnose-ci-failure` ("Fires when CI reports a test failure...").
- A third user-authored skill, `legacy-deploy`, `disable-model-invocation: true`, also
  triggered by a flaky test, whose body hands off to a skill named `rollback-helper` —
  which does not exist anywhere in the active set.

Running steps 8–16 against this set produced:

**Contradiction**

1. `personal/CLAUDE.md` ("always squash") vs. `project/CLAUDE.md` ("never squash"), same
   trigger (merging a PR). Edit target: `personal/CLAUDE.md` only — proposed narrowing it
   to "squash by default, but follow the project's own convention when one is stated,"
   since the project file is never a target.
2. `personal/CLAUDE.md` ("always spaces") vs. `project/CLAUDE.md` ("always tabs"), same
   trigger (indentation). Same treatment: edit proposed on the personal file only, to
   defer to a stated project convention.
3. `personal/rules/no-auto-commit.md` vs. third-party `auto-commit-helper`. Neither side
   is a valid edit target on the third-party skill, so: no diff proposed against it;
   reported with a note that the actionable fix is tightening `personal/CLAUDE.md` (or a
   `ROUTING.md`-style rule) to explicitly rule out that skill firing.
4. `personal/CLAUDE.md` ("never `Signed-off-by`") vs. `managed-policy/CLAUDE.md`
   ("always `Signed-off-by`"). No edit target exists on the managed file; reported with a
   note to escalate to the policy's administrator.

**Unresolved overlap**

5. `deploy-helper` and `diagnose-ci-failure` — both auto-invocable, both could fire for
   "CI reports a flaky test" (a flaky test is a test failure), and no rule file states
   which one should run first. Both are user-authored, so the proposed fix is a new
   `ROUTING.md` row assigning the flaky-test trigger to one of them explicitly.
   `legacy-deploy` shares the same trigger but is exempt from this check —
   `disable-model-invocation: true` means it never competes for an auto-fire decision.

**Other issues found**

6. `legacy-deploy` references `rollback-helper` by name, which is not in the active
   skill/agent set — flagged as a stale reference (most likely renamed or removed) even
   though `legacy-deploy` was exempt from the overlap check above.

Two contradictions (1–2) got direct `Edit` proposals against the personal file; two
(3–4) got report-only findings with the alternative each one actually has; the overlap
finding (5) got an `Edit` proposal against `ROUTING.md`; and the stale reference (6) was
called out on its own even though the unit carrying it was exempt from half the checks.
That's the full split the read-broad, write-narrow design is meant to produce.
