import js from '@eslint/js';
import node from 'eslint-plugin-n';
import prettierRecommended from 'eslint-plugin-prettier/recommended';
import { defineConfig, globalIgnores } from 'eslint/config';

// tools/lib/lint.mjs chooses the files and runs ESLint from the repository root,
// where this file lives, so these patterns are relative to that root.
export default defineConfig([
  // Copies and third-party code: lint applies to the sources they come from.
  globalIgnores(['plugins/peer/**', '**/node_modules/**']),
  {
    files: ['**/*.{js,mjs,cjs}', '.githooks/commit-msg'],
    plugins: { js, n: node },
    extends: ['js/recommended', 'n/recommended-module'],
    linterOptions: {
      noInlineConfig: true,
      reportUnusedDisableDirectives: 'error',
      reportUnusedInlineConfigs: 'error',
    },
    // Check Node features against the shipped runtime floor, not the contributor toolchain's.
    settings: { n: { version: '>=22.0.0' } },
    rules: {
      // fs.cpSync exists in Node 22.0 and is stable from 22.3; it serves vendor
      // regeneration and tests. Every other builtin keeps the >=22 check.
      'n/no-unsupported-features/node-builtins': ['error', { ignores: ['fs.cpSync'] }],
      // Top-level tools are entry points with a shebang; the rule requires one there.
      'n/hashbang': [
        'error',
        { additionalExecutables: ['tools/*.mjs', 'tests/skills/run.mjs', '.githooks/commit-msg'] },
      ],
    },
  },
  // Git runs the extensionless commit hook directly, as a CommonJS script with a shebang.
  { files: ['.githooks/commit-msg', '**/*.cjs'], extends: [node.configs['flat/recommended-script']] },
  // Exit status is the contract of command-line entry points and of the test
  // harness's process simulators, so they may end the process explicitly.
  {
    files: [
      'tools/*.mjs',
      'tools/lib/cli.mjs',
      '.githooks/commit-msg',
      'tests/skills/run.mjs',
      'tests/skills/test-support/fake-engine.mjs',
    ],
    rules: { 'n/no-process-exit': 'off' },
  },
  // These modules validate control characters on purpose; a Unicode class such
  // as \p{Cc} would change the accepted set, so their exact ranges stay.
  {
    files: ['tests/skills/lib/inspect.mjs', 'tools/lib/successor.mjs', 'tools/lib/yaml.mjs'],
    rules: { 'no-control-regex': 'off' },
  },
  // Last, so its conflict-free formatting rules override earlier style rules.
  prettierRecommended,
]);
