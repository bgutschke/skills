# Evidence ladder

Every risk and the safety fact in a `blast-radius` writeup carry exactly one ladder step.
The step says how far the claim was verified. It is a label from a closed list, never a
score, a percentage, or a blend of two steps.

## The five steps

1. **stated.** You wrote the claim down. Nothing backs it yet.
2. **pointed at the line.** You cite the real file and line, or the library source, where
   the behavior lives. You opened it and read it.
3. **walked the failure path.** You followed the path from the change to the place where
   it breaks, one hop at a time. Each hop has its location. The path reaches the break, or
   it stops at a named line.
4. **ran real code.** A script ran the real code: the library the application ships and
   the exact function in question. If the claim is wrong, the script exits non-zero.
5. **reproduced in the running application.** You saw the behavior in the running
   application, with the steps that show it.

## Rules

1. **A claim stands on the step it reached.** Prose never moves a claim up a step. A
   convincing paragraph about a failure path is step 1 until each hop has a location.
2. **Steps 4 and 5 need a run.** Only a script or the running application that you
   actually ran reaches them. A script you wrote but did not run is step 1.
3. **A failed run raises nothing.** After a failed proof script, the claim keeps the step
   it had before the run. It is marked unproven.
4. **The step goes next to the claim.** Write it as `Step: <label>`, for example
   `Step: pointed at the line`.

## Evidence rules

These hold for every claim in the writeup, at every step.

1. **Every location is real.** A location is a repository file and line that you opened.
   It can also be a path in the library's own source, at the version the project pins.
   Never cite a line you did not read.
2. **A search that found nothing is a result.** Report it as one: the command or the
   query, and the word "nothing". It is the basis for a cleared risk, not a gap to fill.
3. **Nothing is invented.** Never invent a caller, an API, a flag, a version, or a line
   reference. If you cannot find it, say what you searched.
