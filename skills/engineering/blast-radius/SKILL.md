---
name: blast-radius
description: "Finds what a change can break outside its own diff. Names the one fact the change is safe because of, and rates each risk on a five-step evidence ladder. Reads the current branch against the repository's default branch, working tree included. Use when the user types /blast-radius."
disable-model-invocation: true
---

# blast-radius

Find what a change can break outside its own diff. Every run starts from a code anchor:
the paths and symbols the change touches, the commits behind it, their pull request
numbers, and the ticket identifiers.

## Dependencies

Requires `node` to run the bundled anchor script.

Requires an authenticated `gh` CLI for the pull request path only: the body and the
reviews of the branch's pull request. Without it, the anchor holds commits and the diff
only.

## Step 1: Build the code anchor

Build the anchor inside a subagent, because raw `git diff` and `git log` output has no
size limit. The script reads the current branch against the repository's default branch,
from the merge base to the working tree, untracked files included.

Call the **Agent** tool with:

- `subagent_type: "general-purpose"`
- `model: "haiku"`. The subagent runs one script and returns its output.
- `description: "Build blast-radius code anchor"`
- `prompt`: the brief below.

```text
Run, in the current git repository:
node "${CLAUDE_SKILL_DIR}/scripts/gather-change-anchor-cli.js"

Return exactly this, and nothing else:
ANCHOR: <the script's stdout, verbatim>

If the script exits non-zero, return "ERROR: " and its stderr.
Do not read the diff. Do not explain the change. Do not judge whether it is safe.
```

When the reply starts with `ERROR: `, relay it to the user and stop. Otherwise parse the
`ANCHOR:` line as JSON: `{ anchor, base, ghAuthenticated }`.

- `anchor.paths`: every file the change touches. A rename lists both names.
- `anchor.symbols`: the declared symbols the diff `added`, `changed`, and `deleted`. A
  changed symbol is one whose declaration line or body the diff edits.
- `anchor.commits`: the commits from the merge base to `HEAD`, newest first.
- `anchor.pullRequests`: the pull request numbers in the commit subjects, and the number
  of the branch's own pull request.
- `anchor.tickets`: the ticket identifiers in the commit subjects and bodies, the pull
  request body, and its reviews.
- `base`: the default branch `ref` and the merge-base `commit` the diff starts from.
- `ghAuthenticated`: false means that the anchor holds no pull request text.

The symbol lists come from a declaration pattern and indentation, not from a parser.
Treat them as the starting list to search from, not as the full set of what changed.

### The copied anchor builder

`scripts/build-code-anchor.js` and its test file are copies of the anchor builder that
the `why` skill ships. A skill must not load a file from another skill's bundle, because
the other skill can be absent where this one runs. The copy stays identical to the
original. `scripts/build-change-anchor.js` wraps it and adds what a change needs: the
paths and symbols read from the diff. When you fix the builder in one skill, fix it in
the other too.
