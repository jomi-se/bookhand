import { describe, expect, it, vi } from 'vitest'

import { GuidanceController } from '../../src/app/guidance.ts'
import type {
  BookTarget,
  Passage,
  ReaderAdapter,
  ReaderLocation,
} from '../../src/domain/reader.ts'

function location(cfi: string, fraction = 0): ReaderLocation {
  return { cfi, sectionIndex: 0, fraction }
}

function passage(cfi: string, text: string): Passage {
  return {
    text,
    range: {
      startCfi: cfi,
      endCfi: `${cfi}-end`,
      sectionIndex: 0,
      textFingerprint: `fingerprint-${text}`,
    },
    chapterBreadcrumb: ['One'],
  }
}

function adapterHarness(initial = location('origin')) {
  let current = initial
  const waiters = new Map<string, {
    promise: Promise<void>
    resolve: () => void
    moveBeforeWait: boolean
    rejectAfterWait: boolean
  }>()
  const navigationIds = new Map<string, number>()
  const targetCfi = (target: BookTarget) =>
    target.kind === 'cfi' ? target.cfi : target.kind === 'section' ? `section-${target.sectionIndex}` : target.kind
  const adapter = {
    open: vi.fn(),
    close: vi.fn(),
    getToc: () => [],
    getLocation: () => structuredClone(current),
    getSelection: () => null,
    getVisibleContext: vi.fn(),
    getPassage: vi.fn(),
    listSections: () => [],
    getSectionSnapshot: vi.fn(),
    getSectionChunks: vi.fn(),
    navigate: vi.fn(async (target: BookTarget, navigationId?: number) => {
      const cfi = targetCfi(target)
      if (navigationId !== undefined) navigationIds.set(cfi, navigationId)
      const waiter = waiters.get(cfi)
      if (waiter?.moveBeforeWait) current = location(cfi, cfi === 'origin' ? 0 : 0.5)
      if (waiter) await waiter.promise
      if (waiter?.rejectAfterWait) throw new Error(`failed ${cfi}`)
      if (!waiter?.moveBeforeWait) current = location(cfi, cfi === 'origin' ? 0 : 0.5)
    }),
    applyStyle: vi.fn(),
    getStyle: vi.fn(),
    resetStyle: vi.fn(),
    renderAnnotations: vi.fn(),
  } as unknown as ReaderAdapter
  return {
    adapter,
    current: () => current,
    setCurrent: (next: ReaderLocation) => { current = next },
    navigationId: (cfi: string) => navigationIds.get(cfi),
    defer(cfi: string, moveBeforeWait = false, rejectAfterWait = false) {
      let resolve: () => void = () => undefined
      const promise = new Promise<void>((done) => { resolve = done })
      waiters.set(cfi, { promise, resolve, moveBeforeWait, rejectAfterWait })
      return () => { waiters.delete(cfi); resolve() }
    },
  }
}

function bind(controller: GuidanceController, harness = adapterHarness()) {
  let accepted: ReaderLocation | undefined
  let panel: unknown = 'search'
  const focusTarget = document.createElement('button')
  controller.bind({
    bookId: 'book-1',
    adapter: harness.adapter,
    currentLocation: harness.current,
    acceptLocation: (value) => { accepted = value },
    persistLocation: async (value) => { accepted = value },
    captureSurface: () => ({ panel, focusTarget }),
    revealReadingSurface: () => { panel = null },
    restoreSurface: (snapshot) => { panel = snapshot.panel },
  })
  controller.markReady(harness.adapter)
  return { harness, accepted: () => accepted, panel: () => panel }
}

