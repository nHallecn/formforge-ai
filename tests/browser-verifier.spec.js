import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { verifyCandidateInBrowser } from '../scripts/browser-verifier.mjs';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/known-repair.json', import.meta.url), 'utf8'));
test('known repair passes six browser checks through real candidate renderer', async ({ page }) => {
  const result = await verifyCandidateInBrowser(page, structuredClone(fixture));
  expect(result.issues).toEqual([]);
  expect(result.passed).toBe(true);
  expect(Object.values(result.checks)).toEqual([true, true, true, true, true, true]);
});

test('browser oracle rejects a candidate whose email field is not required', async ({ page }) => {
  const defective = structuredClone(fixture);
  defective.fields[1].required = false;
  const result = await verifyCandidateInBrowser(page, defective);
  // Browser validation does not replace the separate strict schema contract.
  // The browser-only check can detect the missing email requirement when empty fields are filled appropriately.
  expect(result.checks.render).toBe(true);
  expect(result.checks.axe).toBe(true);
  expect(result.passed).toBe(false);
});
