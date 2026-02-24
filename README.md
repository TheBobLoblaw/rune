# Rune &#x16B1; — Persistent Memory for AI Assistants

> *Named after Norse runes — secret knowledge carved in stone.*

Rune is a persistent fact-based memory system built for [OpenClaw](https://github.com/openclaw/openclaw) AI assistants. It gives your assistant long-term memory that survives across sessions using SQLite + FTS5 full-text search.

## Features

- **Fact Storage** — Structured key-value facts with categories, confidence scores, scopes, and tiers
- **Full-Text Search** — FTS5-powered instant search across all facts
- **Auto-Extraction** — Extract facts from markdown session files using Ollama, Anthropic, or OpenAI
- **Adaptive Context** — Dynamically inject relevant facts into LLM prompts with token budgets
- **Session Intelligence** — Detect interaction styles, analyze patterns, proactive recall
- **Project Autopilot** — Track project states, suggest next tasks, detect stuck projects
- **Smart Notifications** — Classify, batch, and queue notifications for optimal timing
- **Self-Improvement** — Weekly self-review, pattern analysis, skill usage tracking
- **Memory Consolidation** — Auto-merge duplicates, compress, and re-prioritize facts

## Quick Start

```bash
# Install globally
npm install -g .

# Add a fact
brokkr-mem add person cory.name "Cory"
brokkr-mem add project myapp "React dashboard, deployed on Vercel"

# Search facts
brokkr-mem search "Cory"

# Extract facts from a session file
brokkr-mem extract memory/2026-02-23.md

# Generate context for LLM injection
brokkr-mem inject --output FACTS.md

# Score facts for relevance to a query
brokkr-mem context "what projects are active?"

# Consolidate and clean up
brokkr-mem consolidate --auto-prioritize
brokkr-mem expire  # remove expired working memory
```

## All Commands

| Command | Description |
|---------|-------------|
| `add <cat> <key> <value>` | Add or update a fact |
| `get <cat> [key]` | Get facts by category or key |
| `search <query>` | Full-text search |
| `remove <cat> <key>` | Delete a fact |
| `inject [--output file]` | Generate markdown for LLM context |
| `extract <file>` | Extract facts from markdown using LLM |
| `context <message>` | Dynamic context injection |
| `score <message>` | Score all facts for relevance |
| `budget <message>` | Generate context within token budget |
| `proactive <message>` | Volunteer relevant context unprompted |
| `remember <query>` | Search with natural language ("remember when...") |
| `session-style <message>` | Detect interaction style |
| `session-patterns [id]` | Analyze session patterns |
| `project-state [project]` | Track project states |
| `next-task` | Smart task picker |
| `stuck-projects` | Detect blocked projects |
| `notify <message>` | Classify and route notifications |
| `pending-notifications` | Show queued notifications |
| `digest` | Daily summary |
| `batch-send` | Send batched notifications |
| `self-review` | Weekly self-improvement review |
| `pattern-analysis` | Detect repetitive mistakes |
| `skill-usage` | Track skill usage |
| `consolidate` | Merge, compress, prioritize facts |
| `expire` | Remove expired working memory |
| `stats` | Show database stats |

## Architecture

- **Runtime:** Node.js (ES modules)
- **Database:** SQLite via better-sqlite3 with FTS5
- **LLM Engines:** Ollama (local), Anthropic, OpenAI (for extraction)
- **DB Location:** `~/.openclaw/memory.db`

### Fact Schema

Each fact has:
- **category** — person, project, preference, decision, lesson, environment, tool
- **key** — unique identifier (e.g., `cory.son.name`)
- **value** — the actual fact
- **confidence** — 0.0-1.0
- **scope** — global or project
- **tier** — working (TTL-based) or long-term
- **source_type** — manual, user_said, inferred

## Integration with OpenClaw

Add to your `HEARTBEAT.md`:
```markdown
## Memory Maintenance
- `brokkr-mem expire` — prune expired working memory
- `brokkr-mem inject --output ~/.openclaw/workspace/FACTS.md` — regenerate context
- `brokkr-mem consolidate --auto-prioritize` — optimize memory (weekly)
```

## Contributing

Built by [Brokkr](https://github.com/TheBobLoblaw) for the OpenClaw ecosystem. PRs welcome!

## License

MIT
