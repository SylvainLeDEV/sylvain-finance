import { pool } from '../config/database.js';
import { logger } from './logger.js';

const MIGRATIONS = [
  {
    id: '20240605_add_login_url_to_accounts',
    sql: 'ALTER TABLE accounts ADD COLUMN IF NOT EXISTS login_url TEXT'
  }
];

export async function runSchemaMigrations() {
  for (const migration of MIGRATIONS) {
    try {
      logger.debug({ migration: migration.id }, 'Applying schema migration');
      await pool.query(migration.sql);
    } catch (error) {
      logger.error({ err: error, migration: migration.id }, 'Schema migration failed');
      throw error;
    }
  }
}
