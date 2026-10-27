import assert from 'node:assert/strict';
import { test } from 'node:test';
import { linesOutsideFences } from '../lib/markdown.mjs';

const outside = (lines) => linesOutsideFences(lines.join('\n')).map(({ line }) => line);

test('fences open with or without a list marker and close on a bare marker', () => {
  assert.deepEqual(outside(['a', '```js', 'in', '```', 'b']), ['a', 'b']);
  assert.deepEqual(outside(['- ~~~sh', '  in', '  ~~~', 'b']), ['b']);
  assert.deepEqual(outside(['1. ```', '   in', '   ```', '2) ~~~', '   in', '   ~~~', 'b']), ['b']);
});

test('only a bare marker of the same character, at least as long, closes', () => {
  assert.deepEqual(outside(['````', '```', 'in', '```text', '~~~~', '````', 'b']), ['b']);
  assert.deepEqual(outside(['~~~', '```', '~~~ info', 'in', '~~~~', 'b']), ['b']);
});

test('line numbers are those of the source', () => {
  assert.deepEqual(linesOutsideFences('a\r\n```\r\nx\r\n```\r\nb'), [{ line: 'a', number: 1 }, { line: 'b', number: 5 }]);
});
