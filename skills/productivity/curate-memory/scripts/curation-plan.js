// A token budget bounds the thing actually being spent, so a pass costs roughly the same
// in a chatty project as in a quiet one. Measured over a 112-session store at design time,
// the 20 newest sessions came to 134,000 prose tokens and the 30 newest to 177,000, so
// 150,000 covers roughly a month of active work.
const DEFAULT_TOKEN_BUDGET = 150_000;

// A secondary guard for the case where sessions are individually tiny and the budget alone
// would pull in a very long tail. Mirrors the documented per-run session limit of the
// upstream managed-agents feature this technique is drawn from.
const DEFAULT_SESSION_CAP = 100;

// Of the same 112 sessions, 16 fell below 500 prose tokens; every one was an aborted
// session or a single question, carrying nothing a curation pass could act on. Skipping
// them keeps a selection slot for a session that has something in it, and they never count
// against the budget or the cap.
const NEAR_EMPTY_FLOOR_TOKENS = 500;

// A single miner holds one batch of prose alongside the existing store and its
// instructions inside a working window of roughly this many tokens. At ~6,700 prose
// tokens per session (134,000 prose tokens across the 20 newest sessions in the same
// measurement), 60,000 holds about 8-9 sessions and still leaves the miner room to reason.
// Raising the token budget above adds batches at this fixed size rather than enlarging
// them, which is what lets a deeper pass be a wider fan-out instead of a redesign.
const DEFAULT_BATCH_WINDOW_TOKENS = 60_000;

// Candidate volume starts competing with the store itself for the parent's synthesis
// context once this many miners have run: below it, one round of parent decisions is
// cheaper than a merge pass over merge passes.
const DEFAULT_REDUCE_THRESHOLD_MINERS = 8;

// The real tokenizer is not available offline, and this figure never bills anything: it
// only ranks sessions against each other and against the floor above. Four characters per
// token is the standard rough ratio for English prose, which is what these records are.
const CHARS_PER_PROSE_TOKEN = 4;

const STORE_DIRECTORY_NAME = 'memory';
const STORE_INDEX_NAME = 'MEMORY.md';
const TRANSCRIPT_EXTENSION = '.jsonl';

function resolvePool({
  repoToplevel,
  projectsDirectory,
  projectDirectoryNames,
  memoryDirectory,
  transcriptFiles,
  liveWorktreePaths,
  worktreeStateRecords = [],
  worktreeTranscriptFiles = {},
  worktreeMemoryFiles = {},
}) {
  const directoryName = encodeProjectDirectoryName(repoToplevel);
  if (!projectDirectoryNames.includes(directoryName)) {
    return { status: 'no-project-directory', projectDirectory: null, store: null, outputs: null, worktrees: [], pool: [], orphanStores: [] };
  }

  const projectDirectory = `${projectsDirectory}/${directoryName}`;
  const store = resolveStore(projectDirectory, memoryDirectory);
  const worktrees = resolveWorktreeDirectories({
    repoToplevel,
    directoryName,
    projectDirectoryNames,
    liveWorktreePaths,
    worktreeStateRecords,
  });

  return {
    status: 'resolved',
    projectDirectory,
    store,
    outputs: resolveOutputs(store),
    worktrees,
    pool: buildFullPool(projectsDirectory, projectDirectory, transcriptFiles, worktrees, worktreeTranscriptFiles),
    orphanStores: buildOrphanStores(projectsDirectory, worktrees, worktreeMemoryFiles),
  };
}

// The pool is the union of live worktrees, worktrees this project's own transcripts
// record creating, and worktrees found by scanning every other project's transcripts for
// a record pointing back at this repo. All three resolve forward only —
// a candidate is a real absolute path before it is ever encoded, so a wrong decode can
// never attach one project's transcripts to another project's pass. A candidate that
// encodes to a directory absent from disk, or to the current project itself, is dropped.
function resolveWorktreeDirectories({ repoToplevel, directoryName, projectDirectoryNames, liveWorktreePaths, worktreeStateRecords }) {
  const candidates = new Map();
  const addCandidate = (absolutePath, provenance) => {
    if (!absolutePath || absolutePath === repoToplevel) return;
    const encoded = encodeProjectDirectoryName(absolutePath);
    if (encoded === directoryName || candidates.has(encoded)) return;
    candidates.set(encoded, { directoryName: encoded, provenance });
  };

  for (const absolutePath of liveWorktreePaths ?? []) {
    addCandidate(absolutePath, 'live-worktree');
  }
  for (const record of worktreeStateRecords) {
    if (record.originalCwd === repoToplevel) addCandidate(record.worktreePath, record.provenance);
  }

  return [...candidates.values()].filter((entry) => projectDirectoryNames.includes(entry.directoryName));
}

