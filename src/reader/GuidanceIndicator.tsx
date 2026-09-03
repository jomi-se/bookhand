import { useEffect, useState } from 'react'
import { CircleStop, CornerUpLeft } from 'lucide-react'

import type { GuidanceController, GuidanceView } from '../app/guidance.ts'

export function GuidanceIndicator({ controller }: { readonly controller: GuidanceController }) {
  const [view, setView] = useState<GuidanceView>(controller.view)
  const [error, setError] = useState<string | undefined>(controller.notice)
  useEffect(() => controller.subscribe((next) => {
    setView(next)
    setError(controller.notice)
  }), [controller])

  const back = async () => {
    await controller.back()
  }

  return (
    <aside
      className="guidance-indicator"
      aria-label="Tutor guidance"
      hidden={view.state === 'absent' && !error}
    >
      {view.state !== 'absent' ? (
        <p
          className="guidance-message"
          role="status"
          title={view.state === 'guiding' ? controller.message : undefined}
        >
          <span className="guidance-attribution">Tutor</span>
          <span>
            {view.state === 'guiding'
              ? controller.message ?? 'Showing you a passage in the book.'
              : 'You moved on. Return to where you were, or end this guidance.'}
          </span>
        </p>
      ) : null}
      {error ? <p className="guidance-error" role="alert">{error}</p> : null}
      {view.state !== 'absent' ? (
        <div className="guidance-actions">
          <button type="button" className="button button-quiet" onClick={() => void back()}>
            <CornerUpLeft size={16} aria-hidden="true" />
            Back
          </button>
          <button
            type="button"
            className="button button-text"
            onClick={() => void controller.stop()}
          >
            <CircleStop size={16} aria-hidden="true" />
            Stop
          </button>
        </div>
      ) : error ? (
        <button type="button" className="button button-text" onClick={() => controller.dismissNotice()}>
          Dismiss
        </button>
      ) : null}
    </aside>
  )
}
