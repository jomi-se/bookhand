import { useEffect, useRef, useState } from 'react'
import { Maximize2, Minimize2, Plus, Trash2 } from 'lucide-react'

import type {
  Annotation,
  BookRange,
  StudyBoard,
  StudyItem,
  StudyItemKind,
  StudyItemPayload,
} from '../domain/index.ts'
import { STUDY_ITEM_KINDS } from '../domain/study.ts'
import { StudyItemCard } from './StudyItemCard.tsx'

export interface StudyBoardPanelProps {
  readonly board?: StudyBoard
  readonly items: readonly StudyItem[]
  readonly annotations: readonly Annotation[]
  readonly selectionQuote?: string
  readonly onAddItem: (payload: StudyItemPayload, withSource: boolean) => void
  readonly onDeleteItem: (item: StudyItem) => void
  readonly onUndoItem: (item: StudyItem) => void
  readonly onRetryItemSource: (item: StudyItem) => void
  readonly onRelinkItemSource: (item: StudyItem) => void
  readonly onRetryAnnotationSource: (annotation: Annotation) => void
  readonly onRelinkAnnotationSource: (annotation: Annotation) => void
  readonly mutationError?: { readonly message: string; readonly retry: () => void }
  readonly onDismissMutationError?: () => void
  readonly loadError?: string
  readonly onRetryLoad?: () => void
  readonly onGoToSource: (range: BookRange) => void
  readonly onDeleteAnnotation: (annotation: Annotation) => void
  readonly onEditNote: (annotation: Annotation, note: string) => void
  readonly onToggleView: () => void
  /** Raised when something asks the board to take focus; see `SurfaceStore`. */
  readonly focusNonce?: number
  readonly agentChangedView?: boolean
  readonly onUndoView?: () => void
  readonly onClose: () => void
}

function NoteEditor({
  annotation,
  onSave,
}: {
  readonly annotation: Annotation
  readonly onSave: (note: string) => void
}) {
  const [note, setNote] = useState(annotation.note ?? '')
  const dirty = note !== (annotation.note ?? '')
  return (
    <div className="highlight-note">
      <textarea
        rows={2}
        value={note}
        placeholder="Add a note"
        aria-label={`Note for “${annotation.quote.slice(0, 40)}”`}
        onChange={(event) => setNote(event.target.value)}
      />
      {dirty ? (
        <button type="button" className="button button-quiet" onClick={() => onSave(note)}>
          Save note
        </button>
      ) : null}
    </div>
  )
}

