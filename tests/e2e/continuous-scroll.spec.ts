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

async function openRelativity(page: Page) {
  await page.goto('/')
  const row = page.locator('.book-open', { hasText: 'Relativity' })
  await expect(row).toBeVisible({ timeout: 20_000 })
  await row.click()
  await expect(page.locator('foliate-view')).toBeVisible()
  await expect.poll(async () => (await rendererState(page)).frames, { timeout: 20_000 })
    .toBeGreaterThan(0)
}

async function openFlatland(page: Page) {
  await page.goto('/')
  const row = page.locator('.book-open', { hasText: 'Flatland' })
  await expect(row).toBeVisible({ timeout: 20_000 })
  await row.click()
  await expect(page.locator('foliate-view')).toBeVisible()
  await expect.poll(async () => (await rendererState(page)).frames, { timeout: 20_000 })
    .toBeGreaterThan(0)
}

async function rendererState(page: Page) {
  return page.evaluate(() => {
    const view = document.querySelector('foliate-view') as unknown as {
      renderer?: HTMLElement & { getContents?: () => { index: number }[] }
    }
    const renderer = view?.renderer
    const contents = renderer?.getContents?.() ?? []
    return {
      flow: renderer?.getAttribute('flow'),
      noPreload: renderer?.hasAttribute('no-preload'),
      noContinuous: renderer?.hasAttribute('no-continuous-scroll'),
      sections: contents.map(({ index }) => index),
      frames: renderer?.shadowRoot?.querySelectorAll('iframe').length ?? 0,
      primary: (view as unknown as { lastLocation?: { section?: { current?: number } } })
        ?.lastLocation?.section?.current,
    }
  })
}

async function chooseScroll(page: Page) {
  await page.getByRole('button', { name: 'Text settings' }).click()
  await page.getByRole('button', { name: 'Scroll', exact: true }).click()
  await page.getByRole('button', { name: 'Apply' }).click()
  await page.getByRole('button', { name: 'Close text settings' }).click()
  await expect.poll(async () => (await rendererState(page)).frames).toBeGreaterThan(1)
}

async function scrollToLoadedEdge(page: Page, edge: 'start' | 'end') {
  await page.evaluate((target) => {
    const view = document.querySelector('foliate-view') as unknown as {
      renderer?: HTMLElement
    }
    const container = view.renderer?.shadowRoot?.querySelector('#container') as HTMLElement | null
    if (!container) throw new Error('reader scroll container unavailable')
    container.scrollTop = target === 'end'
      ? container.scrollHeight - container.clientHeight
      : 0
    container.dispatchEvent(new Event('scroll'))
  }, edge)
  await page.waitForTimeout(650)
}

async function setPreloading(page: Page, enabled: boolean) {
  await page.evaluate((next) => {
    const view = document.querySelector('foliate-view') as unknown as {
      renderer?: HTMLElement
    }
    if (next) view.renderer?.removeAttribute('no-preload')
    else view.renderer?.setAttribute('no-preload', '')
  }, enabled)
}

async function visibleCenterText(page: Page) {
  return page.evaluate(() => {
    const view = document.querySelector('foliate-view') as unknown as {
      renderer?: { getContents?: () => { index: number; doc: Document }[] }
    }
    const host = document.querySelector('.reader-surface')?.getBoundingClientRect()
    if (!host) return { index: -1, text: '' }
    let visible = { index: -1, text: '', area: 0 }
    for (const { index, doc } of view.renderer?.getContents?.() ?? []) {
      const frame = doc.defaultView?.frameElement
      const rect = frame?.getBoundingClientRect()
      if (!rect) continue
      const width = Math.max(0, Math.min(rect.right, host.right) - Math.max(rect.left, host.left))
      const height = Math.max(0, Math.min(rect.bottom, host.bottom) - Math.max(rect.top, host.top))
      const area = width * height
      if (area <= visible.area) continue
      visible = {
        index,
        text: (doc.body?.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 240),
        area,
      }
    }
    return { index: visible.index, text: visible.text }
  })
}

async function readingContextText(page: Page) {
  return page.evaluate(async () => {
    const context = document.modelContext
    if (!context) throw new Error('WebMCP runtime unavailable')
    const tool = (await context.getTools()).find(({ name }) => name === 'get_reading_context')
    if (!tool) throw new Error('get_reading_context unavailable')
    const result = JSON.parse(await context.executeTool(tool, '{}')) as {
      structuredContent?: { readingContext?: { visible?: { text?: string } } }
    }
    return result.structuredContent?.readingContext?.visible?.text ?? ''
  })
}

