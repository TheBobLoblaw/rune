import fs from 'node:fs';
import { UserError } from './errors.js';

const VALID_SCOPES = new Set(['global', 'project', 'conversation']);
const VALID_TIERS = new Set(['working', 'long-term']);
const VALID_SOURCE_TYPES = new Set(['manual', 'inferred', 'user_said', 'tool_output']);
const VALID_CATEGORIES = new Set(['person', 'project', 'preference', 'decision', 'lesson', 'environment', 'tool', 'task']);
const MAX_WORDS_PER_CHUNK = 10000;
const OLLAMA_TIMEOUT_MS = 60_000;

function buildPrompt(content) {
  return [
    'You are a fact extraction system. Read the following conversation transcript and extract structured facts.',
    '',
    'Return JSON in this shape:',
    '{',
    '  "facts": [',
    '    {',
    '      "category": "person|project|preference|decision|lesson|environment|tool|task",',
    '      "key": "dot.notation.key",',
    '      "value": "concise fact string",',
    '      "scope": "global|project",',
    '      "tier": "long-term|working",',
    '      "source_type": "user_said|inferred|tool_output",',
    '      "confidence": 0.0,',
    '      "ttl": null',
    '    }',
    '  ],',
    '  "session_summary": {',
    '    "decisions": ["..."],',
    '    "open_questions": ["..."],',
    '    "action_items": ["..."],',
    '    "topics": ["..."]',
    '  }',
    '}',
    '',
    'Rules:',
    '- Return valid JSON only.',
    '- Extract only genuinely useful facts.',
    '- Prefer source_type=user_said when explicitly stated by user.',
    '- Use tier=working only for likely-stale short-term task state (ttl like "24h" or "7d").',
    '- Use tier=long-term for durable memory (ttl must be null).',
    '- Be conservative: fewer high-quality facts is better.',
    '',
    'Conversation transcript:',
    content
  ].join('\n');
}

function normalizeOllamaResponse(text) {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  return fenceMatch ? fenceMatch[1].trim() : trimmed;
}

function findJsonCandidate(text) {
  const normalized = normalizeOllamaResponse(text);
  const starts = [];
  for (let i = 0; i < normalized.length; i += 1) {
    const c = normalized[i];
    if (c === '{' || c === '[') {
      starts.push(i);
    }
  }

  for (const start of starts) {
    for (let end = normalized.length; end > start; end -= 1) {
      const candidate = normalized.slice(start, end).trim();
      if (!candidate) {
        continue;
      }
      try {
        return JSON.parse(candidate);
      } catch {
        // continue scanning
      }
    }
  }

  try {
    return JSON.parse(normalized);
  } catch {
    throw new UserError('Failed to parse Ollama response as JSON');
  }
}

function normalizeSummary(raw) {
  const input = raw && typeof raw === 'object' ? raw : {};
  const toList = (value) => (Array.isArray(value) ? value.filter((v) => typeof v === 'string' && v.trim()).map((v) => v.trim()) : []);
  return {
    decisions: toList(input.decisions),
    open_questions: toList(input.open_questions),
    action_items: toList(input.action_items),
    topics: toList(input.topics)
  };
}

function normalizeFacts(parsed) {
  const out = [];
  for (const item of parsed) {
    if (!item || typeof item !== 'object') {
      continue;
    }

    const categoryRaw = typeof item.category === 'string' ? item.category.trim() : '';
    const keyRaw = typeof item.key === 'string' ? item.key.trim() : '';
    const valueRaw = typeof item.value === 'string' ? item.value.trim() : '';
    const scope = typeof item.scope === 'string' ? item.scope.trim() : 'global';
    const tier = typeof item.tier === 'string' ? item.tier.trim() : 'long-term';
    const sourceType = typeof item.source_type === 'string' ? item.source_type.trim() : 'inferred';
    const confRaw = Number(item.confidence);
    const confidence = Number.isFinite(confRaw) ? Math.max(0, Math.min(1, confRaw)) : 0.8;
    const ttl = item.ttl == null ? null : String(item.ttl).trim();

    if (!categoryRaw || !keyRaw || !valueRaw) {
      continue;
    }
    if (!VALID_CATEGORIES.has(categoryRaw)) {
      continue;
    }
    if (!VALID_SCOPES.has(scope)) {
      continue;
    }
    if (!VALID_TIERS.has(tier)) {
      continue;
    }
    if (!VALID_SOURCE_TYPES.has(sourceType)) {
      continue;
    }
    if (ttl !== null && !ttl) {
      continue;
    }

    out.push({
      category: categoryRaw,
      key: keyRaw,
      value: valueRaw,
      scope,
      tier,
      source_type: sourceType,
      confidence,
      ttl: tier === 'working' ? ttl : null
    });
  }
  return out;
}

