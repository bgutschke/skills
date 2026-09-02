# Adding a skill

Skills are organized into bucket folders under `skills/`:

- `engineering/`: daily code work
- `productivity/`: daily non-code workflow tools

Every skill must have a reference in its bucket's `README.md` and the top-level `README.md`, and an entry in `.claude-plugin/plugin.json`'s `skills` array (the plugin ships exactly what's listed there). `plugin.json`'s `version` field is owned by the release pipeline (`release.config.js`) — never hand-edit it when adding a skill.

To add a skill:

1. Create `skills/<bucket>/<skill-name>/SKILL.md`.
2. Add `./skills/<bucket>/<skill-name>` to `.claude-plugin/plugin.json`'s `skills` array.
3. List it, name linked to its `SKILL.md`, in the bucket's `README.md` (under **Manual-only** or **Also auto-invocable**) and in the top-level `README.md`.
4. Run `claude plugin validate . --strict`.

A **user-invoked** skill only responds to an explicit command (`disable-model-invocation: true` in its frontmatter). A **model-invoked** skill can also be reached automatically when the task fits. Decide which a new skill is before writing it.
