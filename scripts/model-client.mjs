import { extractJsonResponse } from './repair-contract.mjs';
import { createRepairPrompt } from './benchmark-core.mjs';

export async function generateCandidate(source, { apiKey = process.env.OPENAI_API_KEY, model = process.env.FORMFORGE_MODEL || 'gpt-4o-mini' } = {}) {
  if (!apiKey) throw new Error('OPENAI_API_KEY is required');
  if (typeof source !== 'string' || source.length < 20 || source.length > 12000) throw new Error('Source length outside limits');
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, temperature: 0, response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: 'Return only a valid JSON object matching the requested shape.' },
        { role: 'user', content: createRepairPrompt(source) }] }),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error('Model request failed with HTTP ' + response.status);
  const envelope = await response.json();
  if (!envelope.choices?.[0]?.message?.content) throw new Error('Empty model result');
  return { candidate: extractJsonResponse(envelope.choices[0].message.content),
    usage: envelope.usage ? { inputTokens: envelope.usage.prompt_tokens, outputTokens: envelope.usage.completion_tokens } : null };
}
