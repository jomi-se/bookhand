import type { FoliateReaderAdapterOptions } from './FoliateReaderAdapter.ts'

/**
 * The adapter is constructed once and outlives every later render, so it must
 * not close over the options object present at mount. This binds a stable
 * options object that re-reads the caller's latest options on each access.
 */
export function bindLatestOptions(
  latest: () => FoliateReaderAdapterOptions | undefined,
): FoliateReaderAdapterOptions {
  return {
    get clock() {
      return latest()?.clock
    },
    get openDeadlineMs() {
      return latest()?.openDeadlineMs
    },
    get faults() {
      return latest()?.faults
    },
    onLocationChange: (location) => latest()?.onLocationChange?.(location),
    onSelectionChange: (selection) => latest()?.onSelectionChange?.(selection),
    onSectionError: (error) => latest()?.onSectionError?.(error),
  }
}
