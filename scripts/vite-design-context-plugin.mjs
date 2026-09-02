/**
 * Shared by the app build and the unit-test runner so both see the same
 * guidance bytes. The browser cannot read `DESIGN.md`, and the runtime version
 * must not be a hand-written constant that can silently disagree with the
 * document, so the document is the only input here.
 */
import { resolve } from 'node:path'
import { readDesignContextSource } from './design-context-source.mjs'

const MODULE_ID = 'virtual:bookhand-design-context'
const RESOLVED_ID = `\0${MODULE_ID}`

export function designContextSource() {
  const designMarkdownPath = resolve('DESIGN.md')
  return {
    name: 'bookhand-design-context',
    resolveId(id) {
      if (id === MODULE_ID) return RESOLVED_ID
    },
    load(id) {
      if (id !== RESOLVED_ID) return
      this.addWatchFile(designMarkdownPath)
      const { block, version } = readDesignContextSource(designMarkdownPath)
      return [
        `export const CANONICAL_GUIDANCE = ${JSON.stringify(block)}`,
        `export const DESIGN_CONTEXT_VERSION = ${JSON.stringify(version)}`,
        '',
      ].join('\n')
    },
  }
}