function buildFullPool(projectsDirectory, projectDirectory, transcriptFiles, worktrees, worktreeTranscriptFiles) {
  const pools = [buildPool(projectDirectory, transcriptFiles, 'current-project')];
  for (const { directoryName, provenance } of worktrees) {
    pools.push(buildPool(`${projectsDirectory}/${directoryName}`, worktreeTranscriptFiles[directoryName] ?? [], provenance));
  }
  return pools.flat().sort(byNewestFirst);
}

// A worktree memory store is located, never merged: a memory written on a branch is as
// likely to be a note about that branch's task as a durable fact, and promoting it is a
// judgment the user should make once — never one the pass makes silently.
function buildOrphanStores(projectsDirectory, worktrees, worktreeMemoryFiles) {
  return worktrees
    .filter(({ directoryName }) => (worktreeMemoryFiles[directoryName] ?? []).length > 0)
    .map(({ directoryName, provenance }) => ({
      directoryName,
      path: `${projectsDirectory}/${directoryName}/${STORE_DIRECTORY_NAME}`,
      provenance,
    }));
}

// The harness maps both a path separator and a dot onto a hyphen, so decoding a directory
// name back into a path is ambiguous and a wrong decode would silently attach another
// project's transcripts to this pass. Resolution therefore only ever runs forward:
// encode a path that is already known, then test whether that directory exists.
function encodeProjectDirectoryName(absolutePath) {
  return absolutePath.replaceAll('/', '-').replaceAll('.', '-');
}

function resolveStore(projectDirectory, memoryDirectory) {
  const path = memoryDirectory ?? `${projectDirectory}/${STORE_DIRECTORY_NAME}`;
  return {
    path,
    indexPath: `${path}/${STORE_INDEX_NAME}`,
    resolvedBy: memoryDirectory ? 'session-context' : 'encoded-repo-path',
  };
}

// Every path a pass writes hangs off the store's own path, so the candidate store lands
// beside its input wherever that input turned out to be. Only the candidate store itself
// carries the store's shape: the report and the digest are siblings of it rather than
// contents, or adopting the candidate by a plain move would install them as memories.
function resolveOutputs({ path }) {
  return {
    candidateStore: `${path}-candidate`,
    report: `${path}-candidate-REPORT.md`,
    sessionDigestDirectory: `${path}-candidate-session-digest`,
  };
}

function buildPool(projectDirectory, transcriptFiles, provenance) {
  return transcriptFiles
    .filter((file) => file.name.endsWith(TRANSCRIPT_EXTENSION))
    .map((file) => ({
      sessionId: file.name.slice(0, -TRANSCRIPT_EXTENSION.length),
      transcriptPath: `${projectDirectory}/${file.name}`,
      modifiedAt: file.modifiedAt,
      provenance,
    }));
}

function planDigest({
  sessions,
  tokenBudget = DEFAULT_TOKEN_BUDGET,
  sessionCap = DEFAULT_SESSION_CAP,
  batchWindowTokens = DEFAULT_BATCH_WINDOW_TOKENS,
  reduceThresholdMiners = DEFAULT_REDUCE_THRESHOLD_MINERS,
}) {
  const classification = {};
  const digested = sessions
    .map((session) => digestSession(session, classification))
    .sort(byNewestFirst);

  // The cap is checked before the budget so it acts as the secondary guard it's meant to
  // be: once it's full, remaining sessions are capped out even if the budget has room,
  // which is exactly the tiny-sessions case it exists for.
  const selected = [];
  const skipped = [];
  let budgetSpent = 0;
  for (const session of digested) {
    if (session.proseTokens < NEAR_EMPTY_FLOOR_TOKENS) {
      skipped.push(skip(session, 'near-empty'));
    } else if (selected.length >= sessionCap) {
      skipped.push(skip(session, 'beyond-session-cap'));
    } else if (budgetSpent >= tokenBudget) {
      skipped.push(skip(session, 'beyond-token-budget'));
    } else {
      selected.push(session);
      budgetSpent += session.proseTokens;
    }
  }

  const batches = batchSessions(selected, batchWindowTokens);

  return {
    selected,
    skipped,
    batches,
    classification,
    totals: {
      sessionsRead: sessions.length,
      sessionsSelected: selected.length,
      proseTokens: budgetSpent,
      batchCount: batches.length,
      reduceEngaged: batches.length > reduceThresholdMiners,
    },
  };
}

