// A single miner holds one batch of prose alongside the existing store and its
// instructions inside a working window of roughly 60,000 tokens. Measured over a
// 112-session store at design time, the 20 newest sessions came to 134,000 prose tokens
// — about 6,700 each — so 8 sessions comes to roughly 54,000 and still leaves the miner
// room to reason. Raising this is what a later token-budget pass replaces, not tunes.
const DEFAULT_SESSION_LIMIT = 8;

// Of the same 112 sessions, 16 fell below 500 prose tokens; every one was an aborted
// session or a single question, carrying nothing a curation pass could act on. Skipping
// them keeps a selection slot for a session that has something in it.
const NEAR_EMPTY_FLOOR_TOKENS = 500;

// The real tokenizer is not available offline, and this figure never bills anything: it
// only ranks sessions against each other and against the floor above. Four characters per
// token is the standard rough ratio for English prose, which is what these records are.
const CHARS_PER_PROSE_TOKEN = 4;

const STORE_DIRECTORY_NAME = 'memory';
const STORE_INDEX_NAME = 'MEMORY.md';
const TRANSCRIPT_EXTENSION = '.jsonl';

function resolvePool({ repoToplevel, projectsDirectory, projectDirectoryNames, memoryDirectory, transcriptFiles }) {
  const directoryName = encodeProjectDirectoryName(repoToplevel);
  if (!projectDirectoryNames.includes(directoryName)) {
    return { status: 'no-project-directory', projectDirectory: null, store: null, pool: [] };
  }

  const projectDirectory = `${projectsDirectory}/${directoryName}`;
  return {
    status: 'resolved',
    projectDirectory,
    store: resolveStore(projectDirectory, memoryDirectory),
    pool: buildPool(projectDirectory, transcriptFiles),
  };
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

function buildPool(projectDirectory, transcriptFiles) {
  return transcriptFiles
    .filter((file) => file.name.endsWith(TRANSCRIPT_EXTENSION))
    .map((file) => ({
      sessionId: file.name.slice(0, -TRANSCRIPT_EXTENSION.length),
      transcriptPath: `${projectDirectory}/${file.name}`,
      modifiedAt: file.modifiedAt,
      provenance: 'current-project',
    }))
    .sort(byNewestFirst);
}

function planDigest({ sessions, sessionLimit = DEFAULT_SESSION_LIMIT }) {
  const classification = {};
  const digested = sessions
    .map((session) => digestSession(session, classification))
    .sort(byNewestFirst);

  const selected = [];
  const skipped = [];
  for (const session of digested) {
    if (session.proseTokens < NEAR_EMPTY_FLOOR_TOKENS) {
      skipped.push(skip(session, 'near-empty'));
    } else if (selected.length < sessionLimit) {
      selected.push(session);
    } else {
      skipped.push(skip(session, 'beyond-session-limit'));
    }
  }

  return {
    selected,
    skipped,
    classification,
    totals: {
      sessionsRead: sessions.length,
      sessionsSelected: selected.length,
      proseTokens: selected.reduce((total, session) => total + session.proseTokens, 0),
    },
  };
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

module.exports = { resolvePool, planDigest };
