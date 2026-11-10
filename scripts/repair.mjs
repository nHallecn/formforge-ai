import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { extractJsonResponse } from './repair-contract.mjs';

const root = resolve(new URL('../', import.meta.url).pathname);
const source = await readFile(resolve(root, 'src/main.jsx'), 'utf8');
const brokenStart = source.indexOf('function BrokenForm()');
const brokenEnd = source.indexOf('\nfunction RepairedForm()', brokenStart);
if (brokenStart < 0 || brokenEnd < 0) throw new Error('Supported baseline component not found');
const target = source.slice(brokenStart, brokenEnd);
const mockFile = process.argv.find(a => a.startsWith('--mock='));
const prompt = [
  'You are a repair engine for a single, authorized React scholarship form fixture.',
  'Read the broken component and return ONLY one JSON object. Never return JavaScript.',
  'Produce this exact schema: {"version":1,"formTitle":"...",',
  '"fields":[{"name":"fullName","label":"...","type":"text","required":true,"options":null},',
  '{"name":"email","label":"...","type":"email","required":true,"options":null},',
  '{"name":"program","label":"...","type":"select","required":true,',
  '"options":[{"value":"engineering","label":"Engineering"}]}],',
  '"submitLabel":"...","successMessage":"..."}',
  'Preserve every field name and the engineering option. Infer useful, accessible labels.',
  'All fields must remain required. Do not invent external services or claim server persistence.',
  'Broken React source follows:', target,
].join('\n');

let modelOutput;
if (mockFile) {
  // Test-only mode: a known fixture. Never describe this as an AI-generated repair.
  if (process.env.CI !== 'true') throw new Error('Mock mode is limited to CI');
  const path = resolve(root, 'tests/fixtures/known-repair.json');
  if (mockFile !== '--mock=known') throw new Error('Unknown mock fixture');
  modelOutput = await readFile(path, 'utf8');
} else {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY is required for a model repair');
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.FORMFORGE_MODEL || 'gpt-4o-mini',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'Return only a syntactically valid JSON repair artifact. Never emit code.' },
        { role: 'user', content: prompt },
      ],
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error('Model request failed (HTTP ' + response.status + ')');
  const envelope = await response.json();
  modelOutput = envelope.choices?.[0]?.message?.content;
  if (!modelOutput) throw new Error('Model response was empty');
}

const artifact = extractJsonResponse(modelOutput);
const outDir = resolve(root, 'public');
await mkdir(outDir, { recursive: true });
await writeFile(resolve(outDir, 'repair-candidate.json'), JSON.stringify(artifact, null, 2) + '\n', { flag: 'w', mode: 0o600 });
console.log('Candidate validated and written to public/repair-candidate.json.');
console.log('This does not prove a successful repair. Run browser tests before approval.');
