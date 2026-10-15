import { useSyncExternalStore } from 'react'
import type { Artifact, Conversation, MarkingStyle, Memory, Message, Voice } from './model.ts'
import { SEED_ARTIFACTS, SEED_CONVERSATIONS, SEED_MEMORIES, SEED_VOICE } from './seed.ts'

/**
 * Prototype state. The real thing belongs in the book database (ADR 0012);
 * the prototype keeps it in this browser so it can be thrown away.
 */
export interface ProtoSettings {
  /** `mixed` lets each artifact pick its own marking. */
  readonly marking: 'mixed' | MarkingStyle
  readonly surface: 'sheet' | 'card'
}

interface Persisted {
  readonly version: 2
  readonly created: readonly Artifact[]
  readonly dismissed: readonly string[]
  readonly deleted: readonly string[]
  readonly memories: readonly Memory[]
  readonly voice: Voice
  readonly appended: Readonly<Record<string, readonly Message[]>>
  readonly extraConversations: readonly Conversation[]
  readonly settings: ProtoSettings
  readonly seen: readonly string[]
}

const KEY = 'bookhand-artifacts-prototype'

function fresh(): Persisted {
  return {
    version: 2,
    created: [],
    dismissed: [],
    deleted: [],
    memories: SEED_MEMORIES,
    voice: SEED_VOICE,
    appended: {},
    extraConversations: [],
    settings: { marking: 'mixed', surface: 'sheet' },
    seen: [],
  }
}

function load(): Persisted {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return fresh()
    const parsed = JSON.parse(raw) as Persisted
    return parsed.version === 2 ? { ...fresh(), ...parsed } : fresh()
  } catch {
    return fresh()
  }
}

let state = load()
const listeners = new Set<() => void>()

function commit(next: Persisted) {
  state = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // Private windows may refuse storage; the prototype still works in memory.
  }
  for (const listener of listeners) listener()
}

export function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useProto(): Persisted {
  return useSyncExternalStore(subscribe, () => state)
}

export function allArtifacts(s: Persisted = state): Artifact[] {
  const deleted = new Set(s.deleted)
  const created = s.created.filter((artifact) => !deleted.has(artifact.id))
  const createdIds = new Set(created.map((artifact) => artifact.id))
  return [...SEED_ARTIFACTS.filter((a) => !deleted.has(a.id) && !createdIds.has(a.id)), ...created]
}

export function allConversations(s: Persisted = state): Conversation[] {
  return [...SEED_CONVERSATIONS, ...s.extraConversations].map((conversation) => ({
    ...conversation,
    messages: [...conversation.messages, ...(s.appended[conversation.id] ?? [])],
  }))
}

export const proto = {
  get state() {
    return state
  },
  addArtifact(artifact: Artifact) {
    commit({
      ...state,
      created: [...state.created.filter((a) => a.id !== artifact.id), artifact],
      deleted: state.deleted.filter((id) => id !== artifact.id),
      dismissed: state.dismissed.filter((id) => id !== artifact.id),
    })
  },
  dismiss(id: string) {
    if (!state.dismissed.includes(id)) commit({ ...state, dismissed: [...state.dismissed, id] })
  },
  restore(id: string) {
    commit({ ...state, dismissed: state.dismissed.filter((d) => d !== id) })
  },
  remove(id: string) {
    commit({ ...state, deleted: [...state.deleted, id], dismissed: state.dismissed.filter((d) => d !== id) })
  },
  undelete(id: string) {
    commit({ ...state, deleted: state.deleted.filter((d) => d !== id) })
  },
  addMemory(memory: Memory) {
    commit({ ...state, memories: [memory, ...state.memories] })
  },
  editMemory(id: string, text: string) {
    commit({ ...state, memories: state.memories.map((m) => (m.id === id ? { ...m, text } : m)) })
  },
  removeMemory(id: string) {
    commit({ ...state, memories: state.memories.filter((m) => m.id !== id) })
  },
  setVoice(voice: Voice) {
    commit({ ...state, voice })
  },
  append(conversationId: string, message: Message) {
    const existing = state.appended[conversationId] ?? []
    commit({ ...state, appended: { ...state.appended, [conversationId]: [...existing, message] } })
  },
  replaceLast(conversationId: string, message: Message) {
    const existing = state.appended[conversationId] ?? []
    commit({
      ...state,
      appended: { ...state.appended, [conversationId]: [...existing.slice(0, -1), message] },
    })
  },
  updateMessage(conversationId: string, messageId: string, patch: Partial<Message>) {
    const existing = state.appended[conversationId] ?? []
    commit({
      ...state,
      appended: {
        ...state.appended,
        [conversationId]: existing.map((m) => (m.id === messageId ? { ...m, ...patch } : m)),
      },
    })
  },
  addConversation(conversation: Conversation) {
    commit({ ...state, extraConversations: [...state.extraConversations, conversation] })
  },
  setSettings(patch: Partial<ProtoSettings>) {
    commit({ ...state, settings: { ...state.settings, ...patch } })
  },
  markSeen(id: string) {
    if (!state.seen.includes(id)) commit({ ...state, seen: [...state.seen, id] })
  },
  reset() {
    commit(fresh())
  },
}
