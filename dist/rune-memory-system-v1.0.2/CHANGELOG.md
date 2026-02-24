# Changelog

All notable changes to Rune (Self-Improving AI Memory System) will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.2] - 2026-02-24

### 🔒 SECURITY

**CRITICAL SECURITY FIX** - CVE-2026-0001

#### Fixed
- **Shell injection vulnerability** in session hooks that allowed remote code execution
- Direct use of unsanitized `$MESSAGE` variable in `brokkr-mem` commands
- Potential for arbitrary command execution through crafted user input

#### Added
- **Secure session handler** (`rune-session-handler.sh`) with comprehensive input sanitization
- Input length limits and dangerous character filtering
- Safe command execution patterns throughout
- Security documentation and usage guidance

#### Changed
- Session hooks now use secure wrapper instead of direct command execution
- `sessionStart` and `sessionEnd` hooks route through sanitization layer
- Updated SKILL.md with security best practices and warnings

#### Security Details
```bash
# BEFORE (Vulnerable):
"sessionStart": {"commands": ["brokkr-mem recall \"$MESSAGE\" --limit 10"]}

# AFTER (Secure):  
"sessionStart": {"commands": ["./rune-session-handler.sh start"]}
```

**Attack Vector**: Malicious input like `test"; rm -rf /; echo "hacked` could execute arbitrary commands
**Impact**: Complete system compromise possible
**Fix**: All user input now sanitized before shell execution

---

## [1.0.1] - 2026-02-24

### Added
- Enhanced extraction engine with multi-format support
- Session-aware context injection
- Improved fact consolidation algorithms
- Autonomous task detection and recommendations

### Changed
- Optimized memory retrieval performance
- Enhanced CLI usability and error handling
- Improved fact scoring accuracy

### Fixed
- Memory consolidation edge cases
- CLI argument parsing improvements

---

## [1.0.0] - 2026-02-23

### Added
- **Initial Release** - Self-Improving AI Memory System
- SQLite-based persistent memory storage
- Local-first design with Ollama integration
- Intelligent fact extraction and scoring
- Session-aware context management
- CLI tools: `brokkr-mem` and `rune`
- OpenClaw skill integration
- Heartbeat maintenance automation
- Memory categories: person, project, tool, lesson, decision, preference
- Local and cloud LLM support (Ollama, OpenAI, Anthropic)

### Features
- **Intelligent Storage**: Facts auto-categorized and scored for relevance
- **Smart Retrieval**: Semantic and keyword search with LLM ranking
- **Self-Improvement**: System learns from usage patterns and adapts
- **Privacy-First**: Works completely offline with local models
- **Agent Integration**: Designed for AI orchestration workflows

### Security
- No credential storage in memory database
- Local-first processing for privacy
- Optional cloud API integration
- Transparent data handling