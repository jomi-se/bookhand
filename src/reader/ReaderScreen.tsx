import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, LayoutPanelLeft, List, RotateCw, Type } from 'lucide-react'

import type { BookCatalogEntry } from '../domain/index.ts'
import { splitTitle } from '../library/progress.ts'
import type { ReaderPortBridge } from '../app/runtime.ts'
import type { RuntimePorts } from '../runtime/ports.ts'
import type { StorageClient } from '../storage/client.ts'
import { ContentsPanel } from './ContentsPanel.tsx'
import { ReaderHost } from './ReaderHost.tsx'
import { TextPanel } from './TextPanel.tsx'
import { useReader } from './useReader.ts'

export type ReaderPanel = 'contents' | 'text' | 'study' | null

export interface ReaderScreenProps {
  readonly entry: BookCatalogEntry
  readonly client: StorageClient
  readonly ports: RuntimePorts
  readonly bridge: ReaderPortBridge
  readonly onExit: () => void
}

export function ReaderScreen({ entry, client, ports, bridge, onExit }: ReaderScreenProps) {
  const reader = useReader({ entry, client, ports, bridge })
  const [panel, setPanel] = useState<ReaderPanel>(null)
  const { title } = splitTitle(entry.metadata)

  const toggle = useCallback(
    (next: Exclude<ReaderPanel, null>) => setPanel((p) => (p === next ? null : next)),
    [],
  )

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && panel) setPanel(null)
      if (event.target instanceof HTMLElement) {
        const tag = event.target.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA') return
      }
      if (event.key === 'ArrowRight') void reader.navigate({ kind: 'relative', direction: 'next' })
      if (event.key === 'ArrowLeft') void reader.navigate({ kind: 'relative', direction: 'previous' })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [panel, reader])

  const percent =
    reader.location === undefined ? undefined : Math.round(reader.location.fraction * 100)

  return (
    <div className="reader" data-panel={panel ?? 'none'}>
      <header className="reader-chrome">
        <button type="button" className="button button-quiet button-back" onClick={onExit}>
          <ChevronLeft size={16} aria-hidden="true" />
          Library
        </button>
        <p className="reader-identity">
          <span className="reader-book">{title}</span>
          {reader.location?.chapterLabel ? (
            <>
              <span aria-hidden="true"> · </span>
              <span className="reader-chapter">{reader.location.chapterLabel}</span>
            </>
          ) : null}
        </p>
        <div className="reader-tools">
          <button
            type="button"
            className="button button-quiet"
            aria-pressed={panel === 'contents'}
            onClick={() => toggle('contents')}
          >
            <List size={16} aria-hidden="true" />
            <span className="tool-label">Contents</span>
          </button>
          <button
            type="button"
            className="button button-quiet"
            aria-pressed={panel === 'study'}
            onClick={() => toggle('study')}
          >
            <LayoutPanelLeft size={16} aria-hidden="true" />
            <span className="tool-label">Study</span>
          </button>
          <button
            type="button"
            className="button button-quiet"
            aria-pressed={panel === 'text'}
            onClick={() => toggle('text')}
          >
            <Type size={16} aria-hidden="true" />
            <span className="tool-label">Text</span>
          </button>
        </div>
      </header>

      <div className="reader-stage">
        {panel === 'contents' ? (
          <ContentsPanel
            toc={reader.toc}
            currentSectionIndex={reader.location?.sectionIndex}
            onNavigate={(target) => {
              void reader.navigate(target)
              if (window.matchMedia('(max-width: 860px)').matches) setPanel(null)
            }}
            onClose={() => setPanel(null)}
          />
        ) : null}

        {panel === 'text' ? (
          <TextPanel
            style={reader.style}
            onChange={reader.applyStyle}
            onReset={reader.resetStyle}
            onClose={() => setPanel(null)}
          />
        ) : null}

        {panel === 'study' ? (
          <aside className="reader-panel" aria-label="Study">
            <header className="panel-head">
              <h2>Study</h2>
              <button
                type="button"
                className="button button-icon"
                onClick={() => setPanel(null)}
                aria-label="Close study"
              >
                ✕
              </button>
            </header>
            <div className="panel-body">
              <p className="panel-empty">
                Study boards arrive in the next slice. Selecting a passage here will send it
                to a board with its exact source range.
              </p>
              {reader.selection ? (
                <blockquote className="study-preview">{reader.selection.quote}</blockquote>
              ) : null}
            </div>
          </aside>
        ) : null}

        <div className="reader-book-area">
          {reader.phase === 'loading' ? (
            <p className="state-line reader-state" role="status">
              Opening {title}…
            </p>
          ) : null}

          {reader.phase === 'error' ? (
            <div className="state-panel reader-state" role="alert">
              <h2>This book did not open</h2>
              <p>{reader.error}</p>
              <button type="button" className="button button-primary" onClick={onExit}>
                Back to library
              </button>
            </div>
          ) : null}

          <button
            type="button"
            className="page-step page-previous"
            aria-label="Previous page"
            onClick={() => void reader.navigate({ kind: 'relative', direction: 'previous' })}
          >
            <ChevronLeft size={20} aria-hidden="true" />
          </button>

          <ReaderHost
            className="reader-surface"
            onReady={reader.attach}
            options={{
              onLocationChange: reader.onLocationChange,
              onSelectionChange: reader.onSelectionChange,
              onSectionError: reader.onSectionError,
            }}
          />

          <button
            type="button"
            className="page-step page-next"
            aria-label="Next page"
            onClick={() => void reader.navigate({ kind: 'relative', direction: 'next' })}
          >
            <ChevronRight size={20} aria-hidden="true" />
          </button>

          {reader.selection ? (
            <div className="selection-action" role="status">
              <button type="button" className="button button-quiet" onClick={() => setPanel('study')}>
                <LayoutPanelLeft size={16} aria-hidden="true" />
                Study this
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {reader.sectionError ? (
        <p className="reader-section-error" role="alert">
          {reader.sectionError}
          <button
            type="button"
            className="button button-text"
            onClick={() =>
              void reader.navigate({
                kind: 'section',
                sectionIndex: reader.location?.sectionIndex ?? 0,
              })
            }
          >
            <RotateCw size={14} aria-hidden="true" />
            Try again
          </button>
        </p>
      ) : null}

      <footer className="reader-footer">
        <span>{percent === undefined ? '—' : `${percent}%`}</span>
        {reader.location?.chapterLabel ? (
          <span className="reader-footer-chapter">{reader.location.chapterLabel}</span>
        ) : null}
      </footer>
    </div>
  )
}
