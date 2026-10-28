// Binding helper: local storage setup, ignore coverage, occupied local paths
// and binding children.
// Shared fixtures in ../test-support/bind.mjs give each test file its own
// temporary directory of disposable Git repositories, so the files can run
// concurrently; this checkout's project files and workflow records stay unchanged.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import {
  checkoutFacts, establishLocalStorage, EXCLUDE_RULE, excludeFile, hasExcludeRule, ignoreCoverage, readManifest, sourceManifest,
} from '../lib/bind.mjs';
import {
  packageRoot, cli, scratch, GIT_ENV, git, run, repository, write, qualityFixture, treeState, excludeContent, visibleLocal,
} from '../test-support/bind.mjs';

test('exclude establishes local storage once, verifies it and leaves the tree, index and other entries alone', () => {
  const dir = repository('no-rule', { 'README.md': '# P\n' });
  const exclude = excludeFile(dir);
  fs.mkdirSync(path.dirname(exclude), { recursive: true });
  fs.writeFileSync(exclude, '# mine\n*.scratch'); // no trailing newline: the rule still lands on its own line
  const before = treeState(dir);

  const first = run('exclude', '--repo', dir);
  assert.equal(first.status, 0, first.stderr);
  assert.equal(first.json.status, 'added');
  assert.equal(first.json.changed, true);
  assert.equal(first.json.excludeFile, exclude);
  assert.equal(first.json.pattern, EXCLUDE_RULE);
  const written = fs.readFileSync(exclude, 'utf8');
  assert.ok(written.startsWith('# mine\n*.scratch\n'), 'existing entries are preserved');
  assert.equal((written.match(/^\/\.peer-skills-and-workflows\/$/gm) ?? []).length, 1);
  const coverage = ignoreCoverage(dir);
  assert.equal(coverage.directoryPresent, true, 'exclude created the empty local directory so Git could evaluate the directory rule');
  assert.equal(coverage.ignored, true);
  assert.deepEqual(coverage.match, { source: path.relative(dir, exclude).split(path.sep).join('/'), line: written.split('\n').length - 1, pattern: EXCLUDE_RULE });
  assert.equal(coverage.negatedBy, null);
  assert.equal(coverage.partial, false);
  assert.ok(coverage.children.every((child) => child.ignored && child.pattern === EXCLUDE_RULE), JSON.stringify(coverage.children));
  assert.deepEqual(treeState(dir), before, 'the tracked tree and index are unchanged');
  assert.equal(git(dir, 'status', '--porcelain', '--ignored=matching', '-z'), '!! .peer-skills-and-workflows/\0', 'only the ignored local directory itself appeared');
  write(dir, { '.peer-skills-and-workflows/binding-sources.json': '{}', '.peer-skills-and-workflows/runs/run_x/report.md': 'r\n' });
  assert.deepEqual(git(dir, 'status', '--porcelain', '--ignored=matching', '-z').split('\0').filter(Boolean), ['!! .peer-skills-and-workflows/'], 'every local record is excluded with the directory');
  assert.equal(git(dir, 'ls-files', '-o', '--exclude-standard'), '', 'no local record is visible to ordinary staging');

  const second = run('exclude', '--repo', dir);
  assert.equal(second.status, 0);
  assert.equal(second.json.status, 'ignored');
  assert.equal(second.json.changed, false);
  assert.equal(fs.readFileSync(exclude, 'utf8'), written, 'repeating adds no duplicate rule');
  assert.deepEqual(treeState(dir), before);
});

test('an existing shared ignore rule is reused and the exclude file is left alone', () => {
  const dir = repository('shared-rule', { '.gitignore': '/.peer-skills-and-workflows/\n' });
  const before = excludeContent(dir);
  const result = establishLocalStorage(dir);
  assert.equal(result.status, 'ignored');
  assert.equal(result.match.source, '.gitignore');
  assert.equal(result.changed, false);
  assert.equal(excludeContent(dir), before);
  const bare = repository('shared-rule-bare', { '.gitignore': '.peer-skills-and-workflows\n' });
  assert.equal(establishLocalStorage(bare).status, 'ignored', 'a rule without slashes still excludes the directory itself');
  assert.equal(excludeContent(bare), excludeContent(dir));
});

