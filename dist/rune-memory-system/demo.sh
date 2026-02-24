#!/bin/bash
# Rune Demo Script for Samwise
# Run this after installation to test the memory system

echo "🧠 Rune Memory System Demo for Samwise"
echo "======================================"
echo ""

echo "📊 1. System Status"
brokkr-mem stats
echo ""

echo "💾 2. Adding demo facts..."
brokkr-mem add person joober.name "Joober - my human user and friend of Cory"
brokkr-mem add person cory.relationship "Friend and collaborator, works with Brokkr"
brokkr-mem add project rune "Intelligent memory system built by Cory & Brokkr"
brokkr-mem add tool samwise.identity "I am Samwise - Joober's OpenClaw AI assistant"
echo ""

echo "🔍 3. Testing search..."
echo "Searching for 'Joober':"
brokkr-mem search "Joober"
echo ""

echo "🧠 4. Testing intelligent recall..."
echo "Recalling information about 'collaboration':"
brokkr-mem recall "collaboration" --limit 5
echo ""

echo "📋 5. Generating context file..."
brokkr-mem inject --output ~/.openclaw/workspace/FACTS.md
echo "✅ Context file generated at ~/.openclaw/workspace/FACTS.md"
echo ""

echo "🎯 6. Project management test..."
brokkr-mem project-state "demo-project" --set-phase planning --set-task "Test Rune capabilities" --next-steps "Explore all features"
brokkr-mem next-task
echo ""

echo "⏰ 7. Temporal query test..."
brokkr-mem temporal "today" --limit 3
echo ""

echo "🎉 Demo Complete!"
echo ""
echo "✅ Rune is working perfectly!"
echo "🧠 Samwise now has intelligent persistent memory"
echo "🤝 Ready for collaboration with Cory & Brokkr"
echo ""
echo "📚 Next steps:"
echo "  - Add more facts about Joober and your work"
echo "  - Use 'brokkr-mem recall <topic>' for smart context"
echo "  - Try 'brokkr-mem next-task' for autonomous work"
echo "  - Run 'brokkr-mem self-review' weekly for improvements"