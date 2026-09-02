import { useCallback, useEffect, useMemo, useState } from 'react'

import type {
  Annotation,
  AnnotationColor,
  BookCatalogEntry,
  ReaderAnnotationMark,
  StudyBoard,
  StudyItem,
} from '../domain/index.ts'
import { BookhandCommands } from '../app/commands.ts'
import type { PresentationStore } from '../app/presentation.ts'
import type { ReaderPortBridge } from '../app/reader-bridge.ts'
import type { SurfaceStore } from '../app/surface.ts'
import { DESIGN_CONTEXT_VERSION } from '../webmcp/design-context.ts'
import { splitTitle } from '../library/progress.ts'
import type { StorageClient } from '../storage/client.ts'

/**
 * Highlight colours. These are solid on purpose: the renderer draws highlights
 * at roughly 30% opacity already, so passing a translucent colour compounds the
 * two and leaves a grey smear instead of the colour that was chosen.
 */
export const ANNOTATION_CSS: Record<AnnotationColor, string> = {
  accent: '#c24a2b',
  amber: '#d69e2e',
  sky: '#3b82f6',
  moss: '#48946a',
}

/**
 * A refused mutation the person can see and act on.
 *
 * A rejection that only reaches the console is, from where the person sits,
 * indistinguishable from the action having worked — and worse, from the action
 * having worked wrongly. Every refusal that reaches a person carries the
 * message written for them and the exact thing that failed, so it can be tried
 * again once whatever caused it has changed. `VAL-MUTATION-ERRORS`.
 */
export interface MutationFailure {
  readonly message: string
  readonly retry: () => void
}

export interface UseStudyOptions {
  readonly entry: BookCatalogEntry
  readonly client: StorageClient
  readonly bridge: ReaderPortBridge
  readonly presentation: PresentationStore
  readonly surface: SurfaceStore
}

export function useStudy({ entry, client, bridge, presentation, surface }: UseStudyOptions) {
  const [board, setBoard] = useState<StudyBoard>()
  const [commands, setCommands] = useState<BookhandCommands>()
  const [annotations, setAnnotations] = useState<readonly Annotation[]>([])
  const [items, setItems] = useState<readonly StudyItem[]>([])
  const [error, setError] = useState<string>()
  const [mutationError, setMutationError] = useState<MutationFailure>()

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const loaded = await client.getBoard(entry.id)
        if (!alive) return
        setBoard(loaded)
        setCommands(
          new BookhandCommands({
            client,
            bridge,
            presentation,
            surface,
            designContextVersion: DESIGN_CONTEXT_VERSION,
            bookId: entry.id,
            bookTitle: splitTitle(entry.metadata).title,
            board: loaded,
          }),
        )
      } catch (cause) {
        if (alive) setError(cause instanceof Error ? cause.message : 'Study board unavailable')
      }
    })()
    return () => {
      alive = false
    }
  }, [bridge, client, entry.id, entry.metadata, presentation, surface])

  const reload = useCallback(async () => {
    if (!commands) return
    const [nextAnnotations, nextItems] = await Promise.all([
      commands.listAnnotations(),
      commands.listStudyItems(),
    ])
    setAnnotations(nextAnnotations)
    setItems(nextItems)
    // The board is refreshed here too, so a layout change made through a tool
    // shows without the interface having to be told about it separately.
    setBoard(commands.studyBoard)
  }, [commands])

  useEffect(() => {
    if (!commands) return
    void reload()
    return commands.subscribe(() => void reload())
  }, [commands, reload])

  const marks = useMemo<readonly ReaderAnnotationMark[]>(
    () =>
      annotations
        .filter((annotation) => Boolean(annotation.range.cfi))
        .map((annotation) => ({
          id: annotation.id,
          cfi: annotation.range.cfi as string,
          color: ANNOTATION_CSS[annotation.color],
        })),
    [annotations],
  )

  /**
   * Run one mutation, surfacing any refusal instead of dropping it.
   *
   * Every refusal this product raises already carries the wording meant for a
   * person, so it is shown as it arrives rather than smoothed into a generic
   * apology; a vague failure is one nobody can act on.
   */
  const run = useCallback((describe: string, action: () => Promise<unknown>) => {
    const attempt = () => {
      setMutationError(undefined)
      void action().catch((cause: unknown) => {
        const message = cause instanceof Error ? cause.message : `Could not ${describe}.`
        setMutationError({ message, retry: attempt })
      })
    }
    attempt()
  }, [])

  const dismissMutationError = useCallback(() => setMutationError(undefined), [])

  return {
    board,
    commands,
    annotations,
    items,
    marks,
    error,
    mutationError,
    dismissMutationError,
    run,
    reload,
    setBoard,
  }
}
