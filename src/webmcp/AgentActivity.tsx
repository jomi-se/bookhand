import { Bot, BotOff } from 'lucide-react'

import type { ToolCallRecord } from './tools.ts'
import type { WebMcpStatus } from './useWebMcpTools.ts'

export interface AgentActivityProps {
  readonly status: WebMcpStatus
  readonly calls: readonly ToolCallRecord[]
  readonly toolNames: readonly string[]
  readonly onClear: () => void
}

const STATUS_TEXT: Record<WebMcpStatus, string> = {
  unsupported: 'No agent connected',
  registering: 'Offering tools…',
  ready: 'Tools available to your agent',
  failed: 'Tools could not be offered',
}

/**
 * Makes agent activity visible. Anything a tool does to the book or the board
 * is something the person should be able to see happening and account for
 * afterwards, rather than discovering later.
 */
export function AgentActivity({ status, calls, toolNames, onClear }: AgentActivityProps) {
  return (
    <section className="agent-activity" aria-label="Agent activity">
      <p className="agent-status" data-status={status}>
        {status === 'unsupported' ? (
          <BotOff size={14} aria-hidden="true" />
        ) : (
          <Bot size={14} aria-hidden="true" />
        )}
        <span>{STATUS_TEXT[status]}</span>
        {status === 'ready' ? (
          <span className="agent-tool-count">{toolNames.length} tools</span>
        ) : null}
      </p>

      {status === 'unsupported' ? (
        <p className="panel-empty">
          Bookhand works exactly the same without an agent. Open it in a browser with WebMCP
          to let one read the page you are on and build study material with you.
        </p>
      ) : null}

      {calls.length > 0 ? (
        <>
          <ul className="agent-calls">
            {calls.map((call) => (
              <li key={call.id} data-failed={call.failed ? 'true' : undefined}>
                <code>{call.name}</code>
                <span>{call.summary}</span>
              </li>
            ))}
          </ul>
          <button type="button" className="button button-text" onClick={onClear}>
            Clear activity
          </button>
        </>
      ) : null}
    </section>
  )
}