describe('GuidanceController', () => {
  it('anchors persistence during guidance and Stop accepts the visible passage', async () => {
    const controller = new GuidanceController()
    const { harness, accepted } = bind(controller)

    await expect(controller.focus(passage('guided', 'Guided text'), 'Look here.')).resolves.toMatchObject({
      outcome: 'applied',
      guidance: { state: 'guiding', canBack: true },
    })
    expect(controller.persistenceLocation(harness.current()).cfi).toBe('origin')
    expect(controller.message).toBe('Look here.')

    await expect(controller.stop()).resolves.toMatchObject({ outcome: 'cleared', wasActive: true })
    expect(accepted()?.cfi).toBe('guided')
    expect(controller.persistenceLocation(harness.current()).cfi).toBe('guided')
    expect(controller.view.state).toBe('absent')
  })

  it('preserves one origin across tutor moves, then Back restores it and the surface', async () => {
    const controller = new GuidanceController()
    const { harness, accepted, panel } = bind(controller)
    await controller.focus(passage('first', 'First'))
    await controller.focus(passage('second', 'Second'))

    expect(controller.persistenceLocation(harness.current()).cfi).toBe('origin')
    await expect(controller.back()).resolves.toMatchObject({ outcome: 'restored' })
    expect(harness.current().cfi).toBe('origin')
    expect(accepted()?.cfi).toBe('origin')
    expect(panel()).toBe('search')
    expect(controller.view.state).toBe('absent')
  })

  it('yields before learner navigation and starts a later session from the takeover', async () => {
    const controller = new GuidanceController()
    const { harness } = bind(controller)
    await controller.focus(passage('guided', 'Guided'))
    await controller.navigateLearner({ kind: 'cfi', cfi: 'learner' })
    controller.observeLocation(harness.current())
    expect(controller.view).toMatchObject({ state: 'yielded', canBack: true })
    expect(controller.persistenceLocation(harness.current()).cfi).toBe('learner')

    await controller.focus(passage('new-guidance', 'New'))
    expect(controller.persistenceLocation(harness.current()).cfi).toBe('learner')
    await controller.back()
    expect(harness.current().cfi).toBe('learner')
  })

  it('keeps the origin anchored between learner intent and the first relocation', async () => {
    const controller = new GuidanceController()
    const { harness } = bind(controller)
    await controller.focus(passage('guided', 'Guided'))
    controller.noteLearnerIntent()
    expect(controller.persistenceLocation(harness.current()).cfi).toBe('origin')

    harness.setCurrent(location('learner'))
    controller.observeLocation(harness.current())
    expect(controller.persistenceLocation(harness.current()).cfi).toBe('learner')
  })

  it('rejects focus while restoring and keeps revision monotonic after idempotent controls', async () => {
    const controller = new GuidanceController()
    const harness = adapterHarness()
    controller.bind({
      bookId: 'book-1',
      adapter: harness.adapter,
      currentLocation: harness.current,
      acceptLocation: () => undefined,
      persistLocation: async () => undefined,
      captureSurface: () => ({ panel: null }),
      revealReadingSurface: () => undefined,
      restoreSurface: () => undefined,
    })
    const atBind = controller.view.revision
    await expect(controller.focus(passage('x', 'X'))).resolves.toMatchObject({ outcome: 'unavailable' })
    await controller.stop()
    const afterStop = controller.view.revision
    await controller.stop()
    expect(afterStop).toBeGreaterThan(atBind)
    expect(controller.view.revision).toBeGreaterThan(afterStop)
  })

  it('reasserts the newest target when a retired physical move completes last', async () => {
    const controller = new GuidanceController()
    const { harness } = bind(controller)
    const releaseOld = harness.defer('old')
    const old = controller.focus(passage('old', 'Old'))
    await Promise.resolve()
    const fresh = controller.focus(passage('fresh', 'Fresh'))
    await expect(fresh).resolves.toMatchObject({ outcome: 'applied' })
    expect(harness.current().cfi).toBe('fresh')

    releaseOld()
    await expect(old).resolves.toMatchObject({ outcome: 'superseded' })
    expect(harness.current().cfi).toBe('fresh')
    expect(harness.adapter.navigate).toHaveBeenLastCalledWith(
      { kind: 'cfi', cfi: 'fresh' },
      expect.any(Number),
    )
  })

  it('preserves the true origin when a newer focus starts after an unsettled move became visible', async () => {
    const controller = new GuidanceController()
    const { harness } = bind(controller)
    const releaseOld = harness.defer('old', true)
    const old = controller.focus(passage('old', 'Old'))
    await Promise.resolve()
    expect(harness.current().cfi).toBe('old')

    await expect(controller.focus(passage('fresh', 'Fresh'))).resolves.toMatchObject({ outcome: 'applied' })
    expect(controller.persistenceLocation(harness.current()).cfi).toBe('origin')
    releaseOld()
    await expect(old).resolves.toMatchObject({ outcome: 'superseded' })
    await controller.back()
    expect(harness.current().cfi).toBe('origin')
  })

  it('reasserts learner intent rather than a retired tutor target', async () => {
    const controller = new GuidanceController()
    const { harness } = bind(controller)
    const release = harness.defer('guided')
    const pending = controller.focus(passage('guided', 'Guided'))
    await Promise.resolve()
    controller.noteLearnerIntent()
    harness.setCurrent(location('learner'))
    controller.observeLocation(harness.current())
    harness.setCurrent(location('guided'))
    controller.observeLocation(harness.current(), harness.navigationId('guided'))
    await Promise.resolve()
    release()

    await expect(pending).resolves.toMatchObject({ outcome: 'superseded' })
    expect(harness.current().cfi).toBe('learner')
    expect(harness.adapter.navigate).toHaveBeenLastCalledWith(
      { kind: 'cfi', cfi: 'learner' },
      expect.any(Number),
    )
  })

  it('does not let a stale Back continuation clear newer guidance', async () => {
    const controller = new GuidanceController()
    const harness = adapterHarness()
    let finishRestore!: () => void
    const restoring = new Promise<void>((resolve) => { finishRestore = resolve })
    controller.bind({
      bookId: 'book-1',
      adapter: harness.adapter,
      currentLocation: harness.current,
      acceptLocation: () => undefined,
      persistLocation: async () => undefined,
      captureSurface: () => ({ panel: 'study', boardView: 'docked' }),
      revealReadingSurface: () => undefined,
      restoreSurface: () => restoring,
    })
    controller.markReady(harness.adapter)
    await controller.focus(passage('guided', 'Guided'))
    const back = controller.back()
    await Promise.resolve()
    await Promise.resolve()
    await controller.focus(passage('new-guidance', 'New guidance'))
    finishRestore()

    await expect(back).resolves.toMatchObject({ outcome: 'no_back_target' })
    expect(controller.view).toMatchObject({ state: 'guiding', canBack: true })
    expect(harness.current().cfi).toBe('new-guidance')
  })

  it('does not restore a stale surface after persistence yields to newer guidance', async () => {
    const controller = new GuidanceController()
    const harness = adapterHarness()
    let releasePersist!: () => void
    const persistBarrier = new Promise<void>((resolve) => { releasePersist = resolve })
    const restoreSurface = vi.fn()
    controller.bind({
      bookId: 'book-1',
      adapter: harness.adapter,
      currentLocation: harness.current,
      acceptLocation: () => undefined,
      persistLocation: async () => persistBarrier,
      captureSurface: () => ({ panel: 'study', boardView: 'docked' }),
      revealReadingSurface: () => undefined,
      restoreSurface,
    })
    controller.markReady(harness.adapter)
    await controller.focus(passage('guided', 'Guided'))
    const back = controller.back()
    await Promise.resolve()
    await controller.focus(passage('new-guidance', 'New guidance'))
    releasePersist()

    await expect(back).resolves.toMatchObject({ outcome: 'no_back_target' })
    expect(restoreSurface).not.toHaveBeenCalled()
    expect(controller.view.state).toBe('guiding')
  })

  it('reports a restored Back when navigation succeeds but fresh persistence fails', async () => {
    const controller = new GuidanceController()
    const harness = adapterHarness()
    controller.bind({
      bookId: 'book-1',
      adapter: harness.adapter,
      currentLocation: harness.current,
      acceptLocation: () => undefined,
      persistLocation: async () => { throw new Error('storage unavailable') },
      captureSurface: () => ({ panel: null }),
      revealReadingSurface: () => undefined,
      restoreSurface: () => undefined,
    })
    controller.markReady(harness.adapter)
    await controller.focus(passage('guided', 'Guided'))

    await expect(controller.back()).resolves.toMatchObject({ outcome: 'restored' })
    expect(controller.notice).toContain('could not save')
  })

  it('publishes a dismissible notice when Back cannot resolve', async () => {
    const controller = new GuidanceController()
    const { harness, accepted } = bind(controller)
    await controller.focus(passage('guided', 'Guided'))
    vi.mocked(harness.adapter.navigate).mockRejectedValueOnce(new Error('stale origin'))

    await expect(controller.back()).resolves.toMatchObject({ outcome: 'unresolvable' })
    expect(accepted()?.cfi).toBe('guided')
    expect(controller.notice).toContain('could not return')
    controller.dismissNotice()
    expect(controller.notice).toBeUndefined()
  })

  it('does not let an incidental guiding relocation replace the tutor authority', async () => {
    const controller = new GuidanceController()
    const { harness } = bind(controller)
    const release = harness.defer('retired')
    const retired = controller.focus(passage('retired', 'Retired'))
    await Promise.resolve()
    await controller.focus(passage('guided', 'Guided'))
    harness.setCurrent(location('reflow'))
    controller.observeLocation(harness.current())
    release()
    await retired
    expect(harness.current().cfi).toBe('guided')
  })

  it('invalidates an unsettled focus on detach without resurrecting a session', async () => {
    const controller = new GuidanceController()
    const { harness } = bind(controller)
    const release = harness.defer('late')
    const pending = controller.focus(passage('late', 'Late'))
    await Promise.resolve()
    controller.unbind(harness.adapter)
    release()
    await expect(pending).resolves.toMatchObject({ outcome: 'superseded' })
    expect(controller.view).toMatchObject({ state: 'absent', canBack: false })
  })

  it('releases a valid focus waiting behind a newer unresolved request on detach', async () => {
    const controller = new GuidanceController()
    const { harness } = bind(controller)
    const olderRequest = controller.captureFocusRequest('book-1')!
    controller.captureFocusRequest('book-1')
    const older = controller.focus(passage('older', 'Older'), undefined, olderRequest)
    await Promise.resolve()

    controller.unbind(harness.adapter)

    await expect(older).resolves.toMatchObject({ outcome: 'superseded' })
  })

  it('detaching an unsettled physical focus accepts its pending origin', async () => {
    const controller = new GuidanceController()
    const { harness, accepted } = bind(controller)
    const release = harness.defer('guided', true)
    const pending = controller.focus(passage('guided', 'Guided'))
    await Promise.resolve()
    controller.unbind(harness.adapter)
    expect(accepted()?.cfi).toBe('origin')
    release()
    await expect(pending).resolves.toMatchObject({ outcome: 'superseded' })
  })

  it('restores and keeps the origin durable when a focus moves before rejecting', async () => {
    const controller = new GuidanceController()
    const { harness, accepted } = bind(controller)
    const release = harness.defer('guided', true, true)
    const pending = controller.focus(passage('guided', 'Guided'))
    await Promise.resolve()
    controller.observeLocation(harness.current(), harness.navigationId('guided'))
    expect(controller.persistenceLocation(harness.current()).cfi).toBe('origin')
    release()

    await expect(pending).resolves.toMatchObject({ outcome: 'unavailable' })
    expect(harness.current().cfi).toBe('origin')
    controller.unbind(harness.adapter)
    expect(accepted()?.cfi).toBe('origin')
  })
})
