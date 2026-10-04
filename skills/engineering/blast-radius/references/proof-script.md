# Proving the safety fact

The full procedure for Step 6: one small script that tests the safety fact against the
real code. The fields `head` and `head.commit` come from the anchor of Step 1.

- [Check out the change](#check-out-the-change)
- [Make the throwaway directory](#make-the-throwaway-directory)
- [Write the script](#write-the-script)
- [Run it](#run-it)
- [Check the tracked files](#check-the-tracked-files)

## Check out the change

The script runs the code in the working tree. When `head` is not null, compare
`head.commit` with `git rev-parse HEAD`. If they differ, or if `git status --porcelain`
prints a line, the working tree does not hold the change. Do not check out anything
yourself, because a checkout changes the user's files. Ask the user with
**AskUserQuestion** to check out `head.commit`, or to skip the proof. If the user skips
it, the fact is `unproven`, and the reason is "the change is not checked out".

## Make the throwaway directory

Create the directory outside the repository, from the repository root:

```bash
mktemp -d
```

The shell keeps no variable from one Bash call to the next. Start every later command in
this step with `PROOF_DIR=<the printed path>;`, the literal path.

Snapshot the files before anything runs:

```bash
PROOF_DIR=<the printed path>; { git status --porcelain=v1 --untracked-files=all; git diff HEAD --binary | git hash-object --stdin; git ls-files -z --others --exclude-standard | xargs -0 git hash-object --; } > "$PROOF_DIR/before"
```

The status lists every changed and untracked path. The first hash covers the content of
the uncommitted changes to tracked files. The last command hashes each untracked file,
because the change can include one. Ignored files are not covered. Never write the
script, its output, or a snapshot inside the repository.

## Write the script

The script must meet all of these:

- It loads the real code: the library at the version the application ships, and the
  exact function the safety fact names. Never a copy, a stub, or a reimplementation.
- It prints the version and the path of the library that it loaded, so that you can
  compare them with the lockfile. When the fact names the repository's own code and no
  library, it prints the file path and the output of `git rev-parse HEAD`. Compare that
  commit with `head.commit` in place of the lockfile.
- It calls that function with the input the safety fact names.
- It exits non-zero, with a message that names the expected and the actual value, when
  the fact does not hold. It exits zero only when the fact holds.
- It needs no network, no live service, and no secret.

The script lives outside the repository, so a bare import does not find the
repository's packages. Resolve them from the repository root. In Node, use
`createRequire` from `node:module` on the repository's `package.json`, and import a
repository file by its absolute path. In Python, run the script with the repository's
own interpreter or virtual environment. Use the language and runtime that the
application uses.

Write it into the throwaway directory, for example `<the printed path>/proof.mjs`.

## Run it

Run `command -v timeout` first. Then run the script from the repository root, with a
time limit, and keep the output. For a Node script:

```bash
PROOF_DIR=<the printed path>; timeout 120 node "$PROOF_DIR/proof.mjs" > "$PROOF_DIR/output.txt" 2>&1; echo "exit: $?" >> "$PROOF_DIR/output.txt"
```

The limit of 120 seconds stops a script that hangs. A proof of one function call needs
far less. If `timeout` is missing, as on a stock macOS, drop `timeout 120` and give the
Bash tool a timeout instead.

Then read the output and decide:

- **Exit 0:** the fact holds. Compare the printed library version with the lockfile, or
  the printed commit with `head.commit`. If they differ, the script ran other code: the
  fact is `unproven`. If they match, set the safety fact to `Step: ran real code` and
  `Status: proven`.
- **Non-zero, and the message shows the fact is false:** the fact is `unproven` and
  keeps its step from Step 5. Add the risk "The safety fact
  does not hold" at `Step: ran real code`, with the script as its check.
- **Non-zero for another reason,** such as an import error, a wrong call, or a timeout:
  fix the script once. If the second run also fails for another reason, the fact is
  `unproven` and keeps its step. Raise no risk from a broken script.

If the script cannot be written with reasonable effort, or cannot run at all, the fact is
`unproven` and keeps its step. Reasonable effort ends when the fact needs a live service,
a network call, a secret, or a full running application to test. Say which in the
writeup.

Never call the fact proven without a run that exited 0.

## Check the tracked files

Run every other check script, for example one that backs a risk, in the same directory
and before the second snapshot. After the last run, take the same snapshot into
`$PROOF_DIR/after`, and compare the two:

```bash
PROOF_DIR=<the printed path>; { git status --porcelain=v1 --untracked-files=all; git diff HEAD --binary | git hash-object --stdin; git ls-files -z --others --exclude-standard | xargs -0 git hash-object --; } > "$PROOF_DIR/after"; diff "$PROOF_DIR/before" "$PROOF_DIR/after" && echo unchanged
```

No output other than `unchanged` means that nothing changed. Any other output lists the
lines that differ. In that case, show them to the user. Do not revert anything yourself.
The user decides. Report the result in the writeup either way.

Keep the directory after the run, so the user can rerun the script.
