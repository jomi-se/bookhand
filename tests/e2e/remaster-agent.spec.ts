import { expect, test, type Page } from '@playwright/test'

/**
 * The remastering surface, driven through the browser's real WebMCP runtime.
 *
 * This is the capability end to end: an agent reads a chapter's actual markup,
 * decides what it should be, writes it back, and the reader shows the result —
 * with the publisher's original one click away the whole time.
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

/** What the reader is actually looking at, inside the book's own frame. */
const renderedHtml = (page: Page) =>
  page.evaluate(() => {
    const view = document.querySelector('foliate-view') as unknown as {
      renderer?: { getContents?: () => { doc: Document }[] }
    }
    return view?.renderer?.getContents?.()[0]?.doc?.body?.innerHTML ?? ''
  })

async function openChapter(page: Page) {
  await page.goto('/')
  const row = page.locator('.book-open', { hasText: 'Calculus Made Easy' })
  await expect(row).toBeVisible({ timeout: 20_000 })
  await row.click()

  await page.getByRole('button', { name: 'Contents' }).click()
  await page.locator('.toc-item', { hasText: 'CHAPTER III.' }).first().click()
  // Wait for the chapter itself, not merely for some document: the previous
  // section is still rendered for a moment and would satisfy a length check.
  await expect
    .poll(() => renderedHtml(page).then((html) => html.includes('data-tex')), { timeout: 20_000 })
    .toBe(true)
  // Put the reader back the way a person reads, with the panel closed.
  const closeContents = page.getByRole('button', { name: 'Close contents' })
  if (await closeContents.isVisible()) await closeContents.click()
  await expect(page.locator('#reader-contents-panel')).toBeHidden()
}

/**
 * Come back to the same chapter after a reload.
 *
 * The readiness check cannot look for `data-tex`: the whole point is that the
 * chapter may no longer contain any. It waits for the chapter's own title
 * instead, which survives being rewritten.
 */
async function reopenChapter(page: Page) {
  const row = page.locator('.book-open', { hasText: 'Calculus Made Easy' })
  await expect(row).toBeVisible({ timeout: 20_000 })
  await row.click()

  await page.getByRole('button', { name: 'Contents' }).click()
  await page.locator('.toc-item', { hasText: 'CHAPTER III.' }).first().click()
  await expect
    .poll(() => renderedHtml(page).then((html) => /chapter iii/i.test(html)), { timeout: 20_000 })
    .toBe(true)
  await page.getByRole('button', { name: 'Close contents' }).click()
  await expect(page.locator('#reader-contents-panel')).toBeHidden()
}

