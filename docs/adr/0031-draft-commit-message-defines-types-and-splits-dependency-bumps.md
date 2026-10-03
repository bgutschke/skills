# `draft-commit-message` defines each type and splits dependency bumps by what ships

The subagent brief of `draft-commit-message` listed only type names, so the Haiku
subagent guessed the type from file names. The same diff got different types on
different runs. In a repo where semantic-release reads the type, a wrong `feat` or `fix`
cuts a release by mistake.

We decided that the brief gives a one-line definition for each type. The text comes word
for word from the prompt type descriptions of `@commitlint/config-conventional`. The
bare Conventional Commits spec defines only `feat` and `fix`, and the Angular guide
lists 8 types without `chore`, `style`, and `revert`. The commitlint package is the only
official source that covers all 11 types of the *Fallback convention* (ADR 0027). Before
the subagent picks a type, it answers one question: does the change alter what users of
the project receive? Only a yes allows `feat`, `fix`, or `perf`.

A dependency bump follows the Renovate default (`config:recommended`, preset
`:semanticPrefixFixDepsChoreOthers`). A bump of a runtime dependency is `fix(deps)`,
because consumers install it, and the decision question says yes. A bump of any other
dependency (`devDependencies`, `peerDependencies`) is `chore(deps)`. A change to build or
test configuration, such as `jest.config.js`, stays `build`.

## Considered Options

- **Every dependency bump is `build`.** This is the Angular and Dependabot default, and
  the official `build` wording ("external dependencies") reads that way. We rejected it
  because it contradicts the decision question: a runtime bump changes what consumers
  install, but `build` never cuts a release.
- **Runtime `fix(deps)`, dev `build(deps)`.** This keeps `build` for all tooling. We
  rejected it because Renovate, Vite, Vue core, and semantic-release use `chore(deps)`
  for the non-runtime side. With `chore(deps)`, the drafted message matches the bot
  commits that most repos already contain.

## Consequences

- In a repo that uses semantic-release defaults, a drafted runtime bump cuts a patch
  release. That is intended.
- The brief overrides the official `build` wording for dependencies. A future reader
  must not "fix" the brief back to the official text alone.
