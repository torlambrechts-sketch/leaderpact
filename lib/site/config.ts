/**
 * The public site's address and who publishes it (D-34). Imports nothing.
 *
 * Every canonical address, sitemap entry and JSON-LD id names the production address; `leaderpact.com`
 * redirects to `www` at Vercel. The pages still say noindex until the owner switches indexing on (D-34);
 * with it comes an `X-Robots-Tag: noindex` from every other host (leaderpact.vercel.app, a preview).
 */
export const SITE_HOST = 'www.leaderpact.com'
export const SITE_URL = `https://${SITE_HOST}`

/** An absolute address on the production site, for canonicals, the sitemap and JSON-LD */
export const absolute = (path: string) => `${SITE_URL}${path === '/' ? '' : path}`

/** The contact address the site names, the sender of D-26 */
export const CONTACT_MAIL = 'post@leaderpact.com'

/**
 * The company behind the product, for the Organization data (Orgpuls D-281: the entity, unambiguous).
 * TODO(owner): the legal name and registration number of the company that publishes LeaderPact, and its
 * LinkedIn page. Until then the Organization names the product and its address only, and claims nothing
 * more (never fabricate).
 */
export const PUBLISHER: { legalName: string | null; sameAs: string[] } = { legalName: null, sameAs: [] }

/** The day the article sources and the claims on the product pages were last checked */
export const CHECKED_ON = '2026-10-13'
