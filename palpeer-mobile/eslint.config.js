const { defineConfig } = require('eslint/config');
const typescriptEslint = require('@typescript-eslint/eslint-plugin');
const expoConfig = require('eslint-config-expo/flat');
const prettierRecommended = require('eslint-plugin-prettier/recommended');

module.exports = defineConfig([
  expoConfig,
  prettierRecommended,
  {
    ignores: ['dist/*', '.expo/*', 'node_modules/*', 'coverage/*', 'android/*', 'ios/*'],
  },
  {
    rules: {
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      '@typescript-eslint': typescriptEslint,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    // jest.mock factories are hoisted above imports, so they can only load modules with require().
    files: ['src/**/__tests__/**', 'src/tests/**'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
]);
