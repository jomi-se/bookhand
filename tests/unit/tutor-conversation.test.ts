import type { AcpChatTransport, AcpProvider } from '@open-agent-connect/web'
import { createAcpChatTransport } from '@open-agent-connect/web'
import type { UIMessageChunk } from 'ai'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TutorConversation } from '../../src/tutor/conversation.ts'
import { saveConversation } from '../../src/tutor/last-conversation.ts'

vi.mock('@open-agent-connect/web', async (load) => ({
  ...(await load<typeof import('@open-agent-connect/web')>()),
  createAcpChatTransport: vi.fn(),
}))

function response(text: string) {
  return new ReadableStream<UIMessageChunk>({
    start(controller) {
      controller.enqueue({ type: 'text-delta', id: 'answer', delta: text })
      controller.enqueue({ type: 'finish', finishReason: 'stop' })
      controller.close()
    },
  })
}

function fixture() {
  const sendMessages = vi.fn<AcpChatTransport['sendMessages']>().mockImplementation(async () => response('A worked example.'))
  const close = vi.fn()
  const openSession = vi.fn().mockResolvedValue({ close } as unknown as AcpProvider)
  vi.mocked(createAcpChatTransport).mockReturnValue({
    sendMessages, close: vi.fn(async () => {}), reconnectToStream: vi.fn(),
    sessionId: 'remote-session', error: undefined,
  })
  const conversation = new TutorConversation({
    bookId: 'book', tools: [],
    connection: {
      getSnapshot: () => ({ phase: 'connected', providerUrl: 'https://gateway.example', generation: 'grant' }),
      subscribe: () => () => undefined,
      openSession,
    },
  })
  return { conversation, sendMessages, openSession, close }
}

afterEach(() => {
  sessionStorage.clear()
  vi.resetAllMocks()
  vi.restoreAllMocks()
})

describe('Tutor conversation over ACP', () => {
  it('streams two explicit prompts on a single session without sending transcript history', async () => {
    const { conversation, sendMessages, openSession } = fixture()
    try {
      conversation.setDraft('Explain this theorem')
      expect(openSession).not.toHaveBeenCalled()
      await conversation.send()
      conversation.setDraft('Show another example')
      await conversation.send()
      expect(openSession).toHaveBeenCalledTimes(1)
      expect(sendMessages).toHaveBeenCalledTimes(2)
      const [first, second] = sendMessages.mock.calls.map(([request]) => request)
      expect(first!.chatId).toEqual(second!.chatId)
      expect(second!.messages).toHaveLength(1)
      expect(JSON.stringify(second!.messages)).toContain('Show another example')
      expect(JSON.stringify(second!.messages)).not.toContain('Explain this theorem')
      expect(conversation.getSnapshot().messages.map(({ text }) => text)).toEqual([
        'Explain this theorem', 'A worked example.', 'Show another example', 'A worked example.',
      ])
    } finally { conversation.dispose() }
  })

  it('keeps a draft if a restored session has ended and requires a fresh explicit send', async () => {
    const locks = { request: (_name: string, _options: unknown, callback: (lock: object) => Promise<void>) => callback({}) }
    vi.stubGlobal('navigator', Object.create(navigator, { locks: { value: locks } }))
    saveConversation('book', 'grant', {
      sessionId: 'old-session',
      messages: [{ id: 'old-reply', role: 'assistant', status: 'complete', text: 'Earlier reply' }],
    })
    const { conversation, sendMessages, openSession } = fixture()
    openSession.mockRejectedValueOnce(new Error('session expired'))
    try {
      conversation.restoreLastConversation()
      expect(openSession).not.toHaveBeenCalled()
      expect(conversation.getSnapshot().messages[0]?.text).toBe('Earlier reply')
      conversation.setDraft('My new question')
      await conversation.send()
      expect(openSession).toHaveBeenCalledWith([], 'old-session')
      expect(sendMessages).not.toHaveBeenCalled()
      expect(conversation.getSnapshot()).toMatchObject({ status: 'interrupted', draft: 'My new question' })
      conversation.newConversation()
      expect(sendMessages).not.toHaveBeenCalled()
      await conversation.send()
      expect(openSession).toHaveBeenLastCalledWith([], undefined)
      expect(JSON.stringify(sendMessages.mock.calls)).not.toContain('Earlier reply')
    } finally { conversation.dispose(); vi.unstubAllGlobals() }
  })

  it('stops an active response and never repeats the interrupted request', async () => {
    const { conversation, sendMessages, close } = fixture()
    let cancelled: AbortSignal | undefined
    sendMessages.mockImplementationOnce(async ({ abortSignal }) => {
      cancelled = abortSignal
      return new ReadableStream({
        start(controller) { abortSignal?.addEventListener('abort', () => controller.close(), { once: true }) },
      })
    })
    try {
      conversation.setDraft('Do it once')
      const work = conversation.send()
      await vi.waitFor(() => expect(sendMessages).toHaveBeenCalledTimes(1))
      conversation.stop()
      await work
      expect(cancelled?.aborted).toBe(true)
      expect(close).toHaveBeenCalled()
      expect(conversation.getSnapshot()).toMatchObject({ status: 'interrupted', canSend: false })
      expect(conversation.getSnapshot().messages.at(-1)?.status).toBe('interrupted')
      await conversation.send()
      expect(sendMessages).toHaveBeenCalledTimes(1)
    } finally { conversation.dispose() }
  })
})
