import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

import {
  DESIGN_CONTEXT_VERSION,
  DESIGN_CONTEXT_VERSION_PATTERN,
  DESIGN_SURFACES,
  GUIDANCE_INVARIANTS,
  MAX_DESIGN_CONTEXT_UNITS,
  SURFACE_INVARIANT_KEYS,
  composeDesignContext,
  invariantsForSurface,
  parseGuidanceInvariants,
  summarizePresentation,
  type DesignContextState,
} from '../../src/webmcp/design-context.ts'
import { createDesignContextTool } from '../../src/webmcp/design-context-tool.ts'
import type { ReaderStyle } from '../../src/domain/index.ts'

/**
 * Deliberately re-implemented rather than imported from
 * `scripts/design-context-source.mjs`. The point of the contract is that the
 * shipped version is a digest of the design document, not a constant that
 * happens to sit beside it — and a shared helper would agree with itself no
 * matter what the document said.
 */
function independentlyDigestDesignBlock(markdown: string): string {
  const start = markdown.indexOf('<!-- bookhand:agent-design-context:start -->')
  const end = markdown.indexOf('<!-- bookhand:agent-design-context:end -->')
  const firstContentByte = markdown.indexOf('\n', start) + 1
  const block = markdown.slice(firstContentByte, end)
  const capabilities = JSON.parse(
    readFileSync(resolve('src/webmcp/capabilities.json'), 'utf8'),
  ) as unknown
  const stable = (value: unknown): string => {
    if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
    if (value !== null && typeof value === 'object') {
      const record = value as Record<string, unknown>
      return `{${Object.keys(record)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${stable(record[key])}`)
        .join(',')}}`
    }
    return JSON.stringify(value)
  }
  return `sha256:${createHash('sha256').update(`${block}\n${stable(capabilities)}`, 'utf8').digest('hex')}`
}

const designMarkdown = readFileSync(resolve('DESIGN.md'), 'utf8')

const STYLE: ReaderStyle = {
  fontSizePercent: 115,
  lineHeight: 1.6,
  measureCh: 62,
  paragraphSpacingEm: 0.8,
  theme: 'sepia',
}

const READING_STATE: DesignContextState = {
  activeSurface: 'reader',
  viewport: 'compact',
  coarsePointer: true,
  mutationTools: ['set_reading_style', 'upsert_study_item', 'set_study_board_view'],
  presentation: summarizePresentation(STYLE),
  boardView: 'docked',
}

const LIBRARY_STATE: DesignContextState = {
  activeSurface: 'library',
  viewport: 'wide',
  coarsePointer: false,
  mutationTools: [],
}

describe('design context version', () => {
  it('is a digest of the canonical DESIGN.md block, recomputed independently', () => {
    expect(DESIGN_CONTEXT_VERSION).toMatch(DESIGN_CONTEXT_VERSION_PATTERN)
    expect(DESIGN_CONTEXT_VERSION).toBe(independentlyDigestDesignBlock(designMarkdown))
  })

  it('changes when the guidance changes, so drift cannot hide behind a constant', () => {
    const edited = designMarkdown.replace(
      '- **Creative freedom:**',
      '- **Creative freedom (revised):**',
    )
    expect(edited).not.toBe(designMarkdown)
    expect(independentlyDigestDesignBlock(edited)).not.toBe(DESIGN_CONTEXT_VERSION)
  })

  it('changes when canonical capability truth changes', () => {
    const capabilitiesPath = resolve('src/webmcp/capabilities.json')
    const original = readFileSync(capabilitiesPath, 'utf8')
    const capabilities = JSON.parse(original) as { scopes: { applicationWorlds: boolean } }
    const edited = original.replace(
      `"applicationWorlds": ${String(capabilities.scopes.applicationWorlds)}`,
      `"applicationWorlds": ${String(!capabilities.scopes.applicationWorlds)}`,
    )
    const withCapabilities = designMarkdown.replace(
      '<!-- bookhand:agent-design-context:end -->',
      `<!-- bookhand:agent-design-context:end -->`,
    )
    const digest = (capabilityJson: string) => {
      const start = withCapabilities.indexOf('<!-- bookhand:agent-design-context:start -->')
      const end = withCapabilities.indexOf('<!-- bookhand:agent-design-context:end -->')
      const block = withCapabilities.slice(withCapabilities.indexOf('\n', start) + 1, end)
      const stable = (value: unknown): string => {
        if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
        if (value !== null && typeof value === 'object') {
          const record = value as Record<string, unknown>
          return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stable(record[key])}`).join(',')}}`
        }
        return JSON.stringify(value)
      }
      return createHash('sha256')
        .update(`${block}\n${stable(JSON.parse(capabilityJson))}`, 'utf8')
        .digest('hex')
    }
    expect(digest(edited)).not.toBe(digest(original))
  })

  it('excludes the marker lines themselves', () => {
    const composed = composeDesignContext('reader', READING_STATE)
    expect(composed).not.toContain('bookhand:agent-design-context')
  })
})

describe('guidance invariants', () => {
  it('parses every bullet in the canonical block', () => {
    expect(GUIDANCE_INVARIANTS.length).toBe(6)
    for (const invariant of GUIDANCE_INVARIANTS) {
      expect(invariant.body.length).toBeGreaterThan(40)
      expect(invariant.body).not.toContain('\n')
    }
  })

  it('resolves every key each surface asks for', () => {
    const keys = new Set(GUIDANCE_INVARIANTS.map((invariant) => invariant.key))
    for (const surface of DESIGN_SURFACES) {
      for (const key of SURFACE_INVARIANT_KEYS[surface]) expect(keys).toContain(key)
    }
  })

  it('selects four to six invariants per surface', () => {
    for (const surface of DESIGN_SURFACES) {
      const selected = invariantsForSurface(surface)
      expect(selected.length).toBeGreaterThanOrEqual(4)
      expect(selected.length).toBeLessThanOrEqual(6)
    }
  })

  it('falls back to the full set rather than under-answering when a key is renamed', () => {
    const renamed = parseGuidanceInvariants('- **Something else:** body text that is long enough.')
    expect(renamed).toHaveLength(1)
    expect(renamed[0]?.key).toBe('something-else')
  })
})

describe('composed response', () => {
  it('stays inside the size bound on every surface', () => {
    for (const surface of DESIGN_SURFACES) {
      for (const state of [READING_STATE, LIBRARY_STATE]) {
        const text = composeDesignContext(surface, state)
        expect(text.length).toBeLessThanOrEqual(MAX_DESIGN_CONTEXT_UNITS)
        expect(text.endsWith('…')).toBe(false)
      }
    }
  })

  it('reports the live surface state', () => {
    const text = composeDesignContext('reader', READING_STATE)
    expect(text).toContain(DESIGN_CONTEXT_VERSION)
    expect(text).toContain('Viewport: compact, coarse pointer')
    expect(text).toContain('sepia theme, 115% text')
    expect(text).toContain('measure 62ch')
    expect(text).toContain('Study board: docked')
    expect(text).toContain('set_reading_style, upsert_study_item, set_study_board_view')
  })

  it('says what is unavailable instead of inventing it', () => {
    const text = composeDesignContext('library', LIBRARY_STATE)
    expect(text).toContain('Reading presentation: unavailable — no book is open.')
    expect(text).toContain('Study board: unavailable — no book is open.')
    expect(text).toContain('Design-bearing tools registered now: none')
    expect(text).not.toMatch(/\bundefined\b|\bNaN\b|\bnull\b/)
  })

  it('names the requested surface even when another one is on screen', () => {
    const text = composeDesignContext('study', READING_STATE)
    expect(text).toContain('Requested surface: study (on screen: reader)')
    expect(text).toContain('Composition invariants for study:')
  })

  it('grants creative freedom rather than prescribing the shipped palette', () => {
    const text = composeDesignContext('study', READING_STATE)
    expect(text).toContain('Creative freedom')
    expect(text).toContain('may change')
    // The shipped accent is a reference implementation, not the answer.
    expect(text).not.toContain('#c24a2b')
    expect(text).not.toContain('terracotta')
  })

  it('distinguishes EPUB and Study scopes and is truthful about what is missing', () => {
    const text = composeDesignContext('reader', READING_STATE)
    expect(text).toContain('applies inside the EPUB document only')
    expect(text).toContain('Whole-application custom worlds')
    expect(text).toContain('NOT available yet')
  })

  it('advertises only reversal actions that exist today', () => {
    const text = composeDesignContext('reader', READING_STATE)
    expect(text).toContain('preview, apply, cancel, undo, reset')
    expect(text).toContain('return-to-source')
    expect(text).toContain('one item at a time')
    expect(text).toContain('raw tool history belongs in separate diagnostics')
  })

  it('never returns the person’s custom CSS, only that it is in force', () => {
    const withCss = composeDesignContext('reader', {
      ...READING_STATE,
      presentation: summarizePresentation({
        ...STYLE,
        customCss: 'body { color: rebeccapurple } /* SECRET-MARKER */',
      }),
    })
    expect(withCss).toContain('custom book CSS in force')
    expect(withCss).not.toContain('SECRET-MARKER')
    expect(withCss).not.toContain('rebeccapurple')
  })
})

describe('get_design_context tool', () => {
  const tool = (state: DesignContextState, report = vi.fn()) => ({
    definition: createDesignContextTool({ state: () => state, report }),
    report,
  })

  it('is read-only and describes itself as such', () => {
    const { definition } = tool(READING_STATE)
    expect(definition.name).toBe('get_design_context')
    expect(definition.description).toContain('changes nothing and stores nothing')
    expect(definition.inputSchema).toMatchObject({
      type: 'object',
      properties: { surface: { enum: ['library', 'reader', 'study'] } },
      additionalProperties: false,
    })
  })

  it('defaults to the surface that is on screen', async () => {
    const { definition } = tool(READING_STATE)
    const result = await definition.execute({})
    expect(result.content[0]?.text).toContain('Requested surface: reader (currently on screen)')
    expect(result.isError).toBeUndefined()
  })

  it('rejects an unknown surface because the runtime does not enforce the schema', async () => {
    const { definition } = tool(LIBRARY_STATE)
    const result = await definition.execute({ surface: 'dashboard' })
    expect(result.isError).toBe(true)
    expect(result.content[0]?.text).toContain('surface must be one of')
  })

  it('reports the read to diagnostics', async () => {
    const { definition, report } = tool(READING_STATE)
    await definition.execute({ surface: 'study' })
    expect(report).toHaveBeenCalledWith({
      name: 'get_design_context',
      summary: 'read design context for study',
    })
  })

  it('reports a failure to read live state instead of inventing one', async () => {
    const report = vi.fn()
    const definition = createDesignContextTool({
      state: () => {
        throw new Error('reader state unavailable')
      },
      report,
    })
    const result = await definition.execute({})
    expect(result.isError).toBe(true)
    expect(result.content[0]?.text).toBe('reader state unavailable')
    expect(report).toHaveBeenCalledWith({
      name: 'get_design_context',
      summary: 'reader state unavailable',
      failed: true,
    })
  })
})
