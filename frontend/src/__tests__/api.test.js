import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock socket.io-client before importing api.js so it never opens a real socket
// ---------------------------------------------------------------------------

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  })),
}));

// We also stub import.meta.env before importing so getApiUrl/getSocketUrl behave
// consistently in tests regardless of host detection logic.
vi.stubGlobal('import', { meta: { env: {} } });

// Re-import after mocks are in place
const { api } = await import('../api.js');

// ---------------------------------------------------------------------------
// Mock global fetch
// ---------------------------------------------------------------------------

function ok(body) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}

function fail(status = 500, text = 'Server error') {
  return Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve({ message: text }),
    text: () => Promise.resolve(text),
  });
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// api.health
// ---------------------------------------------------------------------------

describe('api.health', () => {
  it('calls the /health endpoint and returns the response', async () => {
    global.fetch.mockReturnValue(ok({ status: 'ok' }));

    const result = await api.health();

    expect(result).toEqual({ status: 'ok' });
    expect(global.fetch).toHaveBeenCalledOnce();
    const [url] = global.fetch.mock.calls[0];
    expect(url).toMatch(/\/health$/);
  });

  it('throws when the server returns a non-ok status', async () => {
    global.fetch.mockReturnValue(fail(500, 'Internal server error'));

    await expect(api.health()).rejects.toThrow('Internal server error');
  });
});

// ---------------------------------------------------------------------------
// api.generateQuiz
// ---------------------------------------------------------------------------

describe('api.generateQuiz', () => {
  it('sends a POST request with the correct payload', async () => {
    const fakeQuiz = { id: 'quiz-1', topic: 'Python', questions: [] };
    global.fetch.mockReturnValue(ok(fakeQuiz));

    const payload = { topic: 'Python', difficulty: 'easy', questionCount: 5 };
    const result = await api.generateQuiz(payload);

    expect(result).toEqual(fakeQuiz);
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toMatch(/\/quiz\/generate$/);
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toEqual(payload);
  });

  it('throws on a failed request', async () => {
    global.fetch.mockReturnValue(fail(400, 'Bad request'));
    await expect(api.generateQuiz({})).rejects.toThrow('Bad request');
  });
});

// ---------------------------------------------------------------------------
// api.submitQuiz
// ---------------------------------------------------------------------------

describe('api.submitQuiz', () => {
  it('sends a POST request to /quiz/submit', async () => {
    const fakeSummary = { result: { correct: 3, total: 5, accuracy: 60 }, earnedXp: 15 };
    global.fetch.mockReturnValue(ok(fakeSummary));

    const payload = { userId: 'demo-user', topic: 'Math', questions: [], answers: {} };
    const result = await api.submitQuiz(payload);

    expect(result.earnedXp).toBe(15);
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toMatch(/\/quiz\/submit$/);
    expect(opts.method).toBe('POST');
  });

  it('throws on server error', async () => {
    global.fetch.mockReturnValue(fail(500, 'Unexpected error'));
    await expect(api.submitQuiz({})).rejects.toThrow('Unexpected error');
  });
});

// ---------------------------------------------------------------------------
// api.explain
// ---------------------------------------------------------------------------

describe('api.explain', () => {
  it('sends a POST request to /quiz/explain', async () => {
    global.fetch.mockReturnValue(ok({ explanation: 'Because X.' }));

    const result = await api.explain({ question: 'Q?', answer: 'A' });

    expect(result.explanation).toBe('Because X.');
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toMatch(/\/quiz\/explain$/);
    expect(opts.method).toBe('POST');
  });
});

// ---------------------------------------------------------------------------
// api.adaptive
// ---------------------------------------------------------------------------

describe('api.adaptive', () => {
  it('calls /quiz/adaptive with userId query param', async () => {
    global.fetch.mockReturnValue(ok({ recommendedTopic: 'Math', recommendedDifficulty: 'easy', weakTopics: [] }));

    const result = await api.adaptive();

    expect(result.recommendedTopic).toBe('Math');
    const [url] = global.fetch.mock.calls[0];
    expect(url).toMatch(/\/quiz\/adaptive/);
    expect(url).toMatch(/userId/);
  });
});