async function generateOnce(content, { model, ollamaUrl, verbose = false }) {
  const prompt = buildPrompt(content);

  if (verbose) {
    console.error('--- Extraction Prompt ---');
    console.error(prompt);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: {
          temperature: 0.3
        }
      }),
      signal: controller.signal
    });
  } catch (err) {
    if (err && err.name === 'AbortError') {
      throw new UserError(`Ollama request timed out after ${Math.floor(OLLAMA_TIMEOUT_MS / 1000)}s`);
    }
    throw new UserError(`Failed to reach Ollama at ${ollamaUrl}. Is Ollama running?`);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const errText = await response.text();
    throw new UserError(`Ollama request failed (${response.status}): ${errText}`);
  }

  const payload = await response.json();
  if (!payload.response) {
    throw new UserError('Ollama returned an empty response');
  }

  if (verbose) {
    console.error('--- Extraction Response ---');
    console.error(payload.response);
  }

  const parsed = findJsonCandidate(payload.response);
  let factsRaw = [];
  let summary = normalizeSummary({});

  if (Array.isArray(parsed)) {
    factsRaw = parsed;
  } else if (parsed && typeof parsed === 'object') {
    if (Array.isArray(parsed.facts)) {
      factsRaw = parsed.facts;
    }
    summary = normalizeSummary(parsed.session_summary);
  } else {
    throw new UserError('Ollama response must be a JSON object or array');
  }

  return {
    facts: normalizeFacts(factsRaw),
    session_summary: summary
  };
}

function chunkContent(content) {
  const words = content.trim().split(/\s+/).filter(Boolean);
  if (words.length <= MAX_WORDS_PER_CHUNK) {
    return [content];
  }

  const chunks = [];
  for (let i = 0; i < words.length; i += MAX_WORDS_PER_CHUNK) {
    chunks.push(words.slice(i, i + MAX_WORDS_PER_CHUNK).join(' '));
  }
  return chunks;
}

function mergeSummaries(summaries) {
  const unique = {
    decisions: new Set(),
    open_questions: new Set(),
    action_items: new Set(),
    topics: new Set()
  };
  for (const summary of summaries) {
    for (const decision of summary.decisions) unique.decisions.add(decision);
    for (const openQuestion of summary.open_questions) unique.open_questions.add(openQuestion);
    for (const actionItem of summary.action_items) unique.action_items.add(actionItem);
    for (const topic of summary.topics) unique.topics.add(topic);
  }

  return {
    decisions: [...unique.decisions],
    open_questions: [...unique.open_questions],
    action_items: [...unique.action_items],
    topics: [...unique.topics]
  };
}

function dedupeExtractedFacts(facts) {
  const map = new Map();
  for (const fact of facts) {
    const k = `${fact.category}::${fact.key}`;
    const prev = map.get(k);
    if (!prev || fact.confidence >= prev.confidence) {
      map.set(k, fact);
    }
  }
  return [...map.values()];
}

export async function extractFactsFromFile(filePath, options = {}) {
  if (!fs.existsSync(filePath)) {
    throw new UserError(`File not found: ${filePath}`);
  }
  const content = fs.readFileSync(filePath, 'utf8');
  const chunks = chunkContent(content);
  const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
  const model = options.model || 'qwen3:8b';

  const allFacts = [];
  const summaries = [];
  for (const chunk of chunks) {
    const extracted = await generateOnce(chunk, {
      model,
      ollamaUrl,
      verbose: Boolean(options.verbose)
    });
    allFacts.push(...extracted.facts);
    summaries.push(extracted.session_summary);
  }

  return {
    facts: dedupeExtractedFacts(allFacts),
    session_summary: mergeSummaries(summaries),
    chunks: chunks.length
  };
}
