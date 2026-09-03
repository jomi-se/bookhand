import { describe, expect, it } from 'vitest'

import {
  assertStorageWorkerRequest,
  assertStorageWorkerResponse,
} from '../../src/storage/protocol.ts'

const validBook = {
  metadata: { title: 'Tiny book', authors: [{ name: 'Ada Reader' }] },
  epubBytes: new Uint8Array([1, 2, 3]),
  importedAt: '2026-09-01T12:00:00.000Z',
  provenance: { kind: 'imported', originalFileName: 'tiny.epub' },
} as const

describe('storage worker protocol validation', () => {
  it('accepts the typed import request', () => {
    expect(() =>
      assertStorageWorkerRequest({
        requestId: 'request-1',
        type: 'import-book',
        book: validBook,
      }),
    ).not.toThrow()
  })

  it.each([
    null,
    { requestId: '', type: 'initialize' },
    { requestId: '1', type: 'unknown' },
    { requestId: '1', type: 'get-book', bookId: 42 },
    {
      requestId: '1',
      type: 'import-book',
      book: { ...validBook, epubBytes: [1, 2, 3] },
    },
    {
      requestId: '1',
      type: 'put-reading-state',
      state: { bookId: 'book-without-the-rest' },
    },
  ])('rejects malformed messages %#', (message) => {
    expect(() => assertStorageWorkerRequest(message)).toThrow(TypeError)
  })
})

describe('storage worker response validation', () => {
  it('accepts a complete diagnostics response', () => {
    expect(() =>
      assertStorageWorkerResponse({
        requestId: 'request-1',
        ok: true,
        result: {
          type: 'diagnostics',
          diagnostics: {
            mode: 'persistent',
            sqliteVersion: '3.53.0',
            vfsName: 'bookhand-opfs-sahpool',
            schemaVersion: 1,
            connectionOwner: 'dedicated-worker',
            bookCount: 0,
          },
        },
      }),
    ).not.toThrow()
  })

  it('rejects a response whose result only looks typed', () => {
    expect(() =>
      assertStorageWorkerResponse({
        requestId: 'request-1',
        ok: true,
        result: { type: 'diagnostics', diagnostics: { mode: 'persistent' } },
      }),
    ).toThrow(TypeError)
  })
})

describe('study lesson protocol boundary', () => {
  const experience = {
    id: 'lesson-1',
    boardId: 'board-1',
    origin: 'agent',
    actionGroupId: 'group-1',
    revision: 1,
    title: 'A real lesson',
    blocks: [{ id: 'idea', payload: { kind: 'prose', text: 'One idea.' } }],
    sortOrder: 0,
    createdAt: '2026-09-03T00:00:00.000Z',
    updatedAt: '2026-09-03T00:00:00.000Z',
  }
  const request = {
    requestId: 'request-lesson',
    type: 'commit-study-experience',
    experience,
    mutation: {
      origin: 'agent',
      bookId: 'book-1',
      actionToken: 'lesson-1',
      actionGroupId: 'group-1',
    },
  }

  it('accepts the lesson request and every lesson result shape', () => {
    expect(() => assertStorageWorkerRequest(request)).not.toThrow()
    for (const result of [
      { type: 'study-experience-committed', commit: { experience, replayed: false } },
      { type: 'study-experience-deleted', experienceId: experience.id },
      { type: 'study-experiences', experiences: [experience] },
    ]) {
      expect(() =>
        assertStorageWorkerResponse({ requestId: 'request-lesson', ok: true, result }),
      ).not.toThrow()
    }
  })

  it.each([
    { ...experience, title: '' },
    { ...experience, blocks: Array.from({ length: 13 }, (_, index) => ({ id: `b${index}`, payload: { kind: 'prose', text: 'x' } })) },
    { ...experience, blocks: [{ id: 'same', payload: { kind: 'prose', text: 'x' } }, { id: 'same', payload: { kind: 'question', prompt: 'x' } }] },
  ])('rejects an invalid lesson before it reaches SQLite', (invalid) => {
    expect(() => assertStorageWorkerRequest({ ...request, experience: invalid })).toThrow(TypeError)
  })
})

