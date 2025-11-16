import { Router } from 'express';
import { z } from 'zod';

import { pool } from '../config/database.js';

const valueSchema = z.object({
  accountId: z.string().uuid(),
  date: z.string().date(),
  value: z.number().nonnegative(),
  netFlows: z.number().optional().default(0)
});

const querySchema = z.object({
  accountId: z.string().uuid().optional()
});

const valueIdSchema = z.object({
  id: z.string().uuid()
});

const updateValueSchema = z
  .object({
    date: z.string().date().optional(),
    value: z.number().nonnegative().optional(),
    netFlows: z.number().optional()
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: 'Aucune donnée à mettre à jour.'
  });

type AccountValueRow = {
  id: string;
  account_id: string;
  date: string;
  value: string;
  net_flows: string;
  created_at: string;
};

export const valuesRouter = Router();

valuesRouter.get('/', async (req, res, next) => {
  try {
    const { accountId } = querySchema.parse(req.query);
    const params: Array<string> = [];
    let query = 'SELECT id, account_id, date, value, net_flows, created_at FROM account_values';
    if (accountId) {
      params.push(accountId);
      query += ' WHERE account_id = $1';
    }
    query += ' ORDER BY date DESC, created_at DESC';
    const { rows } = await pool.query<AccountValueRow>(query, params);
    res.json({
      data: rows.map((row) => ({
        id: row.id,
        accountId: row.account_id,
        date: row.date,
        value: Number(row.value),
        netFlows: Number(row.net_flows),
        createdAt: row.created_at
      }))
    });
  } catch (error) {
    next(error);
  }
});

valuesRouter.post('/', async (req, res, next) => {
  try {
    const payload = valueSchema.parse(req.body);
    const { rows } = await pool.query<AccountValueRow>(
      `
        INSERT INTO account_values (account_id, date, value, net_flows)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (account_id, date)
        DO UPDATE SET value = EXCLUDED.value, net_flows = EXCLUDED.net_flows
        RETURNING id, account_id, date, value, net_flows, created_at
      `,
      [payload.accountId, payload.date, payload.value, payload.netFlows ?? 0]
    );

    const record = rows[0];
    res.status(201).json({
      data: {
        id: record.id,
        accountId: record.account_id,
        date: record.date,
        value: Number(record.value),
        netFlows: Number(record.net_flows),
        createdAt: record.created_at
      },
      message: 'Account valuation recorded'
    });
  } catch (error) {
    next(error);
  }
});

valuesRouter.put('/:id', async (req, res, next) => {
  try {
    const { id } = valueIdSchema.parse(req.params);
    const payload = updateValueSchema.parse(req.body);

    const updates: string[] = [];
    const params: Array<string | number> = [];
    let paramIndex = 1;

    if (payload.date) {
      updates.push(`date = $${paramIndex++}`);
      params.push(payload.date);
    }

    if (typeof payload.value === 'number') {
      updates.push(`value = $${paramIndex++}`);
      params.push(payload.value);
    }

    if (typeof payload.netFlows === 'number') {
      updates.push(`net_flows = $${paramIndex++}`);
      params.push(payload.netFlows);
    }

    if (updates.length === 0) {
      res.status(400).json({ message: 'Aucune donnée à mettre à jour.' });
      return;
    }

    params.push(id);

    const { rows } = await pool.query<AccountValueRow>(
      `
        UPDATE account_values
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING id, account_id, date, value, net_flows, created_at
      `,
      params
    );

    if (rows.length === 0) {
      res.status(404).json({ message: 'Valorisation introuvable.' });
      return;
    }

    const record = rows[0];

    res.json({
      data: {
        id: record.id,
        accountId: record.account_id,
        date: record.date,
        value: Number(record.value),
        netFlows: Number(record.net_flows),
        createdAt: record.created_at
      },
      message: 'Valorisation mise à jour'
    });
  } catch (error) {
    next(error);
  }
});

valuesRouter.delete('/:id', async (req, res, next) => {
  try {
    const { id } = valueIdSchema.parse(req.params);
    const { rowCount } = await pool.query('DELETE FROM account_values WHERE id = $1', [id]);

    if (rowCount === 0) {
      res.status(404).json({ message: 'Valorisation introuvable.' });
      return;
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
