/**
 * The single extraction rule for the canonical browser-agent guidance block.
 *
 * `VAL-AGENT-DESIGN-CONTEXT` requires the runtime guidance version to be a
 * digest of the design source itself rather than a constant someone typed
 * beside it, so that editing the guidance without editing the version is a
 * detectable failure rather than a silent one. This module is the build-time
 * half of that: the Vite plugin reads `DESIGN.md` through it and freezes the
 * result into the bundle. The test that guards it deliberately re-implements
 * the extraction instead of importing this file, because a shared helper would
 * agree with itself no matter what the document said.
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

export const START_MARKER = '<!-- bookhand:agent-design-context:start -->'
export const END_MARKER = '<!-- bookhand:agent-design-context:end -->'

/**
 * Everything between the two marker lines, exclusive of both: from the first
 * byte of the line after the start marker to the last byte before the line the
 * end marker begins. The markers themselves never enter the digest, so moving
 * the block within the document does not change the version.
 */
export function extractCanonicalBlock(source) {
  const start = source.indexOf(START_MARKER)
  const end = source.indexOf(END_MARKER)
  if (start === -1) throw new Error(`DESIGN.md is missing ${START_MARKER}`)
  if (end === -1) throw new Error(`DESIGN.md is missing ${END_MARKER}`)
  if (end < start) throw new Error('The design-context end marker precedes its start marker')
  const firstContentByte = source.indexOf('\n', start + START_MARKER.length) + 1
  if (firstContentByte === 0 || firstContentByte > end) {
    throw new Error('The design-context block is empty')
  }
  return source.slice(firstContentByte, end)
}

export function digestCanonicalBlock(block) {
  const digest = createHash('sha256').update(Buffer.from(block, 'utf8')).digest('hex')
  return `sha256:${digest}`
}

export function readDesignContextSource(designMarkdownPath) {
  const block = extractCanonicalBlock(readFileSync(designMarkdownPath, 'utf8'))
  return { block, version: digestCanonicalBlock(block) }
}
