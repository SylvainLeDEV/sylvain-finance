import pg from 'pg';

import { env } from './env.js';

const { Pool } = pg;

export const pool = new Pool({ connectionString: env.DATABASE_URL });

export async function healthCheck(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch (error) {
    return false;
  }
}
