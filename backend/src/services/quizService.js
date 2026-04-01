import { addQuizAttempt, getUser, upsertTopicStats } from '../data/store.js';
import { coachSuggestionsAi, generateQuizAi } from './aiService.js';

function computeWeakAreas(history = []) {
  const weakTopics = history
    .filter((item) => item.accuracy < 60)
    .map((item) => item.topic);
  return [...new Set(weakTopics)];
}

function scoreQuiz(questions, answers) {
  let correct = 0;

  const details = questions.map((question) => {
    const submitted = answers[question.id] ?? answers[question.question] ?? '';
    const isCorrect =
      String(submitted).trim().toLowerCase() ===
      String(question.answer).trim().toLowerCase();

    if (isCorrect) {
      correct += 1;
    }

    return {
      id: question.id,
      question: question.question,
      submitted,
      answer: question.answer,
      isCorrect,
      topic: question.topic,
      explanation: question.explanation,
    };
  });

  const total = questions.length;
  const accuracy = total === 0 ? 0 : Math.round((correct / total) * 100);

  return { correct, total, accuracy, details };
}

export async function createQuiz(payload) {
  const {
    sourceType = 'text',
    source = '',
    topic = 'General Learning',
    difficulty = 'medium',
    questionCount = 8,
  } = payload;

  const rawQuiz = await generateQuizAi({
    sourceType,
    source,
    topic,
    difficulty,
    questionCount,
  });

  const questions = (rawQuiz.questions || []).map((question, index) => ({
    ...question,
    id: `${topic.replace(/\s+/g, '-').toLowerCase()}-${index + 1}`,
  }));

  return {
    id: `quiz-${Date.now()}`,
    topic,
    difficulty,
    sourceType,
    questions,
  };
}

export async function submitQuiz(payload) {
  const {
    userId = 'demo-user',
    topic = 'General Learning',
    answers = {},
    questions = [],
    elapsedSec = 0,
  } = payload;

  const result = scoreQuiz(questions, answers);
  const user = getUser(userId);

  const prevTopic = user.topics[topic] || {
    attempts: 0,
    correct: 0,
    total: 0,
    timeSpentSec: 0,
  };

  const updatedTopic = upsertTopicStats(userId, topic, {
    topic,
    attempts: prevTopic.attempts + 1,
    correct: prevTopic.correct + result.correct,
    total: prevTopic.total + result.total,
    timeSpentSec: prevTopic.timeSpentSec + Number(elapsedSec || 0),
    accuracy: Math.round(
      ((prevTopic.correct + result.correct) /
        Math.max(1, prevTopic.total + result.total)) *
        100,
    ),
    lastAttempt: new Date().toISOString(),
  });

  const earnedXp = Math.max(10, result.correct * 5);
  user.xp += earnedXp;
  if (result.accuracy >= 80) {
    user.streak += 1;
  }

  if (user.streak >= 3 && !user.badges.includes('Consistency Champ')) {
    user.badges.push('Consistency Champ');
  }

  addQuizAttempt(userId, {
    topic,
    accuracy: result.accuracy,
    correct: result.correct,
    total: result.total,
    elapsedSec,
  });

  const weakAreas = computeWeakAreas(user.quizHistory);
  updatedTopic.weakAreas = weakAreas;

  if (result.details.some((detail) => !detail.isCorrect)) {
    const missed = result.details.filter((detail) => !detail.isCorrect);
    user.flashcards.unshift(
      ...missed.map((item) => ({
        id: `${item.id}-${Date.now()}`,
        front: item.question,
        back: item.answer,
        topic: item.topic,
        createdAt: new Date().toISOString(),
      })),
    );
    user.flashcards = user.flashcards.slice(0, 80);
  }

  return {
    result,
    earnedXp,
    stats: updatedTopic,
    streak: user.streak,
    badges: user.badges,
  };
}

export function buildAdaptiveQuiz(userId = 'demo-user') {
  const user = getUser(userId);
  const topics = Object.values(user.topics);

  if (!topics.length) {
    return {
      recommendedTopic: 'Foundations',
      recommendedDifficulty: 'easy',
      weakTopics: [],
    };
  }

  const sorted = [...topics].sort((a, b) => (a.accuracy || 0) - (b.accuracy || 0));
  const weakest = sorted[0];

  return {
    recommendedTopic: weakest.topic,
    recommendedDifficulty:
      weakest.accuracy < 45 ? 'easy' : weakest.accuracy < 70 ? 'medium' : 'hard',
    weakTopics: sorted.slice(0, 3).map((item) => item.topic),
  };
}

export async function buildCoachPlan(userId = 'demo-user') {
  const user = getUser(userId);
  const topicStats = Object.values(user.topics);
  return coachSuggestionsAi({ topicStats });
}
