import { useEffect, useRef, useState } from 'react'
import { BookOpen, CornerUpLeft, Maximize2, Minimize2, Plus, Sparkles, Trash2, X } from 'lucide-react'

import type {
  Annotation,
  BookRange,
  StudyBoard,
  StudyItem,
  StudyItemKind,
  StudyItemPayload,
  StudyExperience,
} from '../domain/index.ts'
import { STUDY_ITEM_KINDS } from '../domain/study.ts'
import { StudyItemCard, StudyPayloadBody, StudyText } from './StudyItemCard.tsx'

const STUDY_ITEM_LABEL: Readonly<Record<StudyItemKind, string>> = {
  prose: 'Note',
  quotation: 'Quotation',
  equation: 'Equation',
  steps: 'Steps',
  question: 'Question',
}

export interface StudyBoardPanelProps {
  readonly board?: StudyBoard
  readonly items: readonly StudyItem[]
  readonly experiences: readonly StudyExperience[]
  readonly annotations: readonly Annotation[]
  readonly selectionQuote?: string
  readonly onAddItem: (payload: StudyItemPayload, withSource: boolean) => void
  readonly onDeleteItem: (item: StudyItem) => void
  readonly onDeleteExperience: (experience: StudyExperience) => void
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

function lessonDomId(experienceId: string): string {
  return `study-experience-${experienceId.length}-${experienceId}`
}

function lessonBlockDomId(experienceId: string, blockId: string): string {
  return `${lessonDomId(experienceId)}-block-${blockId.length}-${blockId}`
}

export function StudyBoardPanel(props: StudyBoardPanelProps) {
  const { board, items, experiences, annotations, selectionQuote } = props
  const [composing, setComposing] = useState<StudyItemKind>()
  const [authoringOpen, setAuthoringOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const expanded = board?.view === 'expanded'
  const heading = useRef<HTMLHeadingElement>(null)
  const body = useRef<HTMLDivElement>(null)
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
  useEffect(() => {
    body.current?.scrollTo?.({ top: 0 })
  }, [expanded, props.focusNonce])

  return (
    <aside id="reader-study-panel" className="reader-panel study-panel" aria-label="Study">
      <header className="panel-head">
        <h2 ref={heading} tabIndex={-1}>{board?.title ?? 'Study'}</h2>
        <span className="panel-head-tools">
          <button
            type="button"
            className="button button-icon study-view-toggle"
            onClick={props.onToggleView}
            aria-label={expanded ? 'Dock the study board' : 'Expand the study board'}
            aria-pressed={expanded}
          >
            {expanded ? <Minimize2 size={16} aria-hidden="true" /> : <Maximize2 size={16} aria-hidden="true" />}
          </button>
          <button type="button" className="button button-icon study-close" onClick={props.onClose} aria-label="Close study and return to the book">
            <X className="study-close-wide" size={16} aria-hidden="true" />
            <CornerUpLeft className="study-close-compact" size={16} aria-hidden="true" />
            <span className="study-close-label">Book</span>
          </button>
        </span>
      </header>

      <div ref={body} className="panel-body">
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

        {items.length === 0 && experiences.length === 0 && annotations.length === 0 ? (
          <p className="panel-empty">
            Nothing on this board yet. Select a passage in the book and keep it here, or begin
            with a note below. Everything stays on this device.
          </p>
        ) : null}

        {experiences.length > 0 ? (
          <section className="study-lessons" aria-label="Lessons">
            {experiences.map((experience) => (
              <article
                id={lessonDomId(experience.id)}
                key={experience.id}
                className="study-lesson"
                tabIndex={-1}
                aria-labelledby={`${lessonDomId(experience.id)}-title`}
              >
                <header className="study-lesson-head">
                  <div>
                    {experience.origin === 'agent' ? (
                      <p className="study-lesson-origin">
                        <Sparkles size={12} aria-hidden="true" /> Created with an agent
                      </p>
                    ) : null}
                    <h3 id={`${lessonDomId(experience.id)}-title`}>{experience.title}</h3>
                  </div>
                  <div className="study-lesson-tools">
                    {experience.sourceRange ? (
                      <button
                        type="button"
                        className="button button-text"
                        onClick={() => props.onGoToSource(experience.sourceRange!)}
                      >
                        <CornerUpLeft size={14} aria-hidden="true" />
                        <span className="source-label">{experience.sourceLabel ?? 'Source'}</span>
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="button button-icon"
                      aria-label={`Remove lesson “${experience.title}”`}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Remove “${experience.title}”? This lesson cannot yet be restored after removal.`,
                          )
                        ) {
                          props.onDeleteExperience(experience)
                        }
                      }}
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </div>
                </header>
                <div className="study-lesson-blocks">
                  {experience.blocks.map((block) => (
                    <section
                      id={lessonBlockDomId(experience.id, block.id)}
                      key={block.id}
                      className="study-lesson-block"
                      data-kind={block.payload.kind}
                    >
                      <StudyPayloadBody payload={block.payload} blockId={block.id} />
                    </section>
                  ))}
                </div>
              </article>
            ))}
          </section>
        ) : null}

        {items.length > 0 ? (
          <section className="study-notes" aria-labelledby="study-notes-heading">
            <h3 id="study-notes-heading" className="section-heading">
              <BookOpen size={14} aria-hidden="true" /> Notes
            </h3>
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
          </section>
        ) : null}

        <section className="study-authoring" aria-label="Add to Study">
          {!authoringOpen ? (
            <button
              type="button"
              className="button button-quiet study-authoring-open"
              onClick={() => {
                const kind = selectionQuote ? 'quotation' : 'prose'
                setAuthoringOpen(true)
                setComposing(kind)
                setDraft(selectionQuote ?? '')
              }}
            >
              <Plus size={14} aria-hidden="true" />
              {selectionQuote ? 'Add selected passage' : 'Add study block'}
            </button>
          ) : (
            <>
              <div className="add-row" role="group" aria-label="Study block type">
                {STUDY_ITEM_KINDS.map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    className="button button-quiet"
                    aria-pressed={composing === kind}
                    onClick={() => {
                      setComposing(kind)
                      setDraft(kind === 'quotation' ? (selectionQuote ?? '') : '')
                    }}
                  >
                    {STUDY_ITEM_LABEL[kind]}
                  </button>
                ))}
              </div>

              {composing ? (
                <div className="composer">
                  <label htmlFor="study-draft">
                    New {STUDY_ITEM_LABEL[composing].toLowerCase()}
                    {selectionQuote ? ' — linked to the selected passage' : ''}
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
                        setAuthoringOpen(false)
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
                        setAuthoringOpen(false)
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </section>

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
                    <StudyText text={annotation.quote} />
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
