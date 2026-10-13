// The types of scripts/seed/profile.mjs, so tests/unit/profile.test.ts imports it under `strict`.
import type { ProfileTestData } from '../../lib/profile/schema'

export interface ProfileFiles {
  quick: ProfileTestData
  full: ProfileTestData
  bands: { version: number; lowerBelow: number; higherAbove: number; validFrom: string }[]
}

export declare const OUTPUT: string
export declare const FILES: Readonly<Record<'quick' | 'full' | 'bands', string>>
/** The data files as parsed JSON, not yet validated */
export declare function readFiles(root?: string): Record<keyof typeof FILES, unknown>
/** The migration, as text */
export declare function render(files: ProfileFiles): string