// ---------------------------------------------------------------------------
// api.coach
// ---------------------------------------------------------------------------

describe('api.coach', () => {
  it('calls /quiz/coach and returns the plan', async () => {
    const fakePlan = { nextTopics: ['History'], weakConcepts: ['Dates'], threeDayPlan: [] };
    global.fetch.mockReturnValue(ok(fakePlan));

    const result = await api.coach();

    expect(result.nextTopics).toContain('History');
    const [url] = global.fetch.mock.calls[0];
    expect(url).toMatch(/\/quiz\/coach/);
  });
});

// ---------------------------------------------------------------------------
// api.dailyChallenges
// ---------------------------------------------------------------------------

describe('api.dailyChallenges', () => {
  it('calls /quiz/daily-challenges and returns challenges array', async () => {
    const fakeChallenges = { challenges: [{ id: 'daily-1', title: 'Finish 8 questions', xp: 25 }] };
    global.fetch.mockReturnValue(ok(fakeChallenges));

    const result = await api.dailyChallenges();

    expect(Array.isArray(result.challenges)).toBe(true);
    expect(result.challenges[0].id).toBe('daily-1');
  });
});

// ---------------------------------------------------------------------------
// api.dashboard
// ---------------------------------------------------------------------------

describe('api.dashboard', () => {
  it('calls /progress/dashboard and returns dashboard data', async () => {
    const fakeDashboard = {
      profile: { id: 'demo-user', xp: 100, streak: 1, badges: [] },
      topicStats: [],
      history: [],
      leaderboard: [],
    };
    global.fetch.mockReturnValue(ok(fakeDashboard));

    const result = await api.dashboard();

    expect(result.profile.id).toBe('demo-user');
    const [url] = global.fetch.mock.calls[0];
    expect(url).toMatch(/\/progress\/dashboard/);
  });
});

// ---------------------------------------------------------------------------
// api.flashcards
// ---------------------------------------------------------------------------

describe('api.flashcards', () => {
  it('calls /quiz/flashcards and returns flashcards array', async () => {
    global.fetch.mockReturnValue(ok({ flashcards: [{ id: 'fc-1', front: 'Q?', back: 'A' }] }));

    const result = await api.flashcards();

    expect(Array.isArray(result.flashcards)).toBe(true);
    expect(result.flashcards[0].front).toBe('Q?');
  });
});

// ---------------------------------------------------------------------------
// api.bookmarks
// ---------------------------------------------------------------------------

describe('api.bookmarks', () => {
  it('calls /quiz/bookmarks and returns bookmarks array', async () => {
    global.fetch.mockReturnValue(ok({ bookmarks: [{ id: '1', question: 'Saved?' }] }));

    const result = await api.bookmarks();

    expect(Array.isArray(result.bookmarks)).toBe(true);
    expect(result.bookmarks[0].question).toBe('Saved?');
  });
});

// ---------------------------------------------------------------------------
// api.bookmarkQuestion
// ---------------------------------------------------------------------------

describe('api.bookmarkQuestion', () => {
  it('sends a POST request with the question to /quiz/bookmark', async () => {
    global.fetch.mockReturnValue(ok({ bookmarks: [{ id: '1', question: 'What is a closure?' }] }));

    const result = await api.bookmarkQuestion('What is a closure?');

    expect(result.bookmarks[0].question).toBe('What is a closure?');
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toMatch(/\/quiz\/bookmark$/);
    expect(opts.method).toBe('POST');
    const body = JSON.parse(opts.body);
    expect(body.question).toBe('What is a closure?');
    expect(body.userId).toBe('demo-user');
  });

  it('throws when bookmarking fails', async () => {
    global.fetch.mockReturnValue(fail(400, 'question is required'));
    await expect(api.bookmarkQuestion('')).rejects.toThrow('question is required');
  });
});
