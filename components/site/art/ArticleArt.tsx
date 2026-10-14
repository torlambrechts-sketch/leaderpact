// After Orgpuls components/marketing/art/ArticleArt.tsx @ d9b1c52 (its D-237): LeaderPact's own drawings.
import type { ArtKind } from '@/lib/site/articles'

/**
 * The drawing beside an article's title and on its card (D-41). Which one an article gets is data (its `art` in
 * lib/site/articles.ts). The colours are the site's tokens (app/globals.css), transcribed, on the hero's tan
 * ground. Decorative: the article says everything a drawing shows, so every drawing is hidden from screen readers.
 */
const INK = '#111111'
const PAPER = '#ffffff'
const SUNK = '#f8f5ef'
const TAN = '#e4d9c9'
const BAR = '#e4ddd2'
const LAV = '#cccbdc'
const LAV_MID = '#b5b3cf'
const LAV_STRONG = '#8a87b3'
const TEAL = '#c3e1e6'
const YELLOW = '#fdea8a'
const ORANGE = '#e07049'

const line = { stroke: INK, strokeWidth: 2.4, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

function Ground() {
  return (
    <>
      <circle cx="220" cy="184" r="156" fill={TAN} />
      <circle cx="58" cy="92" r="9" fill={YELLOW} />
      <circle cx="394" cy="268" r="7" fill={ORANGE} />
      <circle cx="380" cy="62" r="5" fill={INK} />
      <circle cx="74" cy="292" r="6" fill={LAV_STRONG} />
    </>
  )
}

/** a short grey line standing for text */
const Text = ({ x, y, w, fill = BAR }: { x: number; y: number; w: number; fill?: string }) => <rect x={x} y={y} width={w} height="7" rx="3.5" fill={fill} />

/** four layers, each resting on the last and reaching higher, to a star */
function Layers() {
  const slabs = [
    { x: 70, y: 236, fill: LAV },
    { x: 112, y: 186, fill: TEAL },
    { x: 154, y: 136, fill: YELLOW },
    { x: 196, y: 86, fill: PAPER },
  ]
  return (
    <>
      {slabs.map((s, i) => (
        <g key={i}>
          <rect x={s.x} y={s.y} width="176" height="62" rx="16" fill={s.fill} {...line} />
          <circle cx={s.x + 28} cy={s.y + 31} r="11" fill={PAPER} {...line} />
          <Text x={s.x + 50} y={s.y + 21} w={92} fill={INK} />
          <Text x={s.x + 50} y={s.y + 36} w={64} />
        </g>
      ))}
      <path d="M392 196 V72" {...line} />
      <path d="M383 84 L392 70 L401 84" fill="none" {...line} />
      <path d="M392 32 l7.6 15.4 17 2.5 -12.3 12 2.9 16.9 -15.2 -8 -15.2 8 2.9 -16.9 -12.3 -12 17 -2.5 z" fill={ORANGE} {...line} />
    </>
  )
}

/** a clipboard of scores, level and agreement, under a magnifier */
function Assess() {
  const bars = [132, 96, 150, 70]
  return (
    <>
      <rect x="112" y="54" width="196" height="252" rx="20" fill={LAV} {...line} />
      <rect x="128" y="78" width="164" height="212" rx="12" fill={PAPER} {...line} />
      <rect x="176" y="42" width="68" height="28" rx="10" fill={INK} />
      {bars.map((w, i) => (
        <g key={i}>
          <Text x={146} y={104 + i * 46} w={70} fill={INK} />
          <rect x="146" y={118 + i * 46} width="128" height="10" rx="5" fill={BAR} />
          <rect x="146" y={118 + i * 46} width={w * 0.85} height="10" rx="5" fill={LAV_STRONG} />
        </g>
      ))}
      <g transform="translate(300 230)">
        <circle r="46" fill={TEAL} fillOpacity="0.85" stroke={INK} strokeWidth="7" />
        <circle cx="-14" cy="-6" r="6" fill={INK} />
        <circle cx="2" cy="-6" r="6" fill={INK} />
        <circle cx="18" cy="-6" r="6" fill={INK} />
        <circle cx="-6" cy="12" r="6" fill={PAPER} stroke={INK} strokeWidth="2" />
        <circle cx="10" cy="12" r="6" fill={PAPER} stroke={INK} strokeWidth="2" />
        <path d="M33 33 L66 66" stroke={INK} strokeWidth="13" strokeLinecap="round" />
      </g>
    </>
  )
}

/** a pyramid of five, beside a page of research with a tick */
function Pyramid() {
  const fills = [LAV, TEAL, YELLOW, PAPER, ORANGE]
  return (
    <>
      {fills.map((f, i) => {
        const y = 288 - i * 46
        const half = 130 - i * 24
        const top = half - 24
        return <path key={i} d={`M${190 - half} ${y} L${190 + half} ${y} L${190 + top} ${y - 40} L${190 - top} ${y - 40} Z`} fill={f} {...line} />
      })}
      <g transform="rotate(8 340 170)">
        <rect x="300" y="96" width="92" height="120" rx="12" fill={PAPER} {...line} />
        <Text x={314} y={116} w={52} fill={INK} />
        <Text x={314} y={134} w={62} />
        <Text x={314} y={150} w={48} />
        <Text x={314} y={166} w={58} />
        <circle cx="366" cy="194" r="15" fill={TEAL} {...line} />
        <path d="M359 194 l5 5 l9 -10" fill="none" {...line} />
      </g>
    </>
  )
}

/** a compass, its needle settled, over a path that leads to a flag */
function Compass() {
  return (
    <>
      <path d="M70 296 C130 250 150 300 210 262 S300 230 330 150" fill="none" stroke={INK} strokeWidth="2.4" strokeDasharray="2 9" strokeLinecap="round" />
      <path d="M330 150 V86" {...line} />
      <path d="M330 88 L376 102 L330 118 Z" fill={YELLOW} {...line} />
      <circle cx="190" cy="166" r="98" fill={PAPER} {...line} />
      <circle cx="190" cy="166" r="76" fill={SUNK} stroke={BAR} strokeWidth="2" />
      {[0, 90, 180, 270].map((a) => (
        <rect key={a} x="186" y="74" width="8" height="18" rx="4" fill={INK} transform={`rotate(${a} 190 166)`} />
      ))}
      <g transform="rotate(38 190 166)">
        <path d="M190 96 L206 166 L190 236 L174 166 Z" fill={LAV} {...line} />
        <path d="M190 96 L206 166 L174 166 Z" fill={ORANGE} {...line} />
      </g>
      <circle cx="190" cy="166" r="9" fill={INK} />
    </>
  )
}

/** a one-page charter: its parts ticked, a signature and the pen */
function Charter() {
  return (
    <>
      <rect x="112" y="40" width="204" height="270" rx="16" fill={PAPER} {...line} />
      <rect x="132" y="62" width="120" height="12" rx="6" fill={INK} />
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <rect x="132" y={94 + i * 42} width="22" height="22" rx="7" fill={[LAV, TEAL, YELLOW, LAV][i]} {...line} />
          <path d={`M137 ${105 + i * 42} l4 4 l8 -9`} fill="none" {...line} />
          <Text x={166} y={96 + i * 42} w={110} fill={INK} />
          <Text x={166} y={110 + i * 42} w={84} />
        </g>
      ))}
      <path d="M134 280 C150 262 160 292 176 274 S200 268 210 278" fill="none" {...line} />
      <path d="M132 290 H244" stroke={BAR} strokeWidth="2.4" strokeLinecap="round" />
      <g transform="rotate(38 306 240)">
        <rect x="294" y="150" width="24" height="120" rx="8" fill={LAV_STRONG} {...line} />
        <path d="M294 270 L306 298 L318 270 Z" fill={YELLOW} {...line} />
        <rect x="294" y="150" width="24" height="22" rx="8" fill={INK} />
      </g>
    </>
  )
}

