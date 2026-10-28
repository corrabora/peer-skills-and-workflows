// The vendored tree under tools/vendor is the package's only runtime
// dependency source, so a host that installs from the root package (as Claude
// Code runs `npm ci` there) neither needs the network nor adds a second copy.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const json = (relative) => JSON.parse(fs.readFileSync(path.join(packageRoot, relative), 'utf8'));
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'peer-vendor-'));
after(() => fs.rmSync(scratch, { recursive: true, force: true }));

test('runtime dependencies are declared and locked only under tools/vendor', () => {
  const vendor = json('tools/vendor/package.json');
  assert.deepEqual(Object.keys(vendor.dependencies).sort(), ['ajv', 'yaml']);
  const root = json('package.json');
  assert.equal(root.dependencies, undefined, 'the root package declares no runtime dependencies');
  assert.equal(fs.existsSync(path.join(packageRoot, 'package-lock.json')), false, 'the root package has no lockfile for a host to install from');
});

test('offline vendor verification detects payload, version, membership and provenance drift', async (t) => {
  const verifier = path.join(packageRoot, 'tools/lib/vendor.mjs');
  assert.ok(fs.existsSync(verifier), 'the package needs an offline vendor verifier');
  const { checkVendor } = await import(verifier);
  const errors = [];
  const out = { info() {}, error(message) { errors.push(message); } };
  assert.equal(checkVendor({ sourceRoot: packageRoot, out }), true, errors.join('\n'));
  const mutations = {
    edited(root) { fs.appendFileSync(path.join(root, 'tools/vendor/node_modules/yaml/dist/index.js'), '\n// drift\n'); },
    missing(root) { fs.unlinkSync(path.join(root, 'tools/vendor/node_modules/yaml/LICENSE')); },
    extra(root) { fs.writeFileSync(path.join(root, 'tools/vendor/node_modules/unexpected.txt'), 'drift'); },
    inheritedName(root) { fs.writeFileSync(path.join(root, 'tools/vendor/node_modules/constructor'), 'drift'); },
    version(root) {
      const file = path.join(root, 'tools/vendor/node_modules/yaml/package.json');
      const value = JSON.parse(fs.readFileSync(file, 'utf8')); value.version = '0.0.0';
      fs.writeFileSync(file, JSON.stringify(value));
    },
    provenance(root) {
      const file = path.join(root, 'tools/vendor/package-lock.json');
      const value = JSON.parse(fs.readFileSync(file, 'utf8'));
      delete value.packages['node_modules/yaml'].integrity;
      fs.writeFileSync(file, JSON.stringify(value));
    },
    membership(root) {
      const file = path.join(root, 'tools/vendor/package-lock.json');
      const value = JSON.parse(fs.readFileSync(file, 'utf8'));
      delete value.packages['node_modules/require-from-string'];
      fs.writeFileSync(file, JSON.stringify(value));
    },
    lockInput(root) {
      const file = path.join(root, 'tools/vendor/package-lock.json');
      const value = JSON.parse(fs.readFileSync(file, 'utf8'));
      value.packages['node_modules/yaml'].resolved = 'https://registry.example.test/yaml.tgz';
      fs.writeFileSync(file, JSON.stringify(value));
    },
  };
  for (const [name, mutate] of Object.entries(mutations)) {
    await t.test(name, () => {
      const root = path.join(scratch, name);
      fs.mkdirSync(root);
      fs.copyFileSync(path.join(packageRoot, 'package.json'), path.join(root, 'package.json'));
      fs.cpSync(path.join(packageRoot, 'tools/vendor'), path.join(root, 'tools/vendor'), { recursive: true });
      mutate(root);
      errors.length = 0;
      assert.equal(checkVendor({ sourceRoot: root, out }), false, `${name} must fail offline verification`);
      assert.ok(errors.length, `${name} needs an actionable diagnostic`);
    });
  }
});

test('regeneration checks the current payload and preserves aliased inputs before installation', async (t) => {
  // Supply a controlled installer in a child process. These checks need neither
  // npm nor a network; the marker proves whether an installer was invoked.
  const preload = path.join(scratch, 'installer.mjs');
  fs.writeFileSync(preload, `import fs from 'node:fs';
import path from 'node:path';
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
childProcess.spawnSync = (command, args, options) => {
  fs.writeFileSync(process.env.PEER_INSTALL_MARKER, 'invoked');
  fs.cpSync(process.env.PEER_INSTALL_PAYLOAD, path.join(options.cwd, 'node_modules'), { recursive: true });
  return { status: 0, stderr: '' };
};
syncBuiltinESMExports();
`);
  const program = `import { generateVendor } from ${JSON.stringify(new URL('../lib/vendor.mjs', import.meta.url).href)};
try {
  const ok = generateVendor({ sourceRoot: process.argv[1], check: process.argv[2] === 'check', cache: process.argv[3] || undefined, out: { info() {}, error: console.error } });
  process.exitCode = ok ? 0 : 1;
} catch (error) { console.error(error.message); process.exitCode = 1; }
`;
  for (const name of ['current-payload', 'cache-overlap', 'vendor-symlink', 'manifest-hardlink']) {
    await t.test(name, () => {
      const root = path.join(scratch, `generate-${name}`);
      fs.mkdirSync(root);
      fs.copyFileSync(path.join(packageRoot, 'package.json'), path.join(root, 'package.json'));
      const vendor = path.join(root, 'tools/vendor');
      fs.cpSync(path.join(packageRoot, 'tools/vendor'), vendor, { recursive: true });
      const marker = path.join(scratch, `${name}-installer.txt`);
      let cache = '';
      if (name === 'current-payload') fs.appendFileSync(path.join(vendor, 'node_modules/yaml/dist/index.js'), '\n// drift\n');
      if (name === 'cache-overlap') cache = vendor;
      if (name === 'vendor-symlink') {
        const destination = path.join(scratch, 'linked-vendor');
        fs.renameSync(vendor, destination);
        fs.symlinkSync(destination, vendor, process.platform === 'win32' ? 'junction' : 'dir');
      }
      const lock = path.join(vendor, 'package-lock.json');
      const before = fs.readFileSync(lock);
      if (name === 'manifest-hardlink') {
        fs.unlinkSync(path.join(vendor, 'manifest.json'));
        fs.linkSync(lock, path.join(vendor, 'manifest.json'));
      }
      const result = spawnSync(process.execPath, ['--import', preload, '--input-type=module', '-e', program, root, name === 'current-payload' ? 'check' : 'generate', cache], {
        input: '', encoding: 'utf8',
        env: { ...process.env, PEER_INSTALL_MARKER: marker, PEER_INSTALL_PAYLOAD: path.join(packageRoot, 'tools/vendor/node_modules') },
      });
      assert.ifError(result.error);
      assert.ok(fs.readFileSync(lock).equals(before), 'regeneration preserves lockfile input bytes');
      if (name !== 'manifest-hardlink') assert.equal(result.status, 1, `${name}: ${result.stderr}`);
      if (['cache-overlap', 'vendor-symlink'].includes(name)) {
        assert.equal(fs.existsSync(marker), false, 'unsafe locations are refused before invoking an installer');
      }
    });
  }
});
