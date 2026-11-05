// The root package.json is the development manifest; the plugin payload ships a
// derived manifest with only its runtime fields, so a host that installs the
// plugin never sees the authoring toolchain.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { checkPluginPayload, generatePluginPayload, PAYLOAD_DIRECTORY, PAYLOAD_PARTS } from '../lib/plugin-payload.mjs';

const root = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const scratch = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'peer manifest é-')));
after(() => fs.rmSync(scratch, { recursive: true, force: true }));

const RUNTIME = {
  name: 'peer-skills-and-workflows',
  private: true,
  license: 'MIT',
  description: 'Runtime description.',
  engines: { node: '>=22' },
};
const DEVELOPMENT = {
  devEngines: { runtime: { name: 'node', version: '^22.13 || >=24', onFail: 'error' } },
  scripts: { lint: 'node tools/lint.mjs' },
  devDependencies: { eslint: '10.14.0' },
  overrides: { minimatch: '11.0.4' },
};

/** A copy of the payload sources whose root manifest carries development fields. */
function source(name, manifest) {
  const dir = path.join(scratch, name);
  for (const part of PAYLOAD_PARTS) {
    fs.cpSync(path.join(root, part), path.join(dir, part), {
      recursive: true,
      filter: (file) => !file.split(path.sep).includes('node_modules') || file.includes(`${path.sep}vendor${path.sep}`),
    });
  }
  fs.writeFileSync(path.join(dir, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return dir;
}

const payloadManifest = (dir) => path.join(dir, ...PAYLOAD_DIRECTORY.split('/'), 'package.json');

function collector() {
  const errors = [];
  return { errors, out: { info() {}, error: (line) => errors.push(line) } };
}

test('the payload manifest keeps only the runtime fields of the root manifest', () => {
  const dir = source('derived', { ...RUNTIME, ...DEVELOPMENT });
  generatePluginPayload(dir);
  const text = fs.readFileSync(payloadManifest(dir), 'utf8');
  assert.deepEqual(JSON.parse(text), RUNTIME, 'development fields are stripped and runtime fields kept');
  assert.ok(text.endsWith('}\n'), 'the derived manifest ends with one newline');
  const { errors, out } = collector();
  assert.equal(checkPluginPayload({ sourceRoot: dir, out }), true, `the derived payload is current: ${errors}`);
});

test('parity rejects a payload manifest that is a byte copy of the development manifest', () => {
  const dir = source('byte-copy', { ...RUNTIME, ...DEVELOPMENT });
  generatePluginPayload(dir);
  fs.copyFileSync(path.join(dir, 'package.json'), payloadManifest(dir));
  const { errors, out } = collector();
  assert.equal(checkPluginPayload({ sourceRoot: dir, out }), false, 'a copied development manifest is stale');
  assert.ok(
    errors.some((line) => line.includes('package.json')),
    `the diagnostic names package.json: ${errors}`,
  );
});

test('generation refuses a root manifest field it cannot classify as runtime or development', () => {
  const dir = source('unclassified', { ...RUNTIME, ...DEVELOPMENT, bin: { peer: 'tools/peer.mjs' } });
  assert.throws(() => generatePluginPayload(dir), /package\.json.*\bbin\b/);
  assert.equal(fs.existsSync(payloadManifest(dir)), false, 'nothing is generated');
  const { errors, out } = collector();
  assert.equal(checkPluginPayload({ sourceRoot: dir, out }), false, 'the check refuses it too');
  assert.ok(
    errors.some((line) => /\bbin\b/.test(line)),
    `the diagnostic names the field: ${errors}`,
  );
});
