#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { resolvePool, planDigest, encodeProjectDirectoryName, STORE_DIRECTORY_NAME } = require('./curation-plan');

const USAGE = `Usage:
  curation-plan-cli.js [--memory-dir <path>]   plan a pass and write the session digest
  curation-plan-cli.js --verify-store <digest> re-hash the input store and compare`;

const STORE_INDEX_NAME = 'MEMORY.md';

function main(argv) {
  const options = parseArgs(argv);
  if (options.help) return exitWith(USAGE, 0);
  if (options.unknown) return exitWith(`Unrecognised argument: ${options.unknown}\n${USAGE}`, 1);

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
    : plan(environment, located, worktreeStateRecords);
}

// A mistyped flag reports itself and fails, rather than printing usage and exiting zero:
// the pass treats a zero exit as "carry on", so a silent success here would send it into
// mining with no digest to mine.
function parseArgs(argv) {
  const options = { memoryDir: null, verifyStore: null, help: false, unknown: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--memory-dir') options.memoryDir = argv[i += 1] ?? null;
    else if (argv[i] === '--verify-store') options.verifyStore = argv[i += 1] ?? null;
    else if (argv[i] === '--help') options.help = true;
    else options.unknown ??= argv[i];
  }
  return options;
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

function plan(environment, located, worktreeStateRecords) {
  const worktreeTranscriptFiles = {};
  const worktreeMemoryFiles = {};
  for (const { directoryName } of located.worktrees) {
    const directory = path.join(environment.projectsDirectory, directoryName);
    worktreeTranscriptFiles[directoryName] = readTranscriptFiles(directory);
    worktreeMemoryFiles[directoryName] = readMemoryFileNames(directory);
  }

  const resolved = resolvePool({
    ...environment,
    transcriptFiles: readTranscriptFiles(located.projectDirectory),
    worktreeStateRecords,
    worktreeTranscriptFiles,
    worktreeMemoryFiles,
  });
  const digest = planDigest({ sessions: resolved.pool.map(readSession) });
  writeJson(resolved.outputs.sessionDigest, { sessions: digest.selected });

  console.log(JSON.stringify({
    status: 'planned',
    repoToplevel: environment.repoToplevel,
    projectDirectory: resolved.projectDirectory,
    store: describeStore(resolved.store),
    worktrees: resolved.worktrees,
    orphanStores: resolved.orphanStores,
    preflight: {
      sessionsInPool: resolved.pool.length,
      sessionsSelected: digest.totals.sessionsSelected,
      sessionsSkippedNearEmpty: countReason(digest.skipped, 'near-empty'),
      sessionsBeyondLimit: countReason(digest.skipped, 'beyond-session-limit'),
      proseTokens: digest.totals.proseTokens,
      recordsByClass: digest.classification,
      selected: digest.selected.map(({ sessionId, modifiedAt, proseTokens, provenance }) => ({ sessionId, modifiedAt, proseTokens, provenance })),
    },
    paths: resolved.outputs,
  }, null, 2));
  return 0;
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
  const memoryDirectory = path.join(projectDirectory, STORE_DIRECTORY_NAME);
  if (!fs.existsSync(memoryDirectory)) return [];
  return fs.readdirSync(memoryDirectory, { withFileTypes: true }).filter((entry) => entry.isFile()).map((entry) => entry.name);
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
