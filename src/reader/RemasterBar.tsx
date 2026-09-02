import { useEffect, useState } from 'react'
import { RotateCcw, Undo2 } from 'lucide-react'

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
  const [state, setState] = useState<{ rewritten: boolean; showing: boolean }>()

  useEffect(() => {
    if (!commands || sectionIndex === undefined) {
      setState(undefined)
      return
    }
    const read = () => {
      try {
        setState({
          rewritten: commands.hasRewrite(sectionIndex),
          showing: commands.isShowingRewritten(),
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

  return (
    <div className="remaster-bar" role="status">
      <p className="remaster-bar-note">
        An agent rewrote this chapter’s markup.
      </p>
      <div className="remaster-bar-tools">
        <div className="remaster-switch" role="group" aria-label="Which version of this chapter to show">
          <button
            type="button"
            className="button button-quiet"
            aria-pressed={!state.showing}
            onClick={() => commands.showRewritten(false)}
          >
            Original
          </button>
          <button
            type="button"
            className="button button-quiet"
            aria-pressed={state.showing}
            onClick={() => commands.showRewritten(true)}
          >
            Rewritten
          </button>
        </div>
        <button
          type="button"
          className="button button-text"
          onClick={() => void commands.undoSectionRewrite(sectionIndex)}
        >
          <Undo2 size={14} aria-hidden="true" />
          Undo
        </button>
        <button
          type="button"
          className="button button-text"
          onClick={() => void commands.resetSection(sectionIndex)}
        >
          <RotateCcw size={14} aria-hidden="true" />
          Reset
        </button>
      </div>
    </div>
  )
}
