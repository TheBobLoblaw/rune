# Rune Extraction Engine — T-003 + T-010

## Goal
Build the `brokkr-mem extract` command that reads session transcripts / markdown files and uses Ollama to extract structured facts, decisions, action items, and session summaries.

## How `extract` Works

### Input
A markdown file — either a session transcript (from session-memory hook), a daily note, or any .md file.

### Process
1. Read the file content
2. Send to Ollama (qwen3:8b) via HTTP API at localhost:11434
3. Parse the structured JSON response
4. Deduplicate against existing facts in DB
5. Add new facts, update changed ones
6. Log what was extracted

### Ollama Prompt
The extraction prompt should ask the model to return JSON:

```
You are a fact extraction system. Read the following conversation transcript and extract structured facts.

Return a JSON array of facts. Each fact has:
- category: one of "person", "project", "preference", "decision", "lesson", "environment", "tool", "task"
- key: dot-notation unique identifier (e.g. "cory.son.name", "cad-wiki.status", "deploy.lesson")
- value: the fact as a concise string
- scope: "global" (always relevant) or "project" (only relevant to a specific project)
- tier: "long-term" (durable fact) or "working" (temporary, current task state)
- source_type: "user_said" (user explicitly stated), "inferred" (derived from context), "tool_output" (from a tool result)
- confidence: 0.0-1.0 (how certain this fact is)
- ttl: null for long-term, or "24h"/"7d" for working memory

Also extract a session summary:
- decisions: list of decisions made in this conversation
- open_questions: unresolved questions or uncertainties
- action_items: things that need to be done
- topics: topic tags for this session

Example output:
{
  "facts": [
    { "category": "person", "key": "cory.son.name", "value": "Liam", "scope": "global", "tier": "long-term", "source_type": "user_said", "confidence": 1.0, "ttl": null },
    { "category": "project", "key": "cad-wiki.editor", "value": "Using TipTap WYSIWYG with markdown export", "scope": "project", "tier": "long-term", "source_type": "inferred", "confidence": 0.9, "ttl": null },
    { "category": "task", "key": "current.rune-build", "value": "Building Rune schema upgrade", "scope": "global", "tier": "working", "source_type": "inferred", "confidence": 0.8, "ttl": "24h" }
  ],
  "session_summary": {
    "decisions": ["Chose TipTap over Slate for wiki editor", "Named memory system 'Rune'"],
    "open_questions": ["How to handle image storage in wiki"],
    "action_items": ["Deploy cad-wiki to Vercel", "Restart gateway for session-memory hook"],
    "topics": ["cad-wiki", "rune", "persistent-memory", "editor"]
  }
}

IMPORTANT:
- Only extract genuinely useful facts, not noise
- Prefer "user_said" source_type for things the user explicitly stated
- Use dot-notation keys that are descriptive: "project-name.aspect" format
- If a fact already likely exists (common knowledge about the setup), give it lower confidence
- Working memory tier is for current task state that will be stale in 24h
- Long-term tier is for durable facts that will be useful weeks from now
- Be conservative — fewer high-quality facts > many low-quality ones

Here is the conversation transcript:
```

### Deduplication Logic
Before adding a fact:
1. Search existing facts by category + key
2. If exact match exists with same value → skip (bump last_verified timestamp)
3. If match exists with DIFFERENT value → update value, log the change, set updated timestamp
4. If no match → insert new fact

### Session Summary Storage
Store session summaries as special facts:
- category: "session"
- key: "summary.YYYY-MM-DD-HH-MM" (timestamp-based)
- value: JSON stringified summary object
- tier: "long-term"
- scope: "global"

### CLI Interface

```
brokkr-mem extract <file> [options]
  --dry-run          Show what would be extracted without writing
  --model <model>    Ollama model to use (default: qwen3:8b)
  --verbose          Show full extraction prompt and response
```

### Batch Extract

```
brokkr-mem extract-all <directory> [options]
  --pattern <glob>   File pattern (default: "*.md")
  --since <date>     Only files modified after this date
  --dry-run          Show what would be extracted
```

### Working Memory Expiry

```
brokkr-mem expire
```
Delete all facts where tier=working and expires_at < now.
Run automatically during heartbeats.

## Technical Notes
- Ollama API: POST http://localhost:11434/api/generate with model and prompt
- Set temperature low (0.3) for consistent extraction
- Parse JSON from the response — handle markdown code fences the model might wrap it in
- Timeout: 60s per extraction (large transcripts)
- If Ollama is not running, print helpful error and exit
- The extract command should work on any .md file, not just session transcripts
- Chunk very large files (>10K words) into sections and extract from each

## Completion
1. `brokkr-mem extract`, `brokkr-mem extract-all`, `brokkr-mem expire` all work
2. Dry-run mode shows clean output of what would be extracted
3. Deduplication works correctly
4. Session summaries stored properly
5. npm install -g . works
6. Git commit: "feat(rune): extraction engine — Ollama fact extraction, session autopsies, batch processing"
7. Run: openclaw system event --text "Done: Rune extraction engine — Ollama-powered fact extraction with dedup, session summaries, batch mode" --mode now
