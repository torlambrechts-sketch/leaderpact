/**
 * Supabase's `/rest/v1` prefix in front of a local PostgREST (scripts/qa/local-api.sh). It forwards
 * method, headers and body unchanged and answers anything else with 404, as Supabase's gateway would for
 * a service that is not running. Local use only.
 *
 * One piece of Auth, so signed-in pages can be looked at in a cloud session (D-27): `GET /auth/v1/user`
 * answers for a token signed with this run's secret (LOCAL_API_JWT_SECRET), as Auth answers for its own,
 * and `POST /auth/v1/logout` succeeds. Nothing signs anyone in: a test mints a token with the same secret
 * (tests/e2e/support/session.ts). Real sign-in, by email link, runs in CI against real Supabase.
 *
 *   node scripts/qa/local-api-proxy.mjs <listen port> <PostgREST port>
 */
import { createHmac, timingSafeEqual } from 'node:crypto'
import { createServer, request } from 'node:http'

const [listen, upstream] = process.argv.slice(2).map(Number)
if (!listen || !upstream) {
  console.error('local-api-proxy: <listen port> <PostgREST port>')
  process.exit(2)
}
const SECRET = process.env.LOCAL_API_JWT_SECRET ?? ''

/** The claims of an HS256 token signed with this run's secret and not expired, or null */
function claims(header) {
  const token = /^Bearer (.+)$/.exec(header ?? '')?.[1]
  if (!token || !SECRET) return null
  const [head, body, sig] = token.split('.')
  if (!head || !body || !sig) return null
  const expected = createHmac('sha256', SECRET).update(`${head}.${body}`).digest()
  const given = Buffer.from(sig, 'base64url')
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
  try {
    const c = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    return typeof c.exp === 'number' && c.exp > Date.now() / 1000 ? c : null
  } catch {
    return null
  }
}

function auth(req, res, url) {
  const json = (status, body) => res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(body))
  if (url.startsWith('/auth/v1/logout') && req.method === 'POST') return res.writeHead(204).end()
  if (!url.startsWith('/auth/v1/user') || req.method !== 'GET') return json(404, { message: 'no such service in the local API' })
  const c = claims(req.headers.authorization)
  if (!c || c.role !== 'authenticated' || !c.sub) return json(401, { code: 'bad_jwt', message: 'invalid JWT' })
  const at = new Date((c.iat ?? 0) * 1000).toISOString()
  json(200, { id: c.sub, aud: 'authenticated', role: 'authenticated', email: c.email ?? null, app_metadata: { provider: 'email' }, user_metadata: {}, created_at: at, updated_at: at })
}

createServer((req, res) => {
  const url = req.url ?? '/'
  if (url.startsWith('/auth/v1/')) return auth(req, res, url)
  if (!url.startsWith('/rest/v1')) {
    res.writeHead(404, { 'content-type': 'application/json' }).end('{"message":"no such service in the local API"}')
    return
  }
  const forward = request(
    { host: '127.0.0.1', port: upstream, method: req.method, path: url.slice('/rest/v1'.length) || '/', headers: { ...req.headers, host: `127.0.0.1:${upstream}` } },
    (up) => {
      res.writeHead(up.statusCode ?? 502, up.headers)
      up.pipe(res)
    },
  )
  forward.on('error', () => res.writeHead(502).end())
  req.pipe(forward)
}).listen(listen, '127.0.0.1')
