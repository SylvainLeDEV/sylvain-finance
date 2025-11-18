import { Router } from 'express';
import type { PoolClient, QueryResultRow } from 'pg';
import { z } from 'zod';

import { pool } from '../config/database.js';

const DEFAULT_NET_INCOME = 3500;

const DEFAULT_ENVELOPES = [
  { category: 'Logement', amount: 1100, note: 'Loyer + assurance' },
  { category: 'Charges fixes', amount: 480, note: 'Énergie, abonnements' },
  { category: 'Alimentation', amount: 450, note: 'Courses + restaurants' },
  { category: 'Mobilité', amount: 160, note: 'Transport + carburant' },
  { category: 'Vie perso / loisirs', amount: 220, note: 'Sport, sorties' },
  { category: 'Santé / bien-être', amount: 120, note: 'Mutuelle, pharmacie' }
];

const DEFAULT_INVESTMENTS = [
  {
    product: 'PEA - ETF Monde',
    target: 40000,
    monthly: 350,
    allocationPercent: 50,
    comment: 'Horizon 10 ans',
    accountId: null
  },
  {
    product: 'Assurance-vie profil équilibré',
    target: 15000,
    monthly: 200,
    allocationPercent: 35,
    comment: 'Objectif vacances / projets',
    accountId: null
  },
  {
    product: 'Allocation crypto',
    target: 5000,
    monthly: 80,
    allocationPercent: 15,
    comment: 'Ticket spéculatif < 5 %',
    accountId: null
  }
];

type BudgetRow = QueryResultRow & {
  id: string;
  net_income: string | null;
  updated_at: string | null;
};

type EnvelopeRow = QueryResultRow & {
  id: string;
  category: string;
  amount: string | null;
  note: string | null;
};

type InvestmentRow = QueryResultRow & {
  id: string;
  product: string;
  target: string | null;
  monthly: string | null;
  allocation_percent: string | null;
  account_id: string | null;
  comment: string | null;
};

const envelopeSchema = z.object({
  id: z.string().optional(),
  category: z.string().min(1),
  amount: z.number().nonnegative(),
  note: z.string().optional().default('')
});

const investmentSchema = z.object({
  id: z.string().optional(),
  product: z.string().min(1),
  target: z.number().nonnegative(),
  monthly: z.number().nonnegative(),
  allocationPercent: z.number().min(0).max(100).default(0),
  accountId: z.string().uuid().optional().nullable(),
  comment: z.string().optional().default('')
});

const budgetUpdateSchema = z.object({
  netIncome: z.number().nonnegative(),
  envelopes: z.array(envelopeSchema),
  investmentTargets: z.array(investmentSchema)
});

const budgetSchemaReady = ensureBudgetSchema();

async function ensureBudgetSchema() {
  await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS budgets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      net_income NUMERIC(18, 2) NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS budget_envelopes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      budget_id UUID NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
      category TEXT NOT NULL,
      amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
      note TEXT DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS budget_investment_targets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      budget_id UUID NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
      product TEXT NOT NULL,
      target NUMERIC(18, 2) NOT NULL DEFAULT 0,
      monthly NUMERIC(18, 2) NOT NULL DEFAULT 0,
      allocation_percent NUMERIC(5, 2) NOT NULL DEFAULT 0,
      account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
      comment TEXT DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    ALTER TABLE budget_investment_targets
    ADD COLUMN IF NOT EXISTS allocation_percent NUMERIC(5, 2) NOT NULL DEFAULT 0
  `);
  await pool.query(`
    ALTER TABLE budget_investment_targets
    ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE SET NULL
  `);
  await pool.query(`
    CREATE OR REPLACE FUNCTION set_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
  `);
  await pool.query('DROP TRIGGER IF EXISTS budgets_updated_at ON budgets');
  await pool.query(`
    CREATE TRIGGER budgets_updated_at
    BEFORE UPDATE ON budgets
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at()
  `);
}

function mapEnvelope(row: EnvelopeRow) {
  return {
    id: row.id,
    category: row.category,
    amount: Number(row.amount ?? 0),
    note: row.note ?? ''
  };
}

function mapInvestment(row: InvestmentRow) {
  return {
    id: row.id,
    product: row.product,
    target: Number(row.target ?? 0),
    monthly: Number(row.monthly ?? 0),
    allocationPercent: Number(row.allocation_percent ?? 0),
    accountId: row.account_id ?? null,
    comment: row.comment ?? ''
  };
}

async function fetchBudgetRow(client?: PoolClient): Promise<BudgetRow | null> {
  const runner = client ?? pool;
  const { rows } = await runner.query<BudgetRow>(
    'SELECT id, net_income, updated_at FROM budgets ORDER BY created_at ASC LIMIT 1'
  );
  return rows[0] ?? null;
}

async function seedBudgetWithClient(client: PoolClient): Promise<BudgetRow> {
  const budgetResult = await client.query<BudgetRow>(
    'INSERT INTO budgets (net_income) VALUES ($1) RETURNING id, net_income, updated_at',
    [DEFAULT_NET_INCOME]
  );
  const budget = budgetResult.rows[0];
  if (!budget) {
    throw new Error('Unable to create budget');
  }

  for (const envelope of DEFAULT_ENVELOPES) {
    await client.query(
      'INSERT INTO budget_envelopes (budget_id, category, amount, note) VALUES ($1, $2, $3, $4)',
      [budget.id, envelope.category, envelope.amount, envelope.note]
    );
  }

  for (const investment of DEFAULT_INVESTMENTS) {
    await client.query(
      `INSERT INTO budget_investment_targets (budget_id, product, target, monthly, allocation_percent, comment)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        budget.id,
        investment.product,
        investment.target,
        investment.monthly,
        investment.allocationPercent,
        investment.comment
      ]
    );
  }

  return budget;
}

