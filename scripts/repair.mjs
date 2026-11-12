import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { extractJsonResponse } from './repair-contract.mjs';
import { generateCandidate } from './model-client.mjs';

const root = resolve(new URL('../', import.meta.url).pathname);
const source = await readFile(resolve(root, 'src/main.jsx'), 'utf8');
const brokenStart = source.indexOf('function BrokenForm()');
const brokenEnd = source.indexOf('\nfunction RepairedForm()', brokenStart);
if (brokenStart < 0 || brokenEnd < 0) throw new Error('Supported baseline component not found');
const target = source.slice(brokenStart, brokenEnd);

const mockFlag = process.argv.find(arg => arg.startsWith('--mock='));
let artifact;
if (mockFlag) {
  if (process.env.CI !== 'true' || mockFlag !== '--mock=known') throw new Error('Mock mode is restricted to the CI known fixture');
  artifact = extractJsonResponse(await readFile(resolve(root, 'tests/fixtures/known-repair.json'), 'utf8'));
  console.log('Using a hand-authored CI fixture, NOT an AI response.');
} else {
  const result = await generateCandidate(target);
  artifact = result.candidate;
  console.log('Received a live model-generated candidate; browser verification remains required.');
}
const outDir = resolve(root, 'public');
await mkdir(outDir, { recursive: true });
await writeFile(resolve(outDir, 'repair-candidate.json'), JSON.stringify(artifact, null, 2) + '\n', { mode: 0o600 });
console.log('Contract-valid candidate saved to public/repair-candidate.json. Browser tests remain required.');
