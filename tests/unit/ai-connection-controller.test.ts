// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AcpPairingError, createAcpPairing } from '@open-agent-connect/web'
import { AiConnectionController, normalizeGatewayUrl } from '../../src/ai/connection-controller.ts'

vi.mock('@open-agent-connect/web', async (load) => ({
  ...(await load<typeof import('@open-agent-connect/web')>()),
  createAcpPairing: vi.fn(),
}))

afterEach(() => {
  window.localStorage?.clear()
  window.sessionStorage.clear()
  vi.resetAllMocks()
  vi.unstubAllGlobals()
})

const grant = { grantId: 'grant-1' }
const intent = { feature: 'tutor' as const, bookId: 'book', draft: 'Keep the question' }

function fixture() {
  const pairing = {
    pair: vi.fn(),
    getGrant: vi.fn(),
    revoke: vi.fn(),
    clear: vi.fn(),
    dispose: vi.fn(),
  }
  vi.mocked(createAcpPairing).mockReturnValue(pairing as unknown as ReturnType<typeof createAcpPairing>)
  const connection = new AiConnectionController()
  connection.setProviderUrl('gateway.example')
  return { connection, pairing }
}

describe('ACP gateway pairing', () => {
  it('accepts exact gateway origins and permits HTTP only on loopback', () => {
    expect(normalizeGatewayUrl(' gateway.example:4843 ')).toBe('https://gateway.example:4843')
    expect(normalizeGatewayUrl('http://127.0.0.1:8890')).toBe('http://127.0.0.1:8890')
    for (const url of ['http://gateway.example', 'https://user@gateway.example', 'https://gateway.example/path', 'https://gateway.example/?x=1']) {
      expect(() => normalizeGatewayUrl(url)).toThrow()
    }
  })

  it('opens the desktop approval in the click turn with the declared tools', async () => {
    const { connection, pairing } = fixture()
    pairing.pair.mockResolvedValue(grant)
    const flush = vi.fn(async () => {})
    const tools = [{ name: 'inspect', description: 'Inspect the open book', inputSchema: { type: 'object' } }]
    const approval = connection.authorize({ tools, intent, beforeRedirect: flush })
    expect(pairing.pair).toHaveBeenCalledWith('popup')
    expect(flush).not.toHaveBeenCalled()
    await approval
    expect(createAcpPairing).toHaveBeenCalledWith(expect.objectContaining({ gatewayUrl: 'https://gateway.example', tools }))
    expect(connection.getSnapshot()).toMatchObject({ phase: 'connected', generation: grant.grantId })
  })

  it('flushes and saves the draft only after the mobile approval request succeeds', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    const send = vi.fn().mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(new Response('', { status: 201 }))
    vi.stubGlobal('fetch', send)
    const { connection, pairing } = fixture()
    const flush = vi.fn(async () => {})
    pairing.pair.mockImplementation(async () => {
      const fetcher = vi.mocked(createAcpPairing).mock.calls.at(-1)![0].fetch!
      const response = await fetcher('https://gateway.example/agent-connect/oauth/par')
      if (!response.ok) throw new Error('unavailable')
      throw new AcpPairingError('pairing_redirected', 'leaving')
    })
    await connection.authorize({ tools: [], intent, beforeRedirect: flush })
    expect(flush).not.toHaveBeenCalled()
    expect(connection.getSnapshot().phase).toBe('error')
    await connection.authorize({ tools: [], intent, beforeRedirect: flush })
    expect(pairing.pair).toHaveBeenLastCalledWith('redirect')
    expect(flush).toHaveBeenCalledTimes(1)
    expect(Object.values(sessionStorage).join()).toContain(intent.draft)
  })

  it('closes the approval locally even if revocation on the gateway fails', async () => {
    const { connection, pairing } = fixture()
    pairing.pair.mockResolvedValue(grant)
    await connection.authorize({ tools: [], intent, beforeRedirect: async () => {} })
    pairing.revoke.mockRejectedValue(new Error('network failed with a sensitive detail'))
    pairing.clear.mockResolvedValue(undefined)
    const disconnected = connection.disconnect()
    expect(connection.getSnapshot().generation).toBeUndefined()
    await disconnected
    expect(pairing.clear).toHaveBeenCalledTimes(1)
    expect(connection.getSnapshot().error).toContain('revoke Bookhand in the gateway')
    expect(connection.getSnapshot().error).not.toContain('sensitive detail')
  })
})
