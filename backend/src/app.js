import express from 'express';
import cors from 'cors';
import { healthRouter } from './routes/health.js';
import { quizRouter } from './routes/quiz.js';
import { progressRouter } from './routes/progress.js';

export const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
    credentials: true,
  }),
);
app.use(express.json({ limit: '2mb' }));

app.use('/api/health', healthRouter);
app.use('/api/quiz', quizRouter);
app.use('/api/progress', progressRouter);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({
    message: 'Internal server error',
  });
});
