import { expect, test } from '@playwright/test'

test('the three judging books seed through the ordinary library and open', async ({ page }) => {
  await page.goto('/')

  const books = page.locator('.book-open')
  await expect(books).toHaveCount(3, { timeout: 30_000 })

  for (const title of ['Calculus Made Easy', 'Relativity', 'Flatland']) {
    await page.locator('.book-open', { hasText: title }).click()
    await expect(page.locator('.reader-identity')).toContainText(title)
    await expect
      .poll(
        () => page.evaluate(() => {
          const view = document.querySelector('foliate-view') as unknown as {
            renderer?: { getContents?: () => { doc: Document }[] }
          }
          return view?.renderer?.getContents?.()[0]?.doc?.body?.innerHTML.length ?? 0
        }),
        { timeout: 30_000 },
      )
      .toBeGreaterThan(50)
    await page.getByRole('button', { name: 'Library' }).click()
    await expect(page.locator('.book-open', { hasText: title })).toBeVisible()
  }
})
