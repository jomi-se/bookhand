import { useEffect, useRef, type ReactNode } from 'react'
import { animate, motion, useMotionValue, useTransform } from 'motion/react'

export type SheetSnap = 'half' | 'full'

export interface SheetProps {
  readonly open: boolean
  readonly snap: SheetSnap
  readonly onSnap: (snap: SheetSnap) => void
  readonly onClose: () => void
  readonly header: ReactNode
  readonly children: ReactNode
  readonly footer?: ReactNode
  readonly label: string
  /** Sheets stacked over another surface sit above it. */
  readonly layer?: number
  readonly className?: string
  /** The resting half height in pixels, when the anchor needs room above. */
  readonly halfHeight?: number
  /** A passage to keep lit through the scrim, in viewport pixels. */
  readonly spotlight?: { readonly x: number; readonly y: number; readonly w: number; readonly h: number }
}

const viewport = () => window.visualViewport?.height ?? window.innerHeight
const defaultHeight = (snap: SheetSnap) => Math.round(viewport() * (snap === 'full' ? 0.93 : 0.6))

/**
 * A bottom sheet with two resting heights. The handle and header drag it;
 * the body scrolls. Dragging below the half height, or flicking down, closes it.
 */
export function Sheet({ open, snap, onSnap, onClose, header, children, footer, label, layer = 0, className, halfHeight, spotlight }: SheetProps) {
  const heightFor = (s: SheetSnap) => (s === 'half' && halfHeight ? halfHeight : defaultHeight(s))
  const height = useMotionValue(0)
  const scrim = useTransform(height, (h) => Math.min(0.42, (h / viewport()) * 0.45))
  const drag = useRef<{ startY: number; startH: number; lastY: number; lastT: number; velocity: number } | null>(null)

  useEffect(() => {
    const controls = animate(height, open ? heightFor(snap) : 0, {
      type: 'spring',
      stiffness: open ? 380 : 420,
      damping: open ? 34 : 40,
      mass: 0.9,
    })
    return () => controls.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height, open, snap, halfHeight])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, onClose])

  const onPointerDown = (event: React.PointerEvent) => {
    if ((event.target as HTMLElement).closest('button, a, input, textarea')) return
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
    drag.current = { startY: event.clientY, startH: height.get(), lastY: event.clientY, lastT: performance.now(), velocity: 0 }
  }
  const onPointerMove = (event: React.PointerEvent) => {
    const state = drag.current
    if (!state) return
    const now = performance.now()
    state.velocity = (event.clientY - state.lastY) / Math.max(1, now - state.lastT)
    state.lastY = event.clientY
    state.lastT = now
    const next = state.startH - (event.clientY - state.startY)
    const max = heightFor('full')
    height.set(next > max ? max + (next - max) * 0.2 : Math.max(0, next))
  }
  const onPointerUp = () => {
    const state = drag.current
    drag.current = null
    if (!state) return
    const h = height.get()
    const half = heightFor('half')
    const v = state.velocity
    if (v > 0.9 || h < half * 0.72) return onClose()
    const target: SheetSnap = v < -0.6 ? 'full' : v > 0.5 ? 'half' : h > (half + heightFor('full')) / 2 ? 'full' : 'half'
    if (target === snap) {
      animate(height, heightFor(target), { type: 'spring', stiffness: 380, damping: 34 })
    }
    onSnap(target)
  }

  return (
    <div className={`proto-sheet-root ${className ?? ''}`} data-open={open || undefined} style={{ zIndex: 60 + layer * 5 }}>
      <motion.div
        className="proto-scrim"
        style={{
          opacity: scrim,
          ...(spotlight && snap === 'half'
            ? {
                clipPath: `path(evenodd, 'M0 0 H${window.innerWidth} V${window.innerHeight} H0 Z M${spotlight.x - 8} ${spotlight.y - 6} h${spotlight.w + 16} v${spotlight.h + 12} h${-(spotlight.w + 16)} Z')`,
              }
            : {}),
        }}
        onClick={onClose}
        aria-hidden="true"
      />
      {spotlight && snap === 'half' && open ? (
        <motion.div
          className="proto-spotlight"
          initial={{ opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15, type: 'spring', stiffness: 300, damping: 24 }}
          style={{ left: spotlight.x - 8, top: spotlight.y - 6, width: spotlight.w + 16, height: spotlight.h + 12 }}
          aria-hidden="true"
        />
      ) : null}
      <motion.section
        className="proto-sheet"
        style={{ height }}
        role="dialog"
        aria-label={label}
        aria-modal="false"
      >
        <div
          className="proto-sheet-grip"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={() => onSnap(snap === 'full' ? 'half' : 'full')}
        >
          <span className="proto-sheet-handle" aria-hidden="true" />
          {header}
        </div>
        <div className="proto-sheet-body">{children}</div>
        {footer ? <div className="proto-sheet-footer">{footer}</div> : null}
      </motion.section>
    </div>
  )
}
