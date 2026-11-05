// Review the two distinct dependency graphs after tying the shipped runtime to
// its committed vendor bytes and generated plugin copy through offline checks.
import path from 'node:path';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { checkPluginPayload } from './plugin-payload.mjs';
import { reviewSecurity, runProcess } from './security-review.mjs';
import { reviewVendor } from './security-vendor.mjs';
import { checkVendor } from './vendor.mjs';

/** A graph failure must retain the independent verdict and any readable input identity. */
async function containGraph(lockfile, review) {
  try {
    return await review();
  } catch (error) {
    let lockfileHash = null;
    try {
      lockfileHash = `sha256:${createHash('sha256').update(fs.readFileSync(lockfile)).digest('hex')}`;
    } catch {
      // An unreadable input has no content hash; the graph error remains evidence.
    }
    const incomplete = { status: 'incomplete', error: error.message };
    return {
      ok: false,
      ...incomplete,
      lockfileHash,
      nodeVersion: process.version,
      npmVersion: null,
      vulnerabilities: incomplete,
      signatures: incomplete,
    };
  }
}

/** Run both graph reviews; a failed integrity check prevents aggregate success. */
export async function reviewRepository({ sourceRoot, scratchRoot, run = runProcess, out }) {
  const preflight = {
    vendor: checkVendor({ sourceRoot, out }),
    payload: checkPluginPayload({ sourceRoot, out }),
  };
  // The root package is the development graph; the plugin ships only its derived runtime manifest.
  const development = await containGraph(path.join(sourceRoot, 'package-lock.json'), () =>
    reviewSecurity({ cwd: sourceRoot, run }),
  );
  const runtime = await containGraph(path.join(sourceRoot, 'tools/vendor/package-lock.json'), () =>
    reviewVendor({ sourceRoot, scratchRoot, run }),
  );
  return {
    ok: preflight.vendor && preflight.payload && development.ok && runtime.ok,
    preflight,
    graphs: { development, runtime },
  };
}
