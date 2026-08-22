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

## Commit messages

Every commit — human or agent — follows [Conventional Commits](https://www.conventionalcommits.org/): `type(scope): description`. Applies going forward only; existing history on `main` is untouched. Documentation only for now — nothing enforces this format via a git hook or CI.

### Type

One of:

- `feat` — a new skill, or new capability added to an existing one
- `fix` — corrects a skill, doc, or config that was wrong
- `docs` — documentation-only change (`README.md`, this file, `docs/`, skill prose)
- `style` — formatting/whitespace only, no content or logic change
- `refactor` — reorganizes skills or code with no behavior change
- `perf` — a performance improvement
- `test` — adds or changes tests
- `build` — build-system or dependency changes
- `ci` — CI configuration changes
- `chore` — tooling, config, or meta changes that don't fit elsewhere
- `revert` — reverts a previous commit; body states `Reverts commit <hash>.`

### Scope

Optional. When a commit touches one bucket or skill, scope it to the bucket name: `engineering` or `productivity`. Omit the scope for repo-wide changes (plugin manifest, marketplace config, top-level docs).

### Subject

Lowercase, imperative mood, no trailing period — `fix(engineering): correct broken skill link`, not `Fixed the broken link.`. Keep the whole `type(scope): description` line at or under 72 characters, aiming for 50. This applies regardless of what any message-generating tool defaults to — the convention in this file wins for commits in this repo.

### Body

Separated from the subject by a blank line, for any non-trivial change. Explains WHAT changed and WHY — never HOW; the diff already shows how.

### Footer

`Closes #<n>` or `Refs #<n>` when the commit closes or relates to a tracked GitHub issue (see `docs/agents/issue-tracker.md`). Omit when there's no related issue — most commits won't have one.

Breaking changes use a `!` after the type/scope (`feat(engineering)!: ...`) and/or a `BREAKING CHANGE:` footer, per the spec. This repo doesn't cut releases yet, so the marker is currently inert — it costs nothing to support now and saves a future question.

## Agent skills

Conventions for the [mattpocock/skills](https://github.com/mattpocock/skills) engineering skills (installed separately, not part of this plugin) when they're used to develop this repo — not skills this repo itself ships.

### Issue tracker

Issues live in this repo's GitHub Issues (`bgutschke/skills`), managed via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default canonical label vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`), used as-is. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` at the repo root, created lazily when a term or decision first needs it. See `docs/agents/domain.md`.
