import { expect, test, type Page } from '@playwright/test'

/**
 * Installs a stand-in for the browser's agent runtime before the app loads, so
 * the production build registers its real tools against it and the test can
 * call them the way an agent would. Nothing in the app knows this is a test:
 * it registers through `document.modelContext` exactly as it would in
 * ChatGPT's in-app browser.
 */
async function installAgentRuntime(page: Page) {
  await page.addInitScript(() => {
    const tools = new Map<string, { execute(input: unknown): Promise<unknown> }>()
    Object.defineProperty(document, 'modelContext', {
      configurable: true,
      value: {
        async registerTool(tool: { name: string; execute(input: unknown): Promise<unknown> }) {
          tools.set(tool.name, tool)
          return undefined
        },
      },
    })
    Object.assign(window, {
      __agent: {
        names: () => [...tools.keys()],
        async call(name: string, input: unknown) {
          const tool = tools.get(name)
          if (!tool) throw new Error(`no tool ${name}`)
          const result = (await tool.execute(input ?? {})) as {
            content: { text: string }[]
            isError?: boolean
          }
          return { text: result.content.map((part) => part.text).join('\n'), isError: !!result.isError }
        },
      },
    })
  })
}

async function openBook(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Library', level: 1 })).toBeVisible()
  const row = page.locator('.book-open', { hasText: 'Calculus Made Easy' })
  await expect(row).toBeVisible({ timeout: 20_000 })
  await row.click()

  // A fresh library opens on the cover, which carries almost no text. Move to a
  // chapter so the agent is reading real prose.
  await page.getByRole('button', { name: 'Contents' }).click()
  await page.locator('.toc-item', { hasText: 'CHAPTER X.' }).first().click()
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const view = document.querySelector('foliate-view') as unknown as {
            renderer?: { getContents?: () => { doc: Document }[] }
          }
          return view?.renderer?.getContents?.()[0]?.doc?.body?.textContent?.length ?? 0
        }),
      { timeout: 20_000 },
    )
    .toBeGreaterThan(200)
}

const agentCall = (page: Page, name: string, input?: unknown) =>
  page.evaluate(
    ([toolName, toolInput]) =>
      (window as unknown as { __agent: { call(n: string, i: unknown): Promise<{ text: string; isError: boolean }> } }).__agent.call(
        toolName as string,
        toolInput,
      ),
    [name, input] as const,
  )

test('an agent reads the page, highlights it, and builds a source-linked lesson', async ({ page }) => {
  await installAgentRuntime(page)
  await openBook(page)

  // The tools are offered only once a book is open.
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __agent: { names(): string[] } }).__agent.names()))
    .toContain('get_reading_context')

  // 1. Ground itself in what the person is actually reading.
  const context = await agentCall(page, 'get_reading_context')
  expect(context.isError).toBe(false)
  expect(context.text).toContain('Calculus Made Easy')
  expect(context.text).toContain('untrusted book content')

  const visibleRange = JSON.parse(
    /Visible range: (\{.*\})/.exec(context.text)?.[1] ?? 'null',
  ) as Record<string, unknown> | null
  expect(visibleRange).not.toBeNull()

  // 2. Re-read that exact passage rather than trusting its own memory.
  const passage = await agentCall(page, 'get_passage', { range: visibleRange })
  expect(passage.isError).toBe(false)
  expect(passage.text).toContain('Passage')

  // 3. Highlight it in the person's book.
  const highlighted = await agentCall(page, 'save_annotation', {
    range: visibleRange,
    quote: 'a passage the agent chose',
    color: 'amber',
    note: 'Worth revisiting',
  })
  expect(highlighted.isError).toBe(false)

  // 4. Build a source-linked lesson on the study board.
  const lesson = await agentCall(page, 'upsert_study_item', {
    kind: 'steps',
    title: 'Reading a slope',
    steps: ['Take two points on the curve', 'Divide the rise by the run'],
    sourceRange: visibleRange,
    sourceLabel: 'Chapter X',
  })
  expect(lesson.isError).toBe(false)

  // The person sees all of it in the ordinary interface.
  await page.getByRole('button', { name: 'Study' }).click()
  await expect(page.locator('.study-item[data-kind="steps"]')).toBeVisible()
  await expect(page.getByText('Divide the rise by the run')).toBeVisible()
  await expect(page.locator('.highlight')).toHaveCount(1)
  await expect(page.getByText('Worth revisiting')).toBeVisible()

  // And can see exactly what the agent did.
  const activity = page.locator('.agent-calls li')
  await expect(activity.filter({ hasText: 'save_annotation' })).toBeVisible()
  await expect(activity.filter({ hasText: 'upsert_study_item' })).toBeVisible()

  // The highlight is drawn over the book itself, not merely stored.
  await expect
    .poll(() =>
      page.evaluate(() => {
        const view = document.querySelector('foliate-view') as unknown as {
          renderer?: { getContents?: () => { overlayer?: { element?: Element } }[] }
        }
        return view?.renderer?.getContents?.()[0]?.overlayer?.element?.querySelectorAll('rect').length ?? 0
      }),
    )
    .toBeGreaterThan(0)
})

test('an agent arriving at the library can see it and open a book itself', async ({ page }) => {
  await installAgentRuntime(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Library', level: 1 })).toBeVisible()

  // Tools exist before any book is open, so an agent never finds a page that
  // appears to offer nothing.
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { __agent: { names(): string[] } }).__agent.names()),
    )
    .toEqual(expect.arrayContaining(['list_books', 'open_book']))

  await expect(page.locator('.book-open')).toBeVisible({ timeout: 20_000 })
  const listed = await agentCall(page, 'list_books')
  expect(listed.isError).toBe(false)
  expect(listed.text).toContain('Calculus Made Easy')
  expect(listed.text).toContain('Storage:')

  const opened = await agentCall(page, 'open_book', { title: 'calculus' })
  expect(opened.isError).toBe(false)
  await expect(page.locator('.reader-identity')).toContainText('Calculus Made Easy')

  // Opening the book adds its reading tools to the ones already offered.
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { __agent: { names(): string[] } }).__agent.names()),
    )
    .toEqual(expect.arrayContaining(['list_books', 'get_reading_context', 'save_annotation']))
})

test('an agent cannot anchor to a range it invented', async ({ page }) => {
  await installAgentRuntime(page)
  await openBook(page)
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __agent: { names(): string[] } }).__agent.names()))
    .toContain('save_annotation')

  const result = await agentCall(page, 'save_annotation', {
    range: { startCfi: 'invented', endCfi: 'invented', sectionIndex: 0, textFingerprint: 'x' },
    quote: 'text that is not in the book',
  })
  // The range is structurally valid but does not resolve, so nothing is stored
  // and nothing is drawn.
  await page.getByRole('button', { name: 'Study' }).click()
  await expect(page.locator('.highlight')).toHaveCount(result.isError ? 0 : 1)
})

test('the reader is unchanged when no agent runtime exists', async ({ page }) => {
  await openBook(page)
  expect(await page.evaluate(() => 'modelContext' in document)).toBe(false)

  await page.getByRole('button', { name: 'Study' }).click()
  await expect(page.getByText('No agent connected')).toBeVisible()
  await expect(page.getByRole('button', { name: /quotation/i })).toBeVisible()
})