async function callTool(page: Page, name: string, input: Record<string, unknown>) {
  return page.evaluate(async ([toolName, toolInput]) => {
    const context = document.modelContext
    if (!context) throw new Error('WebMCP runtime unavailable')
    const tool = (await context.getTools()).find((candidate) => candidate.name === toolName)
    if (!tool) throw new Error(`${toolName} unavailable`)
    return JSON.parse(await context.executeTool(tool, JSON.stringify(toolInput))) as {
      isError?: boolean
      structuredContent?: Record<string, unknown>
    }
  }, [name, input] as const)
}

test('the reader keeps a per-book Pages or Scroll choice', async ({ page }) => {
  await openRelativity(page)
  expect((await callTool(page, 'navigate_book', { sectionIndex: 10 })).isError).not.toBe(true)
  await expect.poll(async () => (await rendererState(page)).primary).toBe(10)
  const pagesState = await rendererState(page)
  expect(pagesState).toMatchObject({
    flow: null,
    noPreload: true,
    noContinuous: true,
    frames: 1,
  })

  await chooseScroll(page)
  expect(await rendererState(page)).toMatchObject({
    flow: 'scrolled',
    noPreload: false,
    noContinuous: false,
  })
  expect((await rendererState(page)).primary).toBe(pagesState.primary)

  await page.reload()
  const row = page.locator('.book-open', { hasText: 'Relativity' })
  await expect(row).toBeVisible({ timeout: 20_000 })
  await row.click()
  await expect(page.locator('foliate-view')).toBeVisible({ timeout: 20_000 })
  await expect.poll(async () => (await rendererState(page)).flow).toBe('scrolled')
  await expect.poll(async () => (await rendererState(page)).frames).toBeGreaterThan(1)
})

test('cancelling a Scroll preview restores the one-frame Pages reader', async ({ page }) => {
  await openRelativity(page)
  await page.getByRole('button', { name: 'Text settings' }).click()
  await page.getByRole('button', { name: 'Scroll', exact: true }).click()
  await expect.poll(async () => (await rendererState(page)).frames).toBeGreaterThan(1)

  await page.getByRole('button', { name: 'Cancel' }).click()
  await page.getByRole('button', { name: 'Close text settings' }).click()
  await expect.poll(async () => await rendererState(page)).toMatchObject({
    flow: null,
    noPreload: true,
    noContinuous: true,
    frames: 1,
  })
})

test('continuous scrolling keeps one bounded bidirectional section window', async ({ page }) => {
  await openRelativity(page)
  await chooseScroll(page)

  let furthest = (await rendererState(page)).primary ?? 0
  for (let step = 0; step < 12; step += 1) {
    await scrollToLoadedEdge(page, 'end')
    const state = await rendererState(page)
    expect(state.frames, `forward step ${step}: ${state.sections.join(',')}`).toBeLessThanOrEqual(8)
    expect(new Set(state.sections).size).toBe(state.sections.length)
    furthest = Math.max(furthest, state.primary ?? 0)
  }
  expect(furthest).toBeGreaterThanOrEqual(12)

  let nearest = furthest
  for (let step = 0; step < 12; step += 1) {
    await scrollToLoadedEdge(page, 'start')
    const state = await rendererState(page)
    expect(state.frames, `backward step ${step}: ${state.sections.join(',')}`).toBeLessThanOrEqual(8)
    expect(new Set(state.sections).size).toBe(state.sections.length)
    nearest = Math.min(nearest, state.primary ?? furthest)
  }
  expect(nearest).toBeLessThan(furthest)
})

