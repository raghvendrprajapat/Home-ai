import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
  { ignores: ['**/node_modules/**', '**/dist/**', '**/coverage/**', 'packages/core-model/src/generated/project-validator.js'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ['packages/core-model/scripts/*.mjs'], languageOptions: { globals: { process: 'readonly' } } },
];
