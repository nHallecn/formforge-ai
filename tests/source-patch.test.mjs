import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { compileRepair, prepareSourcePatch, sha256, unifiedDiff, SOURCE_PATH } from '../scripts/source-patch.mjs';

const root = resolve(new URL('../', import.meta.url).pathname);
const known = JSON.parse(await readFile(resolve(root, 'tests/fixtures/known-repair.json'), 'utf8'));
const original = await readFile(resolve(root, SOURCE_PATH), 'utf8');

test('valid candidate produces syntactically checked review-only patch without touching source', async () => {
  const tmp = await mkdtemp(join(tmpdir(), 'formforge-patch-'));
  await mkdir(join(tmp, 'src/fixtures'), { recursive: true });
  const { writeFile } = await import('node:fs/promises');
  await writeFile(join(tmp, SOURCE_PATH), original);
  const manifest = await prepareSourcePatch(structuredClone(known), { root: tmp });
  const after = await readFile(join(tmp, SOURCE_PATH), 'utf8');
  const changed = await readFile(join(tmp, 'repair-artifacts/ScholarshipForm.jsx'), 'utf8');
  const patch = await readFile(join(tmp, 'repair-artifacts/ScholarshipForm.patch'), 'utf8');
  assert.equal(after, original);
  assert.equal(manifest.originalSha256, sha256(original));
  assert.equal(manifest.candidateSha256, sha256(changed));
  assert.equal(manifest.patchSha256, sha256(patch));
  assert.deepEqual(manifest.checks, { schema: true, jsxSyntax: true, browser: false });
  assert.equal(manifest.approved, false);
  assert.ok(patch.startsWith('--- a/' + SOURCE_PATH + '\n+++ b/' + SOURCE_PATH));
  assert.ok(changed.includes('onSubmit='));
});

test('invalid model data cannot generate executable callback', () => {
  const candidate = structuredClone(known);
  candidate.fields[0].onClick = 'fetch("https://evil.test")';
  assert.throws(() => compileRepair(candidate), /Invalid field definition/);
});

test('JS code-shaped labels cannot escape the declarative contract', () => {
  const candidate = structuredClone(known);
  candidate.fields[0].label = '<img onerror=alert(1)>';
  assert.throws(() => compileRepair(candidate), /Invalid field definition/);
});

test('patch refuses arbitrary repository destination', () => {
  assert.throws(() => unifiedDiff('a\n', 'b\n', '../other.jsx'), /authorized fixture/);
});

test('changed source fixture fails closed', async () => {
  const tmp = await mkdtemp(join(tmpdir(), 'formforge-changed-'));
  await mkdir(join(tmp, 'src/fixtures'), { recursive: true });
  const { writeFile } = await import('node:fs/promises');
  await writeFile(join(tmp, SOURCE_PATH), 'export default function ScholarshipForm() {}\n');
  await assert.rejects(() => prepareSourcePatch(known, { root: tmp }), /preconditions changed/);
});
