---
name: rune
version: 1.1.6
description: Persistent AI memory system with intelligent context injection and adaptive learning
keywords: [persistent-memory, context-injection, project-management, sqlite, local-first]
homepage: https://github.com/TheBobLoblaw/rune
metadata: {"install":[{"id":"rune","kind":"script","script":"./install.sh","label":"Install Rune Memory System"}]}
---

# Rune - Persistent AI Memory System

**Rune** provides persistent memory for OpenClaw agents using SQLite storage, intelligent fact retrieval, and adaptive context injection.

## Features

### Memory Management
- **Dynamic Context Injection**: Selects relevant facts for each conversation  
- **Access Pattern Learning**: Prioritizes frequently used facts
- **Memory Consolidation**: Merges similar facts and compresses verbose ones
- **Temporal Queries**: Time-based fact retrieval

### Intelligence Features
- **Interaction Style Detection**: Learns conversation preferences over time
- **Behavioral Pattern Analysis**: Tracks work patterns and preferences
- **Proactive Memory**: Surfaces relevant context when appropriate

### Project Management
- **Task Recommendations**: Suggests next steps based on project state
- **Blocker Detection**: Identifies projects that need attention
- **Project Health Scoring**: Quantifies project progress and health

### Notification System
- **Priority Classification**: Categorizes notifications by importance
- **Smart Timing**: Respects user preferences for notification timing
- **Channel Routing**: Routes notifications to appropriate channels

## Naming Convention

- **Skill name**: `rune` (ClawHub package)
- **CLI command**: `rune` (terminal interface)
- **Project name**: Rune (overall system)

## Installation Requirements

### System Dependencies
- Node.js v18+ with npm
- SQLite3 (included via better-sqlite3 npm package)
- Optional: Ollama for local LLM features

### Installation Process
The installation process will:
- Create directories under `~/.openclaw/`
- Install the `rune` CLI globally via npm
- Create SQLite database at `~/.openclaw/memory.db`
- Modify existing `HEARTBEAT.md` if present

### Before Installing
- Back up important configuration files
- Review package.json dependencies if security is a concern
- Consider using local models (Ollama) instead of cloud APIs

## Installation Methods

```bash
# Via ClawHub (recommended)
clawhub install rune

# Manual installation
git clone https://github.com/TheBobLoblaw/rune
cd rune
npm install --production
npm install -g .
```

## Basic Usage

```bash
# Check system status
rune stats

# Add facts
rune add person cory.name "Cory - my human user"
rune add project website.status "In progress"

# Search facts
rune search "Cory"

# Generate context
rune context "Let's work on the website"

# Task management
rune next-task
rune project-state website

# Maintenance
rune consolidate
rune expire
```

## Core Commands

### Fact Management
- `rune add <category> <key> <value>` - Store a fact
- `rune get <category> [key]` - Retrieve facts
- `rune search <query>` - Full-text search
- `rune remove <category> <key>` - Delete facts

### Context Generation
- `rune context <message>` - Generate relevant context
- `rune inject` - Create context file
- `rune score <message>` - Score fact relevance
- `rune budget <message>` - Context within token limits

### Project Management
- `rune project-state <name>` - Track project status
- `rune next-task` - Get task recommendations
- `rune stuck-projects` - Find blocked projects

### Intelligence Features
- `rune session-style <message>` - Detect interaction style
- `rune pattern-analysis` - Analyze behavioral patterns
- `rune self-review` - Generate improvement insights

### Maintenance
- `rune consolidate` - Optimize memory storage
- `rune expire` - Remove expired facts
- `rune stats` - Show database statistics

## Architecture

- **Database**: SQLite with FTS5 full-text search
- **LLM Integration**: Supports Ollama (local), Anthropic, OpenAI
- **Storage Location**: `~/.openclaw/memory.db`
- **Context Output**: Generates markdown for LLM consumption

## Memory Categories

