# Rune &#x16B1; — Persistent AI Memory System

[![GitHub stars](https://img.shields.io/github/stars/TheBobLoblaw/rune?style=social)](https://github.com/TheBobLoblaw/rune)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![ClawHub](https://img.shields.io/badge/ClawHub-rune-blue)](https://clawhub.com/skills/rune)

> *Named after Norse runes — knowledge carved in stone.*

**Persistent memory system for AI assistants using SQLite storage and intelligent context injection.**

Enables context continuity between sessions, fact storage and retrieval, and project state tracking for OpenClaw agents.

**Available on ClawHub** | **Production-tested** | **Local-first design**

## Overview

**Problem:** AI assistants lose context between sessions and waste tokens on irrelevant information.  
**Solution:** Persistent fact storage with intelligent retrieval and adaptive context injection.

### Key Features
- Significant reduction in context token usage
- Persistent memory across sessions
- Pattern learning and mistake prevention
- Autonomous task management capabilities
- Production-tested with extensive fact bases
- Memory consolidation and temporal queries

### Use Cases
- AI assistant developers building persistent agents
- OpenClaw users wanting memory continuity
- Productivity tools requiring context awareness
- Research applications exploring AI memory systems
- Team environments needing shared AI knowledge bases

## Features

- **Fact Storage** — Structured key-value facts with categories, confidence scores, scopes, and tiers
- **Full-Text Search** — FTS5-powered instant search across all facts
- **Auto-Extraction** — Extract facts from markdown session files using Ollama, Anthropic, or OpenAI
- **Adaptive Context** — Dynamically inject relevant facts into LLM prompts with token budgets
- **Session Intelligence** — Detect interaction styles, analyze patterns, proactive recall
- **Project Autopilot** — Track project states, suggest next tasks, detect stuck projects
- **Smart Notifications** — Classify, batch, and queue notifications for optimal timing
- **Pattern Analysis** — Weekly self-review, pattern analysis, skill usage tracking
- **Memory Consolidation** — Auto-merge duplicates, compress, and re-prioritize facts

## Quick Start

```bash
# Install globally
npm install -g .

# Add facts
rune add person cory.name "Cory"
rune add project myapp "React dashboard, deployed on Vercel"

# Search facts
rune search "Cory"

# Extract facts from session files
rune extract memory/2026-02-23.md

# Generate context for LLM injection
rune inject --output FACTS.md

# Score facts for relevance to a query
rune context "what projects are active?"

# Consolidate and clean up
rune consolidate --auto-prioritize
rune expire  # remove expired working memory
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
| `self-review` | Weekly improvement review |
| `pattern-analysis` | Detect repetitive patterns |
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
- `rune expire` — prune expired working memory
- `rune inject --output ~/.openclaw/workspace/FACTS.md` — regenerate context
- `rune consolidate --auto-prioritize` — optimize memory (weekly)
```

## Automated Maintenance & Cron Jobs

For optimal performance, Rune benefits from regular maintenance. Here are recommended automation schedules:

### Daily Maintenance
```bash
# Add to crontab: crontab -e
# Daily at 3 AM - expire old working memory and regenerate context
0 3 * * * /usr/local/bin/rune expire && /usr/local/bin/rune inject --output ~/.openclaw/workspace/FACTS.md
```

### Weekly Maintenance  
```bash
# Weekly on Sunday at 2 AM - consolidate memory and self-review
0 2 * * 0 /usr/local/bin/rune consolidate --auto-prioritize && /usr/local/bin/rune self-review --days 7
```

### Monthly Deep Cleaning
```bash
# First day of month at 1 AM - pattern analysis and optimization
0 1 1 * * /usr/local/bin/rune pattern-analysis --days 30 && sqlite3 ~/.openclaw/memory.db "VACUUM; ANALYZE;"
```

### Database Backup (Recommended)
```bash
# Daily at 4 AM - backup memory database
0 4 * * * cp ~/.openclaw/memory.db ~/.openclaw/memory.db.backup.$(date +\%Y\%m\%d)
# Keep only last 7 days of backups
5 4 * * * find ~/.openclaw -name "memory.db.backup.*" -mtime +7 -delete
```

### Benefits of Automation
- **Memory optimization**: Removes expired facts automatically
- **Performance maintenance**: Regular consolidation prevents database bloat  
- **Pattern learning**: Self-review enables continuous improvement
- **Context freshness**: Ensures FACTS.md stays current with latest facts
- **Data protection**: Regular backups prevent memory loss

## Installation

### ClawHub (Recommended)
```bash
clawhub install rune
```

### Manual Installation
```bash
git clone https://github.com/TheBobLoblaw/rune.git
cd rune
npm install -g .
```

### As OpenClaw Skill
```bash
# Install as skill
./skill/install.sh

# Or copy the complete distribution package
tar -xzf rune-memory-system-v1.0.0.tar.gz
cd rune-memory-system && ./skill/install.sh
```

## Contributing

**Open Source Project** — Built by [Cory & Brokkr](https://github.com/TheBobLoblaw) for the OpenClaw ecosystem.

Contributions welcome:
- Bug fixes and feature improvements
- Documentation enhancements
- LLM integration additions
- Performance optimizations

## License

MIT — Free for personal and commercial use

---

## Comparison with Other Solutions

| Feature | Static Memory Files | Vector Databases | **Rune** |
|---------|-------------------|------------------|-----------|
| **Setup Complexity** | Manual | High | Zero-config |
| **Token Efficiency** | Poor (loads everything) | Medium | Excellent |
| **Pattern Learning** | None | None | ✅ Available |
| **Context Relevance** | Static | Query-based | Dynamic + scored |
| **Temporal Queries** | None | Limited | ✅ Supported |
| **Project Management** | None | None | ✅ Built-in |
| **Local-First** | ✅ | Depends | ✅ SQLite + optional cloud |
| **Production Ready** | Manual | Complex | ✅ Battle-tested |

## User Feedback

> *"Rune transformed my AI from forgetting everything to having persistent memory with significant token savings. Essential for project work."*

> *"The autonomous task picking means I can delegate real work and it gets done. Very useful."*

> *"Best feature: never having to explain the same context twice. The AI just remembers."*

## Keywords
`ai-memory` `persistent-storage` `context-injection` `sqlite` `ollama` `openai` `anthropic` `project-management` `autonomous-agents` `memory-consolidation` `pattern-learning` `openclaw` `local-first` `production-ready`

## Security Update v1.0.2
- Fixed shell injection vulnerability in session hooks
- Added input sanitization for all user input
- Implemented secure session handler

---

## Project Status: Production Ready

**Rune v1.1.3** is production-ready and actively deployed.

### Current Status
- ✅ **Memory System**: Fully functional
- ✅ **Security**: All vulnerabilities addressed
- ✅ **Integration**: Workflow tools implemented
- ✅ **Documentation**: Complete and accurate
- ✅ **Quality**: Production-tested and stable

### Key Benefits
- Persistent memory across AI sessions
- Intelligent context injection
- Pattern learning and improvement
- Project state tracking and management
- Local-first design with optional cloud features

**The memory system addresses context loss and token efficiency issues in AI assistant workflows.**

*Current version: v1.1.3*