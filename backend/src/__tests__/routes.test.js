import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { db, getUser } from '../data/store.js';

// ---------------------------------------------------------------------------
// Mock aiService so route tests don't make real network calls
// ---------------------------------------------------------------------------

vi.mock('../services/aiService.js', () => ({
  generateQuizAi: vi.fn(async ({ topic, questionCount }) => ({
    questions: Array.from({ length: Number(questionCount) }).map((_, i) => ({
      type: 'mcq',
      question: `Q${i + 1} about ${topic}`,
      options: ['A', 'B', 'C', 'D'],
      answer: 'A',
      explanation: 'Because A.',
      topic,
      difficulty: 'medium',
    })),
  })),
  coachSuggestionsAi: vi.fn(async () => ({
    nextTopics: ['Math'],
    weakConcepts: ['Algebra'],
    threeDayPlan: ['Day 1', 'Day 2', 'Day 3'],
  })),
  explainAnswerAi: vi.fn(async ({ question, answer }) => ({
    explanation: `Explained: ${question} → ${answer}`,
  })),
}));

beforeEach(() => {
  db.users = new Map([
    [
      'demo-user',
      {
        id: 'demo-user',
        name: 'Learner',
        xp: 120,
        streak: 2,
        badges: ['First Quiz'],
        topics: {},
        quizHistory: [],
        bookmarks: [],
        flashcards: [],
      },
    ],
  ]);
});

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Health route
// ---------------------------------------------------------------------------

