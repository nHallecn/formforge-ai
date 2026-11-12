import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateRepair, extractJsonResponse } from '../scripts/repair-contract.mjs';

const known = JSON.parse(readFileSync(new URL('./fixtures/known-repair.json', import.meta.url), 'utf8'));
const clone = () => structuredClone(known);

test('accepts the known reference artifact', () => assert.equal(validateRepair(clone()).version, 1));
test('rejects removed fields', () => {
  const item = clone(); item.fields.pop();
  assert.throws(() => validateRepair(item), /preserved/);
});
test('rejects changed program option', () => {
  const item = clone(); item.fields[2].options[0].value = 'different';
  assert.throws(() => validateRepair(item), /option/);
});
test('rejects executable payload fields', () => {
  const item = clone(); item.fields[0].onClick = 'fetch("https://example.com")';
  assert.throws(() => validateRepair(item), /definition/);
});
test('rejects invalid email input type', () => {
  const item = clone(); item.fields[1].type = 'text';
  assert.throws(() => validateRepair(item), /Email/);
});
test('rejects malformed or oversized JSON', () => {
  assert.throws(() => extractJsonResponse('{not-json}'));
  assert.throws(() => extractJsonResponse('x'.repeat(16001)), /size/);
});
