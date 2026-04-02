import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { db, getUser } from '../data/store.js';
import {
  createQuiz,
  submitQuiz,
  buildAdaptiveQuiz,
  buildCoachPlan,
} from '../services/quizService.js';

// ---------------------------------------------------------------------------
// Mock aiService so tests don't make real HTTP calls
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
  explainAnswerAi: vi.fn(async () => ({ explanation: 'Mocked explanation.' })),
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
// createQuiz
// ---------------------------------------------------------------------------

describe('createQuiz', () => {
  it('returns a quiz with an id, topic, difficulty, and questions array', async () => {
    const quiz = await createQuiz({ topic: 'JavaScript', difficulty: 'easy', questionCount: 3 });

    expect(quiz.id).toMatch(/^quiz-/);
    expect(quiz.topic).toBe('JavaScript');
    expect(quiz.difficulty).toBe('easy');
    expect(Array.isArray(quiz.questions)).toBe(true);
    expect(quiz.questions).toHaveLength(3);
  });

  it('assigns slug-like ids to each question', async () => {
    const quiz = await createQuiz({ topic: 'Node JS', difficulty: 'medium', questionCount: 2 });

    expect(quiz.questions[0].id).toBe('node-js-1');
    expect(quiz.questions[1].id).toBe('node-js-2');
  });

  it('uses default values when no payload is provided', async () => {
    const quiz = await createQuiz({});

    expect(quiz.topic).toBe('General Learning');
    expect(quiz.difficulty).toBe('medium');
    expect(quiz.questions).toHaveLength(8);
  });

  it('includes sourceType in the returned quiz', async () => {
    const quiz = await createQuiz({ sourceType: 'url', topic: 'CSS', questionCount: 2 });
    expect(quiz.sourceType).toBe('url');
  });
});

// ---------------------------------------------------------------------------
// submitQuiz
// ---------------------------------------------------------------------------

describe('submitQuiz', () => {
  const makeQuestions = (topic = 'Math') => [
    { id: 'math-1', question: 'What is 1+1?', answer: '2', topic },
    { id: 'math-2', question: 'What is 2+2?', answer: '4', topic },
    { id: 'math-3', question: 'What is 3+3?', answer: '6', topic },
  ];

  it('returns result, earnedXp, stats, streak, and badges', async () => {
    const questions = makeQuestions();
    const answers = { 'math-1': '2', 'math-2': '4', 'math-3': '6' };

    const summary = await submitQuiz({ userId: 'demo-user', topic: 'Math', questions, answers });

    expect(summary).toHaveProperty('result');
    expect(summary).toHaveProperty('earnedXp');
    expect(summary).toHaveProperty('stats');
    expect(summary).toHaveProperty('streak');
    expect(summary).toHaveProperty('badges');
  });

  it('scores correct answers accurately', async () => {
    const questions = makeQuestions();
    const answers = { 'math-1': '2', 'math-2': '4', 'math-3': 'wrong' };

    const summary = await submitQuiz({ userId: 'demo-user', topic: 'Math', questions, answers });

    expect(summary.result.correct).toBe(2);
    expect(summary.result.total).toBe(3);
    expect(summary.result.accuracy).toBe(67);
  });

  it('is case-insensitive when scoring answers', async () => {
    const questions = [{ id: 'q-1', question: 'Capital of France?', answer: 'Paris', topic: 'Geo' }];
    const answers = { 'q-1': 'paris' };

    const summary = await submitQuiz({ userId: 'demo-user', topic: 'Geo', questions, answers });

    expect(summary.result.correct).toBe(1);
  });

  it('earns at least 10 XP even for zero correct answers', async () => {
    const questions = makeQuestions();
    const answers = { 'math-1': 'wrong', 'math-2': 'wrong', 'math-3': 'wrong' };

    const summary = await submitQuiz({ userId: 'demo-user', topic: 'Math', questions, answers });

    expect(summary.earnedXp).toBeGreaterThanOrEqual(10);
  });

  it('increments user XP after submission', async () => {
    const user = getUser('demo-user');
    const xpBefore = user.xp;
    const questions = makeQuestions();
    const answers = { 'math-1': '2', 'math-2': '4', 'math-3': '6' };

    await submitQuiz({ userId: 'demo-user', topic: 'Math', questions, answers });

    expect(user.xp).toBeGreaterThan(xpBefore);
  });

  it('increments streak when accuracy >= 80%', async () => {
    const user = getUser('demo-user');
    const streakBefore = user.streak;
    const questions = makeQuestions();
    const answers = { 'math-1': '2', 'math-2': '4', 'math-3': '6' };

    await submitQuiz({ userId: 'demo-user', topic: 'Math', questions, answers });

    expect(user.streak).toBe(streakBefore + 1);
  });

  it('does not increment streak when accuracy < 80%', async () => {
    const user = getUser('demo-user');
    const streakBefore = user.streak;
    const questions = makeQuestions();
    const answers = { 'math-1': '2', 'math-2': 'wrong', 'math-3': 'wrong' };

    await submitQuiz({ userId: 'demo-user', topic: 'Math', questions, answers });

    expect(user.streak).toBe(streakBefore);
  });

  it('awards "Consistency Champ" badge when streak reaches 3', async () => {
    const user = getUser('demo-user');
    user.streak = 2;

    const questions = makeQuestions();
    const answers = { 'math-1': '2', 'math-2': '4', 'math-3': '6' };

    const summary = await submitQuiz({ userId: 'demo-user', topic: 'Math', questions, answers });

    expect(summary.badges).toContain('Consistency Champ');
  });

  it('does not duplicate "Consistency Champ" badge', async () => {
    const user = getUser('demo-user');
    user.streak = 5;
    user.badges = ['First Quiz', 'Consistency Champ'];

    const questions = makeQuestions();
    const answers = { 'math-1': '2', 'math-2': '4', 'math-3': '6' };

    await submitQuiz({ userId: 'demo-user', topic: 'Math', questions, answers });

    const champCount = user.badges.filter((b) => b === 'Consistency Champ').length;
    expect(champCount).toBe(1);
  });

  it('creates flashcards for missed questions', async () => {
    const user = getUser('demo-user');
    const questions = makeQuestions();
    const answers = { 'math-1': '2', 'math-2': 'wrong', 'math-3': 'wrong' };

    await submitQuiz({ userId: 'demo-user', topic: 'Math', questions, answers });

    expect(user.flashcards.length).toBe(2);
    expect(user.flashcards[0].front).toBeDefined();
    expect(user.flashcards[0].back).toBeDefined();
  });

  it('does not create flashcards when all answers are correct', async () => {
    const user = getUser('demo-user');
    const questions = makeQuestions();
    const answers = { 'math-1': '2', 'math-2': '4', 'math-3': '6' };

    await submitQuiz({ userId: 'demo-user', topic: 'Math', questions, answers });

    expect(user.flashcards.length).toBe(0);
  });

  it('stores quiz attempt in history', async () => {
    const user = getUser('demo-user');
    const questions = makeQuestions();
    const answers = { 'math-1': '2', 'math-2': '4', 'math-3': '6' };

    await submitQuiz({ userId: 'demo-user', topic: 'Math', questions, answers });

    expect(user.quizHistory.length).toBe(1);
    expect(user.quizHistory[0].topic).toBe('Math');
  });
});

