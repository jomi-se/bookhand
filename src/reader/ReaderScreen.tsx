import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Highlighter, LayoutPanelLeft, List, RotateCw, Type } from 'lucide-react'

import type { BookCatalogEntry, BookRange, StudyItemPayload } from '../domain/index.ts'
import { StudyBoardPanel } from '../study/StudyBoardPanel.tsx'
import { useStudy } from '../study/useStudy.ts'
import { AgentActivity } from '../webmcp/AgentActivity.tsx'
import type { useWebMcpTools } from '../webmcp/useWebMcpTools.ts'
import type { BookhandCommands } from '../app/commands.ts'
import { splitTitle } from '../library/progress.ts'
import type { DesignStateStore } from '../app/design-state.ts'
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
  /** Lets the composition root offer this book's tools to an agent. */
  readonly onCommandsReady: (commands: BookhandCommands | undefined) => void
  /** Published for `get_design_context`; nothing renders from it. */
  readonly designState: DesignStateStore
  readonly agent: ReturnType<typeof useWebMcpTools>
}

export function ReaderScreen({
  entry,
  client,
  ports,
  bridge,
  onExit,
  onCommandsReady,
  designState,
  agent,
}: ReaderScreenProps) {
  const reader = useReader({ entry, client, ports, bridge })
  const study = useStudy({ entry, client, bridge })
  const [panel, setPanel] = useState<ReaderPanel>(null)
  const panelInvoker = useRef<HTMLElement | null>(null)

  useEffect(() => {
    onCommandsReady(study.commands)
    return () => onCommandsReady(undefined)
  }, [onCommandsReady, study.commands])
  const { title } = splitTitle(entry.metadata)
  const expanded = study.board?.view === 'expanded' && panel === 'study'

  // What an agent asking for design context should be told is on screen. This
  // writes to a plain store rather than lifting state, so a style change does
  // not re-register the tool set.
  useEffect(() => {
    designState.set({
      surface: panel === 'study' ? 'study' : 'reader',
      ...(study.board?.view ? { boardView: study.board.view } : {}),
    })
    return () => designState.clear()
  }, [designState, panel, study.board?.view])

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
    const commands = study.commands
    study.run('highlight that passage', () =>
      commands.saveAnnotation({
        bookId: commands.bookId,
        range: selection.range,
        quote: selection.quote,
      }),
    )
  }, [reader.selection, study])

  const addStudyItem = useCallback(
    (payload: StudyItemPayload, withSource: boolean) => {
      if (!study.commands) return
      const commands = study.commands
      const selection = withSource ? reader.selection : null
      study.run('add that block', () =>
        commands.upsertStudyItem({
          payload,
          ...(selection
            ? {
                bookId: commands.bookId,
                sourceRange: selection.range,
                sourceQuote: selection.quote,
              }
            : {}),
          ...(selection && reader.location?.chapterLabel
            ? { sourceLabel: reader.location.chapterLabel }
            : {}),
        }),
      )
    },
    [reader.location, reader.selection, study],
  )

  const closePanel = useCallback(() => {
    setPanel(null)
    const invoker = panelInvoker.current
    panelInvoker.current = null
    window.requestAnimationFrame(() => invoker?.focus())
  }, [])

  const toggle = useCallback((next: Exclude<ReaderPanel, null>) => {
    setPanel((current) => {
      if (current === next) {
        const invoker = panelInvoker.current
        panelInvoker.current = null
        window.requestAnimationFrame(() => invoker?.focus())
        return null
      }
      panelInvoker.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null
      return next
    })
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && panel) {
        event.preventDefault()
        closePanel()
        return
      }
      if (event.target instanceof HTMLElement) {
        if (
          event.target.closest(
            'button, a, input, textarea, select, summary, [contenteditable="true"]',
          )
        )
          return
      }
      if (event.key === 'ArrowRight') void reader.navigate({ kind: 'relative', direction: 'next' })
      if (event.key === 'ArrowLeft') void reader.navigate({ kind: 'relative', direction: 'previous' })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closePanel, panel, reader])

  const percent =
    reader.location === undefined ? undefined : Math.round(reader.location.fraction * 100)

  return (
    <div
      className="reader"
      data-panel={panel ?? 'none'}
      data-board={expanded ? 'expanded' : 'docked'}
      data-reader-theme={reader.style.theme === 'publisher' ? 'light' : reader.style.theme}
    >
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
            aria-label="Contents"
            aria-pressed={panel === 'contents'}
            aria-expanded={panel === 'contents'}
            aria-controls="reader-contents-panel"
            onClick={() => toggle('contents')}
          >
            <List size={16} aria-hidden="true" />
            <span className="tool-label">Contents</span>
          </button>
          <button
            type="button"
            className="button button-quiet"
            aria-label="Study"
            aria-pressed={panel === 'study'}
            aria-expanded={panel === 'study'}
            aria-controls="reader-study-panel"
            onClick={() => toggle('study')}
          >
            <LayoutPanelLeft size={16} aria-hidden="true" />
            <span className="tool-label">Study</span>
          </button>
          <button
            type="button"
            className="button button-quiet"
            aria-label="Text settings"
            aria-pressed={panel === 'text'}
            aria-expanded={panel === 'text'}
            aria-controls="reader-text-panel"
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
            onClose={closePanel}
          />
        ) : null}

        {panel === 'text' ? (
          <TextPanel
            style={reader.style}
            onChange={reader.applyStyle}
            onReset={reader.resetStyle}
            onClose={closePanel}
          />
        ) : null}

        {panel === 'study' ? (
          <StudyBoardPanel
            board={study.board}
            items={study.items}
            annotations={study.annotations}
            selectionQuote={reader.selection?.quote}
            onAddItem={addStudyItem}
            onDeleteItem={(item) =>
              study.commands &&
              study.run('delete that block', () => study.commands!.deleteStudyItem(item.id))
            }
            onUndoItem={(item) =>
              study.commands &&
              study.run('undo that change', () =>
                study.commands!.undoStudyItem(item.id, item.revision),
              )
            }
            mutationError={study.mutationError}
            onDismissMutationError={study.dismissMutationError}
            onGoToSource={goToSource}
            onDeleteAnnotation={(annotation) =>
              void study.commands?.deleteAnnotation(annotation.id)
            }
            onEditNote={(annotation, note) =>
              void study.commands?.saveAnnotation({
                bookId: study.commands.bookId,
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
            onClose={closePanel}
            agentActivity={
              <AgentActivity
                status={agent.status}
                calls={agent.calls}
                toolNames={agent.toolNames}
                onClear={agent.clearHistory}
              />
            }
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
