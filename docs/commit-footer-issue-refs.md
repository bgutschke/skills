# Commit footer: issue references

Keep issue references (`#N`) out of the commit body entirely — put them only in the footer. commitlint's parser treats the *first* `#N` it finds anywhere in the body as the start of the footer; if that first mention lands on a hard-wrapped continuation line rather than one already preceded by a blank line, everything after it — including the real `Refs #10`/`Closes #10` line — gets swallowed into an unspaced "footer" and trips a `footer-leading-blank` warning.

`Closes #<n>` or `Refs #<n>` when the commit closes or relates to a tracked GitHub issue (see `docs/agents/issue-tracker.md`). Omit when there's no related issue — most commits won't have one.

Use `Closes #<n>`, never `Refs #<n>`, for the commit that ships an issue's last remaining acceptance-criteria item — GitHub then closes the issue automatically on push instead of needing a manual follow-up. Where the issue body has an explicit checklist, the test is mechanical: does this diff check off everything still unchecked? Where there's no checklist: would you want this push to auto-close the issue? Yes means `Closes`. A manual `gh issue close` stays valid only for issues that resolve without any shipping commit (`wontfix`, duplicates, pure decisions where the comment *is* the resolution).
