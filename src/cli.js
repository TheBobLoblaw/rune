import fs from 'node:fs';
import path from 'node:path';
import { Command } from 'commander';
import { DB_PATH, openDb, nowIso } from './db.js';
import { colors } from './colors.js';
import { factsToMarkdown } from './format.js';
import { extractFactsFromFile, wasAlreadyExtracted, logExtraction } from './extract.js';
import { runTestSuites } from './test-runner.js';
import { UserError } from './errors.js';

const DEFAULT_LIMIT = 100;
const VALID_SCOPES = new Set(['global', 'project', 'conversation']);
const VALID_TIERS = new Set(['working', 'long-term']);
const VALID_SOURCE_TYPES = new Set(['manual', 'inferred', 'user_said', 'tool_output']);
const VALID_RELATION_TYPES = new Set(['related_to', 'part_of', 'decided_by', 'owned_by', 'replaced_by']);

function parseConfidence(value) {
  const n = Number(value);
  if (Number.isNaN(n) || n < 0 || n > 1) {
    throw new UserError('Confidence must be a number between 0 and 1');
  }
  return n;
}

function parseLimit(value) {
  const n = Number.parseInt(value, 10);
  if (!Number.isInteger(n) || n <= 0) {
    throw new UserError('Limit must be a positive integer');
  }
  return n;
}

function parseDate(value) {
  const d = new Date(value);
  if (Number.isNaN(d.valueOf())) {
    throw new UserError('Invalid date. Use ISO format like 2025-01-01T00:00:00Z');
  }
  return d.toISOString();
}

function parseScope(value) {
  if (!VALID_SCOPES.has(value)) {
    throw new UserError('Scope must be one of: global, project, conversation');
  }
  return value;
}

function parseTier(value) {
  if (!VALID_TIERS.has(value)) {
    throw new UserError('Tier must be one of: working, long-term');
  }
  return value;
}

function parseSourceType(value) {
  if (!VALID_SOURCE_TYPES.has(value)) {
    throw new UserError('Source type must be one of: manual, inferred, user_said, tool_output');
  }
  return value;
}

function parseRelationType(value) {
  if (!VALID_RELATION_TYPES.has(value)) {
    throw new UserError(`Relation type must be one of: ${[...VALID_RELATION_TYPES].join(', ')}`);
  }
  return value;
}

function parseDurationMs(value) {
  const match = String(value).trim().toLowerCase().match(/^(\d+)([smhdw])$/);
  if (!match) {
    throw new UserError('TTL must be a compact duration like 30m, 24h, 7d');
  }

  const amount = Number.parseInt(match[1], 10);
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new UserError('TTL duration amount must be a positive integer');
  }

  const unit = match[2];
  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000
  };

  return amount * multipliers[unit];
}

function ttlToExpiresAt(ttl) {
  if (!ttl) {
    return null;
  }
  return new Date(Date.now() + parseDurationMs(ttl)).toISOString();
}

function formatDuration(ms) {
  const abs = Math.max(0, Math.floor(ms / 1000));
  const units = [
    { size: 86400, label: 'd' },
    { size: 3600, label: 'h' },
    { size: 60, label: 'm' },
    { size: 1, label: 's' }
  ];

  for (const unit of units) {
    if (abs >= unit.size) {
      return `${Math.floor(abs / unit.size)}${unit.label}`;
    }
  }
  return '0s';
}

function expiresLabel(expiresAt) {
  if (!expiresAt) {
    return 'no ttl';
  }

  const delta = new Date(expiresAt).valueOf() - Date.now();
  if (!Number.isFinite(delta)) {
    return 'invalid ttl';
  }

  if (delta <= 0) {
    return `expired ${formatDuration(-delta)} ago`;
  }
  return `expires in ${formatDuration(delta)}`;
}

function printFact(fact) {
  const conf = typeof fact.confidence === 'number' ? fact.confidence.toFixed(2) : '1.00';
  const source = fact.source ? ` source=${fact.source}` : '';
  const meta = ` confidence=${conf} scope=${fact.scope ?? 'global'} tier=${fact.tier ?? 'long-term'} source_type=${fact.source_type ?? 'manual'} ttl=${expiresLabel(fact.expires_at)}`;
  console.log(`${colors.bold(`${fact.category}/${fact.key}`)} = ${fact.value}${colors.dim(` [${meta}${source}]`)}`);
}

