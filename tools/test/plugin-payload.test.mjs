// The checked-in plugin payload is generated; the complete gate must reject
// any difference from what its authoring sources generate.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { generatePluginPayload, PAYLOAD_DIRECTORY, PAYLOAD_PARTS } from '../lib/plugin-payload.mjs';
import { checkPluginPackage } from '../lib/plugin-package.mjs';

const root = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const scratch = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'peer payload é-')));
after(() => fs.rmSync(scratch, { recursive: true, force: true }));

test('the complete gate rejects a payload that differs from its authoring sources', async (t) => {
  const payloadModule = await import('../lib/plugin-payload.mjs');
  assert.equal(typeof payloadModule.checkPluginPayload, 'function', 'the payload generator needs a read-only check');
  assert.match(fs.readFileSync(path.join(root, 'tools/verify.mjs'), 'utf8'), /checkPluginPayload\(/, 'verify runs the payload check');
  const cli = spawnSync(process.execPath, [path.join(root, 'tools/generate-plugin.mjs'), '--check'], { encoding: 'utf8' });
  assert.equal(cli.status, 0, `the checked-in payload is current: ${cli.stdout}${cli.stderr}`);

  const source = path.join(scratch, 'source');
  for (const part of PAYLOAD_PARTS) fs.cpSync(path.join(root, part), path.join(source, part), { recursive: true });
  const payload = path.join(source, ...PAYLOAD_DIRECTORY.split('/'));
  const errors = [];
  const out = { info() {}, error(message) { errors.push(message); } };
  const mutations = {
    changedByte: () => fs.appendFileSync(path.join(payload, 'skills/peer-review/SKILL.md'), ' '),
    staleSource: () => fs.appendFileSync(path.join(source, 'workflow/RECORDS.md'), '\n'),
    extraFile: () => fs.writeFileSync(path.join(payload, 'skills/stray.md'), 'stray\n'),
    missingFile: () => fs.rmSync(path.join(payload, 'workflow/RECORDS.md')),
    executableBit: () => fs.chmodSync(path.join(payload, 'tools/successor.mjs'), 0o755),
  };
  for (const [name, mutate] of Object.entries(mutations)) {
    await t.test(name, () => {
      generatePluginPayload(source);
      errors.length = 0;
      assert.equal(payloadModule.checkPluginPayload({ sourceRoot: source, out }), true, `fresh payload: ${errors.join('\n')}`);
      mutate();
      errors.length = 0;
      assert.equal(payloadModule.checkPluginPayload({ sourceRoot: source, out }), false, `${name} must fail the payload check`);
      assert.ok(errors.some((line) => line.includes(PAYLOAD_DIRECTORY)), `${name} needs a diagnostic naming the payload: ${errors.join('\n')}`);
    });
  }
});

test('package validation rejects a runtime reference omitted from an otherwise current payload', () => {
  const source = path.join(scratch, 'runtime-reference');
  for (const part of PAYLOAD_PARTS) fs.cpSync(path.join(root, part), path.join(source, part), { recursive: true });
  for (const catalog of ['.agents/plugins/marketplace.json', '.claude-plugin/marketplace.json']) {
    const destination = path.join(source, catalog);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(root, catalog), destination);
  }
  fs.writeFileSync(path.join(source, 'docs/runtime-required.md'), 'Required runtime guidance.\n');
  fs.appendFileSync(path.join(source, 'skills/peer-review/SKILL.md'), '\nRead [runtime guidance](../../docs/runtime-required.md).\n');
  generatePluginPayload(source);
  const errors = [];
  assert.equal(checkPluginPackage({ sourceRoot: source, out: { info() {}, error(message) { errors.push(message); } } }), false,
    'a valid source link must also resolve inside the installed payload');
  assert.ok(errors.some((line) => line.includes('runtime-required.md')), errors.join('\n'));
});

test('runtime reference traversal rejects an aliased target before reading it', () => {
  const source = path.join(scratch, 'runtime-alias');
  for (const part of PAYLOAD_PARTS) fs.cpSync(path.join(root, part), path.join(source, part), { recursive: true });
  for (const catalog of ['.agents/plugins/marketplace.json', '.claude-plugin/marketplace.json']) {
    const destination = path.join(source, catalog);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(root, catalog), destination);
  }
  generatePluginPayload(source);
  const payload = path.join(source, PAYLOAD_DIRECTORY);
  const outside = path.join(scratch, 'outside-runtime.md');
  const alias = path.join(payload, 'docs/aliased.md');
  fs.writeFileSync(outside, 'This content must not be read.\n');
  fs.symlinkSync(outside, alias);
  fs.appendFileSync(path.join(payload, 'skills/peer-review/SKILL.md'), '\nRead [guidance](../../docs/aliased.md).\n');
  const readFile = fs.readFileSync;
  let aliasedReads = 0;
  fs.readFileSync = (file, ...args) => {
    if (file === alias || file === outside) aliasedReads++;
    return readFile(file, ...args);
  };
  try {
    assert.equal(checkPluginPackage({ sourceRoot: source, out: { info() {}, error() {} } }), false);
    assert.equal(aliasedReads, 0, 'validation must reject the alias before reading its content');
  } finally { fs.readFileSync = readFile; }
});

test('generation refuses linked source ancestors and output paths before writing', async (t) => {
  for (const kind of ['sourceAncestor', 'outputAncestor', 'outputRoot', 'outputMember']) {
    await t.test(kind, () => {
      const source = path.join(scratch, kind);
      for (const part of PAYLOAD_PARTS) fs.cpSync(path.join(root, part), path.join(source, part), { recursive: true });
      generatePluginPayload(source);
      const payload = path.join(source, PAYLOAD_DIRECTORY);
      const outside = path.join(scratch, `${kind}-outside`);
      const linked = {
        sourceAncestor: path.join(source, '.codex-plugin'),
        outputAncestor: path.join(source, 'plugins'),
        outputRoot: payload,
        outputMember: path.join(payload, 'skills'),
      }[kind];
      fs.renameSync(linked, outside);
      fs.symlinkSync(outside, linked, 'junction');
      const sentinel = path.join(outside, 'retained-sentinel');
      fs.writeFileSync(sentinel, 'do not modify\n');
      assert.throws(() => generatePluginPayload(source), /link|symbolic|regular|alias/i,
        `${kind}: reject the alias before replacing any output`);
      assert.equal(fs.readFileSync(sentinel, 'utf8'), 'do not modify\n');
      assert.equal(fs.lstatSync(linked).isSymbolicLink(), true, 'the rejected path remains untouched');
      assert.equal(fs.existsSync(path.join(source, 'plugins')), true);
    });
  }
});
