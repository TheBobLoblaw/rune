import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS facts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  source TEXT,
  confidence REAL DEFAULT 1.0,
  created TEXT NOT NULL,
  updated TEXT NOT NULL,
  UNIQUE(category, key)
);

CREATE INDEX IF NOT EXISTS idx_facts_category ON facts(category);
CREATE INDEX IF NOT EXISTS idx_facts_key ON facts(key);
CREATE INDEX IF NOT EXISTS idx_facts_updated ON facts(updated);
`;

export const DB_PATH = path.join(os.homedir(), '.openclaw', 'memory.db');

export function ensureDbPath() {
  const dir = path.dirname(DB_PATH);
  fs.mkdirSync(dir, { recursive: true });
}

export function openDb() {
  ensureDbPath();
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.exec(SCHEMA_SQL);
  return db;
}

export function nowIso() {
  return new Date().toISOString();
}
