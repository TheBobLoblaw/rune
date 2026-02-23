# brokkr-mem — Persistent Memory CLI

## Overview
A Node.js CLI tool that provides persistent fact-based memory for an AI assistant (Brokkr). Stores structured facts in SQLite and can export them for injection into LLM sessions.

## Architecture
- **Runtime:** Node.js (ES modules)
- **Database:** SQLite via better-sqlite3
- **CLI framework:** commander
- **Install:** `npm install -g` so `brokkr-mem` is available system-wide

## Database Schema

```sql
CREATE TABLE facts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,      -- person, project, preference, decision, lesson, environment, tool
  key TEXT NOT NULL,            -- unique identifier within category (e.g. "cory.son.name")
  value TEXT NOT NULL,          -- the actual fact
  source TEXT,                  -- where this fact came from (session file, manual, etc.)
  confidence REAL DEFAULT 1.0, -- 0.0-1.0, how confident we are
  created TEXT NOT NULL,        -- ISO timestamp
  updated TEXT NOT NULL,        -- ISO timestamp
  UNIQUE(category, key)        -- no duplicate facts
);

CREATE INDEX idx_facts_category ON facts(category);
CREATE INDEX idx_facts_key ON facts(key);
CREATE INDEX idx_facts_updated ON facts(updated);
```

## CLI Commands

### `brokkr-mem add <category> <key> <value> [--source <source>] [--confidence <0-1>]`
Add or update a fact. If category+key exists, updates the value and timestamp.

### `brokkr-mem get <category> [key]`
Get facts. If key provided, get specific fact. If only category, list all in category.

### `brokkr-mem search <query>`
Full-text search across all fact keys and values. Case-insensitive.

### `brokkr-mem list [--category <cat>] [--limit <n>] [--recent]`
List facts, optionally filtered. --recent sorts by updated desc.

### `brokkr-mem remove <category> <key>`
Delete a specific fact.

### `brokkr-mem inject [--max <n>] [--output <file>]`
Generate a markdown facts file for LLM injection. Groups by category, caps at --max facts (default 100). If --output provided, writes to file; otherwise stdout.

Output format:
```markdown
# Known Facts

## People
- **Cory**: Son is Liam (Discord: Leefree09, ID: 1141561338074779730)
- **Cory**: Works at TurnKey Network Solutions (TKNS) — tkns.net
- **Cory**: Discord accounts — main (109711231836749824) and alt Bobsy (_bobloblaw)

## Projects
- **cad-wiki**: TKNS CAD standards knowledge base. Live: cad-wiki.vercel.app
- **whattimeisitin**: Timezone site, 159+ pages. Preview port 3003.

## Preferences
- **planning**: Likes structured roadmaps, task lists, methodical approaches
- **communication**: Match his tone, don't over-explain

## Lessons
- **gateway-restart**: NEVER restart openclaw-gateway from own session
- **echo-vs-printf**: printf > echo when piping to vercel env add

## Environment
- **host**: brokkr (Linux 6.17.0-14-generic x64)
- **local-models**: Ollama — deepseek-r1:8b, qwen3:8b
```

### `brokkr-mem extract <file> [--dry-run]`
Extract facts from a session memory markdown file using Ollama (qwen3:8b).
- Reads the file
- Sends to Ollama with a prompt to extract structured facts
- Parses the response into category/key/value triples
- Adds to DB (updates existing, adds new)
- --dry-run shows what would be added without writing

The Ollama prompt should ask for JSON output:
```json
[
  { "category": "person", "key": "cory.son.name", "value": "Liam" },
  { "category": "project", "key": "cad-wiki.status", "value": "Live at cad-wiki.vercel.app" }
]
```

### `brokkr-mem import <file>`
Bulk import facts from a JSON file.

### `brokkr-mem export [--format json|md]`
Export all facts as JSON or markdown.

### `brokkr-mem stats`
Show counts by category, total facts, DB size, last updated.

### `brokkr-mem prune [--before <date>] [--confidence-below <n>]`
Remove old or low-confidence facts.

## DB Location
`~/.openclaw/memory.db` — inside the OpenClaw config dir, not the workspace (so it doesn't get injected as text).

## Package Setup
```json
{
  "name": "brokkr-mem",
  "version": "1.0.0",
  "type": "module",
  "bin": { "brokkr-mem": "./bin/cli.js" },
  "dependencies": {
    "better-sqlite3": "latest",
    "commander": "latest"
  }
}
```

## Rules
1. Use ES modules throughout (import/export, not require)
2. Clean error messages, no stack traces for user errors
3. Colorized output for terminal (use simple ANSI codes, no chalk dependency)
4. All timestamps in UTC ISO format
5. The `extract` command must work with `ollama run qwen3:8b` — use HTTP API at localhost:11434
6. Make it fast — better-sqlite3 is synchronous, use that to advantage
7. Test that all commands work before committing

## Completion
1. `npm install -g .` must work
2. All commands must function
3. Git commit: "feat: brokkr-mem CLI — persistent fact memory with SQLite"
4. Run: `openclaw system event --text "Done: brokkr-mem CLI built — add/search/inject/extract facts" --mode now`
