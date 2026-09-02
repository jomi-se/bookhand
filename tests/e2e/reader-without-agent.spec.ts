import { expect, test, type Page } from '@playwright/test'

/**
 * The companion to `webmcp-agent.spec.ts`, deliberately without the
 * `WebMCPTesting` switch: this is the ordinary browser a person uses, where no
 * agent runtime exists at all. WebMCP is an addition to Bookhand, never a
 * dependency, so the reader must be whole here.
 */

async function openBook(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Library', level: 1 })).toBeVisible()
  const row = page.locator('.book-open', { hasText: 'Calculus Made Easy' })
  await expect(row).toBeVisible({ timeout: 20_000 })
  await row.click()
}

test('the reader is unchanged when no agent runtime exists', async ({ page }) => {
  await openBook(page)
  expect(await page.evaluate(() => 'modelContext' in document)).toBe(false)

  await page.getByRole('button', { name: 'Study' }).click()
  await page.getByRole('button', { name: 'Add study block' }).click()
  await expect(page.getByRole('button', { name: /quotation/i })).toBeVisible()
  await expect(page.getByRole('complementary', { name: 'Study' })).not.toContainText(
    'Agent activity',
  )
})
