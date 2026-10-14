// Origin: Orgpuls app/(marketing)/maler/fil/[fil]/route.ts @ d9b1c52 (adapted: LeaderPact's templates).
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import { granted, grantFor, MIME, TEMPLATE_COOKIE, TEMPLATES, templatePath } from '@/lib/site/templates'

/**
 * A template's file (D-37), to a browser that has asked for the template: its cookie names a template that
 * holds the file. Anyone else goes to the template's page, where the form is. Only names in the registry are
 * read, so the path cannot leave private/templates.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params
  const owner = TEMPLATES.find((t) => t.files.some((f) => f.name === file))
  if (!owner) return new NextResponse(null, { status: 404 })
  const grant = grantFor(file, granted((await cookies()).get(TEMPLATE_COOKIE)?.value))
  if (!grant) return NextResponse.redirect(new URL(`${templatePath(owner.slug)}#get-the-template`, req.url), 303)
  const entry = grant.files.find((f) => f.name === file)!
  const body = await readFile(join(process.cwd(), 'private', 'templates', entry.name))
  return new NextResponse(new Uint8Array(body), {
    headers: {
      'Content-Type': MIME[entry.format],
      'Content-Disposition': `attachment; filename="${entry.name}"`,
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex',
    },
  })
}
