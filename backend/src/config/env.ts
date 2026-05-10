import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  OPENROUTER_API_KEY: z.string().min(1, 'OPENROUTER_API_KEY is required'),
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().default(3306),
  DB_USER: z.string().default('root'),
  DB_PASSWORD: z.string().default(''),
  DB_NAME: z.string().default('agentforge'),
  OPENROUTER_BASE_URL: z.string().url().default('https://openrouter.ai/api/v1'),
  OPENROUTER_MAX_RETRIES: z.coerce.number().default(3),
  OPENROUTER_TIMEOUT_MS: z.coerce.number().default(60000),
  MANAGER_MODEL: z.string().default('meta-llama/llama-3.3-70b-instruct:free'),
  DEFAULT_HEARTBEAT_INTERVAL_MINUTES: z.coerce.number().default(15),
  MAX_AUTO_SPAWNED_TASKS: z.coerce.number().default(10),
  SERPER_API_KEY: z.string().optional(),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  const errors = result.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(`Environment validation failed:\n${errors}`);
}

export const env = result.data;
