// The types of scripts/seed/model.mjs, so tests/unit/model.test.ts imports it under `strict`.
import type { Model } from '../../lib/model/schema'

export declare const OUTPUT: string
export declare const FILES: Readonly<Record<'instruments' | 'bank' | 'scan' | 'cutoffs' | 'settings' | 'plans', string>>
/** The data files as parsed JSON, not yet validated */
export declare function readFiles(root?: string): Record<keyof typeof FILES, unknown>
/** JSON with keys sorted at every depth */
export declare function canonicalJson(value: unknown): string
/** SHA-256 hex of the canonical JSON */
export declare function bodyHash(body: unknown): string
/** What each version is made from */
export declare function versionBodies(model: Model): { scan: unknown; diagnostic: unknown }
/** The migration, as text */
export declare function render(model: Model): string
