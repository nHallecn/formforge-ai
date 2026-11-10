import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('candidate receives accessible field names and passes scoped axe checks', async ({ page }) => {
  await page.goto('/?variant=candidate');
  await expect(page.getByRole('heading', { name: 'Scholarship application' })).toBeVisible();
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(result.violations).toEqual([]);
});

test('candidate enforces email validation and submits with the keyboard', async ({ page }) => {
  await page.goto('/?variant=candidate');
  await page.getByRole('textbox', { name: 'Full name' }).fill('Alex Chen');
  await page.getByRole('textbox', { name: 'Email address' }).fill('not-an-email');
  await page.getByLabel('Program', { exact: true }).selectOption('engineering');
  await page.getByRole('button', { name: 'Submit application' }).click();
  await expect(page.getByRole('status')).toBeEmpty();
  await page.getByRole('textbox', { name: 'Email address' }).fill('alex@example.com');
  await page.getByRole('button', { name: 'Submit application' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toContainText('Application submitted successfully.');
});