// Batches never reorder the selection — each is a contiguous run of the newest-first list,
// so a correction and its follow-up always land with the same reader. A batch closes once
// the next session would push it past the window, and a single session bigger than the
// window becomes a batch of one rather than being split across two readers.
function batchSessions(selected, batchWindowTokens) {
  const batches = [];
  let current = [];
  let currentTokens = 0;
  for (const session of selected) {
    if (current.length > 0 && currentTokens + session.proseTokens > batchWindowTokens) {
      batches.push(current);
      current = [];
      currentTokens = 0;
    }
    current.push(session);
    currentTokens += session.proseTokens;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

function digestSession({ sessionId, modifiedAt, records }, classification) {
  const prose = [];
  for (const record of records) {
    const recordClass = classifyRecord(record);
    classification[recordClass] = (classification[recordClass] ?? 0) + 1;
    const text = readProse(record, recordClass);
    if (text) {
      prose.push({ role: recordClass === 'user-prose' ? 'user' : 'assistant', text });
    }
  }
  const characters = prose.reduce((total, entry) => total + entry.text.length, 0);
  return { sessionId, modifiedAt, proseTokens: Math.ceil(characters / CHARS_PER_PROSE_TOKEN), prose };
}

const SLASH_COMMAND = /^\s*<command-(?:message|name|args)>/;
const LOCAL_COMMAND = /^\s*<local-command-(?:caveat|stdout|stderr)>/;

// A skill re-injected into the conversation arrives as an ordinary user record whose text
// opens with the line the harness prepends to every skill body.
const RE_INJECTED_SKILL_BODY = /^\s*Base directory for this skill:/;

// Attachments are harness-injected context rather than anything a participant said, and
// reach the model wrapped as system reminders — except the two that carry a skill's own
// text, which belong with the other re-injected skill bodies.
const SKILL_BEARING_ATTACHMENTS = new Set(['skill_listing', 'dynamic_skill']);

function classifyRecord(record) {
  switch (record?.type) {
    case 'user':
      return classifyUserRecord(record);
    case 'assistant':
      return classifyAssistantRecord(record);
    case 'attachment':
      return SKILL_BEARING_ATTACHMENTS.has(record.attachment?.type) ? 'skill-body' : 'system-reminder';
    case 'system':
      return record.subtype === 'local_command' ? 'local-command-output' : 'session-metadata';
    default:
      return 'session-metadata';
  }
}

function classifyUserRecord(record) {
  const content = record.message?.content;
  if (Array.isArray(content) && content.some((block) => block.type === 'tool_result')) {
    return 'tool-result';
  }

  const text = readText(content);
  if (SLASH_COMMAND.test(text)) return 'slash-command';
  if (LOCAL_COMMAND.test(text)) return 'local-command-output';
  if (RE_INJECTED_SKILL_BODY.test(text)) return 'skill-body';
  if (!stripSystemReminders(text)) {
    return text.includes('<system-reminder>') ? 'system-reminder' : 'session-metadata';
  }

  // Everything still marked as meta was injected by the harness rather than typed by the
  // user, so it is not the real user prose this pass mines for.
  return record.isMeta ? 'session-metadata' : 'user-prose';
}

// A record carrying both reasoning and a reply is classified by the reply, since that is
// the part addressed to the conversation. Reasoning alone is dropped: it is the model
// talking to itself, and a memory should never cite it as evidence of anything.
function classifyAssistantRecord(record) {
  const content = record.message?.content;
  if (!Array.isArray(content)) return 'session-metadata';
  if (content.some((block) => block.type === 'text')) return 'assistant-prose';
  if (content.some((block) => block.type === 'tool_use')) return 'tool-call';
  if (content.some((block) => block.type === 'thinking')) return 'thinking';
  return 'session-metadata';
}

function readProse(record, recordClass) {
  if (recordClass !== 'user-prose' && recordClass !== 'assistant-prose') return '';
  return stripSystemReminders(readText(record.message?.content));
}

function readText(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n');
}

// A reminder can be appended to a message that also carries real prose, so it is removed
// from the text rather than used to discard the whole record.
function stripSystemReminders(text) {
  return text.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '').trim();
}

function skip(session, reason) {
  const { prose, ...withoutProse } = session;
  return { ...withoutProse, reason };
}

function byNewestFirst(left, right) {
  return right.modifiedAt.localeCompare(left.modifiedAt);
}

// A memory's own candidate contract already writes a concrete file, command, or flag
// inside a backtick span wherever it names one — that's the same convention this text
// asks its reader to follow elsewhere in this file. An inline code span is therefore the
// one surface this pass can check without chasing plain words through prose, which would
// produce false positives with no way to bound them.
const INLINE_CODE_SPAN = /`([^`\n]+)`/g;
const FLAG_PATTERN = /^--?[a-zA-Z][\w-]*$/;
// The extension itself must start with a letter, not a digit — otherwise a dotted version
// number (`1.13.0`) or a semver-ish range (`v2.1`) reads as a file, since both end in a
// dot followed by digits the same shape a real extension has.
const FILE_PATTERN = /[\\/]|\.[a-zA-Z][a-zA-Z0-9]{0,7}$/;

function extractVerificationTargets(body) {
  const seen = new Set();
  const targets = [];
  for (const match of body.matchAll(INLINE_CODE_SPAN)) {
    const value = match[1].trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    targets.push({ value, kind: classifyTargetKind(value) });
  }
  return targets;
}

function classifyTargetKind(value) {
  if (FLAG_PATTERN.test(value)) return 'flag';
  if (FILE_PATTERN.test(value)) return 'file';
  return 'command';
}

// Every retained memory is checked, never just the changed ones — a memory carried
// forward unchanged can still have gone stale because the repo moved on, with no session
// ever contradicting it. A failed check never removes anything here: it only annotates,
// because a search that finds nothing is not proof the thing is gone.
function verifyRetainedMemories(memories, workingTree) {
  const filePaths = workingTree.filePaths ?? [];
  const mentionedValues = workingTree.mentionedValues ?? new Set();
  return memories.map((memory) => {
    const targets = extractVerificationTargets(memory.body).map((target) => ({
      ...target,
      status: targetIsPresent(target, filePaths, mentionedValues) ? 'verified' : 'unverifiable',
    }));
    return { name: memory.name, targets, status: summarizeVerificationStatus(targets) };
  });
}

// A path match is checked regardless of kind, since `classifyTargetKind` is a heuristic
// that can call a real, extension-less filename (`Makefile`) a command — the path check
// still finds it. Only a command or flag falls back to the mention scan: a file that
// missed the path check is never given that fallback, since a stale file's own name can
// still turn up as a substring somewhere else in the tree (a changelog entry, this very
// report), and reporting that as "verified" would be the one wrong guess this check must
// not make — a false "unverifiable" costs a glance the user dismisses; a false "verified"
// costs the thing this whole check exists to catch.
function targetIsPresent(target, filePaths, mentionedValues) {
  if (matchesFilePath(target.value, filePaths)) return true;
  return target.kind !== 'file' && mentionedValues.has(target.value);
}

// An exact relative path is unambiguous. A bare filename matched only by suffix is not:
// this repo alone holds a `SKILL.md` per skill, so a memory naming just "SKILL.md" could
// mean any of them. Suffix matching only counts when it resolves to exactly one file —
// otherwise it is exactly the ambiguous case that must fall through to `unverifiable`
// rather than default to "verified" on a coincidence of naming.
function matchesFilePath(value, filePaths) {
  const normalized = value.replace(/^\.\//, '');
  if (filePaths.includes(normalized)) return true;
  const suffixMatches = filePaths.filter((filePath) => filePath.endsWith(`/${normalized}`));
  return suffixMatches.length === 1;
}

function summarizeVerificationStatus(targets) {
  if (targets.length === 0) return 'no-targets';
  return targets.every((target) => target.status === 'verified') ? 'verified' : 'unverifiable';
}

module.exports = {
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
};