test('an agent reads a broken chapter, rewrites it, and the person keeps control', async ({
  page,
}) => {
  await openChapter(page)

  await expect
    .poll(() =>
      page.evaluate(async () => (await document.modelContext!.getTools()).map((tool) => tool.name)),
    )
    .toContain('rewrite_section')

  // 1. The diagnosis. Facts about the chapter, with nothing classified.
  const diagnosis = await agentCall(page, 'diagnose_section')
  expect(diagnosis.isError).toBe(false)
  const counts = (diagnosis.structured as { counts?: Record<string, number> }).counts ?? {}
  // Chapter III ships 163 images, 161 of which still carry their LaTeX. The
  // other two are the chapter's real figures, which is exactly the distinction
  // Bookhand refuses to make on the agent's behalf.
  expect(counts.images).toBe(163)
  expect(counts.imagesWithTex).toBe(161)

  // 2. The source. The book's own packaged markup, not the rendered DOM:
  //    references are still package-relative, which is what makes a rewrite
  //    meaningful after a reload and exportable at all.
  const source = await agentCall(page, 'get_section_source')
  const html = (source.structured as { html?: string }).html ?? ''
  expect(html).toContain('data-tex')
  expect(html).not.toContain('blob:')
  expect((source.structured as { bytes?: number }).bytes).toBeGreaterThan(1000)
  const stylesheets = (source.structured as { stylesheets?: { name: string; css: string }[] })
    .stylesheets
  expect(stylesheets?.length).toBeGreaterThan(0)
  expect(stylesheets?.[0]?.css).toBeTruthy()

  // A figure the chapter already has, named the way the package names it.
  const figures = ((diagnosis.structured as { images?: { src?: string; tex?: string }[] }).images ??
    []).filter((image) => !image.tex)
  const figureSrc = figures[0]?.src
  expect(figureSrc).toBeTruthy()
  expect(figureSrc).not.toContain('blob:')

  // The ChatGPT/Codex browser rejects a new post-load blob iframe navigation.
  // Mark the mounted reader so the rewrite proves it updates this exact view.
  await page.locator('foliate-view').evaluate((view) => view.setAttribute('data-test-stable-view', ''))

  // 3. The agent writes the chapter it decided on. Here that is a small,
  //    deterministic stand-in for a model's judgement — a real heading, a real
  //    equation, a real figure — because the point under test is that whatever
  //    the agent writes is what the reader gets.
  const rewrite = await agentCall(page, 'rewrite_section', {
    html:
      '<h2 id="ch3">Chapter III — On relative growings</h2>' +
      '<p>The ratio we hunt is <math display="inline" alttext="dy/dx"><semantics>' +
      '<mfrac><mrow><mi>d</mi><mi>y</mi></mrow><mrow><mi>d</mi><mi>x</mi></mrow></mfrac>' +
      '<annotation encoding="application/x-tex">\\dfrac{dy}{dx}</annotation></semantics></math>.</p>' +
      // A void element on purpose: an EPUB section is XHTML, where innerHTML
      // is XML-parsed, so an unclosed <img> is the case most likely to break.
      // And a real figure, referenced the way the package does, to prove the
      // agent's relative paths still resolve once Foliate has loaded them.
      '<figure role="figure" aria-label="A right triangle with a 30 degree base angle">' +
      `<img src="${figureSrc}" alt="Fig. 4"><figcaption>Fig. 4</figcaption></figure>` +
      '<script>fetch("https://evil.example")</script>',
    css:
      'html { font-size: 9px !important; }' +
      'html, body { width: 1400px !important; height: 1200px !important; overflow: hidden !important; }' +
      '.remastered-note { color: rebeccapurple; }',
    summary: 'Set the chapter title as a heading and the derivative as MathML',
  })
  expect(rewrite.isError).toBe(false)
  expect(rewrite.structured.displayed).toBe(false)

  // The sanitizer refused the script and said so, rather than thinning quietly.
  const sanitized = (rewrite.structured as { sanitized?: { removedElements?: Record<string, number> } })
    .sanitized
  expect(sanitized?.removedElements?.script).toBe(1)
  expect(rewrite.text).toContain('Removed')

  // 4. The agent call never tears down the mounted book. The person reveals
  //    the safely saved revision outside the browser-controlled operation.
  expect(await renderedHtml(page)).toContain('data-tex')
  const bar = page.locator('.remaster-bar')
  await expect(bar).toContainText('Rewrite ready')
  await bar.getByRole('button', { name: 'Rewritten' }).click()
  await expect(page.locator('foliate-view')).toHaveAttribute('data-test-stable-view', '')
  await expect.poll(() => renderedHtml(page), { timeout: 15_000 }).toContain('id="ch3"')
  const after = await renderedHtml(page)
  expect(after).toContain('id="ch3"')
  expect(after).toContain('Chapter III — On relative growings')
  expect(after).toContain('<math')
  expect(after).toContain('<figcaption>Fig. 4</figcaption>')
  expect(after).not.toContain('data-tex')

  // The agent wrote a package-relative path; Foliate's loader resolved it, so
  // the figure actually loads rather than 404ing inside the book's frame.
  const figureLoaded = await page.evaluate(() => {
    const view = document.querySelector('foliate-view') as unknown as {
      renderer?: { getContents?: () => { doc: Document }[] }
    }
    const image = view?.renderer?.getContents?.()[0]?.doc?.querySelector('figure img') as
      | HTMLImageElement
      | undefined
    return {
      src: image?.getAttribute('src') ?? '',
      complete: image?.complete ?? false,
      naturalWidth: image?.naturalWidth ?? 0,
    }
  })
  expect(figureLoaded.src.startsWith('blob:')).toBe(true)
  expect(figureLoaded.complete).toBe(true)
  expect(figureLoaded.naturalWidth).toBeGreaterThan(0)

  // And the agent's stylesheet reached the book's own frame.
  const styled = await page.evaluate(() => {
    const view = document.querySelector('foliate-view') as unknown as {
      renderer?: { getContents?: () => { doc: Document }[] }
    }
    return (
      view?.renderer?.getContents?.()[0]?.doc?.getElementById('bookhand-remaster-style')
        ?.textContent ?? ''
    )
  })
  expect(styled).toContain('rebeccapurple')
  expect(after).not.toContain('<script')
  expect(after).not.toContain('evil.example')

  // A model may think in print-page dimensions. Its visual choices survive,
  // but it cannot replace Foliate's responsive viewport or trap page turns.
  const flow = await page.evaluate(() => {
    const view = document.querySelector('foliate-view') as unknown as {
      renderer?: { getContents?: () => { doc: Document }[] }
    }
    const doc = view?.renderer?.getContents?.()[0]?.doc
    const style = doc?.body ? doc.defaultView?.getComputedStyle(doc.body) : undefined
    return { width: style?.width, height: style?.height, overflow: style?.overflow }
  })
  expect(flow.width).not.toBe('1400px')
  expect(flow.height).not.toBe('1200px')
  expect(flow.overflow).toBe('visible')
  const heading = await page.evaluate(() => {
    const view = document.querySelector('foliate-view') as unknown as {
      renderer?: { getContents?: () => { doc: Document }[] }
    }
    const doc = view?.renderer?.getContents?.()[0]?.doc
    const h2 = doc?.querySelector('h2')
    return h2 && doc?.defaultView ? doc.defaultView.getComputedStyle(h2).fontSize : ''
  })
  expect(Number.parseFloat(heading)).toBeLessThanOrEqual(32)

  await page.getByRole('button', { name: 'Increase text size' }).click()
  await expect
    .poll(async () => {
      const size = await page.evaluate(() => {
        const view = document.querySelector('foliate-view') as unknown as {
          renderer?: { getContents?: () => { doc: Document }[] }
        }
        const doc = view?.renderer?.getContents?.()[0]?.doc
        const h2 = doc?.querySelector('h2')
        return h2 && doc?.defaultView
          ? Number.parseFloat(doc.defaultView.getComputedStyle(h2).fontSize)
          : 0
      })
      return size
    })
    .toBeGreaterThan(Number.parseFloat(heading))

  // Native MathML, not an image: the mathematics is selectable text now.
  const mathText = await page.evaluate(() => {
    const view = document.querySelector('foliate-view') as unknown as {
      renderer?: { getContents?: () => { doc: Document }[] }
    }
    return view?.renderer?.getContents?.()[0]?.doc?.querySelector('math')?.textContent ?? ''
  })
  expect(mathText).toContain('d')

  // A second agent pass reads the current editable version, never a stale
  // publisher snapshot or the renderer's ephemeral blob URLs.
  const current = await agentCall(page, 'get_section_source')
  const currentHtml = (current.structured as { html?: string }).html ?? ''
  const currentSheets = (current.structured as {
    stylesheets?: { name: string; css: string }[]
  }).stylesheets ?? []
  expect(currentHtml).toContain('<math')
  expect(currentHtml).not.toContain('data-tex')
  expect(currentHtml).not.toContain('blob:')
  expect(currentSheets).toContainEqual(expect.objectContaining({
    name: 'bookhand-remaster',
    css: expect.stringContaining('rebeccapurple'),
  }))

  const currentDiagnosis = await agentCall(page, 'diagnose_section')
  const currentCounts = (currentDiagnosis.structured as { counts?: Record<string, number> }).counts
  expect(currentCounts?.imagesWithTex).toBe(0)

  // 5. The person's control appeared, and it is not a promise — it works.
  await expect(bar).toBeVisible()
  // The agent said what it was doing, and that is what the person is shown.
  await expect(bar).toContainText('Set the chapter title as a heading')

  await bar.getByRole('button', { name: 'Hide' }).click()
  await expect(bar).toHaveClass(/remaster-bar-collapsed/)
  await expect(bar).not.toContainText('Set the chapter title as a heading')
  await bar.getByRole('button', { name: /Agent rewrite/ }).click()
  await expect(bar).not.toHaveClass(/remaster-bar-collapsed/)

  await bar.getByRole('button', { name: 'Original' }).click()
  await expect.poll(() => renderedHtml(page), { timeout: 15_000 }).toContain('data-tex')

  await bar.getByRole('button', { name: 'Rewritten' }).click()
  await expect.poll(() => renderedHtml(page), { timeout: 15_000 }).toContain('<math')

  // 6. Reset returns the book exactly as published, and the control retires.
  await bar.getByRole('button', { name: 'Reset' }).click()
  await expect.poll(() => renderedHtml(page), { timeout: 15_000 }).toContain('data-tex')
  await expect(bar).toBeHidden()
})

