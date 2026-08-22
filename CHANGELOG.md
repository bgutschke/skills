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
