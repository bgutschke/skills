# Skills

Personal agent skills for real engineering. Modeled on [mattpocock/skills](https://github.com/mattpocock/skills) — small, composable, editable, not vibe coding.

## Installation

Two ways in — pick one per project; installing both leaves every skill twice. A **Claude Code plugin** subscribes to a managed, read-only bundle; **[skills.sh](https://skills.sh/bgutschke/skills)** copies editable files into your project instead.

### Claude Code: the plugin

```bash
/plugin marketplace add bgutschke/skills
/plugin install bgutschke-skills@bgutschke
```

Update: `/plugin marketplace update bgutschke`, or enable auto-update via `/plugin` → **Marketplaces** → **bgutschke** → **Enable auto-update**.

### Other agents, or to edit a skill in place

```bash
npx skills@latest add bgutschke/skills
```

Update: `npx skills update` — re-fetches directly from GitHub, no manual clone step. Add `-g` to install globally instead of per-project, or `-a <agent>` to target a specific agent.

## Structure

- `skills/engineering/` — daily code work
- `skills/productivity/` — daily non-code workflow tools

Every skill lives at `skills/<bucket>/<skill-name>/SKILL.md` and must be listed in `.claude-plugin/plugin.json`'s `skills` array to ship with the plugin. See `CLAUDE.md` for the full convention.

## Available skills

- **engineering**
  - [to-pr](./skills/engineering/to-pr/SKILL.md) — open a new PR (draft by default) from
    the current branch, or fill in an already-open PR's description from its own
    `.github/PULL_REQUEST_TEMPLATE.md`.
- **productivity**
  - [audit-rules](./skills/productivity/audit-rules/SKILL.md) — read every active rule
    file and installed skill/agent description and report contradictions or unresolved
    overlaps between them.
  - [curate-memory](./skills/productivity/curate-memory/SKILL.md) — run one curation pass
    over the current project's memory store, writing a candidate store and a cited report
    beside it without ever modifying the input.
  - [refactor-rule-tree](./skills/productivity/refactor-rule-tree/SKILL.md) — run one
    placement pass over a single rule file, deciding for every rule whether it stays,
    moves to a topic file, becomes a skill or hook, or gets deleted, and apply the plan
    only after confirmation.
  - [renovate-triage](./skills/productivity/renovate-triage/SKILL.md) — read every open
    Renovate PR, or one given by number/URL, for its changelog, release notes, and CI
    status, and post a risk verdict comment per PR.

## License

MIT — see [`LICENSE`](./LICENSE).
