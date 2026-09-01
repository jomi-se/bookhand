import { useEffect, useRef } from 'react'
import type { ReaderAdapter } from '../domain/reader.ts'
import { FoliateReaderAdapter, type FoliateReaderAdapterOptions } from './FoliateReaderAdapter.ts'
import { bindLatestOptions } from './host-options.ts'

export interface ReaderHostProps {
  readonly className?: string
  readonly options?: FoliateReaderAdapterOptions
  readonly onReady: (adapter: ReaderAdapter) => void
}

/** Owns the one DOM node Foliate may render into; callers receive only ReaderAdapter. */
export function ReaderHost({ className, options, onReady }: ReaderHostProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const optionsRef = useRef(options)
  const onReadyRef = useRef(onReady)

  useEffect(() => {
    optionsRef.current = options
  }, [options])

  useEffect(() => {
    onReadyRef.current = onReady
  }, [onReady])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const adapter = new FoliateReaderAdapter(host, bindLatestOptions(() => optionsRef.current))
    onReadyRef.current(adapter)
    return () => void adapter.close()
  }, [])

  return <div className={className} ref={hostRef} data-reader-host />
}
