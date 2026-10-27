// The maintained clarify-artifact suite loads, is complete, and cannot be
// mistaken for gate tests; malformed cases are refused before any launch.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, test } from 'node:test';
import { listSuites, loadSuite, matchesNodeTestPattern } from '../lib/suite.mjs';
import { makeSuite, temporaryDirectory } from '../test-support/fixtures.mjs';

const scratch = temporaryDirectory('suite');
after(() => fs.rmSync(scratch, { recursive: true, force: true }));

test('the clarify-artifact suite is listed and loads with its ten cases', () => {
  assert.ok(listSuites().includes('clarify-artifact'));
  const suite = loadSuite('clarify-artifact');
  assert.equal(suite.skill, 'clarify-artifact');
  assert.ok(suite.skills.includes('write-for-humans') && suite.skills.includes('write-for-agents'));
  assert.deepEqual(suite.cases.map((caseDef) => caseDef.id), [
    'settled-in-prompt', 'settled-in-sources', 'purpose-unsettled', 'audience-unsettled', 'scope-unsettled',
    'index-settles', 'contradiction', 'missing-source', 'mechanical-edit', 'settled-return',
  ]);
  for (const caseDef of suite.cases) {
    assert.ok(caseDef.effect.length > 20, `${caseDef.id} states its effect`);
    assert.ok(caseDef.prompt.length > 0, `${caseDef.id} has a prompt`);
    assert.ok(Object.keys(caseDef.fixtureManifest).length >= 1, `${caseDef.id} has fixture files`);
    assert.ok(caseDef.semantic.length >= 2, `${caseDef.id} has semantic criteria for a grader`);
    assert.ok(Object.keys(caseDef.deterministic.skillReads).length >= 1, `${caseDef.id} constrains skill reads`);
  }
  // The settled cases and the mechanical edit certify on the intent question and only observe the catch-all.
  // In the two settled cases the saved guide or bulletin is write-for-humans output, so its facts are
  // observed as well; in the two brief-returning cases the brief is clarify-artifact's own output.
  const observed = {
    'settled-in-prompt': ['no-question', 'no-invented-facts'],
    'settled-in-sources': ['no-question', 'no-invented-facts'],
    'mechanical-edit': ['no-question'],
    'index-settles': [],
    'settled-return': [],
  };
  for (const [id, expected] of Object.entries(observed)) {
    const caseDef = suite.cases.find((candidate) => candidate.id === id);
    assert.deepEqual(caseDef.semantic.filter((criterion) => criterion.observe === true).map((criterion) => criterion.id), expected, `${id} observes exactly ${expected.join(', ') || 'nothing'}`);
  }
  for (const id of ['settled-in-prompt', 'settled-in-sources', 'mechanical-edit']) {
    const caseDef = suite.cases.find((candidate) => candidate.id === id);
    assert.ok(caseDef.semantic.some((criterion) => criterion.id === 'no-intent-question' && criterion.observe !== true), `${id} certifies on the intent question`);
  }
  for (const id of ['index-settles', 'settled-return']) {
    const caseDef = suite.cases.find((candidate) => candidate.id === id);
    assert.ok(caseDef.semantic.some((criterion) => criterion.id === 'no-invented-facts' && criterion.observe !== true), `${id} certifies on invented facts in its own brief`);
  }
  for (const caseDef of suite.cases) {
    assert.ok(caseDef.semantic.some((criterion) => criterion.observe !== true), `${caseDef.id} has at least one certifying criterion`);
  }
  // The suite hash covers every file, so two loads agree and an edit changes it.
  assert.equal(loadSuite('clarify-artifact').hash, suite.hash);
});

test('no file of any maintained suite matches a Node test pattern or sits in a test directory', () => {
  for (const name of listSuites()) {
    const suite = loadSuite(name);
    for (const relative of Object.keys(suite.manifest)) {
      assert.equal(matchesNodeTestPattern(relative), false, `${name}: ${relative}`);
      assert.ok(!relative.split('/').includes('test'), `${name}: ${relative} lies in a directory named test`);
    }
  }
});

test('matchesNodeTestPattern recognizes the default patterns', () => {
  for (const file of ['a.test.mjs', 'x/b.test.js', 'c-test.cjs', 'd_test.mjs', 'test-e.mjs', 'test.mjs', 'f/test/g.mjs', 'f/test/h/i.js']) {
    assert.equal(matchesNodeTestPattern(file), true, file);
  }
  for (const file of ['README.md', 'notes/test-plan.md', 'tests.mjs', 'contest.mjs', 'latest/x.mjs', 'test-support/fake.mjs']) {
    assert.equal(matchesNodeTestPattern(file), false, file);
  }
});

test('malformed cases are refused by name', () => {
  const suites = path.join(scratch, 'suites');
  makeSuite(suites, 'bad-rule', [{ id: 'one', deterministic: { skillReads: { 'clarify-artifact': 'maybe' } } }]);
  assert.throws(() => loadSuite('bad-rule', suites), /case one: skillReads.clarify-artifact must be 'required' or 'forbidden'/);

  makeSuite(suites, 'bad-premise', [{ id: 'one', deterministic: { skillReads: {}, premise: ['skillReads.clarify-artifact'] } }]);
  assert.throws(() => loadSuite('bad-premise', suites), /premise 'skillReads.clarify-artifact' names no skillReads check/);

  makeSuite(suites, 'bad-observe', [{ id: 'one', semantic: [{ id: 'q', criterion: 'asks nothing', observe: 'maybe' }] }]);
  assert.throws(() => loadSuite('bad-observe', suites), /semantic criterion 'q': observe must be true or false/);

  makeSuite(suites, 'bad-required', [{ id: 'one', deterministic: { writes: { allowed: ['a.md'], required: ['b.md'] } } }]);
  assert.throws(() => loadSuite('bad-required', suites), /writes.required 'b.md' is not in writes.allowed/);

  makeSuite(suites, 'bad-fixture', [{ id: 'one', files: { 'tools/check.test.mjs': 'export {}\n' } }]);
  assert.throws(() => loadSuite('bad-fixture', suites), /fixture file 'tools\/check.test.mjs' matches a Node test pattern/);

  makeSuite(suites, 'bad-id', [{ id: 'one' }]);
  fs.writeFileSync(path.join(suites, 'bad-id', 'cases', 'one', 'case.json'), JSON.stringify({ id: 'two', effect: 'x' }));
  assert.throws(() => loadSuite('bad-id', suites), /id 'two' does not match its directory/);

  assert.throws(() => loadSuite('absent', suites), /suite 'absent' not found/);
  assert.throws(() => loadSuite('../etc', suites), /not a plain name/);
});
