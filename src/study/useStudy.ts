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
import type { ReaderPortBridge } from '../app/reader-bridge.ts'
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

export interface UseStudyOptions {
  readonly entry: BookCatalogEntry
  readonly client: StorageClient
  readonly bridge: ReaderPortBridge
}

export function useStudy({ entry, client, bridge }: UseStudyOptions) {
  const [board, setBoard] = useState<StudyBoard>()
  const [commands, setCommands] = useState<BookhandCommands>()
  const [annotations, setAnnotations] = useState<readonly Annotation[]>([])
  const [items, setItems] = useState<readonly StudyItem[]>([])
  const [error, setError] = useState<string>()

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
  }, [bridge, client, entry.id, entry.metadata])

  const reload = useCallback(async () => {
    if (!commands) return
    const [nextAnnotations, nextItems] = await Promise.all([
      commands.listAnnotations(),
      commands.listStudyItems(),
    ])
    setAnnotations(nextAnnotations)
    setItems(nextItems)
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

  return { board, commands, annotations, items, marks, error, reload, setBoard }
}
