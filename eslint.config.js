/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * This file is part of Micelclaw OS and is proprietary software.
 * Unauthorized copying, modification, distribution, or use of this
 * file, via any medium, is strictly prohibited.
 *
 * See LICENSE in the root of this repository for full terms.
 * https://micelclaw.com
 */

// Flat config (ESLint 9). Fase inicial del mega-plan AI-First (Paso 0.1):
// las reglas de convención entran en "warn" para medir sin bloquear; la ola
// FE-C las sube a "error" cuando el backlog quede a cero.
// Convenciones que enforcea (fuente: docs/03_CONVENTIONS.md §Frontend):
//   - todas las requests pasan por services/api.ts (nunca fetch crudo)
//   - una sola librería DnD (@dnd-kit)
//   - sin `any` nuevo

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'dev-dist/**',
      'node_modules/**',
      'public/**',
      'src/vendor/**',
      '*.config.js',
      '*.config.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // TS ya comprueba los identificadores; no-undef en .ts/.tsx da falsos
      // positivos (recomendación oficial de typescript-eslint).
      'no-undef': 'off',
      // Reglas compiler-era de react-hooks: el preset las trae como error pero
      // marcan ~500 patrones heredados del repo. Quedan en warn hasta que una
      // pasada dedicada los limpie (rules-of-hooks incluido: 17 preexistentes,
      // uno ya catalogado como SR-A7 en la revisión de Studio).
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/static-components': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/use-memo': 'warn',
      'react-hooks/rules-of-hooks': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@hello-pangea/dnd',
              message: 'Única librería DnD del dash: @dnd-kit (ver CLAUDE.md §UI Stack). La dependencia se eliminó del repo.',
            },
          ],
        },
      ],
      // Dirección (warn): migrar los consumidores directos de react-markdown al
      // MarkdownRenderer compartido (src/components/markdown/) — carga lazy.
      'no-restricted-syntax': [
        'warn',
        {
          selector: "ImportDeclaration[source.value='react-markdown'][importKind!='type']",
          message: 'Usa el MarkdownRenderer compartido (src/components/markdown/).',
        },
      ],
      'no-restricted-globals': [
        'warn',
        {
          name: 'fetch',
          message: 'Todas las requests pasan por services/api.ts (CONVENTIONS §Frontend).',
        },
      ],
    },
  },
  {
    // Consumidores legítimos de fetch: el propio cliente API y el Service Worker.
    files: ['src/services/api.ts', 'src/sw.ts'],
    rules: { 'no-restricted-globals': 'off' },
  },
);
