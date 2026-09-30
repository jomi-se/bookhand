/**
 * Static previews for the Notebook (ADR 0013: lists never start live frames).
 * A real artifact would carry a captured preview; these are drawn by hand.
 */
const INK = 'var(--ink)'
const HUE = 'var(--hue)'
const MUTED = 'var(--muted)'

function Square() {
  return (
    <svg viewBox="0 0 120 90">
      <rect x="30" y="12" width="52" height="52" rx="3" fill={HUE} opacity=".16" stroke={HUE} strokeWidth="1.2" />
      <rect x="83" y="12" width="9" height="52" rx="1.5" fill="var(--amber)" opacity=".9" />
      <rect x="30" y="65" width="52" height="9" rx="1.5" fill="var(--amber)" opacity=".9" />
      <rect x="83" y="65" width="9" height="9" rx="1.5" fill="var(--sky)" className="poster-pulse" />
      <text x="56" y="44" textAnchor="middle" fontSize="16" fontStyle="italic" fontFamily="var(--font-serif)" fill={HUE}>x²</text>
    </svg>
  )
}

function Orders() {
  return (
    <svg viewBox="0 0 120 90">
      <rect x="8" y="18" width="104" height="14" rx="3" fill={HUE} opacity=".15" />
      {Array.from({ length: 13 }, (_, i) => <rect key={i} x={8 + i * 8.6} y="16" width=".8" height="18" fill={INK} opacity=".35" />)}
      <rect x="68" y="18" width="8.6" height="14" fill={HUE} />
      <path d="M68 33 L8 56 M76.6 33 L112 56" stroke={HUE} strokeWidth=".8" strokeDasharray="2 2" fill="none" />
      <rect x="8" y="56" width="104" height="14" rx="3" fill={HUE} opacity=".3" />
      {Array.from({ length: 13 }, (_, i) => <rect key={i} x={8 + i * 8.6} y="54" width=".8" height="18" fill={INK} opacity=".35" />)}
      <rect x="42" y="56" width="8.6" height="14" fill={HUE} />
    </svg>
  )
}

function Symbols() {
  return (
    <svg viewBox="0 0 120 90">
      <text x="36" y="66" textAnchor="middle" fontSize="54" fontFamily="var(--font-serif)" fill={INK}>d</text>
      <path d="M92 18 C 86 9, 76 13, 77 26 L 82 64 C 83 77, 72 80, 67 72" fill="none" stroke={HUE} strokeWidth="4.5" strokeLinecap="round" />
      <text x="60" y="84" textAnchor="middle" fontSize="9" fontFamily="var(--font-hand)" fill={MUTED}>a little bit of · the sum of</text>
    </svg>
  )
}

function Ladder() {
  return (
    <svg viewBox="0 0 120 90">
      <rect x="96" y="6" width="8" height="74" fill={MUTED} opacity=".35" />
      <line x1="6" y1="80" x2="116" y2="80" stroke={INK} strokeWidth="1.2" />
      <line x1="50" y1="80" x2="96" y2="12" stroke={HUE} strokeWidth="2.4" strokeLinecap="round" />
      <line x1="56" y1="82" x2="96" y2="24" stroke="var(--sky)" strokeWidth="1" strokeDasharray="2 2" />
      <circle cx="50" cy="80" r="4.5" fill={HUE} />
      <text x="30" y="72" fontSize="10" fontFamily="var(--font-hand)" fill={HUE}>pull →</text>
    </svg>
  )
}

function EPoster() {
  let steps = 'M10 74'
  for (let i = 1; i <= 12; i++) {
    const v = Math.pow(1 + 1 / 12, i)
    const y = 74 - ((v - 1) / 1.8) * 60
    const x = 10 + (i / 12) * 100
    steps += ` H${x.toFixed(1)} V${y.toFixed(1)}`
  }
  return (
    <svg viewBox="0 0 120 90">
      <line x1="10" x2="110" y1={74 - (1.718 / 1.8) * 60} y2={74 - (1.718 / 1.8) * 60} stroke="var(--moss)" strokeDasharray="3 3" />
      <path d={steps} fill="none" stroke={HUE} strokeWidth="2" />
      <text x="104" y="24" textAnchor="end" fontSize="20" fontStyle="italic" fontFamily="var(--font-serif)" fill={INK}>e</text>
    </svg>
  )
}

function Strips() {
  const bars = Array.from({ length: 10 }, (_, i) => {
    const x = 0.5 + (i + 0.5) * 0.2
    const h = (1 + (x * x) / 2) * 16
    return <rect key={i} x={14 + i * 9.4} y={78 - h} width="8.4" height={h} fill={i % 2 ? 'var(--terracotta)' : 'var(--amber)'} opacity=".5" rx="1" />
  })
  return (
    <svg viewBox="0 0 120 90">
      {bars}
      <path d="M8 60 Q 60 58 112 12" fill="none" stroke={INK} strokeWidth="1.6" />
      <line x1="8" y1="78" x2="114" y2="78" stroke={MUTED} />
    </svg>
  )
}

