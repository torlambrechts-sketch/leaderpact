// Origin: Orgpuls supabase/functions/_shared/brevo.ts @ 6f5d441 (adapted: e-mail only; a readiness check; Mailpit for a local stack).
/**
 * The two ways a mail leaves: Brevo's transactional API (production, D-26) and Mailpit's send API (a local
 * stack). One message per person, so nobody sees anybody else's address.
 *
 * Nothing from a response body is passed on: Brevo's error messages can quote the address that was refused,
 * and an address does not belong in a log line or in the outbox's `last_error`. What the caller gets is the
 * HTTP status as a code and two decisions made from it: may this be tried again, and is the fault the key
 * rather than the message.
 */

export interface Outgoing {
  from: { email: string; name: string }
  to: Array<{ email: string; name: string | null }>
  subject: string
  html: string
  text: string
  tag: string
}

export type SendResult = { ok: true } | { ok: false; retryable: boolean; auth: boolean; code: string }

export interface Sender {
  /** whether the sender takes mail now: a refused key stops the run before anything is claimed */
  ready(): Promise<SendResult>
  send(m: Outgoing): Promise<SendResult>
}

type Fetch = (input: string, init: RequestInit) => Promise<Response>

function decide(status: number, prefix = 'http'): SendResult {
  const code = `${prefix}_${status}`
  if (status === 401 || status === 403) return { ok: false, retryable: true, auth: true, code }
  if (status === 429 || status >= 500) return { ok: false, retryable: true, auth: false, code }
  return { ok: false, retryable: false, auth: false, code }
}

export function brevoSender(key: string, fetcher: Fetch = fetch): Sender {
  const person = (r: { email: string; name: string | null }) => (r.name ? { email: r.email, name: r.name } : { email: r.email })
  return {
    async ready() {
      try {
        const res = await fetcher('https://api.brevo.com/v3/account', { headers: { 'api-key': key, accept: 'application/json' }, signal: AbortSignal.timeout(10000) })
        await res.body?.cancel()
        return res.ok ? { ok: true } : decide(res.status)
      } catch {
        return { ok: false, retryable: true, auth: false, code: 'network' }
      }
    },
    async send(m) {
      const body: Record<string, unknown> = { sender: m.from, subject: m.subject, htmlContent: m.html, textContent: m.text, tags: [m.tag] }
      // one version per person: nobody sees anybody else's address
      if (m.to.length === 1) body.to = [person(m.to[0]!)]
      else body.messageVersions = m.to.map((r) => ({ to: [person(r)] }))
      let res: Response
      try {
        res = await fetcher('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: { 'api-key': key, 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(15000),
        })
      } catch {
        return { ok: false, retryable: true, auth: false, code: 'network' }
      }
      await res.body?.cancel()
      return res.ok ? { ok: true } : decide(res.status)
    },
  }
}

/** Mailpit's send API (a local stack's mail catcher): one message per person */
export function mailpitSender(base: string, fetcher: Fetch = fetch): Sender {
  const url = `${base.replace(/\/$/, '')}/api/v1/send`
  return {
    async ready() {
      return { ok: true }
    },
    async send(m) {
      for (const r of m.to) {
        let res: Response
        try {
          res = await fetcher(url, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              From: { Email: m.from.email, Name: m.from.name },
              To: [r.name ? { Email: r.email, Name: r.name } : { Email: r.email }],
              Subject: m.subject,
              Text: m.text,
              HTML: m.html,
              Tags: [m.tag],
            }),
            signal: AbortSignal.timeout(10000),
          })
        } catch {
          return { ok: false, retryable: true, auth: false, code: 'network' }
        }
        await res.body?.cancel()
        if (!res.ok) return decide(res.status)
      }
      return { ok: true }
    },
  }
}
