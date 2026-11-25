import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { AiFeatureIntent } from '../../src/ai/pending-intent.ts'

const testState = vi.hoisted(() => ({
  pending: undefined as { intent: AiFeatureIntent } | undefined,
  dismissPending: vi.fn(),
}))

vi.mock('../../src/ai/pending-intent.ts', () => ({
  pendingPairingReturn: () => testState.pending,
}))

vi.mock('../../src/ai/connection-controller.ts', () => ({
  AiConnectionController: class {
    dismissPendingAuthorization = testState.dismissPending
  },
}))

vi.mock('../../src/app/runtime.ts', () => ({
  createAppRuntime: () => ({
    client: {},
    ports: {},
    reader: {},
    presentation: { visible: undefined },
    designState: { current: undefined, clear: vi.fn() },
    surface: {},
    guidance: {},
  }),
}))

vi.mock('../../src/library/useLibrary.ts', () => ({
  useLibrary: () => ({
    phase: 'ready',
    books: [],
    bootstrapping: false,
    importing: false,
    diagnostics: undefined,
    notice: undefined,
    refresh: vi.fn(async () => undefined),
    retry: vi.fn(async () => undefined),
    importFile: vi.fn(async () => undefined),
    dismissNotice: vi.fn(),
  }),
}))

vi.mock('../../src/webmcp/useWebMcpTools.ts', () => ({
  useWebMcpTools: () => ({ status: 'unsupported' }),
}))

vi.mock('../../src/library/LibraryScreen.tsx', () => ({
  LibraryScreen: (props: {
    readonly notice?: { readonly message: string }
    readonly onDismissNotice: () => void
  }) => props.notice ? (
    <div role="status">
      {props.notice.message}
      <button type="button" onClick={props.onDismissNotice}>Dismiss</button>
    </div>
  ) : <div>Library ready</div>,
}))

vi.mock('../../src/reader/ReaderScreen.tsx', () => ({
  ReaderScreen: () => <div>Reader</div>,
}))

import App from '../../src/App.tsx'

afterEach(() => {
  cleanup()
  testState.pending = undefined
  testState.dismissPending.mockReset()
})

describe('App AI return recovery', () => {
  it('keeps an owned Tutor draft visible when its intended book is missing', () => {
    testState.pending = {
      intent: { feature: 'tutor', bookId: 'missing-book', draft: 'Explain the retained source' },
    }
    render(<App />)

    expect(screen.getByRole('status')).toHaveTextContent('could not reopen the book')
    expect(screen.getByRole('status')).toHaveTextContent('Explain the retained source')
    expect(screen.queryByText('Reader')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(testState.dismissPending).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Library ready')).toBeInTheDocument()
  })

  it('does not invent a recovery state when there is no pending return', () => {
    testState.pending = undefined
    render(<App />)
    expect(screen.getByText('Library ready')).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