test('the deterministic shortcut is one call the agent may choose', async ({ page }) => {
  await openChapter(page)
  await expect
    .poll(() =>
      page.evaluate(async () => (await document.modelContext!.getTools()).map((tool) => tool.name)),
    )
    .toContain('compile_section_math')

  const result = await agentCall(page, 'compile_section_math')
  expect(result.isError).toBe(false)
  const report = result.structured as { found?: number; restored?: number }
  expect(report.found).toBe(161)
  expect(report.restored).toBe(161)

  expect(await renderedHtml(page)).toContain('data-tex')
  await page.locator('.remaster-bar').getByRole('button', { name: 'Rewritten' }).click()

  await expect.poll(() => renderedHtml(page), { timeout: 15_000 }).toContain('<math')
  const after = await renderedHtml(page)
  expect(after).toContain('<math')
  expect(after).not.toContain('data-tex="')

  // And it is an ordinary rewrite: undo puts the publisher's images back.
  const undone = await agentCall(page, 'set_section_view', { view: 'undo' })
  expect(undone.isError).toBe(false)
  await expect.poll(() => renderedHtml(page), { timeout: 15_000 }).toContain('data-tex')
})

test('an agent can make a fingerprinted surgical edit that survives reload and undoes once', async ({ page }) => {
  await openChapter(page)
  await expect
    .poll(() =>
      page.evaluate(async () => (await document.modelContext!.getTools()).map((tool) => tool.name)),
    )
    .toContain('edit_section')

  const sourceResult = await agentCall(page, 'get_section_source')
  const source = sourceResult.structured as {
    html?: string
    sourceFingerprint?: string
    revision?: number
  }
  expect(source.revision).toBe(0)
  expect(source.sourceFingerprint).toMatch(/^fnv1a64-source-/)
  const heading = source.html?.match(/<h2[^>]*>[\s\S]*?<\/h2>/)?.[0]
  expect(heading).toBeTruthy()

  const edited = await agentCall(page, 'edit_section', {
    sectionIndex: sourceResult.structured.sectionIndex,
    sourceFingerprint: source.sourceFingerprint,
    edits: [{
      oldText: heading,
      newText: '<h2 id="surgical-heading">Chapter III — repaired without returning the chapter</h2>',
    }],
    summary: 'Repaired only the chapter heading',
  })
  expect(edited.isError).toBe(false)
  expect(edited.structured).toMatchObject({ editsApplied: 1, sectionIndex: expect.any(Number) })
  await page.locator('.remaster-bar').getByRole('button', { name: 'Rewritten' }).click()
  await expect.poll(() => renderedHtml(page), { timeout: 15_000 }).toContain('id="surgical-heading"')
  // Content outside the one exact replacement remains: this was not a tiny
  // payload disguising a whole-section rewrite.
  expect(await renderedHtml(page)).toContain('data-tex')
  await expect(page.locator('.remaster-bar')).toContainText('Repaired only the chapter heading')

  const stale = await agentCall(page, 'edit_section', {
    sectionIndex: sourceResult.structured.sectionIndex,
    sourceFingerprint: source.sourceFingerprint,
    edits: [{ oldText: 'repaired without returning', newText: 'stale change' }],
  })
  expect(stale.isError).toBe(true)
  expect(stale.text).toContain('changed after you read it')
  expect(await renderedHtml(page)).toContain('repaired without returning')

  await page.reload()
  await reopenChapter(page)
  await expect.poll(() => renderedHtml(page), { timeout: 15_000 }).toContain('id="surgical-heading"')

  await page.locator('.remaster-bar').getByRole('button', { name: 'Undo' }).click()
  await expect.poll(() => renderedHtml(page), { timeout: 15_000 }).not.toContain('id="surgical-heading"')
  await expect(page.locator('.remaster-bar')).toBeHidden()
})