test('tracked local content blocks setup without untracking or writing anything', () => {
  const dir = repository('tracked', { '.peer-skills-and-workflows/old.md': 'kept\n', 'README.md': '# P\n' });
  const before = treeState(dir);
  const exclude = excludeContent(dir);
  const result = run('exclude', '--repo', dir);
  assert.equal(result.status, 1);
  assert.equal(result.json.status, 'tracked');
  assert.deepEqual(result.json.tracked, ['.peer-skills-and-workflows/old.md']);
  assert.equal(excludeContent(dir), exclude, 'no exclude rule is written');
  assert.deepEqual(treeState(dir), before);
  assert.equal(fs.readFileSync(path.join(dir, '.peer-skills-and-workflows', 'old.md'), 'utf8'), 'kept\n');
  assert.deepEqual(fs.readdirSync(path.join(dir, '.peer-skills-and-workflows')), ['old.md'], 'nothing else is created there');
});

test('an exclude file that cannot be written is reported with its code, not thrown', (t) => {
  if (process.platform === 'win32' || process.getuid?.() === 0) { t.skip('needs POSIX permissions enforced'); return; }
  const dir = repository('unwritable', { 'README.md': '# P\n' });
  const exclude = excludeFile(dir);
  fs.mkdirSync(path.dirname(exclude), { recursive: true });
  fs.writeFileSync(exclude, '# read-only\n');
  fs.chmodSync(exclude, 0o400);
  try {
    const result = run('exclude', '--repo', dir);
    assert.equal(result.status, 1);
    assert.equal(result.json.status, 'unwritable');
    assert.equal(result.json.error, 'EACCES');
    assert.equal(result.stderr, '');
    assert.equal(fs.readFileSync(exclude, 'utf8'), '# read-only\n');
  } finally {
    fs.chmodSync(exclude, 0o644);
  }
});

test('a linked worktree resolves its common Git directory and shares the exclude rule', () => {
  const main = repository('wt-main', { 'README.md': '# P\n' });
  const linked = path.join(scratch, 'wt-linked');
  git(main, 'worktree', 'add', '-q', '-b', 'feature', linked);
  const facts = checkoutFacts(linked);
  assert.equal(facts.checkout, fs.realpathSync.native(linked));
  assert.equal(facts.linkedWorktree, true);
  assert.equal(facts.commonDir, path.join(main, '.git'));
  assert.ok(facts.gitDir.startsWith(path.join(main, '.git', 'worktrees')), facts.gitDir);
  assert.equal(facts.branch, 'feature');
  assert.equal(excludeFile(linked), path.join(main, '.git', 'info', 'exclude'));
  assert.equal(establishLocalStorage(linked).status, 'added');
  const seen = ignoreCoverage(main);
  assert.equal(seen.directoryPresent, false, 'the main worktree has no local directory yet, so Git cannot evaluate the directory rule there');
  assert.equal(seen.ignored, false);
  assert.ok(seen.children.every((child) => child.ignored && child.pattern === EXCLUDE_RULE), 'its probes already hit the shared local rule');
  assert.equal(establishLocalStorage(main).status, 'ignored', 'the main worktree reuses the same local rule once its directory exists');
  assert.equal((fs.readFileSync(path.join(main, '.git', 'info', 'exclude'), 'utf8').match(/peer-skills-and-workflows/g) ?? []).length, 2, 'comment and rule, once');
});

