// @vitest-environment jsdom

import type { LanguageModel } from 'ai'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  AiConnectionController,
  DIRECT_CONNECTION_PREFERENCES_KEY,
  type AgentConnectConnectionPort,
} from '../../src/ai/connection-controller.ts'
import type { AiConnectionSnapshot } from '../../src/ai/connection.ts'
import type { ToolDefinition } from '../../src/webmcp/model-context.ts'

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

function tool(description = 'Read the current page'): ToolDefinition {
  return {
    name: 'get_reading_context',
    description,
    inputSchema: {
      type: 'object',
      properties: { detail: { type: 'boolean' } },
      additionalProperties: false,
    },
    outputSchema: { type: 'object' },
    execute: vi.fn(async () => ({
      content: [{ type: 'text' as const, text: 'page' }],
      structuredContent: { ok: true },
    })),
  }
}

class FakeAgentConnect implements AgentConnectConnectionPort {
  readonly ready = Promise.resolve()
  readonly listeners = new Set<() => void>()
  snapshot: AiConnectionSnapshot = {
    phase: 'disconnected',
    providerUrl: '',
    experience: 'tailscale',
  }
  readonly authorize = vi.fn(async () => undefined)
  readonly finishAuthorization = vi.fn(async () => undefined)
  readonly disconnect = vi.fn(async () => undefined)
  readonly getExecution = vi.fn(() => ({
    generation: 'agent-connect-generation',
    model: {} as LanguageModel,
  }))
  readonly getHistoryAccess = vi.fn(() => ({
    scopeId: 'agent-connect-scope',
    generation: 'agent-connect-generation',
    list: vi.fn(async () => []),
    history: vi.fn(async () => { throw new Error('unused') }),
  }))
  readonly dismissPendingAuthorization = vi.fn()
  readonly setProviderUrl = vi.fn()
  readonly setExperience = vi.fn()

  getSnapshot = () => this.snapshot
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
}

describe('AI connection coordinator', () => {
  it('keeps Agent Connect as the recommended default and delegates its durable behavior', async () => {
    const agentConnect = new FakeAgentConnect()
    const controller = new AiConnectionController({ agentConnect, storage: localStorage })
    const tools = [tool()]
    const authorization = {
      tools,
      intent: { feature: 'tutor' as const, bookId: 'book-1', draft: 'Explain this' },
      beforeRedirect: vi.fn(async () => undefined),
    }

    expect(controller.getSnapshot()).toMatchObject({
      method: 'agent-connect',
      phase: 'disconnected',
      historyAvailable: false,
    })
    controller.setProviderUrl('https://agent.example')
    controller.setExperience('https')
    await controller.authorize(authorization)
    expect(agentConnect.setProviderUrl).toHaveBeenCalledWith('https://agent.example')
    expect(agentConnect.setExperience).toHaveBeenCalledWith('https')
    expect(agentConnect.authorize).toHaveBeenCalledWith(authorization)

    agentConnect.snapshot = {
      phase: 'connected',
      providerUrl: 'https://agent.example',
      experience: 'https',
      generation: 'agent-connect-generation',
    }
    for (const listener of agentConnect.listeners) listener()
    expect(controller.getSnapshot()).toMatchObject({
      method: 'agent-connect',
      phase: 'connected',
      historyAvailable: true,
      generation: 'agent-connect-generation',
    })
    expect(controller.getExecution(tools)).toMatchObject({
      generation: 'agent-connect-generation',
      continuation: 'native',
    })
    expect(controller.getHistoryAccess(tools)).toMatchObject({ scopeId: 'agent-connect-scope' })
    expect(agentConnect.getExecution).toHaveBeenCalledWith(tools)
    expect(agentConnect.getHistoryAccess).toHaveBeenCalledWith(tools)
  })

  it('keeps a direct bearer token in memory while persisting only endpoint and model preferences', async () => {
    const agentConnect = new FakeAgentConnect()
    const model = {} as LanguageModel
    const modelOptions: Array<{
      endpoint: string
      model: string
      getAccessToken: (signal?: AbortSignal) => string | Promise<string>
    }> = []
    const controller = new AiConnectionController({
      agentConnect,
      storage: localStorage,
      createGeneration: () => 'direct-generation',
      createModel(options) {
        modelOptions.push(options)
        return model
      },
    })
    const tools = [tool()]

    controller.setMethod('direct')
    controller.setDirectEndpoint('https://inference.example/v1/responses')
    controller.setDirectModel('example/reader-model')
    await controller.connectDirect({ tools, bearerToken: 'secret-direct-token' })

    expect(controller.getSnapshot()).toMatchObject({
      method: 'direct',
      phase: 'connected',
      directEndpoint: 'https://inference.example/v1/responses',
      directModel: 'example/reader-model',
      generation: 'direct-generation',
      historyAvailable: false,
    })
    expect(controller.getExecution(tools)).toEqual({
      generation: 'direct-generation',
      model,
      continuation: 'replay',
    })
    await expect(modelOptions[0]!.getAccessToken()).resolves.toBe('secret-direct-token')

    const persisted = localStorage.getItem(DIRECT_CONNECTION_PREFERENCES_KEY)
    expect(persisted).toContain('https://inference.example/v1/responses')
    expect(persisted).toContain('example/reader-model')
    expect(persisted).not.toContain('secret-direct-token')
    expect(JSON.stringify(controller.getSnapshot())).not.toContain('secret-direct-token')

    await controller.disconnect()
    await expect(modelOptions[0]!.getAccessToken()).rejects.toThrow(/connection changed/i)

    const reloaded = new AiConnectionController({
      agentConnect: new FakeAgentConnect(),
      storage: localStorage,
    })
    expect(reloaded.getSnapshot()).toMatchObject({
      method: 'direct',
      phase: 'disconnected',
      directEndpoint: 'https://inference.example/v1/responses',
      directModel: 'example/reader-model',
      historyAvailable: false,
    })
  })

  it('binds a direct connection to the exact Bookhand tool declarations', async () => {
    const controller = new AiConnectionController({
      agentConnect: new FakeAgentConnect(),
      storage: localStorage,
      createModel: () => ({}) as LanguageModel,
    })
    const approved = [tool()]
    controller.setMethod('direct')
    controller.setDirectEndpoint('https://inference.example/v1/responses')
    controller.setDirectModel('reader-model')
    await controller.connectDirect({ tools: approved, bearerToken: 'token' })

    expect(() => controller.getExecution([tool('Changed after connecting')]))
      .toThrow(/tools changed/i)
    expect(() => controller.getHistoryAccess(approved)).toThrow(/does not provide Tutor history/i)
  })

  it('rejects unsafe or incomplete direct configuration without retaining the key', async () => {
    const createModel = vi.fn(() => ({}) as LanguageModel)
    const controller = new AiConnectionController({
      agentConnect: new FakeAgentConnect(),
      storage: localStorage,
      createModel,
    })
    controller.setMethod('direct')
    controller.setDirectEndpoint('http://inference.example/v1/responses')
    controller.setDirectModel('reader-model')

    await expect(controller.connectDirect({ tools: [tool()], bearerToken: 'do-not-keep' }))
      .rejects.toThrow(/HTTPS/)
    expect(createModel).not.toHaveBeenCalled()
    expect(controller.getSnapshot()).toMatchObject({ method: 'direct', phase: 'error' })
    expect(localStorage.getItem(DIRECT_CONNECTION_PREFERENCES_KEY)).not.toContain('do-not-keep')
  })
})
