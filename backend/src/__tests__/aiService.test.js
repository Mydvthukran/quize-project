import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateQuizAi,
  explainAnswerAi,
  coachSuggestionsAi,
} from '../services/aiService.js';

// ---------------------------------------------------------------------------
// Helpers to control global fetch
// ---------------------------------------------------------------------------

function mockFetchOk(jsonBody) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () =>
      Promise.resolve({
        choices: [{ message: { content: JSON.stringify(jsonBody) } }],
      }),
  });
}

function mockFetchError(status = 500, body = 'Server error') {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    text: () => Promise.resolve(body),
  });
}

beforeEach(() => {
  // Ensure API key is set so callOpenAI is attempted
  process.env.OPENAI_API_KEY = 'test-key';
});

afterEach(() => {
  delete process.env.OPENAI_API_KEY;
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// generateQuizAi
// ---------------------------------------------------------------------------

describe('generateQuizAi', () => {
  it('returns AI-generated questions when OpenAI responds successfully', async () => {
    const fakeQuiz = { questions: [{ type: 'mcq', question: 'Q1?', answer: 'A1' }] };
    global.fetch = mockFetchOk(fakeQuiz);

    const result = await generateQuizAi({
      sourceType: 'text',
      source: 'Some content',
      topic: 'History',
      difficulty: 'easy',
      questionCount: 1,
    });

    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].question).toBe('Q1?');
  });

  it('falls back to local quiz when no API key is configured', async () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEYS;
    global.fetch = vi.fn();

    const result = await generateQuizAi({
      sourceType: 'text',
      source: '',
      topic: 'Physics',
      difficulty: 'medium',
      questionCount: 3,
    });

    expect(result.questions).toHaveLength(3);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('falls back to local quiz when OpenAI returns a non-OK response', async () => {
    global.fetch = mockFetchError(429, 'Rate limited');

    const result = await generateQuizAi({
      sourceType: 'text',
      source: '',
      topic: 'Math',
      difficulty: 'hard',
      questionCount: 2,
    });

    expect(Array.isArray(result.questions)).toBe(true);
    expect(result.questions.length).toBe(2);
  });

  it('local fallback generates the requested number of questions', async () => {
    delete process.env.OPENAI_API_KEY;

    const result = await generateQuizAi({
      sourceType: 'text',
      source: 'Some detailed notes about cellular respiration.',
      topic: 'Biology',
      difficulty: 'easy',
      questionCount: 6,
    });

    expect(result.questions).toHaveLength(6);
  });

  it('local fallback questions contain required fields', async () => {
    delete process.env.OPENAI_API_KEY;

    const result = await generateQuizAi({
      sourceType: 'text',
      source: 'Sorting algorithms include quicksort and mergesort.',
      topic: 'Algorithms',
      difficulty: 'medium',
      questionCount: 3,
    });

    for (const q of result.questions) {
      expect(q).toHaveProperty('type');
      expect(q).toHaveProperty('question');
      expect(q).toHaveProperty('answer');
      expect(q).toHaveProperty('explanation');
    }
  });

  it('falls back gracefully when fetch throws a network error', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network failure'));

    const result = await generateQuizAi({
      sourceType: 'text',
      source: '',
      topic: 'Chemistry',
      difficulty: 'easy',
      questionCount: 2,
    });

    expect(Array.isArray(result.questions)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// explainAnswerAi
// ---------------------------------------------------------------------------

describe('explainAnswerAi', () => {
  it('returns explanation from OpenAI when available', async () => {
    global.fetch = mockFetchOk({ explanation: 'Because of X.' });

    const result = await explainAnswerAi({
      question: 'Why is the sky blue?',
      answer: 'Light scattering',
    });

    expect(result.explanation).toBe('Because of X.');
  });

  it('returns local fallback explanation when no API key', async () => {
    delete process.env.OPENAI_API_KEY;
    global.fetch = vi.fn();

    const result = await explainAnswerAi({
      question: 'What is gravity?',
      answer: 'A fundamental force',
    });

    expect(typeof result.explanation).toBe('string');
    expect(result.explanation.length).toBeGreaterThan(0);
    expect(result.explanation).toContain('A fundamental force');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('local fallback includes both question and answer in the explanation', async () => {
    delete process.env.OPENAI_API_KEY;

    const result = await explainAnswerAi({
      question: 'What is photosynthesis?',
      answer: 'Conversion of light to energy',
    });

    expect(result.explanation).toContain('Conversion of light to energy');
    expect(result.explanation).toContain('photosynthesis');
  });

  it('falls back gracefully when fetch throws', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Timeout'));

    const result = await explainAnswerAi({
      question: 'What is DNA?',
      answer: 'Genetic material',
    });

    expect(typeof result.explanation).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// coachSuggestionsAi
// ---------------------------------------------------------------------------

describe('coachSuggestionsAi', () => {
  it('returns AI coach plan when OpenAI responds', async () => {
    const fakePlan = {
      nextTopics: ['Math', 'Science'],
      weakConcepts: ['Algebra'],
      threeDayPlan: ['Day 1: study', 'Day 2: practice', 'Day 3: review'],
    };
    global.fetch = mockFetchOk(fakePlan);

    const result = await coachSuggestionsAi({
      topicStats: [{ topic: 'Math', accuracy: 40 }],
    });

    expect(result.nextTopics).toEqual(['Math', 'Science']);
    expect(result.threeDayPlan).toHaveLength(3);
  });

  it('returns local fallback coach plan when no API key', async () => {
    delete process.env.OPENAI_API_KEY;
    global.fetch = vi.fn();

    const result = await coachSuggestionsAi({
      topicStats: [
        { topic: 'History', accuracy: 55 },
        { topic: 'Physics', accuracy: 30 },
      ],
    });

    expect(Array.isArray(result.nextTopics)).toBe(true);
    expect(Array.isArray(result.weakConcepts)).toBe(true);
    expect(Array.isArray(result.threeDayPlan)).toBe(true);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('local fallback includes weak topics (accuracy < 70)', async () => {
    delete process.env.OPENAI_API_KEY;

    const result = await coachSuggestionsAi({
      topicStats: [
        { topic: 'Algebra', accuracy: 40 },
        { topic: 'Geometry', accuracy: 85 },
        { topic: 'Calculus', accuracy: 60 },
      ],
    });

    expect(result.weakConcepts).toContain('Algebra');
    expect(result.weakConcepts).toContain('Calculus');
    expect(result.weakConcepts).not.toContain('Geometry');
  });

  it('local fallback provides default suggestions when all topics are strong', async () => {
    delete process.env.OPENAI_API_KEY;

    const result = await coachSuggestionsAi({
      topicStats: [{ topic: 'English', accuracy: 95 }],
    });

    expect(result.nextTopics.length).toBeGreaterThan(0);
    expect(result.threeDayPlan).toHaveLength(3);
  });

  it('local fallback handles empty topicStats', async () => {
    delete process.env.OPENAI_API_KEY;

    const result = await coachSuggestionsAi({ topicStats: [] });

    expect(Array.isArray(result.nextTopics)).toBe(true);
    expect(Array.isArray(result.threeDayPlan)).toBe(true);
  });

  it('falls back gracefully when fetch throws', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network down'));

    const result = await coachSuggestionsAi({ topicStats: [] });

    expect(Array.isArray(result.nextTopics)).toBe(true);
  });
});
