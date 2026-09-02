import { useEffect, useRef } from 'react'
import type { BookTarget, TocItem } from '../domain/reader.ts'

export interface ContentsPanelProps {
  readonly toc: readonly TocItem[]
  readonly currentSectionIndex?: number
  readonly onNavigate: (target: BookTarget) => void
  readonly onClose: () => void
}

function TocList({
  items,
  depth,
  onNavigate,
  currentSectionIndex,
}: {
  readonly items: readonly TocItem[]
  readonly depth: number
  readonly onNavigate: (target: BookTarget) => void
  readonly currentSectionIndex?: number
}) {
  return (
    <ul className="toc-list" data-depth={depth}>
      {items.map((item) => {
        const current =
          item.target.kind === 'section' && item.target.sectionIndex === currentSectionIndex
        return (
        <li key={item.id}>
          <button type="button" className="toc-item" aria-current={current ? 'location' : undefined} onClick={() => onNavigate(item.target)}>
            {item.label}
          </button>
          {item.children.length > 0 ? (
            <TocList items={item.children} depth={depth + 1} onNavigate={onNavigate} currentSectionIndex={currentSectionIndex} />
          ) : null}
        </li>
        )
      })}
    </ul>
  )
}

export function ContentsPanel({ toc, currentSectionIndex, onNavigate, onClose }: ContentsPanelProps) {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => heading.current?.focus(), [])
  return (
    <aside id="reader-contents-panel" className="reader-panel" aria-label="Contents">
      <header className="panel-head">
        <h2 ref={heading} tabIndex={-1}>Contents</h2>
        <button type="button" className="button button-icon" onClick={onClose} aria-label="Close contents">
          ✕
        </button>
      </header>
      <div className="panel-body">
        {toc.length === 0 ? (
          <p className="panel-empty">This book has no table of contents.</p>
        ) : (
          <TocList items={toc} depth={0} onNavigate={onNavigate} currentSectionIndex={currentSectionIndex} />
        )}
      </div>
    </aside>
  )
}
