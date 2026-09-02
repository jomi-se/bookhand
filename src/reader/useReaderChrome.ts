import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Secondary chrome that gets out of the way, and comes back the moment it is
 * wanted.
 *
 * The rule that matters is the one about focus: chrome never recedes while it
 * or an open panel holds focus. Hiding a control someone is standing on is how
 * a receding toolbar becomes a trap for anyone navigating by keyboard or
 * switch, and it costs one check to never do it. `VAL-MOBILE-CHROME`.
 */

/** Time without pointer, touch, keyboard, or focus activity before receding. */
export const CHROME_IDLE_MS = 2_500

/** Where focus may be without the chrome being allowed to recede. */
const HOLDS_FOCUS = '.reader-chrome, .reader-panel, .reader-footer'

export interface ReaderChrome {
  readonly visible: boolean
  /** Bring it back, and start the idle countdown again. */
  readonly show: () => void
  readonly toggle: () => void
  /** A page turn completed; the chrome may recede once it has settled. */
  readonly notePageTurn: () => void
}

export interface UseReaderChromeOptions {
  /** A panel is open, so the chrome is not what is in the way. */
  readonly panelOpen: boolean
  readonly idleMs?: number
}

export function useReaderChrome({
  panelOpen,
  idleMs = CHROME_IDLE_MS,
}: UseReaderChromeOptions): ReaderChrome {
  const [visible, setVisible] = useState(true)
  const timer = useRef<ReturnType<typeof setTimeout>>(null)

  /**
   * Whether this surface hides chrome at all. A pointer that can hover has no
   * trouble reaching a toolbar and loses nothing by it staying put, so the
   * receding behaviour is for touch-first surfaces only.
   */
  const recedes = useCallback(() => {
    const media = globalThis.matchMedia
    if (!media) return false
    // The same condition as the stylesheet's touch-first layout.
    return media('(max-width: 860px), (pointer: coarse)').matches
  }, [])

  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }, [])

  const hideLater = useCallback(
    (delay: number) => {
      clear()
      if (!recedes() || panelOpen) return
      timer.current = setTimeout(() => {
        const focused = document.activeElement
        if (focused instanceof Element && focused.closest(HOLDS_FOCUS)) {
          // Someone is standing on a control. Try again, rather than pulling
          // the ground out from under them.
          hideLater(delay)
          return
        }
        setVisible(false)
      }, delay)
    },
    [clear, panelOpen, recedes],
  )

  const show = useCallback(() => {
    setVisible(true)
    hideLater(idleMs)
  }, [hideLater, idleMs])

  const toggle = useCallback(() => {
    setVisible((current) => {
      if (current) {
        clear()
        return false
      }
      hideLater(idleMs)
      return true
    })
  }, [clear, hideLater, idleMs])

  /**
   * A completed page turn is the clearest signal that the person is reading
   * rather than navigating, so the chrome goes sooner than the idle timeout —
   * but not instantly, or the turn itself would flash the toolbar away.
   */
  const notePageTurn = useCallback(() => hideLater(Math.min(idleMs, 600)), [hideLater, idleMs])

  // An open panel keeps the chrome, and closing one brings it back: the person
  // has just returned to the book and needs to see where they are.
  useEffect(() => {
    if (panelOpen) {
      clear()
      setVisible(true)
      return
    }
    setVisible(true)
    hideLater(idleMs)
  }, [clear, hideLater, idleMs, panelOpen])

  useEffect(() => {
    const wake = () => show()
    /**
     * Focus landing on the book is not a request for the toolbar — it is what
     * happens on every touch-zone page turn, and treating it as one made the
     * chrome impossible to dismiss by tapping. Only focus arriving on a
     * control counts.
     */
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target
      if (target instanceof Element && target.closest('[data-reader-host]')) return
      show()
    }
    // A mouse moving is a person looking for a control. A finger moving is a
    // person reading, and Foliate is already handling it.
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === 'mouse') show()
    }
    window.addEventListener('keydown', wake)
    window.addEventListener('focusin', onFocusIn)
    window.addEventListener('pointermove', onPointerMove)
    return () => {
      window.removeEventListener('keydown', wake)
      window.removeEventListener('focusin', onFocusIn)
      window.removeEventListener('pointermove', onPointerMove)
    }
  }, [show])

  useEffect(() => clear, [clear])

  return { visible, show, toggle, notePageTurn }
}
