export class ReaderClosedError extends Error {
  constructor() {
    super('The reader was closed before the operation completed')
    this.name = 'ReaderClosedError'
  }
}

export class ReaderNotOpenError extends Error {
  constructor() {
    super('No book is open')
    this.name = 'ReaderNotOpenError'
  }
}

export class ReaderNavigationError extends Error {
  readonly target: unknown

  constructor(target: unknown, cause?: unknown) {
    super(`Could not navigate to ${describeTarget(target)}`, { cause })
    this.name = 'ReaderNavigationError'
    this.target = target
  }
}

export class ReaderSectionLoadError extends Error {
  readonly sectionIndex: number
  readonly sectionLabel?: string

  constructor(sectionIndex: number, sectionLabel?: string, cause?: unknown) {
    const chapter = sectionLabel ? ` (${sectionLabel})` : ''
    super(`Could not load section ${sectionIndex}${chapter}`, { cause })
    this.name = 'ReaderSectionLoadError'
    this.sectionIndex = sectionIndex
    this.sectionLabel = sectionLabel
  }
}

function describeTarget(target: unknown): string {
  if (!target || typeof target !== 'object') return JSON.stringify(target)
  if ('kind' in target) {
    const value = 'cfi' in target ? target.cfi : 'href' in target ? target.href : 'sectionIndex' in target ? target.sectionIndex : 'direction' in target ? target.direction : ''
    return `${String(target.kind)} ${String(value)}`.trim()
  }
  return JSON.stringify(target)
}

