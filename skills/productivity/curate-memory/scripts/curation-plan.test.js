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
// characters inline.
function bulkProse(tokens) {
  return userProse('word '.repeat(tokens));
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
      pool: [],
    });
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
