import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Highlighter, LayoutPanelLeft, List, RotateCw, Search, Type } from 'lucide-react'

import type { BookCatalogEntry, BookRange, StudyItemPayload } from '../domain/index.ts'
import { StudyBoardPanel } from '../study/StudyBoardPanel.tsx'
import { useStudy } from '../study/useStudy.ts'
import { AgentActivity } from '../webmcp/AgentActivity.tsx'
import type { useWebMcpTools } from '../webmcp/useWebMcpTools.ts'
import type { BookhandCommands } from '../app/commands.ts'
import { splitTitle } from '../library/progress.ts'
import type { DesignStateStore } from '../app/design-state.ts'
import type { PresentationStore } from '../app/presentation.ts'
import type { ReaderPanel, SurfaceStore } from '../app/surface.ts'
import type { ReaderPortBridge } from '../app/reader-bridge.ts'
import type { GuidanceController, GuidanceSurfaceSnapshot } from '../app/guidance.ts'
import type { RuntimePorts } from '../runtime/ports.ts'
import type { StorageClient } from '../storage/client.ts'
import { ContentsPanel } from './ContentsPanel.tsx'
import { SearchPanel } from './SearchPanel.tsx'
import { ReaderHost } from './ReaderHost.tsx'
import { TextPanel } from './TextPanel.tsx'
import { DEFAULT_READER_STYLE } from './FoliateReaderAdapter.ts'
import { useReader } from './useReader.ts'
import { useReaderChrome } from './useReaderChrome.ts'
import { useBookIndex } from './useBookIndex.ts'
import { GuidanceIndicator } from './GuidanceIndicator.tsx'
import { prepareReaderOptionsForBrowser } from '../runtime/test-control-bridge.ts'

export type { ReaderPanel }

/**
 * The touch-first layout, where a panel replaces the book rather than sitting
 * beside it — so navigating from a panel has to close it. Kept in step with
 * the same condition in `reader.css`.
 */
