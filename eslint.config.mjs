import { FlatCompat } from '@eslint/eslintrc'

/**
 * ESLint 9, flat config. Orgpuls runs ESLint 8 with `.eslintrc.json` (`next/core-web-vitals` only);
 * ESLint 8 is out of support. ESLint 9 is the newest that Next 15.5's config accepts.
 *
 * One rule is added: no literal text in JSX. Every string a person sees comes from next-intl
 * (CLAUDE.md), and Orgpuls had no check for it.
 */
const compat = new FlatCompat({ baseDirectory: import.meta.dirname })

const config = [
  {
    ignores: ['.next/**', '.next-*/**', 'node_modules/**', 'design/**', 'test-results/**', 'playwright-report/**', 'next-env.d.ts', 'supabase/functions/**'],
  },
  ...compat.extends('next/core-web-vitals'),
  {
    files: ['app/**/*.tsx', 'components/**/*.tsx'],
    rules: {
      'react/jsx-no-literals': ['error', { noStrings: false, ignoreProps: true, allowedStrings: ['·', '–', '—', '/', '×', '%', ':'] }],
    },
  },
]

export default config