async function ensureBudget(client?: PoolClient): Promise<BudgetRow> {
  const existing = await fetchBudgetRow(client);
  if (existing) {
    return existing;
  }

  if (client) {
    return seedBudgetWithClient(client);
  }

  const dedicatedClient = await pool.connect();
  try {
    await dedicatedClient.query('BEGIN');
    const budget = await seedBudgetWithClient(dedicatedClient);
    await dedicatedClient.query('COMMIT');
    return budget;
  } catch (error) {
    await dedicatedClient.query('ROLLBACK');
    throw error;
  } finally {
    dedicatedClient.release();
  }
}

async function fetchBudgetDetails(budgetId: string) {
  const [envelopesResult, investmentsResult] = await Promise.all([
    pool.query<EnvelopeRow>(
      'SELECT id, category, amount, note FROM budget_envelopes WHERE budget_id = $1 ORDER BY created_at ASC',
      [budgetId]
    ),
    pool.query<InvestmentRow>(
      `SELECT id, product, target, monthly, allocation_percent, account_id, comment
       FROM budget_investment_targets
       WHERE budget_id = $1
       ORDER BY created_at ASC`,
      [budgetId]
    )
  ]);

  return {
    envelopes: envelopesResult.rows.map(mapEnvelope),
    investmentTargets: investmentsResult.rows.map(mapInvestment)
  };
}

export const budgetRouter = Router();

budgetRouter.get('/', async (_req, res, next) => {
  try {
    await budgetSchemaReady;
    const budget = await ensureBudget();
    const details = await fetchBudgetDetails(budget.id);
    res.json({
      data: {
        netIncome: Number(budget.net_income ?? 0),
        updatedAt: budget.updated_at,
        ...details
      }
    });
  } catch (error) {
    next(error);
  }
});

budgetRouter.put('/', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await budgetSchemaReady;
    const payload = budgetUpdateSchema.parse(req.body);
    await client.query('BEGIN');
    const budget = await ensureBudget(client);
    await client.query('UPDATE budgets SET net_income = $1 WHERE id = $2', [
      payload.netIncome,
      budget.id
    ]);
    await client.query('DELETE FROM budget_envelopes WHERE budget_id = $1', [budget.id]);
    await client.query('DELETE FROM budget_investment_targets WHERE budget_id = $1', [budget.id]);

    const envelopeRows: EnvelopeRow[] = [];
    for (const envelope of payload.envelopes) {
      const result = await client.query<EnvelopeRow>(
        `INSERT INTO budget_envelopes (budget_id, category, amount, note)
         VALUES ($1, $2, $3, $4)
         RETURNING id, category, amount, note`,
        [budget.id, envelope.category, envelope.amount, envelope.note ?? '']
      );
      if (result.rows[0]) {
        envelopeRows.push(result.rows[0]);
      }
    }

    const investmentRows: InvestmentRow[] = [];
    for (const investment of payload.investmentTargets) {
      const result = await client.query<InvestmentRow>(
        `INSERT INTO budget_investment_targets (budget_id, product, target, monthly, allocation_percent, account_id, comment)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, product, target, monthly, allocation_percent, account_id, comment`,
        [
          budget.id,
          investment.product,
          investment.target,
          investment.monthly,
          investment.allocationPercent,
          investment.accountId ?? null,
          investment.comment ?? ''
        ]
      );
      if (result.rows[0]) {
        investmentRows.push(result.rows[0]);
      }
    }

    await client.query('COMMIT');

    const refreshedBudget = await fetchBudgetRow();
    res.json({
      data: {
        netIncome: payload.netIncome,
        updatedAt: refreshedBudget?.updated_at ?? budget.updated_at,
        envelopes: envelopeRows.map(mapEnvelope),
        investmentTargets: investmentRows.map(mapInvestment)
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});
