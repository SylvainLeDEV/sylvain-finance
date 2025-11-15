import { Router } from 'express';
import { z } from 'zod';

const valueSchema = z.object({
  accountId: z.string().min(1),
  date: z.string().datetime({ offset: true }),
  value: z.number().nonnegative(),
  netFlows: z.number().default(0)
});

export const valuesRouter = Router();

valuesRouter.get('/', async (_req, res) => {
  res.json({ data: [], message: 'List account values (placeholder)' });
});

valuesRouter.post('/', async (req, res, next) => {
  try {
    const payload = valueSchema.parse(req.body);
    res.status(201).json({ data: payload, message: 'Record account value (placeholder)' });
  } catch (error) {
    next(error);
  }
});
