import { captureAcpPairingCallback } from '@open-agent-connect/web'
import type { ReaderSelection } from '../domain/reader.ts'

const PENDING_KEY = 'bookhand.acp.return.v1'

export interface AiFeatureIntent {
  readonly feature: 'tutor'
  readonly bookId: string
  readonly draft: string
  readonly attachment?: { readonly bookId: string; readonly selection: ReaderSelection }
}

interface PendingReturn {
  readonly gateway: string
  readonly redirectUri: string
  readonly expiresAt: number
  readonly intent: AiFeatureIntent
}

// Capture once before the reader renders. The SDK strips OAuth parameters and
// validates the callback against its own PKCE transaction before exchanging it.
let callbackUrl = captureAcpPairingCallback()
export const isPairingPopup = Boolean(callbackUrl && window.opener && !pendingPairingReturn())

export function storePairingIntent(gateway: string, redirectUri: string, intent: AiFeatureIntent): void {
  const pending: PendingReturn = { gateway, redirectUri, intent, expiresAt: Date.now() + 10 * 60_000 }
  sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending))
}

export function pendingPairingReturn(): (PendingReturn & { readonly callbackUrl: string }) | undefined {
  if (!callbackUrl) return undefined
  try {
    const pending: PendingReturn = JSON.parse(sessionStorage.getItem(PENDING_KEY) ?? 'null')
    if (pending?.expiresAt > Date.now() && pending.intent.feature === 'tutor'
      && typeof pending.intent.bookId === 'string' && typeof pending.intent.draft === 'string'
      && new URL(callbackUrl).searchParams.get('iss') === pending.gateway) {
      return { ...pending, callbackUrl }
    }
  } catch { /* Malformed or unavailable tab storage. */ }
  return undefined
}

export function clearPairingIntent(): void {
  callbackUrl = undefined
  try { sessionStorage.removeItem(PENDING_KEY) } catch { /* unavailable tab storage */ }
}
