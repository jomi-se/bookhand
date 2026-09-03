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
      const result = JSON.parse(raw) as {
        content: { text: string }[]
        structuredContent?: Record<string, unknown>
        isError?: boolean
      }
      return {
        text: result.content.map((part) => part.text).join('\n'),
        structured: result.structuredContent ?? {},
        isError: !!result.isError,
      }
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
  expect(context.structured).toMatchObject({ ok: true })

  const readingContext = context.structured.readingContext as {
    bookId?: string
    visible?: { range?: Record<string, unknown>; text?: string }
  }
  const visibleRange = readingContext.visible?.range ?? null
  expect(visibleRange).not.toBeNull()

  // Grounding also tells it which book it is in, which every source-linked
  // mutation has to name.
  const bookId = readingContext.bookId
  expect(bookId).toBeTruthy()

  // 2. Re-read that exact passage rather than trusting its own memory.
  const passage = await agentCall(page, 'get_passage', { range: visibleRange })
  expect(passage.isError, passage.text).toBe(false)
  expect(passage.text).toContain('Passage')
  expect(passage.structured).toMatchObject({ ok: true, passage: { range: visibleRange } })

  // The quote has to be the book's own words. An agent cannot invent one.
  const quote = readingContext.visible?.text
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

  // 4. Build one source-linked lesson atomically, after reading its design
  // context. The title and progression are structure, not action metadata.
  const design = await agentCall(page, 'get_design_context', { surface: 'study' })
  const designContextVersion = /guidance version (sha256:[0-9a-f]{64})/.exec(design.text)?.[1]
  expect(designContextVersion).toBeTruthy()
  const lesson = await agentCall(page, 'create_study_lesson', {
    title: 'Reading a slope',
    blocks: [
      {
        id: 'approach',
        kind: 'steps',
        steps: ['Take two points on the curve', 'Divide the rise by the run'],
      },
      {
        id: 'ratio',
        kind: 'equation',
        expression: '\\dfrac{dy}{dx}',
        caption: 'The differential coefficient',
      },
      {
        id: 'check',
        kind: 'question',
        prompt: 'What happens as the two points come together?',
        answer: 'The secant ratio approaches the tangent slope.',
      },
    ],
    actionToken: 'slope-lesson',
    actionGroupId: 'slope-lesson',
    designContextVersion,
    bookId,
    sourceRange: visibleRange,
    sourceQuote: quote,
    sourceLabel: 'Chapter X',
  })
  expect(lesson.isError, lesson.text).toBe(false)
  expect(lesson.text).toContain('3 ordered blocks')

  // The person sees all of it in the ordinary interface.
  await page.getByRole('button', { name: 'Study' }).click()
  await expect(page.getByRole('heading', { name: 'Reading a slope', level: 3 })).toBeVisible()
  await expect(page.getByText('Divide the rise by the run')).toBeVisible()
  await expect(page.locator('#study-experience-19-lesson-slope-lesson-block-5-ratio')).toBeVisible()
  await expect(page.locator('.block-equation-rendered math')).toBeVisible()
  await expect(page.locator('.block-equation pre')).toHaveCount(0)
  await expect(page.locator('.highlight')).toHaveCount(1)
  await expect(page.getByText('Worth revisiting')).toBeVisible()

  if (process.env.CAPTURE_STUDY === '1') {
    await page.screenshot({ path: '.impeccable/review/desktop-docked.png', fullPage: true })
    await page.getByRole('button', { name: 'Expand the study board' }).click()
    await expect(page.locator('.reader')).toHaveAttribute('data-board', 'expanded')
    await page.screenshot({ path: '.impeccable/review/desktop.png', fullPage: true })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.screenshot({ path: '.impeccable/review/mobile.png', fullPage: true })
    await page.setViewportSize({ width: 320, height: 720 })
    await page.screenshot({ path: '.impeccable/review/mobile-320.png', fullPage: true })
    await agentCall(page, 'set_reading_style', { theme: 'dark' })
    await page.screenshot({ path: '.impeccable/review/mobile-dark.png', fullPage: true })
    await agentCall(page, 'set_reading_style', { theme: 'sepia' })
    await page.screenshot({ path: '.impeccable/review/mobile-sepia.png', fullPage: true })
    await agentCall(page, 'set_reading_style', { theme: 'publisher' })
  }
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 720 })
    expect(
      await page
        .locator('#reader-study-panel')
        .evaluate((element) => element.scrollWidth <= element.clientWidth),
    ).toBe(true)
    const backToBook = await page
      .getByRole('button', { name: 'Close study and return to the book' })
      .boundingBox()
    expect(backToBook?.height).toBeGreaterThanOrEqual(44)
    expect(backToBook?.width).toBeGreaterThanOrEqual(44)
    const sourceControl = await page.locator('.study-lesson-tools .button-text').boundingBox()
    expect(sourceControl?.height).toBeGreaterThanOrEqual(44)
    const revealControl = await page.locator('.study-lesson summary').boundingBox()
    expect(revealControl?.height).toBeGreaterThanOrEqual(44)
  }

  // Tool logs are observability, not learning content. Study contains the
  // result and its authorship, never raw handler names or call history.
  await expect(page.locator('.agent-activity')).toHaveCount(0)
  await expect(page.getByText('create_study_lesson')).toHaveCount(0)

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

  // Canonical source data is durable rather than a mounted-reader cache.
  // Reopening the application restores both independently owned records and
  // their source-linked presentation.
  await reopenBook(page)
  await page.getByRole('button', { name: 'Study' }).click()
  await expect(page.getByRole('heading', { name: 'Reading a slope', level: 3 })).toBeVisible()
  await expect(page.getByText('Divide the rise by the run')).toBeVisible()
  await expect(page.locator('#study-experience-19-lesson-slope-lesson-block-5-ratio')).toBeVisible()
  await expect(page.locator('.block-equation-rendered math')).toBeVisible()
  await expect(page.getByText('Worth revisiting')).toBeVisible()
  const lessonsAfterReload = await agentCall(page, 'list_study_lessons')
  expect(lessonsAfterReload.isError).toBe(false)
  expect(lessonsAfterReload.text).toContain('lesson-slope-lesson')
  expect(lessonsAfterReload.text).toContain('ratio:equation')
  await expect(page.locator('.highlight')).toHaveCount(1)
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

  await expect(page.locator('.book-open').first()).toBeVisible({ timeout: 20_000 })
  const listed = await agentCall(page, 'list_books')
  expect(listed.isError).toBe(false)
  expect(listed.text).toContain('Calculus Made Easy')
  expect(listed.text).toContain('Storage:')

  const opened = await agentCall(page, 'open_book', { title: 'calculus' })
  expect(opened.isError).toBe(false)
  // The success receipt is a readiness claim: the book tools and first
  // readable location must work immediately, without a second UI wait.
  const immediateContext = await agentCall(page, 'get_reading_context')
  expect(immediateContext.isError).toBe(false)
  expect(immediateContext.text).toContain('Calculus Made Easy')
  await expect(page.locator('.reader-identity')).toContainText('Calculus Made Easy')

  // Opening the book adds its reading tools to the ones already offered.
  await expect
    .poll(() =>
      agentToolNames(page),
    )
    .toEqual(expect.arrayContaining(['list_books', 'get_reading_context', 'save_annotation']))
})

