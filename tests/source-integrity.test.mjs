import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { prepareSourcePatch, SOURCE_PATH } from '../scripts/source-patch.mjs';
import { inspectPatch } from '../scripts/source-browser-verify.mjs';

const root = resolve(new URL('../', import.meta.url).pathname);
const fixture = JSON.parse(await readFile(resolve(root, 'tests/fixtures/known-repair.json'), 'utf8'));
const original = await readFile(resolve(root, SOURCE_PATH), 'utf8');

async function prepared() {
  const dir = await mkdtemp(join(tmpdir(), 'formforge-evidence-'));
  await mkdir(join(dir, 'src/fixtures'), { recursive: true });
  await writeFile(join(dir, SOURCE_PATH), original);
  await prepareSourcePatch(fixture, { root: dir });
  return dir;
}

test('generated source fixture, diff and preview are hash-bound', async () => {
  const dir = await prepared();
  const result = await inspectPatch(dir);
  assert.equal(result.manifest.approved, false);
  assert.equal(result.manifest.checks.browser, false);
});

test('tampered generated JSX cannot be browser-approved', async () => {
  const dir = await prepared();
  await writeFile(join(dir, 'repair-artifacts/ScholarshipForm.jsx'), 'export default function ScholarshipForm(){return null;}');
  await assert.rejects(() => inspectPatch(dir), /integrity/);
});

test('tampered browser preview cannot be browser-approved', async () => {
  const dir = await prepared();
  await writeFile(join(dir, 'repair-artifacts/preview.html'), '<h1>fake success</h1>');
  await assert.rejects(() => inspectPatch(dir), /integrity/);
});

test('changed original source makes evidence stale', async () => {
  const dir = await prepared();
  await writeFile(join(dir, SOURCE_PATH), original + '\n// modification');
  await assert.rejects(() => inspectPatch(dir), /integrity/);
});
