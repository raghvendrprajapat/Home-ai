import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import { importBoundaries } from './scripts/architecture-boundaries.mjs';
import { localizedUi } from './scripts/localization.mjs';

export default [
  { ignores: ['**/node_modules/**', '**/dist/**', '**/coverage/**', 'packages/core-model/src/generated/project-validator.js'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['packages/*/src/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}', 'apps/web/src/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}'],
    plugins: { architecture: { rules: { 'import-boundaries': importBoundaries } } },
    rules: { 'architecture/import-boundaries': 'error' },
  },
  { files: ['packages/core-model/scripts/*.mjs'], languageOptions: { globals: { process: 'readonly' } } },
  { files: ['apps/web/src/**/*.tsx'], plugins: { localization: { rules: { 'bilingual-ui': localizedUi } } }, rules: { 'localization/bilingual-ui': 'error' } },
];
