import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { generateCandidate } from './model-client.mjs';
import { scoreCase, summarize } from './benchmark-core.mjs';

const root = resolve(new URL('../', import.meta.url).pathname);
const definitions = JSON.parse(await readFile(resolve(root, 'benchmarks/cases.json'), 'utf8'));
if (process.argv.some(arg => arg.startsWith('--mock'))) throw new Error('Mock mode forbidden for measured AI benchmarks');
if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is required to measure real model performance');
const model = process.env.FORMFORGE_MODEL || 'gpt-4o-mini';
const results = [];
for (const definition of definitions) {
  const started = performance.now();
  try {
    const { candidate, usage } = await generateCandidate(definition.source, { model });
    const result = scoreCase(definition, candidate, { durationMs: Math.round(performance.now() - started), usage });
    results.push(result);
    console.log(definition.id + ': ' + (result.passed ? 'PASS' : 'FAIL') + ' ' + result.issues.join(', '));
  } catch (error) {
    const issue = error.message.startsWith('Model request') ? 'model_http_error' :
      error.message.startsWith('Invalid') || error.message.startsWith('All original') ||
      error.message.startsWith('Field names') || error.message.startsWith('Email') ||
      error.message.startsWith('Original') ? 'invalid_candidate' : 'model_or_parse_error';
    results.push({ caseId: definition.id, valid: false, passed: false, issues: [issue],
      durationMs: Math.round(performance.now() - started) });
    console.error(definition.id + ': FAIL ' + issue);
  }
}
const report = { schemaVersion: 1, source: 'live_model', model, generatedAt: new Date().toISOString(),
  benchmarkSha256: createHash('sha256').update(JSON.stringify(definitions)).digest('hex'),
  metrics: summarize(results), results };
const output = resolve(root, 'benchmark-results');
await mkdir(output, { recursive: true });
const filename = resolve(output, 'latest.json');
await writeFile(filename, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
console.log('Recorded ' + report.metrics.passed + '/' + report.metrics.total + ' semantic-label passes in benchmark-results/latest.json');
if (report.metrics.passed !== report.metrics.total) process.exitCode = 1;
