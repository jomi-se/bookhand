import { expect, test, type Page } from '@playwright/test'

test.skip(!process.env.BOOKHAND_TEST_HARNESS, 'requires the test-harness Vite build')

interface IndexControls {
  indexPauseAfterCommittedBatch(): void
  indexFailBeforeChunk(chunkId?: string): void
}

async function controls(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => '__BOOKHAND_TEST_CONTROLS__' in window)).toBe(true)
}

async function invoke(page: Page, name: keyof IndexControls) {
  await page.evaluate((method) => {
    const control = (window as typeof window & { __BOOKHAND_TEST_CONTROLS__?: IndexControls })
      .__BOOKHAND_TEST_CONTROLS__
    if (!control) throw new Error('Index test controls are unavailable')
    control[method]()
  }, name)
}

async function openCalculus(page: Page) {
  const row = page.locator('.book-open', { hasText: 'Calculus Made Easy' })
  await expect(row).toBeVisible({ timeout: 20_000 })
  await row.click()
  await expect(page.locator('.reader')).toBeVisible()
}

test('a committed batch can pause, cancel, leave reading usable, and resume after reopening', async ({ page }) => {
  await page.goto('/')
  await controls(page)
  await invoke(page, 'indexPauseAfterCommittedBatch')
  await openCalculus(page)

  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Pause indexing' })).toBeVisible({ timeout: 20_000 })
  await page.getByRole('button', { name: 'Pause indexing' }).click()
  await expect(page.getByRole('button', { name: 'Resume indexing' })).toBeVisible({ timeout: 20_000 })

  await page.getByRole('button', { name: 'Close Search' }).click()
  await page.getByRole('button', { name: 'Next page' }).click()
  await expect(page.locator('.reader')).toBeVisible()
  await page.getByRole('button', { name: 'Library' }).click()
  await openCalculus(page)
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await expect(page.getByText(/Preparing search|Search ready/)).toBeVisible({ timeout: 20_000 })
})

test('an injected pre-chunk failure rolls back and Retry keeps the reader alive', async ({ page }) => {
  await page.goto('/')
  await controls(page)
  await invoke(page, 'indexFailBeforeChunk')
  await openCalculus(page)

  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await expect(page.getByText(/Search paused.*Injected index failure/)).toBeVisible({ timeout: 20_000 })
  await expect(page.getByRole('button', { name: 'Resume indexing' })).toBeVisible()
  await page.getByRole('button', { name: 'Resume indexing' }).dblclick()
  await expect(page.getByText(/Preparing search|Search ready/)).toBeVisible({ timeout: 20_000 })

  await page.getByRole('button', { name: 'Close Search' }).click()
  await page.getByRole('button', { name: 'Next page' }).click()
  await expect(page.locator('.reader')).toBeVisible()
})

test('a genuinely small book reaches ready through the reader-owned indexer', async ({ page }) => {
  await page.goto('/')
  await controls(page)
  await expect(page.getByRole('heading', { name: 'All books' })).toBeVisible()
  await page.locator('input[type=file]').setInputFiles('tests/fixtures/epub/tiny-book.epub')
  const row = page.locator('.book-open', { hasText: 'The Tiny Book of Slopes' })
  await expect(row).toBeVisible({ timeout: 20_000 })
  await row.click()
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await expect(page.getByText('Search ready', { exact: true })).toBeVisible({ timeout: 30_000 })
  await page.getByLabel('Words or phrase').fill('slope')
  await page.getByRole('button', { name: 'Search', exact: true }).last().click()
  await expect(page.locator('.search-results button').first()).toBeVisible()
})
