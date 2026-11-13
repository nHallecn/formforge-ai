import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { scoreCase, summarize, createRepairPrompt } from '../scripts/benchmark-core.mjs';
const cases = JSON.parse(readFileSync(new URL('../benchmarks/cases.json', import.meta.url), 'utf8'));
const template = JSON.parse(readFileSync(new URL('./fixtures/known-repair.json', import.meta.url), 'utf8'));

test('five distinct, versioned benchmark cases', () => {
  assert.equal(cases.length, 5);
  assert.equal(new Set(cases.map(c => c.id)).size, 5);
  assert.equal(new Set(cases.map(c => c.source)).size, 5);
  for (const item of cases) {
    assert.ok(item.source.includes('function BrokenForm()'));
    for (const key of ['fullName', 'email', 'program']) assert.ok(item.allowedSynonyms[key]?.length);
  }
});
test('reference candidate scores when semantic labels are permitted', () => {
  const item = structuredClone(template);
  item.fields[0].label = 'Student legal name';
  item.fields[1].label = 'School email';
  item.fields[2].label = 'Study program';
  assert.equal(scoreCase(cases[0], item).passed, true);
});
test('valid but wrong labels fail independently', () => {
  const item = structuredClone(template);
  item.fields[0].label = 'Food preference';
  const result = scoreCase(cases[0], item);
  assert.equal(result.valid, true);
  assert.equal(result.passed, false);
  assert.deepEqual(result.issues, ['semantic_label:fullName']);
});
test('candidate with extra script field rejected', () => {
  const item = structuredClone(template);
  item.fields[0].handler = 'alert(1)';
  assert.equal(scoreCase(cases[0], item).valid, false);
});
test('summary counts failed attempts in denominator', () => {
  assert.deepEqual(summarize([{ caseId:'a',valid:true,passed:true,issues:[] },
    {caseId:'b',valid:false,passed:false,issues:['model_error']}]).passRate, 0.5);
});
test('prompt does not leak benchmark grading labels', () => {
  const prompt = createRepairPrompt(cases[0].source);
  assert.ok(!prompt.includes('Study program'));
  assert.ok(prompt.includes(cases[0].source));
});
