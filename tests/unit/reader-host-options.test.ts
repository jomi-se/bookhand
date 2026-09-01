import { describe, expect, it } from 'vitest'

import type { FoliateReaderAdapterOptions } from '../../src/reader/FoliateReaderAdapter.ts'
import { bindLatestOptions } from '../../src/reader/host-options.ts'
import type { ReaderLocation } from '../../src/domain/reader.ts'

const location: ReaderLocation = { cfi: 'fixture:0:0:0', sectionIndex: 0, fraction: 0 }

describe('reader host option binding', () => {
  it('delivers events to the latest options rather than the ones bound first', () => {
    const seen: string[] = []
    let current: FoliateReaderAdapterOptions = {
      onLocationChange: () => seen.push('first'),
    }
    const bound = bindLatestOptions(() => current)

    bound.onLocationChange?.(location)
    current = { onLocationChange: () => seen.push('second') }
    bound.onLocationChange?.(location)

    expect(seen).toEqual(['first', 'second'])
  })

  it('re-reads the clock, deadline, and fault hooks on every access', () => {
    let current: FoliateReaderAdapterOptions = { openDeadlineMs: 1_000 }
    const bound = bindLatestOptions(() => current)

    expect(bound.openDeadlineMs).toBe(1_000)
    expect(bound.faults).toBeUndefined()

    const faults = { beforeOpen: async () => undefined }
    current = { openDeadlineMs: 2_000, faults }
    expect(bound.openDeadlineMs).toBe(2_000)
    expect(bound.faults).toBe(faults)
  })

  it('stays safe when the caller supplies no options at all', () => {
    const bound = bindLatestOptions(() => undefined)

    expect(() => bound.onSelectionChange?.(null)).not.toThrow()
    expect(bound.clock).toBeUndefined()
  })
})
