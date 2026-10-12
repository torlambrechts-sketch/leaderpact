/**
 * Supabase's `/rest/v1` prefix in front of a local PostgREST (scripts/qa/local-api.sh). It forwards
 * method, headers and body unchanged and answers anything else with 404, as Supabase's gateway would for
 * a service that is not running. Local use only.
 *
 *   node scripts/qa/local-api-proxy.mjs <listen port> <PostgREST port>
 */
import { createServer, request } from 'node:http'

const [listen, upstream] = process.argv.slice(2).map(Number)
if (!listen || !upstream) {
  console.error('local-api-proxy: <listen port> <PostgREST port>')
  process.exit(2)
}

createServer((req, res) => {
  const url = req.url ?? '/'
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