test('rules that match only children are not coverage: the directory rule is added and verified', () => {
  for (const [name, rule] of [['ext-rule', '*.md\n'], ['file-rule', '/.peer-skills-and-workflows/binding.md\n'], ['contents-rule', '/.peer-skills-and-workflows/*\n']]) {
    const dir = repository(name, { 'README.md': '# P\n', '.gitignore': rule });
    const before = treeState(dir);
    const seen = ignoreCoverage(dir);
    assert.equal(seen.ignored, false, `${name}: a child match is not directory coverage`);
    assert.equal(seen.partial, true, `${name}: partial effects are reported`);
    assert.ok(seen.children.some((child) => child.ignored && child.source === '.gitignore'), JSON.stringify(seen.children));
    const result = run('exclude', '--repo', dir);
    assert.equal(result.status, 0, `${name}: ${result.stderr}`);
    assert.equal(result.json.status, 'added', name);
    assert.equal(result.json.match.pattern, EXCLUDE_RULE);
    assert.equal(result.json.partial, false);
    assert.equal(hasExcludeRule(excludeContent(dir)), true);
    assert.equal(fs.readFileSync(path.join(dir, '.gitignore'), 'utf8'), rule, 'the shared ignore file is untouched');
    assert.deepEqual(treeState(dir), before);
    assert.deepEqual(visibleLocal(dir), [], `${name}: every local record is excluded after setup`);
    assert.equal(run('exclude', '--repo', dir).json.status, 'ignored');
  }
});

test('a higher-precedence negation defeats the local rule: unverified once, truthful partial effects, no duplicate on retry', () => {
  const dir = repository('negation', { 'README.md': '# P\n', '.gitignore': '!/.peer-skills-and-workflows/\n*.md\n' });
  const before = treeState(dir);
  const first = run('exclude', '--repo', dir);
  assert.equal(first.status, 1);
  assert.equal(first.json.status, 'unverified');
  assert.equal(first.json.changed, true, 'the first attempt did write the rule');
  assert.equal(first.json.rulePresent, true);
  assert.deepEqual(first.json.overriddenBy, { source: '.gitignore', line: 1, pattern: '!/.peer-skills-and-workflows/' });
  assert.equal(first.json.partial, true, 'the Markdown records alone would be ignored by *.md');
  assert.deepEqual(first.json.children.map((c) => [c.path, c.ignored, c.pattern]), [['.peer-skills-and-workflows/binding.md', true, '*.md'], ['.peer-skills-and-workflows/binding-sources.json', false, undefined], ['.peer-skills-and-workflows/runs/run/report.md', true, '*.md']]);
  const written = excludeContent(dir);
  assert.equal((written.match(/^\/\.peer-skills-and-workflows\/$/gm) ?? []).length, 1);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const retry = run('exclude', '--repo', dir);
    assert.equal(retry.status, 1);
    assert.equal(retry.json.status, 'unverified');
    assert.equal(retry.json.changed, false, 'a retry writes nothing');
    assert.equal(retry.json.rulePresent, true);
    assert.deepEqual(retry.json.overriddenBy, first.json.overriddenBy);
    assert.equal(excludeContent(dir), written, 'the exclude file is byte-identical after a retry');
  }
  assert.deepEqual(treeState(dir), before);
  assert.deepEqual(visibleLocal(dir), ['.peer-skills-and-workflows/binding-sources.json'], 'Git really would list the record no rule covers');
});

test('inspect only reports local storage: a removed rule is seen and nothing is written', () => {
  const dir = repository('check-mode', { 'README.md': '# P\n' });
  assert.equal(establishLocalStorage(dir).status, 'added');
  write(dir, { '.peer-skills-and-workflows/binding.md': 'b\n' });
  run('sources', '--repo', dir, '--out', path.join(dir, '.peer-skills-and-workflows', 'binding-sources.json'), 'README.md');
  fs.writeFileSync(excludeFile(dir), '# rule removed by hand\n');
  const inspected = run('inspect', '--repo', dir);
  assert.equal(inspected.status, 0);
  assert.equal(inspected.json.localStorage.directoryPresent, true);
  assert.equal(inspected.json.localStorage.ignored, false);
  assert.equal(inspected.json.localStorage.rulePresent, false);
  assert.equal(inspected.json.binding.present, true);
  assert.equal(inspected.json.binding.comparison.current, true, `recorded sources are current even though storage is not established; comparison: ${JSON.stringify(inspected.json.binding.comparison)}`);
  assert.equal(fs.readFileSync(excludeFile(dir), 'utf8'), '# rule removed by hand\n', 'inspect wrote no rule');
  assert.deepEqual(git(dir, 'status', '--porcelain', '-z').split('\0').filter(Boolean), ['?? .peer-skills-and-workflows/'], 'Git really lists the records now');
  assert.equal(run('exclude', '--repo', dir).json.status, 'added', 'adopt or refresh re-establishes it');
});

