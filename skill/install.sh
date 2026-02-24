#!/bin/bash
set -e

echo "🧠 Installing Rune - Persistent AI Memory System..."

# Check Node.js version
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required but not installed. Please install Node.js >= 18.0.0"
    exit 1
fi

NODE_VERSION=$(node --version | sed 's/v//')
REQUIRED_VERSION="18.0.0"

# Simple version check without semver dependency
NODE_MAJOR=$(echo $NODE_VERSION | cut -d. -f1)
REQUIRED_MAJOR=18

if [ "$NODE_MAJOR" -lt "$REQUIRED_MAJOR" ]; then
    echo "❌ Node.js >= $REQUIRED_VERSION is required. Current version: $NODE_VERSION"
    exit 1
fi

# Install npm dependencies
echo "📦 Installing dependencies..."
npm install --production

# Install CLI globally
echo "🔧 Installing brokkr-mem CLI..."
npm install -g .

# Create memory database directory
MEMORY_DIR="$HOME/.openclaw"
mkdir -p "$MEMORY_DIR"

# Initialize database
echo "🗄️ Initializing memory database..."
brokkr-mem stats > /dev/null 2>&1

# Check for Ollama (optional)
if command -v ollama &> /dev/null; then
    echo "✅ Ollama detected - local scoring will be available"
    
    # Check if required model is available
    if ollama list | grep -q "llama3.1:8b"; then
        echo "✅ llama3.1:8b model found"
    else
        echo "⚠️  Recommended model llama3.1:8b not found"
        echo "   Install with: ollama pull llama3.1:8b"
    fi
else
    echo "⚠️  Ollama not detected - will use cloud APIs for scoring"
    echo "   Install Ollama for local/free relevance scoring"
fi

# Create example heartbeat integration
HEARTBEAT_FILE="$HOME/.openclaw/workspace/HEARTBEAT.md"
if [[ -f "$HEARTBEAT_FILE" ]]; then
    echo "📝 Adding Rune to existing HEARTBEAT.md..."
    
    if ! grep -q "brokkr-mem" "$HEARTBEAT_FILE"; then
        echo "" >> "$HEARTBEAT_FILE"
        echo "## 🧠 Rune Memory Maintenance" >> "$HEARTBEAT_FILE"
        echo '- `brokkr-mem expire` — prune expired working memory' >> "$HEARTBEAT_FILE"
        echo '- `brokkr-mem inject --output ~/.openclaw/workspace/FACTS.md` — update context file' >> "$HEARTBEAT_FILE"
        echo '- `brokkr-mem consolidate --auto-prioritize` — optimize memory (weekly)' >> "$HEARTBEAT_FILE"
    fi
fi

# Create initial facts
echo "📋 Creating initial facts..."
brokkr-mem add system rune.installed "$(date -Iseconds)" --tier permanent
brokkr-mem add system rune.version "1.0.0" --tier permanent

echo ""
echo "✅ Rune installation complete!"
echo ""
echo "🚀 Quick start:"
echo "   brokkr-mem add person your_name 'Your Name - the human user'"
echo "   brokkr-mem context 'I want to work on a project'"
echo "   brokkr-mem stats"
echo ""
echo "📚 Full documentation: brokkr-mem --help"
echo "🔄 Memory maintenance will run automatically via heartbeats"
echo ""
echo "🧠 Your AI now has persistent memory that gets smarter over time!"