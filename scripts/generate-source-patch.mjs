import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { extractJsonResponse } from './repair-contract.mjs';
import { generateCandidate } from './model-client.mjs';
import { SOURCE_PATH, prepareSourcePatch } from './source-patch.mjs';

const root = resolve(new URL('../', import.meta.url).pathname);
const source = await readFile(resolve(root, SOURCE_PATH), 'utf8');
const mode = process.argv.find(arg => arg.startsWith('--fixture='));
let candidate;
if (mode) {
  if (process.env.CI !== 'true' || mode !== '--fixture=known') throw Error('Fixture mode requires CI=true and known fixture');
  candidate = extractJsonResponse(await readFile(resolve(root, 'tests/fixtures/known-repair.json'), 'utf8'));
  console.log('Using handwritten fixture. This is NOT evidence of model success.');
} else {
  ({ candidate } = await generateCandidate(source));
  console.log('Using real model candidate. Successful browser verification NOT yet established.');
}
const manifest = await prepareSourcePatch(candidate, { root });
console.log('Review-only source patch created. Original fixture was NOT modified.');
console.log(JSON.stringify(manifest, null, 2));