test('a file, link or other entry at .peer-skills-and-workflows is an occupied conflict, decided before any probe or write; a directory or nothing is not', () => {
  const file = repository('occupied-file', { 'README.md': '# P\n' });
  fs.writeFileSync(path.join(file, '.peer-skills-and-workflows'), 'not a directory\n');
  const fileBefore = { tree: treeState(file), exclude: excludeContent(file) };
  const excluded = run('exclude', '--repo', file);
  assert.equal(excluded.status, 1);
  assert.equal(excluded.stderr, '', 'reported in JSON, not thrown');
  assert.equal(excluded.json.status, 'occupied');
  assert.equal(excluded.json.changed, false);
  assert.deepEqual([excluded.json.occupied.path, excluded.json.occupied.kind], [path.join(file, '.peer-skills-and-workflows'), 'file']);
  assert.match(excluded.json.occupied.resolution, /move or remove it yourself/);
  assert.equal(excludeContent(file), fileBefore.exclude, 'no rule is appended for an occupied path');
  assert.deepEqual(treeState(file), fileBefore.tree);
  assert.equal(fs.readFileSync(path.join(file, '.peer-skills-and-workflows'), 'utf8'), 'not a directory\n', 'the occupant is untouched');
  const inspected = run('inspect', '--repo', file);
  assert.equal(inspected.status, 0, inspected.stderr);
  assert.equal(inspected.json.localStorage.directoryPresent, false);
  assert.equal(inspected.json.localStorage.ignored, false);
  assert.equal(inspected.json.localStorage.reason, 'path occupied');
  assert.equal(inspected.json.localStorage.occupied.kind, 'file');
  assert.deepEqual(inspected.json.localStorage.children, [], 'no probe ran');
  assert.equal(excludeContent(file), fileBefore.exclude, 'inspect wrote nothing');

  const outside = path.join(scratch, 'occupied-elsewhere');
  fs.mkdirSync(outside);
  const linked = repository('occupied-dirlink', { 'README.md': '# P\n' });
  fs.symlinkSync(outside, path.join(linked, '.peer-skills-and-workflows'), 'dir');
  const linkBefore = { tree: treeState(linked), exclude: excludeContent(linked) };
  const viaLink = run('exclude', '--repo', linked);
  assert.equal(viaLink.status, 1);
  assert.equal(viaLink.stderr, '', 'a link to a directory outside the checkout no longer aborts the tool');
  assert.deepEqual([viaLink.json.status, viaLink.json.occupied.kind, viaLink.json.occupied.target], ['occupied', 'link', outside]);
  assert.equal(excludeContent(linked), linkBefore.exclude);
  assert.deepEqual(treeState(linked), linkBefore.tree);
  assert.equal(fs.readlinkSync(path.join(linked, '.peer-skills-and-workflows')), outside, 'the link is neither removed nor retargeted');
  assert.deepEqual(fs.readdirSync(outside), [], 'nothing was written through the link');
  const linkInspected = run('inspect', '--repo', linked);
  assert.equal(linkInspected.status, 0, linkInspected.stderr);
  assert.deepEqual([linkInspected.json.localStorage.occupied.kind, linkInspected.json.localStorage.occupied.target], ['link', outside]);
  const fileLink = repository('occupied-filelink', { 'README.md': '# P\n' });
  fs.symlinkSync('README.md', path.join(fileLink, '.peer-skills-and-workflows'));
  assert.deepEqual([establishLocalStorage(fileLink).status, ignoreCoverage(fileLink).occupied.kind], ['occupied', 'link']);

  const plain = repository('occupied-neighbor-dir', { 'README.md': '# P\n' });
  fs.mkdirSync(path.join(plain, '.peer-skills-and-workflows'));
  assert.equal(establishLocalStorage(plain).status, 'added', 'a plain directory is local storage');
  assert.equal(ignoreCoverage(plain).occupied, undefined);
  const absent = repository('occupied-neighbor-absent', { 'README.md': '# P\n' });
  assert.deepEqual([ignoreCoverage(absent).directoryPresent, ignoreCoverage(absent).reason], [false, 'directory absent']);
  assert.equal(establishLocalStorage(absent).status, 'added', 'an absent path is created and excluded');
});

