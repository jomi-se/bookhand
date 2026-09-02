import { expect, test, type Page } from '@playwright/test'

test.use({ launchOptions: { args: ['--enable-features=WebMCPTesting'] } })

interface RegisteredTool { readonly name: string }
interface RealModelContext {
  getTools(): Promise<RegisteredTool[]>
  executeTool(tool: RegisteredTool, args: string): Promise<string>
}

declare global {
  interface Document { modelContext?: RealModelContext }
}

const call = (page: Page, name: string, input: unknown = {}) => page.evaluate(
  async ([toolName, toolInput]) => {
    const context = document.modelContext
    if (!context) throw new Error('WebMCP is unavailable')
    const tool = (await context.getTools()).find((candidate) => candidate.name === toolName)
    if (!tool) throw new Error(`Missing tool ${toolName}`)
    return JSON.parse(await context.executeTool(tool, JSON.stringify(toolInput))) as {
      isError?: boolean
      content: { text: string }[]
      structuredContent: Record<string, unknown>
    }
  },
  [name, input] as const,
)

async function openChapter(page: Page) {
  await page.goto('/')
  await expect(page.locator('.book-open', { hasText: 'Calculus Made Easy' })).toBeVisible({ timeout: 20_000 })
  await page.locator('.book-open', { hasText: 'Calculus Made Easy' }).click()
  await page.getByRole('button', { name: 'Contents' }).click()
  await page.locator('.toc-item', { hasText: 'CHAPTER X.' }).first().click()
  await expect.poll(async () => {
    const result = await call(page, 'get_reading_context')
    return (result.structuredContent.readingContext as { visible?: { text?: string } })?.visible?.text?.length ?? 0
  }, { timeout: 20_000 }).toBeGreaterThan(200)
}

