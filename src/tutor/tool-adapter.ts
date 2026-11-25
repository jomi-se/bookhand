import type { AgentToolDefinition, ApplicationTool, JsonObject, JsonSchema } from '@open-agent-connect/web'
import type { ToolDefinition } from '../webmcp/model-context.ts'

/** The same page-owned handlers, scoped to this reader's lifetime. */
export function lendBookhandTools(
  tools: readonly ToolDefinition[],
  lifetime: AbortSignal,
): readonly ApplicationTool[] {
  return tools.map((tool) => ({
    ...declaration(tool),
    inputSchema: structuredClone(tool.inputSchema) as JsonSchema,
    async execute(input, context) {
      lifetime.throwIfAborted()
      context.signal?.throwIfAborted()
      const signal = context.signal
        ? AbortSignal.any([lifetime, context.signal])
        : lifetime
      const result = await tool.execute(input, { signal })
      signal.throwIfAborted()
      return {
        ...result,
        structuredContent: result.structuredContent as JsonObject,
      }
    },
  }))
}

/** Submit exactly the same declarations for consent and prompt execution. */
export function bookhandToolDeclarations(tools: readonly ToolDefinition[]): readonly AgentToolDefinition[] {
  return tools.map(declaration)
}

function declaration({ name, description, inputSchema }: ToolDefinition): AgentToolDefinition {
  return { name, description, inputSchema: inputSchema as JsonSchema }
}
