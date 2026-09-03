import { useEffect, useRef, type ReactNode } from 'react'
import { CornerUpLeft, Link, RefreshCw, Sparkles, Trash2, Undo2 } from 'lucide-react'
import type { StudyItem, StudyItemPayload } from '../domain/index.ts'
import { compileTex } from '../remaster/tex.ts'

export interface StudyItemCardProps {
  readonly item: StudyItem
  readonly onGoToSource: (item: StudyItem) => void
  readonly onDelete: (item: StudyItem) => void
  readonly onUndo: (item: StudyItem) => void
  readonly onRetrySource: (item: StudyItem) => void
  readonly onRelinkSource: (item: StudyItem) => void
  readonly canRelinkSource: boolean
  /** A multi-block action shows its shared provenance once, on the first block. */
  readonly showSharedContext?: boolean
}

function RenderedEquation({ expression }: { readonly expression: string }) {
  const host = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const element = host.current
    if (!element) return
    element.replaceChildren()
    try {
      const compiled = compileTex(expression, { document: element.ownerDocument, display: true })
      element.appendChild(compiled.element)
      element.setAttribute('aria-label', compiled.text)
      element.dataset.fallback = 'false'
    } catch {
      const fallback = element.ownerDocument.createElement('code')
      fallback.textContent = expression
      element.appendChild(fallback)
      element.setAttribute('aria-label', `Equation: ${expression}`)
      element.dataset.fallback = 'true'
    }
  }, [expression])
  return <div ref={host} className="block-equation-rendered" />
}

function InlineStudyMath({ expression }: { readonly expression: string }) {
  const host = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const element = host.current
    if (!element) return
    element.replaceChildren()
    try {
      const compiled = compileTex(expression, { document: element.ownerDocument, display: false })
      element.appendChild(compiled.element)
      element.setAttribute('aria-label', compiled.text)
      element.dataset.fallback = 'false'
    } catch {
      element.textContent = expression
      element.dataset.fallback = 'true'
    }
  }, [expression])
  return <span ref={host} className="study-inline-math" />
}

/** Render bounded TeX delimiters without interpreting any other Study markup. */
export function StudyText({ text }: { readonly text: string }) {
  const parts: ReactNode[] = []
  const delimiters = /\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]/g
  let cursor = 0
  for (const match of text.matchAll(delimiters)) {
    const index = match.index
    if (index > cursor) parts.push(text.slice(cursor, index))
    parts.push(<InlineStudyMath key={`${index}-${match[0]}`} expression={match[0]} />)
    cursor = index + match[0].length
  }
  if (cursor < text.length) parts.push(text.slice(cursor))
  return <>{parts}</>
}

export function StudyPayloadBody({
  payload,
  blockId,
}: {
  readonly payload: StudyItemPayload
  readonly blockId: string
}) {
  switch (payload.kind) {
    case 'prose':
      return <p className="block-prose"><StudyText text={payload.text} /></p>
    case 'quotation':
      return (
        <figure className="block-quotation">
          <blockquote><StudyText text={payload.text} /></blockquote>
          {payload.attribution ? <figcaption>{payload.attribution}</figcaption> : null}
        </figure>
      )
    case 'equation':
      return (
        <figure className="block-equation">
          <RenderedEquation expression={payload.expression} />
          {payload.caption ? <figcaption>{payload.caption}</figcaption> : null}
        </figure>
      )
    case 'steps':
      return (
        <div className="block-steps">
          {payload.title ? <p className="block-steps-title">{payload.title}</p> : null}
          <ol>
            {payload.steps.map((step, index) => (
              <li key={`${blockId}-step-${index}`}><StudyText text={step} /></li>
            ))}
          </ol>
        </div>
      )
    case 'question':
      return (
        <div className="block-question">
          <p className="block-question-prompt"><StudyText text={payload.prompt} /></p>
          {payload.answer ? (
            <details>
              <summary>Show answer</summary>
              <p><StudyText text={payload.answer} /></p>
            </details>
          ) : null}
        </div>
      )
  }
}

export function StudyItemCard({
  item,
  onGoToSource,
  onDelete,
  onUndo,
  onRetrySource,
  onRelinkSource,
  canRelinkSource,
  showSharedContext = true,
}: StudyItemCardProps) {
  const byAgent = item.origin === 'agent'
  return (
    <li className="study-item" data-kind={item.payload.kind} data-origin={item.origin}>
      <div className="study-item-head">
        {byAgent && showSharedContext ? (
          // Agent work is marked, always. A block a person did not write should
          // never be able to pass for one they did.
          <span className="study-item-origin">
            <Sparkles size={12} aria-hidden="true" />
            Added by an agent
            {item.revision > 1 ? ` · revised ${item.revision - 1}×` : ''}
          </span>
        ) : null}
        <span className="study-item-tools">
          <button
            type="button"
            className="button button-icon"
            aria-label={
              item.revision > 1
                ? 'Undo the last change to this item'
                : 'Undo adding this item'
            }
            title={
              item.revision > 1
                ? 'Put this block back the way it was before the last change.'
                : 'Remove this block, undoing the action that added it.'
            }
            onClick={() => onUndo(item)}
          >
            <Undo2 size={14} aria-hidden="true" />
          </button>
          {item.sourceRange && showSharedContext ? (
            <button
              type="button"
              className="button button-text"
              onClick={() => onGoToSource(item)}
            >
              <CornerUpLeft size={14} aria-hidden="true" />
              <span className="source-label" title={item.sourceLabel}>
                {item.sourceLabel ?? 'Go to source'}
              </span>
            </button>
          ) : null}
          <button
            type="button"
            className="button button-icon"
            aria-label="Delete this item"
            title="Remove this block from the board for good."
            onClick={() => onDelete(item)}
          >
            <Trash2 size={14} aria-hidden="true" />
          </button>
        </span>
      </div>
      {item.source?.status === 'stale' ? (
        <div className="control-note" role="status">
          This source no longer resolves. The saved text has been kept.
          <button type="button" className="button button-text" onClick={() => onRetrySource(item)}>
            <RefreshCw size={14} aria-hidden="true" /> Retry
          </button>
          <button
            type="button"
            className="button button-text"
            disabled={!canRelinkSource}
            title={canRelinkSource ? 'Use the current book selection as the new source.' : 'Select a replacement passage in the book first.'}
            onClick={() => onRelinkSource(item)}
          >
            <Link size={14} aria-hidden="true" /> Relink
          </button>
        </div>
      ) : null}
      <StudyPayloadBody payload={item.payload} blockId={item.id} />
    </li>
  )
}
