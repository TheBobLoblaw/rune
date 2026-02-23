# Rune Test & Benchmark Suite

## Goal
Build a comprehensive test and benchmark system for Rune that verifies correctness, measures extraction quality, and tracks improvement over time.

## Test Suite: `brokkr-mem test`

### 1. Unit Tests (`brokkr-mem test unit`)
Tests for core DB operations:
- Add/get/remove/update facts
- FTS5 search accuracy
- Scope filtering (global vs project)
- Tier filtering (working vs long-term)
- TTL expiry (add working fact with 1s TTL, sleep, expire, verify gone)
- Relations: link, graph traversal
- Deduplication: add same fact twice, verify single entry
- Contradiction: add fact, add same key with different value, verify update
- Inject: generate FACTS.md, verify format and content
- Import/export roundtrip

### 2. Extraction Quality Tests (`brokkr-mem test extract`)
Test extraction accuracy against known-good samples:

Create test fixtures in `test/fixtures/`:
- `simple-conversation.md` — short conversation with 5 known facts
- `technical-session.md` — technical discussion with decisions, tools, code
- `people-session.md` — conversation mentioning multiple people with relationships
- `noisy-session.md` — lots of chitchat with only 2-3 real facts buried in it
- `contradiction-session.md` — conversation that changes a previous decision

Each fixture has a companion `*-expected.json` with the expected extracted facts.

Test runner:
1. Extract facts from fixture
2. Compare against expected
3. Score: precision (how many extracted facts are correct) + recall (how many expected facts were found)
4. Report F1 score per fixture

### 3. Recall Benchmark (`brokkr-mem test recall`)
Tests whether the system can recall facts when asked:

Create question-answer pairs:
```json
[
  { "question": "What is Cory's son's name?", "expected_key": "person/cory.son", "expected_contains": "Liam" },
  { "question": "What color is the TKNS brand?", "expected_key": "project/cad-wiki.brand-color", "expected_contains": "#003ba9" },
  { "question": "Why did we choose Rune as the codename?", "expected_key": "decision/rune.codename", "expected_contains": "Norse" },
  { "question": "Who is Bobsy?", "expected_key": "person/cory.discord.alt", "expected_contains": "Cory" },
  { "question": "What editor does cad-wiki use?", "expected_key": "project/cad-wiki.editor", "expected_contains": "TipTap" },
  { "question": "What should I never do with the gateway?", "expected_key": "lesson/gateway-restart", "expected_contains": "NEVER restart" },
  { "question": "What's Cory's timezone?", "expected_key": "preference/cory.timezone", "expected_contains": "Eastern" }
]
```

For each question:
1. Run `brokkr-mem search <question>` 
2. Check if the expected_key appears in results
3. Check if the expected_contains text is in the result value
4. Score: hit/miss per question, total recall percentage

### 4. Performance Benchmark (`brokkr-mem test perf`)
Measure speed of core operations:
- Insert 1000 facts: time
- FTS5 search with 1000 facts: time per query (avg of 100 queries)
- Inject generation with 1000 facts: time
- Extract from a 5000-word document: time
- Graph traversal (3 levels deep): time

Report as a table with operation, count, total_ms, per_op_ms.

### 5. End-to-End Test (`brokkr-mem test e2e`)
Full lifecycle test:
1. Create fresh test DB (in /tmp)
2. Add 10 facts manually
3. Extract from a fixture file
4. Verify dedup works (re-extract same file)
5. Link some facts
6. Run graph queries
7. Generate FACTS.md
8. Verify FACTS.md contains expected content
9. Add working memory with 1s TTL
10. Run expire
11. Verify working memory is gone
12. Clean up test DB

### 6. Regression Tracker (`brokkr-mem test --save`)
When run with --save, store benchmark results in `~/.openclaw/rune-benchmarks.json`:
```json
{
  "runs": [
    {
      "timestamp": "2026-02-23T23:30:00Z",
      "version": "1.0.0",
      "unit": { "passed": 15, "failed": 0, "total": 15 },
      "extract": { "f1_avg": 0.85, "fixtures": { "simple": 0.95, "technical": 0.80, ... } },
      "recall": { "hit_rate": 0.86, "total": 7, "hits": 6 },
      "perf": { "insert_1000_ms": 120, "search_avg_ms": 2.3, "inject_ms": 45, "extract_ms": 8500 }
    }
  ]
}
```

`brokkr-mem test --compare` shows diff against last saved run — are we getting better or worse?

## CLI Interface

```
brokkr-mem test [suite] [options]
  suite: unit | extract | recall | perf | e2e | all (default: all)
  --save           Save results to benchmark file
  --compare        Compare against last saved run
  --verbose        Show detailed output for failures
  --db <path>      Use alternate DB path (default: /tmp/rune-test.db for tests)
  --model <model>  Ollama model for extraction tests (default: qwen3:8b)
```

## Test Fixtures
Create realistic test fixtures based on actual conversation patterns.

### simple-conversation.md
```markdown
# Test Session

User: Hey, my name is Alex and I work at Acme Corp.
Assistant: Nice to meet you Alex! What can I help with?
User: I want to build a dashboard using React and Tailwind.
Assistant: Great choices. I'll scaffold that out.
User: Actually let's use Vue instead, I changed my mind.
Assistant: No problem, switching to Vue.
User: My email is alex@acme.com
```

Expected facts:
- person/alex.name = "Alex"
- person/alex.employer = "Acme Corp"
- person/alex.email = "alex@acme.com"
- decision/dashboard.framework = "Vue" (changed from React)
- project/dashboard.stack = "Vue + Tailwind"

### noisy-session.md
Lots of back-and-forth banter, jokes, tangents, with only 2 real facts:
- User mentions they prefer dark mode
- User says their server runs Ubuntu 24.04

Test that extraction finds the signal in the noise.

## Technical Notes
- Unit tests use a temp DB in /tmp — never touch the real DB
- Extraction tests need Ollama running — skip gracefully if not available
- Performance tests run 3 warmup iterations before measuring
- All test output uses color coding: green=pass, red=fail, yellow=warning
- Exit code: 0 if all pass, 1 if any fail

## Completion
1. `brokkr-mem test` runs full suite
2. All unit tests pass
3. Extraction fixtures created with expected outputs
4. Recall benchmark works against real DB
5. Performance benchmark produces clean table
6. Regression tracking saves/compares results
7. npm install -g . works
8. Git commit: "feat(rune): test & benchmark suite — unit, extraction, recall, perf, e2e, regression tracking"
9. Run: openclaw system event --text "Done: Rune test suite — unit/extraction/recall/perf/e2e with regression tracking" --mode now
