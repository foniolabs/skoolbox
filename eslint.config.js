import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'out', '.next', 'next-env.d.ts', 'src-tauri/target'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
  {
    // Next.js route files export `metadata` / `viewport`, and these modules export
    // hooks and helpers beside components. Next's Fast Refresh copes; the
    // Vite-era rule only produced noise here.
    files: ['src/app/**/*.{ts,tsx}', 'src/lib/router.tsx', 'src/components/auth/AuthGuard.tsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
)
