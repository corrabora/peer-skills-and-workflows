// Canonical owners and their generated, skill-local reading paths.
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export const REGENERATE_REFERENCES = 'node tools/generate-writing-references.mjs';
const OWNERS = {
  'writing-guidance.md': 'docs/writing-guidance.md',
  'adr-format.md': 'docs/guidance/adr-format.md',
  'glossary-format.md': 'docs/guidance/glossary-format.md',
  'record-format-adoption.md': 'docs/guidance/record-format-adoption.md',
};
const LAYOUT = {
  'write-for-humans': ['writing-guidance.md'],
  'write-for-agents': ['writing-guidance.md'],
  'record-decision': ['writing-guidance.md', 'adr-format.md', 'record-format-adoption.md'],
  'maintain-glossary': ['writing-guidance.md', 'glossary-format.md', 'record-format-adoption.md'],
};
const REWRITES = {
  'record-decision/adr-format.md': {
    '../../skills/record-decision/SKILL.md#when-to-offer-an-adr': '../SKILL.md#when-to-offer-an-adr',
  },
  'record-decision/record-format-adoption.md': {
    'glossary-format.md': '../../maintain-glossary/references/glossary-format.md',
  },
  'maintain-glossary/record-format-adoption.md': {
    'adr-format.md': '../../record-decision/references/adr-format.md',
  },
};
export const WRITING_REFERENCES = Object.entries(LAYOUT).flatMap(([skill, names]) => names.map((name) => ({
  skill, name, source: OWNERS[name], file: `skills/${skill}/references/${name}`,
  rewrites: REWRITES[`${skill}/${name}`] ?? {},
})));

function ownerBody(root, reference) {
  const file = path.join(root, reference.source);
  if (!fs.statSync(file).isFile()) throw new Error(`${reference.source} is not a regular file`);
  return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(fs.readFileSync(file));
}

/** Only the three registered Markdown link targets change in generated bodies. */
export function renderReference(root, reference) {
  let body = ownerBody(root, reference);
  for (const [from, to] of Object.entries(reference.rewrites)) body = body.replaceAll(`](${from})`, `](${to})`);
  const header = `<!-- Generated from ${reference.source}. -->\n`;
  return { header, body, bytes: Buffer.from(header + body, 'utf8') };
}

/** Inspect the actual local entry; owner/provenance and body are checked separately. */
export function referenceProblem(root, reference, file = path.join(root, reference.file)) {
  try {
    if (!fs.lstatSync(file).isFile()) return 'must be a regular generated file';
    const actual = fs.readFileSync(file);
    const expected = renderReference(root, reference);
    const header = Buffer.from(expected.header, 'utf8');
    if (!actual.subarray(0, header.length).equals(header)) return `generated-from header must name ${reference.source}`;
    if (!actual.subarray(header.length).equals(Buffer.from(expected.body, 'utf8'))) return `body differs from ${reference.source} after its registered link rewrites`;
    return null;
  } catch (error) {
    return `${error.code ?? 'error'}: ${error.message}`;
  }
}

export function checkWritingReferences({ sourceRoot, out }) {
  let ok = true;
  for (const reference of WRITING_REFERENCES) {
    const problem = referenceProblem(sourceRoot, reference);
    if (problem) { out.error(`FAIL    ${reference.file}: ${problem}; run ${REGENERATE_REFERENCES}`); ok = false; }
  }
  if (ok) out.info('ok      generated writing references match their owners');
  return ok;
}

function optionalStat(file) {
  try { return fs.lstatSync(file, { bigint: true }); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
const identity = (stat) => `${stat.dev}:${stat.ino}`;

/** Plan every read and destination before the first write; preserve canonical owners. */
export function generateWritingReferences(sourceRoot) {
  const root = fs.realpathSync.native(sourceRoot);
  const planned = WRITING_REFERENCES.map((reference) => ({ reference, ...renderReference(root, reference) }));
  const ownerIds = new Set(Object.values(OWNERS).map((file) => identity(fs.statSync(path.join(root, file), { bigint: true }))));
  const outputIds = new Set();
  for (const { reference } of planned) {
    const parts = reference.file.split('/');
    for (let n = 1; n < parts.length; n++) {
      const parent = path.join(root, ...parts.slice(0, n));
      const stat = optionalStat(parent);
      if (stat && (!stat.isDirectory() || stat.isSymbolicLink())) throw new Error(`${parts.slice(0, n).join('/')} must be a real directory`);
    }
    const stat = optionalStat(path.join(root, ...parts));
    if (!stat) continue;
    if (!stat.isFile()) throw new Error(`${reference.file} must be a regular generated file`);
    const id = identity(stat);
    if (ownerIds.has(id)) throw new Error(`${reference.file} aliases a canonical owner`);
    if (outputIds.has(id)) throw new Error(`${reference.file} aliases another generated output`);
    outputIds.add(id);
  }
  const changed = [];
  for (const { reference, bytes } of planned) {
    const file = path.join(root, reference.file);
    if (fs.existsSync(file) && fs.readFileSync(file).equals(bytes)) continue;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temporary = path.join(path.dirname(file), `.${reference.name}.${randomUUID()}.tmp`);
    try {
      fs.writeFileSync(temporary, bytes, { flag: 'wx', mode: 0o644 });
      fs.renameSync(temporary, file);
    } finally {
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    }
    changed.push(reference.file);
  }
  return changed;
}