export function StudyBoardPanel(props: StudyBoardPanelProps) {
  const { board, items, annotations, selectionQuote } = props
  const [composing, setComposing] = useState<StudyItemKind>()
  const [draft, setDraft] = useState('')
  const expanded = board?.view === 'expanded'
  const heading = useRef<HTMLHeadingElement>(null)
  const groupedItems = items.reduce<Array<{ key: string; items: StudyItem[] }>>((groups, item) => {
    const actionKey = item.actionGroupId ? `action:${item.actionGroupId}` : `item:${item.id}`
    const previous = groups.at(-1)
    if (item.actionGroupId && previous?.key === actionKey) previous.items.push(item)
    else groups.push({ key: actionKey, items: [item] })
    return groups
  }, [])

  const sharedContextKey = (item: StudyItem) => JSON.stringify({
    origin: item.origin,
    sourceLabel: item.sourceLabel,
    sourceRange: item.sourceRange,
  })
  // Focus lands on the heading when the board opens, and again whenever
  // something asks for it — an agent using `focus` to say "look at this".
  useEffect(() => heading.current?.focus(), [props.focusNonce])

  return (
    <aside id="reader-study-panel" className="reader-panel study-panel" aria-label="Study">
      <header className="panel-head">
        <h2 ref={heading} tabIndex={-1}>{board?.title ?? 'Study'}</h2>
        <span className="panel-head-tools">
          <button
            type="button"
            className="button button-icon"
            onClick={props.onToggleView}
            aria-label={expanded ? 'Dock the study board' : 'Expand the study board'}
            aria-pressed={expanded}
          >
            {expanded ? <Minimize2 size={16} aria-hidden="true" /> : <Maximize2 size={16} aria-hidden="true" />}
          </button>
          <button type="button" className="button button-icon" onClick={props.onClose} aria-label="Close study">
            ✕
          </button>
        </span>
      </header>

      <div className="panel-body">
        {props.agentChangedView && props.onUndoView ? (
          <p className="control-note control-agent" role="status">
            An agent changed this board’s layout.
            <button type="button" className="button button-text" onClick={props.onUndoView}>
              Undo
            </button>
          </p>
        ) : null}
        {props.loadError ? (
          <div className="study-mutation-error" role="alert">
            <p>Study is temporarily unavailable. {props.loadError}</p>
            {props.onRetryLoad ? (
              <span className="study-mutation-error-tools">
                <button type="button" className="button" onClick={props.onRetryLoad}>
                  Try again
                </button>
              </span>
            ) : null}
          </div>
        ) : null}

        <div className="add-row">
          {STUDY_ITEM_KINDS.map((kind) => (
            <button
              key={kind}
              type="button"
              className="button button-quiet"
              aria-pressed={composing === kind}
              onClick={() => {
                setComposing((current) => (current === kind ? undefined : kind))
                setDraft(kind === 'quotation' ? (selectionQuote ?? '') : '')
              }}
            >
              <Plus size={14} aria-hidden="true" />
              {kind}
            </button>
          ))}
        </div>

        {composing ? (
          <div className="composer">
            <label htmlFor="study-draft">
              New {composing}
              {selectionQuote ? ' — will link to the selected passage' : ''}
            </label>
            <textarea
              id="study-draft"
              rows={composing === 'steps' ? 4 : 3}
              value={draft}
              placeholder={
                composing === 'steps'
                  ? 'One step per line'
                  : composing === 'equation'
                    ? 'dy/dx = y / (x - a)'
                    : composing === 'question'
                      ? 'What does the slope at a point mean?'
                      : 'Write something worth keeping'
              }
              onChange={(event) => setDraft(event.target.value)}
            />
            <div className="control-actions">
              <button
                type="button"
                className="button button-primary"
                disabled={draft.trim().length === 0}
                onClick={() => {
                  const payload =
                    composing === 'steps'
                      ? {
                          kind: 'steps' as const,
                          steps: draft.split('\n').map((line) => line.trim()).filter(Boolean),
                        }
                      : composing === 'quotation'
                        ? { kind: 'quotation' as const, text: draft.trim() }
                        : composing === 'equation'
                          ? { kind: 'equation' as const, expression: draft.trim() }
                          : composing === 'question'
                            ? { kind: 'question' as const, prompt: draft.trim() }
                            : { kind: 'prose' as const, text: draft.trim() }
                  props.onAddItem(payload, Boolean(selectionQuote))
                  setDraft('')
                  setComposing(undefined)
                }}
              >
                Add to board
              </button>
              <button
                type="button"
                className="button button-text"
                onClick={() => {
                  setComposing(undefined)
                  setDraft('')
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        {props.mutationError ? (
          // Bounded: it says what happened, offers the one useful next move,
          // and does not pretend the board changed.
          <div className="study-mutation-error" role="alert">
            <p>{props.mutationError.message}</p>
            <span className="study-mutation-error-tools">
              <button type="button" className="button" onClick={props.mutationError.retry}>
                Try again
              </button>
              <button
                type="button"
                className="button button-text"
                onClick={props.onDismissMutationError}
              >
                Dismiss
              </button>
            </span>
          </div>
        ) : null}

        {items.length === 0 ? (
          <p className="panel-empty">
            Nothing on this board yet. Select a passage in the book and keep it here, or add a
            block above. Everything stays on this device.
          </p>
        ) : (
          <ul className="study-items">
            {groupedItems.map((group) => (
              <li
                key={group.key}
                className="study-item-group"
                data-composed={group.items.length > 1 ? 'true' : undefined}
              >
                <ul aria-label={group.items.length > 1 ? 'Blocks added together' : undefined}>
                  {group.items.map((item, index) => (
                    <StudyItemCard
                      key={item.id}
                      item={item}
                      showSharedContext={
                        index === 0 ||
                        sharedContextKey(item) !== sharedContextKey(group.items[index - 1]!)
                      }
                      onGoToSource={(target) => target.sourceRange && props.onGoToSource(target.sourceRange)}
                      onDelete={props.onDeleteItem}
                      onUndo={props.onUndoItem}
                      onRetrySource={props.onRetryItemSource}
                      onRelinkSource={props.onRelinkItemSource}
                      canRelinkSource={Boolean(selectionQuote)}
                    />
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}

        {annotations.length > 0 ? (
          <section className="highlights">
            <h3 className="section-heading">Highlights</h3>
            <ul className="highlight-list">
              {annotations.map((annotation) => (
                <li key={annotation.id} className="highlight" data-color={annotation.color}>
                  {annotation.source?.status === 'stale' ? (
                    <p className="control-note" role="status">
                      Saved source is stale; the original highlight text is preserved.
                      <button
                        type="button"
                        className="button button-text"
                        onClick={() => props.onRetryAnnotationSource(annotation)}
                      >
                        Retry resolution
                      </button>
                      <button
                        type="button"
                        className="button button-text"
                        disabled={!selectionQuote}
                        title={selectionQuote ? 'Use the current book selection as the new source.' : 'Select a replacement passage in the book first.'}
                        onClick={() => props.onRelinkAnnotationSource(annotation)}
                      >
                        Relink
                      </button>
                    </p>
                  ) : null}
                  <button
                    type="button"
                    className="highlight-quote"
                    onClick={() => props.onGoToSource(annotation.range)}
                  >
                    {annotation.quote}
                  </button>
                  <NoteEditor
                    annotation={annotation}
                    onSave={(note) => props.onEditNote(annotation, note)}
                  />
                  <button
                    type="button"
                    className="button button-icon"
                    aria-label="Delete this highlight"
                    onClick={() => props.onDeleteAnnotation(annotation)}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </aside>
  )
}
