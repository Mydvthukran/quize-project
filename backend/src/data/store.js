import { v4 as uuidv4 } from 'uuid';

const challenges = [
  { id: 'daily-1', title: 'Finish 8 questions', xp: 25, goal: 8 },
  { id: 'daily-2', title: 'Score above 80%', xp: 35, goal: 80 },
  { id: 'daily-3', title: 'Maintain a 3-day streak', xp: 20, goal: 3 },
];

const defaultUser = {
  id: 'demo-user',
  name: 'Learner',
  xp: 120,
  streak: 2,
  badges: ['First Quiz'],
  topics: {},
  quizHistory: [],
  bookmarks: [],
  flashcards: [],
};

export const db = {
  users: new Map([[defaultUser.id, defaultUser]]),
  rooms: new Map(),
  challenges,
};

export function getUser(userId = 'demo-user') {
  if (!db.users.has(userId)) {
    db.users.set(userId, {
      ...defaultUser,
      id: userId,
      name: `Learner-${userId.slice(0, 4)}`,
      topics: {},
      quizHistory: [],
      bookmarks: [],
      flashcards: [],
    });
  }

  return db.users.get(userId);
}

export function upsertTopicStats(userId, topic, statsPatch) {
  const user = getUser(userId);
  const existing = user.topics[topic] || {
    topic,
    attempts: 0,
    correct: 0,
    total: 0,
    timeSpentSec: 0,
    weakAreas: [],
    lastAttempt: null,
  };

  user.topics[topic] = {
    ...existing,
    ...statsPatch,
  };

  return user.topics[topic];
}

export function addQuizAttempt(userId, attempt) {
  const user = getUser(userId);
  user.quizHistory.unshift({
    id: uuidv4(),
    createdAt: new Date().toISOString(),
    ...attempt,
  });

  user.quizHistory = user.quizHistory.slice(0, 100);
}
