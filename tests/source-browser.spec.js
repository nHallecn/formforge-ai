import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { checkGeneratedModule } from '../scripts/source-browser-verify.mjs';

const manifest = JSON.parse(readFileSync(new URL('../repair-artifacts/manifest.json', import.meta.url), 'utf8'));

test('real template-generated JSX renders and completes a valid browser submission', async ({ page }) => {
  const evidence = await checkGeneratedModule(page);
  expect(evidence, JSON.stringify(evidence, null, 2)).toMatchObject({
    passed: true, issues: [], runtimeErrors: [], violations: []
  });
  expect(manifest.approved).toBe(false);
  expect(manifest.checks.browser).toBe(false); // Original manifest is immutable.
});