test('evicting either side of the window keeps the visible words stationary', async ({ page }) => {
  await openRelativity(page)
  await chooseScroll(page)

  for (let step = 0; step < 8; step += 1) {
    await scrollToLoadedEdge(page, 'end')
    const state = await rendererState(page)
    if (state.frames === 8 && (state.sections[0] ?? 0) > 0) break
  }
  const primed = await rendererState(page)
  expect(primed.frames).toBe(8)
  expect(primed.sections[0]).toBeGreaterThan(0)

  await setPreloading(page, false)
  await scrollToLoadedEdge(page, 'end')
  const beforeForward = await visibleCenterText(page)
  const beforeForwardContext = await readingContextText(page)
  const forwardSections = (await rendererState(page)).sections.join(',')
  expect(beforeForward.text.length).toBeGreaterThan(20)
  expect(beforeForwardContext.length).toBeGreaterThan(20)
  await setPreloading(page, true)
  await scrollToLoadedEdge(page, 'end')
  await expect.poll(async () => (await rendererState(page)).sections.join(','))
    .not.toBe(forwardSections)
  expect(await visibleCenterText(page)).toEqual(beforeForward)
  expect(await readingContextText(page)).toBe(beforeForwardContext)

  await setPreloading(page, false)
  await scrollToLoadedEdge(page, 'start')
  const beforeBackward = await visibleCenterText(page)
  const beforeBackwardContext = await readingContextText(page)
  const backwardSections = (await rendererState(page)).sections.join(',')
  expect(beforeBackward.text.length).toBeGreaterThan(20)
  expect(beforeBackwardContext.length).toBeGreaterThan(20)
  await setPreloading(page, true)
  await scrollToLoadedEdge(page, 'start')
  await expect.poll(async () => (await rendererState(page)).sections.join(','))
    .not.toBe(backwardSections)
  expect(await visibleCenterText(page)).toEqual(beforeBackward)
  expect(await readingContextText(page)).toBe(beforeBackwardContext)
})

test('WebMCP grounds passages and annotations in the visible continuous section', async ({ page }) => {
  await openRelativity(page)
  await chooseScroll(page)
  for (let step = 0; step < 6; step += 1) await scrollToLoadedEdge(page, 'end')

  const context = await callTool(page, 'get_reading_context', {})
  expect(context.isError).not.toBe(true)
  const reading = context.structuredContent?.readingContext as {
    bookId?: string
    sectionIndex?: number
    visible?: { text?: string; range?: Record<string, unknown> }
  }
  const state = await rendererState(page)
  expect(reading.sectionIndex).toBe(state.primary)
  expect(reading.visible?.text?.length).toBeGreaterThan(20)
  expect(reading.visible?.range).toBeTruthy()

  const passage = await callTool(page, 'get_passage', { range: reading.visible!.range })
  expect(passage.isError).not.toBe(true)
  expect((passage.structuredContent?.passage as { text?: string })?.text)
    .toBe(reading.visible?.text)

  const annotation = await callTool(page, 'save_annotation', {
    bookId: reading.bookId,
    range: reading.visible!.range,
    quote: reading.visible!.text,
    color: 'sky',
  })
  expect(annotation.isError).not.toBe(true)

  const changedRange = {
    ...reading.visible!.range,
    textFingerprint: 'fnv1a-00000000',
  }
  const refused = await callTool(page, 'get_passage', { range: changedRange })
  expect(refused.isError).toBe(true)
})

test('rewritten and publisher-original views stay grounded in Scroll mode', async ({ page }) => {
  await openFlatland(page)
  await chooseScroll(page)
  await page.getByRole('button', { name: 'Contents', exact: true }).click()
  await page.locator('.toc-item', { hasText: 'Section 1.' }).first().click()

  const sourceResult = await callTool(page, 'get_section_source', {})
  expect(sourceResult.isError).not.toBe(true)
  const source = sourceResult.structuredContent as {
    html?: string
    sectionIndex?: number
    sourceFingerprint?: string
  }
  const originalText = 'Imagine a vast sheet of paper'
  expect(source.html).toContain(originalText)

  const edited = await callTool(page, 'edit_section', {
    sectionIndex: source.sectionIndex,
    sourceFingerprint: source.sourceFingerprint,
    edits: [{
      oldText: originalText,
      newText: 'Imagine a carefully restored sheet of paper',
    }],
    summary: 'Verify remaster grounding in continuous scrolling',
  })
  expect(edited.isError).not.toBe(true)
  expect((await callTool(page, 'set_section_view', { view: 'rewritten' })).isError)
    .not.toBe(true)
  expect(await readingContextText(page)).toContain('carefully restored sheet of paper')

  expect((await callTool(page, 'set_section_view', { view: 'original' })).isError)
    .not.toBe(true)
  const context = await callTool(page, 'get_reading_context', {})
  const reading = context.structuredContent?.readingContext as {
    visible?: { text?: string; range?: Record<string, unknown> }
  }
  expect(reading.visible?.text).toContain(originalText)
  expect(reading.visible?.text).not.toContain('carefully restored sheet of paper')
  const passage = await callTool(page, 'get_passage', { range: reading.visible!.range })
  expect(passage.isError).not.toBe(true)
})
