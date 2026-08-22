# bgutschke's skills

Personal agent skills for real engineering. Modeled on [mattpocock/skills](https://github.com/mattpocock/skills) — small, composable, editable, not vibe coding.

## Installation

Two ways in, same two philosophies as the upstream repo this is modeled on: a **Claude Code plugin** subscribes to a managed, read-only bundle that updates when this repo is pushed to; **[skills.sh](https://skills.sh/bgutschke/skills)** copies editable skill files into a project to hack on directly. Pick one per project — installing both leaves every skill twice.

### Claude Code: the plugin

This repo isn't listed on Claude Code's official marketplace (`anthropics/claude-plugins-official` is partnership-gated, no open submission path). It marks itself as its own marketplace instead (`.claude-plugin/marketplace.json`):

```bash
/plugin marketplace add bgutschke/skills
/plugin install skills@bgutschke
```

Being public, this needs no git credentials to add or update. Once at least one real skill exists here, the plan is to submit to Claude Code's open **community marketplace** (`anthropics/claude-plugins-community`) for automatic discovery and nightly-synced updates — until then, this self-hosted route is how you install it.

### Other agents, or to edit a skill in place

```bash
npx skills@latest add bgutschke/skills --copy
```

`--copy` writes the skills you pick into your project as ordinary, editable files — nothing updates behind your back. Drop it to symlink instead (skills CLI's own default): one canonical copy, refreshed in place with `npx skills update`, which behaves more like the plugin's "subscribe" model than "edit in place." Add `-a <agent>` to target a specific agent, or `-g` to install globally instead of per-project. Works the same whether this repo is public or private — no local clone needed either way.

## Structure

- `skills/engineering/` — daily code work
- `skills/productivity/` — daily non-code workflow tools

Every skill lives at `skills/<bucket>/<skill-name>/SKILL.md` and must be listed in `.claude-plugin/plugin.json`'s `skills` array to ship with the plugin. See `CLAUDE.md` for the full convention.

## Status

Skeleton only — no skills committed yet. Community-marketplace submission is planned once that changes.

## License

MIT — see [`LICENSE`](./LICENSE).
