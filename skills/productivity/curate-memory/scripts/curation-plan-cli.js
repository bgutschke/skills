#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { resolvePool, planDigest } = require('./curation-plan');

const USAGE = `Usage:
  curation-plan-cli.js [--memory-dir <path>]   plan a pass and write the session digest
  curation-plan-cli.js --verify-store <digest> re-hash the input store and compare`;

const CANDIDATE_STORE_NAME = 'memory-candidate';
const REPORT_NAME = 'memory-candidate-REPORT.md';
const DIGEST_NAME = 'memory-candidate-session-digest.json';

function main(argv) {
  const options = parseArgs(argv);
  if (options.help) return exitWith(USAGE, 0);

  const repoToplevel = readRepoToplevel();
  if (!repoToplevel) return exitWith('Not inside a git repository; a pass is scoped to one project.', 1);

  const projectsDirectory = path.join(claudeConfigDirectory(), 'projects');
  const inputs = {
    repoToplevel,
    projectsDirectory,
    projectDirectoryNames: readDirectoryNames(projectsDirectory),
    memoryDirectory: options.memoryDir,
  };

  // Locating the project directory is what tells the wrapper where to read transcripts
  // from, so the pool can only be filled on a second pass over the same inputs.
  const located = resolvePool({ ...inputs, transcriptFiles: [] });
  if (located.status !== 'resolved') {
    return exitWith(`No session history for ${repoToplevel} under ${projectsDirectory}.`, 1);
  }

  if (options.verifyStore) return verifyStore(located.store, options.verifyStore);
  return plan(repoToplevel, resolvePool({ ...inputs, transcriptFiles: readTranscriptFiles(located.projectDirectory) }));
}

function plan(repoToplevel, resolved) {
  const digest = planDigest({ sessions: resolved.pool.map(readSession) });
  const paths = outputPaths(resolved.projectDirectory);
  writeJson(paths.sessionDigest, { sessions: digest.selected });

  console.log(JSON.stringify({
    status: 'planned',
    repoToplevel,
    projectDirectory: resolved.projectDirectory,
    store: describeStore(resolved.store),
    preflight: {
      sessionsInPool: resolved.pool.length,
      sessionsSelected: digest.totals.sessionsSelected,
      sessionsSkippedNearEmpty: countReason(digest.skipped, 'near-empty'),
      sessionsBeyondLimit: countReason(digest.skipped, 'beyond-session-limit'),
      proseTokens: digest.totals.proseTokens,
      recordsByClass: digest.classification,
      selected: digest.selected.map(({ sessionId, modifiedAt, proseTokens }) => ({ sessionId, modifiedAt, proseTokens })),
    },
    paths,
  }, null, 2));
  return 0;
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

function outputPaths(projectDirectory) {
  return {
    candidateStore: path.join(projectDirectory, CANDIDATE_STORE_NAME),
    report: path.join(projectDirectory, REPORT_NAME),
    sessionDigest: path.join(projectDirectory, DIGEST_NAME),
  };
}

function describeStore(store) {
  const memories = readStoreFiles(store.path);
  return { ...store, present: memories !== null, memoryCount: memories?.length ?? 0, digest: hashStore(store.path) };
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

function readTranscriptFiles(projectDirectory) {
  return fs
    .readdirSync(projectDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => ({
      name: entry.name,
      modifiedAt: fs.statSync(path.join(projectDirectory, entry.name)).mtime.toISOString(),
    }));
}

function readDirectoryNames(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
}

function readRepoToplevel() {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

function claudeConfigDirectory() {
  return process.env.CLAUDE_CONFIG_DIR ?? path.join(os.homedir(), '.claude');
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function countReason(skipped, reason) {
  return skipped.filter((session) => session.reason === reason).length;
}

function parseArgs(argv) {
  const options = { memoryDir: null, verifyStore: null, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--memory-dir') options.memoryDir = argv[i += 1] ?? null;
    else if (argv[i] === '--verify-store') options.verifyStore = argv[i += 1] ?? null;
    else options.help = true;
  }
  return options;
}

function exitWith(message, code) {
  (code === 0 ? console.log : console.error)(message);
  return code;
}

process.exit(main(process.argv.slice(2)));