describe('the section rewrite boundary', () => {
  const version = { html: '<h2>Chapter III</h2>', at: 1_756_800_000_000 }

  it('accepts a save with the parts it models', () => {
    expect(() =>
      assertStorageWorkerRequest({
        requestId: 'request-1',
        type: 'append-section-rewrite',
        bookId: 'book-1',
        sectionIndex: 10,
        version: { ...version, css: '.a { color: red; }', summary: 'Rewrote it' },
      }),
    ).not.toThrow()
  })

  it('refuses markup larger than a section could plausibly be', () => {
    expect(() =>
      assertStorageWorkerRequest({
        requestId: 'request-1',
        type: 'append-section-rewrite',
        bookId: 'book-1',
        sectionIndex: 10,
        version: { ...version, html: 'x'.repeat(2_000_000) },
      }),
    ).toThrow(TypeError)
  })

  it('refuses a revision missing the markup it exists to carry', () => {
    expect(() =>
      assertStorageWorkerRequest({
        requestId: 'request-1',
        type: 'append-section-rewrite',
        bookId: 'book-1',
        sectionIndex: 10,
        version: { at: 1 },
      }),
    ).toThrow(TypeError)
  })

  it('refuses empty markup and impossible saved-history depths', () => {
    expect(() =>
      assertStorageWorkerRequest({
        requestId: 'request-1',
        type: 'append-section-rewrite',
        bookId: 'book-1',
        sectionIndex: 10,
        version: { html: '', at: 1 },
      }),
    ).toThrow(TypeError)
    expect(() =>
      assertStorageWorkerResponse({
        requestId: 'request-1',
        ok: true,
        result: { type: 'section-rewrite-written', sectionIndex: 10, versions: -1 },
      }),
    ).toThrow(TypeError)
  })

  it('refuses a timestamp the repository could not actually write', () => {
    // The repository stores this as `new Date(at).toISOString()`, which throws
    // outside ±8.64e15 ms. Accepting merely-finite numbers would move that
    // failure into the middle of a write, where it is a broken transaction
    // rather than a refused message.
    for (const at of [8.64e15 + 1, -8.64e15 - 1, Number.NaN, Infinity, 1.5, '1756800000000']) {
      expect(() =>
        assertStorageWorkerRequest({
          requestId: 'request-1',
          type: 'append-section-rewrite',
          bookId: 'book-1',
          sectionIndex: 10,
          version: { html: '<h2>x</h2>', at },
        }),
      ).toThrow(TypeError)
    }
  })

  it('accepts the boundary timestamps that are storable', () => {
    for (const at of [0, 8.64e15, -8.64e15, 1_756_800_000_000]) {
      expect(() =>
        assertStorageWorkerRequest({
          requestId: 'request-1',
          type: 'append-section-rewrite',
          bookId: 'book-1',
          sectionIndex: 10,
          version: { html: '<h2>x</h2>', at },
        }),
      ).not.toThrow()
    }
  })

  it('refuses a section index that is not one', () => {
    for (const sectionIndex of [-1, 1.5, '10', undefined]) {
      expect(() =>
        assertStorageWorkerRequest({
          requestId: 'request-1',
          type: 'undo-section-rewrite',
          bookId: 'book-1',
          sectionIndex,
        }),
      ).toThrow(TypeError)
    }
  })

  it('accepts the results the worker actually sends back', () => {
    // This is the shape that shipped broken once: a result the worker returns
    // and the client then refuses is a feature that fails only in a browser.
    expect(() =>
      assertStorageWorkerResponse({
        requestId: 'request-1',
        ok: true,
        result: { type: 'section-rewrite-written', sectionIndex: 10, versions: 2 },
      }),
    ).not.toThrow()
    expect(() =>
      assertStorageWorkerResponse({
        requestId: 'request-1',
        ok: true,
        result: { type: 'section-rewrites', rewrites: [{ sectionIndex: 10, versions: [version] }] },
      }),
    ).not.toThrow()
  })

  it('refuses saved rewrites that are not shaped like rewrites', () => {
    expect(() =>
      assertStorageWorkerResponse({
        requestId: 'request-1',
        ok: true,
        result: { type: 'section-rewrites', rewrites: [{ sectionIndex: 10, versions: [{ at: 1 }] }] },
      }),
    ).toThrow(TypeError)
  })
})
