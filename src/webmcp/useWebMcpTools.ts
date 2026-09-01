import { useCallback, useEffect, useState } from 'react'

import { getModelContext, type ToolDefinition } from './model-context.ts'
import type { ToolCallRecord } from './tools.ts'

export type WebMcpStatus = 'unsupported' | 'registering' | 'ready' | 'failed'

export type ToolCallReporter = (entry: Omit<ToolCallRecord, 'id' | 'at'>) => void

export interface UseWebMcpOptions {
  /**
   * Builds the tools to offer. Memoize it: the tools are registered whenever
   * this changes, which is how a set is swapped when a book opens or closes.
   */
  readonly createTools?: (report: ToolCallReporter) => readonly ToolDefinition[]
  readonly historyLimit?: number
}

/**
 * Registers tools with the page's agent runtime. Registration is the only
 * WebMCP-specific code in the product: the tools themselves call the same
 * commands the interface calls, and the app behaves identically when no agent
 * runtime is present.
 */
export function useWebMcpTools({ createTools, historyLimit = 20 }: UseWebMcpOptions) {
  const [status, setStatus] = useState<WebMcpStatus>('unsupported')
  const [calls, setCalls] = useState<readonly ToolCallRecord[]>([])
  const [toolNames, setToolNames] = useState<readonly string[]>([])

  const report = useCallback<ToolCallReporter>(
    (entry) => {
      setCalls((previous) =>
        [
          { ...entry, id: `${Date.now()}-${previous.length}`, at: new Date().toISOString() },
          ...previous,
        ].slice(0, historyLimit),
      )
    },
    [historyLimit],
  )

  useEffect(() => {
    if (!createTools) return
    const modelContext = getModelContext()
    if (!modelContext) {
      setStatus('unsupported')
      return
    }

    const tools = createTools(report)
    if (tools.length === 0) return

    const controller = new AbortController()
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
  }, [createTools, report])

  const clearHistory = useCallback(() => setCalls([]), [])

  return { status, calls, toolNames, clearHistory }
}
