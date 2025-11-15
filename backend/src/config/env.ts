import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z
    .string()
    .url()
    .default('postgres://postgres:postgres@db:5432/sy_finance'),
  CORS_ORIGIN: z.string().default('*')
});

export const env = envSchema.parse(process.env);
