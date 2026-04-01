import { Router } from 'express';
import { db, getUser } from '../data/store.js';

export const progressRouter = Router();

progressRouter.get('/dashboard', (req, res) => {
  const userId = String(req.query.userId || 'demo-user');
  const user = getUser(userId);
  const topics = Object.values(user.topics);

  const leaderboard = [...db.users.values()]
    .map((item) => ({
      id: item.id,
      name: item.name,
      xp: item.xp,
      streak: item.streak,
    }))
    .sort((a, b) => b.xp - a.xp)
    .slice(0, 10);

  res.json({
    profile: {
      id: user.id,
      name: user.name,
      xp: user.xp,
      streak: user.streak,
      badges: user.badges,
    },
    topicStats: topics,
    history: user.quizHistory,
    leaderboard,
  });
});

progressRouter.get('/topic/:topicName', (req, res) => {
  const userId = String(req.query.userId || 'demo-user');
  const topicName = req.params.topicName;
  const user = getUser(userId);

  const topic = user.topics[topicName];
  if (!topic) {
    return res.status(404).json({ message: 'Topic not found yet' });
  }

  return res.json(topic);
});
