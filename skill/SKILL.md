# Rune - Persistent AI Memory System

**Rune** gives your OpenClaw agent persistent, intelligent memory that gets better over time. No more burning tokens on static context files or forgetting important information between sessions.

## What Rune Does

### 🧠 Smart Memory Management
- **Dynamic Context Injection**: AI selects only relevant facts for each conversation  
- **Access Pattern Learning**: Frequently used facts get prioritized
- **Forgetting Curves**: Unused facts naturally fade like human memory
- **Memory Consolidation**: Similar facts get merged, verbose ones compressed

### 🎯 Session Intelligence  
- **Interaction Style Detection**: Learns if you prefer brainstorm vs deep-work vs debug modes
- **Behavioral Pattern Analysis**: Tracks your work patterns and preferences over time
- **Proactive Memory**: Volunteers relevant context unprompted ("last time you worked on this...")

### 📋 Project Autopilot
- **Smart Task Recommendations**: "What should I work on next?" with priority scoring
- **Blocker Detection**: Identifies stuck projects that need intervention  
- **Project Health Scoring**: 0.0-1.0 health scores based on activity and progress

### 📢 Intelligent Notifications
- **Priority Classification**: Critical/High/Medium/Low/FYI with context analysis
- **Smart Timing**: Respects quiet hours, batches low-priority updates
- **Channel Routing**: DM for urgent, Discord for projects, digest for FYI

### 🔄 Self-Improvement Loop
- **Pattern Detection**: "Forgot to use X skill 3 times" → automatic escalation
- **Performance Tracking**: Measurable improvement over time
- **Skill Usage Analysis**: Which skills you use vs neglect

## Installation

```bash
# Via ClawHub (coming soon)
clawhub install rune

# Manual installation
git clone https://github.com/your-org/brokkr-mem
cd brokkr-mem
npm install -g .
```

## Quick Start

```bash
# Initialize memory system
brokkr-mem stats

# Add your first fact
brokkr-mem add person cory.name "Cory - my human user"

# Generate context for a conversation  
brokkr-mem context "Let's work on the website"

# Get task recommendations
brokkr-mem next-task

# Weekly self-review
brokkr-mem self-review --days 7
```

## Core Commands

### Memory Management
- `brokkr-mem add <category> <key> <value>` - Store a fact
- `brokkr-mem search <query>` - Find facts
- `brokkr-mem recall <topic>` - Smart multi-source recall  
- `brokkr-mem inject` - Generate context file for agent

### Intelligence Features  
- `brokkr-mem context <message>` - Dynamic context for message
- `brokkr-mem score <message>` - Relevance scoring  
- `brokkr-mem proactive <message>` - Volunteer relevant context
- `brokkr-mem session-style <message>` - Detect interaction style

### Project Management
- `brokkr-mem project-state <name>` - Track project phases/blockers
- `brokkr-mem next-task` - Smart task picker
- `brokkr-mem stuck-projects` - Find blocked work

### Advanced Features
- `brokkr-mem temporal "last Tuesday"` - Time-based queries  
- `brokkr-mem consolidate` - Memory optimization
- `brokkr-mem forget` - Apply forgetting curves
- `brokkr-mem pattern-analysis` - Detect behavioral patterns

## Integration with OpenClaw

### Heartbeat Integration
Add to your `HEARTBEAT.md`:

```bash
# Memory maintenance
brokkr-mem expire && brokkr-mem inject --output ~/.openclaw/workspace/FACTS.md

# Proactive work selection
NEXT_TASK=$(brokkr-mem next-task --json)
if [[ "$NEXT_TASK" != "null" ]]; then
  # Work on the recommended task
fi
```

### Session Hooks
Add to your agent startup:

```bash
# Load dynamic context
brokkr-mem recall "$(echo $MESSAGE | head -c 100)"

# Track session style
brokkr-mem session-style "$MESSAGE" --save --session-id "$SESSION_ID"
```

## Architecture

- **SQLite Database**: All memory stored in `~/.openclaw/memory.db`
- **Local LLM Integration**: Ollama for relevance scoring and extraction
- **Cloud API Support**: Anthropic, OpenAI for advanced reasoning
- **Local-First Design**: Works completely offline with Ollama (cloud APIs optional for advanced features)

## Memory Categories

- **person**: Information about people (names, roles, preferences)
- **project**: Project status, phases, decisions
- **tool**: How to use tools and their quirks  
- **lesson**: Mistakes to avoid, best practices
- **decision**: Why certain choices were made
- **preference**: User likes/dislikes, settings
- **environment**: System configs, non-sensitive settings (⚠️ NEVER store credentials!)

## ⚠️ Security & Privacy

