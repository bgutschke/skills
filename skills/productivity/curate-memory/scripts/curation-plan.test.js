const { resolvePool, planDigest } = require('./curation-plan');

const PROJECTS = '/home/dev/.claude/projects';
const REPO = '/home/dev/work/my-app';
const REPO_DIRECTORY = '-home-dev-work-my-app';

function poolInput(overrides = {}) {
  return {
    repoToplevel: REPO,
    projectsDirectory: PROJECTS,
    projectDirectoryNames: [REPO_DIRECTORY],
    memoryDirectory: null,
    transcriptFiles: [],
    ...overrides,
  };
}

function userProse(text) {
  return { type: 'user', message: { role: 'user', content: text } };
}

function assistantProse(text) {
  return { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text }] } };
}

function session(sessionId, modifiedAt, records) {
  return { sessionId, modifiedAt, records };
}

// Enough prose to clear the near-empty floor without each fixture spelling out 2,000
// characters inline. 600 five-character words is 3,000 characters, or 750 prose tokens.
function bulkProse(words) {
  return userProse('word '.repeat(words));
}

describe('resolvePool', () => {
  it('resolves the project directory by encoding the repository toplevel', () => {
    const result = resolvePool(poolInput());
    expect(result.status).toBe('resolved');
    expect(result.projectDirectory).toBe(`${PROJECTS}/${REPO_DIRECTORY}`);
  });

  it('encodes a path separator and a dot to the same character', () => {
    const result = resolvePool(
      poolInput({
        repoToplevel: '/home/dev/work/my-app/.worktrees/fix-1.2',
        projectDirectoryNames: ['-home-dev-work-my-app--worktrees-fix-1-2'],
      }),
    );
    expect(result.projectDirectory).toBe(`${PROJECTS}/-home-dev-work-my-app--worktrees-fix-1-2`);
  });

  it('leaves an existing hyphen in the path unchanged', () => {
    const result = resolvePool(
      poolInput({
        repoToplevel: '/home/dev/work/my-app.v2-beta',
        projectDirectoryNames: ['-home-dev-work-my-app-v2-beta'],
      }),
    );
    expect(result.projectDirectory).toBe(`${PROJECTS}/-home-dev-work-my-app-v2-beta`);
  });

  it('reports no-project-directory when the encoded name is not among the enumerated names', () => {
    const result = resolvePool(poolInput({ projectDirectoryNames: ['-home-dev-work-other'] }));
    expect(result).toEqual({
      status: 'no-project-directory',
      projectDirectory: null,
      store: null,
      outputs: null,
      worktrees: [],
      pool: [],
      orphanStores: [],
    });
  });

  it('places every output beside the resolved store', () => {
    const store = `${PROJECTS}/${REPO_DIRECTORY}/memory`;
    expect(resolvePool(poolInput()).outputs).toEqual({
      candidateStore: `${store}-candidate`,
      report: `${store}-candidate-REPORT.md`,
      sessionDigest: `${store}-candidate-session-digest.json`,
    });
  });

  it('follows the store when session context puts it outside the project directory', () => {
    const stated = '/home/dev/elsewhere/memory';
    const result = resolvePool(poolInput({ memoryDirectory: stated }));
    expect(result.outputs.candidateStore).toBe(`${stated}-candidate`);
  });

  it('keeps the report and the digest outside the candidate store, so a plain move adopts it', () => {
    const { candidateStore, report, sessionDigest } = resolvePool(poolInput()).outputs;
    expect(report.startsWith(`${candidateStore}/`)).toBe(false);
    expect(sessionDigest.startsWith(`${candidateStore}/`)).toBe(false);
  });

  it('prefers the memory directory stated in session context over the encoded one', () => {
    const stated = '/home/dev/.claude/projects/-home-dev-work-my-app/memory';
    const result = resolvePool(poolInput({ memoryDirectory: stated }));
    expect(result.store).toEqual({
      path: stated,
      indexPath: `${stated}/MEMORY.md`,
      resolvedBy: 'session-context',
    });
  });

  it('derives the store from the encoded project directory when session context states none', () => {
    const result = resolvePool(poolInput());
    expect(result.store).toEqual({
      path: `${PROJECTS}/${REPO_DIRECTORY}/memory`,
      indexPath: `${PROJECTS}/${REPO_DIRECTORY}/memory/MEMORY.md`,
      resolvedBy: 'encoded-repo-path',
    });
  });

  it('orders the pool newest-first and tags every entry with its provenance', () => {
    const result = resolvePool(
      poolInput({
        transcriptFiles: [
          { name: 'older.jsonl', modifiedAt: '2026-01-01T00:00:00.000Z' },
          { name: 'newest.jsonl', modifiedAt: '2026-03-01T00:00:00.000Z' },
          { name: 'middle.jsonl', modifiedAt: '2026-02-01T00:00:00.000Z' },
        ],
      }),
    );
    expect(result.pool.map((entry) => entry.sessionId)).toEqual(['newest', 'middle', 'older']);
    expect(result.pool.every((entry) => entry.provenance === 'current-project')).toBe(true);
    expect(result.pool[0].transcriptPath).toBe(`${PROJECTS}/${REPO_DIRECTORY}/newest.jsonl`);
  });

  it('ignores non-transcript entries sitting alongside the transcripts', () => {
    const result = resolvePool(
      poolInput({
        transcriptFiles: [
          { name: 'memory', modifiedAt: '2026-03-01T00:00:00.000Z' },
          { name: 'kept.jsonl', modifiedAt: '2026-02-01T00:00:00.000Z' },
        ],
      }),
    );
    expect(result.pool.map((entry) => entry.sessionId)).toEqual(['kept']);
  });

  it('resolves a store with an empty pool rather than failing when the project has no transcripts', () => {
    const result = resolvePool(poolInput({ transcriptFiles: [] }));
    expect(result.status).toBe('resolved');
    expect(result.pool).toEqual([]);
  });

  describe('worktree-inclusive transcript discovery', () => {
    const LIVE_WORKTREE = '/home/dev/work/my-app-fix-1';
    const LIVE_WORKTREE_DIRECTORY = '-home-dev-work-my-app-fix-1';

    function worktreeTranscripts(directoryName, files) {
      return { worktreeTranscriptFiles: { [directoryName]: files } };
    }

    it('yields just the current project when there are no worktrees at all', () => {
      const result = resolvePool(poolInput());
      expect(result.worktrees).toEqual([]);
      expect(result.pool.every((entry) => entry.provenance === 'current-project')).toBe(true);
    });

    it('finds a live worktree from git worktree list', () => {
      const result = resolvePool(
        poolInput({
          projectDirectoryNames: [REPO_DIRECTORY, LIVE_WORKTREE_DIRECTORY],
          liveWorktreePaths: [REPO, LIVE_WORKTREE],
          ...worktreeTranscripts(LIVE_WORKTREE_DIRECTORY, [{ name: 'a.jsonl', modifiedAt: '2026-01-01T00:00:00.000Z' }]),
        }),
      );
      expect(result.worktrees).toEqual([{ directoryName: LIVE_WORKTREE_DIRECTORY, provenance: 'live-worktree' }]);
      expect(result.pool).toContainEqual(
        expect.objectContaining({ sessionId: 'a', provenance: 'live-worktree', transcriptPath: `${PROJECTS}/${LIVE_WORKTREE_DIRECTORY}/a.jsonl` }),
      );
    });

    it('excludes the main worktree that git worktree list reports for the repo itself', () => {
      const result = resolvePool(poolInput({ liveWorktreePaths: [REPO] }));
      expect(result.worktrees).toEqual([]);
    });

    it('finds a deleted worktree from a worktree-state record found in the parent project\'s own transcripts', () => {
      const deletedDirectory = '-home-dev-work-my-app--claude-worktrees-fix-2';
      const result = resolvePool(
        poolInput({
          projectDirectoryNames: [REPO_DIRECTORY, deletedDirectory],
          worktreeStateRecords: [
            { originalCwd: REPO, worktreePath: '/home/dev/work/my-app/.claude/worktrees/fix-2', provenance: 'worktree-state-parent' },
          ],
        }),
      );
      expect(result.worktrees).toEqual([{ directoryName: deletedDirectory, provenance: 'worktree-state-parent' }]);
    });

    it('finds a worktree with no creation record by matching a recorded original working directory to the repo toplevel', () => {
      const undocumentedDirectory = '-home-dev-work-my-app-worktrees-fix-3';
      const result = resolvePool(
        poolInput({
          projectDirectoryNames: [REPO_DIRECTORY, undocumentedDirectory],
          worktreeStateRecords: [
            { originalCwd: REPO, worktreePath: '/home/dev/work/my-app-worktrees/fix-3', provenance: 'worktree-state-sibling' },
          ],
        }),
      );
      expect(result.worktrees).toEqual([{ directoryName: undocumentedDirectory, provenance: 'worktree-state-sibling' }]);
    });

    it('ignores a worktree-state record whose original working directory does not match this repo', () => {
      const otherDirectory = '-home-dev-work-other-app-worktrees-fix';
      const result = resolvePool(
        poolInput({
          projectDirectoryNames: [REPO_DIRECTORY, otherDirectory],
          worktreeStateRecords: [
            { originalCwd: '/home/dev/work/other-app', worktreePath: '/home/dev/work/other-app-worktrees/fix', provenance: 'worktree-state-parent' },
          ],
        }),
      );
      expect(result.worktrees).toEqual([]);
    });

    it('dedupes the same worktree reported by more than one source into a single pool entry', () => {
      const directory = LIVE_WORKTREE_DIRECTORY;
      const result = resolvePool(
        poolInput({
          projectDirectoryNames: [REPO_DIRECTORY, directory],
          liveWorktreePaths: [LIVE_WORKTREE],
          worktreeStateRecords: [
            { originalCwd: REPO, worktreePath: LIVE_WORKTREE, provenance: 'worktree-state-parent' },
            { originalCwd: REPO, worktreePath: LIVE_WORKTREE, provenance: 'worktree-state-sibling' },
          ],
        }),
      );
      expect(result.worktrees).toHaveLength(1);
      expect(result.worktrees[0]).toEqual({ directoryName: directory, provenance: 'live-worktree' });
    });

    it('excludes a candidate worktree path whose encoded directory does not exist on disk', () => {
      const result = resolvePool(
        poolInput({
          worktreeStateRecords: [
            { originalCwd: REPO, worktreePath: '/home/dev/work/my-app/.claude/worktrees/never-read', provenance: 'worktree-state-parent' },
          ],
        }),
      );
      expect(result.worktrees).toEqual([]);
    });

    it('resolves nested, sibling, and flat worktree layouts together', () => {
      const nested = { path: `${REPO}/.claude/worktrees/nested-fix`, directory: '-home-dev-work-my-app--claude-worktrees-nested-fix' };
      const sibling = { path: '/home/dev/work/my-app-sibling-fix', directory: '-home-dev-work-my-app-sibling-fix' };
      const flat = { path: '/home/dev/work/my-app.flat-fix', directory: '-home-dev-work-my-app-flat-fix' };

      const result = resolvePool(
        poolInput({
          projectDirectoryNames: [REPO_DIRECTORY, nested.directory, sibling.directory, flat.directory],
          liveWorktreePaths: [nested.path],
          worktreeStateRecords: [
            { originalCwd: REPO, worktreePath: sibling.path, provenance: 'worktree-state-parent' },
            { originalCwd: REPO, worktreePath: flat.path, provenance: 'worktree-state-sibling' },
          ],
        }),
      );

      expect(result.worktrees.map((entry) => entry.directoryName).sort()).toEqual(
        [nested.directory, sibling.directory, flat.directory].sort(),
      );
    });

    it('encodes a worktree path containing a dot, a hyphen, and both to its project directory name', () => {
      const dotted = { path: `${REPO}/.worktrees/fix.1`, directory: '-home-dev-work-my-app--worktrees-fix-1' };
      const hyphenated = { path: `${REPO}/.worktrees/fix-2`, directory: '-home-dev-work-my-app--worktrees-fix-2' };
      const both = { path: `${REPO}/.worktrees/fix-3.beta`, directory: '-home-dev-work-my-app--worktrees-fix-3-beta' };

      const result = resolvePool(
        poolInput({
          projectDirectoryNames: [REPO_DIRECTORY, dotted.directory, hyphenated.directory, both.directory],
          liveWorktreePaths: [dotted.path, hyphenated.path, both.path],
        }),
      );

      expect(result.worktrees.map((entry) => entry.directoryName).sort()).toEqual(
        [dotted.directory, hyphenated.directory, both.directory].sort(),
      );
    });

    it('degrades to the remaining two sources when git worktree list output is absent', () => {
      const deletedDirectory = '-home-dev-work-my-app--claude-worktrees-fix-2';
      const result = resolvePool(
        poolInput({
          projectDirectoryNames: [REPO_DIRECTORY, deletedDirectory],
          liveWorktreePaths: null,
          worktreeStateRecords: [
            { originalCwd: REPO, worktreePath: '/home/dev/work/my-app/.claude/worktrees/fix-2', provenance: 'worktree-state-parent' },
          ],
        }),
      );
      expect(result.status).toBe('resolved');
      expect(result.worktrees).toEqual([{ directoryName: deletedDirectory, provenance: 'worktree-state-parent' }]);
    });

    it('degrades to the remaining two sources when git worktree list output does not parse to any paths', () => {
      const result = resolvePool(poolInput({ liveWorktreePaths: [] }));
      expect(result.status).toBe('resolved');
      expect(result.worktrees).toEqual([]);
    });

    it('reports a non-empty worktree memory store as an orphan and excludes it from the pool\'s stores', () => {
      const directory = LIVE_WORKTREE_DIRECTORY;
      const result = resolvePool(
        poolInput({
          projectDirectoryNames: [REPO_DIRECTORY, directory],
          liveWorktreePaths: [LIVE_WORKTREE],
          worktreeMemoryFiles: { [directory]: ['stray-note.md'] },
        }),
      );
      expect(result.orphanStores).toEqual([
        { directoryName: directory, path: `${PROJECTS}/${directory}/memory`, provenance: 'live-worktree' },
      ]);
      expect(result.store.path).toBe(`${PROJECTS}/${REPO_DIRECTORY}/memory`);
    });

    it('does not report an empty worktree memory store as an orphan', () => {
      const result = resolvePool(
        poolInput({
          projectDirectoryNames: [REPO_DIRECTORY, LIVE_WORKTREE_DIRECTORY],
          liveWorktreePaths: [LIVE_WORKTREE],
          worktreeMemoryFiles: { [LIVE_WORKTREE_DIRECTORY]: [] },
        }),
      );
      expect(result.orphanStores).toEqual([]);
    });
  });
});

