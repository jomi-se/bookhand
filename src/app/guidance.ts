import type { BookTarget, Passage, ReaderAdapter, ReaderLocation } from '../domain/reader.ts'
import type { StudyBoardView } from '../domain/study.ts'

export interface GuidanceView {
  readonly state: 'absent' | 'guiding' | 'yielded'
  readonly canBack: boolean
  readonly revision: number
}

export interface GuidanceSurfaceSnapshot {
  readonly panel: unknown
  readonly boardView?: StudyBoardView
  readonly focusTarget?: HTMLElement
}

export interface GuidanceRequest {
  readonly requestId: number
  readonly focusEpoch: number
  readonly bookId: string
  readonly adapter: ReaderAdapter
}

interface GuidanceBinding {
  readonly bookId: string
  readonly adapter: ReaderAdapter
  readonly currentLocation: () => ReaderLocation | undefined
  readonly acceptLocation: (location: ReaderLocation) => void
  readonly persistLocation: (location: ReaderLocation) => Promise<void>
  readonly captureSurface: () => GuidanceSurfaceSnapshot
  readonly revealReadingSurface: () => void
  readonly restoreSurface: (
    snapshot: GuidanceSurfaceSnapshot,
    isCurrent: () => boolean,
  ) => void | Promise<void>
}

interface GuidanceSession {
  readonly bookId: string
  readonly adapter: ReaderAdapter
  readonly origin: ReaderLocation
  readonly surface: GuidanceSurfaceSnapshot
  readonly target: Passage
  readonly message?: string
  readonly status: 'guiding' | 'yielded'
}

interface IssuedMove {
  readonly id: number
  readonly generation: number
  readonly adapter: ReaderAdapter
  readonly target: BookTarget
  readonly releaseAnchorOnMatch?: boolean
}

interface FocusRequestState {
  readonly request: GuidanceRequest
  status: 'pending' | 'valid' | 'rejected'
}

export interface FocusPassageResult {
  readonly outcome: 'applied' | 'superseded' | 'unavailable'
  readonly guidance: GuidanceView
}

export interface GuidanceBackResult {
  readonly outcome: 'restored' | 'no_back_target' | 'unresolvable'
  readonly guidance: GuidanceView
}

export interface GuidanceStopResult {
  readonly outcome: 'cleared'
  readonly wasActive: boolean
  readonly guidance: GuidanceView
}

type Listener = (view: GuidanceView) => void

/**
 * Runtime-only authority for deliberate reader movement and tutor guidance.
 *
 * The generation deliberately outlives individual sessions. Any continuation
 * that crossed an await must still own the same generation, book, and adapter
 * before it can publish state. A retired move that finishes late reasserts the
 * newest target instead of letting renderer timing decide what is authoritative.
 */
export class GuidanceController {
  #generation = 0
  #binding?: GuidanceBinding
  #ready = false
  #session?: GuidanceSession
  #pendingAnchor?: ReaderLocation
  #pendingSurface?: GuidanceSurfaceSnapshot
  #learnerIntentPending = false
  #authoritativeTarget?: BookTarget
  #reassertPromise?: Promise<void>
  #reassertAgain = false
  #notice?: string
  #requestSequence = 0
  #latestFocusRequest = 0
  #focusEpoch = 0
  readonly #focusRequests = new Map<number, FocusRequestState>()
  readonly #focusWaiters = new Set<() => void>()
  readonly #issuedMoves: IssuedMove[] = []
  #moveSequence = 0
  readonly #listeners = new Set<Listener>()

