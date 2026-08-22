## 1.1.0 (2026-08-22)

* feat(engineering): add to-pr-description skill and PR template ([de6ee82](https://github.com/bgutschke/skills/commit/de6ee82)), closes [#9](https://github.com/bgutschke/skills/issues/9)
* feat(engineering): self-assign the PR in to-pr-description ([82fd7de](https://github.com/bgutschke/skills/commit/82fd7de)), closes [#9](https://github.com/bgutschke/skills/issues/9)
* docs(engineering): sharpen to-pr-description from real dry-run findings ([7c1edc5](https://github.com/bgutschke/skills/commit/7c1edc5)), closes [#20](https://github.com/bgutschke/skills/issues/20) [#9](https://github.com/bgutschke/skills/issues/9)
* fix(engineering): correct gh field usage in to-pr-description ([d0f7b8a](https://github.com/bgutschke/skills/commit/d0f7b8a)), closes [#20](https://github.com/bgutschke/skills/issues/20) [#9](https://github.com/bgutschke/skills/issues/9)
* fix(engineering): generalize AI-attribution stripping beyond Claude Code ([499e0ff](https://github.com/bgutschke/skills/commit/499e0ff)), closes [#9](https://github.com/bgutschke/skills/issues/9)
* fix(engineering): never keep Claude Code's own PR attribution line ([f960720](https://github.com/bgutschke/skills/commit/f960720)), closes [#9](https://github.com/bgutschke/skills/issues/9)
* chore: accept Renovate's deps/config commit scopes ([e4e4873](https://github.com/bgutschke/skills/commit/e4e4873)), closes [#17](https://github.com/bgutschke/skills/issues/17) [renovatebot/renovate#35164](https://github.com/renovatebot/renovate/issues/35164) [#17](https://github.com/bgutschke/skills/issues/17)
* chore: add Copilot review instructions ([cb5029b](https://github.com/bgutschke/skills/commit/cb5029b))
* chore: add Renovate config for dependency updates ([2b05fd5](https://github.com/bgutschke/skills/commit/2b05fd5)), closes [#6](https://github.com/bgutschke/skills/issues/6)
* chore: allowlist install scripts for claude-code and fsevents ([30a9a2a](https://github.com/bgutschke/skills/commit/30a9a2a))
* chore: pin required Node version to 24 ([69cd10c](https://github.com/bgutschke/skills/commit/69cd10c))
* chore(config): tune renovate minimum release age by risk tier ([6ec619d](https://github.com/bgutschke/skills/commit/6ec619d)), closes [#19](https://github.com/bgutschke/skills/issues/19)

## 1.0.0 (2026-08-22)

* ci: authenticate release workflow with a PAT, not GITHUB_TOKEN ([3f44cd5](https://github.com/bgutschke/skills/commit/3f44cd5)), closes [#10](https://github.com/bgutschke/skills/issues/10)
* ci: gate main on plugin validation and commit lint, automate releases ([2f09b67](https://github.com/bgutschke/skills/commit/2f09b67)), closes [#1](https://github.com/bgutschke/skills/issues/1) [#10](https://github.com/bgutschke/skills/issues/10)
* docs: add coding standards for skill authorship ([3f7a3d5](https://github.com/bgutschke/skills/commit/3f7a3d5)), closes [#2](https://github.com/bgutschke/skills/issues/2)
* docs: adopt conventional commits for the repo ([626b6c3](https://github.com/bgutschke/skills/commit/626b6c3))
* docs: document release-triggering commit types and non-skill code ([2d67b43](https://github.com/bgutschke/skills/commit/2d67b43)), closes [#N](https://github.com/bgutschke/skills/issues/N) [#10](https://github.com/bgutschke/skills/issues/10)
* build: add plugin.json version-sync module for release automation ([eaea516](https://github.com/bgutschke/skills/commit/eaea516)), closes [#10](https://github.com/bgutschke/skills/issues/10) [#6](https://github.com/bgutschke/skills/issues/6) [#7](https://github.com/bgutschke/skills/issues/7)
* build: configure semantic-release plugin pipeline ([735e76f](https://github.com/bgutschke/skills/commit/735e76f)), closes [#10](https://github.com/bgutschke/skills/issues/10)
* Configure issue-tracker, triage-label, and domain-doc conventions ([068b3a8](https://github.com/bgutschke/skills/commit/068b3a8))
* Drop --copy flag from skills CLI command, fix inaccurate subscribe-model comparison ([17ffd7d](https://github.com/bgutschke/skills/commit/17ffd7d))
* Drop custom installer scripts in favor of npx skills add ([97d3747](https://github.com/bgutschke/skills/commit/97d3747))
* Fix stale private-repo wording, symlink CLAUDE.md to AGENTS.md ([408490e](https://github.com/bgutschke/skills/commit/408490e))
* Rename plugin from bgutschke-skills to skills, dedupe redundant username ([94dcd86](https://github.com/bgutschke/skills/commit/94dcd86))
* Scaffold public skills repo: plugin manifest, installer script, MIT license ([65f0e88](https://github.com/bgutschke/skills/commit/65f0e88))

### breaking-change

* marker for when releases start. Documentation-only for
now, no hook or CI enforcement. Decided via a grilling session; applies
going forward, existing history is untouched.
