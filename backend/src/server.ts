import { createServer } from 'http';

import { app } from './app.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';

const server = createServer(app);

server.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, 'Backend API listening');
});