/** eight members and every pair between them: 28 links */
function Network() {
  const n = 8
  const pts = Array.from({ length: n }, (_, i) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2
    return [220 + 118 * Math.cos(a), 184 + 118 * Math.sin(a)] as const
  })
  const fills = [LAV, TEAL, YELLOW, PAPER, LAV_MID, TEAL, YELLOW, LAV]
  return (
    <>
      {pts.flatMap(([x1, y1], i) =>
        pts.slice(i + 1).map(([x2, y2], j) => <line key={`${i}-${j}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={INK} strokeOpacity="0.28" strokeWidth="1.6" />),
      )}
      {pts.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="24" fill={fills[i]} {...line} />
          <circle cx={x} cy={y - 6} r="7" fill={INK} />
          <path d={`M${x - 11} ${y + 13} C${x - 9} ${y + 2} ${x + 9} ${y + 2} ${x + 11} ${y + 13}`} fill={INK} />
        </g>
      ))}
    </>
  )
}

/** an agenda: each item marked by type, with its time box, and the clock */
function Agenda() {
  const rows = [
    { chip: LAV, w: 96, time: 30 },
    { chip: YELLOW, w: 120, time: 52 },
    { chip: TEAL, w: 84, time: 40 },
    { chip: TAN, w: 108, time: 30 },
    { chip: LAV, w: 70, time: 30 },
  ]
  return (
    <>
      <rect x="76" y="58" width="236" height="256" rx="20" fill={PAPER} {...line} />
      <rect x="96" y="80" width="110" height="12" rx="6" fill={INK} />
      {rows.map((r, i) => (
        <g key={i}>
          <rect x="96" y={110 + i * 38} width="34" height="22" rx="8" fill={r.chip} {...line} />
          <Text x={142} y={118 + i * 38} w={r.w} fill={i === 1 ? INK : BAR} />
          <rect x={290 - r.time} y={114 + i * 38} width={r.time} height="14" rx="7" fill={i === 1 ? LAV_STRONG : SUNK} stroke={BAR} strokeWidth="1.5" />
        </g>
      ))}
      <g transform="translate(330 106)">
        <circle r="54" fill={YELLOW} {...line} />
        <circle r="40" fill={PAPER} {...line} />
        <path d="M0 -26 V0 L18 12" fill="none" {...line} />
        <path d="M0 -54 V-64 M-12 -66 H12" {...line} />
      </g>
    </>
  )
}

/** voices around the table: a point made, a question asked, and a shield over both */
function Voice() {
  return (
    <>
      <path d="M78 110 h150 a20 20 0 0 1 20 20 v62 a20 20 0 0 1 -20 20 h-94 l-28 26 v-26 h-28 a20 20 0 0 1 -20 -20 v-62 a20 20 0 0 1 20 -20 z" fill={PAPER} {...line} />
      <Text x={100} y={138} w={110} fill={INK} />
      <Text x={100} y={156} w={130} />
      <Text x={100} y={174} w={84} />
      <path d="M216 222 h132 a20 20 0 0 1 20 20 v46 a20 20 0 0 1 -20 20 h-20 v24 l-26 -24 h-86 a20 20 0 0 1 -20 -20 v-46 a20 20 0 0 1 20 -20 z" fill={LAV} {...line} />
      <path d="M270 256 c0 -16 26 -18 26 -2 c0 10 -13 11 -13 24" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="283" cy="292" r="3.6" fill={INK} />
      <path d="M318 62 l46 16 v40 c0 34 -22 56 -46 66 c-24 -10 -46 -32 -46 -66 v-40 z" fill={TEAL} {...line} />
      <path d="M298 120 l14 14 l26 -28" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <g transform="translate(96 288)">
        <circle cx="0" cy="-22" r="15" fill={INK} />
        <path d="M-28 22 C-26 -4 26 -4 28 22 Z" fill={YELLOW} {...line} />
      </g>
      <g transform="translate(384 196)">
        <circle cx="0" cy="-12" r="11" fill={INK} />
        <path d="M-20 18 C-18 -2 18 -2 20 18 Z" fill={LAV_MID} {...line} />
      </g>
    </>
  )
}

/** a bridge between two sides, its deck held up by three pillars */
function Bridge() {
  const pillars = [
    { x: 148, fill: LAV },
    { x: 208, fill: TEAL },
    { x: 268, fill: YELLOW },
  ]
  return (
    <>
      <path d="M40 300 V186 H118 V300" fill={SUNK} {...line} />
      <path d="M400 300 V186 H322 V300" fill={SUNK} {...line} />
      <path d="M118 186 Q220 120 322 186" fill="none" {...line} />
      {[150, 174, 198, 222, 246, 270, 294].map((x) => {
        const y = 186 - 64 * (1 - ((x - 220) / 102) ** 2) * 0.5
        return <path key={x} d={`M${x} ${y} V186`} stroke={INK} strokeWidth="1.8" strokeLinecap="round" />
      })}
      <rect x="110" y="182" width="220" height="16" rx="6" fill={LAV_STRONG} {...line} />
      {pillars.map((p) => (
        <rect key={p.x} x={p.x} y="198" width="24" height="102" rx="6" fill={p.fill} {...line} />
      ))}
      <path d="M30 300 H410" {...line} />
      <g>
        <circle cx="80" cy="148" r="13" fill={INK} />
        <path d="M62 186 C64 166 96 166 98 186 Z" fill={INK} />
        <circle cx="360" cy="148" r="13" fill={INK} />
        <path d="M342 186 C344 166 376 166 378 186 Z" fill={INK} />
      </g>
    </>
  )
}

/** two views of the same chart meet in one idea */
function Debate() {
  return (
    <>
      <path d="M48 96 h132 a20 20 0 0 1 20 20 v88 a20 20 0 0 1 -20 20 h-70 l-30 28 v-28 h-32 a20 20 0 0 1 -20 -20 v-88 a20 20 0 0 1 20 -20 z" fill={LAV} {...line} />
      {[0, 1, 2].map((i) => (
        <rect key={i} x={74 + i * 34} y={196 - [44, 70, 30][i]!} width="22" height={[44, 70, 30][i]} rx="5" fill={PAPER} {...line} />
      ))}
      <path d="M392 96 h-132 a20 20 0 0 0 -20 20 v88 a20 20 0 0 0 20 20 h70 l30 28 v-28 h32 a20 20 0 0 0 20 -20 v-88 a20 20 0 0 0 -20 -20 z" fill={TEAL} {...line} />
      <path d="M266 190 L298 150 L326 172 L366 124" fill="none" stroke={INK} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <g transform="translate(220 270)">
        <circle r="36" fill={YELLOW} {...line} />
        <path d="M-10 36 h20 v14 a6 6 0 0 1 -6 6 h-8 a6 6 0 0 1 -6 -6 z" fill={PAPER} {...line} />
        <path d="M-8 6 l8 -12 l8 12" fill="none" {...line} />
        <path d="M0 -6 v26" {...line} />
      </g>
      <path d="M150 262 Q176 290 184 280" fill="none" {...line} strokeDasharray="1 7" />
      <path d="M290 262 Q264 290 256 280" fill="none" {...line} strokeDasharray="1 7" />
    </>
  )
}

const DRAWINGS: Record<ArtKind, () => React.ReactNode> = {
  layers: Layers,
  assess: Assess,
  pyramid: Pyramid,
  compass: Compass,
  charter: Charter,
  network: Network,
  agenda: Agenda,
  voice: Voice,
  bridge: Bridge,
  debate: Debate,
}

export function ArticleArt({ kind, className }: { kind: ArtKind; className?: string }) {
  const Drawing = DRAWINGS[kind]
  return (
    <svg viewBox="0 0 440 360" aria-hidden="true" focusable="false" className={className} fill="none">
      <Ground />
      <Drawing />
    </svg>
  )
}
