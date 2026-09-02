# Scope and edit authority

Referenced from `SKILL.md`'s "Scope and edit authority" section: why authorization follows
scope rather than reachability, and how this pass's posture diverges from the rules
auditor's.

**Authorization follows scope, not reachability**: a node many hops from the root is
exactly as editable as one sitting right beside it, provided the two share a scope, and a
node one hop away is not editable at all if it doesn't. Restricting edit authority to the
root alone — the tightest rule that would still keep the pass out of the wrong scope —
would make it useless at the size a project tree actually reaches: a rule worth moving
almost always lives in a topic file the root only mentions, not in the root itself, so a
pass that could read a 37-file tree but write to only one file in it would report findings
everywhere and act on almost none of them.

A default run resolves its root to the personal file in Step 1, which fixes the whole
pass's scope to personal the moment Step 2's `init` runs; a project file it happens to
reach through some pointer is a scope crossing under that fixed value, so it is never
opened or edited, regardless of how the pointer was worded or how deliberately it was
written.

This diverges from the rules auditor's own posture, which refuses to propose an edit
against any project-scoped file, full stop — a tool that read a shared file only
*incidentally*, while auditing something unrelated to that file, has no standing to rewrite
it without a person deciding to point a tool at it. This pass differs in exactly the case
that posture doesn't cover: its root is never discovered incidentally, it's the one file
the user named directly as this command's own argument, and every edit the pass produces
against it lands through the same pull-request review any other change to that file
already goes through. That review is what replaces the missing per-run judgment call the
auditor's stricter rule exists to avoid — an explicitly named root plus the repo's own PR
review stands in for the auditor's blanket refusal; it is not a quiet exception to it, and
it extends no further than the root scope it was granted for.
