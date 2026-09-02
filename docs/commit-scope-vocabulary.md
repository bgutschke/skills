# Commit scope vocabulary

The optional `scope` in a Conventional Commit header (`type(scope): description`) is drawn from one of three independent vocabularies. A commit uses at most one value from any of them, never combining two, and picks the most specific one that applies:

- **Skill scope** — a skill's own directory name (`to-pr`, `audit-rules`, `skill-writing-standards`, `audit-skills`, …), when a commit touches exactly one skill. Maintainer-only skills under `.claude/skills/**` use their own name the same way — there is no separate marker distinguishing them from shipped skills.
- **Bucket scope** — `engineering` or `productivity`, the fallback when a commit spans multiple skills within one bucket, or touches a bucket-level file (e.g. a bucket `README.md`). Omit the scope entirely for repo-wide changes (plugin manifest, marketplace config, top-level docs).
- **Maintenance scope** — `deps` or `config`, for automated dependency-tooling changes (Renovate). Renovate's own config-migration PR hardcodes scope `config` and isn't configurable otherwise, so this vocabulary is accepted as-is rather than mapped onto the other two.

`commitlint.config.js`'s `scope-enum` rule enforces this by reading `skills/**` and `.claude/skills/**` directory names off disk at lint time (via `scripts/commit-scope-enum.js`), unioned with the fixed `deps`/`config` vocabulary — a hand-maintained list would need a manual edit every time a skill is added, renamed, or removed, and would drift.