// ---------------------------------------------------------------------------
// buildAdaptiveQuiz
// ---------------------------------------------------------------------------

describe('buildAdaptiveQuiz', () => {
  it('returns Foundations recommendation when user has no topics', () => {
    const result = buildAdaptiveQuiz('demo-user');

    expect(result.recommendedTopic).toBe('Foundations');
    expect(result.recommendedDifficulty).toBe('easy');
    expect(result.weakTopics).toEqual([]);
  });

  it('recommends the topic with the lowest accuracy', () => {
    const user = getUser('demo-user');
    user.topics = {
      Math: { topic: 'Math', accuracy: 40 },
      Science: { topic: 'Science', accuracy: 75 },
    };

    const result = buildAdaptiveQuiz('demo-user');

    expect(result.recommendedTopic).toBe('Math');
  });

  it('recommends "easy" when weakest topic accuracy < 45%', () => {
    const user = getUser('demo-user');
    user.topics = { History: { topic: 'History', accuracy: 30 } };

    const result = buildAdaptiveQuiz('demo-user');

    expect(result.recommendedDifficulty).toBe('easy');
  });

  it('recommends "medium" when weakest topic accuracy is between 45% and 70%', () => {
    const user = getUser('demo-user');
    user.topics = { History: { topic: 'History', accuracy: 55 } };

    const result = buildAdaptiveQuiz('demo-user');

    expect(result.recommendedDifficulty).toBe('medium');
  });

  it('recommends "hard" when weakest topic accuracy >= 70%', () => {
    const user = getUser('demo-user');
    user.topics = { History: { topic: 'History', accuracy: 72 } };

    const result = buildAdaptiveQuiz('demo-user');

    expect(result.recommendedDifficulty).toBe('hard');
  });

  it('returns up to 3 weak topics', () => {
    const user = getUser('demo-user');
    user.topics = {
      A: { topic: 'A', accuracy: 20 },
      B: { topic: 'B', accuracy: 30 },
      C: { topic: 'C', accuracy: 40 },
      D: { topic: 'D', accuracy: 90 },
    };

    const result = buildAdaptiveQuiz('demo-user');

    expect(result.weakTopics.length).toBeLessThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// buildCoachPlan
// ---------------------------------------------------------------------------

describe('buildCoachPlan', () => {
  it('returns a coach plan with the expected keys', async () => {
    const plan = await buildCoachPlan('demo-user');

    expect(plan).toHaveProperty('nextTopics');
    expect(plan).toHaveProperty('weakConcepts');
    expect(plan).toHaveProperty('threeDayPlan');
  });
});
