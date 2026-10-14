'use server'

import { cookies } from 'next/headers'
import { z } from 'zod'
import { emailSchema } from '@/lib/auth/schema'
import { buildEvent, sendEvents } from '@/lib/platform/sentral'
import { granted, TEMPLATE_COOKIE, TEMPLATES_PATH, templateBySlug } from '@/lib/site/templates'

/**
 * A free template for an address (D-36, after Orgpuls D-241): the request goes to Sentral as a
 * `template.requested` event, with the box the person ticked for e-mail about new templates and articles.
 * Sentral makes a Sales ticket and a lead of it. LeaderPact keeps nothing but the browser's cookie, which
 * names the template so the page shows its files. Nothing the person wrote is logged.
 *
 * A field no person sees catches form bots: filled, the action answers as if it worked and sends nothing.
 */
export type TemplateResult = { ok: true } | { ok: false; problem: 'invalid' | 'rate_limited' | 'failed' }

const Input = z.object({
  slug: z.string().regex(/^[a-z0-9-]{3,80}$/),
  name: z.string().trim().min(1).max(120),
  mail: emailSchema,
  org: z.string().trim().max(200),
  role: z.string().trim().max(80),
  consent: z.boolean(),
  trap: z.string().max(500),
})

export async function requestTemplate(input: z.input<typeof Input>): Promise<TemplateResult> {
  const parsed = Input.safeParse(input)
  if (!parsed.success) return { ok: false, problem: 'invalid' }
  const d = parsed.data
  if (!templateBySlug(d.slug)) return { ok: false, problem: 'invalid' }

  if (!d.trap) {
    const sent = await sendEvents([
      buildEvent('template.requested', {
        template: d.slug,
        name: d.name,
        email: d.mail,
        organisation: d.org,
        role: d.role,
        consent: d.consent,
        lang: 'en',
      }),
    ])
    if (sent === 'refused') return { ok: false, problem: 'rate_limited' }
    if (sent === 'failed') return { ok: false, problem: 'failed' }
  }

  const jar = await cookies()
  const slugs = [...new Set([...granted(jar.get(TEMPLATE_COOKIE)?.value), d.slug])]
  jar.set(TEMPLATE_COOKIE, slugs.join(','), { httpOnly: true, secure: true, sameSite: 'lax', path: TEMPLATES_PATH, maxAge: 60 * 60 * 24 * 365 })
  return { ok: true }
}