test('the genuine runtime preserves structured refusals while schemas remain advisory', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.book-open', { hasText: 'Calculus Made Easy' })).toBeVisible({
    timeout: 20_000,
  })
  const missingSelector = await agentCall(page, 'open_book', {})
  expect(missingSelector.isError).toBe(true)
  expect(missingSelector.structured).toMatchObject({ ok: false, error: { message: expect.any(String) } })

  await agentCall(page, 'open_book', { title: 'calculus' })
  await expect(page.locator('.reader')).toBeVisible()
  await expect.poll(() => agentToolNames(page)).toContain('get_reading_context')

  for (const [name, input] of [
    ['get_reading_context', { unknown: true }],
    ['navigate_book', { direction: 'next', sectionIndex: 1 }],
    ['set_reading_style', {}],
    ['set_reading_style', { undo: true, reset: true }],
    ['set_reading_style', { fontSizePercent: 300, theme: 'bogus' }],
    ['upsert_study_item', { kind: 'question' }],
    ['set_study_board_view', {}],
  ] as const) {
    const result = await agentCall(page, name, input)
    expect(result.isError, `${name}: ${result.text}`).toBe(true)
    expect(result.structured).toMatchObject({ ok: false, message: expect.any(String) })
  }
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

test('a highlight survives the reflow a style change causes', async ({ page }) => {
  await openBook(page)
  await expect.poll(() => agentToolNames(page)).toContain('set_reading_style')

  const context = await agentCall(page, 'get_reading_context')
  const bookId = /Book id: (\S+)/.exec(context.text)?.[1]
  const range = JSON.parse(/Visible range: (\{.*\})/.exec(context.text)?.[1] ?? 'null')
  const quote = /<<<BOOK\n([\s\S]*?)\nBOOK/.exec(context.text)?.[1]

  await agentCall(page, 'save_annotation', { bookId, range, quote, color: 'sky' })
  const drawn = () =>
    page.evaluate(() => {
      const view = document.querySelector('foliate-view') as unknown as {
        renderer?: { getContents?: () => { overlayer?: { element?: Element } }[] }
      }
      return (
        view?.renderer?.getContents?.()[0]?.overlayer?.element?.querySelectorAll('rect').length ?? 0
      )
    })
  await expect.poll(drawn).toBeGreaterThan(0)

  // Everything about the page geometry changes here. The mark is anchored to a
  // range CFI, not to coordinates, so it has to be redrawn where the words went.
  await agentCall(page, 'set_reading_style', { fontSizePercent: 170, measureCh: 45 })
  await expect.poll(drawn).toBeGreaterThan(0)

  // And the passage the block cites still resolves to the same words.
  const after = await agentCall(page, 'get_passage', { range })
  expect(after.isError).toBe(false)
  expect(after.text).toContain(quote!.slice(0, 40))
})
