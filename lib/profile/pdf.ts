import 'server-only'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import fontkit from '@pdf-lib/fontkit'
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import type { Band } from '@/lib/profile/score'

/**
 * A Leader Profile as a PDF file for its owner to send (D-66), drawn with pdf-lib in Figtree and Poppins, the
 * site's faces, from TrueType files in private/fonts (the browser's WOFF2 files cannot be embedded).
 *
 * It holds what a private link shows, and nothing more: the owner's name, the test and its day, and each trait's
 * band at the chosen level, never a sum, a count or a position. The labels every result carries go with it:
 * research-based and not yet validated, no norm group, never good or bad, development only.
 */
export interface ProfilePdfTrait {
  key: string
  domain: string
  name: string
  band: Band
}

export interface ProfilePdfInput {
  name: string
  /** "Full test (IPIP-NEO-120) · taken 16 October 2026" */
  meta: string
  domains: ProfilePdfTrait[]
  /** empty for the domains alone */
  facets: ProfilePdfTrait[]
  words: {
    title: string
    domains: string
    facetsOf: (domain: string) => string
    bands: Record<Band, string>
    notes: string[]
    footer: string
    page: (n: number, total: number) => string
  }
}

const A4 = { width: 595.28, height: 841.89 }
const MARGIN = 48
const INK = rgb(0x11 / 255, 0x11 / 255, 0x11 / 255)
const TEXT2 = rgb(0x55 / 255, 0x52 / 255, 0x4a / 255)
const TRACK = rgb(0xec / 255, 0xe6 / 255, 0xdc / 255)
const BAND = rgb(0xe4 / 255, 0xd9 / 255, 0xc9 / 255)
const RULE = rgb(0xf0 / 255, 0xeb / 255, 0xe2 / 255)
const BANDS: readonly Band[] = ['lower', 'middle', 'higher']

async function font(doc: PDFDocument, file: string): Promise<PDFFont> {
  return doc.embedFont(await readFile(join(process.cwd(), 'private', 'fonts', file)), { subset: true })
}

/** Lines of at most `width` points, broken at spaces */
function wrap(text: string, f: PDFFont, size: number, width: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word
    if (line && f.widthOfTextAtSize(next, size) > width) {
      lines.push(line)
      line = word
    } else line = next
  }
  if (line) lines.push(line)
  return lines
}

export async function profilePdf(input: ProfilePdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  doc.setTitle(`${input.words.title}: ${input.name}`)
  doc.setCreator(input.words.footer)
  doc.setProducer(input.words.footer)
  const [regular, semibold, bold, display] = await Promise.all([
    font(doc, 'Figtree-Regular.ttf'),
    font(doc, 'Figtree-SemiBold.ttf'),
    font(doc, 'Figtree-Bold.ttf'),
    font(doc, 'Poppins-Medium.ttf'),
  ])
  const width = A4.width - 2 * MARGIN
  let page: PDFPage = doc.addPage([A4.width, A4.height])
  let y = A4.height - MARGIN

  const room = (needed: number) => {
    if (y - needed >= MARGIN + 24) return
    page = doc.addPage([A4.width, A4.height])
    y = A4.height - MARGIN
  }
  const text = (s: string, x: number, f: PDFFont, size: number, color = INK) => page.drawText(s, { x, y, size, font: f, color })

  // the title: the label, the person, the test and its day
  text(input.words.title.toUpperCase(), MARGIN, bold, 9, TEXT2)
  y -= 34
  for (const line of wrap(input.name, display, 26, width)) {
    text(line, MARGIN, display, 26)
    y -= 32
  }
  for (const line of wrap(input.meta, regular, 11, width)) {
    text(line, MARGIN, regular, 11, TEXT2)
    y -= 15
  }
  y -= 18

  // the domains, each on a track of three equal bands with its band filled, and the band in words
  const nameW = 150
  const bandW = 70
  const trackX = MARGIN + nameW
  const trackW = width - nameW - bandW
  const segW = (trackW - 6) / 3
  text(input.words.domains, MARGIN, bold, 13)
  BANDS.forEach((b, i) => {
    const label = input.words.bands[b]
    const lw = bold.widthOfTextAtSize(label.toUpperCase(), 7.5)
    page.drawText(label.toUpperCase(), { x: trackX + i * (segW + 3) + (segW - lw) / 2, y, size: 7.5, font: bold, color: TEXT2 })
  })
  y -= 14
  for (const d of input.domains) {
    room(34)
    page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + width, y }, thickness: 0.75, color: RULE })
    y -= 22
    text(d.name, MARGIN, bold, 11.5)
    // the band is filled and outlined in ink, so it reads on paper and in greyscale too
    BANDS.forEach((b, i) => {
      const on = b === d.band
      page.drawRectangle({ x: trackX + i * (segW + 3), y: y - 5, width: segW, height: 16, color: on ? BAND : TRACK, borderColor: on ? INK : undefined, borderWidth: on ? 1 : 0 })
    })
    const word = input.words.bands[d.band]
    text(word, MARGIN + width - bold.widthOfTextAtSize(word, 11), bold, 11)
    y -= 12
  }
  y -= 16

  // the facets, grouped by domain, each with its band in words
  for (const d of input.domains) {
    const own = input.facets.filter((f) => f.domain === d.domain)
    if (own.length === 0) continue
    room(30 + 16 * own.length)
    text(input.words.facetsOf(d.name), MARGIN, bold, 11)
    y -= 16
    for (const f of own) {
      text(f.name, MARGIN + 10, regular, 10.5)
      const word = input.words.bands[f.band]
      text(word, MARGIN + width - semibold.widthOfTextAtSize(word, 10.5), semibold, 10.5)
      y -= 15
    }
    y -= 10
  }

  // what every result says of itself
  room(20 + 14 * input.words.notes.length * 2)
  page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + width, y }, thickness: 0.75, color: RULE })
  y -= 18
  for (const note of input.words.notes) {
    for (const line of wrap(note, regular, 9.5, width)) {
      room(14)
      text(line, MARGIN, regular, 9.5, TEXT2)
      y -= 13
    }
    y -= 3
  }

  // the footer on every page: the product and the page
  const pages = doc.getPages()
  pages.forEach((p, i) => {
    p.drawText(input.words.footer, { x: MARGIN, y: MARGIN - 18, size: 8, font: regular, color: TEXT2 })
    const n = input.words.page(i + 1, pages.length)
    p.drawText(n, { x: A4.width - MARGIN - regular.widthOfTextAtSize(n, 8), y: MARGIN - 18, size: 8, font: regular, color: TEXT2 })
  })
  return doc.save()
}
