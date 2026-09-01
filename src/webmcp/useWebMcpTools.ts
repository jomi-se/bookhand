import { useCallback, useEffect, useRef, useState } from 'react'

import type { ReaderStyle } from '../domain/index.ts'
import type { BookhandCommands } from '../app/commands.ts'
import { getModelContext } from './model-context.ts'
import { createBookhandTools, type ToolCallRecord } from './tools.ts'

export type WebMcpStatus = 'unsupported' | 'registering' | 'ready' | 'failed'

export interface UseWebMcpOptions {
  readonly commands?: BookhandCommands
  readonly style: ReaderStyle
  readonly historyLimit?: number
}

/**
 * Registers Bookhand's tools with the page's agent runtime for as long as a
 * book is open. Registration is deliberately the only thing WebMCP-specific in
 * the product: every tool calls the same commands the interface calls, and the
 * reader behaves identically when no agent runtime exists.
 */
export function useWebMcpTools({ commands, style, historyLimit = 20 }: UseWebMcpOptions) {
  const [status, setStatus] = useState<WebMcpStatus>('unsupported')
  const [calls, setCalls] = useState<readonly ToolCallRecord[]>([])
  const [toolNames, setToolNames] = useState<readonly string[]>([])

  // Read through refs so a style change or a new call never re-registers tools.
  const styleRef = useRef(style)
  useEffect(() => {
    styleRef.current = style
  }, [style])

  const record = useCallback(
    (entry: Omit<ToolCallRecord, 'id' | 'at'>) => {
      setCalls((previous) =>
        [
          {
            ...entry,
            id: `${Date.now()}-${previous.length}`,
            at: new Date().toISOString(),
          },
          ...previous,
        ].slice(0, historyLimit),
      )
    },
    [historyLimit],
  )

  useEffect(() => {
    if (!commands) return
    const modelContext = getModelContext()
    if (!modelContext) {
      setStatus('unsupported')
      return
    }

    const controller = new AbortController()
    const tools = createBookhandTools({
      commands,
      onCall: record,
      currentStyle: () => styleRef.current,
    })
    setToolNames(tools.map((tool) => tool.name))
    setStatus('registering')

    void Promise.all(
      tools.map((tool) => modelContext.registerTool(tool, { signal: controller.signal })),
    ).then(
      () => {
        if (!controller.signal.aborted) setStatus('ready')
      },
      () => {
        if (!controller.signal.aborted) setStatus('failed')
      },
    )

    return () => controller.abort()
  }, [commands, record])

  const clearHistory = useCallback(() => setCalls([]), [])

  return { status, calls, toolNames, clearHistory }
}