function projectTag(slug) {
  return `[project:${slug}]`;
}

function withProjectTag(source, project) {
  if (!project) {
    return source ?? null;
  }
  const tag = projectTag(project);
  const base = source ? String(source).trim() : '';
  if (base.includes(tag)) {
    return base;
  }
  return base ? `${base} ${tag}` : tag;
}

function upsertFact(db, {
  category,
  key,
  value,
  source = null,
  confidence = 1.0,
  scope = 'global',
  tier = 'long-term',
  expires_at: expiresAt = null,
  last_verified: lastVerified = null,
  source_type: sourceType = 'manual'
}) {
  const ts = nowIso();
  const stmt = db.prepare(`
    INSERT INTO facts (category, key, value, source, confidence, created, updated, scope, tier, expires_at, last_verified, source_type)
    VALUES (@category, @key, @value, @source, @confidence, @created, @updated, @scope, @tier, @expires_at, @last_verified, @source_type)
    ON CONFLICT(category, key) DO UPDATE SET
      value = excluded.value,
      source = excluded.source,
      confidence = excluded.confidence,
      scope = excluded.scope,
      tier = excluded.tier,
      expires_at = excluded.expires_at,
      last_verified = COALESCE(excluded.last_verified, facts.last_verified),
      source_type = excluded.source_type,
      updated = excluded.updated
  `);

  stmt.run({
    category,
    key,
    value,
    source,
    confidence,
    created: ts,
    updated: ts,
    scope,
    tier,
    expires_at: expiresAt,
    last_verified: lastVerified,
    source_type: sourceType
  });
}

function requireFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new UserError(`File not found: ${filePath}`);
  }
}

function requireDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    throw new UserError(`Directory not found: ${dirPath}`);
  }
  if (!fs.statSync(dirPath).isDirectory()) {
    throw new UserError(`Not a directory: ${dirPath}`);
  }
}

function toSummaryKey(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `summary.${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}-${pad(date.getMinutes())}`;
}

function hasSessionSummary(summary) {
  return (
    summary.decisions.length > 0 ||
    summary.open_questions.length > 0 ||
    summary.action_items.length > 0 ||
    summary.topics.length > 0
  );
}

function globToRegex(glob) {
  const escaped = String(glob).replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const regexPattern = `^${escaped.replace(/\*/g, '.*').replace(/\?/g, '.').replace(/\//g, '[/\\\\]')}$`;
  return new RegExp(regexPattern, 'i');
}

function listFilesRecursive(rootDir, pattern, sinceIso = null) {
  const matcher = globToRegex(pattern);
  const out = [];
  const stack = [rootDir];

  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      const rel = path.relative(rootDir, fullPath);
      if (!matcher.test(rel) && !matcher.test(entry.name)) {
        continue;
      }
      if (sinceIso) {
        const stat = fs.statSync(fullPath);
        if (stat.mtime.toISOString() <= sinceIso) {
          continue;
        }
      }
      out.push(fullPath);
    }
  }

  out.sort((a, b) => a.localeCompare(b));
  return out;
}

