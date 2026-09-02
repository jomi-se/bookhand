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
import type { PresentationStore, PresentationView } from '../app/presentation.ts'
import type { ReaderPortBridge } from '../app/reader-bridge.ts'
import type { StorageClient } from '../storage/client.ts'
import { DEFAULT_READER_STYLE } from './FoliateReaderAdapter.ts'

export type ReaderPhase = 'loading' | 'reading' | 'error'

export interface ReaderState {
  readonly phase: ReaderPhase
  readonly metadata?: BookMetadata
  readonly toc: readonly TocItem[]
  readonly location?: ReaderLocation
  readonly selection: ReaderSelection | null
  /** What the book is showing, which during a preview is not what is stored. */
  readonly style: ReaderStyle
  readonly error?: string
  readonly sectionError?: string
}

export interface UseReaderOptions {
  readonly entry: BookCatalogEntry
  readonly client: StorageClient
  readonly ports: RuntimePorts
  readonly bridge: ReaderPortBridge
  /** The one owner of the reading presentation; the UI and tools both write it. */
  readonly presentation: PresentationStore
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
  presentation,
  clock = systemClock,
  persistDelayMs = 900,
}: UseReaderOptions) {
  const [state, setState] = useState<ReaderState>({
    phase: 'loading',
    toc: [],
    selection: null,
    style: presentation.visible,
  })
  const [presentationView, setPresentationView] = useState<PresentationView>(presentation.view)
  const adapterRef = useRef<ReaderAdapter>(null)
  const alive = useRef(true)
  const pendingSave = useRef<ReturnType<typeof setTimeout>>(null)
  const latest = useRef<{ location?: ReaderLocation; style: ReaderStyle }>({
    style: presentation.committed,
  })

  /**
   * Resolves only when the write actually lands. A style receipt states
   * whether the change survives a reload, so it cannot be built on a promise
   * that was never waited for.
   */
  const persistNow = useCallback(async (): Promise<void> => {
    const location = latest.current.location
    if (!location) throw new Error('There is no reading position to save yet.')
    const record: ReadingState = {
      bookId: entry.id,
      location,
      style: latest.current.style,
      updatedAt: new Date().toISOString(),
    }
    await client.putReadingState(record)
  }, [client, entry.id])

  const schedulePersist = useCallback(() => {
    if (pendingSave.current) clearTimeout(pendingSave.current)
    pendingSave.current = setTimeout(() => void persistNow().catch(() => undefined), persistDelayMs)
  }, [persistDelayMs, persistNow])

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      if (pendingSave.current) clearTimeout(pendingSave.current)
      void persistNow().catch(() => undefined)
    }
  }, [persistNow])

  /**
   * Mirror the store into React, and give it the two things only a mounted
   * reader can do: push a style into the open book, and save it.
   */
  useEffect(() => {
    const stop = presentation.subscribe((view) => {
      setPresentationView(view)
      latest.current.style = view.committed
      setState((p) => (p.style === view.visible ? p : { ...p, style: view.visible }))
    })
    const uninstall = presentation.install({
      apply: (style) => adapterRef.current?.applyStyle(style),
      persist: async (style) => {
        latest.current.style = style
        if (pendingSave.current) clearTimeout(pendingSave.current)
        await persistNow()
      },
    })
    return () => {
      stop()
      uninstall()
    }
  }, [persistNow, presentation])

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
          // `hydrate` yields to anything already committed: the tools are live
          // while a book opens, so a change made in that window must not be
          // erased by a restore that finishes after it.
          const restored = await client.getReadingState(entry.id)
          presentation.hydrate(restored?.style ?? DEFAULT_READER_STYLE)
          const style = presentation.visible
          adapter.applyStyle(style)
          latest.current.style = presentation.committed
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
          latest.current.location = safeLocation(adapter)
        } catch (error) {
          if (alive.current) setState((p) => ({ ...p, phase: 'error', error: describe(error) }))
        }
      })()
    },
    [bridge, clock, client, entry.id, ports, presentation],
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

  return {
    ...state,
    presentation: presentationView,
    attach,
    detach,
    navigate,
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
