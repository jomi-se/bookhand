import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { BookCatalogEntry, StorageDiagnostics } from '../domain/index.ts'
import {
  LIBRARY_LOAD_DEADLINE_MS,
  systemClock,
  withDeadline,
  type RuntimeClock,
} from '../runtime/deadlines.ts'
import type { RuntimePorts } from '../runtime/ports.ts'
import type { StorageClient } from '../storage/client.ts'
import { BUNDLED_BOOKS, type BundledBookRegistration } from './bundled-books.ts'
import {
  bootstrapBundledBooks,
  importEpubFile,
  ImportRejectedError,
  type ImportDependencies,
} from './library-service.ts'

export type LibraryPhase = 'loading' | 'ready' | 'error' | 'locked'

export interface LibraryNotice {
  readonly tone: 'success' | 'failure'
  readonly message: string
}

export interface LibraryState {
  readonly phase: LibraryPhase
  readonly books: readonly BookCatalogEntry[]
  readonly diagnostics?: StorageDiagnostics
  readonly error?: string
  readonly bootstrapping: boolean
  readonly importing: boolean
  readonly notice?: LibraryNotice
}

export interface UseLibraryOptions {
  readonly client: StorageClient
  readonly ports: RuntimePorts
  readonly clock?: RuntimeClock
  readonly registrations?: readonly BundledBookRegistration[]
  readonly dependencies?: ImportDependencies
}

function describe(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return 'Something went wrong reading your library.'
}

export function useLibrary({
  client,
  ports,
  clock = systemClock,
  registrations = BUNDLED_BOOKS,
  dependencies,
}: UseLibraryOptions) {
  const [state, setState] = useState<LibraryState>({
    phase: 'loading',
    books: [],
    bootstrapping: false,
    importing: false,
  })
  const generation = useRef(0)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const listBooks = useCallback(
    () => withDeadline(ports.library.listBooks(), LIBRARY_LOAD_DEADLINE_MS, clock),
    [clock, ports],
  )

  const load = useCallback(async () => {
    const attempt = ++generation.current
    const current = () => alive.current && attempt === generation.current
    setState((previous) => ({
      ...previous,
      phase: 'loading',
      error: undefined,
    }))

    let diagnostics: StorageDiagnostics
    try {
      diagnostics = await withDeadline(
        ports.persistence.initialize(),
        LIBRARY_LOAD_DEADLINE_MS,
        clock,
      )
    } catch (error) {
      if (current()) setState((p) => ({ ...p, phase: 'error', error: describe(error) }))
      return
    }
    if (!current()) return

    if (diagnostics.mode === 'locked') {
      setState((p) => ({ ...p, phase: 'locked', diagnostics, books: [] }))
      return
    }

    let books: readonly BookCatalogEntry[]
    try {
      books = await listBooks()
    } catch (error) {
      if (current()) {
        setState((p) => ({ ...p, phase: 'error', diagnostics, error: describe(error) }))
      }
      return
    }
    if (!current()) return
    setState((p) => ({ ...p, phase: 'ready', books, diagnostics }))

    const missing = registrations.filter(
      (registration) => !books.some((book) => book.id === registration.sha256),
    )
    if (missing.length === 0) return

    setState((p) => ({ ...p, bootstrapping: true }))
    try {
      await bootstrapBundledBooks(client, missing, books, dependencies)
      const refreshed = await listBooks()
      if (current()) {
        setState((p) => ({ ...p, books: refreshed, bootstrapping: false }))
      }
    } catch (error) {
      if (current()) {
        setState((p) => ({
          ...p,
          bootstrapping: false,
          notice: { tone: 'failure', message: describe(error) },
        }))
      }
    }
  }, [clock, client, dependencies, listBooks, ports, registrations])

  useEffect(() => {
    void load()
  }, [load])

  const retry = useCallback(async () => {
    if (state.phase === 'locked') {
      try {
        await client.retryPersistence()
      } catch (error) {
        setState((p) => ({ ...p, error: describe(error) }))
        return
      }
    }
    await load()
  }, [client, load, state.phase])

  const importFile = useCallback(
    async (file: File) => {
      setState((p) => ({ ...p, importing: true, notice: undefined }))
      try {
        await importEpubFile(client, file, dependencies)
        const books = await listBooks()
        if (!alive.current) return
        setState((p) => ({
          ...p,
          books,
          importing: false,
          notice: { tone: 'success', message: `Added ${file.name} to your library.` },
        }))
      } catch (error) {
        if (!alive.current) return
        const message =
          error instanceof ImportRejectedError
            ? error.message
            : `Could not add ${file.name}. ${describe(error)}`
        setState((p) => ({ ...p, importing: false, notice: { tone: 'failure', message } }))
      }
    },
    [client, dependencies, listBooks],
  )

  const dismissNotice = useCallback(() => {
    setState((p) => ({ ...p, notice: undefined }))
  }, [])

  return useMemo(
    () => ({ ...state, retry, importFile, dismissNotice }),
    [dismissNotice, importFile, retry, state],
  )
}
