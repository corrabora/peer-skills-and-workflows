// Security review of the shipped runtime graph. tools/vendor holds installed
// bytes without npm's hidden lockfile, which `npm audit signatures` needs to
// prove coverage, and npm must never write inside the committed tree. So the
// review installs the vendor lockfile in isolated staging, requires the result
// to reproduce the committed vendor manifest byte for byte, and only then
// scans that staged graph as the shipped one.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { canonical, isWithin } from './paths.mjs';
import { reviewSecurity, runProcess } from './security-review.mjs';
import { VENDOR, vendorManifest } from './vendor.mjs';

const INPUTS = ['package.json', 'package-lock.json'];
const HIDDEN_LOCK = '.package-lock.json';

/** Staged files that differ from, are missing from or are absent in the recorded manifest. */
function differences(recorded, staged) {
  const problems = [];
  for (const [file, hash] of Object.entries(recorded)) {
    if (!Object.hasOwn(staged, file)) problems.push(`missing ${file}`);
    else if (staged[file] !== hash) problems.push(`changed ${file}`);
  }
  for (const file of Object.keys(staged)) if (!Object.hasOwn(recorded, file)) problems.push(`unexpected ${file}`);
  return problems;
}

const notRun = (reason) => ({ status: 'not-run', reason });

/**
 * Install, reproduce and review the runtime graph locked in tools/vendor.
 * @param {{sourceRoot: string, scratchRoot: string, run?: typeof runProcess}} options
 */
export async function reviewVendor({ sourceRoot, scratchRoot, run = runProcess }) {
  const root = canonical(sourceRoot);
  const vendor = path.join(root, VENDOR);
  fs.mkdirSync(scratchRoot, { recursive: true });
  const staging = fs.realpathSync.native(fs.mkdtempSync(path.join(scratchRoot, 'vendor-graph-')));
  try {
    if (isWithin(root, staging)) throw new Error(`staging directory ${staging} lies inside ${root}`);
    for (const file of INPUTS) fs.copyFileSync(path.join(vendor, file), path.join(staging, file));
    const lockfileHash = `sha256:${createHash('sha256')
      .update(fs.readFileSync(path.join(staging, 'package-lock.json')))
      .digest('hex')}`;
    const args = ['ci', '--ignore-scripts', '--no-bin-links', '--no-audit', '--no-fund'];
    let install;
    try {
      install = await run('npm', [...args, `--cache=${path.join(staging, '.npm-cache')}`], { cwd: staging });
    } catch (error) {
      install = { status: null, signal: null, stdout: '', stderr: String(error.message), unavailable: true };
    }
    if (
      install.status !== 0 ||
      install.signal ||
      install.timedOut ||
      install.outputLimitExceeded ||
      install.unavailable
    ) {
      const { status: exitStatus, ...evidence } = install;
      const reproduction = { status: 'install-failure', exitStatus, ...evidence };
      const reason = 'the runtime graph could not be installed';
      return { ok: false, lockfileHash, reproduction, vulnerabilities: notRun(reason), signatures: notRun(reason) };
    }
    const recorded = JSON.parse(fs.readFileSync(path.join(vendor, 'manifest.json'), 'utf8')).files;
    const { files } = vendorManifest(vendor, path.join(staging, 'node_modules'));
    delete files[HIDDEN_LOCK];
    const problems = differences(recorded, files);
    if (problems.length) {
      const reproduction = { status: 'mismatch', differences: problems };
      const reason = 'the staged install does not reproduce the shipped bytes';
      return { ok: false, lockfileHash, reproduction, vulnerabilities: notRun(reason), signatures: notRun(reason) };
    }
    const review = await reviewSecurity({ cwd: staging, run });
    return { ...review, reproduction: { status: 'passed', files: Object.keys(files).length } };
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
}