test('genuine guidance points, yields, returns, stops, and keeps durable marks isolated', async ({ page }) => {
  await openChapter(page)
  const originResult = await call(page, 'get_reading_context')
  const origin = originResult.structuredContent.readingContext as {
    bookId: string
    visible: { text: string; range: {
      startCfi: string
      endCfi: string
      sectionIndex: number
      textFingerprint: string
    } }
  }

  const highlighted = await call(page, 'save_annotation', {
    bookId: origin.bookId,
    range: origin.visible.range,
    quote: origin.visible.text,
    color: 'amber',
  })
  expect(highlighted.isError).toBeFalsy()

  await call(page, 'navigate_book', { direction: 'next' })
  const beforeFocus = await call(page, 'get_reading_context')
  const before = beforeFocus.structuredContent.readingContext as { sectionIndex: number; progressPercent: number }

  const focused = await call(page, 'focus_passage', {
    bookId: origin.bookId,
    sectionIndex: origin.visible.range.sectionIndex,
    startCfi: origin.visible.range.startCfi,
    endCfi: origin.visible.range.endCfi,
    textFingerprint: origin.visible.range.textFingerprint,
    quote: origin.visible.text,
    indicatorMessage: 'Notice how the argument turns from geometry into a limiting sum.',
    cue: { kind: 'outline' },
  })
  expect(focused.isError).toBeFalsy()
  expect(focused.structuredContent).toMatchObject({
    focus: { outcome: 'applied', guidance: { state: 'guiding', canBack: true } },
  })
  await expect(page.getByLabel('Tutor guidance')).toContainText('Notice how the argument turns')
  await expect(page.getByRole('button', { name: 'Back' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible()

  // Harness-only geometry: the transient sentinel and durable highlight share
  // a source without sharing ownership or a key.
  await expect.poll(async () => {
    const geometry = await page.evaluate(() => {
      const view = document.querySelector('foliate-view') as unknown as {
        renderer?: { getContents?: () => { overlayer?: { element?: Element } }[] }
      }
      const overlay = view?.renderer?.getContents?.()[0]?.overlayer?.element
      return {
        tutor: overlay?.querySelectorAll('[data-bookhand-tutor-cue="outline"]').length ?? 0,
        all: overlay?.querySelectorAll('rect').length ?? 0,
      }
    })
    return geometry.tutor > 0 && geometry.all > 0
  }).toBe(true)
  const geometry = await page.evaluate(() => {
    const view = document.querySelector('foliate-view') as unknown as {
      renderer?: { getContents?: () => { overlayer?: { element?: Element } }[] }
    }
    const overlay = view?.renderer?.getContents?.()[0]?.overlayer?.element
    return {
      tutor: overlay?.querySelectorAll('[data-bookhand-tutor-cue="outline"]').length ?? 0,
      all: overlay?.querySelectorAll('rect').length ?? 0,
    }
  })
  expect(geometry.tutor).toBeGreaterThan(0)
  expect(geometry.all).toBeGreaterThan(0)

  // All three public cue styles use the same verified target and replace only
  // the transient tutor layer. This is a genuine WebMCP call, not a harness
  // shortcut into Foliate.
  for (const kind of ['highlight', 'underline'] as const) {
    const changedCue = await call(page, 'focus_passage', {
      bookId: origin.bookId,
      sectionIndex: origin.visible.range.sectionIndex,
      startCfi: origin.visible.range.startCfi,
      endCfi: origin.visible.range.endCfi,
      textFingerprint: origin.visible.range.textFingerprint,
      quote: origin.visible.text,
      cue: { kind },
    })
    expect(changedCue.structuredContent).toMatchObject({ focus: { outcome: 'applied' } })
    await expect.poll(() => page.evaluate((cueKind) => {
      const view = document.querySelector('foliate-view') as unknown as {
        renderer?: { getContents?: () => { overlayer?: { element?: Element } }[] }
      }
      const overlay = view?.renderer?.getContents?.()[0]?.overlayer?.element
      return overlay?.querySelectorAll(`[data-bookhand-tutor-cue="${cueKind}"]`).length ?? 0
    }, kind)).toBeGreaterThan(0)
  }

  // Panel replacement and receding chrome cannot take guidance controls away.
  await page.getByRole('button', { name: 'Search' }).click()
  await page.waitForTimeout(5_200)
  await expect(page.getByLabel('Tutor guidance')).toBeVisible()
  await page.getByRole('button', { name: 'Back' }).click()
  await expect(page.getByLabel('Tutor guidance')).toBeHidden()
  const restored = (await call(page, 'get_reading_context')).structuredContent.readingContext as {
    sectionIndex: number
    progressPercent: number
    guidance: { state: string }
  }
  expect(restored).toMatchObject({
    sectionIndex: before.sectionIndex,
    progressPercent: before.progressPercent,
    guidance: { state: 'absent' },
  })

  await call(page, 'focus_passage', {
    bookId: origin.bookId,
    sectionIndex: origin.visible.range.sectionIndex,
    startCfi: origin.visible.range.startCfi,
    endCfi: origin.visible.range.endCfi,
    textFingerprint: origin.visible.range.textFingerprint,
    quote: origin.visible.text,
  })
  const stopped = await call(page, 'control_guidance', { action: 'stop' })
  expect(stopped.structuredContent).toMatchObject({ control: { outcome: 'cleared', wasActive: true } })
  await expect(page.getByLabel('Tutor guidance')).toBeHidden()

  const afterStop = await page.evaluate(() => {
    const view = document.querySelector('foliate-view') as unknown as {
      renderer?: { getContents?: () => { overlayer?: { element?: Element } }[] }
    }
    const overlay = view?.renderer?.getContents?.()[0]?.overlayer?.element
    return {
      tutor: overlay?.querySelectorAll('[data-bookhand-tutor-cue]').length ?? 0,
      all: overlay?.querySelectorAll('rect').length ?? 0,
    }
  })
  expect(afterStop.tutor).toBe(0)
  expect(afterStop.all).toBeGreaterThan(0)
})

test('manual navigation yields guidance while preserving a quiet way back', async ({ page }) => {
  await openChapter(page)
  const grounded = (await call(page, 'get_reading_context')).structuredContent.readingContext as {
    bookId: string
    visible: { text: string; range: { sectionIndex: number; startCfi: string; endCfi: string; textFingerprint: string } }
  }
  await call(page, 'focus_passage', {
    bookId: grounded.bookId,
    sectionIndex: grounded.visible.range.sectionIndex,
    startCfi: grounded.visible.range.startCfi,
    endCfi: grounded.visible.range.endCfi,
    textFingerprint: grounded.visible.range.textFingerprint,
    quote: grounded.visible.text,
  })
  await page.getByRole('button', { name: 'Next page' }).click()
  await expect(page.getByLabel('Tutor guidance')).toContainText('You moved on')
  const context = (await call(page, 'get_reading_context')).structuredContent.readingContext as {
    guidance: { state: string; canBack: boolean }
  }
  expect(context.guidance).toMatchObject({ state: 'yielded', canBack: true })
})

test('active guidance reloads at the learner origin while keeping style changes', async ({ page }) => {
  await openChapter(page)
  const source = (await call(page, 'get_reading_context')).structuredContent.readingContext as {
    bookId: string
    visible: { text: string; range: { sectionIndex: number; startCfi: string; endCfi: string; textFingerprint: string } }
  }
  await call(page, 'navigate_book', { direction: 'next' })
  const origin = (await call(page, 'get_reading_context')).structuredContent.readingContext as {
    sectionIndex: number
    progressPercent: number
  }
  await call(page, 'focus_passage', {
    bookId: source.bookId,
    sectionIndex: source.visible.range.sectionIndex,
    startCfi: source.visible.range.startCfi,
    endCfi: source.visible.range.endCfi,
    textFingerprint: source.visible.range.textFingerprint,
    quote: source.visible.text,
  })
  const styled = await call(page, 'set_reading_style', { theme: 'dark' })
  expect(styled.isError).toBeFalsy()

  await page.reload()
  await expect(page.locator('.book-open', { hasText: 'Calculus Made Easy' })).toBeVisible({ timeout: 20_000 })
  await page.locator('.book-open', { hasText: 'Calculus Made Easy' }).click()
  await expect.poll(() => page.evaluate(async () => (await document.modelContext?.getTools())?.some((tool) => tool.name === 'get_reading_context') ?? false)).toBe(true)
  await expect.poll(async () => {
    const result = await call(page, 'get_reading_context')
    return (result.structuredContent.readingContext as { guidance?: { state?: string } } | undefined)?.guidance?.state
  }).toBe('absent')
  await expect(page.locator('.reader')).toHaveAttribute('data-reader-theme', 'dark')
  let restored: { sectionIndex?: number; progressPercent?: number } | undefined
  await expect.poll(async () => {
    restored = (await call(page, 'get_reading_context')).structuredContent.readingContext as {
      sectionIndex?: number
      progressPercent?: number
    } | undefined
    return restored?.sectionIndex
  }).toBe(origin.sectionIndex)
  expect(Math.abs((restored?.progressPercent ?? 0) - origin.progressPercent)).toBeLessThanOrEqual(1)
})

test.describe('compact guidance', () => {
  test.use({ viewport: { width: 412, height: 915 } })

  test('remains operable through panel replacement and narrow reflow', async ({ page }) => {
    await openChapter(page)
    const grounded = (await call(page, 'get_reading_context')).structuredContent.readingContext as { bookId: string }
    await expect.poll(async () => {
      const result = await call(page, 'search_book', { query: 'infinitesimal increment', limit: 1 })
      return ((result.structuredContent.search as { hits?: unknown[] } | undefined)?.hits?.length ?? 0) > 0
    }, { timeout: 20_000 }).toBe(true)
    const search = (await call(page, 'search_book', { query: 'infinitesimal increment', limit: 1 }))
      .structuredContent.search as {
        hits: { text: string; sectionIndex: number; startCfi: string; endCfi: string; textFingerprint: string }[]
      }
    const hit = search.hits[0]!
    const focused = await call(page, 'focus_passage', {
      bookId: grounded.bookId,
      sectionIndex: hit.sectionIndex,
      startCfi: hit.startCfi,
      endCfi: hit.endCfi,
      textFingerprint: hit.textFingerprint,
      quote: hit.text,
      indicatorMessage: 'This stays visible while another reader surface is open.',
    })
    expect(focused.structuredContent, focused.content.map((part) => part.text).join('\n')).toMatchObject({ focus: { outcome: 'applied' } })
    // Corpus indexing can take longer than the touch-first chrome idle delay.
    // Ordinary keyboard activity is the public way to recall those controls.
    await page.keyboard.press('Shift')
    await expect(page.locator('.reader')).toHaveAttribute('data-chrome', 'shown')
    await page.getByRole('button', { name: 'Search' }).click()
    const indicator = page.getByLabel('Tutor guidance')
    await expect(indicator).toBeVisible()
    await expect(indicator).toContainText('This stays visible')
    for (const name of ['Back', 'Stop']) {
      const box = await page.getByRole('button', { name }).boundingBox()
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
    }
    await page.getByRole('button', { name: 'Stop' }).click()
    await expect(indicator).toBeHidden()
  })
})
