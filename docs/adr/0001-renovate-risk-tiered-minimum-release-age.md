# Risk-tiered Renovate minimumReleaseAge and schedule

Renovate previously applied one flat 3-day `minimumReleaseAge` and one weekly schedule to every dependency update. We split this by risk instead: npm major bumps wait 7 days (more blast radius, manually reviewed anyway), the existing automerged devDependency patch/minor group keeps the 3-day baseline, and vulnerability-driven updates get a reduced 1-day wait plus automerge. The schedule moved from weekly to daily across the board, so PRs appear as soon as their age requirement is met instead of queueing for the next Monday window.

## Consequences

- **GitHub Actions are deliberately excluded from the majors rule.** This repo pins Actions by major tag only (`actions/checkout@v4`), so Renovate can only ever see "major" as the update type for an Actions bump — there's no patch/minor granularity to read from a tag-only pin. Folding Actions into `matchUpdateTypes: ["major"]` would have slowed down routine Actions bumps for a risk signal that doesn't actually apply to them. Don't merge Actions into that rule without re-pinning by SHA first.
- **The vulnerability-alert wait is 1 day, not 0.** Vulnerability fixes also automerge, and this repo's release pipeline (`semantic-release`) fires on every push to `main` — so a 0-day wait would mean a compromised or hastily-yanked "security fix" could merge and release fully unattended, with no human or scanner ever seeing it. The 1-day buffer is the only guard rail left on that specific path; don't drop it to chase faster remediation without weighing that trade-off again.
