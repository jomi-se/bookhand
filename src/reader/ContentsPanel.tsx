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
}: {
  readonly items: readonly TocItem[]
  readonly depth: number
  readonly onNavigate: (target: BookTarget) => void
}) {
  return (
    <ul className="toc-list" data-depth={depth}>
      {items.map((item) => (
        <li key={item.id}>
          <button type="button" className="toc-item" onClick={() => onNavigate(item.target)}>
            {item.label}
          </button>
          {item.children.length > 0 ? (
            <TocList items={item.children} depth={depth + 1} onNavigate={onNavigate} />
          ) : null}
        </li>
      ))}
    </ul>
  )
}

export function ContentsPanel({ toc, onNavigate, onClose }: ContentsPanelProps) {
  return (
    <aside className="reader-panel" aria-label="Contents">
      <header className="panel-head">
        <h2>Contents</h2>
        <button type="button" className="button button-icon" onClick={onClose} aria-label="Close contents">
          ✕
        </button>
      </header>
      <div className="panel-body">
        {toc.length === 0 ? (
          <p className="panel-empty">This book has no table of contents.</p>
        ) : (
          <TocList items={toc} depth={0} onNavigate={onNavigate} />
        )}
      </div>
    </aside>
  )
}
