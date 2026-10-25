# `to-pr` follows the repo template over its own fill rules

`to-pr` fills a repo's PR template with its own rules. Some of those rules clashed with
what a template asked for. A template asked the author to list the commands that they
ran and their result. The skill said "Never include run output". The agent followed the
skill, so the PR named `npm test` but did not say that the tests passed. A second
template named its own examples of a change that is hard to undo, such as a secret name
or a workflow trigger. The skill looked only for its own closed list of signals, so it
could write "Nothing" for a diff that renamed a secret.

We decided that a repo template's own instruction for a field wins over the skill's
fill rule for that field. The template is the more local rule: the repo wrote it for its
own PRs, and the skill serves many repos. Two cases follow from this rule now:

- If the testing field asks for results, each command gets a one-line result. The result
  comes only from tool output of a run in the same session. A command with no such run
  gets its name and no result.
- If the risk field names its own examples, the diff-evidence subagent looks for them
  next to the closed list. It reports one only for a literal change in the diff.

The grounding rules do not move. A template can ask for more evidence, but never for a
guess. The skill still invents no content, writes no claim about consequences, and puts
no log in the body.

## Considered Options

- **Keep the skill rules and leave the field short.** We rejected it. The PR then fails
  the repo's own review bar, and the reviewer must ask for what the template asked for.
- **Let the skill run the commands.** We rejected it. A test run can be slow or have side
  effects, and the skill opens a PR without a prompt.
- **Add the template examples to the closed list for good.** We rejected it. The examples
  of one repo would become rules for every repo.

## Consequences

- The same diff can produce a different body in two repos, because each template asks
  for different things.
- A body filled in a later session names the commands without results, because that
  session saw no run.
- The glossary term *Reversibility signal* now covers the examples that a template names.
