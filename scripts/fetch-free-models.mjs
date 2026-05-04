#!/usr/bin/env node
/**
 * Fetch currently available free models from OpenRouter API.
 * Usage: OPENROUTER_KEY=sk-or-... node scripts/fetch-free-models.mjs
 */

const apiKey = process.env.OPENROUTER_KEY ?? process.env.OPENROUTER_API_KEY;

if (!apiKey) {
  console.error('Error: Set OPENROUTER_KEY or OPENROUTER_API_KEY environment variable');
  process.exit(1);
}

const res = await fetch('https://openrouter.ai/api/v1/models', {
  headers: { Authorization: `Bearer ${apiKey}` },
});

if (!res.ok) {
  console.error(`OpenRouter API error: ${res.status} ${res.statusText}`);
  process.exit(1);
}

const data = await res.json();

const free = data.data
  .filter((m) => m.id.endsWith(':free'))
  .map((m) => ({
    id: m.id,
    name: m.name,
    provider: m.id.split('/')[0],
    ctx: m.context_length,
  }))
  .sort((a, b) => b.ctx - a.ctx);

console.log(JSON.stringify(free, null, 2));
console.error(`\nTotal free models found: ${free.length}`);
