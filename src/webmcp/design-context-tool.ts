import {
  DESIGN_SURFACES,
  composeDesignContext,
  type DesignContextState,
  type DesignSurface,
} from './design-context.ts'
import { textResult, type ToolDefinition } from './model-context.ts'
import type { ToolCallReporter } from './useWebMcpTools.ts'

export interface DesignContextToolOptions {
  /** Read at call time so the response describes the surface as it is now. */
  readonly state: () => DesignContextState
  readonly report: ToolCallReporter
}

/**
 * Registered from first load, alongside the library tools. An agent that
 * arrives at the library and is asked to restyle something should be able to
 * find the composition rules before it opens a book, not after it has already
 * guessed.
 */
export function createDesignContextTool(options: DesignContextToolOptions): ToolDefinition {
  return {
    name: 'get_design_context',
    description:
      'Read Bookhand’s composition guidance and the current state of its surfaces before changing how anything looks or building study material. Returns the semantic roles, accessibility floors, what each change can and cannot reach, and the reversal actions the person has. Read-only: it changes nothing and stores nothing.',
    inputSchema: {
      type: 'object',
      properties: {
        surface: {
          type: 'string',
          enum: [...DESIGN_SURFACES],
          description:
            'Which surface you are about to work on. Defaults to whichever is on screen.',
        },
      },
      additionalProperties: false,
    },
    execute: async (input) => {
      try {
        const state = options.state()
        const requested: DesignSurface = DESIGN_SURFACES.includes(input.surface as DesignSurface)
          ? (input.surface as DesignSurface)
          : state.activeSurface
        const text = composeDesignContext(requested, state)
        options.report({ name: 'get_design_context', summary: `read design context for ${requested}` })
        return textResult(text)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'That did not work'
        options.report({ name: 'get_design_context', summary: message, failed: true })
        return { content: [{ type: 'text', text: message }], isError: true }
      }
    },
  }
}
