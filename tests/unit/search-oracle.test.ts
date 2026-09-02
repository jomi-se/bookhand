import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import sqlite3InitModule, { type Database } from '@sqlite.org/sqlite-wasm'
import { afterEach, describe, expect, it } from 'vitest'

import type { IndexChunk } from '../../src/domain/search.ts'
import { buildSectionChunks } from '../../src/reader/chunking.ts'
import { makeBook } from '../../src/reader/foliate-module.ts'
import { passageFromAnchoredRange } from '../../src/reader/text.ts'
import { LibraryRepository } from '../../src/storage/library-repository.ts'
import { initializeSchema } from '../../src/storage/schema.ts'

const oracle = JSON.parse(await readFile('tests/fixtures/search/polish-oracle.json', 'utf8')) as {
  fixtures: Record<string, { path: string; sha256: string }>
  queries: {
    book: string
    query: string
    maxRank: number
    sourceHref: string
    sourceFragment: string
    sectionLabel: string
    mustContain: string
    mustContainMath?: string[]
    requiredCitationFields: string[]
  }[]
}

describe('frozen lexical search oracle', () => {
  let db: Database | undefined
  afterEach(() => db?.close())

  it('indexes the complete two-book corpora and preserves exact citations, ranking, and isolation', async () => {
    const sqlite = await sqlite3InitModule()
    db = new sqlite.oo1.DB(':memory:', 'c')
    initializeSchema(db)
    const repository = new LibraryRepository(db)
    const opened = new Map<string, Awaited<ReturnType<typeof makeBook>>>()
    try {
      // @ts-expect-error foliate-js does not publish declaration files
      const CFI = await import('foliate-js/epubcfi.js')
      for (const [name, fixture] of Object.entries(oracle.fixtures)) {
        const fileBytes = await readFile(fixture.path)
        const bytes = new Uint8Array(fileBytes)
        expect(createHash('sha256').update(bytes).digest('hex')).toBe(fixture.sha256)
        const id = fixture.sha256
        repository.importBook(id, {
          metadata: { title: name, authors: [] }, epubBytes: bytes,
          importedAt: '2026-09-02T00:00:00.000Z',
          provenance: { kind: 'imported', originalFileName: fixture.path },
        })
        const book = await makeBook(new File([bytes], fixture.path, { type: 'application/epub+zip' }))
        opened.set(name, book)
        const labels = tocLabels(book.toc ?? [])
        let state = repository.beginIndex(id, book.sections.length, '2026-09-02T00:00:00.000Z')
        const extractedSections = await Promise.all(book.sections.map(async (section, sectionIndex) => {
          const document = await section.createDocument!()
          const title = labels.get(section.id ?? '') ?? `Section ${sectionIndex + 1}`
          const chunks = buildSectionChunks(document, sectionIndex, title, (range) => CFI.joinIndir(section.cfi!, CFI.fromRange(range)))
          const validationDocument = await section.createDocument!()
          for (const chunk of chunks) {
            const start = (book.resolveCFI!(chunk.range.startCfi).anchor as (document: Document) => Range)(validationDocument)
            const end = (book.resolveCFI!(chunk.range.endCfi).anchor as (document: Document) => Range)(validationDocument)
            const range = validationDocument.createRange()
            range.setStart(start.startContainer, start.startOffset)
            range.setEnd(end.endContainer, end.endOffset)
            const resolved = passageFromAnchoredRange(range, sectionIndex, [title], () => chunk.range.startCfi)
            expect(resolved.range.textFingerprint, `${name}: section ${sectionIndex + 1}`).toBe(
              chunk.range.textFingerprint,
            )
            expect(resolved.text, `${name}: section ${sectionIndex + 1}`).toContain(chunk.text)
          }
          return { sectionIndex, chunks, document, href: section.id }
        }))
        for (let indexedSection = 0; indexedSection < extractedSections.length; indexedSection += 1) {
          const { sectionIndex, chunks } = extractedSections[indexedSection]!
          const indexed: IndexChunk[] = chunks.map((chunk, offset) => ({
            ...chunk, id: `chunk-${id}-${sectionIndex}-${offset}-${chunk.range.textFingerprint}`,
            bookId: id, globalOrder: state.cursor.globalOrder + offset,
          }))
          const next = { sectionIndex: sectionIndex + 1, sectionChunkIndex: 0, globalOrder: state.cursor.globalOrder + indexed.length }
          state = repository.commitIndexBatch(id, state.epoch, state.cursor, indexed, next, indexedSection + 1, '2026-09-02T00:00:00.000Z')
        }
        repository.completeIndex(id, state.epoch, '2026-09-02T00:00:00.000Z')

        for (const expected of oracle.queries.filter((query) => query.book === name)) {
          const source = extractedSections.find(({ href }) => href === expected.sourceHref)
          expect(source, `${name}: ${expected.sourceHref}`).toBeDefined()
          expect(source!.document.getElementById(expected.sourceFragment)).not.toBeNull()
        }
      }

      for (const expected of oracle.queries) {
        const fixture = oracle.fixtures[expected.book]!
        const result = repository.searchBook(fixture.sha256, expected.query, 10)
        expect(result.hits.every((hit) => hit.bookId === fixture.sha256)).toBe(true)
        const zeroBasedRank = result.hits.findIndex((candidate) =>
          candidate.text.includes(expected.mustContain),
        )
        expect(zeroBasedRank, `${expected.book}: ${expected.query}`).toBeGreaterThanOrEqual(0)
        expect(zeroBasedRank + 1, `${expected.book}: ${expected.query}`).toBeLessThanOrEqual(
          expected.maxRank,
        )
        const hit = result.hits[zeroBasedRank]!
        expect(hit.bookId).toBe(fixture.sha256)
        expect(hit.sectionTitle).toBe(expected.sectionLabel)
        expect(hit.text).toContain(expected.mustContain)
        for (const field of expected.requiredCitationFields) {
          expect(hit[field as keyof typeof hit], `${expected.query}: ${field}`).toBeDefined()
        }
        for (const math of expected.mustContainMath ?? []) expect(hit.text).toContain(math)
        expect(hit.text.length).toBeLessThanOrEqual(1_200)

        const book = opened.get(expected.book)!
        const fresh = await book.sections[hit.sectionIndex]!.createDocument!()
        const start = (book.resolveCFI!(hit.startCfi).anchor as (document: Document) => Range)(fresh)
        const end = (book.resolveCFI!(hit.endCfi).anchor as (document: Document) => Range)(fresh)
        const range = fresh.createRange()
        range.setStart(start.startContainer, start.startOffset)
        range.setEnd(end.endContainer, end.endOffset)
        const passage = passageFromAnchoredRange(range, hit.sectionIndex, [hit.sectionTitle], () => hit.startCfi)
        expect(passage.text).toContain(expected.mustContain)
        expect(passage.range.textFingerprint).toBe(hit.textFingerprint)
      }
    } finally {
      for (const book of opened.values()) book.destroy?.()
    }
  }, 300_000)
})

function tocLabels(items: readonly { href?: string; label?: unknown; subitems?: readonly unknown[] }[], labels = new Map<string, string>()) {
  for (const item of items) {
    if (item.href && typeof item.label === 'string') {
      const sectionHref = item.href.split('#')[0]!
      if (!labels.has(sectionHref)) labels.set(sectionHref, item.label)
    }
    if (item.subitems) tocLabels(item.subitems as never, labels)
  }
  return labels
}
