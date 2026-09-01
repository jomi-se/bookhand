import { useCallback, useEffect, useRef, useState } from 'react'

import type {
  BookCatalogEntry,
  ReadingState,
} from '../domain/index.ts'
import type {
  BookMetadata,
  BookTarget,
  ReaderAdapter,
  ReaderLocation,
  ReaderSelection,
  ReaderStyle,
  TocItem,
} from '../domain/reader.ts'
import {
  BOOK_OPEN_DEADLINE_MS,
  systemClock,
  withDeadline,
  type RuntimeClock,
} from '../runtime/deadlines.ts'
import type { RuntimePorts } from '../runtime/ports.ts'
import type { ReaderPortBridge } from '../app/runtime.ts'
import type { StorageClient } from '../storage/client.ts'
import { DEFAULT_READER_STYLE } from './FoliateReaderAdapter.ts'

export type ReaderPhase = 'loading' | 'reading' | 'error'

export interface ReaderState {
  readonly phase: ReaderPhase
  readonly metadata?: BookMetadata
  readonly toc: readonly TocItem[]
  readonly location?: ReaderLocation
  readonly selection: ReaderSelection | null
  readonly style: ReaderStyle
  readonly error?: string
  readonly sectionError?: string
}

export interface UseReaderOptions {
  readonly entry: BookCatalogEntry
  readonly client: StorageClient
  readonly ports: RuntimePorts
  readonly bridge: ReaderPortBridge
  readonly clock?: RuntimeClock
  readonly persistDelayMs?: number
}

function describe(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return 'This book could not be opened.'
}

export function useReader({
  entry,
  client,
  ports,
  bridge,
  clock = systemClock,
  persistDelayMs = 900,
}: UseReaderOptions) {
  const [state, setState] = useState<ReaderState>({
    phase: 'loading',
    toc: [],
    selection: null,
    style: entry.readingState?.style ?? DEFAULT_READER_STYLE,
  })
  const adapterRef = useRef<ReaderAdapter>(null)
  const alive = useRef(true)
  const pendingSave = useRef<ReturnType<typeof setTimeout>>(null)
  const latest = useRef<{ location?: ReaderLocation; style: ReaderStyle }>({
    style: entry.readingState?.style ?? DEFAULT_READER_STYLE,
  })

  const persistNow = useCallback(() => {
    const location = latest.current.location
    if (!location) return
    const record: ReadingState = {
      bookId: entry.id,
      location,
      style: latest.current.style,
      updatedAt: new Date().toISOString(),
    }
    void client.putReadingState(record).catch(() => undefined)
  }, [client, entry.id])

  const schedulePersist = useCallback(() => {
    if (pendingSave.current) clearTimeout(pendingSave.current)
    pendingSave.current = setTimeout(persistNow, persistDelayMs)
  }, [persistDelayMs, persistNow])

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      if (pendingSave.current) clearTimeout(pendingSave.current)
      persistNow()
    }
  }, [persistNow])

  /** Called by the host once its adapter exists; opens and restores the book. */
  const attach = useCallback(
    (adapter: ReaderAdapter) => {
      adapterRef.current = adapter
      bridge.attach(adapter)

      void (async () => {
        try {
          const stored = await client.getBook(entry.id)
          if (!stored) throw new Error('This book is no longer in your library.')
          const blob = new Blob([stored.epubBytes as unknown as BlobPart], {
            type: 'application/epub+zip',
          })
          const metadata = await withDeadline(
            ports.reader.openBook(blob),
            BOOK_OPEN_DEADLINE_MS,
            clock,
          )
          if (!alive.current) return

          // Style precedes location so pagination settles before we restore.
          const restored = await client.getReadingState(entry.id)
          const style = restored?.style ?? DEFAULT_READER_STYLE
          adapter.applyStyle(style)
          latest.current.style = style
          if (restored?.location.cfi) {
            try {
              await adapter.navigate({ kind: 'cfi', cfi: restored.location.cfi })
            } catch {
              // A stale CFI must not keep a readable book closed.
            }
          }
          if (!alive.current) return
          setState((p) => ({
            ...p,
            phase: 'reading',
            metadata,
            style,
            toc: adapter.getToc(),
            location: safeLocation(adapter),
          }))
        } catch (error) {
          if (alive.current) setState((p) => ({ ...p, phase: 'error', error: describe(error) }))
        }
      })()
    },
    [bridge, clock, client, entry.id, ports],
  )

  const detach = useCallback(
    (adapter: ReaderAdapter) => {
      bridge.detach(adapter)
      if (adapterRef.current === adapter) adapterRef.current = null
    },
    [bridge],
  )

  const onLocationChange = useCallback(
    (location: ReaderLocation) => {
      latest.current.location = location
      setState((p) => ({ ...p, location }))
      schedulePersist()
    },
    [schedulePersist],
  )

  const onSelectionChange = useCallback((selection: ReaderSelection | null) => {
    setState((p) => ({ ...p, selection }))
  }, [])

  const onSectionError = useCallback((error: Error) => {
    setState((p) => ({ ...p, sectionError: error.message }))
  }, [])

  const navigate = useCallback(async (target: BookTarget) => {
    const adapter = adapterRef.current
    if (!adapter) return
    setState((p) => ({ ...p, sectionError: undefined }))
    try {
      await adapter.navigate(target)
    } catch (error) {
      setState((p) => ({ ...p, sectionError: describe(error) }))
    }
  }, [])

  const applyStyle = useCallback(
    (style: ReaderStyle) => {
      adapterRef.current?.applyStyle(style)
      latest.current.style = style
      setState((p) => ({ ...p, style }))
      schedulePersist()
    },
    [schedulePersist],
  )

  const resetStyle = useCallback(() => applyStyle(DEFAULT_READER_STYLE), [applyStyle])

  return {
    ...state,
    attach,
    detach,
    navigate,
    applyStyle,
    resetStyle,
    onLocationChange,
    onSelectionChange,
    onSectionError,
  }
}

function safeLocation(adapter: ReaderAdapter): ReaderLocation | undefined {
  try {
    return adapter.getLocation()
  } catch {
    return undefined
  }
}
