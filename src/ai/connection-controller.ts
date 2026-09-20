import {
  createAiSdkOpenResponsesModel,
  type AiSdkOpenResponsesModelOptions,
  type OpenClawConnectionExperience,
} from '@open-agent-connect/web'
import type { LanguageModel } from 'ai'

import type { TutorHistoryAccess } from './conversation-history.ts'
import type {
  AiConnectionSnapshot,
  AuthorizeAiConnectionOptions,
} from './connection.ts'
import { AiConnectionStore } from './connection.ts'
import type { AiFeatureIntent } from './pending-intent.ts'
import type { ToolDefinition } from '../webmcp/model-context.ts'

export const DIRECT_CONNECTION_PREFERENCES_KEY = 'bookhand.ai.direct.preferences.v1'

export type AiConnectionMethod = 'agent-connect' | 'direct'
export type AiContinuationMode = 'native' | 'replay'

export interface BookhandAiConnectionSnapshot {
  readonly method: AiConnectionMethod
  readonly phase: 'disconnected' | 'connecting' | 'connected' | 'error'
  readonly providerUrl: string
  readonly experience: 'tailscale' | 'https'
  readonly directEndpoint: string
  readonly directModel: string
  readonly historyAvailable: boolean
  readonly generation?: string
  readonly error?: string
}

export interface ConnectDirectOptions {
  readonly tools: readonly ToolDefinition[]
  readonly bearerToken: string
}

export interface AgentConnectConnectionPort {
  readonly ready: Promise<void>
  getSnapshot(): AiConnectionSnapshot
  subscribe(listener: () => void): () => void
  setProviderUrl(providerUrl: string): void
  setExperience(experience: OpenClawConnectionExperience): void
  authorize(options: AuthorizeAiConnectionOptions): Promise<void>
  finishAuthorization(): Promise<AiFeatureIntent | undefined>
  disconnect(): Promise<void>
  getExecution(tools: readonly ToolDefinition[]): { generation: string; model: LanguageModel }
  getHistoryAccess(tools: readonly ToolDefinition[]): TutorHistoryAccess
  dismissPendingAuthorization(): void
}

export interface AiConnectionControllerOptions {
  readonly agentConnect?: AgentConnectConnectionPort
  readonly storage?: Storage
  readonly createGeneration?: () => string
  readonly createModel?: (options: AiSdkOpenResponsesModelOptions) => LanguageModel
  readonly fetch?: typeof globalThis.fetch
}

interface DirectPreferences {
  readonly method: AiConnectionMethod
  readonly endpoint: string
  readonly model: string
}

interface DirectConnection {
  readonly generation: string
  readonly endpoint: string
  readonly modelId: string
  readonly approvedTools: readonly ToolDeclaration[]
  readonly bearerToken: string
  readonly model: LanguageModel
}

interface ToolDeclaration {
  readonly name: string
  readonly description: string
  readonly inputSchema: unknown
}

const DEFAULT_PREFERENCES: DirectPreferences = Object.freeze({
  method: 'agent-connect',
  endpoint: '',
  model: '',
})

/**
 * Selects between the durable Agent Connect authorization and an intentionally
 * session-only direct Open Responses connection. The Tutor depends only on
 * this coordinator, so neither transport leaks into conversation behavior.
 */
export class AiConnectionController {
  readonly #agentConnect: AgentConnectConnectionPort
  readonly #storage: Storage | undefined
  readonly #createGeneration: () => string
  readonly #createModel: (options: AiSdkOpenResponsesModelOptions) => LanguageModel
  readonly #fetch: typeof globalThis.fetch | undefined
  readonly #listeners = new Set<() => void>()
  readonly #stopAgentSubscription: () => void
  #method: AiConnectionMethod
  #directEndpoint: string
  #directModel: string
  #directConnection: DirectConnection | undefined
  #directPhase: BookhandAiConnectionSnapshot['phase'] = 'disconnected'
  #directError: string | undefined
  #snapshot: BookhandAiConnectionSnapshot

  readonly ready: Promise<void>