function Cards() {
  return (
    <svg viewBox="0 0 120 90">
      <rect x="30" y="16" width="56" height="64" rx="8" fill="var(--raised)" stroke="var(--rule)" transform="rotate(-10 58 48)" />
      <rect x="34" y="12" width="56" height="64" rx="8" fill="var(--raised)" stroke={HUE} strokeWidth="1.4" transform="rotate(8 62 44)" />
      <text x="62" y="50" textAnchor="middle" fontSize="15" fontStyle="italic" fontFamily="var(--font-serif)" fill={INK} transform="rotate(8 62 44)">(dx)²</text>
      <text x="16" y="50" fontSize="14" fill="var(--terracotta)">←</text>
      <text x="96" y="50" fontSize="14" fill="var(--moss)">→</text>
    </svg>
  )
}

function MapPoster() {
  const points = Array.from({ length: 8 }, (_, i) => [60 + Math.sin(i * 0.9) * 36, 10 + i * 10.5] as const)
  return (
    <svg viewBox="0 0 120 90">
      <path d={`M${points.map(([x, y]) => `${x} ${y}`).join(' L')}`} fill="none" stroke="var(--rule)" strokeWidth="5" strokeLinecap="round" />
      <path d={`M${points.slice(0, 3).map(([x, y]) => `${x} ${y}`).join(' L')}`} fill="none" stroke="var(--accent)" strokeWidth="2.4" strokeLinecap="round" />
      {points.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="4" fill={i < 2 ? 'var(--moss)' : i === 2 ? 'var(--raised)' : 'var(--raised)'} stroke={i === 2 ? 'var(--accent)' : 'var(--muted)'} strokeWidth={i === 2 ? 2 : 0.8} />
      ))}
    </svg>
  )
}

function Note() {
  return (
    <svg viewBox="0 0 120 90">
      <rect x="18" y="10" width="84" height="72" rx="4" fill="color-mix(in oklch, var(--amber) 14%, var(--raised))" />
      <rect x="44" y="6" width="30" height="8" rx="2" fill="var(--amber)" opacity=".5" transform="rotate(-4 59 10)" />
      {[28, 40, 52, 64].map((y, i) => (
        <path key={y} d={`M28 ${y} q 8 -3 16 0 t 16 0 t 16 0 ${i < 3 ? 't 16 0' : ''}`} fill="none" stroke={INK} strokeWidth="1.3" opacity=".55" strokeLinecap="round" />
      ))}
    </svg>
  )
}

function Kept() {
  return (
    <svg viewBox="0 0 120 90">
      <path d="M20 16 h80 a8 8 0 0 1 8 8 v34 a8 8 0 0 1 -8 8 h-52 l-14 12 v-12 h-14 a8 8 0 0 1 -8 -8 v-34 a8 8 0 0 1 8 -8z" fill="var(--raised)" stroke={HUE} strokeWidth="1.4" />
      <text x="28" y="44" fontSize="26" fontFamily="var(--font-serif)" fill={HUE}>❝</text>
      {[34, 44, 54].map((y, i) => <rect key={y} x="50" y={y} width={i === 2 ? 30 : 46} height="3" rx="1.5" fill={INK} opacity=".35" />)}
    </svg>
  )
}

function Session() {
  return (
    <svg viewBox="0 0 120 90">
      <circle cx="94" cy="20" r="26" fill="var(--amber)" opacity=".25" />
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <circle cx={22 + i * 26} cy="52" r="7" fill={i < 2 ? 'var(--moss)' : 'var(--raised)'} stroke={i === 2 ? 'var(--accent)' : 'var(--muted)'} strokeWidth={i === 2 ? 2 : 0.8} />
          {i < 3 ? <line x1={29 + i * 26} x2={41 + i * 26} y1="52" y2="52" stroke="var(--muted)" strokeDasharray="2 2" /> : null}
        </g>
      ))}
      <text x="14" y="30" fontSize="11" fontFamily="var(--font-hand)" fill={HUE}>tonight</text>
      <text x="60" y="80" textAnchor="middle" fontSize="9" fontFamily="var(--font-serif)" fontStyle="italic" fill={MUTED}>bits → ratios</text>
    </svg>
  )
}

const POSTERS: Record<string, () => React.JSX.Element> = {
  square: Square,
  orders: Orders,
  symbols: Symbols,
  ladder: Ladder,
  e: EPoster,
  strips: Strips,
  cards: Cards,
  map: MapPoster,
  note: Note,
  kept: Kept,
  session: Session,
}

export function Poster({ id }: { readonly id?: string }) {
  const Component = (id && POSTERS[id]) || Kept
  return <Component />
}