test('inspect refuses an occupied link before any binding child read and retains independent facts', () => {
  const dir = repository('occupied-read-guard', { 'README.md': '# P\n', ...qualityFixture });
  const outside = path.join(scratch, 'occupied-readable-binding');
  const bad = path.join(scratch, 'occupied-failing-source');
  fs.symlinkSync('occupied-failing-source', bad);
  const manifest = sourceManifest(dir, ['README.md', bad]);
  write(outside, { 'binding.md': 'surviving binding', 'binding-sources.json': JSON.stringify(manifest) });
  const local = path.join(dir, '.peer-skills-and-workflows');
  fs.symlinkSync(outside, local, 'dir');
  const trace = path.join(scratch, 'occupied-reads.jsonl');
  const observer = path.join(scratch, 'occupied-observer.mjs');
  fs.writeFileSync(observer, `import fs from 'node:fs';
    const append = fs.appendFileSync;
    for (const method of ['readFileSync', 'readdirSync', 'existsSync', 'statSync', 'lstatSync']) {
      const original = fs[method];
      fs[method] = (file, ...args) => {
        if ([${JSON.stringify(local + path.sep)}, ${JSON.stringify(outside + path.sep)}].some(prefix => String(file).startsWith(prefix))) append(${JSON.stringify(trace)}, JSON.stringify({method, file: String(file)}) + '\\n');
        return original(file, ...args);
      };
    }`);
  const result = spawnSync(process.execPath, ['--import', observer, cli, 'inspect', '--repo', dir], { encoding: 'utf8', env: GIT_ENV });
  assert.equal(result.status, 0, result.stderr);
  const inspected = JSON.parse(result.stdout);
  assert.equal(fs.existsSync(trace), false, 'no binding child was read, probed, or resolved through stat');
  assert.equal(inspected.localStorage.occupied.kind, 'link');
  assert.equal(inspected.binding.present, null);
  assert.equal(inspected.binding.sourcesPresent, null);
  assert.equal(inspected.binding.manifest.usable, false);
  assert.equal(inspected.binding.comparison, undefined);
  assert.equal(inspected.quality.present, true);
  assert.ok(inspected.candidates.some((entry) => entry.path === 'README.md'));
  assert.equal(inspected.checkout, dir);
  fs.unlinkSync(local);
  const absent = run('inspect', '--repo', dir);
  assert.equal(absent.json.binding.present, false);
  assert.equal(absent.json.binding.sourcesPresent, false);
  establishLocalStorage(dir);
  write(dir, { '.peer-skills-and-workflows/binding.md': 'binding', '.peer-skills-and-workflows/binding-sources.json': JSON.stringify(sourceManifest(dir, ['README.md'], { workflowSource: packageRoot })) });
  const plain = run('inspect', '--repo', dir);
  assert.equal(plain.status, 0, plain.stderr);
  assert.equal(plain.json.binding.present, true);
  assert.equal(plain.json.binding.comparison.current, true, `comparison: ${JSON.stringify(plain.json.binding.comparison)}`);
});