test('the person keeps a usable reading surface and touch controls on a compact screen', async ({
  page,
}) => {
  await page.setViewportSize({ width: 412, height: 915 })
  await openChapter(page)
  const result = await agentCall(page, 'compile_section_math')
  expect(result.isError).toBe(false)

  const bar = page.locator('.remaster-bar')
  const stage = page.locator('.reader-stage')
  await expect(bar).toBeVisible()
  const [barBox, stageBox] = await Promise.all([bar.boundingBox(), stage.boundingBox()])
  expect(barBox).not.toBeNull()
  expect(stageBox?.height).toBeGreaterThan(400)
  expect((barBox?.x ?? 0) + (barBox?.width ?? 0)).toBeLessThanOrEqual(412)

  for (const name of ['Original', 'Rewritten', 'Undo', 'Reset']) {
    const box = await bar.getByRole('button', { name }).boundingBox()
    expect(box?.height).toBeGreaterThanOrEqual(44)
  }
})

test('a rewrite survives a reload, and Reset survives one too', async ({ page }) => {
  await openChapter(page)
  await expect
    .poll(() =>
      page.evaluate(async () => (await document.modelContext!.getTools()).map((tool) => tool.name)),
    )
    .toContain('rewrite_section')

  const rewritten = await agentCall(page, 'rewrite_section', {
    html:
      '<h2 id="kept">Chapter III — kept across a reload</h2>' +
      '<p>The ratio <math display="inline"><mi>d</mi></math> matters.</p>',
    css: '.kept { color: rebeccapurple; }',
    summary: 'Rewrote chapter III',
  })
  expect(rewritten.isError).toBe(false)
  await page.locator('.remaster-bar').getByRole('button', { name: 'Rewritten' }).click()
  await expect.poll(() => renderedHtml(page), { timeout: 15_000 }).toContain('id="kept"')

  // The real claim: reload the page, reopen the book, and the chapter is still
  // the agent's. Nothing here is in memory any more.
  await page.reload()
  await reopenChapter(page)

  const after = await renderedHtml(page)
  expect(after).toContain('id="kept"')
  expect(after).toContain('Chapter III — kept across a reload')
  expect(after).not.toContain('data-tex')

  // Its stylesheet and the agent's own words came back with it.
  const styled = await page.evaluate(() => {
    const view = document.querySelector('foliate-view') as unknown as {
      renderer?: { getContents?: () => { doc: Document }[] }
    }
    return (
      view?.renderer?.getContents?.()[0]?.doc?.getElementById('bookhand-remaster-style')
        ?.textContent ?? ''
    )
  })
  expect(styled).toContain('rebeccapurple')
  await expect(page.locator('.remaster-bar')).toContainText('Rewrote chapter III')

  // And Reset is just as durable: the book comes back as published and stays
  // that way, rather than the rewrite reappearing on the next visit.
  await page.locator('.remaster-bar').getByRole('button', { name: 'Reset' }).click()
  await expect.poll(() => renderedHtml(page), { timeout: 15_000 }).toContain('data-tex')

  await page.reload()
  await reopenChapter(page)

  expect(await renderedHtml(page)).toContain('data-tex')
  await expect(page.locator('.remaster-bar')).toBeHidden()
})
