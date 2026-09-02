import { expect, test, type Page } from '@playwright/test'

/**
 * These tests drive Bookhand through the browser's real WebMCP runtime, not a
 * stand-in. Chromium compiles the API in but keeps it behind the same switch
 * `chrome://flags/#enable-webmcp-testing` sets, so enabling `WebMCPTesting`
 * gives `document.modelContext` exactly as ChatGPT's in-app browser exposes it.
 * The app is told nothing: it registers through `document.modelContext` and the
 * test calls back through `getTools()` and `executeTool()` the way an agent
 * would.
 *
 * The runtime speaks JSON strings in both directions — `executeTool` takes the
 * arguments serialized and returns the result serialized — so the helpers below
 * do that translation and nothing else.
 */
test.use({ launchOptions: { args: ['--enable-features=WebMCPTesting'] } })

interface RegisteredTool {
  readonly name: string
}

interface RealModelContext {
  getTools(): Promise<RegisteredTool[]>
  executeTool(tool: RegisteredTool, args: string): Promise<string>
}

declare global {
  interface Document {
    modelContext?: RealModelContext
  }
}

function agentToolNames(page: Page) {
  return page.evaluate(async () => {
    const context = document.modelContext
    if (!context) throw new Error('no WebMCP runtime: launch with --enable-features=WebMCPTesting')
    return (await context.getTools()).map((tool) => tool.name)
  })
}

const agentCall = (page: Page, name: string, input?: unknown) =>
  page.evaluate(
    async ([toolName, toolInput]) => {
      const context = document.modelContext
      if (!context) throw new Error('no WebMCP runtime: launch with --enable-features=WebMCPTesting')
      const tool = (await context.getTools()).find((candidate) => candidate.name === toolName)
      if (!tool) throw new Error(`no tool ${toolName}`)
      const raw = await context.executeTool(tool, JSON.stringify(toolInput ?? {}))
      const result = JSON.parse(raw) as { content: { text: string }[]; isError?: boolean }
      return { text: result.content.map((part) => part.text).join('\n'), isError: !!result.isError }
    },
    [name, input] as const,
  )

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

/** Reading which book is open is not in the URL, so a reload lands on the library. */
async function reopenBook(page: Page) {
  await page.reload()
  const row = page.locator('.book-open', { hasText: 'Calculus Made Easy' })
  await expect(row).toBeVisible({ timeout: 20_000 })
  await row.click()
  await expect(page.locator('.reader')).toBeVisible()
}

