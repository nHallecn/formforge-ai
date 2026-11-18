import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { sha256, SOURCE_PATH } from './source-patch.mjs';
import { withPreviewServer } from './browser-server.mjs';

const rootDefault = resolve(new URL('../', import.meta.url).pathname);
const checkNames = ['render', 'labels', 'axe', 'requiredFields', 'invalidEmail', 'keyboardSubmit', 'noRuntimeErrors'];

/** Check hashes BEFORE running any generated code in the browser. */
export async function inspectPatch(root = rootDefault) {
  const output = resolve(root, 'repair-artifacts');
  const manifest = JSON.parse(await readFile(resolve(output, 'manifest.json'), 'utf8'));
  if (manifest.version !== 1 || manifest.mode !== 'review_only' ||
      manifest.target !== SOURCE_PATH || manifest.approved !== false ||
      manifest.checks?.schema !== true || manifest.checks?.jsxSyntax !== true) {
    throw new Error('Invalid or unexpectedly approved patch manifest');
  }
  const [original, generated, patch, html, entry] = await Promise.all([
    readFile(resolve(root, SOURCE_PATH), 'utf8'),
    readFile(resolve(output, 'ScholarshipForm.jsx'), 'utf8'),
    readFile(resolve(output, 'ScholarshipForm.patch'), 'utf8'),
    readFile(resolve(output, 'preview.html'), 'utf8'),
    readFile(resolve(output, 'preview-entry.jsx'), 'utf8'),
  ]);
  if (sha256(original) !== manifest.originalSha256 ||
      sha256(generated) !== manifest.candidateSha256 ||
      sha256(patch) !== manifest.patchSha256 ||
      sha256(html) !== manifest.previewSha256 ||
      sha256(entry) !== manifest.previewEntrySha256) {
    throw new Error('Source repair artifact integrity check failed');
  }
  return { manifest, generated, output };
}

/** Browser-execute trusted, template-generated JSX; never execute model-written code. */
export async function checkGeneratedModule(page, baseURL = 'http://127.0.0.1:4173') {
  const checks = Object.fromEntries(checkNames.map(name => [name, false]));
  const issues = [];
  const violations = [];
  const runtimeErrors = [];
  const fail = (name, error) => issues.push(name + ': ' + String(error?.message ?? error).slice(0, 240));
  const origin = new URL(baseURL).origin;
  page.on('pageerror', error => runtimeErrors.push(error.message.slice(0, 180)));
  await page.route('**/*', route => {
    try {
      return new URL(route.request().url()).origin === origin ? route.continue() : route.abort();
    } catch { return route.abort(); }
  });

  try {
    await page.goto(baseURL + '/repair-artifacts/preview.html', { waitUntil: 'networkidle', timeout: 10000 });
    await page.locator('#generated-root form').waitFor({ timeout: 10000 });
    checks.render = true;
  } catch (error) {
    fail('render', error);
    return { passed: false, checks, issues, violations, runtimeErrors };
  }
  const form = page.locator('#generated-root form');
  const name = form.locator('[name="fullName"]');
  const email = form.locator('[name="email"]');
  const program = form.locator('[name="program"]');
  const submit = form.locator('button[type="submit"]');
  const status = form.getByRole('status');
  try {
    for (const field of ['fullName', 'email', 'program']) {
      const input = form.locator('[name="' + field + '"]');
      if (await input.count() !== 1) throw Error('Missing or duplicate control: ' + field);
      const id = await input.getAttribute('id');
      if (!id || await form.locator('label[for="' + id + '"]').count() !== 1) {
        throw Error('Missing associated label: ' + field);
      }
    }
    checks.labels = true;
  } catch (error) { fail('labels', error); }
  try {
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    violations.push(...results.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length })));
    if (violations.length) throw Error(violations.map(v => v.id).join(', '));
    checks.axe = true;
  } catch (error) { fail('axe', error); }
  try {
    if (await name.getAttribute('required') === null ||
        await email.getAttribute('required') === null ||
        await program.getAttribute('required') === null) throw Error('Required attribute missing');
    await submit.click();
    if ((await status.innerText()).trim() !== '') throw Error('Empty form submitted');
    if (!await name.evaluate(input => input.validity.valueMissing)) throw Error('Name not validated');
    checks.requiredFields = true;
  } catch (error) { fail('requiredFields', error); }
  try {
    await name.fill('Alex Chen');
    await email.fill('not-an-email');
    await program.selectOption('engineering');
    await submit.click();
    if ((await status.innerText()).trim() !== '') throw Error('Invalid email submitted');
    if (!await email.evaluate(input => input.validity.typeMismatch)) throw Error('Email mismatch not detected');
    checks.invalidEmail = true;
  } catch (error) { fail('invalidEmail', error); }
  try {
    await email.fill('alex@example.com');
    await submit.focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('#generated-root form [role="status"]')?.textContent?.trim().length > 0, null, { timeout: 10000 });
    checks.keyboardSubmit = true;
  } catch (error) { fail('keyboardSubmit', error); }
  if (!runtimeErrors.length) checks.noRuntimeErrors = true;
  else issues.push('noRuntimeErrors: ' + runtimeErrors.join('; '));
  return { passed: Object.values(checks).every(Boolean), checks, issues, violations, runtimeErrors };
}

export async function verifyGeneratedSource({ root = rootDefault } = {}) {
  // The verification CLI is restricted to this repository fixture; arbitrary
  // supplied paths / third-party scripts are outside this security boundary.
  if (resolve(root) !== rootDefault) throw Error('Browser verifier only supports its own repository fixture');
  const { manifest, output } = await inspectPatch(root);
  let evidence;
  try {
    evidence = await withPreviewServer(async baseURL => {
      const browser = await chromium.launch({ headless: true });
      try {
        const context = await browser.newContext();
        try {
          const page = await context.newPage();
          try { return await checkGeneratedModule(page, baseURL); }
          finally { await page.close(); }
        } finally { await context.close(); }
      } finally { await browser.close(); }
    });
  } catch (error) {
    evidence = { passed: false, checks: {}, issues: ['browser_launch: ' + error.message.slice(0, 200)], violations: [], runtimeErrors: [] };
  }
  // A hash binds this evidence to the exact source and patch being tested.
  const report = {
    version: 1, generatedAt: new Date().toISOString(), fixtureOnly: true,
    candidateSha256: manifest.candidateSha256, patchSha256: manifest.patchSha256,
    originalSha256: manifest.originalSha256, passed: evidence.passed,
    checks: evidence.checks, issues: evidence.issues, violations: evidence.violations,
    runtimeErrors: evidence.runtimeErrors,
    limitations: 'Trusted-template JSX fixture only; native browser confirmation does not persist a backend record or certify WCAG.',
  };
  await writeFile(resolve(output, 'browser-evidence.json'), JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
  // Preserve immutable initial manifest; never reinterpret generated data as approved.
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL('./source-browser-verify.mjs', import.meta.url).pathname)) {
  const report = await verifyGeneratedSource();
  console.log(JSON.stringify({ passed: report.passed, checks: report.checks, issues: report.issues }, null, 2));
  if (!report.passed) process.exitCode = 1;
}
