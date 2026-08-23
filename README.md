# bgutschke's skills

Personal agent skills for real engineering. Modeled on [mattpocock/skills](https://github.com/mattpocock/skills) — small, composable, editable, not vibe coding.

## Installation

Two ways in — pick one per project; installing both leaves every skill twice. A **Claude Code plugin** subscribes to a managed, read-only bundle; **[skills.sh](https://skills.sh/bgutschke/skills)** copies editable files into your project instead.

### Claude Code: the plugin

```bash
/plugin marketplace add bgutschke/skills
/plugin install skills@bgutschke
```

Update: `/plugin marketplace update bgutschke-skills`, or enable auto-update via `/plugin` → **Marketplaces** → this marketplace → **Enable auto-update**.

### Other agents, or to edit a skill in place

```bash
npx skills@latest add bgutschke/skills
```

Update: `npx skills update` — re-fetches directly from GitHub, no manual clone step. Add `-g` to install globally instead of per-project, or `-a <agent>` to target a specific agent.

## Structure

- `skills/engineering/` — daily code work
- `skills/productivity/` — daily non-code workflow tools

Every skill lives at `skills/<bucket>/<skill-name>/SKILL.md` and must be listed in `.claude-plugin/plugin.json`'s `skills` array to ship with the plugin. See `CLAUDE.md` for the full convention.

## Skills

- **engineering**
  - [to-pr-description](./skills/engineering/to-pr-description/SKILL.md) — fill in the
    blanks of an already-open PR's description from its own
    `.github/PULL_REQUEST_TEMPLATE.md`.

## License

MIT — see [`LICENSE`](./LICENSE).