describe('GET /api/health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.app).toBe('LearnLoop API');
    expect(res.body.date).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Quiz routes
// ---------------------------------------------------------------------------

describe('POST /api/quiz/generate', () => {
  it('returns a quiz object with questions', async () => {
    const res = await request(app)
      .post('/api/quiz/generate')
      .send({ topic: 'Python', difficulty: 'easy', questionCount: 3 });

    expect(res.status).toBe(200);
    expect(res.body.topic).toBe('Python');
    expect(Array.isArray(res.body.questions)).toBe(true);
    expect(res.body.questions.length).toBe(3);
  });

  it('uses default values when no body is provided', async () => {
    const res = await request(app).post('/api/quiz/generate').send({});

    expect(res.status).toBe(200);
    expect(res.body.topic).toBe('General Learning');
    expect(res.body.questions.length).toBe(8);
  });
});

describe('POST /api/quiz/submit', () => {
  const questions = [
    { id: 'py-1', question: 'What is Python?', answer: 'A language', topic: 'Python' },
    { id: 'py-2', question: 'Is Python OOP?', answer: 'True', topic: 'Python' },
  ];

  it('returns result summary with correct fields', async () => {
    const res = await request(app).post('/api/quiz/submit').send({
      userId: 'demo-user',
      topic: 'Python',
      questions,
      answers: { 'py-1': 'A language', 'py-2': 'True' },
    });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('result');
    expect(res.body.result.correct).toBe(2);
    expect(res.body.result.accuracy).toBe(100);
    expect(res.body).toHaveProperty('earnedXp');
    expect(res.body).toHaveProperty('stats');
  });

  it('returns 0% accuracy when all answers are wrong', async () => {
    const res = await request(app).post('/api/quiz/submit').send({
      userId: 'demo-user',
      topic: 'Python',
      questions,
      answers: { 'py-1': 'wrong', 'py-2': 'wrong' },
    });

    expect(res.status).toBe(200);
    expect(res.body.result.correct).toBe(0);
    expect(res.body.result.accuracy).toBe(0);
  });
});

describe('POST /api/quiz/explain', () => {
  it('returns an explanation for a valid request', async () => {
    const res = await request(app).post('/api/quiz/explain').send({
      question: 'What is recursion?',
      answer: 'A function calling itself',
    });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('explanation');
    expect(typeof res.body.explanation).toBe('string');
  });

  it('returns 400 when question is missing', async () => {
    const res = await request(app)
      .post('/api/quiz/explain')
      .send({ answer: 'Something' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/question/i);
  });

  it('returns 400 when answer is missing', async () => {
    const res = await request(app)
      .post('/api/quiz/explain')
      .send({ question: 'What is X?' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/answer/i);
  });

  it('returns 400 when body is empty', async () => {
    const res = await request(app).post('/api/quiz/explain').send({});

    expect(res.status).toBe(400);
  });
});

describe('GET /api/quiz/adaptive', () => {
  it('returns default recommendation for a user with no topics', async () => {
    const res = await request(app)
      .get('/api/quiz/adaptive')
      .query({ userId: 'demo-user' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('recommendedTopic');
    expect(res.body).toHaveProperty('recommendedDifficulty');
    expect(res.body).toHaveProperty('weakTopics');
    expect(res.body.recommendedTopic).toBe('Foundations');
  });

  it('recommends weakest topic for user with topic history', async () => {
    const user = getUser('demo-user');
    user.topics = {
      Math: { topic: 'Math', accuracy: 30 },
      Science: { topic: 'Science', accuracy: 80 },
    };

    const res = await request(app)
      .get('/api/quiz/adaptive')
      .query({ userId: 'demo-user' });

    expect(res.status).toBe(200);
    expect(res.body.recommendedTopic).toBe('Math');
  });
});

describe('GET /api/quiz/coach', () => {
  it('returns a coach plan', async () => {
    const res = await request(app)
      .get('/api/quiz/coach')
      .query({ userId: 'demo-user' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('nextTopics');
    expect(res.body).toHaveProperty('threeDayPlan');
  });
});

describe('GET /api/quiz/daily-challenges', () => {
  it('returns the list of challenges', async () => {
    const res = await request(app).get('/api/quiz/daily-challenges');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.challenges)).toBe(true);
    expect(res.body.challenges.length).toBeGreaterThan(0);
    expect(res.body.challenges[0]).toHaveProperty('id');
    expect(res.body.challenges[0]).toHaveProperty('title');
    expect(res.body.challenges[0]).toHaveProperty('xp');
  });
});

describe('POST /api/quiz/bookmark', () => {
  it('adds a bookmark and returns updated list', async () => {
    const res = await request(app).post('/api/quiz/bookmark').send({
      userId: 'demo-user',
      question: 'What is a closure?',
    });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.bookmarks)).toBe(true);
    expect(res.body.bookmarks[0].question).toBe('What is a closure?');
    expect(res.body.bookmarks[0].id).toBeDefined();
    expect(res.body.bookmarks[0].createdAt).toBeDefined();
  });

  it('returns 400 when question is missing', async () => {
    const res = await request(app)
      .post('/api/quiz/bookmark')
      .send({ userId: 'demo-user' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/question/i);
  });

  it('limits bookmarks to 100 entries', async () => {
    const user = getUser('demo-user');
    user.bookmarks = Array.from({ length: 100 }, (_, i) => ({
      id: String(i),
      question: `Q${i}`,
      createdAt: new Date().toISOString(),
    }));

    await request(app).post('/api/quiz/bookmark').send({
      userId: 'demo-user',
      question: 'New bookmark',
    });

    expect(user.bookmarks.length).toBe(100);
  });
});

describe('GET /api/quiz/bookmarks', () => {
  it('returns an empty bookmarks list for a new user', async () => {
    const res = await request(app)
      .get('/api/quiz/bookmarks')
      .query({ userId: 'demo-user' });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.bookmarks)).toBe(true);
  });

  it('returns bookmarks that were previously saved', async () => {
    const user = getUser('demo-user');
    user.bookmarks = [
      { id: '1', question: 'Saved question', createdAt: new Date().toISOString() },
    ];

    const res = await request(app)
      .get('/api/quiz/bookmarks')
      .query({ userId: 'demo-user' });

    expect(res.body.bookmarks.length).toBe(1);
    expect(res.body.bookmarks[0].question).toBe('Saved question');
  });
});

describe('GET /api/quiz/flashcards', () => {
  it('returns an empty flashcards list for a user with no history', async () => {
    const res = await request(app)
      .get('/api/quiz/flashcards')
      .query({ userId: 'demo-user' });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.flashcards)).toBe(true);
    expect(res.body.flashcards.length).toBe(0);
  });

  it('returns flashcards created from missed quiz answers', async () => {
    const user = getUser('demo-user');
    user.flashcards = [
      { id: 'fc-1', front: 'What is X?', back: 'X is Y', topic: 'Topic', createdAt: new Date().toISOString() },
    ];

    const res = await request(app)
      .get('/api/quiz/flashcards')
      .query({ userId: 'demo-user' });

    expect(res.body.flashcards.length).toBe(1);
    expect(res.body.flashcards[0].front).toBe('What is X?');
  });
});