test('an agent reads the page, highlights it, and builds a source-linked lesson', async ({ page }) => {
  await openBook(page)

  // The tools are offered only once a book is open.
  await expect
    .poll(() => agentToolNames(page))
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

  // Grounding also tells it which book it is in, which every source-linked
  // mutation has to name.
  const bookId = /Book id: (\S+)/.exec(context.text)?.[1]
  expect(bookId).toBeTruthy()

  // 2. Re-read that exact passage rather than trusting its own memory.
  const passage = await agentCall(page, 'get_passage', { range: visibleRange })
  expect(passage.isError).toBe(false)
  expect(passage.text).toContain('Passage')

  // The quote has to be the book's own words. An agent cannot invent one.
  const quote = /<<<BOOK\n([\s\S]*?)\nBOOK/.exec(context.text)?.[1]
  expect(quote).toBeTruthy()

  // 3. Highlight it in the person's book.
  const highlighted = await agentCall(page, 'save_annotation', {
    bookId,
    range: visibleRange,
    quote,
    color: 'amber',
    note: 'Worth revisiting',
  })
  expect(highlighted.isError).toBe(false)

  // A fabricated quote over the same range is refused, and says why.
  const fabricated = await agentCall(page, 'save_annotation', {
    bookId,
    range: visibleRange,
    quote: 'a passage the agent chose',
  })
  expect(fabricated.isError).toBe(true)
  expect(fabricated.text).toContain('does not match the text at that location')

  // 4. Build a source-linked lesson on the study board.
  const lesson = await agentCall(page, 'upsert_study_item', {
    kind: 'steps',
    title: 'Reading a slope',
    steps: ['Take two points on the curve', 'Divide the rise by the run'],
    bookId,
    sourceRange: visibleRange,
    sourceQuote: quote,
    sourceLabel: 'Chapter X',
  })
  expect(lesson.isError).toBe(false)
  // The receipt names the person's own reversals and hands over the one-time
  // token, which is the only way the agent can revise this block later.
  expect(lesson.text).toContain('updateToken:')
  expect(lesson.text).toContain('Undo')

  // The person sees all of it in the ordinary interface.
  await page.getByRole('button', { name: 'Study' }).click()
  await expect(page.locator('.study-item[data-kind="steps"]')).toBeVisible()
  await expect(page.getByText('Divide the rise by the run')).toBeVisible()
  await expect(page.locator('.highlight')).toHaveCount(1)
  await expect(page.getByText('Worth revisiting')).toBeVisible()

  // And can see exactly what the agent did — including what it was refused.
  const activity = page.locator('.agent-calls li')
  await expect(activity.filter({ hasText: 'save_annotation' })).toHaveCount(2)
  await expect(activity.filter({ hasText: 'upsert_study_item' })).toHaveCount(1)
  const refused = activity.filter({ hasText: 'save_annotation' }).and(
    page.locator('[data-failed="true"]'),
  )
  await expect(refused).toHaveCount(1)
  await expect(refused).toContainText('does not match the text at that location')

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
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Library', level: 1 })).toBeVisible()

  // Tools exist before any book is open, so an agent never finds a page that
  // appears to offer nothing.
  await expect
    .poll(() =>
      agentToolNames(page),
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
      agentToolNames(page),
    )
    .toEqual(expect.arrayContaining(['list_books', 'get_reading_context', 'save_annotation']))
})