- **person**: Individual information (names, roles, preferences)
- **project**: Project status, phases, decisions
- **tool**: Tool usage patterns and configurations
- **lesson**: Learning from past experiences
- **decision**: Record of choices and reasoning
- **preference**: User settings and preferences
- **environment**: System configuration (non-sensitive only)

## Integration with OpenClaw

### Heartbeat Integration
Add these lines to `HEARTBEAT.md` for automated maintenance:

```markdown
## Memory Maintenance
- Memory expiration: `rune expire`
- Context regeneration: `rune inject --output ~/.openclaw/workspace/FACTS.md`
- Consolidation: `rune consolidate --auto-prioritize`
```

### Session Integration
The skill provides session hooks that integrate with OpenClaw's session lifecycle.

For manual integration, refer to the provided session handler scripts in the installation.

## Security & Privacy

### Data Storage
**What Rune Stores:**
- Facts explicitly added via commands
- Session interaction patterns (style, not content)
- Project states and task information

**What Rune Does NOT Store:**
- Full conversation transcripts (unless explicitly extracted)
- API keys or credentials
- Sensitive personal information (unless explicitly added)

### Security Measures
- Input sanitization for all user-provided data
- Parameterized database queries to prevent injection
- No execution of user-provided shell commands
- Session handlers validate and limit input

### Privacy Options
- **Local-only operation**: Use Ollama for complete offline functionality
- **Cloud API optional**: OpenAI/Anthropic APIs are optional for advanced features
- **Fact review**: Regular review of stored facts recommended
- **No credential storage**: Use environment variables for sensitive data

### Installation Security
- Review package.json dependencies before installation
- Installation runs standard npm lifecycle scripts
- Consider isolated environment for high-security deployments
- Session hooks process metadata only, not full content

## Automated Maintenance

### Recommended Cron Jobs

```bash
# Daily maintenance (3 AM)
0 3 * * * /usr/local/bin/rune expire && /usr/local/bin/rune inject --output ~/.openclaw/workspace/FACTS.md

# Weekly optimization (Sunday 2 AM)
0 2 * * 0 /usr/local/bin/rune consolidate --auto-prioritize && /usr/local/bin/rune self-review --days 7

# Monthly deep clean (1st of month, 1 AM)
0 1 1 * * /usr/local/bin/rune pattern-analysis --days 30 && sqlite3 ~/.openclaw/memory.db "VACUUM; ANALYZE;"

# Database backup (daily 4 AM)
0 4 * * * cp ~/.openclaw/memory.db ~/.openclaw/memory.db.backup.$(date +\%Y\%m\%d)
5 4 * * * find ~/.openclaw -name "memory.db.backup.*" -mtime +7 -delete
```

### Benefits of Automation
- Memory optimization prevents database bloat
- Regular fact consolidation improves query performance
- Pattern analysis enables continuous improvement
- Automated backups protect against data loss

## Performance Monitoring

```bash
# Check database health
rune stats

# Review consolidation opportunities
rune consolidate --dry-run

# Analyze patterns
rune pattern-analysis --days 7
```

## Troubleshooting

**Large database size:**
- Run `rune consolidate` to merge similar facts
- Use `rune expire` to remove old working memory
- Check `rune stats` for database metrics

**LLM integration issues:**
- Verify Ollama status: `systemctl status ollama`
- Test connectivity: `rune score "test" --engine ollama`
- Check API key configuration for cloud providers

**Context generation problems:**
- Adjust relevance threshold: `--threshold 0.6`
- Use token budgeting: `rune budget "query" --tokens 300`
- Review fact relevance with `rune score`

## Contributing

Rune welcomes contributions:
- **Algorithm improvements**: Better consolidation and scoring
- **LLM integrations**: Support for additional providers
- **Performance optimization**: Query and storage efficiency
- **Documentation**: Usage examples and guides

## License

MIT License

---

*Persistent memory for intelligent AI assistants.*