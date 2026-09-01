import { describe, expect, it, vi } from 'vitest'
import type { RuntimePorts } from '../../src/runtime/ports.ts'
import { createControlledRuntime } from '../support/controlled-runtime.ts'

const metadata = { title: 'Fixture book', authors: [] } as const
const diagnostics = {
  mode: 'persistent',
  sqliteVersion: 'fixture',
  vfsName: 'fixture',
  schemaVersion: 1,
} as const

function makeBasePorts(): RuntimePorts {
  return {
    persistence: { initialize: vi.fn().mockResolvedValue(diagnostics) },
    library: { listBooks: vi.fn().mockResolvedValue([]) },
    reader: {
      openBook: vi.fn().mockResolvedValue(metadata),
      loadSection: vi.fn().mockResolvedValue(undefined),
    },
  }
}

describe('controlled runtime', () => {
  it('injects OPFS, library, and section failures around the supplied ports', async () => {
    const base = makeBasePorts()
    const runtime = createControlledRuntime(base)

    runtime.controls.enable('force-opfs-initialization-failure')
    await expect(runtime.ports.persistence.initialize()).rejects.toThrow('Injected OPFS')
    runtime.controls.disable('force-opfs-initialization-failure')
    await expect(runtime.ports.persistence.initialize()).resolves.toBe(diagnostics)

    runtime.controls.enable('fail-library-list-immediately')
    await expect(runtime.ports.library.listBooks()).rejects.toThrow('Injected library-list')

    runtime.controls.enable('fail-section-load')
    await expect(runtime.ports.reader.loadSection(4)).rejects.toThrow(
      'Injected section-load',
    )
  })

  it('holds and releases a delayed stale open before invoking the real port', async () => {
    const base = makeBasePorts()
    const runtime = createControlledRuntime(base)
    runtime.controls.enable('delay-stale-open')

    const open = runtime.ports.reader.openBook(new Blob(['fixture']))
    await Promise.resolve()
    expect(base.reader.openBook).not.toHaveBeenCalled()

    runtime.controls.releaseStaleOpen()
    await expect(open).resolves.toBe(metadata)
    expect(base.reader.openBook).toHaveBeenCalledOnce()
  })

  it('leaves book-open and library-list operations unresolved', async () => {
    const runtime = createControlledRuntime(makeBasePorts())
    runtime.controls.enable('leave-book-open-unresolved')
    runtime.controls.enable('leave-library-list-unresolved')

    await expect(
      Promise.race([
        runtime.ports.reader.openBook(new Blob()),
        Promise.resolve('still-pending'),
      ]),
    ).resolves.toBe('still-pending')
    await expect(
      Promise.race([runtime.ports.library.listBooks(), Promise.resolve('still-pending')]),
    ).resolves.toBe('still-pending')
  })

  it('requires an enabled, explicitly supplied raw-state diagnostics port', async () => {
    const dumpRawState = vi.fn().mockResolvedValue({ tables: ['books'] })
    const runtime = createControlledRuntime(makeBasePorts(), { dumpRawState })

    await expect(runtime.controls.dumpRawState()).rejects.toThrow('disabled')
    runtime.controls.enable('dump-raw-state')
    await expect(runtime.controls.dumpRawState()).resolves.toEqual({ tables: ['books'] })
    expect(dumpRawState).toHaveBeenCalledOnce()
  })
})