function isCompactSurface(): boolean {
  return window.matchMedia('(max-width: 860px), (pointer: coarse)').matches
}

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
  /** The one owner of the reading presentation, shared with the tool layer. */
  readonly presentation: PresentationStore
  /** Which panel is open. Shared, so a tool can open, focus, and close it. */
  readonly surface: SurfaceStore
  readonly guidance: GuidanceController
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
  presentation,
  surface,
  guidance,
  agent,
}: ReaderScreenProps) {
  // Panel visibility is shared state, not local state: a tool can open, focus,
  // and close the study board, and the person can do the same, and neither may
  // act on a copy the other has already moved past. `VAL-BOARD-VIEW-PARITY`.
  const bookHost = useRef<HTMLDivElement>(null)
  const panelInvoker = useRef<HTMLElement | null>(null)
  const [surfaceState, setSurfaceState] = useState(surface.state)
  useEffect(() => surface.subscribe(setSurfaceState), [surface])
  const study = useStudy({ entry, client, bridge, presentation, surface, guidance })
  const studyRef = useRef(study)
  useEffect(() => { studyRef.current = study }, [study])

  const captureGuidanceSurface = useCallback((): GuidanceSurfaceSnapshot => ({
    panel: surface.state.panel,
    ...(studyRef.current.board ? { boardView: studyRef.current.board.view } : {}),
    ...(document.activeElement instanceof HTMLElement
      ? { focusTarget: document.activeElement }
      : {}),
  }), [surface])
  const restoreGuidanceSurface = useCallback(async (
    snapshot: GuidanceSurfaceSnapshot,
    isCurrent: () => boolean,
  ) => {
    const panelAtRestore = surface.state.panel
    if (
      snapshot.boardView &&
      studyRef.current.commands &&
      studyRef.current.board?.view !== snapshot.boardView
    ) {
      const restored = await studyRef.current.commands.restoreStudyBoardView(
        snapshot.boardView,
        isCurrent,
      )
      if (!restored || !isCurrent() || surface.state.panel !== panelAtRestore) return
    }
    if (!isCurrent()) return
    surface.setPanel(snapshot.panel as ReaderPanel)
    window.requestAnimationFrame(() => {
      if (!isCurrent() || surface.state.panel !== snapshot.panel) return
      if (snapshot.focusTarget?.isConnected) snapshot.focusTarget.focus()
      else bookHost.current?.focus({ preventScroll: true })
    })
  }, [surface])

  const reader = useReader({
    entry,
    client,
    ports,
    bridge,
    presentation,
    guidance,
    captureGuidanceSurface,
    revealReadingSurface: () => surface.setPanel(null),
    restoreGuidanceSurface,
  })
  const bookIndex = useBookIndex({ bookId: entry.id, phase: reader.phase, client, bridge })

  // Both stores outlive any one book, and this screen is keyed by book, so
  // this runs exactly once per book opened. Without it a second book inherits
  // the first one's style and its board's Undo.
  useEffect(() => {
    presentation.beginBook(DEFAULT_READER_STYLE)
    surface.reset()
  }, [presentation, surface])
  const panel = surfaceState.panel
  const setPanel = useCallback((next: ReaderPanel) => surface.setPanel(next), [surface])
  const chrome = useReaderChrome({ panelOpen: panel !== null })

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

  // Keyed on the section, not on the location. `renderAnnotations` deletes and
  // re-adds every mark, so keying it on location tore down and redrew all
  // stored highlights on every page turn and every panel toggle.
  const sectionIndex = reader.location?.sectionIndex
  useEffect(() => {
    bridge.adapter?.renderAnnotations(study.marks)
  }, [bridge, sectionIndex, study.marks])

  const goToSource = useCallback(
    (range: BookRange) => {
      if (!range.cfi) return
      void reader.navigate({ kind: 'cfi', cfi: range.cfi })
      if (isCompactSurface()) setPanel(null)
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

  /**
   * A tap in the book. The outer quarters turn a page; the middle half brings
   * the chrome back or sends it away, which is the only way to reach the
   * toolbar once it has receded.
   */
  const onBookTap = useCallback(
    (zone: 'previous' | 'next' | 'center') => {
      if (zone === 'center') {
        chrome.toggle()
        return
      }
      // Focus follows the turn to the book host, so a person navigating by
      // keyboard is left where the reading is rather than on a hidden control.
      bookHost.current?.focus({ preventScroll: true })
      void reader.navigate({ kind: 'relative', direction: zone === 'next' ? 'next' : 'previous' })
      chrome.notePageTurn()
    },
    [chrome, reader],
  )

  const closePanel = useCallback(() => {
    surface.setPanel(null)
    const invoker = panelInvoker.current
    panelInvoker.current = null
    window.requestAnimationFrame(() => invoker?.focus())
  }, [surface])

  const toggle = useCallback(
    (next: Exclude<ReaderPanel, null>) => {
      if (surface.state.panel === next) {
        closePanel()
        return
      }
      panelInvoker.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null
      surface.setPanel(next)
    },
    [closePanel, surface],
  )

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
      // A panel has replaced the book on this surface. Arrow keys inside it
      // must not page a book nobody can see.
      if (panel) return
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
      data-chrome={chrome.visible ? 'shown' : 'hidden'}
    >
      <header className="reader-chrome">
        <button type="button" className="button button-quiet button-back" onClick={() => { bookIndex.cancel(); onExit() }}>
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
            aria-label="Search"
            aria-pressed={panel === 'search'}
            aria-expanded={panel === 'search'}
            aria-controls="reader-search-panel"
            onClick={() => toggle('search')}
          >
            <Search size={16} aria-hidden="true" />
            <span className="tool-label">Search</span>
          </button>
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

      <GuidanceIndicator controller={guidance} />

      <div className="reader-stage">
        {panel === 'contents' ? (
          <ContentsPanel
            toc={reader.toc}
            currentSectionIndex={reader.location?.sectionIndex}
            onNavigate={(target) => {
              void reader.navigate(target)
              if (isCompactSurface()) setPanel(null)
            }}
            onClose={closePanel}
          />
        ) : null}

        {panel === 'text' ? (
          <TextPanel
            presentation={reader.presentation}
            onPreview={(patch) => presentation.preview(patch)}
            onCancelPreview={() => presentation.cancelPreview()}
            onApply={(patch) =>
              study.commands &&
              study.run('change the text settings', () =>
                study.commands!.setReadingStyle({ patch }),
              )
            }
            onReset={() =>
              study.commands &&
              study.run('reset the text settings', () => study.commands!.resetReadingStyle())
            }
            onUndo={() =>
              study.commands &&
              study.run('undo that text change', () => study.commands!.undoReadingStyle())
            }
            onClose={closePanel}
          />
        ) : null}

        {panel === 'search' ? (
          <SearchPanel
            indexState={bookIndex.state}
            indexLoaded={bookIndex.loaded}
            indexing={bookIndex.running}
            onRetryIndex={() => { void bookIndex.retry() }}
            onCancelIndex={bookIndex.cancel}
            onSearch={(query, limit) => client.searchBook(entry.id, query, limit)}
            onActivate={(hit) => {
              void reader.navigate({ kind: 'cfi', cfi: hit.startCfi })
              if (isCompactSurface()) setPanel(null)
            }}
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
            onRetryItemSource={(item) =>
              study.commands &&
              study.run('retry that source', () =>
                study.commands!.retryStudyItemSource(item.id),
              )
            }
            onRelinkItemSource={(item) => {
              const selection = reader.selection
              if (!study.commands || !selection) return
              study.run('relink that source', () =>
                study.commands!.upsertStudyItem({
                  id: item.id,
                  payload: item.payload,
                  bookId: study.commands!.bookId,
                  sourceRange: selection.range,
                  sourceQuote: selection.quote,
                  sourceOwnership: item.source?.ownership ?? 'authored',
                  ...(reader.location?.chapterLabel
                    ? { sourceLabel: reader.location.chapterLabel }
                    : {}),
                }),
              )
            }}
            onRetryAnnotationSource={(annotation) =>
              study.commands &&
              study.run('retry that highlight source', () =>
                study.commands!.retryAnnotationSource(annotation.id),
              )
            }
            onRelinkAnnotationSource={(annotation) => {
              const selection = reader.selection
              if (!study.commands || !selection) return
              study.run('relink that highlight', () =>
                study.commands!.saveAnnotation({
                  id: annotation.id,
                  bookId: study.commands!.bookId,
                  range: selection.range,
                  quote: selection.quote,
                  color: annotation.color,
                  ...(annotation.note ? { note: annotation.note } : {}),
                }),
              )
            }}
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
            focusNonce={surfaceState.focusNonce}
            agentChangedView={surfaceState.boardReversal?.origin === 'agent'}
            onUndoView={() =>
              study.commands &&
              study.run('undo that layout change', () => study.commands!.undoStudyBoardView())
            }
            onToggleView={() =>
              study.commands &&
              study.run('change the board layout', () => study.commands!.toggleStudyBoardView())
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
            onClick={() => {
              void reader.navigate({ kind: 'relative', direction: 'previous' })
              // The person is using a control, so the chrome stays and the
              // countdown restarts; focus is left on the button they pressed.
              chrome.show()
            }}
          >
            <ChevronLeft size={20} aria-hidden="true" />
          </button>

          <ReaderHost
            hostRef={bookHost}
            className="reader-surface"
            onReady={reader.attach}
            onDispose={reader.detach}
            options={prepareReaderOptionsForBrowser({
              onLocationChange: reader.onLocationChange,
              onNavigationIntent: reader.onNavigationIntent,
              onNavigationRequest: reader.onNavigationRequest,
              onSelectionChange: reader.onSelectionChange,
              onSectionError: reader.onSectionError,
              onTap: onBookTap,
            })}
          />

          <button
            type="button"
            className="page-step page-next"
            aria-label="Next page"
            onClick={() => {
              void reader.navigate({ kind: 'relative', direction: 'next' })
              chrome.show()
            }}
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
