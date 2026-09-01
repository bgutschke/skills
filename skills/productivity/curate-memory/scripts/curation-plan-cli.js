#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const {
  resolvePool,
  planDigest,
  extractVerificationTargets,
  verifyRetainedMemories,
  encodeProjectDirectoryName,
  STORE_DIRECTORY_NAME,
  DEFAULT_TOKEN_BUDGET,
  DEFAULT_SESSION_CAP,
  DEFAULT_BATCH_WINDOW_TOKENS,
  DEFAULT_REDUCE_THRESHOLD_MINERS,
} = require('./curation-plan');

const USAGE = `Usage:
  curation-plan-cli.js [--memory-dir <path>] [--token-budget <n>] [--dry-run]
      plan a pass and write one session digest file per batch
  curation-plan-cli.js --verify-store <digest> re-hash the input store and compare
  curation-plan-cli.js --verify-memories <candidate store path>
      check every retained memory's named files, commands, and flags against the working
      tree and report each as verified, unverifiable, or carrying nothing concrete to check

--token-budget overrides the default prose-token budget (${DEFAULT_TOKEN_BUDGET}).
--dry-run resolves the plan and writes the digests as usual; it changes nothing here — it
  is a signal reported back in the plan for the skill to stop on before it mines.`;

// A file this large is treated as unlikely to be prose worth scanning for a command or
// flag mention, and reading it in full would cost more than the check is worth.
const MAX_SCAN_BYTES = 2_000_000;

const STORE_INDEX_NAME = 'MEMORY.md';

function main(argv) {
  const options = parseArgs(argv);
  if (options.help) return exitWith(USAGE, 0);
  if (options.unknown) return exitWith(`Unrecognised argument: ${options.unknown}\n${USAGE}`, 1);

  if (options.verifyMemories) return verifyMemories(options.verifyMemories);

  const tokenBudget = resolveTokenBudget(options.tokenBudget);
  if (tokenBudget === null) return exitWith(`--token-budget must be a positive integer, got "${options.tokenBudget}"\n${USAGE}`, 1);

  const environment = readEnvironment(options.memoryDir);
  if (!environment) return exitWith('Not inside a git repository; a pass is scoped to one project.', 1);

  // The worktree-state scan reads every project directory's transcripts, so its result is
  // read once here and threaded through rather than repeated for the second resolvePool
  // call below — unlike transcriptFiles, this one is too expensive to recompute for free.
  const worktreeStateRecords = readWorktreeStateRecords(environment);

  // Locating the project directory — and which worktree directories belong in the pool —
  // is what tells the wrapper where to read transcripts from, so the pool can only be
  // filled on a second pass over the same inputs. Keeping that cost buys the module
  // boundary the one thing it is for: exactly two pure functions, neither of which opens
  // anything.
  const located = resolvePool({ ...environment, transcriptFiles: [], worktreeStateRecords });
  if (located.status !== 'resolved') {
    return exitWith(`No session history for ${environment.repoToplevel} under ${environment.projectsDirectory}.`, 1);
  }

  return options.verifyStore
    ? verifyStore(located.store, options.verifyStore)
    : plan(environment, located, worktreeStateRecords, { tokenBudget, dryRun: options.dryRun });
}

// A mistyped flag reports itself and fails, rather than printing usage and exiting zero:
// the pass treats a zero exit as "carry on", so a silent success here would send it into
// mining with no digest to mine.
function parseArgs(argv) {
  const options = { memoryDir: null, verifyStore: null, verifyMemories: null, tokenBudget: null, dryRun: false, help: false, unknown: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--memory-dir') options.memoryDir = argv[i += 1] ?? null;
    else if (argv[i] === '--verify-store') options.verifyStore = argv[i += 1] ?? null;
    else if (argv[i] === '--verify-memories') options.verifyMemories = argv[i += 1] ?? null;
    else if (argv[i] === '--token-budget') options.tokenBudget = argv[i += 1] ?? null;
    else if (argv[i] === '--dry-run') options.dryRun = true;
    else if (argv[i] === '--help') options.help = true;
    else options.unknown ??= argv[i];
  }
  return options;
}

// null means "not given" (fall back to the module default); NaN or non-positive means the
// flag was given something that isn't a usable budget, which the caller reports and exits
// on rather than silently falling back to the default.
function resolveTokenBudget(raw) {
  if (raw === null) return undefined;
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : null;
}

