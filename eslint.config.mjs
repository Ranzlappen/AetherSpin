// Flat ESLint config (ESLint 9+) for the AetherSpin monorepo.
// Lints TypeScript across `shared/` and `frontend/`, plus Svelte components.
// Prettier owns formatting (see .prettierrc.json); ESLint owns correctness only.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';

export default tseslint.config(
  {
    // Generated / vendored / non-source paths.
    ignores: [
      '**/dist/**',
      '**/build/**',
      '**/.svelte-kit/**',
      '**/storybook-static/**',
      '**/coverage/**',
      '**/node_modules/**',
      'math/**',
      'shared/games/**',
      '**/*.cjs',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...svelte.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      // Pragmatic baseline: catch real mistakes without fighting the codebase.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-undef': 'off', // TS handles this; avoids false positives in .ts/.svelte
    },
  },
  {
    // Svelte files are parsed by the svelte plugin; point it at the TS parser.
    files: ['**/*.svelte'],
    languageOptions: {
      parserOptions: { parser: tseslint.parser },
    },
  },
  {
    // Tests and Storybook stories use vitest/Storybook globals.
    files: ['**/*.test.ts', '**/*.stories.ts'],
    languageOptions: {
      globals: { ...globals.node },
    },
  }
);
