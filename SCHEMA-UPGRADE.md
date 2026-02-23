# Rune Schema Upgrade — Phase 1.5

## New Columns on `facts` table
```sql
ALTER TABLE facts ADD COLUMN scope TEXT DEFAULT 'global';
ALTER TABLE facts ADD COLUMN tier TEXT DEFAULT 'long-term';
ALTER TABLE facts ADD COLUMN expires_at TEXT;
ALTER TABLE facts ADD COLUMN last_verified TEXT;
ALTER TABLE facts ADD COLUMN source_type TEXT DEFAULT 'manual';
```

## New Table: `relations`
```sql
CREATE TABLE relations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_fact_id INTEGER NOT NULL,
  target_fact_id INTEGER NOT NULL,
  relation_type TEXT NOT NULL,  -- related_to, part_of, decided_by, owned_by, replaced_by
  created TEXT NOT NULL,
  FOREIGN KEY (source_fact_id) REFERENCES facts(id) ON DELETE CASCADE,
  FOREIGN KEY (target_fact_id) REFERENCES facts(id) ON DELETE CASCADE,
  UNIQUE(source_fact_id, target_fact_id, relation_type)
);
CREATE INDEX idx_relations_source ON relations(source_fact_id);
CREATE INDEX idx_relations_target ON relations(target_fact_id);
```

## FTS5 Virtual Table
```sql
CREATE VIRTUAL TABLE facts_fts USING fts5(key, value, content=facts, content_rowid=id);
-- Triggers to keep FTS in sync
CREATE TRIGGER facts_ai AFTER INSERT ON facts BEGIN
  INSERT INTO facts_fts(rowid, key, value) VALUES (new.id, new.key, new.value);
END;
CREATE TRIGGER facts_ad AFTER DELETE ON facts BEGIN
  INSERT INTO facts_fts(facts_fts, rowid, key, value) VALUES('delete', old.id, old.key, old.value);
END;
CREATE TRIGGER facts_au AFTER UPDATE ON facts BEGIN
  INSERT INTO facts_fts(facts_fts, rowid, key, value) VALUES('delete', old.id, old.key, old.value);
  INSERT INTO facts_fts(rowid, key, value) VALUES (new.id, new.key, new.value);
END;
```

## Updated CLI Commands

### Modified: `brokkr-mem add`
```
brokkr-mem add <category> <key> <value> [options]
  --source <source>          Source description
  --confidence <0-1>         Confidence score
  --scope <global|project|conversation>  Fact scope (default: global)
  --tier <working|long-term>  Memory tier (default: long-term)
  --ttl <duration>           Auto-expire (e.g. "24h", "7d", "1h")
  --source-type <type>       manual|inferred|user_said|tool_output
  --project <slug>           Shortcut: sets scope=project + tags with project name
```

### New: `brokkr-mem link`
```
brokkr-mem link <category/key> <category/key> [--type <relation_type>]
```

### New: `brokkr-mem graph <category/key>`
Show a fact and all its connected facts.

### New: `brokkr-mem working`
List all working memory facts (tier=working). Show TTL remaining.

### New: `brokkr-mem expire`
Prune all facts past their expires_at. Run during heartbeats.

### Modified: `brokkr-mem inject`
```
brokkr-mem inject [options]
  --max <n>              Max facts (default 100)
  --scope <scope>        Filter by scope
  --project <slug>       Only inject global + this project's facts
  --include-working      Include working memory (default: long-term only)
  --output <file>        Write to file
```

Output format updated:
```markdown
# Rune — Known Facts
> These are recalled facts from persistent memory. Verify if uncertain.

## Working Memory (expires in Xh)
- **current-task**: Building Rune schema upgrade

## People
- **cory.discord.main**: Discord ID 109711231836749824
...
```

### Modified: `brokkr-mem extract`
Extraction prompt updated to classify each fact:
```json
[
  {
    "category": "project",
    "key": "cad-wiki.editor",
    "value": "Using TipTap WYSIWYG",
    "scope": "project",
    "tier": "long-term",
    "source_type": "user_said",
    "ttl": null
  },
  {
    "category": "task",
    "key": "current.build",
    "value": "Rune schema upgrade",
    "scope": "global",
    "tier": "working",
    "source_type": "inferred",
    "ttl": "24h"
  }
]
```

## Migration Strategy
- Run ALTER TABLE statements on existing DB
- Backfill: all existing facts get scope=global, tier=long-term, source_type=manual
- Rebuild FTS5 index from existing data
- No data loss

## Completion
1. All schema changes applied
2. All CLI commands updated
3. FTS5 working (test with `brokkr-mem search`)
4. npm install -g . works
5. Git commit: "feat(rune): schema upgrade — scope, tiers, TTL, relations, FTS5"
6. Run: openclaw system event --text "Done: Rune schema upgrade — three-tier memory, relations, FTS5" --mode now
