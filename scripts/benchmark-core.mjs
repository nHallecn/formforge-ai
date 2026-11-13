import { validateRepair, requiredFields } from './repair-contract.mjs';

export const normalizeLabel = value => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function scoreCase(definition, candidate, modelMetadata = {}) {
  const issues = [];
  try { validateRepair(candidate); }
  catch (error) { return { caseId: definition.id, valid: false, passed: false, issues: ['contract: ' + error.message], ...modelMetadata }; }
  for (const fieldName of requiredFields) {
    const found = candidate.fields.find(item => item.name === fieldName);
    const acceptable = definition.allowedSynonyms[fieldName].map(normalizeLabel);
    if (!acceptable.includes(normalizeLabel(found.label))) issues.push('semantic_label:' + fieldName);
  }
  // This is a semantic-label benchmark only. Browser accessibility/functionality
  // is checked separately by Playwright; this evaluator does not claim either.
  return { caseId: definition.id, valid: true, passed: issues.length === 0, issues, ...modelMetadata };
}

export function summarize(results) {
  const passed = results.filter(r => r.passed).length;
  const valid = results.filter(r => r.valid).length;
  return { total: results.length, valid, passed, passRate: results.length ? passed / results.length : 0,
    failures: results.filter(r => !r.passed).map(r => ({ caseId: r.caseId, issues: r.issues })) };
}

export function createRepairPrompt(source) {
  return [
    'You are converting one authorized broken React form into a safe declarative form repair.',
    'Infer labels from the JSX context. Output only JSON, never code or Markdown.',
    'Exact JSON shape: {"version":1,"formTitle":"short title","fields":[',
    '{"name":"fullName","label":"descriptive label","type":"text","required":true,"options":null},',
    '{"name":"email","label":"descriptive label","type":"email","required":true,"options":null},',
    '{"name":"program","label":"descriptive label","type":"select","required":true,',
    '"options":[{"value":"engineering","label":"Engineering"}]}],',
    '"submitLabel":"submit action","successMessage":"Application submitted successfully."}',
    'Keep the three field names and the engineering option unchanged.',
    'Do not claim server persistence. The form is client-side only.',
    'Source JSX follows:\n' + source
  ].join('\n');
}
