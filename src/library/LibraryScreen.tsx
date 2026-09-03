import { useRef } from 'react'
import { Bot, BookOpen, FolderOpen, LayoutPanelLeft, RotateCw } from 'lucide-react'

import type { BookCatalogEntry } from '../domain/index.ts'
import { Wordmark } from '../app/Identity.tsx'
import { BookCover } from './BookCover.tsx'
import {
  authorLine,
  hasMeaningfulProgress,
  lastReadLabel,
  progressPercent,
  splitTitle,
} from './progress.ts'
import type { LibraryState } from './useLibrary.ts'

export interface LibraryScreenProps extends LibraryState {
  readonly agentStatus?: 'unsupported' | 'registering' | 'ready' | 'failed'
  readonly onOpenBook: (entry: BookCatalogEntry) => void
  readonly onImportFile: (file: File) => void
  readonly onRetry: () => void
  readonly onDismissNotice: () => void
}

function StorageFooter({ state }: { readonly state: LibraryScreenProps }) {
  const count = state.books.length
  const books = `${count} ${count === 1 ? 'book' : 'books'}`
  const mode = state.diagnostics?.mode
  const where =
    mode === 'persistent'
      ? 'Stored on this device'
      : mode === 'session-only'
        ? 'This session only — storage is unavailable, so imports will not survive a reload'
        : mode === 'locked'
          ? 'Open in another tab'
          : 'Checking local storage'
  return (
    <footer className="library-footer">
      <span>{books}</span>
      <span aria-hidden="true">·</span>
      <span data-storage-mode={mode ?? 'unknown'}>{where}</span>
      {state.agentStatus === 'ready' ? (
        <span className="library-agent">
          <Bot size={13} aria-hidden="true" />
          Your agent can read and annotate this library
        </span>
      ) : null}
    </footer>
  )
}

function Progress({ entry }: { readonly entry: BookCatalogEntry }) {
  const percent = progressPercent(entry)
  if (percent === undefined) return <span className="progress-empty">Not started</span>
  return (
    <span className="progress">
      <span
        className="progress-track"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${entry.metadata.title} progress`}
      >
        <span className="progress-fill" style={{ inlineSize: `${percent}%` }} />
      </span>
      <span className="progress-value">{percent}%</span>
    </span>
  )
}

export function LibraryScreen(props: LibraryScreenProps) {
  const { books, phase, notice, importing, bootstrapping } = props
  const fileInput = useRef<HTMLInputElement>(null)
  const continuing = books.filter(hasMeaningfulProgress).sort((a, b) =>
    (b.readingState?.updatedAt ?? '').localeCompare(a.readingState?.updatedAt ?? ''),
  )[0]

  return (
    <div className="library">
      <header className="library-masthead">
        <Wordmark />
        <nav aria-label="Sections">
          <span className="current-section" aria-current="page">
            Library
          </span>
        </nav>
        <button
          type="button"
          className="button button-quiet"
          onClick={() => fileInput.current?.click()}
          disabled={importing || phase !== 'ready'}
        >
          <FolderOpen size={16} aria-hidden="true" />
          {importing ? 'Adding…' : 'Open EPUB'}
        </button>
        <input
          ref={fileInput}
          type="file"
          disabled={importing || phase !== 'ready'}
          accept=".epub,application/epub+zip"
          className="visually-hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file) props.onImportFile(file)
          }}
        />
      </header>

      <main className="library-body">
        <h1 className="library-title">Library</h1>

        {notice ? (
          <p className={`notice notice-${notice.tone}`} role="status">
            <span>{notice.message}</span>
            <button type="button" className="button button-text" onClick={props.onDismissNotice}>
              Dismiss
            </button>
          </p>
        ) : null}

        {phase === 'loading' ? (
          <p className="state-line" role="status">
            Opening your library…
          </p>
        ) : null}

        {phase === 'locked' ? (
          <section className="state-panel" aria-live="polite">
            <h2>This library is open in another tab</h2>
            <p>
              Bookhand keeps one writer so your books cannot be corrupted. Close the other
              tab, then try again.
            </p>
            <button type="button" className="button button-primary" onClick={props.onRetry}>
              <RotateCw size={16} aria-hidden="true" />
              Retry
            </button>
          </section>
        ) : null}

        {phase === 'error' ? (
          <section className="state-panel" aria-live="polite">
            <h2>Your library did not load</h2>
            <p>{props.error}</p>
            <button type="button" className="button button-primary" onClick={props.onRetry}>
              <RotateCw size={16} aria-hidden="true" />
              Retry
            </button>
          </section>
        ) : null}

        {phase === 'ready' && books.length === 0 && !bootstrapping ? (
          <section className="state-panel state-empty">
            <h2>No books yet</h2>
            <p>Open an EPUB from this device to start reading. Nothing leaves your browser.</p>
            <button
              type="button"
              className="button button-primary"
              onClick={() => fileInput.current?.click()}
            >
              <FolderOpen size={16} aria-hidden="true" />
              Open EPUB
            </button>
          </section>
        ) : null}

        {continuing ? (
          <section className="continue" aria-labelledby="continue-heading">
            <h2 id="continue-heading" className="section-heading">
              Continue reading
            </h2>
            <div className="continue-body">
              <BookCover metadata={continuing.metadata} size="feature" />
              <div className="continue-detail">
                <h3 className="continue-title">{splitTitle(continuing.metadata).title}</h3>
                {splitTitle(continuing.metadata).subtitle ? (
                  <p className="continue-subtitle">{splitTitle(continuing.metadata).subtitle}</p>
                ) : null}
                <p className="continue-author">{authorLine(continuing)}</p>
                <Progress entry={continuing} />
                <p className="continue-context">Last read {lastReadLabel(continuing)}</p>
                <div className="continue-actions">
                  <button
                    type="button"
                    className="button button-primary"
                    onClick={() => props.onOpenBook(continuing)}
                  >
                    <BookOpen size={16} aria-hidden="true" />
                    Continue
                  </button>
                  <button type="button" className="button button-quiet" disabled>
                    <LayoutPanelLeft size={16} aria-hidden="true" />
                    Study
                  </button>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {books.length > 0 ? (
          <section className="all-books" aria-labelledby="all-books-heading">
            <h2 id="all-books-heading" className="section-heading">
              All books
            </h2>
            <ul className="book-list">
              {books.map((entry) => (
                <li key={entry.id} className="book-row">
                  <button
                    type="button"
                    className="book-open"
                    onClick={() => props.onOpenBook(entry)}
                  >
                    <BookCover metadata={entry.metadata} size="shelf" />
                    <span className="book-identity">
                      <span className="book-title" title={entry.metadata.title}>
                        {splitTitle(entry.metadata).title}
                      </span>
                      {splitTitle(entry.metadata).subtitle ? (
                        <span className="book-subtitle">{splitTitle(entry.metadata).subtitle}</span>
                      ) : null}
                      <span className="book-author">{authorLine(entry)}</span>
                      <span className="book-format">EPUB</span>
                    </span>
                    <span className="book-progress">
                      <Progress entry={entry} />
                    </span>
                    <span className="book-context">
                      {lastReadLabel(entry) ? `Last read ${lastReadLabel(entry)}` : 'Not opened yet'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {bootstrapping ? (
          <p className="state-line" role="status">
            Adding bundled books…
          </p>
        ) : null}
      </main>

      <StorageFooter state={props} />
    </div>
  )
}
