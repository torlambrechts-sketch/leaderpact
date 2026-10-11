// Origin: Orgpuls vitest.config.ts @ 6f5d441 (unchanged apart from this line).
import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

/**
 * Unit tests.
 *
 * `server-only` throws by design when imported outside a React Server Component build,
 * which is every test. It is aliased to an empty module here so server code can be tested
 * at all; the guard it provides is a build-time one, and the build still enforces it.
 */
export default defineConfig({
  // tsconfig says `jsx: preserve` for Next; a test that renders a component needs React's own transform
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
      'server-only': fileURLToPath(new URL('./tests/stubs/server-only.ts', import.meta.url)),
    },
  },
  test: {
    // .tsx too: Orgpuls matched .ts only, so a component test silently never ran
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
})
