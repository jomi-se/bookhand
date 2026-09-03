import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { SearchPanel } from '../../src/reader/SearchPanel.tsx'

describe('SearchPanel', () => {
  it('moves focus into the replacement surface and keeps indexing controls operable', () => {
    const onCancelIndex = vi.fn()
    render(
      <SearchPanel
        indexState={{
          bookId: 'book-1',
          status: 'partial',
          epoch: 1,
          extractionVersion: 1,
          chunkVersion: 1,
          tokenizerVersion: 1,
          cursor: { sectionIndex: 12, sectionChunkIndex: 0, globalOrder: 40 },
          sectionsTotal: 36,
          sectionsIndexed: 12,
          committedChunks: 40,
          updatedAt: '2026-09-03T00:00:00.000Z',
        }}
        indexLoaded
        indexing
        onRetryIndex={vi.fn()}
        onCancelIndex={onCancelIndex}
        onSearch={vi.fn()}
        onActivate={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Search this book' })).toHaveFocus()
    fireEvent.click(screen.getByRole('button', { name: 'Pause indexing' }))
    expect(onCancelIndex).toHaveBeenCalledOnce()
  })
})
