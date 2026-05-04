import { getPool } from './database';
import { Pool } from 'mysql2/promise';

async function addColumnIfNotExists(
  pool: Pool,
  table: string,
  column: string,
  definition: string
): Promise<void> {
  try {
    await pool.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  } catch (err: unknown) {
    // 1060 = Duplicate column name — column already exists, safe to ignore
    if ((err as { errno?: number }).errno !== 1060) throw err;
  }
}

export async function runMigrations(): Promise<void> {
  const pool = getPool();

  // ── Sessions ────────────────────────────────────────────────────────────────
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS sessions (
      id VARCHAR(36) PRIMARY KEY,
      goal TEXT NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      final_report LONGTEXT,
      total_tokens_used INT DEFAULT 0,
      estimated_cost_usd DECIMAL(10,6) DEFAULT 0.0,
      heartbeat_interval_minutes INT DEFAULT 15,
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Idempotent column additions for pre-existing sessions tables
  await addColumnIfNotExists(pool, 'sessions', 'total_tokens_used', 'INT DEFAULT 0');
  await addColumnIfNotExists(pool, 'sessions', 'estimated_cost_usd', 'DECIMAL(10,6) DEFAULT 0.0');
  await addColumnIfNotExists(pool, 'sessions', 'heartbeat_interval_minutes', 'INT DEFAULT 15');

  // ── Tasks ───────────────────────────────────────────────────────────────────
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS tasks (
      id VARCHAR(36) PRIMARY KEY,
      session_id VARCHAR(36) NOT NULL,
      agent_type VARCHAR(100) NOT NULL,
      agent_name VARCHAR(100) NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'todo',
      output LONGTEXT,
      tokens_used INT DEFAULT 0,
      model_used VARCHAR(200),
      spawned_by_agent VARCHAR(100),
      started_at BIGINT,
      completed_at BIGINT,
      created_at BIGINT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await addColumnIfNotExists(pool, 'tasks', 'model_used', 'VARCHAR(200)');
  await addColumnIfNotExists(pool, 'tasks', 'spawned_by_agent', 'VARCHAR(100)');

  // ── Task Comments ────────────────────────────────────────────────────────────
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS task_comments (
      id VARCHAR(36) PRIMARY KEY,
      task_id VARCHAR(36) NOT NULL,
      session_id VARCHAR(36) NOT NULL,
      agent_type VARCHAR(100) NOT NULL,
      agent_name VARCHAR(100) NOT NULL,
      content LONGTEXT NOT NULL,
      comment_type VARCHAR(20) NOT NULL DEFAULT 'insight',
      tokens_used INT DEFAULT 0,
      created_at BIGINT NOT NULL,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // ── Chat Messages ────────────────────────────────────────────────────────────
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id VARCHAR(36) PRIMARY KEY,
      session_id VARCHAR(36) NOT NULL,
      agent_type VARCHAR(100) NOT NULL,
      agent_name VARCHAR(100) NOT NULL,
      content LONGTEXT NOT NULL,
      spawns_task TINYINT(1) DEFAULT 0,
      spawned_task_id VARCHAR(36),
      created_at BIGINT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // ── Custom Agents ────────────────────────────────────────────────────────────
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS custom_agents (
      id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      type VARCHAR(100) NOT NULL,
      description TEXT NOT NULL,
      system_prompt LONGTEXT NOT NULL,
      model VARCHAR(200) NOT NULL,
      color VARCHAR(20) NOT NULL,
      icon VARCHAR(50) NOT NULL,
      is_active TINYINT(1) DEFAULT 1,
      created_at BIGINT NOT NULL,
      UNIQUE KEY uk_agent_type (type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // ── Model Configs ────────────────────────────────────────────────────────────
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS model_configs (
      id VARCHAR(36) PRIMARY KEY,
      provider VARCHAR(50) NOT NULL,
      api_key_encrypted TEXT,
      is_active TINYINT(1) DEFAULT 1,
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL,
      UNIQUE KEY uk_provider (provider)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('[DB] Migrations completed');
}
