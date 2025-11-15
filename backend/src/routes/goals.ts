import { Router } from 'express';
import { z } from 'zod';

const goalSchema = z.object({
  type: z.string().min(1),
  targetAmount: z.number().nonnegative(),
  currentAmount: z.number().nonnegative().optional()
});

export const goalsRouter = Router();

goalsRouter.get('/', async (_req, res) => {
  res.json({ data: [], message: 'List goals (placeholder)' });
});

goalsRouter.post('/', async (req, res, next) => {
  try {
    const payload = goalSchema.parse(req.body);
    res.status(201).json({ data: payload, message: 'Create goal (placeholder)' });
  } catch (error) {
    next(error);
  }
});
