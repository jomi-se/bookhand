import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Highlighter, LayoutPanelLeft, List, RotateCw, Type } from 'lucide-react'

import type { BookCatalogEntry, BookRange, StudyItemPayload } from '../domain/index.ts'
import { StudyBoardPanel } from '../study/StudyBoardPanel.tsx'
import { useStudy } from '../study/useStudy.ts'
import { splitTitle } from '../library/progress.ts'
import type { ReaderPortBridge } from '../app/reader-bridge.ts'
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
  const study = useStudy({ entry, client, bridge })
  const [panel, setPanel] = useState<ReaderPanel>(null)
  const { title } = splitTitle(entry.metadata)
  const expanded = study.board?.view === 'expanded' && panel === 'study'

  // Stored highlights are drawn whenever the set changes or a section renders.
  useEffect(() => {
    bridge.adapter?.renderAnnotations(study.marks)
  }, [bridge, reader.location, study.marks])

  const goToSource = useCallback(
    (range: BookRange) => {
      if (!range.cfi) return
      void reader.navigate({ kind: 'cfi', cfi: range.cfi })
      if (window.matchMedia('(max-width: 860px)').matches) setPanel(null)
    },
    [reader],
  )

  const highlightSelection = useCallback(() => {
    const selection = reader.selection
    if (!selection || !study.commands) return
    void study.commands.saveAnnotation({ range: selection.range, quote: selection.quote })
  }, [reader.selection, study.commands])

  const addStudyItem = useCallback(
    (payload: StudyItemPayload, withSource: boolean) => {
      if (!study.commands) return
      const selection = withSource ? reader.selection : null
      void study.commands.upsertStudyItem({
        payload,
        ...(selection ? { sourceRange: selection.range } : {}),
        ...(selection && reader.location?.chapterLabel
          ? { sourceLabel: reader.location.chapterLabel }
          : {}),
      })
    },
    [reader.location, reader.selection, study.commands],
  )

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
    <div className="reader" data-panel={panel ?? 'none'} data-board={expanded ? 'expanded' : 'docked'}>
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
          <StudyBoardPanel
            board={study.board}
            items={study.items}
            annotations={study.annotations}
            selectionQuote={reader.selection?.quote}
            onAddItem={addStudyItem}
            onDeleteItem={(item) => void study.commands?.deleteStudyItem(item.id)}
            onGoToSource={goToSource}
            onDeleteAnnotation={(annotation) =>
              void study.commands?.deleteAnnotation(annotation.id)
            }
            onEditNote={(annotation, note) =>
              void study.commands?.saveAnnotation({
                id: annotation.id,
                range: annotation.range,
                quote: annotation.quote,
                color: annotation.color,
                note,
              })
            }
            onToggleView={() =>
              void study.commands
                ?.setStudyBoardView(study.board?.view === 'expanded' ? 'docked' : 'expanded')
                .then(study.setBoard)
            }
            onClose={() => setPanel(null)}
          />
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
              <button type="button" className="button button-quiet" onClick={highlightSelection}>
                <Highlighter size={16} aria-hidden="true" />
                Highlight
              </button>
              <button
                type="button"
                className="button button-quiet"
                onClick={() => {
                  addStudyItem({ kind: 'quotation', text: reader.selection!.quote }, true)
                  setPanel('study')
                }}
              >
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
