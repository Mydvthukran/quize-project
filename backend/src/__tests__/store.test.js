import { describe, it, expect, beforeEach } from 'vitest';
import { db, getUser, upsertTopicStats, addQuizAttempt } from '../data/store.js';

beforeEach(() => {
  // Reset db to a clean state before each test
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

describe('getUser', () => {
  it('returns the demo-user when called with default id', () => {
    const user = getUser('demo-user');
    expect(user.id).toBe('demo-user');
    expect(user.name).toBe('Learner');
  });

  it('creates a new user if userId does not exist', () => {
    const user = getUser('new-user-abc');
    expect(user.id).toBe('new-user-abc');
    expect(user.name).toBe('Learner-new-');
    expect(user.topics).toEqual({});
    expect(user.quizHistory).toEqual([]);
    expect(user.bookmarks).toEqual([]);
    expect(user.flashcards).toEqual([]);
  });

  it('returns the same user object on repeated calls', () => {
    const first = getUser('repeat-user');
    const second = getUser('repeat-user');
    expect(first).toBe(second);
  });

  it('defaults to demo-user when no argument is provided', () => {
    const user = getUser();
    expect(user.id).toBe('demo-user');
  });

  it('stores the new user in db.users', () => {
    getUser('brand-new');
    expect(db.users.has('brand-new')).toBe(true);
  });
});

describe('upsertTopicStats', () => {
  it('creates topic stats for a new topic', () => {
    const stats = upsertTopicStats('demo-user', 'JavaScript', {
      topic: 'JavaScript',
      attempts: 1,
      correct: 5,
      total: 8,
      accuracy: 62,
    });
    expect(stats.topic).toBe('JavaScript');
    expect(stats.attempts).toBe(1);
    expect(stats.correct).toBe(5);
    expect(stats.total).toBe(8);
  });

  it('merges new data with existing topic stats', () => {
    upsertTopicStats('demo-user', 'Python', { topic: 'Python', attempts: 1, correct: 3, total: 5 });
    const updated = upsertTopicStats('demo-user', 'Python', { attempts: 2, correct: 7, total: 10 });
    expect(updated.attempts).toBe(2);
    expect(updated.correct).toBe(7);
    expect(updated.total).toBe(10);
    expect(updated.topic).toBe('Python');
  });

  it('preserves existing fields not present in the patch', () => {
    upsertTopicStats('demo-user', 'CSS', {
      topic: 'CSS',
      attempts: 1,
      correct: 4,
      total: 5,
      timeSpentSec: 60,
    });
    const updated = upsertTopicStats('demo-user', 'CSS', { attempts: 2 });
    expect(updated.timeSpentSec).toBe(60);
  });

  it('persists changes to the user topics object', () => {
    upsertTopicStats('demo-user', 'HTML', { topic: 'HTML', attempts: 1 });
    const user = getUser('demo-user');
    expect(user.topics['HTML']).toBeDefined();
    expect(user.topics['HTML'].attempts).toBe(1);
  });
});

describe('addQuizAttempt', () => {
  it('adds an attempt to quizHistory', () => {
    addQuizAttempt('demo-user', { topic: 'Math', accuracy: 75, correct: 6, total: 8 });
    const user = getUser('demo-user');
    expect(user.quizHistory.length).toBe(1);
    expect(user.quizHistory[0].topic).toBe('Math');
  });

  it('prepends newest attempt to the front of history', () => {
    addQuizAttempt('demo-user', { topic: 'First', accuracy: 50 });
    addQuizAttempt('demo-user', { topic: 'Second', accuracy: 90 });
    const user = getUser('demo-user');
    expect(user.quizHistory[0].topic).toBe('Second');
  });

  it('adds a uuid id and createdAt to each attempt', () => {
    addQuizAttempt('demo-user', { topic: 'Science', accuracy: 80 });
    const user = getUser('demo-user');
    expect(user.quizHistory[0].id).toBeDefined();
    expect(user.quizHistory[0].createdAt).toBeDefined();
  });

  it('trims quiz history to at most 100 entries', () => {
    for (let i = 0; i < 105; i++) {
      addQuizAttempt('demo-user', { topic: `Topic-${i}`, accuracy: 70 });
    }
    const user = getUser('demo-user');
    expect(user.quizHistory.length).toBe(100);
  });
});
