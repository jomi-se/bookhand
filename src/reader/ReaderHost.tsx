import { useEffect, useRef, type RefObject } from 'react'
import type { ReaderAdapter } from '../domain/reader.ts'
import { FoliateReaderAdapter, type FoliateReaderAdapterOptions } from './FoliateReaderAdapter.ts'
import { bindLatestOptions } from './host-options.ts'

export interface ReaderHostProps {
  readonly className?: string
  /** Lets the reader move focus here after a touch-zone page turn. */
  readonly hostRef?: RefObject<HTMLDivElement | null>
  readonly options?: FoliateReaderAdapterOptions
  readonly onReady: (adapter: ReaderAdapter) => void
  /** Clears every shared reference before Foliate tears the adapter down. */
  readonly onDispose?: (adapter: ReaderAdapter) => void
}

/** Owns the one DOM node Foliate may render into; callers receive only ReaderAdapter. */
export function ReaderHost({ className, hostRef: exposed, options, onReady, onDispose }: ReaderHostProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const optionsRef = useRef(options)
  const onReadyRef = useRef(onReady)
  const onDisposeRef = useRef(onDispose)

  useEffect(() => {
    optionsRef.current = options
  }, [options])

  useEffect(() => {
    onReadyRef.current = onReady
  }, [onReady])

  useEffect(() => {
    onDisposeRef.current = onDispose
  }, [onDispose])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const adapter = new FoliateReaderAdapter(host, bindLatestOptions(() => optionsRef.current))
    onReadyRef.current(adapter)
    return () => {
      onDisposeRef.current?.(adapter)
      void adapter.close()
    }
  }, [])

  useEffect(() => {
    if (exposed) exposed.current = hostRef.current
  }, [exposed])

  return (
    <div
      className={className}
      ref={hostRef}
      data-reader-host
      // Focusable, but not in the tab order: the reader moves focus here after
      // a touch-zone page turn so the person is left on the reading, not on a
      // control that is about to recede.
      tabIndex={-1}
      role="group"
      aria-label="Book"
    />
  )
}
