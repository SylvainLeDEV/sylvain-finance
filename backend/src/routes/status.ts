import { Router } from 'express';

import { healthCheck } from '../config/database.js';

export const healthRouter = Router();

healthRouter.get('/', async (_req, res) => {
  const dbHealthy = await healthCheck();
  res.json({ status: 'ok', services: { database: dbHealthy ? 'up' : 'down' } });
});