function applyExtractedFacts(db, facts) {
  const now = nowIso();
  const getByKey = db.prepare('SELECT * FROM facts WHERE category = ? AND key = ?');
  const insertStmt = db.prepare(`
    INSERT INTO facts (category, key, value, source, confidence, created, updated, scope, tier, expires_at, last_verified, source_type)
    VALUES (@category, @key, @value, @source, @confidence, @created, @updated, @scope, @tier, @expires_at, @last_verified, @source_type)
  `);
  const updateChangedStmt = db.prepare(`
    UPDATE facts
    SET value = @value,
        source = @source,
        confidence = @confidence,
        scope = @scope,
        tier = @tier,
        expires_at = @expires_at,
        source_type = @source_type,
        updated = @updated
    WHERE category = @category AND key = @key
  `);
  const touchVerifiedStmt = db.prepare(`
    UPDATE facts
    SET last_verified = @last_verified
    WHERE category = @category AND key = @key
  `);

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  const tx = db.transaction((items) => {
    for (const fact of items) {
      const existing = getByKey.get(fact.category, fact.key);
      if (!existing) {
        insertStmt.run({
          category: fact.category,
          key: fact.key,
          value: fact.value,
          source: null,
          confidence: fact.confidence ?? 0.8,
          created: now,
          updated: now,
          scope: fact.scope ?? 'global',
          tier: fact.tier ?? 'long-term',
          expires_at: ttlToExpiresAt(fact.ttl),
          last_verified: now,
          source_type: fact.source_type ?? 'inferred'
        });
        inserted += 1;
        continue;
      }

      if (existing.value === fact.value) {
        touchVerifiedStmt.run({
          category: fact.category,
          key: fact.key,
          last_verified: now
        });
        skipped += 1;
        continue;
      }

      updateChangedStmt.run({
        category: fact.category,
        key: fact.key,
        value: fact.value,
        source: existing.source ?? null,
        confidence: fact.confidence ?? existing.confidence ?? 0.8,
        scope: fact.scope ?? existing.scope ?? 'global',
        tier: fact.tier ?? existing.tier ?? 'long-term',
        expires_at: ttlToExpiresAt(fact.ttl),
        source_type: fact.source_type ?? existing.source_type ?? 'inferred',
        updated: now
      });
      updated += 1;
    }
  });

  tx(facts);
  return { inserted, updated, skipped };
}

function storeSessionSummary(db, summary) {
  if (!hasSessionSummary(summary)) {
    return null;
  }
  const key = toSummaryKey();
  upsertFact(db, {
    category: 'session',
    key,
    value: JSON.stringify(summary),
    scope: 'global',
    tier: 'long-term',
    source_type: 'inferred',
    confidence: 0.9
  });
  return key;
}

async function runExtractOne(file, options) {
  const startMs = Date.now();
  const content = fs.readFileSync(file, 'utf8');

  // Skip files already extracted (unless --force)
  if (!options.dryRun && !options.force) {
    const db = openDb();
    const already = wasAlreadyExtracted(db, file, content);
    db.close();
    if (already) {
      if (options.verbose) {
        console.log(colors.dim(`${file}: already extracted (use --force to re-extract)`));
      }
      return { facts: 0, inserted: 0, updated: 0, skipped: 0, summaryStored: false, skippedFile: true };
    }
  }

  let extraction;
  try {
    extraction = await extractFactsFromFile(file, {
      engine: options.engine,
      model: options.model,
      verbose: Boolean(options.verbose)
    });
  } catch (err) {
    const durationMs = Date.now() - startMs;
    // Log failed extraction so we can debug
    if (!options.dryRun) {
      const db = openDb();
      logExtraction(db, {
        filePath: file, content, engine: options.engine || 'auto',
        model: options.model || 'default', facts: 0, inserted: 0,
        updated: 0, skipped: 0, durationMs, status: 'error',
        error: err.message || String(err)
      });
      db.close();
    }
    throw err;
  }

  const durationMs = Date.now() - startMs;

  if (extraction.facts.length === 0 && !hasSessionSummary(extraction.session_summary)) {
    console.log(colors.yellow(`${file}: no useful extraction output`));
    if (!options.dryRun) {
      const db = openDb();
      logExtraction(db, {
        filePath: file, content, engine: extraction.engine,
        model: options.model || 'default', facts: 0, inserted: 0,
        updated: 0, skipped: 0, durationMs, status: 'empty'
      });
      db.close();
    }
    return { facts: 0, inserted: 0, updated: 0, skipped: 0, summaryStored: false };
  }

  if (options.dryRun) {
    console.log(colors.bold(file));
    for (const fact of extraction.facts) {
      console.log(`${fact.category}/${fact.key} = ${fact.value} [scope=${fact.scope} tier=${fact.tier} source_type=${fact.source_type} confidence=${fact.confidence.toFixed(2)} ttl=${fact.ttl ?? 'none'}]`);
    }
    if (hasSessionSummary(extraction.session_summary)) {
      console.log(colors.dim(`session_summary decisions=${extraction.session_summary.decisions.length} open_questions=${extraction.session_summary.open_questions.length} action_items=${extraction.session_summary.action_items.length} topics=${extraction.session_summary.topics.length}`));
    }
    console.log(colors.dim(`${extraction.facts.length} fact(s) extracted in ${(durationMs/1000).toFixed(1)}s [${extraction.engine}]${extraction.chunks > 1 ? ` across ${extraction.chunks} chunk(s)` : ''}`));
    return {
      facts: extraction.facts.length,
      inserted: 0,
      updated: 0,
      skipped: 0,
      summaryStored: hasSessionSummary(extraction.session_summary)
    };
  }

  const db = openDb();
  const result = applyExtractedFacts(db, extraction.facts);
  const summaryKey = storeSessionSummary(db, extraction.session_summary);

  logExtraction(db, {
    filePath: file, content, engine: extraction.engine,
    model: options.model || 'default', facts: extraction.facts.length,
    inserted: result.inserted, updated: result.updated,
    skipped: result.skipped, durationMs, status: 'ok'
  });
  db.close();

  const changedMsg = `inserted=${result.inserted} updated=${result.updated} skipped=${result.skipped}`;
  const summaryMsg = summaryKey ? ` summary=${summaryKey}` : '';
  const timeMsg = ` (${(durationMs/1000).toFixed(1)}s ${extraction.engine})`;
  console.log(colors.green(`${file}: extracted=${extraction.facts.length} ${changedMsg}${summaryMsg}${timeMsg}`));
  return {
    facts: extraction.facts.length,
    inserted: result.inserted,
    updated: result.updated,
    skipped: result.skipped,
    summaryStored: Boolean(summaryKey)
  };
}