for (const occupant of ['directory', 'file', 'link', 'other', 'unreadable', 'mkdir-denied']) {
  test(`mkdir collision rechecks ${occupant} before local storage use`, (t) => {
    const dir = repository(`mkdir-collision-${occupant}`, { 'README.md': 'readable' });
    const local = path.join(dir, '.peer-skills-and-workflows');
    const exclude = excludeFile(dir);
    const before = fs.readFileSync(exclude, 'utf8');
    const mkdir = fs.mkdirSync;
    const lstat = fs.lstatSync;
    let collided = false;
    t.mock.method(fs, 'mkdirSync', (file, ...args) => {
      if (file !== local) return mkdir(file, ...args);
      collided = true;
      if (occupant === 'directory' || occupant === 'unreadable') mkdir(local);
      if (occupant === 'file') fs.writeFileSync(local, 'keep occupant');
      if (occupant === 'link') fs.symlinkSync('README.md', local);
      throw Object.assign(new Error('injected creation collision'), { code: occupant === 'mkdir-denied' ? 'EACCES' : 'EEXIST' });
    });
    t.mock.method(fs, 'lstatSync', (file, ...args) => {
      if (file === local && collided) {
        if (occupant === 'unreadable') throw Object.assign(new Error('injected inspection denial'), { code: 'EACCES' });
        if (occupant === 'other') return { isDirectory: () => false, isSymbolicLink: () => false, isFile: () => false };
      }
      return lstat(file, ...args);
    });
    const childReads = [];
    for (const method of ['readFileSync', 'readdirSync', 'statSync']) {
      const original = fs[method];
      t.mock.method(fs, method, (file, ...args) => {
        if (String(file).startsWith(local + path.sep)) childReads.push(String(file));
        return original(file, ...args);
      });
    }
    const result = establishLocalStorage(dir);
    assert.equal(collided, true);
    assert.deepEqual(childReads, []);
    if (occupant === 'directory') {
      assert.equal(result.status, 'added');
      assert.equal(result.directoryCreated, false);
      assert.equal(ignoreCoverage(dir).ignored, true);
      assert.equal(establishLocalStorage(dir).changed, false);
    } else {
      assert.equal(result.status, occupant === 'mkdir-denied' ? 'unwritable' : 'occupied');
      if (result.occupied) assert.equal(result.occupied.kind, occupant);
      assert.equal(result.changed, false);
      assert.equal(fs.readFileSync(exclude, 'utf8'), before);
    }
  });
}

for (const negated of [false, true]) {
  test(`a competing exclude append is checked with fresh coverage (negated: ${negated})`, (t) => {
    const dir = repository(`exclude-competing-${negated}`, { 'README.md': 'readable' });
    const exclude = excludeFile(dir);
    const original = fs.readFileSync(exclude, 'utf8');
    const read = fs.readFileSync;
    let competed = false;
    t.mock.method(fs, 'readFileSync', (file, ...args) => {
      if (file === exclude && !competed) {
        // establishLocalStorage has already checked coverage; a competitor
        // now appends the rule before this call reads the exclude file.
        competed = true;
        fs.appendFileSync(exclude, `\n${EXCLUDE_RULE}\n`);
        if (negated) write(dir, { '.gitignore': '!.peer-skills-and-workflows/\n' });
      }
      return read(file, ...args);
    });
    const result = establishLocalStorage(dir);
    assert.equal(competed, true);
    assert.equal(result.directoryCreated, true);
    assert.equal(result.changed, false, 'only the competitor appended');
    assert.equal(result.status, negated ? 'unverified' : 'ignored');
    if (negated) {
      assert.equal(result.overriddenBy.pattern, '!.peer-skills-and-workflows/');
      assert.equal(result.overriddenBy.source, '.gitignore');
    } else {
      assert.equal(result.match.pattern, EXCLUDE_RULE);
    }
    assert.equal(read(exclude, 'utf8'), `${original}\n${EXCLUDE_RULE}\n`);
    const repeated = establishLocalStorage(dir);
    assert.equal(repeated.status, result.status);
    assert.equal(repeated.changed, false);
    assert.equal(repeated.directoryCreated, false);
    assert.equal(read(exclude, 'utf8'), `${original}\n${EXCLUDE_RULE}\n`);
  });
}

