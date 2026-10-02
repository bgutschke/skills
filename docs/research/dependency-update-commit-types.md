# Commit types for dependency updates

Research date: 2026-10-02. All sources are primary: specs, official docs, source code, and config files in each project's own repository. Source-code links point at the exact commit read.

## Summary

- No specification names a type for dependency updates. Conventional Commits says nothing. Angular and `@commitlint/config-conventional` define `build` as "external dependencies" and give no runtime versus dev split.
- The tools do split runtime from dev. Renovate's recommended preset uses `fix` for `dependencies` and `chore` for everything else, including `devDependencies` and `peerDependencies`. Dependabot gives the split a scope: `deps` versus `deps-dev`.
- Dependabot's own default type is `build`, or `chore` if the repo history already shows `chore` and no `build`. The split lives only in the scope.
- semantic-release releases on `fix` (patch), `feat` (minor), `perf` (patch) and breaking changes. It does not release on `build` or `chore`. So `fix(deps)` ships a patch release and `chore(deps)` or `build(deps)` does not.
- Real projects disagree. Vite, Vue core and semantic-release use Renovate's recommended preset (`fix(deps)` for runtime, `chore(deps)` for dev). Angular uses `build` for all. Renovate's own repo uses `build` for runtime and `chore` for dev. Electron and Node state no type for dependency bumps.

The concern behind this question holds for the tools that cut releases from commit types. "A dependency bump in package.json is `build`" is one valid convention. It is not the only one, and it is not the Renovate default.

## 1. Conventional Commits 1.0.0

