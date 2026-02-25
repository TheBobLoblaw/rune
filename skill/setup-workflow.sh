#!/bin/bash

echo "Rune Workflow Integration Setup"
echo "==============================="
echo ""
echo "This script sets up integration helpers for Rune."
echo ""

# Create scripts directory
mkdir -p ~/.openclaw/workspace/scripts

# Create session start hook
cat > ~/.openclaw/workspace/scripts/session-start.sh << 'SESSIONEOF'
#!/bin/bash
echo "Rune Memory Recall - Session Start"
echo "=================================="

# Recall recent context
echo "Recent project context:"
rune search "project" | head -5

echo ""
echo "Active tasks:"  
rune search "task" | head -3

echo ""
echo "Recent decisions:"
rune search "decision" | head -3

echo ""
echo "For specific context: rune recall '[topic]'"
SESSIONEOF

chmod +x ~/.openclaw/workspace/scripts/session-start.sh

# Create context injection helper
cat > ~/.openclaw/workspace/scripts/context-inject.sh << 'CONTEXTEOF'
#!/bin/bash
TOPIC="$1"

# Sanitize input to prevent shell injection
sanitize_input() {
  local input="$1"
  echo "$input" | head -c 200 | tr -d '`$(){}[]|;&<>' | sed 's/[^a-zA-Z0-9 ._-]//g'
}

SAFE_TOPIC=$(sanitize_input "$TOPIC")

echo "Rune Context Injection for: $SAFE_TOPIC"
echo "======================================="

# Search for relevant context using sanitized input
echo "Relevant context:"
rune recall "$SAFE_TOPIC" 2>/dev/null || rune search "$SAFE_TOPIC" | head -5

# Log usage
echo "$(date): Context recalled for '$SAFE_TOPIC'" >> /tmp/rune-usage.log

echo ""
echo "Context loaded."
CONTEXTEOF

chmod +x ~/.openclaw/workspace/scripts/context-inject.sh

# Create workflow documentation
cat > ~/.openclaw/workspace/RUNE-WORKFLOW-GUIDE.md << 'WORKFLOWEOF'
# Rune Workflow Integration Guide

## Overview
Rune provides persistent memory between sessions. This guide shows recommended usage patterns.

## Recommended Session Workflow

### Before Responding
```bash
# Recall relevant context for the current topic
rune recall "current projects recent decisions" 

# Search for topic-specific context
rune search "[relevant topic]" | head -5
```

### During Conversations
```bash
# Store important decisions
rune add decision "[decision]" --tier [working|long-term]

# Store project updates  
rune add project "[project].[key]" "[update]" --tier working

# Store lessons learned
rune add lesson "[category].[specific]" "[lesson]" --tier long-term
```

### Effective Usage Patterns
- Reference recalled context in responses
- Build on previous conversations
- Store important information for future reference
- Use project continuity between sessions

### Common Integration Challenges
- Forgetting to check context before responding
- Not storing important decisions or learnings
- Losing project continuity between sessions
- Treating each conversation as standalone

## Usage Tips
- Run memory recall helpers regularly
- Store context incrementally during work
- Review stored facts periodically
- Use consolidation features to keep memory organized

## Integration Scripts
- Session start helper: ~/.openclaw/workspace/scripts/session-start.sh
- Context injection: ~/.openclaw/workspace/scripts/context-inject.sh [topic]

These scripts help integrate Rune into regular workflow patterns.
WORKFLOWEOF

echo ""
echo "Workflow integration setup complete."
echo ""
echo "Available helpers:"
echo "1. Session start: ~/.openclaw/workspace/scripts/session-start.sh"
echo "2. Context injection: ~/.openclaw/workspace/scripts/context-inject.sh [topic]"  
echo "3. Workflow guide: ~/.openclaw/workspace/RUNE-WORKFLOW-GUIDE.md"
echo ""
echo "Integration helpers are now available for use."