import { Router } from 'express';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  res.json({
    app: 'LearnLoop API',
    status: 'ok',
    date: new Date().toISOString(),
  });
});