describe('planDigest', () => {
  describe('record classification', () => {
    function classify(record) {
      const plan = planDigest({ sessions: [session('s', '2026-01-01T00:00:00.000Z', [record])] });
      return plan.classification;
    }

    it('keeps a plain user message as user prose', () => {
      expect(classify(userProse('always squash before merging'))).toEqual({ 'user-prose': 1 });
    });

    it('keeps a user message carried as text blocks rather than a bare string', () => {
      const record = {
        type: 'user',
        message: { role: 'user', content: [{ type: 'text', text: 'always squash' }] },
      };
      expect(classify(record)).toEqual({ 'user-prose': 1 });
    });

    it('keeps an assistant text block as assistant prose', () => {
      expect(classify(assistantProse('I will squash first'))).toEqual({ 'assistant-prose': 1 });
    });

    it('drops a tool result', () => {
      const record = {
        type: 'user',
        message: { role: 'user', content: [{ type: 'tool_result', content: 'file contents' }] },
      };
      expect(classify(record)).toEqual({ 'tool-result': 1 });
    });

    it('drops an assistant tool call', () => {
      const record = {
        type: 'assistant',
        message: { role: 'assistant', content: [{ type: 'tool_use', name: 'Bash', input: {} }] },
      };
      expect(classify(record)).toEqual({ 'tool-call': 1 });
    });

    it('drops assistant thinking', () => {
      const record = {
        type: 'assistant',
        message: { role: 'assistant', content: [{ type: 'thinking', thinking: 'weighing options' }] },
      };
      expect(classify(record)).toEqual({ thinking: 1 });
    });

    it('drops a re-injected skill body', () => {
      const record = {
        type: 'user',
        isMeta: true,
        message: {
          role: 'user',
          content: 'Base directory for this skill: /plugins/x/skills/triage\n\n# Triage\n\nMove issues.',
        },
      };
      expect(classify(record)).toEqual({ 'skill-body': 1 });
    });

    it('drops a slash-command invocation', () => {
      const record = userProse('<command-message>to-pr</command-message>\n<command-name>/to-pr</command-name>');
      expect(classify(record)).toEqual({ 'slash-command': 1 });
    });

    it('drops local command output', () => {
      const record = {
        type: 'user',
        isMeta: true,
        message: { role: 'user', content: '<local-command-stdout>on branch main</local-command-stdout>' },
      };
      expect(classify(record)).toEqual({ 'local-command-output': 1 });
    });

    it('drops a system-only local command record', () => {
      const record = { type: 'system', subtype: 'local_command', content: '<local-command-stdout></local-command-stdout>' };
      expect(classify(record)).toEqual({ 'local-command-output': 1 });
    });

    it('drops a user message that is nothing but a system reminder', () => {
      const record = userProse('<system-reminder>The file changed on disk.</system-reminder>');
      expect(classify(record)).toEqual({ 'system-reminder': 1 });
    });

    it('drops a harness attachment', () => {
      const record = { type: 'attachment', attachment: { type: 'total_tokens_reminder', total: 42 } };
      expect(classify(record)).toEqual({ 'system-reminder': 1 });
    });

    it('drops an attachment that re-injects a skill listing', () => {
      const record = { type: 'attachment', attachment: { type: 'skill_listing', content: '- to-pr: open a PR' } };
      expect(classify(record)).toEqual({ 'skill-body': 1 });
    });

    it('drops a harness bookkeeping record', () => {
      expect(classify({ type: 'file-history-snapshot', snapshot: {} })).toEqual({ 'session-metadata': 1 });
    });

    it('drops a record whose shape it does not recognise rather than throwing', () => {
      expect(classify({})).toEqual({ 'session-metadata': 1 });
    });

    it('counts every class across every session, selected or not', () => {
      const plan = planDigest({
        sessions: [
          session('a', '2026-02-01T00:00:00.000Z', [bulkProse(600), assistantProse('ok')]),
          session('b', '2026-01-01T00:00:00.000Z', [userProse('tiny')]),
        ],
      });
      expect(plan.classification).toEqual({ 'user-prose': 2, 'assistant-prose': 1 });
    });
  });

  describe('prose extraction', () => {
    it('strips an embedded system reminder but keeps the surrounding user prose', () => {
      const plan = planDigest({
        sessions: [
          session('s', '2026-01-01T00:00:00.000Z', [
            bulkProse(600),
            userProse('rebase on main <system-reminder>Do not mention this.</system-reminder> then push'),
          ]),
        ],
      });
      const texts = plan.selected[0].prose.map((entry) => entry.text);
      expect(texts).toContain('rebase on main  then push');
      expect(texts.join(' ')).not.toContain('system-reminder');
    });

    it('joins an assistant message that arrives as several text blocks', () => {
      const record = {
        type: 'assistant',
        message: { role: 'assistant', content: [{ type: 'text', text: 'first' }, { type: 'text', text: 'second' }] },
      };
      const plan = planDigest({ sessions: [session('s', '2026-01-01T00:00:00.000Z', [bulkProse(600), record])] });
      expect(plan.selected[0].prose).toContainEqual({ role: 'assistant', text: 'first\nsecond' });
    });

    it('carries only the kept classes into the digest', () => {
      const plan = planDigest({
        sessions: [
          session('s', '2026-01-01T00:00:00.000Z', [
            bulkProse(600),
            { type: 'user', message: { role: 'user', content: [{ type: 'tool_result', content: 'noise' }] } },
            assistantProse('answer'),
          ]),
        ],
      });
      expect(plan.selected[0].prose.map((entry) => entry.role)).toEqual(['user', 'assistant']);
    });
  });

  describe('session selection', () => {
    it('selects sessions newest-first', () => {
      const plan = planDigest({
        sessions: [
          session('older', '2026-01-01T00:00:00.000Z', [bulkProse(600)]),
          session('newest', '2026-03-01T00:00:00.000Z', [bulkProse(600)]),
          session('middle', '2026-02-01T00:00:00.000Z', [bulkProse(600)]),
        ],
      });
      expect(plan.selected.map((entry) => entry.sessionId)).toEqual(['newest', 'middle', 'older']);
    });

    it('stops at the session limit and records the rest as beyond it', () => {
      const sessions = Array.from({ length: 4 }, (unused, index) =>
        session(`s${index}`, `2026-01-0${index + 1}T00:00:00.000Z`, [bulkProse(600)]),
      );
      const plan = planDigest({ sessions, sessionLimit: 2 });
      expect(plan.selected.map((entry) => entry.sessionId)).toEqual(['s3', 's2']);
      expect(plan.skipped).toEqual([
        expect.objectContaining({ sessionId: 's1', reason: 'beyond-session-limit' }),
        expect.objectContaining({ sessionId: 's0', reason: 'beyond-session-limit' }),
      ]);
    });

    it('applies a default session limit when none is given', () => {
      const sessions = Array.from({ length: 12 }, (unused, index) =>
        session(`s${index}`, `2026-01-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`, [bulkProse(600)]),
      );
      const plan = planDigest({ sessions });
      expect(plan.selected).toHaveLength(8);
    });

    it('skips a near-empty session without spending a selection slot on it', () => {
      const plan = planDigest({
        sessions: [
          session('aborted', '2026-03-01T00:00:00.000Z', [userProse('hm')]),
          session('real', '2026-02-01T00:00:00.000Z', [bulkProse(600)]),
        ],
        sessionLimit: 1,
      });
      expect(plan.selected.map((entry) => entry.sessionId)).toEqual(['real']);
      expect(plan.skipped).toEqual([
        expect.objectContaining({ sessionId: 'aborted', reason: 'near-empty' }),
      ]);
    });

    it('skips a session whose only records are dropped classes', () => {
      const plan = planDigest({
        sessions: [
          session('tooling', '2026-03-01T00:00:00.000Z', [
            { type: 'user', message: { role: 'user', content: [{ type: 'tool_result', content: 'x'.repeat(40000) }] } },
          ]),
        ],
      });
      expect(plan.selected).toEqual([]);
      expect(plan.skipped).toEqual([expect.objectContaining({ sessionId: 'tooling', reason: 'near-empty' })]);
    });

    it('reports the prose-token total over the selected sessions only', () => {
      const plan = planDigest({
        sessions: [
          session('kept', '2026-03-01T00:00:00.000Z', [bulkProse(600)]),
          session('dropped', '2026-02-01T00:00:00.000Z', [bulkProse(600)]),
        ],
        sessionLimit: 1,
      });
      expect(plan.totals.proseTokens).toBe(plan.selected[0].proseTokens);
      expect(plan.totals).toEqual({ sessionsRead: 2, sessionsSelected: 1, proseTokens: expect.any(Number) });
    });

    it('returns an empty plan rather than an error when there are no sessions', () => {
      expect(planDigest({ sessions: [] })).toEqual({
        selected: [],
        skipped: [],
        classification: {},
        totals: { sessionsRead: 0, sessionsSelected: 0, proseTokens: 0 },
      });
    });
  });
});
