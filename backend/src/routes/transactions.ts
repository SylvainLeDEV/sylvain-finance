import { Router } from 'express';
import { z } from 'zod';

const transactionSchema = z.object({
  date: z.string().datetime({ offset: true }),
  amount: z.number(),
  label: z.string().min(1),
  category: z.string().min(1),
  accountId: z.string().min(1)
});

export const transactionsRouter = Router();

transactionsRouter.get('/', async (_req, res) => {
  res.json({ data: [], message: 'List transactions (placeholder)' });
});

transactionsRouter.post('/', async (req, res, next) => {
  try {
    const payload = transactionSchema.parse(req.body);
    res.status(201).json({ data: payload, message: 'Create transaction (placeholder)' });
  } catch (error) {
    next(error);
  }
});
