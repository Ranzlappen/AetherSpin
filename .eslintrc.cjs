/**
 * Root ESLint config for AetherSpin (TypeScript + Svelte).
 *
 * This is intentionally lenient — it provides a reasonable baseline for the
 * shared workspace and any TS tooling at the repo root. The frontend workspace
 * may define its own `.eslintrc` / flat config which takes precedence for files
 * under frontend/.
 */
module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    extraFileExtensions: ['.svelte'],
  },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  rules: {
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'off',
    'no-undef': 'off',
  },
  overrides: [
    {
      files: ['*.svelte'],
      parser: 'svelte-eslint-parser',
      parserOptions: {
        parser: '@typescript-eslint/parser',
      },
    },
  ],
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'build/',
    '.svelte-kit/',
    '.turbo/',
    'dist-stake/',
    'math/library/',
    'math/engine/',
    '**/*.cjs',
  ],
};
