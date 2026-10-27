// Disposable suites and source trees for the harness tests, built in a
// temporary directory. Imported, never run: this directory lies outside Node's
// test-file patterns.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const fakeEngine = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fake-engine.mjs');
/** The executable seam pointing both engines at the fake. */
export const fakeExecutables = { claude: [process.execPath, fakeEngine], codex: [process.execPath, fakeEngine] };

export function temporaryDirectory(label) {
  return fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), `aw skills ${label} é-`)));
}

export const SKILLS = ['clarify-artifact', 'write-for-humans', 'write-for-agents'];

/** A minimal source tree with the named skills and a shared reference. */
export function makeSource(root, skills = SKILLS) {
  for (const skill of skills) {
    fs.mkdirSync(path.join(root, 'skills', skill), { recursive: true });
    fs.writeFileSync(path.join(root, 'skills', skill, 'SKILL.md'), `---\nname: ${skill}\ndescription: fake ${skill}\n---\n\n# ${skill}\n`);
  }
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs', 'writing-guidance.md'), '# guidance\n');
  return root;
}

/**
 * Write a suite named `name` under `suitesRoot`. Each case gives its
 * directive (embedded in the prompt for the fake engine), its deterministic
 * expectations and semantic criteria, and optionally extra workspace files.
 */
export function makeSuite(suitesRoot, name, cases, { skills = SKILLS } = {}) {
  const dir = path.join(suitesRoot, name);
  fs.mkdirSync(path.join(dir, 'cases'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'suite.json'), JSON.stringify({ skill: skills[0], skills, cases: cases.map((caseDef) => caseDef.id) }, null, 2));
  for (const caseDef of cases) {
    const caseDir = path.join(dir, 'cases', caseDef.id);
    fs.mkdirSync(path.join(caseDir, 'workspace'), { recursive: true });
    fs.writeFileSync(path.join(caseDir, 'prompt.md'), `${caseDef.promptText ?? 'Do the task.'}\nFAKE-ENGINE: ${JSON.stringify(caseDef.directive ?? {})}\n`);
    const files = { 'README.md': 'fixture\n', ...(caseDef.files ?? {}) };
    for (const [relative, content] of Object.entries(files)) {
      const target = path.join(caseDir, 'workspace', ...relative.split('/'));
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, content);
    }
    fs.writeFileSync(path.join(caseDir, 'case.json'), JSON.stringify({
      id: caseDef.id,
      effect: caseDef.effect ?? `effect of ${caseDef.id}`,
      deterministic: caseDef.deterministic ?? { exit: 0, skillReads: {}, premise: [], writes: {} },
      semantic: caseDef.semantic ?? [],
    }, null, 2));
  }
  return dir;
}
