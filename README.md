# bgutschke's skills

Personal agent skills for real engineering. Modeled on [mattpocock/skills](https://github.com/mattpocock/skills) — small, composable, editable, not vibe coding.

## Installation

Two ways in, same two philosophies as the upstream repo this is modeled on: a **Claude Code plugin** subscribes to a managed, read-only bundle that updates when this repo is pushed to; the **installer script** copies editable skill files into a project to hack on directly. Pick one per project — installing both leaves every skill twice.

### Claude Code: the plugin

This repo isn't listed on Claude Code's official marketplace (`anthropics/claude-plugins-official` is partnership-gated, no open submission path). It marks itself as its own marketplace instead (`.claude-plugin/marketplace.json`):

```bash
/plugin marketplace add bgutschke/skills
/plugin install bgutschke-skills@bgutschke
```

Being public, this needs no git credentials to add or update. Once at least one real skill exists here, the plan is to submit to Claude Code's open **community marketplace** (`anthropics/claude-plugins-community`) for automatic discovery and nightly-synced updates — until then, this self-hosted route is how you install it.

### Other agents, or to edit a skill in place

```bash
gh repo clone bgutschke/skills ~/code/bgutschke-skills   # once per machine
~/code/bgutschke-skills/scripts/install.sh <skill-name> --target .claude/skills
```

Run `scripts/list-skills.sh` from inside the clone to see what's available. This writes ordinary files into the target project; nothing updates behind your back.

## Structure

- `skills/engineering/` — daily code work
- `skills/productivity/` — daily non-code workflow tools

Every skill lives at `skills/<bucket>/<skill-name>/SKILL.md` and must be listed in `.claude-plugin/plugin.json`'s `skills` array to ship with the plugin. See `CLAUDE.md` for the full convention.

## Status

Skeleton only — no skills committed yet. Community-marketplace submission is planned once that changes.

## License

MIT — see [`LICENSE`](./LICENSE).