  get view(): GuidanceView {
    return {
      state: this.#session?.status ?? 'absent',
      canBack: Boolean(this.#session?.origin),
      revision: this.#generation,
    }
  }

  get message(): string | undefined {
    return this.#session?.message
  }

  get notice(): string | undefined {
    return this.#notice
  }

  subscribe(listener: Listener): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  bind(binding: GuidanceBinding): () => void {
    this.#retireFocusRequests()
    this.#invalidate()
    this.#binding = binding
    this.#ready = false
    this.#notice = undefined
    this.#clearSession(false)
    return () => this.unbind(binding.adapter)
  }

  markReady(adapter: ReaderAdapter): void {
    if (this.#binding?.adapter !== adapter) return
    this.#ready = true
    const location = this.#binding.currentLocation()
    if (location) this.#authoritativeTarget = { kind: 'cfi', cfi: location.cfi }
  }

  unbind(adapter: ReaderAdapter): void {
    if (this.#binding?.adapter !== adapter) return
    const accepted = this.#pendingAnchor ?? (
      this.#session?.status === 'guiding'
        ? this.#session.origin
        : this.#binding.currentLocation()
    )
    if (accepted) this.#binding.acceptLocation(accepted)
    this.#retireFocusRequests()
    this.#invalidate()
    this.#ready = false
    this.#notice = undefined
    this.#clearSession(false)
    this.#binding = undefined
    this.#authoritativeTarget = undefined
    for (let index = this.#issuedMoves.length - 1; index >= 0; index -= 1) {
      if (this.#issuedMoves[index]?.adapter === adapter) this.#issuedMoves.splice(index, 1)
    }
  }

  persistenceLocation(visible: ReaderLocation): ReaderLocation {
    return structuredClone(this.#session?.status === 'guiding'
      ? this.#session.origin
      : this.#pendingAnchor ?? visible)
  }

  captureFocusRequest(bookId: string): GuidanceRequest | undefined {
    const binding = this.#binding
    if (!binding || !this.#ready || binding.bookId !== bookId) return undefined
    const requestId = ++this.#requestSequence
    const request = { requestId, focusEpoch: this.#focusEpoch, bookId, adapter: binding.adapter }
    this.#focusRequests.set(requestId, { request, status: 'pending' })
    return request
  }

  rejectFocusRequest(request: GuidanceRequest): void {
    const state = this.#focusRequests.get(request.requestId)
    if (!state || state.request !== request) return
    state.status = 'rejected'
    this.#wakeFocusRequests()
  }

  observeLocation(location: ReaderLocation, navigationId?: number): boolean {
    const adapter = this.#binding?.adapter
    const moveIndex = adapter && navigationId !== undefined
      ? this.#issuedMoves.findIndex((move) =>
          move.adapter === adapter && move.id === navigationId)
      : -1
    if (moveIndex >= 0) {
      const [move] = this.#issuedMoves.splice(moveIndex, 1)
      if (move && move.generation !== this.#generation) {
        void this.#reassert()
        return false
      }
      if (move?.releaseAnchorOnMatch) {
        this.#pendingAnchor = undefined
        this.#binding?.acceptLocation(location)
        this.#authoritativeTarget = { kind: 'cfi', cfi: location.cfi }
        return true
      }
    }
    if (this.#learnerIntentPending) {
      this.#learnerIntentPending = false
      this.#pendingAnchor = undefined
      this.#binding?.acceptLocation(location)
      this.#authoritativeTarget = { kind: 'cfi', cfi: location.cfi }
      return true
    }
    if (this.#pendingAnchor || this.#session?.status === 'guiding') return true
    this.#authoritativeTarget = { kind: 'cfi', cfi: location.cfi }
    return true
  }

  /** Captured before Foliate handles a swipe or an in-book link. */
  noteLearnerIntent(): void {
    const binding = this.#binding
    if (!binding) return
    this.#retireFocusRequests()
    this.#invalidate()
    this.#pendingAnchor ??= this.#session?.status === 'guiding'
      ? this.#session.origin
      : binding.currentLocation()
    this.#learnerIntentPending = true
    this.#authoritativeTarget = undefined
    this.#notice = undefined
    binding.adapter.setTutorTarget?.(null)
    if (this.#session) this.#session = { ...this.#session, status: 'yielded' }
    this.#emit()
  }

  async navigateLearner(target: BookTarget): Promise<void> {
    this.noteLearnerIntent()
    await this.#navigate(target, this.#generation)
  }

  async navigateOrdinary(target: BookTarget): Promise<void> {
    const binding = this.#binding
    if (!binding) throw new Error('No reader surface is attached')
    this.#retireFocusRequests()
    this.#invalidate()
    binding.adapter.setTutorTarget?.(null)
    this.#clearSession(true)
    await this.#navigate(target, this.#generation)
  }

  async focus(
    passage: Passage,
    message?: string,
    request = this.captureFocusRequest(this.#binding?.bookId ?? ''),
  ): Promise<FocusPassageResult> {
    const binding = this.#binding
    if (!binding || !this.#ready) return { outcome: 'unavailable', guidance: this.view }
    const requestState = request ? this.#focusRequests.get(request.requestId) : undefined
    if (request && requestState && requestState.request === request) {
      requestState.status = 'valid'
      this.#wakeFocusRequests()
      await this.#awaitNewerFocusRequests(request)
    }
    if (
      !request ||
      requestState?.request !== request ||
      request.requestId < this.#latestFocusRequest ||
      request.focusEpoch !== this.#focusEpoch ||
      request.bookId !== binding.bookId ||
      request.adapter !== binding.adapter
    ) return { outcome: 'superseded', guidance: this.view }

    const newerValid = [...this.#focusRequests.values()].some((candidate) =>
      candidate.request.focusEpoch === request.focusEpoch &&
      candidate.request.requestId > request.requestId &&
      candidate.status === 'valid')
    if (newerValid) return { outcome: 'superseded', guidance: this.view }

    // Verification happens before this point. A malformed or stale request
    // therefore never gains authority merely by arriving after a valid one.
    this.#latestFocusRequest = request.requestId
    this.#discardFocusRequestsThrough(request.requestId)

    const generation = this.#invalidate()
    this.#notice = undefined
    binding.adapter.setTutorTarget?.(null)
    const previous = this.#session
    const preserveOrigin = previous?.status === 'guiding' && previous.bookId === binding.bookId
    const origin = preserveOrigin ? previous.origin : this.#pendingAnchor ?? binding.currentLocation()
    if (!origin) return { outcome: 'unavailable', guidance: this.view }
    const surface = preserveOrigin ? previous.surface : this.#pendingSurface ?? binding.captureSurface()
    this.#pendingAnchor = origin
    this.#pendingSurface = surface
    const target: BookTarget = { kind: 'cfi', cfi: passage.range.startCfi }
    this.#authoritativeTarget = target

    try {
      await this.#issueMove(binding, target, generation)
    } catch {
      if (this.#owns(generation, binding)) {
        this.#authoritativeTarget = { kind: 'cfi', cfi: origin.cfi }
        try {
          await this.#issueMove(binding, { kind: 'cfi', cfi: origin.cfi }, generation, true)
        } catch {
          // Keep the origin anchor through close/detach even if restoration is
          // also unavailable; no agent location is allowed to become durable.
        }
        if (this.#owns(generation, binding)) this.#pendingSurface = undefined
      }
      return {
        outcome: this.#owns(generation, binding) ? 'unavailable' : 'superseded',
        guidance: this.view,
      }
    }

    if (!this.#owns(generation, binding)) {
      await this.#reassert()
      return { outcome: 'superseded', guidance: this.view }
    }
    this.#pendingAnchor = undefined
    this.#pendingSurface = undefined
    this.#session = {
      bookId: binding.bookId,
      adapter: binding.adapter,
      origin: structuredClone(origin),
      surface,
      target: passage,
      ...(message ? { message } : {}),
      status: 'guiding',
    }
    binding.revealReadingSurface()
    binding.adapter.setTutorTarget?.(passage)
    this.#emit()
    return { outcome: 'applied', guidance: this.view }
  }

  async back(): Promise<GuidanceBackResult> {
    const binding = this.#binding
    const session = this.#session
    this.#retireFocusRequests()
    const generation = this.#invalidate()
    binding?.adapter.setTutorTarget?.(null)
    if (!binding || !session || binding.adapter !== session.adapter) {
      this.#clearSession(true)
      return { outcome: 'no_back_target', guidance: this.view }
    }

    const target: BookTarget = { kind: 'cfi', cfi: session.origin.cfi }
    this.#authoritativeTarget = target
    this.#pendingAnchor = session.origin
    try {
      await this.#issueMove(binding, target, generation)
    } catch {
      if (this.#owns(generation, binding)) {
        const current = binding.currentLocation()
        if (current) {
          try {
            await binding.persistLocation(current)
          } catch {
            // The exact control result and visible recovery notice must still
            // survive a storage outage. The next ordinary reader save retries.
          }
        }
        this.#pendingAnchor = undefined
        this.#pendingSurface = undefined
        this.#session = undefined
        this.#authoritativeTarget = current ? { kind: 'cfi', cfi: current.cfi } : undefined
        this.#notice = 'Bookhand could not return to the earlier passage. You remain here.'
        this.#emit()
      }
      return { outcome: 'unresolvable', guidance: this.view }
    }
    if (!this.#owns(generation, binding)) {
      await this.#reassert()
      return { outcome: 'no_back_target', guidance: this.view }
    }
    try {
      await binding.persistLocation(session.origin)
    } catch {
      // The origin was anchored throughout guidance and is already the durable
      // fallback. Returning there succeeded even if this fresh write did not.
      this.#notice = 'Returned to your earlier passage, but could not save it again yet.'
    }
    if (!this.#owns(generation, binding)) {
      await this.#reassert()
      return { outcome: 'no_back_target', guidance: this.view }
    }
    try {
      await binding.restoreSurface(session.surface, () => this.#owns(generation, binding))
    } catch {
      this.#notice = 'Returned to your earlier passage, but could not restore the prior workspace layout.'
    }
    if (!this.#owns(generation, binding)) {
      await this.#reassert()
      return { outcome: 'no_back_target', guidance: this.view }
    }
    this.#pendingAnchor = undefined
    this.#session = undefined
    this.#emit()
    return { outcome: 'restored', guidance: this.view }
  }

  async stop(): Promise<GuidanceStopResult> {
    const wasActive = Boolean(this.#session || this.#pendingAnchor)
    const binding = this.#binding
    const current = binding?.currentLocation()
    this.#retireFocusRequests()
    this.#invalidate()
    binding?.adapter.setTutorTarget?.(null)
    this.#notice = undefined
    this.#clearSession(true)
    if (binding && current) {
      try {
        await binding.persistLocation(current)
      } catch {
        this.#notice = 'Your current reading place could not be saved yet.'
        this.#emit()
      }
    }
    return { outcome: 'cleared', wasActive, guidance: this.view }
  }

  dismissNotice(): void {
    if (!this.#notice) return
    this.#notice = undefined
    this.#emit()
  }

  #clearSession(acceptCurrent: boolean): void {
    if (acceptCurrent && this.#binding) {
      const current = this.#binding.currentLocation()
      if (current) {
        this.#binding.acceptLocation(current)
        this.#authoritativeTarget = { kind: 'cfi', cfi: current.cfi }
      }
    }
    this.#session = undefined
    this.#pendingAnchor = undefined
    this.#pendingSurface = undefined
    this.#learnerIntentPending = false
    this.#emit()
  }

  async #navigate(target: BookTarget, generation: number): Promise<void> {
    const binding = this.#binding
    if (!binding) throw new Error('No reader surface is attached')
    this.#authoritativeTarget = target
    await this.#issueMove(binding, target, generation)
    if (!this.#owns(generation, binding)) {
      await this.#reassert()
      return
    }
  }

  async #reassert(): Promise<void> {
    if (this.#reassertPromise) {
      this.#reassertAgain = true
      return this.#reassertPromise
    }
    const operation = this.#runReassert()
    this.#reassertPromise = operation
    try {
      await operation
    } finally {
      if (this.#reassertPromise === operation) this.#reassertPromise = undefined
    }
  }

  async #runReassert(): Promise<void> {
    for (;;) {
      this.#reassertAgain = false
      const binding = this.#binding
      const target = this.#authoritativeTarget
      if (!binding || !target || !this.#ready) return
      // Relative moves are one-shot learner intent. Replaying one could turn
      // a single Next/Previous action into two page turns; its eventual
      // relocation will replace this with an exact CFI.
      if (target.kind === 'relative') return
      try {
        await this.#issueMove(binding, target, this.#generation)
      } catch {
        // The newest action remains authoritative even if the renderer can
        // no longer resolve it; a newer queued authority still gets a turn.
      }
      if (
        !this.#reassertAgain &&
        this.#binding === binding &&
        this.#sameTarget(this.#authoritativeTarget, target)
      ) return
    }
  }

  #sameTarget(left: BookTarget | undefined, right: BookTarget): boolean {
    if (!left || left.kind !== right.kind) return false
    if (left.kind === 'cfi' && right.kind === 'cfi') return left.cfi === right.cfi
    if (left.kind === 'href' && right.kind === 'href') return left.href === right.href
    if (left.kind === 'section' && right.kind === 'section') return left.sectionIndex === right.sectionIndex
    return left.kind === 'relative' && right.kind === 'relative' && left.direction === right.direction
  }

  #issueMove(
    binding: GuidanceBinding,
    target: BookTarget,
    generation: number,
    releaseAnchorOnMatch = false,
  ): Promise<void> {
    const id = ++this.#moveSequence
    this.#issuedMoves.push({
      id,
      generation,
      adapter: binding.adapter,
      target,
      ...(releaseAnchorOnMatch ? { releaseAnchorOnMatch: true } : {}),
    })
    return binding.adapter.navigate(target, id).catch((error) => {
      const index = this.#issuedMoves.findIndex((move) => move.id === id)
      if (index >= 0) this.#issuedMoves.splice(index, 1)
      throw error
    })
  }

  #owns(generation: number, binding: GuidanceBinding): boolean {
    return this.#generation === generation && this.#binding === binding && this.#binding.adapter === binding.adapter
  }

  #invalidate(): number {
    this.#generation += 1
    return this.#generation
  }

  #retireFocusRequests(): void {
    this.#focusEpoch += 1
    this.#latestFocusRequest = this.#requestSequence
    this.#focusRequests.clear()
    this.#wakeFocusRequests()
  }

  async #awaitNewerFocusRequests(request: GuidanceRequest): Promise<void> {
    while (
      request.focusEpoch === this.#focusEpoch &&
      [...this.#focusRequests.values()].some((candidate) =>
        candidate.request.focusEpoch === request.focusEpoch &&
        candidate.request.requestId > request.requestId &&
        candidate.status === 'pending')
    ) {
      await new Promise<void>((resolve) => this.#focusWaiters.add(resolve))
    }
  }

  #discardFocusRequestsThrough(requestId: number): void {
    for (const id of this.#focusRequests.keys()) {
      if (id <= requestId) this.#focusRequests.delete(id)
    }
  }

  #wakeFocusRequests(): void {
    const waiters = [...this.#focusWaiters]
    this.#focusWaiters.clear()
    for (const resolve of waiters) resolve()
  }

  #emit(): void {
    const view = this.view
    for (const listener of this.#listeners) listener(view)
  }
}