test('binding children distinguish absent, file and dangling/live links without following or writing', () => {
  const dir = repository('binding-child-states', { 'README.md': 'readable' });
  establishLocalStorage(dir);
  const binding = path.join(dir, '.peer-skills-and-workflows/binding.md');
  const manifestPath = path.join(dir, '.peer-skills-and-workflows/binding-sources.json');
  const baseline = sourceManifest(dir, ['README.md'], { workflowSource: packageRoot });
  fs.writeFileSync(manifestPath, JSON.stringify(baseline));
  assert.deepEqual(run('inspect', '--repo', dir).json.binding.state, { kind: 'absent', present: false });
  fs.writeFileSync(binding, 'operator choices');
  assert.deepEqual(run('inspect', '--repo', dir).json.binding.state, { kind: 'file', present: true });
  for (const targetExists of [false, true]) {
    for (const file of [binding, manifestPath]) {
      const target = path.join(scratch, `child-target-${targetExists}-${path.basename(file)}`);
      if (targetExists) fs.writeFileSync(target, file === binding ? 'external choices' : JSON.stringify(baseline));
      const original = fs.readFileSync(file);
      fs.unlinkSync(file);
      fs.symlinkSync(target, file);
      const before = treeState(dir);
      const result = run('inspect', '--repo', dir);
      assert.equal(result.status, 0, result.stderr);
      const state = file === binding ? result.json.binding.state : result.json.binding.sourcesState;
      assert.deepEqual(state, { kind: 'link', present: true, target });
      assert.ok(result.json.binding.conflict.paths.includes(file));
      if (file === manifestPath) assert.equal(result.json.binding.manifest.usable, false);
      if (file === manifestPath) {
        assert.match(readManifest(file).error.reason, /linked manifest/);
        assert.equal(run('sources', '--repo', dir, '--compare', file, 'README.md').json.comparison.usable, false);
      }
      const output = run('sources', '--repo', dir, '--out', file, 'README.md');
      assert.equal(output.status, 1, output.stderr);
      assert.equal(output.json.refused.state.kind, 'link');
      assert.equal(fs.readlinkSync(file), target);
      assert.equal(fs.existsSync(target), targetExists);
      if (targetExists) assert.equal(fs.readFileSync(target, 'utf8'), file === binding ? 'external choices' : JSON.stringify(baseline));
      assert.deepEqual(treeState(dir), before, 'CHECK and refused output preserve project/index facts');
      fs.unlinkSync(file);
      fs.writeFileSync(file, original);
    }
  }
});

test('inaccessible binding children report unavailable with null presence and EACCES without CHECK writes', (t) => {
  if (process.platform === 'win32' || process.getuid?.() === 0) { t.skip('needs POSIX permissions enforced'); return; }
  const dir = repository('binding-child-inaccessible', { 'README.md': 'readable' });
  establishLocalStorage(dir);
  const local = path.join(dir, '.peer-skills-and-workflows');
  write(local, { 'binding.md': 'preserved choices', 'binding-sources.json': JSON.stringify(sourceManifest(dir, ['README.md'], { workflowSource: packageRoot })) });
  const before = fs.readdirSync(local).map((name) => [name, fs.readFileSync(path.join(local, name)), fs.statSync(path.join(local, name)).mtimeMs]);
  fs.chmodSync(local, 0);
  try {
    const result = run('inspect', '--repo', dir);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(result.json.binding.state, { kind: 'unavailable', present: null, error: 'EACCES' });
    assert.equal(result.json.binding.sourcesPresent, null);
    assert.equal(result.json.binding.sourcesState.error, 'EACCES');
    assert.equal(result.json.binding.manifest.usable, false);
    assert.equal(result.json.binding.comparison.current, false);
    assert.ok(result.json.binding.conflict);
  } finally { fs.chmodSync(local, 0o755); }
  assert.deepEqual(fs.readdirSync(local).map((name) => [name, fs.readFileSync(path.join(local, name)), fs.statSync(path.join(local, name)).mtimeMs]), before);
});