test('an agent cannot anchor to a range it invented', async ({ page }) => {
  await openBook(page)
  await expect
    .poll(() => agentToolNames(page))
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

/**
 * `VAL-STYLE-PARITY` and `VAL-BOARD-VIEW-PARITY`. Both contracts are about the
 * same thing: a change made through a tool and a change made through the
 * interface must be the same change. Before this, a tool wrote straight to the
 * book while the controls kept their own copy, so an agent's change was
 * invisible in the panel, unsaved, and undone by the next slider drag.
 */
test('a tool style change reaches the controls, the book, and storage', async ({ page }) => {
  await openBook(page)
  await expect.poll(() => agentToolNames(page)).toContain('set_reading_style')

  const changed = await agentCall(page, 'set_reading_style', {
    theme: 'dark',
    fontSizePercent: 145,
  })
  expect(changed.isError).toBe(false)
  expect(changed.text).toContain('Was: theme publisher')
  expect(changed.text).toContain('Now: theme dark')
  expect(changed.text).toContain('Saved, so it survives a reload.')
  expect(changed.text).toContain('Undo')

  // The shell follows immediately, without the panel having been opened.
  await expect(page.locator('.reader')).toHaveAttribute('data-reader-theme', 'dark')

  // So does the book document itself.
  await expect
    .poll(() =>
      page.evaluate(() => {
        const view = document.querySelector('foliate-view') as unknown as {
          renderer?: { getContents?: () => { doc: Document }[] }
        }
        const doc = view?.renderer?.getContents?.()[0]?.doc
        return doc ? doc.defaultView?.getComputedStyle(doc.body).fontSize : undefined
      }),
    )
    .not.toBe('16px')

  // And so do the controls, which is the half that used to be missing.
  await page.getByRole('button', { name: 'Text settings' }).click()
  await expect(page.getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('#reader-text-panel output').first()).toHaveText('145%')
  await expect(page.getByText('An agent changed these settings.')).toBeVisible()

  // A control the person moves must not carry a stale copy of the rest back
  // over the agent's change.
  const size = page.locator('#reader-text-panel input[type="range"]').first()
  await size.fill('120')
  await page.getByRole('button', { name: 'Apply' }).click()
  await expect(page.getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.reader')).toHaveAttribute('data-reader-theme', 'dark')

  // Both survive a reload, which is the only proof that it was really stored.
  await reopenBook(page)
  await expect(page.locator('.reader')).toHaveAttribute('data-reader-theme', 'dark')
  await page.getByRole('button', { name: 'Text settings' }).click()
  await expect(page.locator('#reader-text-panel output').first()).toHaveText('120%')
})

test('a preview is temporary and Cancel puts the book back', async ({ page }) => {
  await openBook(page)
  await page.getByRole('button', { name: 'Text settings' }).click()

  await page.getByRole('button', { name: 'Sepia' }).click()
  await expect(page.locator('.reader')).toHaveAttribute('data-reader-theme', 'sepia')
  await expect(page.getByText('Previewing.')).toBeVisible()

  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.locator('.reader')).toHaveAttribute('data-reader-theme', 'light')

  // Nothing temporary was stored.
  await reopenBook(page)
  await expect(page.locator('.reader')).toHaveAttribute('data-reader-theme', 'light')
})

test('custom book CSS needs the design guidance, and says how to get it', async ({ page }) => {
  await openBook(page)
  await expect.poll(() => agentToolNames(page)).toContain('set_reading_style')

  const refused = await agentCall(page, 'set_reading_style', {
    customCss: 'p { color: rebeccapurple }',
    designContextVersion: 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
  })
  expect(refused.isError).toBe(true)
  expect(refused.text).toContain('get_design_context')
  expect(refused.text).toContain('Nothing was changed.')

  const context = await agentCall(page, 'get_design_context', { surface: 'reader' })
  const version = /guidance version (sha256:[0-9a-f]{64})/.exec(context.text)?.[1]
  expect(version).toBeTruthy()

  const applied = await agentCall(page, 'set_reading_style', {
    customCss: 'p { color: rebeccapurple }',
    designContextVersion: version,
  })
  expect(applied.isError).toBe(false)
  expect(applied.text).toContain('cannot reach the library')

  await expect
    .poll(() =>
      page.evaluate(() => {
        const view = document.querySelector('foliate-view') as unknown as {
          renderer?: { getContents?: () => { doc: Document }[] }
        }
        const doc = view?.renderer?.getContents?.()[0]?.doc
        const p = doc?.querySelector('p')
        return p ? doc?.defaultView?.getComputedStyle(p).color : undefined
      }),
    )
    .toBe('rgb(102, 51, 153)')
})

test('the study board can be focused and closed without changing the layout', async ({ page }) => {
  await openBook(page)
  await expect.poll(() => agentToolNames(page)).toContain('set_study_board_view')

  const focused = await agentCall(page, 'set_study_board_view', { view: 'focus' })
  expect(focused.isError).toBe(false)
  expect(focused.text).toContain('The layout preference was not changed')

  const board = page.locator('#reader-study-panel')
  await expect(board).toBeVisible()
  // Focus went to the board's own heading, so a person using the keyboard is
  // where the agent said to look.
  await expect(board.getByRole('heading', { level: 2 })).toBeFocused()

  const closed = await agentCall(page, 'set_study_board_view', { view: 'close' })
  expect(closed.isError).toBe(false)
  await expect(board).toBeHidden()

  // A persistent change is a different thing, and offers the person Undo.
  const expanded = await agentCall(page, 'set_study_board_view', { view: 'expanded' })
  expect(expanded.text).toContain('The layout preference was saved.')
  await expect(page.locator('.reader')).toHaveAttribute('data-board', 'expanded')
  await expect(page.getByText('An agent changed this board’s layout.')).toBeVisible()

  await page.getByRole('button', { name: 'Undo' }).first().click()
  await expect(page.locator('.reader')).toHaveAttribute('data-board', 'docked')
})
