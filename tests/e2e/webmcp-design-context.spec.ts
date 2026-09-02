import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test, type Page } from '@playwright/test'

/**
 * `get_design_context` proved through the browser's real WebMCP runtime.
 *
 * The claim this guards is specific: a browser agent that has never seen this
 * repository can discover Bookhand's composition guidance from the page alone.
 * Calling a handler directly, or reading `DESIGN.md` from disk at runtime,
 * would prove nothing about that — so everything below goes through
 * `document.modelContext` exactly as an agent would reach it.
 */
test.use({ launchOptions: { args: ['--enable-features=WebMCPTesting'] } })

const NO_RUNTIME = 'no WebMCP runtime: launch with --enable-features=WebMCPTesting'

/**
 * The runtime is reached by casting through `unknown` rather than by augmenting
 * the global `Document`. The sibling WebMCP spec already augments that global,
 * two augmentations of one property collide, and an intersection would resolve
 * to the sibling's narrower tool shape. `new Function` is not an option either:
 * the production CSP has no `unsafe-eval`, which is rather the point.
 */
function agentTools(page: Page) {
  return page.evaluate(async () => {
    const context = (document as unknown as {
      modelContext?: {
        getTools(): Promise<{ name: string; description?: string; inputSchema?: unknown }[]>
      }
    }).modelContext
    if (!context) throw new Error('no WebMCP runtime')
    return (await context.getTools()).map((tool) => ({
      name: tool.name,
      description: tool.description ?? '',
      inputSchema: JSON.stringify(tool.inputSchema ?? null),
    }))
  })
}

const agentCall = (page: Page, name: string, input?: unknown) =>
  page.evaluate(
    async ([toolName, toolInput]) => {
      const context = (document as unknown as {
        modelContext?: {
          getTools(): Promise<{ name: string }[]>
          executeTool(tool: { name: string }, args: string): Promise<string>
        }
      }).modelContext
      if (!context) throw new Error('no WebMCP runtime')
      const tool = (await context.getTools()).find((candidate) => candidate.name === toolName)
      if (!tool) throw new Error(`no tool ${toolName}`)
      const raw = await context.executeTool(tool, JSON.stringify(toolInput ?? {}))
      const result = JSON.parse(raw) as { content: { text: string }[]; isError?: boolean }
      return { text: result.content.map((part) => part.text).join('\n'), isError: !!result.isError }
    },
    [name, input] as const,
  )

/**
 * Recomputed here from the design document, independently of the build. If the
 * bundle ever shipped a version that was merely typed next to the guidance
 * rather than derived from it, this is what would catch it.
 */
function expectedDesignContextVersion(): string {
  const markdown = readFileSync(resolve('DESIGN.md'), 'utf8')
  const start = markdown.indexOf('<!-- bookhand:agent-design-context:start -->')
  const end = markdown.indexOf('<!-- bookhand:agent-design-context:end -->')
  expect(start).toBeGreaterThan(-1)
  expect(end).toBeGreaterThan(start)
  const block = markdown.slice(markdown.indexOf('\n', start) + 1, end)
  return `sha256:${createHash('sha256').update(block, 'utf8').digest('hex')}`
}

async function openLibrary(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Library', level: 1 })).toBeVisible()
  await expect.poll(() => agentTools(page).then((tools) => tools.length), {
    timeout: 20_000,
  }).toBeGreaterThan(0)
}

async function openBook(page: Page) {
  const row = page.locator('.book-open', { hasText: 'Calculus Made Easy' })
  await expect(row).toBeVisible({ timeout: 20_000 })
  await row.click()
  await expect.poll(() => agentTools(page).then((tools) => tools.map((t) => t.name)), {
    timeout: 20_000,
  }).toContain('set_reading_style')

  // The reading tools are registered as soon as the study board exists, which
  // is before the reader has finished restoring the stored style. Styling the
  // book in that window is overwritten by the restore, so wait for rendered
  // text — the same signal the sibling WebMCP spec uses — before mutating. A
  // fresh library opens on the cover, which carries almost no text, so move to
  // a chapter first.
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

test('the design context is discoverable before a book is open', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  await openLibrary(page)

  const tools = await agentTools(page)
  expect(tools.map((tool) => tool.name).sort()).toEqual([
    'get_design_context',
    'list_books',
    'open_book',
  ])

  const definition = tools.find((tool) => tool.name === 'get_design_context')
  expect(definition?.description).toContain('composition guidance')
  expect(definition?.inputSchema).toContain('library')
  expect(definition?.inputSchema).toContain('study')

  const result = await agentCall(page, 'get_design_context')
  expect(result.isError).toBe(false)
  expect(result.text.length).toBeLessThanOrEqual(6_000)
  expect(result.text).toContain(expectedDesignContextVersion())
  expect(result.text).toContain('Requested surface: library')
  expect(result.text).toContain('Reading presentation: unavailable — no book is open.')
  expect(result.text).toContain('Design-bearing tools registered now: none')
  expect(errors).toEqual([])
})

