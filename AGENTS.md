When adding a new skill to this repo, see `docs/adding-a-skill.md` for the required structure, references, and invocation-mode decision.

See `CODING_STANDARDS.md` for the quality bar a skill must meet — required `SKILL.md` structure, style rules, and the full pre-merge checklist.

`.claude-plugin/marketplace.json` makes this repo its own single-plugin marketplace. This repo is public, but it isn't listed on Claude Code's official marketplace (`anthropics/claude-plugins-official`) — that one is partnership-gated with no open submission path. The self-hosted marketplace is the install route for now. Once there's at least one real skill, submit to the community marketplace (`anthropics/claude-plugins-community`, via the plugin directory submission form) for a discoverable, auto-syncing listing; until then, submitting would just be an empty plugin.

## Commit messages

Every commit — human or agent — follows [Conventional Commits](https://www.conventionalcommits.org/): `type(scope): description`. Applies going forward only; existing history on `main` is untouched. Enforced on every pull request by commitlint in CI (`.github/workflows/validate.yml`), and consumed directly by `semantic-release` (`release.config.js`) to decide what ships in each release — getting the type right isn't just style anymore.

### Type

One of:

- `feat` — a new skill, or new capability added to an existing one
- `fix` — corrects a skill, the plugin manifest (`plugin.json`/`marketplace.json`), or a doc that was wrong
- `docs` — documentation-only change (`README.md`, this file, `docs/`, skill prose)
- `style` — formatting/whitespace only, no content or logic change
- `refactor` — reorganizes skills or code with no behavior change
- `perf` — a performance improvement
- `test` — adds or changes tests
- `build` — build-system or dependency changes
- `ci` — CI configuration changes
- `chore` — tooling, config, or meta changes that don't fit elsewhere
- `revert` — reverts a previous commit; body states `Reverts commit <hash>.`

`feat`, `fix`, and `perf` are release-triggering: `semantic-release` bumps a version and cuts a GitHub Release from them (see #10). Reserve them for changes to what the plugin actually ships — skills, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`. A change to the release pipeline itself (a workflow, `release.config.js`, `scripts/sync-plugin-version.js`, a `package.json` dependency bump) is `build`/`ci`/`chore` even when it fixes a bug in that tooling — it changes nothing a consumer receives, so it shouldn't cut a release.

### Scope

Optional, and drawn from one of three independent vocabularies — a commit uses at most one value from any of them, never combining two, and picks the most specific one that applies. See `docs/commit-scope-vocabulary.md` for the full per-vocabulary definitions and how the enum is enforced.

### Subject

Lowercase, imperative mood, no trailing period — `fix(engineering): correct broken skill link`, not `Fixed the broken link.`. Keep the whole `type(scope): description` line at or under 72 characters, aiming for 50. This applies regardless of what any message-generating tool defaults to — the convention in this file wins for commits in this repo.

### Body

Separated from the subject by a blank line, for any non-trivial change. Explains WHAT changed and WHY — never HOW; the diff already shows how.

### Footer

When a commit closes or relates to a tracked GitHub issue, see `docs/commit-footer-issue-refs.md` for the footer syntax, the body/footer split, and the Closes-vs-Refs test.

Breaking changes use a `!` after the type/scope (`feat(engineering)!: ...`) and/or a `BREAKING CHANGE:` footer, per the spec. `semantic-release` reads this as a major version bump.

## Agent skills

Conventions for the [mattpocock/skills](https://github.com/mattpocock/skills) engineering skills (installed separately, not part of this plugin) when they're used to develop this repo — not skills this repo itself ships.

### Issue tracker

Issues live in this repo's GitHub Issues (`bgutschke/skills`), managed via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default canonical label vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`), used as-is. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` at the repo root, created lazily when a term or decision first needs it. See `docs/agents/domain.md`.
