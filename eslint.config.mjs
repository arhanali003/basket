import js from '@eslint/js';
import ts from 'typescript-eslint';
export default ts.config(
  { ignores: ['**/.next/**', '**/dist/**', '**/node_modules/**', '**/next-env.d.ts'] },
  js.configs.recommended,
  ...ts.configs.recommended,
  { files: ['**/public/sw.js'], languageOptions: { globals: { self: 'readonly' } } },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        Request: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
);
