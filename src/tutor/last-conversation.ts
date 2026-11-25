import type { TutorMessage } from './conversation.ts'

const KEY = 'bookhand.tutor.acp.v1'
const MAX_MESSAGES = 80
const MAX_CHARS = 160_000

export interface LastConversation {
  readonly sessionId?: string
  readonly messages: readonly TutorMessage[]
}

function key(bookId: string, grantId: string): string {
  return `${KEY}:${encodeURIComponent(bookId)}:${encodeURIComponent(grantId)}`
}

export function readConversation(bookId: string, grantId: string): LastConversation | undefined {
  try {
    const raw = sessionStorage.getItem(key(bookId, grantId))
    if (!raw || raw.length > MAX_CHARS) return
    const value = JSON.parse(raw) as LastConversation
    if ((!value.sessionId || typeof value.sessionId === 'string')
      && Array.isArray(value.messages) && value.messages.length <= MAX_MESSAGES
      && value.messages.every((message) =>
        typeof message.id === 'string' && typeof message.text === 'string'
        && ['user', 'assistant'].includes(message.role)
        && ['complete', 'interrupted'].includes(message.status))) return value
  } catch { /* The tab can still tutor without a saved conversation. */ }
}

export function saveConversation(bookId: string, grantId: string, value: LastConversation): void {
  try {
    const keyForBook = key(bookId, grantId)
    const messages = value.messages.slice(-MAX_MESSAGES)
    let serialized = JSON.stringify({ ...value, messages })
    while (serialized.length > MAX_CHARS && messages.length > 1) {
      messages.shift()
      serialized = JSON.stringify({ ...value, messages })
    }
    if (serialized.length <= MAX_CHARS) sessionStorage.setItem(keyForBook, serialized)
    else sessionStorage.removeItem(keyForBook)
  } catch { /* Storage can be unavailable or full. */ }
}

export function clearConversation(bookId: string, grantId: string): void {
  try { sessionStorage.removeItem(key(bookId, grantId)) } catch { /* unavailable tab storage */ }
}
