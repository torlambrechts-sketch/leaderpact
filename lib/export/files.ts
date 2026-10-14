import 'server-only'
import { z } from 'zod'
import { zipStored } from '@/lib/export/zip'
import { PRODUCT_NAME } from '@/lib/brand'

/** The mailed link's token: two of the database's link codes (0022 claim_mail), base64url */
export const exportTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{32,128}$/)

/** download_export's answer (0023): the content once, or why not */
export const downloadReplySchema = z.union([
  z.object({ ok: z.literal(true), content: z.record(z.string(), z.unknown()) }),
  z.object({ ok: z.literal(false), reason: z.enum(['unknown', 'used', 'expired']) }),
])

/**
 * The export as the person gets it: data.json, everything export_person put in, and README.txt, what it
 * holds and what it cannot. Stored, not deflated (lib/export/zip.ts).
 */
export function exportArchive(content: Record<string, unknown>, readme: string[], at: Date): { name: string; bytes: Uint8Array } {
  const enc = new TextEncoder()
  const day = at.toISOString().slice(0, 10)
  const slug = PRODUCT_NAME.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'export'
  const bytes = zipStored(
    [
      { name: 'README.txt', data: enc.encode(`${readme.join('\r\n\r\n')}\r\n`) },
      { name: 'data.json', data: enc.encode(`${JSON.stringify(content, null, 2)}\n`) },
    ],
    at,
  )
  return { name: `${slug}-data-${day}.zip`, bytes }
}
