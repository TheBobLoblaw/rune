# Rune v1.0.2 - Security Update Package

## What's Included

### Core Components
- `bin/brokkr-mem` - Main CLI executable
- `skill/` - OpenClaw skill integration
- `README.md` - Full documentation
- `CHANGELOG.md` - Version history
- `SECURITY-ADVISORY.md` - Critical security fix details

### Installation Files
- `skill/install.sh` - Automated installation script
- `skill/uninstall.sh` - Clean removal script
- `skill/update.sh` - Version update script

### Security Components (NEW)
- `skill/rune-session-handler.sh` - Secure session hook wrapper
- Input sanitization throughout
- Enhanced security documentation

## Installation

### Quick Install
```bash
tar -xzf rune-memory-system-v1.0.2.tar.gz
cd rune-memory-system-v1.0.2/skill
chmod +x install.sh
./install.sh
```

### Manual Installation
1. Copy `bin/brokkr-mem` to your PATH
2. Install skill via OpenClaw: `openclaw skill install ./skill`
3. Verify: `brokkr-mem --version` should show v1.0.2

## Security Notes

### Critical Update Required
**This is a mandatory security update** that fixes CVE-2026-0001, a critical shell injection vulnerability. All users must update immediately.

### Verification
After installation, verify security fix:
```bash
brokkr-mem --version  # Should show 1.0.2
openclaw skill list | grep rune  # Should show 1.0.2
```

## Features
- Self-improving AI memory system
- Local-first design (works offline)
- SQLite + Ollama integration
- OpenClaw orchestration support
- Session-aware context injection
- **NEW**: Enterprise-grade security

## Requirements
- Node.js 18+
- SQLite3
- OpenClaw 2026.2.0+
- Optional: Ollama for local models

## Support
- Documentation: README.md
- Security Issues: See SECURITY-ADVISORY.md
- GitHub: https://github.com/TheBobLoblaw/rune

---
**Package Version**: 1.0.2  
**Release Date**: 2026-02-24  
**Security Level**: Fixed (CVE-2026-0001)
