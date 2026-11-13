import AxeBuilder from '@axe-core/playwright';

const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const timeout = 10000;

/**
 * Checks the actual candidate renderer with a real browser. It doesn't certify
 * WCAG compliance, backend persistence or arbitrary source-code repair.
 * The caller owns the page and must run it in an isolated fixture environment.
 */
export async function verifyCandidateInBrowser(page, candidate, baseURL = 'http://127.0.0.1:4173') {
  const checks = { render: false, accessibleNames: false, axe: false, required: false, email: false, keyboardSubmit: false };
  const issues = [];
  const violations = [];
  const fail = (kind, error) => issues.push(kind + ': ' + (error?.message ?? String(error)).slice(0, 220));
  const origin = new URL(baseURL).origin;
  // Block all external requests. Only the local preview origin is allowed.
  await page.route('**/*', route => {
    let url;
    try { url = new URL(route.request().url()); } catch { return route.abort(); }
    return url.origin === origin ? route.continue() : route.abort();
  });
  // Playwright applies the most recently registered route first.
  await page.route('**/repair-candidate.json', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(candidate),
  }));

  try {
    await page.goto(baseURL + '/?variant=candidate', { waitUntil: 'networkidle', timeout });
    await page.getByRole('heading', { level: 2, name: candidate.formTitle }).waitFor({ timeout });
    checks.render = true;
  } catch (error) {
    fail('render', error);
    return { passed: false, checks, issues, violations };
  }

  const form = page.locator('section.panel form');
  const fullName = form.locator('[name="fullName"]');
  const email = form.locator('[name="email"]');
  const program = form.locator('[name="program"]');
  const submit = form.locator('button[type="submit"]');
  const status = page.locator('section.panel [role="status"]');

  try {
    for (const field of candidate.fields) {
      const name = await form.locator('[name="' + field.name + '"]').getAttribute('id');
      if (!name) throw Error('Missing control ID: ' + field.name);
      const label = form.locator('label[for="' + name + '"]');
      if (await label.count() !== 1 || (await label.innerText()).trim() !== field.label) {
        throw Error('Missing associated label: ' + field.name);
      }
    }
    checks.accessibleNames = true;
  } catch (error) { fail('accessible_names', error); }

  try {
    const results = await new AxeBuilder({ page }).withTags(tags).analyze();
    violations.push(...results.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length })));
    if (violations.length) throw Error(violations.map(v => v.id).join(', '));
    checks.axe = true;
  } catch (error) { fail('axe', error); }

  try {
    // Native required validation must block empty submission.
    await submit.click();
    if (await status.innerText() !== '') throw Error('Empty submission incorrectly succeeded');
    if (await fullName.evaluate(node => node.validity.valueMissing) !== true) {
      throw Error('Missing required name was not blocked');
    }
    if (await email.evaluate(node => node.required) !== true || await program.evaluate(node => node.required) !== true) {
      throw Error('Email and program must be required');
    }
    checks.required = true;
  } catch (error) { fail('required', error); }

  try {
    await fullName.fill('Alex Chen');
    await email.fill('not-an-email');
    await program.selectOption('engineering');
    await submit.click();
    if (await status.innerText() !== '') throw Error('Invalid email incorrectly submitted');
    if (await email.evaluate(node => node.validity.typeMismatch) !== true) {
      throw Error('Invalid email not rejected by native validation');
    }
    checks.email = true;
  } catch (error) { fail('email', error); }

  try {
    await email.fill('alex@example.com');
    await submit.focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(expected => {
      const node = document.querySelector('section.panel [role="status"]');
      return node?.textContent?.trim() === expected;
    }, candidate.successMessage, { timeout });
    checks.keyboardSubmit = true;
  } catch (error) { fail('keyboard_submit', error); }

  return { passed: Object.values(checks).every(Boolean), checks, issues, violations };
}
