import { Router } from 'express';
import {
  buildAdaptiveQuiz,
  buildCoachPlan,
  createQuiz,
  submitQuiz,
} from '../services/quizService.js';
import { explainAnswerAi } from '../services/aiService.js';
import { db, getUser } from '../data/store.js';

export const quizRouter = Router();

quizRouter.post('/generate', async (req, res, next) => {
  try {
    const quiz = await createQuiz(req.body || {});
    res.json(quiz);
  } catch (error) {
    next(error);
  }
});

quizRouter.post('/submit', async (req, res, next) => {
  try {
    const summary = await submitQuiz(req.body || {});
    res.json(summary);
  } catch (error) {
    next(error);
  }
});

quizRouter.post('/explain', async (req, res, next) => {
  try {
    const { question, answer } = req.body || {};
    if (!question || !answer) {
      return res.status(400).json({ message: 'question and answer are required' });
    }

    const explanation = await explainAnswerAi({ question, answer });
    return res.json(explanation);
  } catch (error) {
    return next(error);
  }
});

quizRouter.get('/adaptive', (req, res) => {
  const userId = req.query.userId || 'demo-user';
  res.json(buildAdaptiveQuiz(String(userId)));
});

quizRouter.get('/coach', async (req, res, next) => {
  try {
    const userId = req.query.userId || 'demo-user';
    const plan = await buildCoachPlan(String(userId));
    res.json(plan);
  } catch (error) {
    next(error);
  }
});

quizRouter.get('/daily-challenges', (_req, res) => {
  res.json({ challenges: db.challenges });
});

quizRouter.post('/bookmark', (req, res) => {
  const { userId = 'demo-user', question } = req.body || {};
  if (!question) {
    return res.status(400).json({ message: 'question is required' });
  }

  const user = getUser(userId);
  user.bookmarks.unshift({
    id: `${Date.now()}`,
    question,
    createdAt: new Date().toISOString(),
  });

  user.bookmarks = user.bookmarks.slice(0, 100);
  return res.json({ bookmarks: user.bookmarks });
});

quizRouter.get('/bookmarks', (req, res) => {
  const userId = req.query.userId || 'demo-user';
  const user = getUser(String(userId));
  res.json({ bookmarks: user.bookmarks });
});

quizRouter.get('/flashcards', (req, res) => {
  const userId = req.query.userId || 'demo-user';
  const user = getUser(String(userId));
  res.json({ flashcards: user.flashcards });
});