**What Rune Stores:**
- Facts you explicitly add via `brokkr-mem add`
- Session interaction patterns for learning (conversation style, not content)
- Project states and task recommendations

**What Rune Does NOT Store (by default):**
- Full conversation transcripts (unless you run `extract` manually)
- API keys or credentials (use environment variables instead)
- Sensitive personal information (unless you explicitly add it)

**Cloud API Usage:**
- **Optional**: Rune can use OpenAI/Anthropic APIs for fact extraction and scoring
- **Local-first**: Works completely offline with Ollama (recommended)
- **Your choice**: Configure which engines to use in your setup

**Privacy Best Practices:**
- Never run `brokkr-mem add` with sensitive data (passwords, API keys, personal info)
- Use `brokkr-mem extract` carefully - review files before extracting facts
- Configure Ollama for local-only operation if you want zero cloud usage
- Review your `~/.openclaw/workspace/FACTS.md` periodically

**Installation Changes:**
- Adds memory maintenance commands to `HEARTBEAT.md` (if present)
- Creates `~/.openclaw/memory.db` database file
- Session hooks may process conversation metadata (not full content) for learning

## Performance Metrics

With Rune, your agent will:
- ✅ Remember context between sessions without burning tokens
- ✅ Pick relevant facts dynamically vs dumping everything
- ✅ Get measurably better at avoiding repeated mistakes  
- ✅ Work autonomously on projects between check-ins
- ✅ Learn your interaction patterns and adapt responses

## Advanced Configuration

```bash
# Tune relevance scoring
brokkr-mem score "your query" --threshold 0.6 --model llama3.1:8b

# Configure forgetting curves  
brokkr-mem forget --decay-rate 0.03 --grace-days 45

# Cross-session pattern analysis
brokkr-mem cross-session --days 90 --min-sessions 5
```

## Automated Maintenance & Performance

Rune performs best with regular maintenance. Here are automation strategies:

### Cron Job Setup

**Daily Maintenance (3 AM)**
```bash
# Expire working memory and regenerate context
0 3 * * * /usr/local/bin/brokkr-mem expire && /usr/local/bin/brokkr-mem inject --output ~/.openclaw/workspace/FACTS.md
```

**Weekly Optimization (Sunday 2 AM)**  
```bash
# Consolidate memory and run self-review
0 2 * * 0 /usr/local/bin/brokkr-mem consolidate --auto-prioritize && /usr/local/bin/brokkr-mem self-review --days 7
```

**Monthly Deep Clean (1st of month, 1 AM)**
```bash
# Pattern analysis and database optimization
0 1 1 * * /usr/local/bin/brokkr-mem pattern-analysis --days 30 && sqlite3 ~/.openclaw/memory.db "VACUUM; ANALYZE;"
```

### Database Backup
```bash
# Daily backup at 4 AM
0 4 * * * cp ~/.openclaw/memory.db ~/.openclaw/memory.db.backup.$(date +\%Y\%m\%d)
# Keep last 7 days
5 4 * * * find ~/.openclaw -name "memory.db.backup.*" -mtime +7 -delete
```

### Performance Benefits
- **🧹 Memory stays lean**: Auto-removes expired facts
- **⚡ Faster queries**: Regular consolidation prevents bloat
- **📈 Self-improvement**: Pattern detection catches recurring issues  
- **🔄 Current context**: FACTS.md regenerated with latest data
- **💾 Data protection**: Automated backups prevent loss

### Memory Health Monitoring
```bash
# Check database size and fact count
brokkr-mem stats

# Review recent patterns
brokkr-mem pattern-analysis --days 7

# Check consolidation opportunities  
brokkr-mem consolidate --dry-run
```

## Troubleshooting

**Memory growing too large?**
- Run `brokkr-mem consolidate` to merge similar facts
- Use `brokkr-mem forget` to apply forgetting curves  
- Check `brokkr-mem stats` for database size

**Relevance scoring not working?**
- Ensure Ollama is running: `systemctl status ollama`
- Test model: `brokkr-mem score "test" --engine ollama`
- Fall back to anthropic/openai engines

**Context injection too verbose?**
- Lower relevance threshold: `--threshold 0.6`  
- Use token budgeting: `brokkr-mem budget "query" --tokens 300`

## Contributing

Rune is open source. Contributions welcome:
- **Memory Science**: Better consolidation algorithms, forgetting curves
- **LLM Integration**: New scoring engines, extraction methods
- **UI/UX**: Better command interfaces, visualization tools
- **Performance**: Speed optimizations, memory efficiency

## License

MIT License - Use freely, modify as needed.

---

*Rune: Because your AI should remember like you do.*