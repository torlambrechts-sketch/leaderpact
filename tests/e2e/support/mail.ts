/**
 * The sign-in mail, read from the local Supabase stack's Mailpit (CI: supabase start). MAILPIT_URL is set
 * by the CI step that starts the stack; without it the email-link flows are skipped.
 */
export const canReadMail = () => !!process.env.MAILPIT_URL

interface Summary {
  ID: string
  To: { Address: string }[]
}

/** The newest sign-in link sent to an address, waiting up to 20 seconds for it */
export async function signInLink(address: string): Promise<string> {
  const base = process.env.MAILPIT_URL
  if (!base) throw new Error('MAILPIT_URL is not set')
  for (let attempt = 0; attempt < 40; attempt++) {
    const search = await fetch(`${base}/api/v1/search?query=${encodeURIComponent(`to:"${address}"`)}`)
    if (search.ok) {
      const { messages } = (await search.json()) as { messages: Summary[] }
      const first = messages[0]
      if (first) {
        const message = (await (await fetch(`${base}/api/v1/message/${first.ID}`)).json()) as { HTML: string; Text: string }
        const href = /href="([^"]*token_hash=[^"]+)"/.exec(message.HTML)?.[1] ?? /(https?:\/\/\S*token_hash=\S+)/.exec(message.Text)?.[1]
        if (href) return href.replace(/&amp;/g, '&')
      }
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`no sign-in mail for ${address}`)
}
