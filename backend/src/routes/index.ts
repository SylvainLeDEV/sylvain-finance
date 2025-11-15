import { Router } from 'express';

import { accountsRouter } from './accounts.js';
import { goalsRouter } from './goals.js';
import { healthRouter } from './status.js';
import { transactionsRouter } from './transactions.js';
import { valuesRouter } from './values.js';

export const router = Router();

router.use('/status', healthRouter);
router.use('/accounts', accountsRouter);
router.use('/values', valuesRouter);
router.use('/transactions', transactionsRouter);
router.use('/goals', goalsRouter);