function printSimpleList(facts) {
  for (const fact of facts) {
    printFact(fact);
  }
  console.log(colors.dim(`${facts.length} fact(s)`));
}

function parseFactRef(input) {
  const trimmed = String(input).trim();
  const slash = trimmed.indexOf('/');
  if (slash <= 0 || slash === trimmed.length - 1) {
    throw new UserError(`Invalid fact reference: ${input}. Expected category/key`);
  }

  return {
    category: trimmed.slice(0, slash),
    key: trimmed.slice(slash + 1)
  };
}

function getFactByRef(db, input) {
  const ref = parseFactRef(input);
  const row = db.prepare('SELECT * FROM facts WHERE category = ? AND key = ?').get(ref.category, ref.key);
  if (!row) {
    throw new UserError(`Fact not found: ${ref.category}/${ref.key}`);
  }
  return row;
}

function toFtsQuery(query) {
  const terms = String(query)
    .trim()
    .split(/\s+/)
    .map((term) => term.replace(/"/g, '""'))
    .filter(Boolean)
    .map((term) => `"${term}"*`);

  if (terms.length === 0) {
    throw new UserError('Search query cannot be empty');
  }
  return terms.join(' AND ');
}

export function runCli(argv) {
  const program = new Command();

  program
    .name('brokkr-mem')
    .description('Persistent fact-based memory for Brokkr')
    .version('1.0.0');

  program.command('add <category> <key> <value>')
    .description('Add or update a fact')
    .option('--source <source>', 'Fact source')
    .option('--confidence <n>', 'Confidence score (0-1)', parseConfidence, 1.0)
    .option('--scope <scope>', 'Fact scope: global|project|conversation', parseScope, 'global')
    .option('--tier <tier>', 'Memory tier: working|long-term', parseTier, 'long-term')
    .option('--ttl <duration>', 'Auto-expire duration (e.g., 24h, 7d, 30m)')
    .option('--source-type <type>', 'manual|inferred|user_said|tool_output', parseSourceType, 'manual')
    .option('--project <slug>', 'Shortcut: sets scope=project and tags source with project name')
    .action((category, key, value, options) => {
      const db = openDb();
      const scope = options.project ? 'project' : options.scope;
      const source = withProjectTag(options.source ?? null, options.project ?? null);
      const expiresAt = ttlToExpiresAt(options.ttl ?? null);

      upsertFact(db, {
        category,
        key,
        value,
        source,
        confidence: options.confidence,
        scope,
        tier: options.tier,
        expires_at: expiresAt,
        source_type: options.sourceType
      });

      db.close();
      console.log(colors.green('Fact saved'));
    });

  program.command('get <category> [key]')
    .description('Get facts by category or specific key')
    .action((category, key) => {
      const db = openDb();
      let rows;
      if (key) {
        rows = db.prepare('SELECT * FROM facts WHERE category = ? AND key = ?').all(category, key);
      } else {
        rows = db.prepare('SELECT * FROM facts WHERE category = ? ORDER BY key').all(category);
      }
      db.close();

      if (rows.length === 0) {
        throw new UserError('No matching facts found', 2);
      }
      printSimpleList(rows);
    });

  program.command('search <query>')
    .description('Search facts using FTS5 index')
    .action((query) => {
      const db = openDb();
      const ftsQuery = toFtsQuery(query);
      let rows = db.prepare(`
        SELECT f.*
        FROM facts_fts
        JOIN facts f ON f.id = facts_fts.rowid
        WHERE facts_fts MATCH ?
        ORDER BY bm25(facts_fts), f.updated DESC
      `).all(ftsQuery);

      if (rows.length === 0) {
        rows = db.prepare(`
          SELECT * FROM facts
          WHERE lower(key) LIKE lower(?) OR lower(value) LIKE lower(?)
          ORDER BY updated DESC
        `).all(`%${query}%`, `%${query}%`);
      }

      db.close();

      if (rows.length === 0) {
        throw new UserError('No matching facts found', 2);
      }
      printSimpleList(rows);
    });

  program.command('list')
    .description('List facts with optional filters')
    .option('--category <cat>', 'Filter category')
    .option('--scope <scope>', 'Filter by scope', parseScope)
    .option('--tier <tier>', 'Filter by tier', parseTier)
    .option('--limit <n>', 'Limit number of rows', parseLimit, DEFAULT_LIMIT)
    .option('--recent', 'Sort by most recently updated')
    .action((options) => {
      const db = openDb();
      const where = [];
      const params = [];

      if (options.category) {
        where.push('category = ?');
        params.push(options.category);
      }
      if (options.scope) {
        where.push('scope = ?');
        params.push(options.scope);
      }
      if (options.tier) {
        where.push('tier = ?');
        params.push(options.tier);
      }

      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const orderSql = options.recent ? 'ORDER BY updated DESC' : 'ORDER BY category, key';
      const sql = `SELECT * FROM facts ${whereSql} ${orderSql} LIMIT ?`;
      const rows = db.prepare(sql).all(...params, options.limit);
      db.close();

      if (rows.length === 0) {
        throw new UserError('No facts found', 2);
      }
      printSimpleList(rows);
    });

  program.command('remove <category> <key>')
    .description('Delete a specific fact')
    .action((category, key) => {
      const db = openDb();
      const res = db.prepare('DELETE FROM facts WHERE category = ? AND key = ?').run(category, key);
      db.close();

      if (res.changes === 0) {
        throw new UserError('No matching fact to remove', 2);
      }
      console.log(colors.green('Fact removed'));
    });

  program.command('link <from> <to>')
    .description('Link two facts with a relation')
    .option('--type <relation_type>', 'related_to|part_of|decided_by|owned_by|replaced_by', parseRelationType, 'related_to')
    .action((from, to, options) => {
      const db = openDb();
      const fromFact = getFactByRef(db, from);
      const toFact = getFactByRef(db, to);

      db.prepare(`
        INSERT INTO relations (source_fact_id, target_fact_id, relation_type, created)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(source_fact_id, target_fact_id, relation_type) DO NOTHING
      `).run(fromFact.id, toFact.id, options.type, nowIso());

      db.close();
      console.log(colors.green(`Linked ${fromFact.category}/${fromFact.key} -> ${toFact.category}/${toFact.key} (${options.type})`));
    });

  program.command('graph <fact>')
    .description('Show a fact and connected facts')
    .action((factRef) => {
      const db = openDb();
      const root = getFactByRef(db, factRef);
      const rows = db.prepare(`
        SELECT r.relation_type, 'outgoing' AS direction, t.category, t.key, t.value
        FROM relations r
        JOIN facts t ON t.id = r.target_fact_id
        WHERE r.source_fact_id = ?
        UNION ALL
        SELECT r.relation_type, 'incoming' AS direction, s.category, s.key, s.value
        FROM relations r
        JOIN facts s ON s.id = r.source_fact_id
        WHERE r.target_fact_id = ?
        ORDER BY relation_type, direction, category, key
      `).all(root.id, root.id);
      db.close();

      console.log(colors.bold(`${root.category}/${root.key}`));
      console.log(root.value);

      if (rows.length === 0) {
        console.log(colors.dim('No relations'));
        return;
      }

      for (const row of rows) {
        const arrow = row.direction === 'outgoing' ? '->' : '<-';
        console.log(`${arrow} (${row.relation_type}) ${row.category}/${row.key}: ${row.value}`);
      }
    });

  program.command('working')
    .description('List all working memory facts and TTL status')
    .action(() => {
      const db = openDb();
      const rows = db.prepare(`
        SELECT *
        FROM facts
        WHERE tier = 'working'
        ORDER BY CASE WHEN expires_at IS NULL THEN 1 ELSE 0 END, expires_at ASC, updated DESC
      `).all();
      db.close();

      if (rows.length === 0) {
        throw new UserError('No working-memory facts found', 2);
      }

      for (const fact of rows) {
        console.log(`${colors.bold(`${fact.category}/${fact.key}`)} = ${fact.value} ${colors.dim(`[${expiresLabel(fact.expires_at)}]`)}`);
      }
      console.log(colors.dim(`${rows.length} fact(s)`));
    });

  program.command('expire')
    .description('Prune facts whose TTL has expired')
    .action(() => {
      const db = openDb();
      const res = db.prepare("DELETE FROM facts WHERE tier = 'working' AND expires_at IS NOT NULL AND expires_at <= ?").run(nowIso());
      db.close();

      console.log(colors.green(`Expired ${res.changes} fact(s)`));
    });

  program.command('inject')
    .description('Generate markdown for LLM injection')
    .option('--max <n>', 'Maximum facts', parseLimit, DEFAULT_LIMIT)
    .option('--scope <scope>', 'Filter by scope', parseScope)
    .option('--project <slug>', 'Inject global + project-scoped facts tagged for this project')
    .option('--include-working', 'Include working memory (default is long-term only)')
    .option('--output <file>', 'Write markdown to file')
    .action((options) => {
      const db = openDb();
      const where = ['(expires_at IS NULL OR expires_at > ?)'];
      const params = [nowIso()];

      if (options.scope) {
        where.push('scope = ?');
        params.push(options.scope);
      }

      if (!options.includeWorking) {
        where.push("tier = 'long-term'");
      }

      if (options.project) {
        where.push(`(scope = 'global' OR (scope = 'project' AND source LIKE ?))`);
        params.push(`%${projectTag(options.project)}%`);
      }

      const sql = `
        SELECT * FROM facts
        WHERE ${where.join(' AND ')}
        ORDER BY CASE WHEN tier = 'working' THEN 0 ELSE 1 END, updated DESC
        LIMIT ?
      `;
      const rows = db.prepare(sql).all(...params, options.max);
      db.close();

      const markdown = factsToMarkdown(rows);
      if (options.output) {
        fs.writeFileSync(options.output, markdown, 'utf8');
        console.log(colors.green(`Wrote ${rows.length} fact(s) to ${options.output}`));
      } else {
        process.stdout.write(markdown);
      }
    });

  program.command('extract <file>')
    .description('Extract facts and session summary from a markdown file')
    .option('--dry-run', 'Print extracted facts without writing')
    .option('--engine <engine>', 'Extraction engine: anthropic, openai, ollama, or auto (default: auto)', 'auto')
    .option('--model <model>', 'Model name (default depends on engine)')
    .option('--force', 'Re-extract even if file was already processed')
    .option('--verbose', 'Show extraction prompt and raw model response')
    .action(async (file, options) => {
      requireFile(file);
      const res = await runExtractOne(file, options);
      if (!options.dryRun) {
        console.log(colors.green(`Stored ${res.facts} extracted fact(s)`));
      }
    });

  program.command('extract-all <directory>')
    .description('Batch extract facts from markdown files in a directory')
    .option('--pattern <glob>', 'File pattern', '*.md')
    .option('--since <date>', 'Only process files modified after date (ISO)')
    .option('--dry-run', 'Print extracted facts without writing')
    .option('--engine <engine>', 'Extraction engine: anthropic, openai, ollama, or auto (default: auto)', 'auto')
    .option('--model <model>', 'Model name (default depends on engine)')
    .option('--force', 'Re-extract even if files were already processed')
    .option('--verbose', 'Show extraction prompt and raw model response')
    .action(async (directory, options) => {
      requireDirectory(directory);
      const sinceIso = options.since ? parseDate(options.since) : null;
      const files = listFilesRecursive(directory, options.pattern, sinceIso);
      if (files.length === 0) {
        console.log(colors.yellow('No files matched'));
        return;
      }

      let totalFacts = 0;
      let totalInserted = 0;
      let totalUpdated = 0;
      let totalSkipped = 0;
      let totalSummaries = 0;
      let totalSkippedFiles = 0;
      for (const file of files) {
        try {
          const res = await runExtractOne(file, options);
          totalFacts += res.facts;
          totalInserted += res.inserted;
          totalUpdated += res.updated;
          totalSkipped += res.skipped;
          totalSummaries += res.summaryStored ? 1 : 0;
          if (res.skippedFile) totalSkippedFiles += 1;
        } catch (err) {
          console.log(colors.red(`${file}: ${err.message || String(err)}`));
        }
      }

      const header = options.dryRun ? 'Batch dry-run complete' : 'Batch extract complete';
      const processed = files.length - totalSkippedFiles;
      const counts = `files=${files.length} processed=${processed} skipped_unchanged=${totalSkippedFiles} facts=${totalFacts} inserted=${totalInserted} updated=${totalUpdated} skipped=${totalSkipped} summaries=${totalSummaries}`;
      console.log(colors.green(`${header}: ${counts}`));
    });

  program.command('import <file>')
    .description('Import facts from JSON file')
    .action((file) => {
      requireFile(file);
      let data;
      try {
        data = JSON.parse(fs.readFileSync(file, 'utf8'));
      } catch {
        throw new UserError('Import file is not valid JSON');
      }
      if (!Array.isArray(data)) {
        throw new UserError('Import JSON must be an array of facts');
      }

      const clean = [];
      for (const item of data) {
        if (!item || typeof item !== 'object') {
          continue;
        }

        const {
          category,
          key,
          value,
          source = null,
          confidence = 1.0,
          scope = 'global',
          tier = 'long-term',
          ttl = null,
          expires_at: expiresAt = null,
          source_type: sourceType = 'manual'
        } = item;

        if (
          typeof category !== 'string' || !category.trim() ||
          typeof key !== 'string' || !key.trim() ||
          typeof value !== 'string' || !value.trim()
        ) {
          continue;
        }

        const conf = Number(confidence);
        if (!Number.isFinite(conf) || conf < 0 || conf > 1) {
          continue;
        }

        if (!VALID_SCOPES.has(scope) || !VALID_TIERS.has(tier) || !VALID_SOURCE_TYPES.has(sourceType)) {
          continue;
        }

        let finalExpiresAt = null;
        try {
          if (ttl != null) {
            finalExpiresAt = ttlToExpiresAt(String(ttl));
          } else if (expiresAt != null) {
            finalExpiresAt = parseDate(String(expiresAt));
          }
        } catch {
          continue;
        }

        clean.push({
          category: category.trim(),
          key: key.trim(),
          value: value.trim(),
          source: source == null ? null : String(source),
          confidence: conf,
          scope,
          tier,
          expires_at: finalExpiresAt,
          source_type: sourceType
        });
      }

      if (clean.length === 0) {
        throw new UserError('No valid facts found in import file');
      }

      const db = openDb();
      const tx = db.transaction((items) => {
        for (const fact of items) {
          upsertFact(db, fact);
        }
      });
      tx(clean);
      db.close();
      console.log(colors.green(`Imported ${clean.length} fact(s)`));
    });

  program.command('export')
    .description('Export all facts')
    .option('--format <fmt>', 'Export format: json or md', 'json')
    .action((options) => {
      if (!['json', 'md'].includes(options.format)) {
        throw new UserError('Format must be json or md');
      }
      const db = openDb();
      const rows = db.prepare('SELECT * FROM facts ORDER BY category, key').all();
      db.close();

      if (options.format === 'json') {
        process.stdout.write(`${JSON.stringify(rows, null, 2)}\n`);
        return;
      }
      process.stdout.write(factsToMarkdown(rows));
    });

  program.command('stats')
    .description('Show memory stats')
    .action(() => {
      const db = openDb();
      const total = db.prepare('SELECT COUNT(*) AS n FROM facts').get().n;
      const byCategory = db.prepare('SELECT category, COUNT(*) AS n FROM facts GROUP BY category ORDER BY category').all();
      const byScope = db.prepare('SELECT scope, COUNT(*) AS n FROM facts GROUP BY scope ORDER BY scope').all();
      const byTier = db.prepare('SELECT tier, COUNT(*) AS n FROM facts GROUP BY tier ORDER BY tier').all();
      const latest = db.prepare('SELECT MAX(updated) AS last_updated FROM facts').get().last_updated;
      db.close();

      let dbSize = 0;
      if (fs.existsSync(DB_PATH)) {
        dbSize = fs.statSync(DB_PATH).size;
      }

      console.log(`${colors.bold('DB:')} ${DB_PATH}`);
      console.log(`${colors.bold('Total facts:')} ${total}`);
      console.log(`${colors.bold('DB size:')} ${dbSize} bytes`);
      console.log(`${colors.bold('Last updated:')} ${latest ?? 'n/a'}`);
      console.log(colors.bold('By category:'));
      for (const row of byCategory) {
        console.log(`- ${row.category}: ${row.n}`);
      }
      console.log(colors.bold('By scope:'));
      for (const row of byScope) {
        console.log(`- ${row.scope}: ${row.n}`);
      }
      console.log(colors.bold('By tier:'));
      for (const row of byTier) {
        console.log(`- ${row.tier}: ${row.n}`);
      }
    });

  program.command('prune')
    .description('Remove old and/or low-confidence facts')
    .option('--before <date>', 'Delete facts updated before this ISO date')
    .option('--confidence-below <n>', 'Delete facts with confidence below n')
    .action((options) => {
      if (!options.before && options.confidenceBelow == null) {
        throw new UserError('Provide at least one filter: --before or --confidence-below');
      }

      const where = [];
      const params = [];
      if (options.before) {
        where.push('updated < ?');
        params.push(parseDate(options.before));
      }
      if (options.confidenceBelow != null) {
        const conf = parseConfidence(options.confidenceBelow);
        where.push('confidence < ?');
        params.push(conf);
      }

      const db = openDb();
      const res = db.prepare(`DELETE FROM facts WHERE ${where.join(' AND ')}`).run(...params);
      db.close();

      console.log(colors.green(`Pruned ${res.changes} fact(s)`));
    });

  program.command('test [suite]')
    .description('Run test and benchmark suites (unit, extract, recall, perf, e2e, all)')
    .option('--save', 'Save results to benchmark history')
    .option('--compare', 'Compare current results against last saved run')
    .option('--verbose', 'Show detailed suite output')
    .option('--db <path>', 'Use alternate base DB path for test suites', '/tmp/rune-test.db')
    .option('--model <model>', 'Ollama model for extraction benchmarks', 'qwen3:8b')
    .action(async (suite = 'all', options) => {
      const outcome = await runTestSuites(suite, options);
      if (!outcome.ok) {
        process.exitCode = 1;
      }
    });

  program.configureOutput({
    outputError: (str, write) => write(colors.red(str))
  });

  const fatal = (err) => {
    if (err instanceof UserError) {
      console.error(colors.red(`Error: ${err.message}`));
      process.exit(err.exitCode ?? 1);
    }
    console.error(colors.red(`Error: ${err.message || 'Unknown error'}`));
    process.exit(1);
  };

  program.parseAsync(argv).catch(fatal);
}