  constructor(options: AiConnectionControllerOptions = {}) {
    this.#agentConnect = options.agentConnect ?? new AiConnectionStore()
    this.#storage = options.storage ?? defaultStorage()
    this.#createGeneration = options.createGeneration ?? (() => globalThis.crypto.randomUUID())
    this.#createModel = options.createModel ?? createAiSdkOpenResponsesModel
    this.#fetch = options.fetch
    const preferences = readDirectPreferences(this.#storage)
    this.#method = preferences.method
    this.#directEndpoint = preferences.endpoint
    this.#directModel = preferences.model
    this.#snapshot = this.#buildSnapshot()
    this.#stopAgentSubscription = this.#agentConnect.subscribe(this.#syncAgentConnect)
    this.ready = this.#agentConnect.ready
  }

  getSnapshot = (): BookhandAiConnectionSnapshot => this.#snapshot

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  dispose(): void {
    this.#retireDirectConnection()
    this.#stopAgentSubscription()
    this.#listeners.clear()
  }

  setMethod(method: AiConnectionMethod): void {
    if (method === this.#method) return
    if (this.#snapshot.phase === 'connected' || this.#snapshot.phase === 'connecting') {
      throw new Error('Disconnect before changing the connection method')
    }
    this.#method = method
    this.#directError = undefined
    this.#persistPreferences()
    this.#publish()
  }

  setProviderUrl(providerUrl: string): void {
    this.#agentConnect.setProviderUrl(providerUrl)
    this.#publish()
  }

  setExperience(experience: OpenClawConnectionExperience): void {
    this.#agentConnect.setExperience(experience)
    this.#publish()
  }

  setDirectEndpoint(endpoint: string): void {
    if (endpoint === this.#directEndpoint) return
    this.#retireDirectConnection()
    this.#directEndpoint = endpoint
    this.#directPhase = 'disconnected'
    this.#directError = undefined
    this.#persistPreferences()
    this.#publish()
  }

  setDirectModel(model: string): void {
    if (model === this.#directModel) return
    this.#retireDirectConnection()
    this.#directModel = model
    this.#directPhase = 'disconnected'
    this.#directError = undefined
    this.#persistPreferences()
    this.#publish()
  }

  authorize(options: AuthorizeAiConnectionOptions): Promise<void> {
    if (this.#method !== 'agent-connect') {
      return Promise.reject(new Error('Choose Agent Connect before starting provider authorization'))
    }
    return this.#agentConnect.authorize(options)
  }

  async connectDirect(options: ConnectDirectOptions): Promise<void> {
    if (this.#method !== 'direct') throw new Error('Choose Direct Open Responses before using an API token')
    this.#retireDirectConnection()
    this.#directPhase = 'connecting'
    this.#directError = undefined
    this.#publish()

    try {
      const endpoint = normalizeDirectEndpoint(this.#directEndpoint)
      const modelId = normalizeDirectModel(this.#directModel)
      const bearerToken = options.bearerToken.trim()
      if (!bearerToken) throw new TypeError('Enter a bearer token for this API')
      const generation = this.#createGeneration()
      const approvedTools = snapshotToolDeclarations(options.tools)
      const model = this.#createModel({
        endpoint,
        model: modelId,
        getAccessToken: (signal) => this.#getDirectBearerToken(generation, signal),
        ...(this.#fetch ? { fetch: this.#fetch } : {}),
      })
      this.#directEndpoint = endpoint
      this.#directModel = modelId
      this.#directConnection = {
        generation,
        endpoint,
        modelId,
        approvedTools,
        bearerToken,
        model,
      }
      this.#directPhase = 'connected'
      this.#persistPreferences()
      this.#publish()
    } catch (error) {
      this.#retireDirectConnection()
      this.#directPhase = 'error'
      this.#directError = errorMessage(error, 'Bookhand could not configure this direct API connection')
      this.#publish()
      throw error
    }
  }

  finishAuthorization(): Promise<AiFeatureIntent | undefined> {
    return this.#agentConnect.finishAuthorization()
  }

  async disconnect(): Promise<void> {
    if (this.#method === 'agent-connect') {
      await this.#agentConnect.disconnect()
      return
    }
    this.#retireDirectConnection()
    this.#directPhase = 'disconnected'
    this.#directError = undefined
    this.#publish()
  }

  getExecution(tools: readonly ToolDefinition[]): {
    generation: string
    model: LanguageModel
    continuation: AiContinuationMode
  } {
    if (this.#method === 'agent-connect') {
      return { ...this.#agentConnect.getExecution(tools), continuation: 'native' }
    }
    const current = this.#directConnection
    if (!current || this.#directPhase !== 'connected') {
      throw new Error('Connect your AI before starting this request')
    }
    if (!sameToolDeclarations(current.approvedTools, tools)) {
      throw new Error('Bookhand tools changed after connecting; connect the direct API again')
    }
    return { generation: current.generation, model: current.model, continuation: 'replay' }
  }

  getHistoryAccess(tools: readonly ToolDefinition[]): TutorHistoryAccess {
    if (this.#method === 'agent-connect') return this.#agentConnect.getHistoryAccess(tools)
    // Direct providers may implement history endpoints, but Open Responses does
    // not standardize that surface and Bookhand never guesses a vendor API.
    throw new Error('Direct Open Responses does not provide Tutor history')
  }

  dismissPendingAuthorization(): void {
    this.#agentConnect.dismissPendingAuthorization()
  }

  #getDirectBearerToken(generation: string, signal?: AbortSignal): Promise<string> {
    signal?.throwIfAborted()
    const current = this.#directConnection
    if (
      this.#method !== 'direct'
      || this.#directPhase !== 'connected'
      || current?.generation !== generation
    ) {
      return Promise.reject(new Error('Direct Open Responses connection changed'))
    }
    return Promise.resolve(current.bearerToken)
  }

  #retireDirectConnection(): void {
    this.#directConnection = undefined
  }

  #syncAgentConnect = (): void => {
    if (this.#method === 'agent-connect') this.#publish()
  }

  #persistPreferences(): void {
    writeDirectPreferences(this.#storage, {
      method: this.#method,
      endpoint: this.#directEndpoint,
      model: this.#directModel,
    })
  }

  #buildSnapshot(): BookhandAiConnectionSnapshot {
    const agent = this.#agentConnect.getSnapshot()
    if (this.#method === 'agent-connect') {
      return Object.freeze({
        method: this.#method,
        phase: agent.phase,
        providerUrl: agent.providerUrl,
        experience: agent.experience,
        directEndpoint: this.#directEndpoint,
        directModel: this.#directModel,
        historyAvailable: agent.phase === 'connected',
        ...(agent.generation ? { generation: agent.generation } : {}),
        ...(agent.error ? { error: agent.error } : {}),
      })
    }
    const generation = this.#directConnection?.generation
    return Object.freeze({
      method: this.#method,
      phase: this.#directPhase,
      providerUrl: agent.providerUrl,
      experience: agent.experience,
      directEndpoint: this.#directEndpoint,
      directModel: this.#directModel,
      historyAvailable: false,
      ...(generation ? { generation } : {}),
      ...(this.#directError ? { error: this.#directError } : {}),
    })
  }

  #publish(): void {
    this.#snapshot = this.#buildSnapshot()
    for (const listener of this.#listeners) listener()
  }
}

function readDirectPreferences(storage: Storage | undefined): DirectPreferences {
  if (!storage) return DEFAULT_PREFERENCES
  try {
    const value = JSON.parse(storage.getItem(DIRECT_CONNECTION_PREFERENCES_KEY) ?? '') as Record<string, unknown>
    if (
      value.version !== 1
      || Object.keys(value).some((key) => !['version', 'method', 'endpoint', 'model'].includes(key))
    ) return DEFAULT_PREFERENCES
    return Object.freeze({
      method: value.method === 'direct' ? 'direct' : 'agent-connect',
      endpoint: safeStoredEndpoint(value.endpoint),
      model: safeStoredModel(value.model),
    })
  } catch {
    return DEFAULT_PREFERENCES
  }
}

function writeDirectPreferences(storage: Storage | undefined, preferences: DirectPreferences): void {
  try {
    storage?.setItem(DIRECT_CONNECTION_PREFERENCES_KEY, JSON.stringify({
      version: 1,
      method: preferences.method,
      endpoint: safeStoredEndpoint(preferences.endpoint),
      model: safeStoredModel(preferences.model),
    }))
  } catch { /* direct mode still works when optional preference storage is unavailable */ }
}

function normalizeDirectEndpoint(value: string): string {
  let endpoint: URL
  try { endpoint = new URL(value) } catch {
    throw new TypeError('Enter the complete HTTPS Open Responses endpoint')
  }
  if (
    endpoint.protocol !== 'https:'
    || !endpoint.hostname
    || endpoint.username
    || endpoint.password
    || endpoint.hash
  ) {
    throw new TypeError('The Open Responses endpoint must use HTTPS without credentials or a fragment')
  }
  return endpoint.href
}

function normalizeDirectModel(value: string): string {
  const model = value.trim()
  if (!model || model.length > 300) throw new TypeError('Enter the model ID supplied by this API provider')
  return model
}

function safeStoredEndpoint(value: unknown): string {
  if (value === '') return ''
  if (typeof value !== 'string' || value.length > 2_000) return ''
  try { return normalizeDirectEndpoint(value) } catch { return '' }
}

function safeStoredModel(value: unknown): string {
  if (typeof value !== 'string') return ''
  try { return normalizeDirectModel(value) } catch { return '' }
}

function snapshotToolDeclarations(tools: readonly ToolDefinition[]): readonly ToolDeclaration[] {
  return Object.freeze(tools.map(({ name, description, inputSchema }) => Object.freeze({
    name,
    description,
    inputSchema: deepFreeze(JSON.parse(JSON.stringify(inputSchema)) as unknown),
  })))
}

function sameToolDeclarations(approved: readonly ToolDeclaration[], tools: readonly ToolDefinition[]): boolean {
  return canonicalJson(approved) === canonicalJson(
    tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
  )
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function deepFreeze(value: unknown): unknown {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) deepFreeze(child)
    Object.freeze(value)
  }
  return value
}

function defaultStorage(): Storage | undefined {
  try { return globalThis.localStorage } catch { return undefined }
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}
