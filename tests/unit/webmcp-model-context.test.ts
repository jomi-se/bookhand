import { afterEach, describe, expect, it } from 'vitest'

import { getModelContext, isWebMcpAvailable } from '../../src/webmcp/model-context'

const registerTool = async () => undefined

function install(host: Document | Navigator, value: unknown) {
  Object.defineProperty(host, 'modelContext', { configurable: true, value })
}

afterEach(() => {
  Reflect.deleteProperty(document, 'modelContext')
  Reflect.deleteProperty(navigator, 'modelContext')
})

describe('getModelContext', () => {
  it('reports no runtime when neither host exposes one', () => {
    expect(getModelContext()).toBeUndefined()
    expect(isWebMcpAvailable()).toBe(false)
  })

  it('prefers document.modelContext, the current WebMCP surface', () => {
    const documentContext = { registerTool }
    install(document, documentContext)
    install(navigator, { registerTool })

    expect(getModelContext()).toBe(documentContext)
  })

  it('falls back to navigator.modelContext for the older preview shape', () => {
    const navigatorContext = { registerTool }
    install(navigator, navigatorContext)

    expect(getModelContext()).toBe(navigatorContext)
    expect(isWebMcpAvailable()).toBe(true)
  })

  it('ignores a host whose modelContext cannot register tools', () => {
    install(document, { registerTool: 'not a function' })

    expect(getModelContext()).toBeUndefined()
  })
})
