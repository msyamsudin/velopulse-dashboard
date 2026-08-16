import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  {
    // Pre-existing `any` usage across the codebase. Tightening types is
    // tracked in ROADMAP.md item 2.2; keep visible as warnings until then.
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    // set-state-in-effect is a guidance rule (new in react-hooks v7) that
    // flags intentional patterns: the HRR timer state machine, SSR-safe
    // locale init in I18nProvider, and guard/transition flags in App.tsx.
    // Kept as warnings for visibility; correctness rules stay errors.
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  globalIgnores([
    '.next/**',
    'dist/**',
    'build/**',
    'coverage/**',
    'scratch/**',
    'docs/**',
    'src/data/**',
    '.app-data/**',
    'public/**',
    '*.config.*',
    'start.bat',
  ]),
]);
