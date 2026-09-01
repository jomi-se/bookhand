import { CornerUpLeft, Trash2 } from 'lucide-react'
import type { StudyItem } from '../domain/index.ts'

export interface StudyItemCardProps {
  readonly item: StudyItem
  readonly onGoToSource: (item: StudyItem) => void
  readonly onDelete: (item: StudyItem) => void
}

function Body({ item }: { readonly item: StudyItem }) {
  const payload = item.payload
  switch (payload.kind) {
    case 'prose':
      return <p className="block-prose">{payload.text}</p>
    case 'quotation':
      return (
        <figure className="block-quotation">
          <blockquote>{payload.text}</blockquote>
          {payload.attribution ? <figcaption>{payload.attribution}</figcaption> : null}
        </figure>
      )
    case 'equation':
      return (
        <figure className="block-equation">
          <pre>{payload.expression}</pre>
          {payload.caption ? <figcaption>{payload.caption}</figcaption> : null}
        </figure>
      )
    case 'steps':
      return (
        <div className="block-steps">
          {payload.title ? <p className="block-steps-title">{payload.title}</p> : null}
          <ol>
            {payload.steps.map((step, index) => (
              <li key={`${item.id}-step-${index}`}>{step}</li>
            ))}
          </ol>
        </div>
      )
    case 'question':
      return (
        <div className="block-question">
          <p className="block-question-prompt">{payload.prompt}</p>
          {payload.answer ? (
            <details>
              <summary>Show answer</summary>
              <p>{payload.answer}</p>
            </details>
          ) : null}
        </div>
      )
  }
}

export function StudyItemCard({ item, onGoToSource, onDelete }: StudyItemCardProps) {
  return (
    <li className="study-item" data-kind={item.payload.kind}>
      <div className="study-item-head">
        <span className="study-item-kind">{item.payload.kind}</span>
        <span className="study-item-tools">
          {item.sourceRange ? (
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
            onClick={() => onDelete(item)}
          >
            <Trash2 size={14} aria-hidden="true" />
          </button>
        </span>
      </div>
      <Body item={item} />
    </li>
  )
}
