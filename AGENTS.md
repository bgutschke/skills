Skills are organized into bucket folders under `skills/`:

- `engineering/`: daily code work
- `productivity/`: daily non-code workflow tools

Every skill must have a reference in its bucket's `README.md` and the top-level `README.md`, and an entry in `.claude-plugin/plugin.json`'s `skills` array (the plugin ships exactly what's listed there).

To add a skill:

1. Create `skills/<bucket>/<skill-name>/SKILL.md`.
2. Add `./skills/<bucket>/<skill-name>` to `.claude-plugin/plugin.json`'s `skills` array.
3. List it, name linked to its `SKILL.md`, in the bucket's `README.md` (under **User-invoked** or **Model-invoked**) and in the top-level `README.md`.
4. Run `claude plugin validate . --strict`.

A **user-invoked** skill only responds to an explicit command (`disable-model-invocation: true` in its frontmatter). A **model-invoked** skill can also be reached automatically when the task fits. Decide which a new skill is before writing it.

`.claude-plugin/marketplace.json` makes this repo its own single-plugin marketplace. This repo is public, but it isn't listed on Claude Code's official marketplace (`anthropics/claude-plugins-official`) — that one is partnership-gated with no open submission path. The self-hosted marketplace is the install route for now. Once there's at least one real skill, submit to the community marketplace (`anthropics/claude-plugins-community`, via the plugin directory submission form) for a discoverable, auto-syncing listing; until then, submitting would just be an empty plugin.
