import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { execFileSync, spawn } from 'node:child_process';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const cliPath = path.join(repoRoot, 'bin', 'cli.js');
const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'brokkr-mem-test-'));
const envBase = {
  ...process.env,
  HOME: tmpHome
};

const dbDir = path.join(tmpHome, '.openclaw');
const dbPath = path.join(dbDir, 'memory.db');

function run(args, { env = {}, allowFail = false } = {}) {
  process.stderr.write(`RUN brokkr-mem ${args.join(' ')}\n`);
  try {
    const output = execFileSync('node', [cliPath, ...args], {
      cwd: repoRoot,
      env: { ...envBase, ...env },
      encoding: 'utf8'
    });
    return output;
  } catch (err) {
    if (!allowFail) {
      throw new Error(`Command failed: brokkr-mem ${args.join(' ')}\n${err.stdout || ''}${err.stderr || ''}`);
    }
    return (err.stdout || '') + (err.stderr || '');
  }
}

function assertContains(text, needle, label) {
  if (!text.includes(needle)) {
    throw new Error(`Assertion failed (${label}): expected output to contain "${needle}"\nGot:\n${text}`);
  }
}

function assert(condition, label) {
  if (!condition) {
    throw new Error(`Assertion failed: ${label}`);
  }
}

function seedLegacyDb() {
  fs.mkdirSync(dbDir, { recursive: true });
  const db = new Database(dbPath);
  db.exec(`
    CREATE TABLE facts (
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
  `);

  db.prepare(`
    INSERT INTO facts (category, key, value, source, confidence, created, updated)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('project', 'legacy.item', 'legacy value', 'legacy-seed', 0.9, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z');
  db.close();
}

function startFakeOllamaProcess() {
  const script = `
    const http = require('http');
    const server = http.createServer((req, res) => {
      if (req.method === 'POST' && req.url === '/api/generate') {
        let body = '';
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', () => {
          const parsed = JSON.parse(body);
          if (!parsed.prompt) {
            res.writeHead(400, { 'Content-Type': 'text/plain' });
            res.end('missing prompt');
            return;
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            response: JSON.stringify([
              {
                category: 'task',
                key: 'current.build',
                value: 'Rune schema upgrade',
                scope: 'global',
                tier: 'working',
                source_type: 'inferred',
                ttl: '24h'
              },
              {
                category: 'project',
                key: 'cad-wiki.editor',
                value: 'Using TipTap WYSIWYG',
                scope: 'project',
                tier: 'long-term',
                source_type: 'user_said',
                ttl: null
              }
            ])
          }));
        });
        return;
      }

      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('not found');
    });

    server.listen(0, '127.0.0.1', () => {
      process.stdout.write(String(server.address().port) + '\\n');
    });
  `;

  return new Promise((resolve, reject) => {
    const child = spawn('node', ['-e', script], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let out = '';
    let settled = false;

    child.stdout.on('data', (chunk) => {
      if (settled) {
        return;
      }
      out += chunk.toString();
      const line = out.trim();
      if (!line) {
        return;
      }
      const port = Number.parseInt(line, 10);
      if (Number.isInteger(port) && port > 0) {
        settled = true;
        resolve({ child, port });
      }
    });

    child.once('error', (err) => {
      if (!settled) {
        settled = true;
        reject(err);
      }
    });

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString().trim();
      if (!text || settled) {
        return;
      }
      settled = true;
      reject(new Error(text));
    });

    child.once('exit', (code) => {
      if (!settled && code !== 0) {
        settled = true;
        reject(new Error(`Fake Ollama server exited with code ${code}`));
      }
    });
  });
}

function checkMigratedSchema() {
  const db = new Database(dbPath, { readonly: true });

  const columns = db.prepare('PRAGMA table_info(facts)').all().map((row) => row.name);
  for (const required of ['scope', 'tier', 'expires_at', 'last_verified', 'source_type']) {
    assert(columns.includes(required), `facts table has column ${required}`);
  }

  const backfilled = db.prepare(`
    SELECT scope, tier, source_type
    FROM facts
    WHERE category = 'project' AND key = 'legacy.item'
  `).get();

  assert(backfilled.scope === 'global', 'legacy scope backfilled to global');
  assert(backfilled.tier === 'long-term', 'legacy tier backfilled to long-term');
  assert(backfilled.source_type === 'manual', 'legacy source_type backfilled to manual');

  const relationTable = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'relations'").get();
  assert(Boolean(relationTable), 'relations table exists');

  const ftsTable = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'facts_fts'").get();
  assert(Boolean(ftsTable), 'facts_fts table exists');

  const ftsRow = db.prepare(`
    SELECT f.id
    FROM facts_fts fts
    JOIN facts f ON f.id = fts.rowid
    WHERE f.key = 'legacy.item'
  `).get();
  assert(Boolean(ftsRow), 'legacy facts were indexed into fts');

  db.close();
}

async function main() {
  const importFile = path.join(repoRoot, 'tmp-import.json');
  const extractFile = path.join(repoRoot, 'tmp-extract.md');
  const injectOut = path.join(repoRoot, 'tmp-inject.md');

  seedLegacyDb();

  fs.writeFileSync(importFile, JSON.stringify([
    {
      category: 'person',
      key: 'cory.name',
      value: 'Cory',
      source: 'import',
      confidence: 0.9,
      scope: 'global',
      tier: 'long-term',
      source_type: 'manual'
    }
  ], null, 2));
  fs.writeFileSync(extractFile, '# Session\nUpgrading brokkr-mem schema.');

  try {
    run(['stats']);
    checkMigratedSchema();

    run([
      'add', 'task', 'upgrade.status', 'In progress',
      '--scope', 'global',
      '--tier', 'working',
      '--ttl', '4h',
      '--source-type', 'manual',
      '--project', 'brokkr-mem'
    ]);

    const getOne = run(['get', 'task', 'upgrade.status']);
    assertContains(getOne, 'scope=project', 'project shortcut forces project scope');
    assertContains(getOne, '[project:brokkr-mem]', 'project tag added to source');

    run(['add', 'project', 'schema.version', '1.5', '--source', 'manual']);
    run(['add', 'decision', 'storage.engine', 'sqlite']);

    const search = run(['search', 'schema']);
    assertContains(search, 'schema.version', 'fts search finds fact');

    run(['link', 'task/upgrade.status', 'project/schema.version', '--type', 'related_to']);
    const graph = run(['graph', 'task/upgrade.status']);
    assertContains(graph, 'project/schema.version', 'graph shows related fact');
    assertContains(graph, 'related_to', 'graph shows relation type');

    const working = run(['working']);
    assertContains(working, 'upgrade.status', 'working command lists task');
    assertContains(working, 'expires in', 'working command shows ttl');

    const injectStdout = run(['inject', '--max', '20', '--project', 'brokkr-mem', '--include-working']);
    assertContains(injectStdout, '# Rune - Known Facts', 'inject header');
    assertContains(injectStdout, '## Working Memory', 'inject working section');

    run(['inject', '--max', '20', '--output', injectOut]);
    const injectFileContent = fs.readFileSync(injectOut, 'utf8');
    assertContains(injectFileContent, '# Rune - Known Facts', 'inject file output');

    run(['import', importFile]);
    const imported = run(['get', 'person', 'cory.name']);
    assertContains(imported, 'Cory', 'import fact exists');

    const { child, port } = await startFakeOllamaProcess();
    try {
      const extractDry = run(['extract', extractFile, '--dry-run'], { env: { OLLAMA_URL: `http://127.0.0.1:${port}` } });
      assertContains(extractDry, 'scope=global', 'extract dry run includes scope');
      assertContains(extractDry, 'ttl=24h', 'extract dry run includes ttl');

      const extractWrite = run(['extract', extractFile], { env: { OLLAMA_URL: `http://127.0.0.1:${port}` } });
      assertContains(extractWrite, 'Stored', 'extract stores facts');
    } finally {
      child.kill('SIGTERM');
    }

    const extracted = run(['get', 'task', 'current.build']);
    assertContains(extracted, 'tier=working', 'extracted tier persisted');

    {
      const db = new Database(dbPath);
      db.prepare("UPDATE facts SET expires_at = ? WHERE category = 'task' AND key = 'upgrade.status'").run('2000-01-01T00:00:00.000Z');
      db.close();
    }

    const expired = run(['expire']);
    assertContains(expired, 'Expired', 'expire command runs');

    const missingAfterExpire = run(['get', 'task', 'upgrade.status'], { allowFail: true });
    assertContains(missingAfterExpire, 'No matching facts found', 'expired fact removed');

    const exportedMd = run(['export', '--format', 'md']);
    assertContains(exportedMd, '## Projects', 'export markdown');

    const pruneByConfidence = run(['prune', '--confidence-below', '0.5']);
    assertContains(pruneByConfidence, 'Pruned', 'prune confidence');

    console.log('All commands tested successfully.');
  } finally {
    for (const p of [importFile, extractFile, injectOut]) {
      if (fs.existsSync(p)) {
        fs.unlinkSync(p);
      }
    }
    fs.rmSync(tmpHome, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err.message || String(err));
  process.exit(1);
});