function readEnvironment(memoryDirectory) {
  const repoToplevel = readRepoToplevel();
  if (!repoToplevel) return null;
  const projectsDirectory = path.join(claudeConfigDirectory(), 'projects');
  return {
    repoToplevel,
    projectsDirectory,
    projectDirectoryNames: readDirectoryNames(projectsDirectory),
    memoryDirectory,
    liveWorktreePaths: readLiveWorktreePaths(),
  };
}

function readRepoToplevel() {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

// A missing `git` command, an unfamiliar output shape, or no output at all must degrade
// this source to nothing rather than fail the pass — the pool unions two other sources
// precisely so this one is allowed to go quiet.
function readLiveWorktreePaths() {
  let output;
  try {
    output = execFileSync('git', ['worktree', 'list', '--porcelain'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return null;
  }
  return output
    .split('\n')
    .filter((line) => line.startsWith('worktree '))
    .map((line) => line.slice('worktree '.length).trim());
}

function claudeConfigDirectory() {
  return process.env.CLAUDE_CONFIG_DIR ?? path.join(os.homedir(), '.claude');
}

function readDirectoryNames(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
}

// Every project directory's transcripts are scanned for a worktree-state record, since a
// worktree this project created is recorded in its own transcripts (the "parent" case),
// while a worktree with no creation record there is only recoverable from a record the
// worktree's own session wrote about itself (the "sibling" case). Both are cheap: the
// record is rare, so lines are matched by substring before ever being parsed.
// The current project's own directory is scanned first, and always as 'worktree-state-parent',
// regardless of where the filesystem happens to list it among its siblings — so the same
// record found on both sides of a worktree resolves to a stable provenance run over run.
function readWorktreeStateRecords(environment) {
  const currentDirectoryName = encodeProjectDirectoryName(environment.repoToplevel);
  const orderedNames = [
    currentDirectoryName,
    ...environment.projectDirectoryNames.filter((name) => name !== currentDirectoryName),
  ].filter((name) => environment.projectDirectoryNames.includes(name));

  const records = [];
  for (const name of orderedNames) {
    const provenance = name === currentDirectoryName ? 'worktree-state-parent' : 'worktree-state-sibling';
    records.push(...scanWorktreeStateRecords(path.join(environment.projectsDirectory, name), provenance));
  }
  return records;
}

function scanWorktreeStateRecords(projectDirectory, provenance) {
  const records = [];
  for (const name of readTranscriptFileNames(projectDirectory)) {
    for (const line of fs.readFileSync(path.join(projectDirectory, name), 'utf8').split('\n')) {
      if (!line.includes('"type":"worktree-state"')) continue;
      const session = tryParseJson(line)?.worktreeSession;
      if (session?.originalCwd && session?.worktreePath) {
        records.push({ originalCwd: session.originalCwd, worktreePath: session.worktreePath, provenance });
      }
    }
  }
  return records;
}

function readTranscriptFileNames(projectDirectory) {
  return fs
    .readdirSync(projectDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.jsonl'))
    .map((entry) => entry.name);
}

function tryParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function plan(environment, located, worktreeStateRecords, { tokenBudget, dryRun }) {
  const worktreeTranscriptFiles = {};
  const worktreeMemoryFiles = {};
  for (const { directoryName } of located.worktrees) {
    const directory = path.join(environment.projectsDirectory, directoryName);
    worktreeTranscriptFiles[directoryName] = readTranscriptFiles(directory);
    worktreeMemoryFiles[directoryName] = readMemoryFileNames(directory);
  }

  const resolved = resolvePool({
    ...environment,
    storeFiles: readStoreFileNames(located.store.path),
    transcriptFiles: readTranscriptFiles(located.projectDirectory),
    worktreeStateRecords,
    worktreeTranscriptFiles,
    worktreeMemoryFiles,
  });
  const digest = planDigest({ sessions: resolved.pool.map(readSession), tokenBudget });
  // A noop pool is empty by construction, so this already writes zero batch files — but it
  // still has to run, since it's also what clears a stale digest directory left by an
  // earlier pass at this same path; skipping it here would leave that behind unclean.
  const batches = writeBatchDigests(resolved.outputs.sessionDigestDirectory, digest.batches);

  console.log(JSON.stringify({
    status: 'planned',
    mode: resolved.mode,
    dryRun,
    repoToplevel: environment.repoToplevel,
    projectDirectory: resolved.projectDirectory,
    store: describeStore(resolved.store),
    worktrees: resolved.worktrees,
    orphanStores: resolved.orphanStores,
    preflight: {
      tokenBudget: tokenBudget ?? DEFAULT_TOKEN_BUDGET,
      sessionCap: DEFAULT_SESSION_CAP,
      sessionsInPool: resolved.pool.length,
      sessionsSelected: digest.totals.sessionsSelected,
      sessionsSkippedNearEmpty: countReason(digest.skipped, 'near-empty'),
      sessionsBeyondBudget: countReason(digest.skipped, 'beyond-token-budget'),
      sessionsBeyondCap: countReason(digest.skipped, 'beyond-session-cap'),
      proseTokens: digest.totals.proseTokens,
      recordsByClass: digest.classification,
      selected: digest.selected.map(({ sessionId, modifiedAt, proseTokens, provenance }) => ({ sessionId, modifiedAt, proseTokens, provenance })),
      batchWindowTokens: DEFAULT_BATCH_WINDOW_TOKENS,
      batches,
      reduceThresholdMiners: DEFAULT_REDUCE_THRESHOLD_MINERS,
      reduceEngaged: digest.totals.reduceEngaged,
    },
    paths: resolved.outputs,
  }, null, 2));
  return 0;
}

// One miner reads one batch file, so each file is self-contained: it never has to open the
// shared digest directory or a neighbour's batch to know what it owns. A stale batch file
// left over from a prior pass at a larger budget would otherwise sit here forever, since
// nothing else in the pass ever deletes it — so the directory is cleared before every write.
function writeBatchDigests(directory, batches) {
  fs.rmSync(directory, { recursive: true, force: true });
  return batches.map((sessions, index) => {
    const batchPath = batchFilePath(directory, index);
    writeJson(batchPath, { sessions });
    return {
      index: index + 1,
      path: batchPath,
      sessionIds: sessions.map((session) => session.sessionId),
      proseTokens: sessions.reduce((total, session) => total + session.proseTokens, 0),
    };
  });
}

function batchFilePath(directory, index) {
  return path.join(directory, `batch-${String(index + 1).padStart(2, '0')}.json`);
}

function readTranscriptFiles(projectDirectory) {
  return fs
    .readdirSync(projectDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => ({
      name: entry.name,
      modifiedAt: fs.statSync(path.join(projectDirectory, entry.name)).mtime.toISOString(),
    }));
}

function readMemoryFileNames(projectDirectory) {
  return readFileNamesIn(path.join(projectDirectory, STORE_DIRECTORY_NAME)) ?? [];
}

// The resolved store's own status distinguishes "never existed" from "exists and holds
// nothing", so — unlike `readMemoryFileNames` above, where orphan detection folds an absent
// worktree store into the same empty result as an existing-but-empty one — this keeps
// `readFileNamesIn`'s `null` for a directory that isn't there rather than defaulting it away.
function readStoreFileNames(storePath) {
  return readFileNamesIn(storePath);
}

function readFileNamesIn(directory) {
  if (!fs.existsSync(directory)) return null;
  return fs.readdirSync(directory, { withFileTypes: true }).filter((entry) => entry.isFile()).map((entry) => entry.name);
}

function readSession({ sessionId, modifiedAt, transcriptPath }) {
  return { sessionId, modifiedAt, records: readJsonLines(transcriptPath) };
}

// A truncated final line, or a record the harness wrote in a shape this version does not
// know, must not abort a pass over a hundred other sessions.
function readJsonLines(filePath) {
  const records = [];
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      records.push(JSON.parse(line));
    } catch {
      records.push({});
    }
  }
  return records;
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function countReason(skipped, reason) {
  return skipped.filter((session) => session.reason === reason).length;
}

// Reads the candidate store the skill just wrote and the working tree it sits beside, then
// hands both to the pure checker. Every read here goes through `fs` and `git` invoked
// directly rather than a shell, so a hook that rewrites `grep`, `find`, or `ls` for the Bash
// tool has nothing to intercept: this runs inside the node process the skill already
// launched, never as a separate shell command of its own.
function verifyMemories(candidateStorePath) {
  if (!fs.existsSync(candidateStorePath)) return exitWith(`No candidate store at ${candidateStorePath}.`, 1);

  const repoToplevel = readRepoToplevel();
  if (!repoToplevel) return exitWith('Not inside a git repository; verification has no working tree to check against.', 1);

  const memories = readCandidateMemories(candidateStorePath);
  const filePaths = readWorkingTreeFilePaths(repoToplevel);
  const mentionedValues = scanForMentions(repoToplevel, filePaths, collectNonFileTargetValues(memories));

  console.log(JSON.stringify({
    status: 'checked',
    candidateStore: candidateStorePath,
    verification: verifyRetainedMemories(memories, { filePaths, mentionedValues }),
  }, null, 2));
  return 0;
}

function readCandidateMemories(storePath) {
  return fs
    .readdirSync(storePath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md') && entry.name !== STORE_INDEX_NAME)
    .map((entry) => ({ name: entry.name, body: fs.readFileSync(path.join(storePath, entry.name), 'utf8') }));
}

// Tracked files alone would miss a memory naming something added on this branch but not
// yet committed, so an untracked-but-not-ignored listing is unioned in alongside it.
function readWorkingTreeFilePaths(repoToplevel) {
  const tracked = readGitFileList(['ls-files'], repoToplevel);
  const untracked = readGitFileList(['ls-files', '--others', '--exclude-standard'], repoToplevel);
  return [...new Set([...(tracked ?? []), ...(untracked ?? [])])];
}

// `git ls-files` reports paths relative to the directory it runs in, not the repo root —
// without pinning `cwd` here, a verify-memories run from any directory but the toplevel
// would list paths that don't match what `scanForMentions` joins against `repoToplevel`,
// silently turning every file lookup into a miss.
function readGitFileList(args, cwd) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split('\n').filter(Boolean);
  } catch {
    return null;
  }
}

function collectNonFileTargetValues(memories) {
  const values = new Set();
  for (const memory of memories) {
    for (const target of extractVerificationTargets(memory.body)) {
      if (target.kind !== 'file') values.add(target.value);
    }
  }
  return values;
}

// One pass over the working tree's files checks every outstanding command or flag target
// at once, rather than one scan per target, so the cost of a check is bounded by the size
// of the tree and not by how many things the store names.
function scanForMentions(repoToplevel, filePaths, targetValues) {
  const remaining = new Set(targetValues);
  const found = new Set();
  for (const relativePath of filePaths) {
    if (remaining.size === 0) break;
    const content = readIfScannable(path.join(repoToplevel, relativePath));
    if (content === null) continue;
    for (const value of remaining) {
      if (!content.includes(value)) continue;
      found.add(value);
      remaining.delete(value);
    }
  }
  return found;
}

function readIfScannable(absolutePath) {
  try {
    if (fs.statSync(absolutePath).size > MAX_SCAN_BYTES) return null;
    return fs.readFileSync(absolutePath, 'utf8');
  } catch {
    return null;
  }
}

function verifyStore(store, expected) {
  const actual = hashStore(store.path);
  if (actual === expected) {
    console.log(JSON.stringify({ status: 'unchanged', store: store.path, digest: actual }, null, 2));
    return 0;
  }
  console.error(JSON.stringify({ status: 'changed', store: store.path, expected, actual }, null, 2));
  return 1;
}

// The index is derived from the memories rather than being one of them, so counting it
// would overstate the store the preflight reports back to the user.
function describeStore(store) {
  const files = readStoreFiles(store.path);
  return {
    ...store,
    present: files !== null,
    memoryCount: files?.filter((relative) => relative !== STORE_INDEX_NAME).length ?? 0,
    digest: hashStore(store.path),
  };
}

// Hashes the store's own relative paths alongside their bytes, so a rename with identical
// contents is still a change. An absent store hashes to a stable sentinel rather than
// throwing, since a cold-start pass has nothing to protect yet.
function hashStore(storePath) {
  const files = readStoreFiles(storePath);
  if (files === null) return 'absent';
  const hash = crypto.createHash('sha256');
  for (const relative of files.sort()) {
    hash.update(relative);
    hash.update('\0');
    hash.update(fs.readFileSync(path.join(storePath, relative)));
  }
  return `sha256:${hash.digest('hex')}`;
}

function readStoreFiles(storePath) {
  if (!fs.existsSync(storePath)) return null;
  return fs
    .readdirSync(storePath, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(storePath, path.join(entry.parentPath, entry.name)));
}

function exitWith(message, code) {
  (code === 0 ? console.log : console.error)(message);
  return code;
}

process.exit(main(process.argv.slice(2)));
