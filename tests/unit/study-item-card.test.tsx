// @vitest-environment jsdom

import { render, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { StudyItem } from '../../src/domain/index.ts'
import { StudyItemCard } from '../../src/study/StudyItemCard.tsx'

function equation(expression: string): StudyItem {
  return {
    id: 'equation-1',
    boardId: 'board-1',
    origin: 'agent',
    actionGroupId: 'lesson-1',
    revision: 1,
    payload: { kind: 'equation', expression, caption: 'The rate of change' },
    sortOrder: 0,
    createdAt: '2026-09-02T00:00:00.000Z',
    updatedAt: '2026-09-02T00:00:00.000Z',
  }
}

const actions = {
  onGoToSource: vi.fn(),
  onDelete: vi.fn(),
  onUndo: vi.fn(),
  onRetrySource: vi.fn(),
  onRelinkSource: vi.fn(),
  canRelinkSource: false,
}

describe('Study equation presentation', () => {
  it('renders supported TeX as native MathML rather than a raw code block', async () => {
    const view = render(<StudyItemCard item={equation('\\frac{dy}{dx}')} {...actions} />)

    await waitFor(() => expect(view.container.querySelector('math')).not.toBeNull())
    expect(view.container.querySelector('pre')).toBeNull()
    expect(view.getByText('The rate of change')).toBeVisible()
  })

  it('keeps unsupported notation visible as a bounded fallback', async () => {
    const view = render(<StudyItemCard item={equation('\\unknown{x}')} {...actions} />)

    await waitFor(() => {
      expect(view.container.querySelector('[data-fallback="true"]')).not.toBeNull()
    })
    expect(view.getByText('\\unknown{x}')).toBeVisible()
  })
})
