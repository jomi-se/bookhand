/**
 * Markings: how a passage shows that something is attached to it.
 *
 * Prototype for book artifacts ticket 01. Each style is a Foliate overlay
 * draw function; `highlight` stays Foliate's own.
 */
export type MarkingStyle = 'highlight' | 'wash' | 'margin' | 'pin'

const SVG = 'http://www.w3.org/2000/svg'

function el<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attributes: Record<string, string | number>,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG, tag)
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, String(value))
  return node
}

interface MarkingOptions {
  readonly color?: string
  readonly glyph?: string
  /** The annotation's CFI, so the host can find a marking on screen. */
  readonly cfi?: string
}

function tag(g: SVGGElement, options: MarkingOptions) {
  if (options.cfi) g.setAttribute('data-cfi', options.cfi)
  return g
}

/** Soft ink wash with a confident underline. */
export function drawWash(rects: readonly DOMRect[], options: MarkingOptions = {}): Element {
  const color = options.color ?? 'currentColor'
  const g = tag(el('g', { 'data-marking': 'wash' }), options)
  for (const { left, top, width, height } of rects) {
    g.append(el('rect', {
      x: left - 1, y: top + height * 0.08, width: width + 2, height: height * 0.9,
      rx: 3, fill: color, opacity: 0.13,
    }))
    g.append(el('rect', {
      x: left, y: top + height - 1.5, width, height: 2, rx: 1, fill: color, opacity: 0.75,
    }))
  }
  return g
}

/** A pencil stroke in the margin beside the passage, with a dot at its head. */
export function drawMargin(rects: readonly DOMRect[], options: MarkingOptions = {}): Element {
  const color = options.color ?? 'currentColor'
  const g = tag(el('g', { 'data-marking': 'margin' }), options)
  if (!rects.length) return g
  // Rects can span two columns in paginated mode. Text flows down a column
  // and then jumps back up to the next one, so a rect above its predecessor
  // starts a new column.
  const columns: DOMRect[][] = []
  for (const rect of rects) {
    const column = columns[columns.length - 1]
    const previous = column?.[column.length - 1]
    if (!column || !previous || rect.top < previous.top - 4) columns.push([rect])
    else column.push(rect)
  }
  for (const column of columns) {
    const left = Math.min(...column.map((rect) => rect.left))
    const top = Math.min(...column.map((rect) => rect.top))
    const bottom = Math.max(...column.map((rect) => rect.bottom))
    const x = left - 11
    const mid = (top + bottom) / 2
    g.append(el('path', {
      d: `M ${x + 0.6} ${top + 3} Q ${x - 1.2} ${mid} ${x + 0.4} ${bottom - 3}`,
      fill: 'none', stroke: color, 'stroke-width': 3, 'stroke-linecap': 'round', opacity: 0.85,
    }))
    g.append(el('circle', { cx: x + 0.6, cy: top + 3, r: 3.6, fill: color }))
    for (const { left: l, top: t, width, height } of column) {
      g.append(el('rect', { x: l - 1, y: t, width: width + 2, height, rx: 3, fill: color, opacity: 0.06 }))
    }
  }
  return g
}

/** A dotted underline ending in a small pin with the artifact's glyph. */
export function drawPin(rects: readonly DOMRect[], options: MarkingOptions = {}): Element {
  const color = options.color ?? 'currentColor'
  const g = tag(el('g', { 'data-marking': 'pin' }), options)
  for (const { left, bottom, width } of rects) {
    g.append(el('line', {
      x1: left + 1, y1: bottom - 1, x2: left + width - 1, y2: bottom - 1,
      stroke: color, 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-dasharray': '0.1 5',
      opacity: 0.9,
    }))
  }
  const last = rects[rects.length - 1]
  if (last) {
    // Raised into the leading at the end of the passage, like a footnote
    // marker, so it never sits on top of the next word.
    const cx = last.right + 1
    const cy = last.top - 1
    g.append(el('circle', { cx, cy, r: 7.5, fill: color, stroke: 'var(--overlayer-canvas, #fff)', 'stroke-width': 1.5 }))
    const glyph = el('text', {
      x: cx, y: cy + 0.5, 'text-anchor': 'middle', 'dominant-baseline': 'central',
      'font-size': 9, 'font-family': 'system-ui, sans-serif', 'font-weight': 700, fill: '#fff',
    })
    glyph.textContent = options.glyph ?? '✦'
    g.append(glyph)
  }
  return g
}

export const MARKING_DRAWERS = {
  wash: drawWash,
  margin: drawMargin,
  pin: drawPin,
} as const
