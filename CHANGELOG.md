# [1.13.0](https://github.com/bgutschke/skills/compare/v1.12.0...v1.13.0) (2026-09-01)


### Bug Fixes

* **curate-memory:** drop the ADR citation from a bundled script comment ([a7b56f5](https://github.com/bgutschke/skills/commit/a7b56f5fc2ed3016a040e94a1ca2c89789ba3504))


### Features

* **curate-memory:** select by token budget, batch, and fan out ([de5f6d6](https://github.com/bgutschke/skills/commit/de5f6d69c0653b56dda7e25d7437a3ed2a6168d7)), closes [#92](https://github.com/bgutschke/skills/issues/92)

# [1.12.0](https://github.com/bgutschke/skills/compare/v1.11.0...v1.12.0) (2026-09-01)


### Bug Fixes

* **curate-memory:** name the dispatched subagent "miner" consistently ([064fd16](https://github.com/bgutschke/skills/commit/064fd16c70d8be3c62de738126e3ef5c2dbbed71))


### Features

* **curate-memory:** read worktree transcripts into the pool ([b762fba](https://github.com/bgutschke/skills/commit/b762fba9352b1c15df97db6eedcd020fb8a2e3c6)), closes [#91](https://github.com/bgutschke/skills/issues/91)

# [1.11.0](https://github.com/bgutschke/skills/compare/v1.10.1...v1.11.0) (2026-09-01)


### Bug Fixes

* **curate-memory:** correct output placement, counts, and exit codes ([09a32a4](https://github.com/bgutschke/skills/commit/09a32a4fc38b16a6fe35bebf489e93c1f69dcfd8)), closes [#90](https://github.com/bgutschke/skills/issues/90)


### Features

* **curate-memory:** add thinnest end-to-end curation pass ([2b4645f](https://github.com/bgutschke/skills/commit/2b4645fa3c74322a4571abae3bd85504a23331ad)), closes [#90](https://github.com/bgutschke/skills/issues/90)

## [1.10.1](https://github.com/bgutschke/skills/compare/v1.10.0...v1.10.1) (2026-08-25)


### Bug Fixes

* **renovate-triage:** use -F not -f for gh api body file read ([91ae043](https://github.com/bgutschke/skills/commit/91ae0433f2e2968bbe6041c753a8870f3dad114d))

# [1.10.0](https://github.com/bgutschke/skills/compare/v1.9.0...v1.10.0) (2026-08-25)


### Features

* **renovate-triage:** add OCI-label and PR-body changelog leads ([45a5232](https://github.com/bgutschke/skills/commit/45a52324ad94054b3853a50e1ba029fb264ff1e7)), closes [#78](https://github.com/bgutschke/skills/issues/78)

# [1.9.0](https://github.com/bgutschke/skills/compare/v1.8.0...v1.9.0) (2026-08-25)


### Features

* **renovate-triage:** add PR comment skeleton file ([4013ed6](https://github.com/bgutschke/skills/commit/4013ed647cb9ad39138fd62430f90d06963bd0b3)), closes [#74](https://github.com/bgutschke/skills/issues/74)

# [1.8.0](https://github.com/bgutschke/skills/compare/v1.7.1...v1.8.0) (2026-08-25)


### Bug Fixes

* **renovate-triage:** correct upstream-repo edge cases from review ([952087b](https://github.com/bgutschke/skills/commit/952087bbda73601eaa61af3af2c8c00ffc8a1093)), closes [#73](https://github.com/bgutschke/skills/issues/73)


### Features

* **renovate-triage:** add docker upstream repo, security advisory scan ([fc40b56](https://github.com/bgutschke/skills/commit/fc40b56db16c628ec2fd2ed2e5780c2d7a7fadd6)), closes [hi#urgency](https://github.com/hi/issues/urgency) [#75](https://github.com/bgutschke/skills/issues/75)

## [1.7.1](https://github.com/bgutschke/skills/compare/v1.7.0...v1.7.1) (2026-08-24)


### Bug Fixes

* **renovate-triage:** strip regex delimiters when resolving datasources ([f0cc43d](https://github.com/bgutschke/skills/commit/f0cc43da2d9d3d65f2756ca4ac357e0e7e9b1c4e))

# [1.7.0](https://github.com/bgutschke/skills/compare/v1.6.0...v1.7.0) (2026-08-24)


### Features

* **renovate-triage:** add Opportunity scan alongside risk verdict ([64de8c9](https://github.com/bgutschke/skills/commit/64de8c9407faadb416587fbcc9f02e6455acda37)), closes [#69](https://github.com/bgutschke/skills/issues/69)

# [1.6.0](https://github.com/bgutschke/skills/compare/v1.5.1...v1.6.0) (2026-08-24)


### Features

* **renovate-triage:** add multi-ecosystem support ([84b2ad6](https://github.com/bgutschke/skills/commit/84b2ad69632e623f3c4e92c79852da59932f8020)), closes [#67](https://github.com/bgutschke/skills/issues/67)

## [1.5.1](https://github.com/bgutschke/skills/compare/v1.5.0...v1.5.1) (2026-08-24)


### Bug Fixes

* **renovate-triage:** correct audit-flagged compliance gaps ([8a54167](https://github.com/bgutschke/skills/commit/8a54167421f90b3e7860ede4f8c15860fcac50f2))

# [1.5.0](https://github.com/bgutschke/skills/compare/v1.4.6...v1.5.0) (2026-08-24)


### Features

* **productivity:** add renovate-triage skill ([814f56c](https://github.com/bgutschke/skills/commit/814f56c460d807f74c6988ffab927f161565f3ec)), closes [#63](https://github.com/bgutschke/skills/issues/63)

## [1.4.6](https://github.com/bgutschke/skills/compare/v1.4.5...v1.4.6) (2026-08-24)


### Bug Fixes

* **audit-skills:** state its own gh dependency ([e44d2ec](https://github.com/bgutschke/skills/commit/e44d2ec08c06f484c5b096602731a6beafaa5141)), closes [#51](https://github.com/bgutschke/skills/issues/51)
* generalize dependency-listing and voodoo-constants rules ([76f085d](https://github.com/bgutschke/skills/commit/76f085d6d0f873621f5e8595a1f4d4e89fbe396d)), closes [#51](https://github.com/bgutschke/skills/issues/51)
* **to-pr:** state invocation path, gh dependency, title-cap reason ([fe552e2](https://github.com/bgutschke/skills/commit/fe552e270ac48873f9ebf9f21e5a86e7767e7e8d)), closes [authenticated-#CLI](https://github.com/authenticated-/issues/CLI) [#51](https://github.com/bgutschke/skills/issues/51)

## [1.4.5](https://github.com/bgutschke/skills/compare/v1.4.4...v1.4.5) (2026-08-24)


### Bug Fixes

* **skill-writing-standards:** make own worked example evergreen ([5fc16f1](https://github.com/bgutschke/skills/commit/5fc16f11380f2378265aa364e3d010a1b874e5e9)), closes [#53](https://github.com/bgutschke/skills/issues/53)

## [1.4.4](https://github.com/bgutschke/skills/compare/v1.4.3...v1.4.4) (2026-08-24)


### Bug Fixes

* **audit-skills:** avoid real-ADR-number collision in worked example ([d0d534a](https://github.com/bgutschke/skills/commit/d0d534ae68e0ce0e47692197f15905fc2e7d94e0)), closes [#54](https://github.com/bgutschke/skills/issues/54)
* **audit-skills:** rebuild worked example on synthetic fixtures ([27ccde0](https://github.com/bgutschke/skills/commit/27ccde0d89919ba10b54e229d3efaa0134845ef2)), closes [#54](https://github.com/bgutschke/skills/issues/54)

## [1.4.3](https://github.com/bgutschke/skills/compare/v1.4.2...v1.4.3) (2026-08-24)


### Bug Fixes

* **productivity:** add trigger clause, generalize symlink example ([7572589](https://github.com/bgutschke/skills/commit/7572589358acc2c6a56be488df533f3a45f09c45)), closes [#52](https://github.com/bgutschke/skills/issues/52)

## [1.4.2](https://github.com/bgutschke/skills/compare/v1.4.1...v1.4.2) (2026-08-23)

### Bug Fixes

* **engineering:** justify to-pr title-inference thresholds ([f5ba4d8](https://github.com/bgutschke/skills/commit/f5ba4d8d7ac5b0eebcee8cd9061150ec38a5e4f3))

## [1.4.1](https://github.com/bgutschke/skills/compare/v1.4.0...v1.4.1) (2026-08-23)

### Bug Fixes

* **productivity:** remove repo-specific citations from audit-rules ([90b162d](https://github.com/bgutschke/skills/commit/90b162d94e209bd8447ac193a01b38242abf9991))

## 1.4.0 (2026-08-23)

* docs: add ADR for to-pr's subagent diff-reading delegation ([9e5c1ac](https://github.com/bgutschke/skills/commit/9e5c1ac))
* docs: add coding standard against relative-path repo citations in skills ([96618f8](https://github.com/bgutschke/skills/commit/96618f8))
* docs: add self-containment principle to coding standards ([52e9d58](https://github.com/bgutschke/skills/commit/52e9d58))
* docs: correct ROUTING.md misattribution in ADR 0004 ([97f06c8](https://github.com/bgutschke/skills/commit/97f06c8))
* docs: forbid citing this repo's own ADRs from skills outright ([9473e56](https://github.com/bgutschke/skills/commit/9473e56))
* docs: renumber duplicate 0002 ADR to 0003 ([f7e80ce](https://github.com/bgutschke/skills/commit/f7e80ce))
* docs: require a writing-for-agents pass in the pre-merge checklist ([b1a5eaa](https://github.com/bgutschke/skills/commit/b1a5eaa))
* fix(engineering): drop dead-path ADR citations from to-pr ([3ae0d11](https://github.com/bgutschke/skills/commit/3ae0d11))
* fix(engineering): force verbatim commit-message reproduction in to-pr ([cd71079](https://github.com/bgutschke/skills/commit/cd71079))
* fix(engineering): tighten to-pr's SKILL.md against writing-for-agents ([dbd94ae](https://github.com/bgutschke/skills/commit/dbd94ae))
* fix(productivity): make audit-rules self-contained ([704e6e2](https://github.com/bgutschke/skills/commit/704e6e2))
* feat(engineering): delegate to-pr diff reading to a subagent ([43f5de5](https://github.com/bgutschke/skills/commit/43f5de5))

## 1.3.0 (2026-08-23)

* feat(productivity): add audit-rules skill ([caccb38](https://github.com/bgutschke/skills/commit/caccb38)), closes [#26](https://github.com/bgutschke/skills/issues/26)

## 1.2.0 (2026-08-23)

* feat(engineering): rename to-pr-description to to-pr, add create path ([2b0376a](https://github.com/bgutschke/skills/commit/2b0376a)), closes [#25](https://github.com/bgutschke/skills/issues/25)

## <small>1.1.1 (2026-08-23)</small>

* fix: rename marketplace plugin entry to bgutschke-skills ([67a95f9](https://github.com/bgutschke/skills/commit/67a95f9))
* docs: cut readme install section to bare instructions ([8244426](https://github.com/bgutschke/skills/commit/8244426))

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
