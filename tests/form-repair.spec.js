import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('baseline exposes real unlabeled form fields', async ({ page }) => {
  await page.goto('/?variant=broken');
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const labelIssue = result.violations.find(item => item.id === 'label' || item.id === 'select-name');
  expect(labelIssue, JSON.stringify(result.violations, null, 2)).toBeTruthy();
});

test('baseline submit is inert', async ({ page }) => {
  await page.goto('/?variant=broken');
  await page.getByPlaceholder('Full name').fill('Alex Chen');
  await page.getByPlaceholder('Email address').fill('alex@example.com');
  await page.locator('select[name="program"]').selectOption('engineering');
  await page.getByRole('button', { name: 'Submit application' }).click();
  await expect(page.getByText('Application submitted successfully.')).toHaveCount(0);
});

test('reference repair passes scoped automated accessibility checks', async ({ page }) => {
  await page.goto('/?variant=repaired');
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(result.violations).toEqual([]);
});

test('reference repair accepts keyboard input and submits', async ({ page }) => {
  await page.goto('/?variant=repaired');
  await page.getByRole('textbox', { name: 'Full name' }).focus();
  await page.keyboard.type('Alex Chen');
  await page.keyboard.press('Tab');
  await page.keyboard.type('alex@example.com');
  await page.keyboard.press('Tab');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toContainText('Application submitted successfully.');
});
