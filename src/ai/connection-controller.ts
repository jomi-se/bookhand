import {
  AcpPairingError,
  AgentConnectError,
  connectAgent,
  createAcpPairing,
  type AgentToolDefinition,
} from '@open-agent-connect/web'
import {
  clearPairingIntent,
  pendingPairingReturn,
  storePairingIntent,
  type AiFeatureIntent,
} from './pending-intent.ts'

const ADDRESS_KEY = 'bookhand.acp.gateway.v1'

export interface AiConnectionSnapshot {
  readonly phase: 'disconnected' | 'connecting' | 'connected' | 'error'
  readonly providerUrl: string
  readonly generation?: string
  readonly error?: string
}

export interface AuthorizeOptions {
  readonly tools: readonly AgentToolDefinition[]
  readonly intent: AiFeatureIntent
  readonly beforeRedirect: () => Promise<void>
}

export class AiConnectionController {
  #state: AiConnectionSnapshot = { phase: 'disconnected', providerUrl: loadAddress() }
  readonly #listeners = new Set<() => void>()
  #pairing: ReturnType<typeof createAcpPairing> | undefined
  #callback: Promise<AiFeatureIntent> | undefined
  #resumeAttempted = false
  #approvedTools: readonly AgentToolDefinition[] | undefined

  getSnapshot = (): AiConnectionSnapshot => this.#state

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  setProviderUrl = (value: string): void => {
    if (this.#state.phase === 'connecting' || this.#state.phase === 'connected') return
    this.#resumeAttempted = true
    this.#set({ phase: 'disconnected', providerUrl: value })
  }

  resume = async (tools: readonly AgentToolDefinition[]): Promise<void> => {
    if (this.#resumeAttempted || this.#state.phase !== 'disconnected'
      || !this.#state.providerUrl || pendingPairingReturn()) return
    this.#resumeAttempted = true
    const gateway = this.#state.providerUrl
    await this.#check(gateway, tools, redirectUri()).catch(() => undefined)
  }

  authorize = async ({ tools, intent, beforeRedirect }: AuthorizeOptions): Promise<void> => {
    if (this.#state.phase === 'connecting' || this.#state.phase === 'connected') return
    this.#resumeAttempted = true
    const gateway = normalizeGatewayUrl(this.#state.providerUrl)
    const redirect = redirectUri()
    const mobile = window.matchMedia?.('(pointer: coarse)').matches ?? false
    let preparingRedirect = false
    const prepareRedirect: typeof fetch = async (input, init) => {
      const response = await globalThis.fetch(input, init)
      // The redirect branch posts one pushed authorization request, then
      // navigates. Keep the reader usable if that request fails. On success
      // release Bookhand's OPFS handles before passing control back to the SDK.
      if (response.ok) {
        storePairingIntent(gateway, redirect, intent)
        preparingRedirect = true
        await beforeRedirect()
        window.addEventListener('pageshow', (event) => {
          if (event.persisted) window.location.reload()
        }, { once: true })
      }
      return response
    }
    const pairing = this.#start(gateway, tools, redirect, mobile ? prepareRedirect : undefined)
    try {
      saveAddress(gateway)
      const grant = await pairing.pair(mobile ? 'redirect' : 'popup')
      this.#accept(pairing, gateway, tools, grant.grantId)
    } catch (error) {
      if (error instanceof AcpPairingError && error.code === 'pairing_redirected') return
      clearPairingIntent()
      this.#reject(pairing, gateway, error)
      if (preparingRedirect) window.location.reload()
    } finally {
      this.#finish(pairing)
    }
  }

  finishAuthorization = (tools: readonly AgentToolDefinition[]): Promise<AiFeatureIntent> => {
    if (this.#callback) return this.#callback
    const pending = pendingPairingReturn()
    if (!pending) return Promise.reject(new Error('Approval has expired. Connect again.'))
    this.#callback = this.#check(pending.gateway, tools, pending.redirectUri, pending.callbackUrl)
      .then(() => pending.intent)
      .finally(() => {
        clearPairingIntent()
        this.#callback = undefined
      })
    return this.#callback
  }

  dismissPendingAuthorization = (): void => { clearPairingIntent() }

  disconnect = async (): Promise<void> => {
    const { providerUrl, phase } = this.#state
    if (phase !== 'connected' || !this.#approvedTools) return
    const pairing = createAcpPairing({
      gatewayUrl: providerUrl,
      tools: this.#approvedTools,
      redirectUri: redirectUri(),
    })
    this.#approvedTools = undefined
    // Cancel consumers before revoking the grant on the gateway.
    this.#set({ phase: 'connecting', providerUrl })
    try {
      await pairing.revoke()
      this.#set({ phase: 'disconnected', providerUrl })
    } catch {
      await pairing.clear().catch(() => undefined)
      this.#set({ phase: 'error', providerUrl, error: 'Disconnected here. To remove access, revoke Bookhand in the gateway.' })
    } finally {
      pairing.dispose()
    }
  }

  openSession = (tools: readonly AgentToolDefinition[], sessionId?: string) => {
    const state = this.#state
    if (state.phase !== 'connected') throw new Error('Connect to your gateway first.')
    return connectAgent({
      gatewayUrl: state.providerUrl,
      tools,
      ...(sessionId ? { sessionId } : {}),
      pairing: { mode: 'resume', redirectUri: redirectUri(), clientName: 'Bookhand' },
    }).then((provider) => {
      if (this.#state.generation !== state.generation) {
        provider.close()
        throw new Error('The gateway connection changed.')
      }
      return provider
    }).catch((error: unknown) => {
      const lostApproval = (error instanceof AgentConnectError && error.code === 'invalid_app_grant')
        || (error instanceof AcpPairingError && ['invalid_grant', 'expired', 'pairing_required'].includes(error.code))
      if (lostApproval && this.#state.generation === state.generation) {
        this.#approvedTools = undefined
        this.#set({ phase: 'error', providerUrl: state.providerUrl, error: 'Bookhand’s approval expired. Connect again.' })
      }
      throw error
    })
  }

  async #check(
    gateway: string, tools: readonly AgentToolDefinition[], redirect: string, callbackUrl?: string,
  ): Promise<void> {
    const pairing = this.#start(gateway, tools, redirect)
    try {
      const grant = await pairing.getGrant(callbackUrl)
      this.#accept(pairing, gateway, tools, grant.grantId)
    } catch (error) {
      if (!callbackUrl && error instanceof AcpPairingError && error.code === 'pairing_required') {
        this.#set({ phase: 'disconnected', providerUrl: gateway })
      } else {
        this.#reject(pairing, gateway, error)
      }
      throw error
    } finally {
      this.#finish(pairing)
    }
  }

  #start(gateway: string, tools: readonly AgentToolDefinition[], redirect: string, fetcher?: typeof fetch) {
    const pairing = createAcpPairing({
      gatewayUrl: gateway, tools, redirectUri: redirect, clientName: 'Bookhand', fetch: fetcher,
    })
    this.#pairing?.dispose()
    this.#pairing = pairing
    this.#set({ phase: 'connecting', providerUrl: gateway })
    return pairing
  }

  #accept(pairing: ReturnType<typeof createAcpPairing>, gateway: string, tools: readonly AgentToolDefinition[], grantId: string): void {
    if (this.#pairing !== pairing) throw new Error('Approval was replaced.')
    this.#approvedTools = tools
    this.#set({ phase: 'connected', providerUrl: gateway, generation: grantId })
  }

  #reject(pairing: ReturnType<typeof createAcpPairing>, gateway: string, error: unknown): void {
    if (this.#pairing !== pairing) return
    this.#set({ phase: 'error', providerUrl: gateway, error: pairingMessage(error) })
  }

  #finish(pairing: ReturnType<typeof createAcpPairing>): void {
    pairing.dispose()
    if (this.#pairing === pairing) this.#pairing = undefined
  }

  #set(state: AiConnectionSnapshot): void {
    this.#state = state
    for (const notify of this.#listeners) notify()
  }
}

function pairingMessage(error: unknown): string {
  if (error instanceof AcpPairingError) {
    switch (error.code) {
      case 'denied': return 'The gateway did not approve Bookhand.'
      case 'popup_blocked': return 'Allow the approval window and try again.'
      case 'cancelled': return 'The approval window was closed.'
      case 'expired':
      case 'callback_invalid': return 'Approval expired or could not be verified. Connect again.'
    }
  }
  return 'Could not connect to the gateway. Check the address and try again.'
}

function redirectUri(): string {
  return location.origin + location.pathname
}

export function normalizeGatewayUrl(value: string): string {
  const text = value.trim()
  try {
    if (!text) throw new Error()
    const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(text) ? text : `https://${text}`)
    const loopback = ['localhost', '127.0.0.1'].includes(url.hostname)
    if ((url.protocol === 'https:' || (url.protocol === 'http:' && loopback))
      && url.href === `${url.origin}/`) return url.origin
  } catch { /* Use a message that does not echo the submitted address. */ }
  throw new TypeError('Enter an HTTPS gateway address without a path or credentials. For local development, use localhost or 127.0.0.1.')
}

function loadAddress(): string {
  try { return normalizeGatewayUrl(window.localStorage.getItem(ADDRESS_KEY) ?? '') } catch { return '' }
}

function saveAddress(address: string): void {
  try { window.localStorage.setItem(ADDRESS_KEY, address) } catch { /* optional preference */ }
}