Source: [spec](https://www.conventionalcommits.org/en/v1.0.0/). Source file: [content/v1.0.0/index.md at 7d293dc](https://github.com/conventional-commits/conventionalcommits.org/blob/7d293dc59e88abc8ce6c6698344d4da518ff3f27/content/v1.0.0/index.md).

- The spec defines two types: `fix` ("patches a bug in your codebase") and `feat` ("introduces a new feature to the codebase"). See [Specification](https://www.conventionalcommits.org/en/v1.0.0/#specification).
- It allows other types: "_types_ other than `fix:` and `feat:` are allowed, for example @commitlint/config-conventional (based on the Angular convention) recommends `build:`, `chore:`, `ci:`, `docs:`, `style:`, `refactor:`, `perf:`, `test:`, and others." Same section.
- The spec and its FAQ say nothing about dependencies, dependency updates, `devDependencies`, or lockfiles. I searched the spec source for "depend" and found no match in a dependency-update sense.
- The FAQ entry "What do I do if the commit conforms to more than one of the commit types?" is the closest guidance. Read it in the [FAQ](https://www.conventionalcommits.org/en/v1.0.0/#what-do-i-do-if-the-commit-conforms-to-more-than-one-of-the-commit-types). It does not mention dependencies.

## 2. Angular commit message guidelines

Source: [contributing-docs/commit-message-guidelines.md at 8608325](https://github.com/angular/angular/blob/860832591d58f49e5618d2898509f18d7c1cfa50/contributing-docs/commit-message-guidelines.md). [CONTRIBUTING.md](https://github.com/angular/angular/blob/860832591d58f49e5618d2898509f18d7c1cfa50/CONTRIBUTING.md) links to it ("Commit your changes using a descriptive commit message that follows our commit message conventions") and holds no type rules itself.

- Type list: `build|ci|docs|feat|fix|perf|refactor|test`. There is no `chore` type in Angular's list.
- `build` is defined as: "Changes that affect the build system or external dependencies (example scopes: gulp, broccoli, npm)".
- Scope rule: "The scope should be the name of the npm package affected (as perceived by the person reading the changelog generated from commit messages)."
- The doc says nothing about runtime versus dev dependencies.
- The doc does not say which scope or type a dependency bump takes. "External dependencies" in the `build` definition is the only hook.

## 3. @commitlint/config-conventional

Source: [@commitlint/config-conventional/src/index.ts at 0737aba](https://github.com/conventional-changelog/commitlint/blob/0737aba9d6a14337cfb22dac479909cedb864977/@commitlint/config-conventional/src/index.ts). Package version read: 21.2.3 ([package.json](https://github.com/conventional-changelog/commitlint/blob/0737aba9d6a14337cfb22dac479909cedb864977/@commitlint/config-conventional/package.json)).

- `type-enum` allows: build, chore, ci, docs, feat, fix, perf, refactor, revert, style, test.
- `build`: "Changes that affect the build system or external dependencies (example scopes: gulp, broccoli, npm)". Same wording as Angular's older text.
- `chore`: "Other changes that don't modify src or test files".
- `fix`: "A bug fix".
- The file says nothing about runtime versus dev dependencies.

## 4. Renovate

All Renovate files read at commit [7962cbe](https://github.com/renovatebot/renovate/commit/7962cbe1f0e69f4db13cab6634c3ce841b35320b) (Renovate 44.132.1 was the latest release).

### Defaults

- `semanticCommitType` default is `chore`. `semanticCommitScope` default is `deps`. `semanticCommits` default is `auto`. Source: [lib/config/options/index.ts](https://github.com/renovatebot/renovate/blob/7962cbe1f0e69f4db13cab6634c3ce841b35320b/lib/config/options/index.ts) (search `name: 'semanticCommitType'`).
- Renovate checks the last 20 base-branch commits to decide whether the repo uses semantic commits. Source: [docs/usage/semantic-commits.md](https://github.com/renovatebot/renovate/blob/7962cbe1f0e69f4db13cab6634c3ce841b35320b/docs/usage/semantic-commits.md).
- Example output from the same doc: "chore(deps): update eslint to v7.30.0".

### The fix versus chore decision

The doc states: "If you extend from `config:recommended` then Renovate uses the `chore` prefix for nearly all updates. There are some exceptions: if the `depType` is a known 'production dependency' type (e.g. `dependencies` or `require`), then Renovate uses the `fix` prefix". It adds a second exception for Maven production scopes. Source: [docs/usage/semantic-commits.md](https://github.com/renovatebot/renovate/blob/7962cbe1f0e69f4db13cab6634c3ce841b35320b/docs/usage/semantic-commits.md).

The code backs this up. `config:recommended` extends `:semanticPrefixFixDepsChoreOthers` ([config.preset.ts](https://github.com/renovatebot/renovate/blob/7962cbe1f0e69f4db13cab6634c3ce841b35320b/lib/config/presets/internal/config.preset.ts), `recommended` entry).

### Presets

Source for all four: [default.preset.ts](https://github.com/renovatebot/renovate/blob/7962cbe1f0e69f4db13cab6634c3ce841b35320b/lib/config/presets/internal/default.preset.ts).

- `:semanticPrefixFixDepsChoreOthers`. Description: "Use semantic commit type `fix` for dependencies and `chore` for all others if semantic commits are in use." Rules, in order:
  1. All packages get `chore`.
  2. `matchDepTypes: ['dependencies', 'require']` gets `fix`.
  3. Maven `compile`, `provided`, `runtime`, `system`, `import`, `parent` get `fix`.
  4. pep621 and poetry `project.dependencies` and `project.optional-dependencies` get `fix`. Poetry `dependencies` and `extras` get `fix`.
  5. Lockfile updates (`isLockfileUpdate = true`) get `chore`.
- `:semanticCommitTypeAll(type)`. Description: "If Renovate detects semantic commits, it will use semantic commit type `{{arg0}}` for all commits." It sets one `packageRule` that matches all files (`**/*`). No runtime/dev split.
- `:semanticCommitType(type)`, `:semanticPrefixChore`, `:semanticPrefixFix`. Set one type for everything.
- `:semanticCommitScope(scope)` and `:semanticCommitScopeDisabled` set or remove the scope.

### npm dependency types

The npm manager records the raw `package.json` key as `depType`: `dependencies`, `devDependencies`, `optionalDependencies`, `peerDependencies`, and others. Source: [lib/modules/manager/npm/extract/common/package-file.ts](https://github.com/renovatebot/renovate/blob/7962cbe1f0e69f4db13cab6634c3ce841b35320b/lib/modules/manager/npm/extract/common/package-file.ts) (the `depTypes` object and the `depType` assignment).

Result for npm under `config:recommended`, read from the preset rules above:

| `package.json` key | Type |
|---|---|
| `dependencies` | `fix` |
| `devDependencies` | `chore` |
| `peerDependencies` | `chore` (matches only the catch-all rule; the preset does not list it) |
| `optionalDependencies` | `chore` (same reason) |

The Renovate docs do not state the `peerDependencies` and `optionalDependencies` outcome in words. I read it from the rule list.

## 5. Dependabot

### Options

Source: [dependabot-options-reference.md at github/docs 0b8c768](https://github.com/github/docs/blob/0b8c768bf0d5a13560ec82fd3daa414137e2e436/content/code-security/reference/supply-chain-security/dependabot-options-reference.md), section `commit-message`.

- Default: "Commit messages follow similar patterns to those detected in the repository."
- `prefix`: "Defines a prefix for all commit messages and pull request titles."
- `prefix-development`: "On supported systems, defines a different prefix to use for commits that update dependencies in the Development dependency group." Supported by `bundler`, `composer`, `mix`, `maven`, `npm`, `pip`, and `uv`.
- `include`: "Supports only the value `scope`". "When defined any prefix is followed by the type of dependencies updated in the commit: `deps` or `deps-dev`."
- The same text appears in the tutorial [customizing-dependabot-prs.md](https://github.com/github/docs/blob/0b8c768bf0d5a13560ec82fd3daa414137e2e436/content/code-security/tutorials/secure-your-dependencies/customizing-dependabot-prs.md): "By default, Dependabot attempts to detect your commit message preferences and use similar patterns."
- The docs name no default type. They do not mention Conventional Commits.

### Default behavior in code

Source: [common/lib/dependabot/pull_request_creator/pr_name_prefixer.rb at dependabot-core 87fbf03](https://github.com/dependabot/dependabot-core/blob/87fbf0334e9f090856387f4a666a816673af35b6/common/lib/dependabot/pull_request_creator/pr_name_prefixer.rb).

- The scope is `dependencies.any?(&:production?) ? "deps" : "deps-dev"` (method `scope`).
- If the repo history matches the Angular style, the prefix is `"#{angular_commit_prefix}(#{scope}): "`.
- `angular_commit_prefix` returns `chore` only when recent commits start with `chore` and none start with `build`. Otherwise it returns `build` (method `angular_commit_prefix`).
- If history uses some other prefixed style, the fallback is `build(#{scope}): `.
- With an explicit `prefix`, Dependabot uses `prefix-development` for updates that have no production dependency (method `explicitly_provided_prefix_string`).
- Result: Dependabot never picks `fix`. It separates runtime from dev only by scope, or by `prefix-development` if the repo configures it.

## 6. semantic-release and @semantic-release/commit-analyzer

Source: [lib/default-release-rules.js at commit-analyzer 1b640e7](https://github.com/semantic-release/commit-analyzer/blob/1b640e795ac21fba9551431e342bd5c92fa49384/lib/default-release-rules.js) and the [README](https://github.com/semantic-release/commit-analyzer/blob/1b640e795ac21fba9551431e342bd5c92fa49384/README.md).

- Default rules include: breaking gives `major`; `revert` gives `patch`; `feat` gives `minor`; `fix` gives `patch`; `perf` gives `patch`.
- The README says commits that match no rule get no release: "Commits with `type` 'chore' will not be associated with a release type." It names `style` and `test` the same way. It does not list `build`, but `build` matches no default rule either.
- Scope does not matter to these rules. `fix(deps)` matches `type: fix` and releases a patch. `chore(deps)` and `build(deps)` release nothing.
- The default file also has a rule `{ component: "deps", release: "patch" }` under the comment "Express". The README says nothing about it. I did not trace how the parser fills `component`, so I make no claim about it.

## 7. Real projects

Commit evidence below comes from the 100 most recent commits on each default branch, read on 2026-10-02 through the GitHub API (`repos/<owner>/<repo>/commits`).

### angular/angular

- Config: [renovate.json at 8608325](https://github.com/angular/angular/blob/860832591d58f49e5618d2898509f18d7c1cfa50/renovate.json) extends `github>angular/dev-infra//renovate-presets/default.json5`.
- That preset, at [angular/dev-infra 102966b](https://github.com/angular/dev-infra/blob/102966bf8affb3e57bc93c02f198b772079562f8/renovate-presets/default.json5), sets `semanticCommits: 'enabled'`, `semanticCommitScope: ''` and `semanticCommitType: 'build'`.
- No `depType` rule overrides it. Runtime and dev both get `build`, with no scope.
- Commits seen: `build: update dependency bazel to v8.8.1`, `build: update cross-repo angular dependencies`.
- Distinguishes runtime from dev: no.

### vitejs/vite

- Config: [.github/renovate.json5 at 10033218](https://github.com/vitejs/vite/blob/10033218d239c927cdc375970b5741cce408e81b/.github/renovate.json5) extends `config:recommended` and sets no `semanticCommitType`. It disables `peerDependencies` updates.
- [commit-convention.md](https://github.com/vitejs/vite/blob/10033218d239c927cdc375970b5741cce408e81b/.github/commit-convention.md) says nothing about dependency updates.
- Commits seen (last 100): 8 `fix(deps)`, 3 `chore(deps)`. Examples: `fix(deps): update all non-major dependencies (#23601)`, `chore(deps): update vitest monorepo to v5 (#23604)`.
- Distinguishes: yes, through the Renovate default.

### vuejs/core

- Config: [.github/renovate.json5 at 4ab865a](https://github.com/vuejs/core/blob/4ab865a848a1da3d10fb674f857e5fff13094644/.github/renovate.json5) extends `config:recommended`, no `semanticCommitType`.
- [commit-convention.md](https://github.com/vuejs/core/blob/4ab865a848a1da3d10fb674f857e5fff13094644/.github/commit-convention.md): "If the prefix is `feat`, `fix` or `perf`, it will appear in the changelog." It says nothing about dependencies.
- Commits seen: 25 `chore(deps)`, 3 `fix(deps)`. Example: `fix(deps): update dependency jszip to ^3.10.2 (#15502)`. Some `chore(deps)` commits are Dependabot-style, such as `chore(deps): bump postcss-selector-parser from 6.1.2 to 7.1.5 (#15395)`.
- Distinguishes: yes, through the Renovate default.

### semantic-release/semantic-release

- Config: `package.json` points Renovate at `github>semantic-release/.github:renovate-config` ([package.json](https://github.com/semantic-release/semantic-release/blob/e8c2436e5704a6d1fa5b4aa69238f50edbe586bf/package.json), `renovate` key). That file, at [semantic-release/.github 17602f0](https://github.com/semantic-release/.github/blob/17602f04b39366104b12de2dabdcfe0a93bc2d06/renovate-config.json), extends `config:best-practices` and `:pinOnlyDevDependencies`. It sets `semanticCommitType: "ci"` with scope `action` for GitHub Actions.
- `config:best-practices` extends `config:recommended` ([config.preset.ts](https://github.com/renovatebot/renovate/blob/7962cbe1f0e69f4db13cab6634c3ce841b35320b/lib/config/presets/internal/config.preset.ts)), so runtime gets `fix` and dev gets `chore`.
- [CONTRIBUTING.md](https://github.com/semantic-release/semantic-release/blob/e8c2436e5704a6d1fa5b4aa69238f50edbe586bf/CONTRIBUTING.md) reuses Angular's `build` definition ("Changes that affect the build system or external dependencies") and names no dependency rule.
- Commits seen: 53 `chore(deps)`, plus `build(deps-dev): bump fast-uri ...` and `build(deps): bump js-yaml ...`. The `build(deps*)` form is Dependabot's output; this repo has no `dependabot.yml`, so I infer those come from GitHub's security updates. The sources do not say so.
- Distinguishes: yes in the Renovate config. Dependabot commits split by scope only.

### renovatebot/renovate

- Config: [renovate.json at 7962cbe](https://github.com/renovatebot/renovate/blob/7962cbe1f0e69f4db13cab6634c3ce841b35320b/renovate.json) extends `github>renovatebot/.github`, which sets `:semanticCommits` and `:semanticCommitScope(deps)` on top of `config:recommended` ([default.json at renovatebot/.github 6dd5a7b](https://github.com/renovatebot/.github/blob/6dd5a7b44a9279bc2355a546eae5cd90419e1711/default.json)).
- Its own `packageRules` entry: `matchDepTypes: ["dependencies", "optionalDependencies"]` gets `semanticCommitType: "build"`. So runtime npm deps get `build(deps)`. Dev deps keep the default, `chore(deps)`. Dockerfile and `semantic-release` updates also get `build`. The base image gets `fix` or `feat` by update type.
- Distinguishes: yes. It overrides `fix` with `build` for runtime.

### electron/electron

- [CONTRIBUTING.md at df79406](https://github.com/electron/electron/blob/df79406cecfd393f38d5a18b83379d4ba85cc29b/CONTRIBUTING.md) states a policy on who may change dependencies, not a commit type: "Dependencies in Electron's `package.json` or `yarn.lock` files should only be altered by maintainers."
- [.github/dependabot.yml](https://github.com/electron/electron/blob/df79406cecfd393f38d5a18b83379d4ba85cc29b/.github/dependabot.yml) sets no `commit-message` block.
- Commit seen: `build(deps): bump github/codeql-action/upload-sarif from 4.38.0 to 4.38.1 (#54570)`. That matches Dependabot's code default of `build`.
- Distinguishes: no stated rule.

### nodejs/node

- [.github/dependabot.yml at a7a9784](https://github.com/nodejs/node/blob/a7a978415cc690fc1f751800a2a8052d4d02f289/.github/dependabot.yml) sets `commit-message.prefix` to `meta` for GitHub Actions and `tools` for npm under `tools/`. It does not use `prefix-development`.
- [doc/contributing/pull-requests.md](https://github.com/nodejs/node/blob/a7a978415cc690fc1f751800a2a8052d4d02f289/doc/contributing/pull-requests.md) uses subsystem prefixes, not Conventional Commits types. Its list includes `build`, `doc`, `test`, `tools`.
- Commits seen: `deps: upgrade openssl sources to openssl-3.5.9`, `tools: update gyp-next to 0.22.3`. Here `deps` is a subsystem for vendored code, not a type.
- Distinguishes runtime from dev: no. Node does not use the Conventional Commits type model.

### conventional-changelog/conventional-changelog

- Config: [.github/renovate.json at f90c80e](https://github.com/conventional-changelog/conventional-changelog/blob/f90c80e9fe02146c1018fa1d78dea738809ab102/.github/renovate.json) extends `config:recommended` and `:preserveSemverRanges`, no type override.
- [.commitlintrc.js](https://github.com/conventional-changelog/conventional-changelog/blob/f90c80e9fe02146c1018fa1d78dea738809ab102/.commitlintrc.js) extends `@commitlint/config-conventional` and adds `deps` and `dev-deps` to the allowed scopes.
- Commits seen: `chore(deps): update vitest monorepo to v5 (#1543)`, `chore(deps): update actions/setup-node action to v7 (#1523)`. No `fix(deps)` appeared in the last 100. The repo's own manual commit `fix(conventional-changelog): add conventional-commits-filter to dependencies (#1536)` uses `fix` for a missing runtime dependency, which is a different case from a version bump.
- Distinguishes: the Renovate default would, and the commitlint scope list adds `dev-deps` as a scope. I found no written rule.

### webpack/webpack

- [.github/dependabot.yml at d37872d](https://github.com/webpack/webpack/blob/d37872d245f4d6bc21c36ee5297663d87452d51d/.github/dependabot.yml) sets no `commit-message` block. It sets `versioning-strategy: widen`. No type rule is stated.
- Included for completeness. I did not read its commit log.

## Comparison table

| Source | Runtime dep type | Dev dep type | Distinguishes | Citation |
|---|---|---|---|---|
| Conventional Commits 1.0.0 | none stated | none stated | no | [spec](https://www.conventionalcommits.org/en/v1.0.0/) |
| Angular guidelines | `build` (by definition "external dependencies") | `build` (same) | no | [guidelines](https://github.com/angular/angular/blob/860832591d58f49e5618d2898509f18d7c1cfa50/contributing-docs/commit-message-guidelines.md) |
| @commitlint/config-conventional 21.2.3 | `build` (same wording) | `build` | no | [index.ts](https://github.com/conventional-changelog/commitlint/blob/0737aba9d6a14337cfb22dac479909cedb864977/@commitlint/config-conventional/src/index.ts) |
| Renovate `config:recommended` | `fix(deps)` | `chore(deps)` | yes | [default.preset.ts](https://github.com/renovatebot/renovate/blob/7962cbe1f0e69f4db13cab6634c3ce841b35320b/lib/config/presets/internal/default.preset.ts) |
| Renovate `:semanticCommitTypeAll(x)` | `x` | `x` | no | [default.preset.ts](https://github.com/renovatebot/renovate/blob/7962cbe1f0e69f4db13cab6634c3ce841b35320b/lib/config/presets/internal/default.preset.ts) |
| Dependabot (default, Angular-style history) | `build(deps)` or `chore(deps)` | `build(deps-dev)` or `chore(deps-dev)` | scope only | [pr_name_prefixer.rb](https://github.com/dependabot/dependabot-core/blob/87fbf0334e9f090856387f4a666a816673af35b6/common/lib/dependabot/pull_request_creator/pr_name_prefixer.rb) |
| Dependabot (explicit config) | `prefix` | `prefix-development` | yes, if configured | [options reference](https://github.com/github/docs/blob/0b8c768bf0d5a13560ec82fd3daa414137e2e436/content/code-security/reference/supply-chain-security/dependabot-options-reference.md) |
| semantic-release defaults | `fix(deps)` releases patch | `chore(deps)` and `build(deps)` release nothing | by type, not by dep kind | [default-release-rules.js](https://github.com/semantic-release/commit-analyzer/blob/1b640e795ac21fba9551431e342bd5c92fa49384/lib/default-release-rules.js) |
| angular/angular | `build` | `build` | no | [dev-infra preset](https://github.com/angular/dev-infra/blob/102966bf8affb3e57bc93c02f198b772079562f8/renovate-presets/default.json5) |
| vitejs/vite | `fix(deps)` | `chore(deps)` | yes | [renovate.json5](https://github.com/vitejs/vite/blob/10033218d239c927cdc375970b5741cce408e81b/.github/renovate.json5) |
| vuejs/core | `fix(deps)` | `chore(deps)` | yes | [renovate.json5](https://github.com/vuejs/core/blob/4ab865a848a1da3d10fb674f857e5fff13094644/.github/renovate.json5) |
| semantic-release/semantic-release | `fix(deps)` by config (no sample seen) | `chore(deps)` | yes | [renovate-config.json](https://github.com/semantic-release/.github/blob/17602f04b39366104b12de2dabdcfe0a93bc2d06/renovate-config.json) |
| renovatebot/renovate | `build(deps)` | `chore(deps)` | yes | [renovate.json](https://github.com/renovatebot/renovate/blob/7962cbe1f0e69f4db13cab6634c3ce841b35320b/renovate.json) |
| electron/electron | no rule stated; sample `build(deps)` | none | no | [CONTRIBUTING.md](https://github.com/electron/electron/blob/df79406cecfd393f38d5a18b83379d4ba85cc29b/CONTRIBUTING.md) |
| nodejs/node | no rule; `deps:` is a subsystem | no rule | no | [pull-requests.md](https://github.com/nodejs/node/blob/a7a978415cc690fc1f751800a2a8052d4d02f289/doc/contributing/pull-requests.md) |
| conventional-changelog | no written rule; sample `chore(deps)` | `chore(deps)` | no written rule | [renovate.json](https://github.com/conventional-changelog/conventional-changelog/blob/f90c80e9fe02146c1018fa1d78dea738809ab102/.github/renovate.json) |

## Gaps and conflicts

- No normative source defines the type for a dependency bump. Conventional Commits, Angular and commitlint say only that `build` covers "external dependencies". Whether that includes a runtime bump that changes what consumers install is open.
- Renovate and Dependabot disagree. Renovate's default is `fix` for runtime and `chore` for dev. Dependabot's default is `build` for both, split only by scope.
- Large projects disagree. Angular uses `build` for all. Vite and Vue use Renovate's `fix`/`chore` split. Renovate's own repo overrides runtime to `build`.
- Renovate's choice of `fix` ties to semantic-release: `fix(deps)` cuts a patch release, so runtime bumps reach consumers. The Renovate docs do not state that reason. I read the link from the two tools' behavior. The Renovate source says nothing about its motive.
- Renovate treats `peerDependencies` and `optionalDependencies` as `chore` by omission. Vite and Vue disable `peerDependencies` updates entirely.
- I found no primary source that discusses a `fix(deps)` bump of a library that is private or never published. All sampled `fix(deps)` cases come from repos that ship packages.
- The `{ component: "deps", release: "patch" }` rule in commit-analyzer is unexplained in its README. Its effect on `type(scope)` commits is unverified.
- Electron, Node and webpack state no commit type for dependency bumps in the files I read. The commit samples are evidence of behavior, not of a stated rule.
- Commit-log samples cover only the 100 most recent commits on 2026-10-02. Counts are indicative, not exhaustive.
