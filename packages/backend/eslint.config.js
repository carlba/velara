import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig(
  {
    ignores: ['dist/', 'node_modules/', 'eslint.config.js', 'vitest.config.ts'],
  },
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    extends: [tseslint.configs.recommendedTypeChecked, tseslint.configs.stylisticTypeChecked],
    rules: {
      'id-length': [
        'error',
        {
          min: 2,
          exceptions: ['i', 'j', 'k'],
          properties: 'never',
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[object.name='process'][property.name='env']",
          message: 'Use validated config values instead of process.env directly.',
        },
      ],
    },
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
  },
  {
    files: ['src/lib/config.ts', 'src/**/*.spec.ts'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  }
);
