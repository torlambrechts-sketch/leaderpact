// Origin: Orgpuls middleware.ts @ 6f5d441 (adapted: LeaderPact's matcher).
import type { NextRequest } from 'next/server'
import { safeUpdateSession } from '@/lib/supabase/middleware'

/**
 * Middleware runs before every page, so anything it cannot survive, the site cannot survive.
 * `lib/supabase/middleware.ts` carries the rules that keep that true; this file only imports
 * nothing that could fail to load and calls the wrapper that cannot throw.
 */
export async function middleware(request: NextRequest) {
  return safeUpdateSession(request)
}

export const config = {
  matcher: [
    // everything except static assets and image and font files
    '/((?!_next/static|_next/image|favicon.ico|fonts/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)',
  ],
}
