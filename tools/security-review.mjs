#!/usr/bin/env node
// Print evidence for the development and shipped-runtime dependency graphs.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { sourceRoot, usage } from './lib/cli.mjs';
import { reviewRepository } from './lib/security-repository.mjs';

if (process.argv.length !== 2) usage('node tools/security-review.mjs');

const diagnostic = (line) => process.stderr.write(`${line}\n`);
let scratchRoot;
try {
  scratchRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'peer-security-'));
  const result = await reviewRepository({
    sourceRoot,
    scratchRoot,
    out: { info: diagnostic, error: diagnostic },
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  for (const [name, graph] of Object.entries(result.graphs)) {
    const reproduction = graph.reproduction ? `reproduction ${graph.reproduction.status}; ` : '';
    diagnostic(
      `${name}: ${reproduction}vulnerabilities ${graph.vulnerabilities.status}; signatures ${graph.signatures.status}`,
    );
    if (graph.error) diagnostic(`${name}: ${graph.status}: ${graph.error}`);
    for (const finding of graph.vulnerabilities.findings ?? []) {
      diagnostic(`${name}: ${finding.name}: ${finding.severity} (${finding.exposure.join(', ')})`);
    }
    for (const [probe, evidence] of Object.entries(graph.identityFailures ?? {})) {
      diagnostic(`${name}: identity ${probe}: ${evidence.reason}`);
    }
  }
  process.exitCode = result.ok ? 0 : 1;
} catch (error) {
  process.stdout.write(`${JSON.stringify({ ok: false, status: 'incomplete', error: error.message })}\n`);
  diagnostic(`security: incomplete: ${error.message}`);
  process.exitCode = 1;
} finally {
  if (scratchRoot) fs.rmSync(scratchRoot, { recursive: true, force: true });
}
