#!/usr/bin/env node
import { scoreFactsForRelevance } from './src/relevance.js';

// Sample facts for testing
const testFacts = [
  { id: 1, category: 'project', key: 'cad-wiki.stack', value: 'Next.js + TipTap WYSIWYG + GitHub Contents API', updated: '2026-02-24' },
  { id: 2, category: 'project', key: 'whattimeisitin.status', value: 'Deployed and complete - timezone website with 159+ pages', updated: '2026-02-24' },
  { id: 3, category: 'lesson', key: 'ollama-inline', value: 'NEVER run Ollama extraction inline - always background + poll', updated: '2026-02-24' },
  { id: 4, category: 'person', key: 'cory.occupation', value: 'CAD Tech / AI Guru / Programmer at TKNS (tkns.net)', updated: '2026-02-24' },
  { id: 5, category: 'tool', key: 'brokkr-mem', value: 'Persistent fact memory CLI - add/search/inject/extract/stats', updated: '2026-02-24' }
];

async function test() {
  try {
    console.log('Testing relevance scoring...');
    
    const message = "building a website with Next.js";
    console.log(`Message: "${message}"`);
    console.log(`Testing with ${testFacts.length} facts`);
    
    const start = Date.now();
    const scored = await scoreFactsForRelevance(message, testFacts, {
      engine: 'ollama',
      threshold: 0.1,
      limit: 10
    });
    const duration = Date.now() - start;
    
    console.log(`\nScoring completed in ${duration}ms`);
    console.log(`${scored.length} relevant facts found:\n`);
    
    for (const fact of scored) {
      console.log(`${fact.relevance_score.toFixed(3)} - ${fact.category}/${fact.key}: ${fact.value}`);
      console.log(`  [DEBUG] Original ID: ${fact.id}, Score: ${fact.relevance_score}`);
    }
    
  } catch (err) {
    console.error('Test failed:', err.message);
    console.error(err.stack);
  }
}

test();