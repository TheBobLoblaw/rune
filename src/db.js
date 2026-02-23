import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';

const BASE_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS facts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  source TEXT,
  confidence REAL DEFAULT 1.0,
  created TEXT NOT NULL,
  updated TEXT NOT NULL,
  scope TEXT DEFAULT 'global',
  tier TEXT DEFAULT 'long-term',
  expires_at TEXT,
  last_verified TEXT,
  source_type TEXT DEFAULT 'manual',
  UNIQUE(category, key)
);

CREATE INDEX IF NOT EXISTS idx_facts_category ON facts(category);
CREATE INDEX IF NOT EXISTS idx_facts_key ON facts(key);
CREATE INDEX IF NOT EXISTS idx_facts_updated ON facts(updated);

CREATE TABLE IF NOT EXISTS relations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_fact_id INTEGER NOT NULL,
  target_fact_id INTEGER NOT NULL,
  relation_type TEXT NOT NULL,
  created TEXT NOT NULL,
  FOREIGN KEY (source_fact_id) REFERENCES facts(id) ON DELETE CASCADE,
  FOREIGN KEY (target_fact_id) REFERENCES facts(id) ON DELETE CASCADE,
  UNIQUE(source_fact_id, target_fact_id, relation_type)
);

CREATE INDEX IF NOT EXISTS idx_relations_source ON relations(source_fact_id);
CREATE INDEX IF NOT EXISTS idx_relations_target ON relations(target_fact_id);
`;

const FACT_COLUMN_MIGRATIONS = [
  { name: 'scope', sql: "ALTER TABLE facts ADD COLUMN scope TEXT DEFAULT 'global'" },
  { name: 'tier', sql: "ALTER TABLE facts ADD COLUMN tier TEXT DEFAULT 'long-term'" },
  { name: 'expires_at', sql: 'ALTER TABLE facts ADD COLUMN expires_at TEXT' },
  { name: 'last_verified', sql: 'ALTER TABLE facts ADD COLUMN last_verified TEXT' },
  { name: 'source_type', sql: "ALTER TABLE facts ADD COLUMN source_type TEXT DEFAULT 'manual'" }
];

const FTS_SQL = `
CREATE VIRTUAL TABLE IF NOT EXISTS facts_fts USING fts5(key, value, content='facts', content_rowid='id');

CREATE TRIGGER IF NOT EXISTS facts_ai AFTER INSERT ON facts BEGIN
  INSERT INTO facts_fts(rowid, key, value) VALUES (new.id, new.key, new.value);
END;

CREATE TRIGGER IF NOT EXISTS facts_ad AFTER DELETE ON facts BEGIN
  INSERT INTO facts_fts(facts_fts, rowid, key, value) VALUES ('delete', old.id, old.key, old.value);
END;

CREATE TRIGGER IF NOT EXISTS facts_au AFTER UPDATE ON facts BEGIN
  INSERT INTO facts_fts(facts_fts, rowid, key, value) VALUES ('delete', old.id, old.key, old.value);
  INSERT INTO facts_fts(rowid, key, value) VALUES (new.id, new.key, new.value);
END;
`;

const FACT_POST_MIGRATION_INDEXES_SQL = `
CREATE INDEX IF NOT EXISTS idx_facts_scope ON facts(scope);
CREATE INDEX IF NOT EXISTS idx_facts_tier ON facts(tier);
CREATE INDEX IF NOT EXISTS idx_facts_expires_at ON facts(expires_at);
`;

export const DB_PATH = path.join(os.homedir(), '.openclaw', 'memory.db');

export function ensureDbPath(dbPath = DB_PATH) {
  const dir = path.dirname(dbPath);
  fs.mkdirSync(dir, { recursive: true });
}

function tableExists(db, tableName) {
  const row = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(tableName);
  return Boolean(row);
}

function migrateFactColumns(db) {
  const columns = new Set(db.prepare('PRAGMA table_info(facts)').all().map((row) => row.name));
  let changed = false;

  for (const migration of FACT_COLUMN_MIGRATIONS) {
    if (!columns.has(migration.name)) {
      db.exec(migration.sql);
      changed = true;
    }
  }

  return changed;
}

function backfillFacts(db) {
  db.exec("UPDATE facts SET scope = 'global' WHERE scope IS NULL OR trim(scope) = ''");
  db.exec("UPDATE facts SET tier = 'long-term' WHERE tier IS NULL OR trim(tier) = ''");
  db.exec("UPDATE facts SET source_type = 'manual' WHERE source_type IS NULL OR trim(source_type) = ''");
}

function rebuildFtsIndex(db) {
  db.prepare("INSERT INTO facts_fts(facts_fts) VALUES ('rebuild')").run();
}

export function openDb(dbPath = DB_PATH) {
  ensureDbPath(dbPath);
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(BASE_SCHEMA_SQL);
  const hadFtsTable = tableExists(db, 'facts_fts');
  const migratedColumns = migrateFactColumns(db);
  db.exec(FACT_POST_MIGRATION_INDEXES_SQL);
  backfillFacts(db);

  db.exec(FTS_SQL);
  if (!hadFtsTable || migratedColumns) {
    rebuildFtsIndex(db);
  }

  return db;
}

export function nowIso() {
  return new Date().toISOString();
}
