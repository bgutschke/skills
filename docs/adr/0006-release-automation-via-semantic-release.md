# Release automation via semantic-release, gated by a required-PR ruleset on `main`

Before #10, `.claude-plugin/plugin.json`'s `version` field was hand-edited and nothing
kept it in sync with anything, there was no changelog, and `main` accepted direct pushes
with no automated correctness check before a change shipped. #10 replaced this with a
`release.yml` workflow that runs `semantic-release` after every successful `Validate` run
on `main`, deriving the version bump from the Conventional Commit types already required
by `CLAUDE.md` (`feat`/`fix`/`perf` are release-triggering; the rest are not — see that
file's commit-type table). A small, repo-owned script
(`scripts/sync-plugin-version-cli.js`, wrapping the pure function in
`scripts/sync-plugin-version.js`) writes the new version into
`.claude-plugin/plugin.json`, deliberately in place of a third-party single-purpose
plugin for a one-field sync this repo can own directly. `package.json` is `"private":
true` with `npmPublish: false` — this repo is never published to the npm registry, since
consumers install it via `npx skills@latest add bgutschke/skills`, not `npm install`; the
manifest exists purely for release bookkeeping. npm, not Bun, is this repo's package
manager.

`main` is protected by a GitHub ruleset requiring a pull request, with 0 required
approvals (a solo-maintained repo has no one else to rubber-stamp a review) and
`enforce_admins: false`, so the repo owner can still push directly in an emergency — a
personal GitHub account has no separate bypass-actor mechanism (classic
`bypass_pull_request_allowances` and Rulesets Integration bypass actors are both
org-only). That same constraint is why `release.yml` authenticates as the repo owner via
a `RELEASE_TOKEN` PAT rather than the default `GITHUB_TOKEN`: the workflow's own actor
(`github-actions[bot]`) isn't a repo collaborator and can't push past the ruleset, and the
workflow's `permissions: contents: read` makes sure nothing silently falls back to a
token that can't actually push.

## Consequences

- **`RELEASE_TOKEN` is a hard dependency, not an optional nicety.** If it expires or is
  revoked, the release job's `git push` step fails loudly rather than silently
  succeeding with reduced permissions — rotate it before it expires.
- **The version-sync function is the one piece of this pipeline actually unit-tested**
  (`scripts/sync-plugin-version.test.js`, plain Jest). Everything else — the
  `semantic-release` plugin chain, the two workflows, the ruleset — is verified
  operationally: `npx semantic-release --dry-run` and a real trial PR, not a test suite.
- **`release.yml` triggers on `workflow_run` of `Validate`, gated on `conclusion ==
  'success'`**, not directly on `push`. `Validate` also fires on every push to `main`
  (including the ruleset-permitted emergency direct push), so this is defense in depth on
  top of the ruleset, not a redundant check to simplify away.
- Only `feat`, `fix`, and `perf` commits cut a release. A change that should ship as part
  of the next release but is typed `chore`/`docs`/`build`/`ci` won't trigger one on its
  own — this is a common source of "why didn't this release" confusion, so check the
  commit type before assuming the pipeline is broken.
- **`preset: 'angular'`, not `'conventionalcommits'`, and deliberately so.** Both
  commit-analyzer and release-notes-generator originally used `'conventionalcommits'`
  with a custom `presetConfig.types` list covering all eleven commit types. Two
  independently-reviewed major bumps (`@semantic-release/*` monorepo to v25, then
  `@commitlint/config-conventional` to v21) each pulled a compatible-looking range of the
  shared transitive dependency `conventional-changelog-conventionalcommits`, but landed on
  v10 — which emits a `template` render function, while the installed
  `conventional-changelog-writer@8` still expects the old `mainTemplate` Handlebars
  string. Neither PR's diff showed this; the mismatch only surfaces at changelog-render
  time, as a *silent* fallback to a header-with-no-commits, not an error (tracked
  upstream: conventional-changelog/conventional-changelog#1495). v1.4.1 and v1.4.2 shipped
  with empty release notes as a result, corrected after the fact via `gh release edit` and
  a `CHANGELOG.md` patch. Pinning `conventional-changelog-conventionalcommits` back to a
  writer-v8-compatible version was considered and verified working, but `angular` was
  chosen instead: it's a wholly separate, unaffected preset package, so it isn't exposed
  to this shared-dependency class of break at all. The trade-off: `angular`'s type map is
  fixed and doesn't accept `presetConfig.types`, so `docs`/`chore`/`ci`/`build`/`style`/
  `test`/`refactor` commits no longer appear in `CHANGELOG.md` or GitHub Releases — a
  deliberate scope narrowing to just `feat`/`fix`/`perf`/`revert`/breaking changes,
  accepted because those are the only types that cut a release anyway (see above).
- **`npm run verify:release-notes` (`scripts/verify-release-notes.mjs`) runs in
  `Validate`** specifically to catch a repeat of the above: it calls
  `generateNotes()` with the real `release.config.js` plugin config against a synthetic
  `fix` commit and fails the build if the output doesn't contain the commit's own text —
  i.e. if it silently degrades to a bare version header again, from this or any future
  preset/writer mismatch.
