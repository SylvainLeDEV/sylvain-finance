import pino from 'pino';

import { env } from '../config/env.js';

export const logger = pino({
  name: 'sy-finance-backend',
  level: env.NODE_ENV === 'production' ? 'info' : 'debug'
});
