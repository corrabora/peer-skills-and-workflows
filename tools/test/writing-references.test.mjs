import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { WRITING_REFERENCES, generateWritingReferences, checkWritingReferences } from '../lib/writing-references.mjs';
import { checkReferences } from '../lib/install.mjs';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'aw-generated-references-'));
after(() => fs.rmSync(scratch, { recursive: true, force: true }));
function fixture(name) {
  const root = path.join(scratch, name); fs.mkdirSync(root);
  for (const file of new Set(WRITING_REFERENCES.flatMap((r) => [r.source, `skills/${r.skill}/SKILL.md`]))) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.copyFileSync(path.join(packageRoot, file), path.join(root, file));
  }
  return root;
}
function check(root) {
  const errors = []; const out = { info() {}, error: (line) => errors.push(line) };
  return { ok: checkWritingReferences({ sourceRoot: root, out }), errors };
}
const bodies = (root) => Object.fromEntries([...new Set(WRITING_REFERENCES.map((r) => r.source))].map((file) => [file, fs.readFileSync(path.join(root, file)).toString('base64')]));

test('generation preserves owners, is deterministic, and resolves the three relocated links', () => {
  const root = fixture('complete'); const before = bodies(root);
  assert.equal(generateWritingReferences(root).length, 8);
  assert.deepEqual(generateWritingReferences(root), []);
  assert.deepEqual(bodies(root), before);
  for (const r of WRITING_REFERENCES) assert.ok(fs.lstatSync(path.join(root, r.file)).isFile());
  assert.equal(check(root).ok, true);
  const read = (skill, name) => fs.readFileSync(path.join(root, 'skills', skill, 'references', name), 'utf8');
  assert.match(read('record-decision', 'adr-format.md'), /\]\(\.\.\/SKILL\.md#when-to-offer-an-adr\)/);
  assert.match(read('record-decision', 'record-format-adoption.md'), /\]\(\.\.\/\.\.\/maintain-glossary\/references\/glossary-format\.md\)/);
  assert.match(read('maintain-glossary', 'record-format-adoption.md'), /\]\(\.\.\/\.\.\/record-decision\/references\/adr-format\.md\)/);
  const errors = [];
  assert.equal(checkReferences({ sourceRoot: root, files: WRITING_REFERENCES.map((r) => path.join(root, r.file)), out: { info() {}, error: (x) => errors.push(x) } }), true, errors.join('\n'));
});

test('checks name drift and regeneration without writing; regeneration updates every affected reader', () => {
  const root = fixture('drift'); generateWritingReferences(root);
  const first = path.join(root, WRITING_REFERENCES[0].file); const original = fs.readFileSync(first);
  fs.appendFileSync(path.join(root, 'docs/writing-guidance.md'), '\nOwner addition.\n');
  const result = check(root);
  assert.equal(result.ok, false); assert.equal(result.errors.length, 4);
  assert.ok(result.errors.every((x) => x.includes('node tools/generate-writing-references.mjs')));
  assert.deepEqual(fs.readFileSync(first), original, 'check is read-only');
  assert.equal(generateWritingReferences(root).length, 4); assert.equal(check(root).ok, true);
  fs.unlinkSync(first); assert.equal(check(root).ok, false); generateWritingReferences(root);
  fs.writeFileSync(first, fs.readFileSync(first, 'utf8').replace('Generated from docs/', 'Generated from wrong/'));
  assert.match(check(root).errors[0], /generated-from header/);
  generateWritingReferences(root); assert.equal(check(root).ok, true);
});

test('a missing late owner stops before any generated directory is created', () => {
  const root = fixture('missing'); fs.unlinkSync(path.join(root, 'docs/guidance/glossary-format.md'));
  assert.throws(() => generateWritingReferences(root), /ENOENT/);
  assert.ok(!fs.existsSync(path.join(root, 'skills/write-for-humans/references')));
});

test('a generated output hard-linked to an owner stops the whole write plan', () => {
  const root = fixture('owner-hardlink'); generateWritingReferences(root); const before = bodies(root);
  const first = path.join(root, WRITING_REFERENCES[0].file); fs.unlinkSync(first);
  const last = path.join(root, WRITING_REFERENCES.at(-1).file); fs.unlinkSync(last);
  fs.linkSync(path.join(root, WRITING_REFERENCES.at(-1).source), last);
  assert.throws(() => generateWritingReferences(root), /aliases a canonical owner/);
  assert.ok(!fs.existsSync(first), 'no earlier output written'); assert.deepEqual(bodies(root), before);
});

test('hard-linked outputs stop before repair of an earlier missing output', () => {
  const root = fixture('output-hardlink'); generateWritingReferences(root);
  const first = path.join(root, WRITING_REFERENCES[0].file); fs.unlinkSync(first);
  const last = path.join(root, WRITING_REFERENCES.at(-1).file); fs.unlinkSync(last);
  fs.linkSync(path.join(root, WRITING_REFERENCES[1].file), last);
  assert.throws(() => generateWritingReferences(root), /aliases another generated output/);
  assert.ok(!fs.existsSync(first));
});

test('linked reference directories stop before any output is written', (t) => {
  const root = fixture('linked-directory'); const before = bodies(root);
  const elsewhere = path.join(scratch, 'elsewhere'); fs.mkdirSync(elsewhere);
  const destination = path.join(root, 'skills', WRITING_REFERENCES.at(-1).skill, 'references');
  try { fs.symlinkSync(elsewhere, destination, process.platform === 'win32' ? 'junction' : 'dir'); }
  catch (error) { if (error.code === 'EPERM') { t.skip('host forbids directory links'); return; } throw error; }
  assert.throws(() => generateWritingReferences(root), /must be a real directory/);
  assert.deepEqual(fs.readdirSync(elsewhere), []); assert.deepEqual(bodies(root), before);
  assert.ok(!fs.existsSync(path.join(root, 'skills/write-for-humans/references')));
});
