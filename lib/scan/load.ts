import 'server-only'
import { unstable_cache } from 'next/cache'
import { z } from 'zod'
import { anonClient } from '@/lib/supabase/anon'
import { parseFailed, readFailed } from '@/lib/supabase/read'
import { buildScan, itemRowSchema, versionRowSchema, type Scan } from '@/lib/scan/model'

/**
 * The published Leadership Team Scan, read as a visitor reads it: the anon client, no session, no
 * cookies (lib/supabase/anon.ts). Row-level security decides what that is (0003: published scan items
 * only); nothing here widens it.
 *
 * The scan changes only by a migration, so it is cached for ten minutes across requests. A failure is
 * thrown inside the cache and caught outside it, so a database that was briefly unreachable is asked
 * again on the next request instead of being remembered as "no scan" for ten minutes.
 */
async function fetchScan(): Promise<Scan> {
  const client = anonClient()
  if (!client) throw new Error('no Supabase configuration')
  const db = client.schema('app')

  const versions = await db
    .from('instrument_version')
    .select('id, version, instrument!inner(key)')
    .eq('instrument.key', 'scan')
    .eq('status', 'published')
    .order('version', { ascending: false })
    .limit(1)
  if (readFailed('loadScan.version', versions.error, versions.data)) throw new Error('read failed')
  const version = z.array(versionRowSchema).safeParse(versions.data)
  if (parseFailed('loadScan.version', version)) throw new Error('parse failed')
  const current = version.data[0]
  if (!current) throw new Error('no published scan version')

  const items = await db
    .from('instrument_version_item')
    .select('ordinal, theme:scan_theme(key, name, ordinal), item:item(id, text)')
    .eq('instrument_version_id', current.id)
    .order('ordinal')
  if (readFailed('loadScan.items', items.error, items.data)) throw new Error('read failed')
  const rows = z.array(itemRowSchema).safeParse(items.data)
  if (parseFailed('loadScan.items', rows)) throw new Error('parse failed')

  const scan = buildScan(current, rows.data)
  if ('problem' in scan) {
    console.error(`[read] loadScan: ${scan.problem}`)
    throw new Error('not a scan')
  }
  return scan
}

const cachedScan = unstable_cache(fetchScan, ['scan:published'], { revalidate: 600 })

/** The published scan, or null when it cannot be read; the page then says the scan is not available */
export async function loadScan(): Promise<Scan | null> {
  try {
    return await cachedScan()
  } catch (error) {
    if (error instanceof Error && !/^(read|parse) failed$|^not a scan$/.test(error.message)) {
      console.error(`[read] loadScan: ${error.message}`)
    }
    return null
  }
}