// ---------------------------------------------------------------------------
// Progress routes
// ---------------------------------------------------------------------------

describe('GET /api/progress/dashboard', () => {
  it('returns profile, topicStats, history, and leaderboard', async () => {
    const res = await request(app)
      .get('/api/progress/dashboard')
      .query({ userId: 'demo-user' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('profile');
    expect(res.body).toHaveProperty('topicStats');
    expect(res.body).toHaveProperty('history');
    expect(res.body).toHaveProperty('leaderboard');
  });

  it('profile contains expected fields', async () => {
    const res = await request(app)
      .get('/api/progress/dashboard')
      .query({ userId: 'demo-user' });

    const { profile } = res.body;
    expect(profile).toHaveProperty('id', 'demo-user');
    expect(profile).toHaveProperty('xp');
    expect(profile).toHaveProperty('streak');
    expect(profile).toHaveProperty('badges');
  });

  it('leaderboard is sorted by xp descending', async () => {
    // Add a second user with more XP
    db.users.set('high-scorer', {
      id: 'high-scorer',
      name: 'Champion',
      xp: 9999,
      streak: 10,
      badges: [],
      topics: {},
      quizHistory: [],
      bookmarks: [],
      flashcards: [],
    });

    const res = await request(app)
      .get('/api/progress/dashboard')
      .query({ userId: 'demo-user' });

    const { leaderboard } = res.body;
    expect(leaderboard[0].xp).toBeGreaterThanOrEqual(leaderboard[1]?.xp ?? 0);
  });

  it('leaderboard contains at most 10 entries', async () => {
    // Add 15 extra users
    for (let i = 0; i < 15; i++) {
      db.users.set(`user-${i}`, {
        id: `user-${i}`,
        name: `User ${i}`,
        xp: i * 10,
        streak: 0,
        badges: [],
        topics: {},
        quizHistory: [],
        bookmarks: [],
        flashcards: [],
      });
    }

    const res = await request(app).get('/api/progress/dashboard');
    expect(res.body.leaderboard.length).toBeLessThanOrEqual(10);
  });
});

describe('GET /api/progress/topic/:topicName', () => {
  it('returns 404 when the topic has not been attempted', async () => {
    const res = await request(app)
      .get('/api/progress/topic/NonExistentTopic')
      .query({ userId: 'demo-user' });

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/not found/i);
  });

  it('returns topic stats when topic exists', async () => {
    const user = getUser('demo-user');
    user.topics['JavaScript'] = {
      topic: 'JavaScript',
      attempts: 3,
      correct: 15,
      total: 20,
      accuracy: 75,
      timeSpentSec: 300,
      lastAttempt: new Date().toISOString(),
    };

    const res = await request(app)
      .get('/api/progress/topic/JavaScript')
      .query({ userId: 'demo-user' });

    expect(res.status).toBe(200);
    expect(res.body.topic).toBe('JavaScript');
    expect(res.body.attempts).toBe(3);
    expect(res.body.accuracy).toBe(75);
  });
});
