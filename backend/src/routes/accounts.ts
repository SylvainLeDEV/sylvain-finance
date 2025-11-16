import { Router } from 'express';
import { z } from 'zod';

import { pool } from '../config/database.js';

const baseAccountSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  currency: z.string().length(3)
});

const createAccountSchema = baseAccountSchema.extend({
  initialValue: z.number().nonnegative().optional(),
  initialDate: z.string().date().optional()
});

const updateAccountSchema = baseAccountSchema;

type AccountRow = {
  id: string;
  name: string;
  type: string;
  currency: string;
  value: string | null;
};

type NetWorthRow = {
  date: string;
  total_value: string | null;
};

type AllocationRow = {
  type: string;
  total_value: string | null;
};

const ACCOUNT_WITH_VALUE_QUERY = `
  SELECT
    a.id,
    a.name,
    a.type,
    a.currency,
    COALESCE(latest_values.value, 0) AS value
  FROM accounts a
  LEFT JOIN LATERAL (
    SELECT value
    FROM account_values av
    WHERE av.account_id = a.id
    ORDER BY av.date DESC, av.created_at DESC
    LIMIT 1
  ) AS latest_values ON TRUE
`;

const ALLOCATION_BY_TYPE_QUERY = `
  SELECT type, SUM(value) AS total_value
  FROM (${ACCOUNT_WITH_VALUE_QUERY}) account_summaries
  GROUP BY type
  ORDER BY type ASC
`;

function mapAccountRow(row: AccountRow) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    currency: row.currency,
    value: Number(row.value ?? 0)
  };
}

async function fetchAccountById(id: string) {
  const { rows } = await pool.query<AccountRow>(`${ACCOUNT_WITH_VALUE_QUERY} WHERE a.id = $1`, [id]);
  if (rows.length === 0) {
    return null;
  }
  return mapAccountRow(rows[0]);
}

export const accountsRouter = Router();

accountsRouter.get('/', async (_req, res, next) => {
  try {
    const { rows } = await pool.query<AccountRow>(`${ACCOUNT_WITH_VALUE_QUERY} ORDER BY a.created_at DESC`);
    res.json({ data: rows.map(mapAccountRow) });
  } catch (error) {
    next(error);
  }
});

accountsRouter.get('/insights', async (_req, res, next) => {
  try {
    const [accountsResult, historyResult, allocationResult] = await Promise.all([
      pool.query<AccountRow>(`${ACCOUNT_WITH_VALUE_QUERY} ORDER BY a.name ASC`),
      pool.query<NetWorthRow>(
        'SELECT date, SUM(value) AS total_value FROM account_values GROUP BY date ORDER BY date ASC'
      ),
      pool.query<AllocationRow>(ALLOCATION_BY_TYPE_QUERY)
    ]);

    const accounts = accountsResult.rows.map(mapAccountRow);
    const netWorthHistory = historyResult.rows.map((row) => ({
      date: row.date,
      value: Number(row.total_value ?? 0)
    }));
    const allocationByType = allocationResult.rows.map((row) => ({
      type: row.type,
      value: Number(row.total_value ?? 0)
    }));
    const totalValue = accounts.reduce((sum, account) => sum + account.value, 0);
    const lastUpdated = netWorthHistory.length > 0 ? netWorthHistory[netWorthHistory.length - 1]?.date ?? null : null;

    res.json({
      data: {
        summary: {
          totalValue,
          accountCount: accounts.length,
          lastUpdated
        },
        netWorthHistory,
        allocationByAccount: accounts,
        allocationByType
      }
    });
  } catch (error) {
    next(error);
  }
});

accountsRouter.post('/', async (req, res, next) => {
  const client = await pool.connect();
  let transactionStarted = false;
  try {
    const payload = createAccountSchema.parse(req.body);
    const normalizedCurrency = payload.currency.toUpperCase();

    await client.query('BEGIN');
    transactionStarted = true;
    const accountResult = await client.query<{ id: string }>(
      'INSERT INTO accounts (name, type, currency) VALUES ($1, $2, $3) RETURNING id',
      [payload.name, payload.type, normalizedCurrency]
    );

    const accountId = accountResult.rows[0]?.id;

    if (!accountId) {
      throw new Error('Unable to create account');
    }

    if (typeof payload.initialValue === 'number') {
      const valuationDate = payload.initialDate ?? new Date().toISOString().slice(0, 10);
      await client.query(
        'INSERT INTO account_values (account_id, date, value, net_flows) VALUES ($1, $2, $3, $4)',
        [accountId, valuationDate, payload.initialValue, 0]
      );
    }

    await client.query('COMMIT');
    transactionStarted = false;

    const account = await fetchAccountById(accountId);
    if (!account) {
      throw new Error('Created account could not be retrieved');
    }

    res.status(201).json({ data: account, message: 'Account created' });
  } catch (error) {
    if (transactionStarted) {
      await client.query('ROLLBACK');
    }
    next(error);
  } finally {
    client.release();
  }
});

accountsRouter.get('/:id', async (req, res, next) => {
  try {
    const account = await fetchAccountById(req.params.id);
    if (!account) {
      res.status(404).json({ status: 'error', message: 'Account not found' });
      return;
    }
    res.json({ data: account });
  } catch (error) {
    next(error);
  }
});

accountsRouter.put('/:id', async (req, res, next) => {
  try {
    const payload = updateAccountSchema.parse(req.body);
    const normalizedCurrency = payload.currency.toUpperCase();
    const result = await pool.query('UPDATE accounts SET name=$1, type=$2, currency=$3 WHERE id=$4', [
      payload.name,
      payload.type,
      normalizedCurrency,
      req.params.id
    ]);

    if (result.rowCount === 0) {
      res.status(404).json({ status: 'error', message: 'Account not found' });
      return;
    }

    const account = await fetchAccountById(req.params.id);
    if (!account) {
      res.status(404).json({ status: 'error', message: 'Account not found' });
      return;
    }

    res.json({ data: account, message: 'Account updated' });
  } catch (error) {
    next(error);
  }
});

accountsRouter.delete('/:id', async (req, res, next) => {
  try {
    const result = await pool.query('DELETE FROM accounts WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) {
      res.status(404).json({ status: 'error', message: 'Account not found' });
      return;
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
