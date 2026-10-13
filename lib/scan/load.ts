import 'server-only'
import { unstable_cache } from 'next/cache'
import { z } from 'zod'
import { anonClient } from '@/lib/supabase/anon'
import { parseFailed, readFailed } from '@/lib/supabase/read'
import { buildScan, itemRowSchema, versionRowSchema, type Scan } from '@/lib/scan/model'
import { codeSchema, inviteRowSchema, type InviteRow } from '@/lib/scan/link'
import { buildTeamView, teamViewRowSchema, type TeamView } from '@/lib/scan/team-view'

/**
 * The published Leadership Team Scan, read as a visitor reads it: the anon client, no session, no
 * cookies (lib/supabase/anon.ts). Row-level security decides what that is (0003: published scan items
 * only); nothing here widens it.
 *
 * The scan changes only by a migration, so it is cached for ten minutes across requests. A failure is
 * thrown inside the cache and caught outside it, so a database that was briefly unreachable is asked
 * again on the next request instead of being remembered as "no scan" for ten minutes.
 */
async function fetchScan(versionId?: string): Promise<Scan> {
  const client = anonClient()
  if (!client) throw new Error('no Supabase configuration')
  const db = client.schema('app')

  // the latest published version, or the one a group's scan session was opened on
  const query = db.from('instrument_version').select('id, version, instrument!inner(key)').eq('instrument.key', 'scan')
  const versions = await (versionId
    ? query.eq('id', versionId).limit(1)
    : query.eq('status', 'published').order('version', { ascending: false }).limit(1))
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

const cachedScan = unstable_cache(() => fetchScan(), ['scan:published'], { revalidate: 600 })
// a version's items never change once it is published (0003), so each is cached by its id
const cachedVersion = unstable_cache((versionId: string) => fetchScan(versionId), ['scan:version'], { revalidate: 600 })

function quietly(error: unknown): null {
  if (error instanceof Error && !/^(read|parse) failed$|^not a scan$|^no published scan version$/.test(error.message)) {
    console.error(`[read] loadScan: ${error.message}`)
  }
  return null
}

/** The published scan, or null when it cannot be read; the page then says the scan is not available */
export async function loadScan(): Promise<Scan | null> {
  try {
    return await cachedScan()
  } catch (error) {
    return quietly(error)
  }
}

/** One version of the scan, the one a group's link asks (handoff 6.5), or null when it cannot be read */
export async function loadScanVersion(versionId: string): Promise<Scan | null> {
  try {
    return await cachedVersion(versionId)
  } catch (error) {
    return quietly(error)
  }
}

/**
 * The invite link's page (0009, get_scan_invite): the group's name, the phase, the count, the closing date
 * and the version to answer. 'none' for a code that leads nowhere; null when the read failed. Never cached:
 * the count and the phase change with every answer.
 */
export async function loadInviteByCode(code: string): Promise<InviteRow | 'none' | null> {
  if (!codeSchema.safeParse(code).success) return 'none'
  const client = anonClient()
  if (!client) {
    console.error('[read] loadInviteByCode: no Supabase configuration')
    return null
  }
  const { data, error } = await client.schema('app').rpc('get_scan_invite', { p_code: code })
  if (readFailed('loadInviteByCode', error, data)) return null
  const rows = z.array(inviteRowSchema).safeParse(data)
  if (parseFailed('loadInviteByCode', rows)) return null
  return rows.data[0] ?? 'none'
}

/**
 * The team view through the link (0006, get_team_view_by_code), for members without an account: levels and
 * labels, only once released at or above k. Null when it cannot be read or is not there; the page decides
 * from the phase which it is. Never cached: it appears at the close.
 */
export async function loadTeamViewByCode(code: string): Promise<TeamView | null> {
  if (!codeSchema.safeParse(code).success) return null
  const client = anonClient()
  if (!client) return null
  const { data, error } = await client.schema('app').rpc('get_team_view_by_code', { p_code: code })
  if (readFailed('loadTeamViewByCode', error, data)) return null
  const rows = z.array(teamViewRowSchema).safeParse(data)
  if (parseFailed('loadTeamViewByCode', rows)) return null
  return buildTeamView(rows.data)
}
