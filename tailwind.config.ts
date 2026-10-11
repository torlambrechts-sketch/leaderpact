import type { Config } from 'tailwindcss'

/**
 * Tailwind 3.4, as Orgpuls runs (owner, A4). The design tokens of handoff section 4 are
 * transcribed here in milestone 1, as CSS variables mapped to shadcn/ui's semantic names.
 */
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
}

export default config
