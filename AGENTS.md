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

Optional, and drawn from one of three independent vocabularies — a commit uses at most one value from any of them, never combining two, and picks the most specific one that applies (same carving principle as `ROUTING.md`):

- **Skill scope** — a skill's own directory name (`to-pr`, `audit-rules`, `skill-writing-standards`, `audit-skills`, …), when a commit touches exactly one skill. Maintainer-only skills under `.claude/skills/**` use their own name the same way — there is no separate marker distinguishing them from shipped skills.
- **Bucket scope** — `engineering` or `productivity`, the fallback when a commit spans multiple skills within one bucket, or touches a bucket-level file (e.g. a bucket `README.md`). Omit the scope entirely for repo-wide changes (plugin manifest, marketplace config, top-level docs).
- **Maintenance scope** — `deps` or `config`, for automated dependency-tooling changes (Renovate). Renovate's own config-migration PR hardcodes scope `config` and isn't configurable otherwise, so this vocabulary is accepted as-is rather than mapped onto the other two.

`commitlint.config.js`'s `scope-enum` rule enforces this by reading `skills/**` and `.claude/skills/**` directory names off disk at lint time (via `scripts/commit-scope-enum.js`), unioned with the fixed `deps`/`config` vocabulary — a hand-maintained list would need a manual edit every time a skill is added, renamed, or removed, and would drift.

### Subject

Lowercase, imperative mood, no trailing period — `fix(engineering): correct broken skill link`, not `Fixed the broken link.`. Keep the whole `type(scope): description` line at or under 72 characters, aiming for 50. This applies regardless of what any message-generating tool defaults to — the convention in this file wins for commits in this repo.

### Body

Separated from the subject by a blank line, for any non-trivial change. Explains WHAT changed and WHY — never HOW; the diff already shows how. Keep issue references (`#N`) out of the body entirely — put them only in the Footer below. commitlint's parser treats the *first* `#N` it finds anywhere in the body as the start of the footer; if that first mention lands on a hard-wrapped continuation line rather than one already preceded by a blank line, everything after it — including the real `Refs #10`/`Closes #10` line — gets swallowed into an unspaced "footer" and trips a `footer-leading-blank` warning.

### Footer

`Closes #<n>` or `Refs #<n>` when the commit closes or relates to a tracked GitHub issue (see `docs/agents/issue-tracker.md`). Omit when there's no related issue — most commits won't have one.

Use `Closes #<n>`, never `Refs #<n>`, for the commit that ships an issue's last remaining acceptance-criteria item — GitHub then closes the issue automatically on push instead of needing a manual follow-up. Where the issue body has an explicit checklist, the test is mechanical: does this diff check off everything still unchecked? Where there's no checklist: would you want this push to auto-close the issue? Yes means `Closes`. A manual `gh issue close` stays valid only for issues that resolve without any shipping commit (`wontfix`, duplicates, pure decisions where the comment *is* the resolution).

Breaking changes use a `!` after the type/scope (`feat(engineering)!: ...`) and/or a `BREAKING CHANGE:` footer, per the spec. `semantic-release` reads this as a major version bump.

## Agent skills

Conventions for the [mattpocock/skills](https://github.com/mattpocock/skills) engineering skills (installed separately, not part of this plugin) when they're used to develop this repo — not skills this repo itself ships.

### Issue tracker

Issues live in this repo's GitHub Issues (`bgutschke/skills`), managed via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default canonical label vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`), used as-is. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` at the repo root, created lazily when a term or decision first needs it. See `docs/agents/domain.md`.