test('the design context reports live reader state on every surface', async ({ page }) => {
  await openLibrary(page)
  await openBook(page)

  const afterOpen = (await agentTools(page)).map((tool) => tool.name)
  expect(afterOpen).toContain('get_design_context')

  // A presentation change the person could also make by hand must show up here.
  const styled = await agentCall(page, 'set_reading_style', {
    theme: 'sepia',
    fontSizePercent: 130,
  })
  expect(styled.isError).toBe(false)

  for (const surface of ['library', 'reader', 'study'] as const) {
    const result = await agentCall(page, 'get_design_context', { surface })
    expect(result.isError).toBe(false)
    expect(result.text.length).toBeLessThanOrEqual(6_000)
    expect(result.text).toContain(expectedDesignContextVersion())
    expect(result.text).toContain(`Requested surface: ${surface}`)
    expect(result.text).toContain('sepia theme, 130% text')
    expect(result.text).toContain('Study board: docked')
    expect(result.text).toContain('set_reading_style')

    // Freedom, scope, and the honest gap.
    expect(result.text).toContain('Creative freedom')
    expect(result.text).toContain('applies inside the EPUB document only')
    expect(result.text).toContain('Whole-application custom worlds')
    expect(result.text).toContain('NOT available yet')

    // Four to six invariants, and no leaked design-document plumbing.
    const invariants = result.text.split('\n').filter((line) => /^- [A-Z][a-z].*: /.test(line))
    expect(invariants.length).toBeGreaterThanOrEqual(4)
    expect(invariants.length).toBeLessThanOrEqual(6)
    expect(result.text).not.toContain('bookhand:agent-design-context')
  }
})

test('the design context returns no book text and no user-authored content', async ({ page }) => {
  await openLibrary(page)
  await openBook(page)

  const marker = 'ZZ-USER-AUTHORED-MARKER-ZZ'
  const styled = await agentCall(page, 'set_reading_style', {
    customCss: `body { color: rebeccapurple } /* ${marker} */`,
  })
  expect(styled.isError).toBe(false)

  const noted = await agentCall(page, 'upsert_study_item', {
    kind: 'prose',
    text: `${marker} a note the person owns`,
  })
  expect(noted.isError).toBe(false)

  const before = await agentCall(page, 'list_study_items')

  const result = await agentCall(page, 'get_design_context', { surface: 'study' })
  expect(result.isError).toBe(false)
  expect(result.text).toContain('custom book CSS in force')
  expect(result.text).not.toContain(marker)
  expect(result.text).not.toContain('rebeccapurple')

  // Book prose must not ride along either.
  const reading = await agentCall(page, 'get_reading_context')
  const bookWords = reading.text
    .split(/\s+/)
    .filter((word) => word.length > 12 && /^[A-Za-z]+$/.test(word))
    .slice(0, 8)
  for (const word of bookWords) expect(result.text).not.toContain(word)

  // Reading is read-only: it stores nothing and changes nothing.
  const after = await agentCall(page, 'list_study_items')
  expect(after.text).toBe(before.text)
})

test('the design-context read is visible to the person in Agent Activity', async ({ page }) => {
  await openLibrary(page)
  await openBook(page)
  await agentCall(page, 'get_design_context', { surface: 'study' })

  await page.getByRole('button', { name: 'Study' }).click()
  await expect(page.locator('.agent-calls code', { hasText: 'get_design_context' }).first())
    .toBeVisible()
  await expect(page.locator('.agent-calls li', { hasText: 'get_design_context' }).first())
    .toContainText('read design context for study')
})

test.describe('runtime requirements', () => {
  test('fails loudly rather than silently passing without a WebMCP runtime', async ({ page }) => {
    await page.goto('/')
    const available = await page.evaluate(
      () =>
        typeof (document as unknown as { modelContext?: { getTools?: unknown } }).modelContext
          ?.getTools,
    )
    expect(available, NO_RUNTIME).toBe('function')
  })
})
