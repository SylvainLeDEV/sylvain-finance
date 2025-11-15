import { Router } from 'express';
import { z } from 'zod';

const accountSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  currency: z.string().length(3)
});

export const accountsRouter = Router();

accountsRouter.get('/', async (_req, res) => {
  res.json({ data: [], message: 'List accounts (placeholder)' });
});

accountsRouter.post('/', async (req, res, next) => {
  try {
    const payload = accountSchema.parse(req.body);
    res.status(201).json({ data: payload, message: 'Create account (placeholder)' });
  } catch (error) {
    next(error);
  }
});

accountsRouter.get('/:id', async (req, res) => {
  res.json({ data: { id: req.params.id }, message: 'Get account (placeholder)' });
});

accountsRouter.put('/:id', async (req, res, next) => {
  try {
    const payload = accountSchema.parse(req.body);
    res.json({ data: { id: req.params.id, ...payload }, message: 'Update account (placeholder)' });
  } catch (error) {
    next(error);
  }
});

accountsRouter.delete('/:id', async (req, res) => {
  res.status(204).send();
});
