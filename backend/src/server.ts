import './config/env';
import app from './app';
import { env } from './config/env';
import { runMigrations } from './db/migrations';
import { closePool } from './db/database';

async function main(): Promise<void> {
  await runMigrations();

  const server = app.listen(env.PORT, () => {
    console.log(`[Server] AgentForge backend running on http://localhost:${env.PORT}`);
    console.log(`[Server] Environment: ${env.NODE_ENV}`);
  });

  const shutdown = async (): Promise<void> => {
    console.log('[Server] Shutting down...');
    server.close(async () => {
      await closePool();
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('[Server] Fatal startup error:', err);
  process.exit(1);
});
