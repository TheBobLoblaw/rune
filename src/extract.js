import fs from 'node:fs';
import { UserError } from './errors.js';

const VALID_SCOPES = new Set(['global', 'project', 'conversation']);
const VALID_TIERS = new Set(['working', 'long-term']);
const VALID_SOURCE_TYPES = new Set(['manual', 'inferred', 'user_said', 'tool_output']);

function buildPrompt(content) {
  return [
    'Extract structured factual memory from the following text.',
    'Return ONLY a JSON array.',
    'Each item must include category, key, value, scope, tier, source_type, ttl.',
    "scope must be one of: global, project, conversation.",
    "tier must be one of: working, long-term.",
    "source_type must be one of: manual, inferred, user_said, tool_output.",
    'ttl must be null or a compact duration string like 24h, 7d, 30m.',
    'Use stable dot-separated keys (e.g., cory.son.name).',
    'Do not include markdown fences or any text outside the JSON array.',
    '',
    'Text:',
    content
  ].join('\n');
}

function normalizeOllamaResponse(text) {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  return fenceMatch ? fenceMatch[1].trim() : trimmed;
}

export async function extractFactsFromFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new UserError(`File not found: ${filePath}`);
  }
  const content = fs.readFileSync(filePath, 'utf8');
  const prompt = buildPrompt(content);

  const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';

  let response;
  try {
    response = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen3:8b',
        prompt,
        stream: false,
        options: {
          temperature: 0
        }
      })
    });
  } catch {
    throw new UserError(`Failed to reach Ollama at ${ollamaUrl}. Is Ollama running?`);
  }

  if (!response.ok) {
    const errText = await response.text();
    throw new UserError(`Ollama request failed (${response.status}): ${errText}`);
  }

  const payload = await response.json();
  if (!payload.response) {
    throw new UserError('Ollama returned an empty response');
  }

  const jsonText = normalizeOllamaResponse(payload.response);
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new UserError('Failed to parse Ollama response as JSON array');
  }

  if (!Array.isArray(parsed)) {
    throw new UserError('Ollama response is not a JSON array');
  }

  const valid = [];
  for (const item of parsed) {
    if (!item || typeof item !== 'object') {
      continue;
    }

    const {
      category,
      key,
      value,
      scope = 'global',
      tier = 'long-term',
      source_type: sourceType = 'inferred',
      ttl = null
    } = item;

    if (
      typeof category !== 'string' || !category.trim() ||
      typeof key !== 'string' || !key.trim() ||
      typeof value !== 'string' || !value.trim()
    ) {
      continue;
    }

    if (!VALID_SCOPES.has(scope) || !VALID_TIERS.has(tier) || !VALID_SOURCE_TYPES.has(sourceType)) {
      continue;
    }

    if (ttl !== null && (typeof ttl !== 'string' || !ttl.trim())) {
      continue;
    }

    valid.push({
      category: category.trim(),
      key: key.trim(),
      value: value.trim(),
      scope,
      tier,
      source_type: sourceType,
      ttl: ttl === null ? null : ttl.trim()
    });
  }

  return valid;
}
