# FormForge AI

**Mission:** Repair broken web forms, verify functional and accessibility improvements, and eventually deliver approved source-code pull requests.

## First vertical slice: benchmark case 001

This PR adds a deliberately broken scholarship application and a hand-authored reference repair. The broken baseline lacks accessible field names and has an inert submit button. The repaired reference labels the controls, uses native HTML validation, and implements actual client-side submission confirmation.

**Important:** The reference repair is NOT AI-generated. This milestone proves the testing harness before implementing AI code modification.

### Run locally

```bash
npm install
npx playwright install chromium
npm run dev
```

Open `/?variant=broken` or `/?variant=repaired`.

### Reproduce verification

```bash
npm run build
npm test
```

Playwright checks known defects in the baseline, zero violations for the reference against the configured automated axe-core WCAG 2 A/AA and 2.1 A/AA tags, and a working keyboard-driven form submission. These checks do **not** establish complete WCAG conformance or guarantee accessibility for all assistive technologies.

### Next increment

Add an AI patch generator operating on a user-authorized, isolated checkout; constrain write paths; test every candidate against this benchmark; reject regressions; and require explicit approval before opening a PR. Do not run untrusted repository scripts with production credentials.
