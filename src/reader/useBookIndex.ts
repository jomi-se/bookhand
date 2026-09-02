import { useCallback, useEffect, useRef, useState } from 'react'

import type { IndexChunk, IndexState } from '../domain/search.ts'
import { INDEX_BATCH_MAX } from '../domain/search.ts'
import type { ReaderPortBridge } from '../app/reader-bridge.ts'
import type { StorageClient } from '../storage/client.ts'
import type { ReaderPhase } from './useReader.ts'

function chunkId(bookId: string, sectionIndex: number, sectionChunkIndex: number, fingerprint: string): string {
  return `chunk-${bookId}-${sectionIndex}-${sectionChunkIndex}-${fingerprint}`
}

const yieldToReader = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

export function useBookIndex(options: {
  readonly bookId: string
  readonly phase: ReaderPhase
  readonly client: StorageClient
  readonly bridge: ReaderPortBridge
}) {
  const { bookId, phase, client, bridge } = options
  const [state, setState] = useState<IndexState | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [running, setRunning] = useState(false)
  const active = useRef<Promise<void> | undefined>(undefined)
  const cancelRequested = useRef(false)
  const autoStarted = useRef(false)
  const mounted = useRef(true)
  const ownedEpoch = useRef<number | undefined>(undefined)

  const publish = useCallback((next: IndexState | null) => {
    if (mounted.current) setState(next)
  }, [])

  const refresh = useCallback(async () => {
    try {
      publish(await client.getIndexState(bookId))
    } finally {
      if (mounted.current) setLoaded(true)
    }
  }, [bookId, client, publish])

  const start = useCallback(() => {
    if (active.current) return active.current
    cancelRequested.current = false
    const job = (async () => {
      if (mounted.current) setRunning(true)
      let epoch: number | undefined
      try {
        const adapter = bridge.adapter
        if (!adapter) return
        const sections = adapter.listSections().filter((section) => section.linear)
        let current = await client.beginIndex(bookId, sections.length)
        epoch = current.epoch
        ownedEpoch.current = epoch
        if (mounted.current) setLoaded(true)
        publish(current)
        if (current.status === 'complete') return

        let sectionPosition = current.cursor.sectionIndex
        while (sectionPosition < sections.length) {
          if (cancelRequested.current) break
          const section = sections[sectionPosition]
          if (!section) break
          const extracted = await adapter.getSectionChunks(section.index)
          let offset = sectionPosition === current.cursor.sectionIndex ? current.cursor.sectionChunkIndex : 0
          while (offset < extracted.length) {
            if (cancelRequested.current) break
            const slice = extracted.slice(offset, offset + INDEX_BATCH_MAX)
            const indexed: IndexChunk[] = slice.map((chunk, index) => ({
              ...chunk,
              id: chunkId(bookId, chunk.sectionIndex, chunk.sectionChunkIndex, chunk.range.textFingerprint),
              bookId,
              globalOrder: current.cursor.globalOrder + index,
            }))
            const nextOffset = offset + slice.length
            const sectionDone = nextOffset >= extracted.length
            const next = {
              sectionIndex: sectionDone ? sectionPosition + 1 : sectionPosition,
              sectionChunkIndex: sectionDone ? 0 : nextOffset,
              globalOrder: current.cursor.globalOrder + indexed.length,
            }
            current = await client.commitIndexBatch(
              bookId,
              current.epoch,
              current.cursor,
              indexed,
              next,
              sectionDone ? sectionPosition + 1 : sectionPosition,
            )
            publish(current)
            offset = nextOffset
            await yieldToReader()
          }
          if (cancelRequested.current) break
          // Empty sections still advance the durable cursor.
          if (extracted.length === 0) {
            const next = { ...current.cursor, sectionIndex: sectionPosition + 1, sectionChunkIndex: 0 }
            current = await client.commitIndexBatch(bookId, current.epoch, current.cursor, [], next, sectionPosition + 1)
            publish(current)
          }
          sectionPosition += 1
        }
        if (cancelRequested.current) {
          current = await client.cancelIndex(bookId, current.epoch)
        } else {
          current = await client.completeIndex(bookId, current.epoch)
        }
        publish(current)
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : 'The book index could not be built.'
        if (epoch !== undefined) {
          try {
            const next = cancelRequested.current
              ? await client.cancelIndex(bookId, epoch)
              : await client.failIndex(bookId, epoch, message)
            publish(next)
          } catch { /* stale work lost ownership */ }
        }
      } finally {
        if (ownedEpoch.current === epoch) ownedEpoch.current = undefined
        if (mounted.current) setRunning(false)
        active.current = undefined
      }
    })()
    active.current = job
    return job
  }, [bookId, bridge, client, publish])

  const cancel = useCallback(() => {
    cancelRequested.current = true
    const epoch = ownedEpoch.current
    if (epoch === undefined) return
    // Cancellation must reach the worker even while this job is awaiting a
    // paused post-commit response. The eventual job continuation observes the
    // same local flag and starts no further batch.
    void client.cancelIndex(bookId, epoch).then(publish, () => {
      // A newer retry may already own the book; stale cancellation is harmless.
    })
  }, [bookId, client, publish])

  useEffect(() => { void refresh() }, [refresh])
  useEffect(() => {
    if (phase === 'reading' && !autoStarted.current) {
      autoStarted.current = true
      void start()
    }
  }, [phase, start])
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      cancel()
    }
  }, [cancel])

  return { state, loaded, running, retry: start, cancel, refresh }
}
