import type { BookRange } from './reader.ts'
import { SOURCE_EXTRACTION_VERSION } from './source.ts'

export const SEARCH_QUERY_MAX_CHARACTERS = 300
export const SEARCH_QUERY_MAX_TOKENS = 32
export const SEARCH_LIMIT_MAX = 10
export const SEARCH_DEFAULT_LIMIT = 5
export const SEARCH_RESULT_MAX_CHARACTERS = 1_200
export const INDEX_BATCH_MAX = 250
export const INDEX_CHUNK_VERSION = 1
export const INDEX_TOKENIZER_VERSION = 1
export const INDEX_VERSION =
  SOURCE_EXTRACTION_VERSION * 1_000_000 + INDEX_CHUNK_VERSION * 1_000 + INDEX_TOKENIZER_VERSION

export type IndexStatus = 'not-started' | 'partial' | 'failed' | 'complete'
export type SearchAvailability = 'unavailable' | 'partial' | 'ready'

export interface SectionChunk {
  readonly sectionIndex: number
  readonly sectionTitle: string
  readonly sectionChunkIndex: number
  readonly text: string
  readonly range: BookRange
}

export interface IndexChunk extends SectionChunk {
  readonly id: string
  readonly bookId: string
  readonly globalOrder: number
}

export interface IndexCursor {
  readonly sectionIndex: number
  readonly sectionChunkIndex: number
  readonly globalOrder: number
}

export interface IndexState {
  readonly bookId: string
  readonly status: IndexStatus
  readonly epoch: number
  readonly extractionVersion: number
  readonly chunkVersion: number
  readonly tokenizerVersion: number
  readonly cursor: IndexCursor
  readonly sectionsIndexed: number
  readonly sectionsTotal: number
  readonly committedChunks: number
  readonly failure?: string
  readonly updatedAt: string
}

export interface SearchHit {
  readonly id: string
  readonly bookId: string
  readonly sectionIndex: number
  readonly sectionTitle: string
  readonly text: string
  readonly startCfi: string
  readonly endCfi: string
  readonly textFingerprint: string
}

export interface SearchResult {
  readonly query: string
  readonly availability: SearchAvailability
  readonly outcome: 'results' | 'no-results'
  readonly hits: readonly SearchHit[]
}

export function normalizeSearchQuery(value: string): { readonly query: string; readonly fts: string } {
  const query = value.trim()
  if (query.length < 1 || query.length > SEARCH_QUERY_MAX_CHARACTERS) {
    throw new Error(`Search needs between 1 and ${SEARCH_QUERY_MAX_CHARACTERS} characters.`)
  }
  const tokens = query.match(/[\p{L}\p{N}]+/gu)?.slice(0, SEARCH_QUERY_MAX_TOKENS) ?? []
  if (tokens.length === 0) throw new Error('Search needs at least one letter or number.')
  return {
    query,
    fts: tokens.map((token) => `"${token.replaceAll('"', '""')}"`).join(' OR '),
  }
}

export function searchAvailability(state: IndexState | null): SearchAvailability {
  if (!state) return 'unavailable'
  if (state.status === 'complete') return 'ready'
  return state.committedChunks > 0 ? 'partial' : 'unavailable'
}
