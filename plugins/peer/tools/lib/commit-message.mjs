// Local policy and enforcement limits: docs/guidance/conventional-commits.md.
// Pure detection; the CLI supplies Git's cleaned message and candidate paths.

import path from 'node:path';

export const COMMIT_TYPES = Object.freeze([
  'build', 'chore', 'ci', 'docs', 'feat', 'fix', 'perf', 'refactor', 'revert', 'style', 'test',
]);

const HEADER = /^(?<type>[a-z]+)(?:\((?<scope>[a-z0-9][a-z0-9._/-]*)\))?(?<breaking>!)?: (?<description>\S.*)$/u;
// A bounded heuristic, not an English parser. Also applied to subjects here.
const NON_IMPERATIVE = new Set([
  'added', 'adding', 'adds', 'changed', 'changes', 'changing',
  'created', 'creates', 'creating', 'documented', 'documenting', 'documents',
  'fixed', 'fixes', 'fixing', 'implemented', 'implements', 'implementing',
  'made', 'makes', 'making', 'moved', 'moves', 'moving',
  'refactored', 'refactoring', 'refactors', 'removed', 'removes', 'removing',
  'renamed', 'renames', 'renaming', 'used', 'uses', 'using',
  'updated', 'updates', 'updating', 'wired', 'wires', 'wiring',
]);

function imperative(text, minimumWords) {
  const words = text.split(/\s+/u);
  return /^[a-z]/u.test(text) && words.length >= minimumWords && !NON_IMPERATIVE.has(words[0]);
}

function referenceErrors(line, candidatePaths) {
  // Public URLs do not assert that their path exists in this repository.
  const masked = line.replace(/https?:\/\/[^\s)\]"'`>]+/gu, match => ' '.repeat(match.length));
  const errors = [];
  const localPatterns = [
    /(?:^|[\s"'`(<,=])((?:\/Users\/|\/home\/|\/Volumes\/|\/private\/var\/folders\/)[^\s"'`)\]>]+)/gu,
    /[a-z]:[\\/]+users[\\/]+[a-z0-9._-]+/giu,
    /~[a-z][a-z0-9._-]*\//giu,
    /(?:^|[\s"'`(<,=])(-(?:users|home)-[a-z0-9._]+-)/giu,
  ];
  for (const pattern of localPatterns) {
    for (const match of masked.matchAll(pattern)) {
      errors.push(`Machine-local reference ${JSON.stringify(match[1] ?? match[0])}; use a repository path or public URL.`);
    }
  }
  // Like the shared lint, recognize directory-qualified filenames with an
  // extension. Also handle Windows separators and reject traversal explicitly.
  const filenames = /(?:^|[\s"'`(<,=])((?:[A-Za-z0-9._-]+[\\/])+[A-Za-z0-9._-]+\.[A-Za-z0-9]+)/gu;
  for (const match of masked.matchAll(filenames)) {
    const filename = match[1];
    const normalized = path.posix.normalize(filename.replaceAll('\\', '/'));
    if (normalized.startsWith('../') || normalized === '..' || !candidatePaths.has(normalized)) {
      errors.push(`Reference ${JSON.stringify(filename)} does not resolve in the candidate index; use a public URL for another repository.`);
    }
  }
  return errors;
}

/** Validate cleaned text against the local convention; paths are Git index paths. */
export function validateCommitMessage(message, candidatePaths) {
  const lines = message.replace(/^\uFEFF/u, '').split(/\r?\n/u).map(line => line.trimEnd());
  while (lines.length && !lines[0].trim()) lines.shift();
  const errors = [];
  const add = (line, text) => errors.push({ line, message: text });
  const header = lines[0] ?? '';
  const subject = HEADER.exec(header)?.groups;
  if (!header) add(1, 'Conventional commit required: the message is empty.');
  else if (!subject) add(1, 'Expected <type>(optional-scope)!: <description>; for example, docs: explain skill selection.');
  else {
    if (!COMMIT_TYPES.includes(subject.type)) add(1, `Unsupported type ${JSON.stringify(subject.type)}; use ${COMMIT_TYPES.join(', ')}.`);
    if (!imperative(subject.description, 1) || subject.description.endsWith('.')) {
      add(1, 'Use a lowercase imperative subject without a final period; for example, "add", not "added" or "Adds".');
    }
  }

  let breakingCallout = false;
  let inBullet = false;
  for (let index = 1; index < lines.length; index++) {
    const line = lines[index];
    if (!line.trim()) { inBullet = false; continue; }
    if (line.startsWith('BREAKING CHANGE:')) {
      breakingCallout ||= /^BREAKING CHANGE: \S/u.test(line);
      if (!/^BREAKING CHANGE: \S/u.test(line)) add(index + 1, 'Use BREAKING CHANGE: <description> with a nonempty explanation.');
      inBullet = false;
    } else if (inBullet && /^[ \t]+\S/u.test(line)) {
      // A wrapped detail bullet; a blank line ends its continuation.
    } else if (line.startsWith('- ') && imperative(line.slice(2), 2)) {
      inBullet = true;
    } else {
      add(index + 1, 'Extra detail must be an imperative bullet (for example, "- preserve review evidence") or a BREAKING CHANGE: callout.');
      inBullet = false;
    }
  }
  if (subject?.breaking && !breakingCallout) add(1, 'A breaking subject requires BREAKING CHANGE: <what changes for consumers>.');
  lines.forEach((line, index) => {
    for (const error of referenceErrors(line, candidatePaths)) add(index + 1, error);
  });
  return { ok: errors.length === 0, errors };
}