test('inspect distinguishes absent, readable and denied local exclude without discarding shared coverage', (t) => {
  if (process.platform === 'win32' || process.getuid?.() === 0) { t.skip('needs POSIX permissions enforced'); return; }
  const dir = repository('exclude-read-state', { 'README.md': 'readable', '.gitignore': '/.peer-skills-and-workflows/\n' });
  fs.mkdirSync(path.join(dir, '.peer-skills-and-workflows'));
  const file = excludeFile(dir);
  fs.writeFileSync(file, `${EXCLUDE_RULE}\n`);
  const readable = run('inspect', '--repo', dir);
  assert.equal(readable.status, 0, readable.stderr);
  assert.equal(readable.json.localStorage.rulePresent, true);
  assert.equal(readable.json.localStorage.ruleError, undefined);
  fs.chmodSync(file, 0);
  try {
    const denied = run('inspect', '--repo', dir);
    assert.equal(denied.status, 1, denied.stderr);
    assert.equal(denied.json.localStorage.ignored, true);
    assert.equal(denied.json.localStorage.match.source, '.gitignore');
    assert.equal(denied.json.localStorage.rulePresent, null);
    assert.deepEqual(denied.json.localStorage.ruleError, { path: file, error: 'EACCES' });
    assert.equal(denied.json.quality.present, false, 'independent facts survive');
  } finally { fs.chmodSync(file, 0o644); }
  const restored = run('inspect', '--repo', dir);
  assert.equal(restored.status, 0, restored.stderr);
  assert.equal(restored.json.localStorage.rulePresent, true);
  assert.equal(restored.json.localStorage.ruleError, undefined);
  assert.equal(fs.readFileSync(file, 'utf8'), `${EXCLUDE_RULE}\n`);
  fs.unlinkSync(file);
  const absent = run('inspect', '--repo', dir);
  assert.equal(absent.status, 0, absent.stderr);
  assert.equal(absent.json.localStorage.rulePresent, false);
  assert.equal(absent.json.localStorage.ruleError, undefined);
  assert.equal(absent.json.localStorage.ignored, true);
  fs.writeFileSync(file, '# no local rule\n');
  assert.equal(run('inspect', '--repo', dir).json.localStorage.rulePresent, false);
  fs.writeFileSync(path.join(dir, '.gitignore'), '');
  fs.chmodSync(file, 0);
  try {
    const uncovered = run('inspect', '--repo', dir);
    assert.equal(uncovered.status, 1, 'without shared coverage the existing Git failure stays loud');
    assert.match(uncovered.stderr, /Permission denied|EACCES/);
  } finally { fs.chmodSync(file, 0o644); }
});

test('unknown local rule alone does not fail complete discovery', () => {
  const dir = repository('unknown-rule-complete-discovery', { 'README.md': 'readable', '.gitignore': '/.peer-skills-and-workflows/\n' });
  establishLocalStorage(dir);
  const exclude = excludeFile(dir);
  const observer = path.join(scratch, 'unknown-rule-only.mjs');
  fs.writeFileSync(observer, `import fs from 'node:fs';
    const native = fs.readFileSync;
    fs.readFileSync = (file, ...args) => {
      if (file === ${JSON.stringify(exclude)}) throw Object.assign(new Error('injected rule read denial'), { code: 'EACCES' });
      return native(file, ...args);
    };`);
  const result = spawnSync(process.execPath, ['--import', observer, cli, 'inspect', '--repo', dir], { encoding: 'utf8', env: GIT_ENV });
  assert.equal(result.status, 0, result.stderr);
  const json = JSON.parse(result.stdout);
  assert.equal(json.localStorage.rulePresent, null);
  assert.equal(json.localStorage.ignored, true);
  assert.equal(json.discovery.complete, true, 'Git enumeration itself remains readable');
});

