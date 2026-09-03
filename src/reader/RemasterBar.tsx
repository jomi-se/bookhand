import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, RotateCcw, Undo2 } from 'lucide-react'

import type { BookhandCommands } from '../app/commands.ts'

export interface RemasterBarProps {
  readonly commands?: BookhandCommands
  readonly sectionIndex?: number
}

/**
 * The control that keeps a rewritten chapter the reader's to accept.
 *
 * It appears only once an agent has actually changed something, and it says
 * what changed in the agent's own words. Original and Rewritten are a flip,
 * not a commitment: the publisher's markup is archived, so nothing here can
 * cost a person the book they bought.
 */
export function RemasterBar(props: RemasterBarProps) {
  const { commands, sectionIndex } = props
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const [collapsed, setCollapsed] = useState(false)
  const [state, setState] = useState<{
    rewritten: boolean
    showing: boolean
    summary?: string
    versions: number
  }>()

  useEffect(() => {
    if (!commands || sectionIndex === undefined) {
      setState(undefined)
      return
    }
    const read = () => {
      try {
        const described = commands.describeRewrite(sectionIndex)
        setState({
          rewritten: commands.hasRewrite(sectionIndex),
          showing: commands.isShowingRewritten(),
          ...(described?.summary === undefined ? {} : { summary: described.summary }),
          versions: described?.versions ?? 0,
        })
      } catch {
        // The reader is between books; there is nothing to offer yet.
        setState(undefined)
      }
    }
    read()
    return commands.subscribe(read)
  }, [commands, sectionIndex])

  if (!state?.rewritten || !commands || sectionIndex === undefined) return null

  const perform = (action: () => Promise<unknown>) => {
    setBusy(true)
    setError(undefined)
    void action()
      .catch(() => {
        setCollapsed(false)
        setError('That chapter view could not be changed. Your current version is still safe.')
      })
      .finally(() => setBusy(false))
  }

  if (collapsed) {
    return (
      <section
        className="remaster-bar remaster-bar-collapsed"
        aria-label="Chapter remaster"
      >
        <button
          type="button"
          className="button button-quiet remaster-disclosure"
          aria-expanded="false"
          onClick={() => setCollapsed(false)}
        >
          <ChevronDown size={14} aria-hidden="true" />
          Agent rewrite · {state.showing ? 'Rewritten' : 'Original'}
        </button>
      </section>
    )
  }

  return (
    <section
      id="chapter-remaster-details"
      className="remaster-bar"
      aria-label="Chapter remaster"
      aria-busy={busy}
    >
      {/* The agent's own sentence, when it gave one. A person deciding whether
          to keep a rewrite is better served by what was attempted than by a
          generic notice — and the tool promises this is where it appears. */}
      <p className="remaster-bar-note" role="status">
        <strong>An agent rewrote this chapter</strong>
        {state.summary ? <span> · {state.summary}</span> : null}
        {state.versions > 1 ? (
          <span className="remaster-bar-versions"> · {state.versions} revisions</span>
        ) : null}
      </p>
      <div className="remaster-bar-tools">
        <div className="remaster-switch" role="group" aria-label="Which version of this chapter to show">
          <button
            type="button"
            className="button button-quiet"
            aria-pressed={!state.showing}
            disabled={busy}
            onClick={() => perform(() => commands.showRewritten(false))}
          >
            Original
          </button>
          <button
            type="button"
            className="button button-quiet"
            aria-pressed={state.showing}
            disabled={busy}
            onClick={() => perform(() => commands.showRewritten(true))}
          >
            Rewritten
          </button>
        </div>
        <span className="remaster-current" aria-live="polite">
          Showing {state.showing ? 'rewritten' : 'original'}
        </span>
        <button
          type="button"
          className="button button-text"
          disabled={busy}
          onClick={() => perform(() => commands.undoSectionRewrite(sectionIndex))}
        >
          <Undo2 size={14} aria-hidden="true" />
          Undo
        </button>
        <button
          type="button"
          className="button button-text"
          disabled={busy}
          onClick={() => perform(() => commands.resetSection(sectionIndex))}
        >
          <RotateCcw size={14} aria-hidden="true" />
          Reset
        </button>
        <button
          type="button"
          className="button button-text remaster-collapse"
          aria-expanded="true"
          onClick={() => setCollapsed(true)}
        >
          <ChevronUp size={14} aria-hidden="true" />
          Hide
        </button>
      </div>
      {error ? <p className="remaster-bar-error" role="alert">{error}</p> : null}
    </section>
  )
}
