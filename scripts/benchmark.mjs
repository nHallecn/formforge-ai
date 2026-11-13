import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from '@playwright/test';
import { generateCandidate } from './model-client.mjs';
import { scoreCase, summarize } from './benchmark-core.mjs';
import { verifyCandidateInBrowser } from './browser-verifier.mjs';
import { withPreviewServer } from './browser-server.mjs';

const root = resolve(new URL('../', import.meta.url).pathname);
const definitions = JSON.parse(await readFile(resolve(root, 'benchmarks/cases.json'), 'utf8'));
if (process.argv.some(arg => arg.startsWith('--mock'))) throw new Error('Mock mode forbidden for measured AI benchmarks');
if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is required to measure real model performance');
const model = process.env.FORMFORGE_MODEL || 'gpt-4o-mini';
const results = [];

// Each candidate is rendered inside the same fixed, local React application.
// There is no execution of untrusted model-generated JavaScript, and no real
// network submission. This verifies candidate data rather than source patches.
await withPreviewServer(async baseURL => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const definition of definitions) {
      const started = performance.now();
      let result;
      try {
        const { candidate, usage } = await generateCandidate(definition.source, { model });
        const semantic = scoreCase(definition, candidate);
        const page = await browser.newPage();
        let browserEvidence;
        try {
          browserEvidence = await verifyCandidateInBrowser(page, candidate, baseURL);
        } catch (error) {
          browserEvidence = { passed: false, checks: {}, issues: ['browser_error: ' + error.message.slice(0, 160)], violations: [] };
        } finally {
          await page.close();
        }
        const passed = semantic.passed && browserEvidence.passed;
        const issues = [...semantic.issues, ...browserEvidence.issues];
        result = { caseId: definition.id, valid: semantic.valid, semanticPassed: semantic.passed,
          browserPassed: browserEvidence.passed, passed, issues,
          browser: browserEvidence, durationMs: Math.round(performance.now() - started), usage };
      } catch (error) {
        const message = error?.message ?? String(error);
        const issue = message.startsWith('Model request') ? 'model_http_error' :
          message.includes('repair artifact') || message.includes('field') || message.includes('JSON') ?
          'invalid_candidate' : 'model_or_parse_error';
        result = { caseId: definition.id, valid: false, semanticPassed: false, browserPassed: false,
          passed: false, issues: [issue], browser: null, durationMs: Math.round(performance.now() - started) };
      }
      results.push(result);
      console.log(definition.id + ': ' + (result.passed ? 'PASS' : 'FAIL') +
        ' semantic=' + result.semanticPassed + ' browser=' + result.browserPassed +
        (result.issues.length ? ' issues=' + result.issues.join(', ') : ''));
    }
  } finally {
    await browser.close();
  }
});

const metrics = summarize(results);
metrics.semanticPassed = results.filter(r => r.semanticPassed).length;
metrics.browserPassed = results.filter(r => r.browserPassed).length;
metrics.verifiedPassed = results.filter(r => r.passed).length;
const report = {
  schemaVersion: 2, source: 'live_model', model, generatedAt: new Date().toISOString(),
  benchmarkSha256: createHash('sha256').update(JSON.stringify(definitions)).digest('hex'),
  evidenceScope: 'fixed React renderer, semantic labels, axe WCAG 2/2.1 A/AA tags, native validation, keyboard confirmation; no backend persistence',
  metrics, results,
};
const output = resolve(root, 'benchmark-results');
await mkdir(output, { recursive: true });
await writeFile(resolve(output, 'latest.json'), JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
console.log('Verified ' + metrics.verifiedPassed + '/' + metrics.total + ' live candidates; report: benchmark-results/latest.json');
if (metrics.verifiedPassed !== metrics.total) process.exitCode = 1;
