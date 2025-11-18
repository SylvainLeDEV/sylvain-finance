import { createServer } from 'http';

import { app } from './app.js';
import { env } from './config/env.js';
import { runSchemaMigrations } from './utils/schema-migrations.js';
import { logger } from './utils/logger.js';

const server = createServer(app);

async function startServer() {
  try {
    await runSchemaMigrations();
    server.listen(env.PORT, () => {
      logger.info({ port: env.PORT }, 'Backend API listening');
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to start server');
    process.exit(1);
  }
}

startServer();
