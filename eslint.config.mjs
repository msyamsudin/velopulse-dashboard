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
    // React-hooks debt predates ESLint wiring (conditional hooks in
    // HistorySummary, intentional timer/state transitions in hooks, ref
    // reads during render in useResistanceAdvisor, impure render in
    // App.tsx / WorkoutHistory.tsx). Fixing is tracked in ROADMAP.md;
    // keep visible as warnings.
    rules: {
      'react-hooks/rules-of-hooks': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/set-state-in-render': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/refs': 'warn',
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
