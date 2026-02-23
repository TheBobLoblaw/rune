import fs from 'node:fs';
import { Command } from 'commander';
import { DB_PATH, openDb, nowIso } from './db.js';
import { colors } from './colors.js';
import { factsToMarkdown } from './format.js';
import { extractFactsFromFile } from './extract.js';
import { UserError } from './errors.js';

const DEFAULT_LIMIT = 100;

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

function printFact(fact) {
  const conf = typeof fact.confidence === 'number' ? fact.confidence.toFixed(2) : '1.00';
  const source = fact.source ? ` source=${fact.source}` : '';
  console.log(`${colors.bold(`${fact.category}/${fact.key}`)} = ${fact.value}${colors.dim(` [confidence=${conf}${source}]`)}`);
}

function upsertFact(db, { category, key, value, source = null, confidence = 1.0 }) {
  const ts = nowIso();
  const stmt = db.prepare(`
    INSERT INTO facts (category, key, value, source, confidence, created, updated)
    VALUES (@category, @key, @value, @source, @confidence, @created, @updated)
    ON CONFLICT(category, key) DO UPDATE SET
      value = excluded.value,
      source = excluded.source,
      confidence = excluded.confidence,
      updated = excluded.updated
  `);

  stmt.run({
    category,
    key,
    value,
    source,
    confidence,
    created: ts,
    updated: ts
  });
}

function requireFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new UserError(`File not found: ${filePath}`);
  }
}

function printSimpleList(facts) {
  for (const fact of facts) {
    printFact(fact);
  }
  console.log(colors.dim(`${facts.length} fact(s)`));
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
    .action((category, key, value, options) => {
      const db = openDb();
      upsertFact(db, {
        category,
        key,
        value,
        source: options.source ?? null,
        confidence: options.confidence
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
    .description('Search facts across keys and values')
    .action((query) => {
      const db = openDb();
      const rows = db.prepare(`
        SELECT * FROM facts
        WHERE lower(key) LIKE lower(?) OR lower(value) LIKE lower(?)
        ORDER BY updated DESC
      `).all(`%${query}%`, `%${query}%`);
      db.close();

      if (rows.length === 0) {
        throw new UserError('No matching facts found', 2);
      }
      printSimpleList(rows);
    });

  program.command('list')
    .description('List facts with optional filters')
    .option('--category <cat>', 'Filter category')
    .option('--limit <n>', 'Limit number of rows', parseLimit, DEFAULT_LIMIT)
    .option('--recent', 'Sort by most recently updated')
    .action((options) => {
      const db = openDb();
      const where = [];
      const params = [];
      let rows;

      if (options.category) {
        where.push('category = ?');
        params.push(options.category);
      }

      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const orderSql = options.recent ? 'ORDER BY updated DESC' : 'ORDER BY category, key';
      const sql = `SELECT * FROM facts ${whereSql} ${orderSql} LIMIT ?`;
      rows = db.prepare(sql).all(...params, options.limit);
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

  program.command('inject')
    .description('Generate markdown for LLM injection')
    .option('--max <n>', 'Maximum facts', parseLimit, DEFAULT_LIMIT)
    .option('--output <file>', 'Write markdown to file')
    .action((options) => {
      const db = openDb();
      const rows = db.prepare('SELECT * FROM facts ORDER BY updated DESC LIMIT ?').all(options.max);
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
    .description('Extract facts from markdown using Ollama qwen3:8b')
    .option('--dry-run', 'Print extracted facts without writing')
    .action(async (file, options) => {
      const facts = await extractFactsFromFile(file);
      if (facts.length === 0) {
        console.log(colors.yellow('No valid facts extracted'));
        return;
      }

      if (options.dryRun) {
        for (const fact of facts) {
          console.log(`${fact.category}/${fact.key} = ${fact.value}`);
        }
        console.log(colors.dim(`${facts.length} fact(s) extracted (dry run)`));
        return;
      }

      const db = openDb();
      const tx = db.transaction((items) => {
        for (const fact of items) {
          upsertFact(db, fact);
        }
      });
      tx(facts);
      db.close();
      console.log(colors.green(`Stored ${facts.length} extracted fact(s)`));
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
        const { category, key, value, source = null, confidence = 1.0 } = item;
        if (
          typeof category === 'string' && category.trim() &&
          typeof key === 'string' && key.trim() &&
          typeof value === 'string' && value.trim()
        ) {
          const conf = Number(confidence);
          if (Number.isFinite(conf) && conf >= 0 && conf <= 1) {
            clean.push({
              category: category.trim(),
              key: key.trim(),
              value: value.trim(),
              source: source === null ? null : String(source),
              confidence: conf
            });
          }
        }
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
