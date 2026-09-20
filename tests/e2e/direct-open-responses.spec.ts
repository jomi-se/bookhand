import { expect, test, type Page } from '@playwright/test'

const endpoint = 'https://inference.example/v1/responses'
const model = 'example/reader-model'
const token = 'bookhand-test-token-never-persist'

async function openTutor(page: Page) {
  await page.goto('/')
  const row = page.locator('.book-open', { hasText: 'Calculus Made Easy' })
  await expect(row).toBeVisible({ timeout: 30_000 })
  await row.click()
  await expect(page.locator('.reader')).toBeVisible()
  await page.getByRole('button', { name: 'Tutor', exact: true }).click()
  await expect(page.getByLabel('Connection method')).toBeVisible()
}

test('direct Open Responses keeps its bearer token out of browser persistence', async ({ page }) => {
  await openTutor(page)
  await page.getByLabel('Connection method').selectOption('direct')
  await page.getByLabel('Open Responses endpoint').fill(endpoint)
  await page.getByLabel('Model').fill(model)
  if (process.env.BOOKHAND_CAPTURE_DIRECT_UI) {
    await page.locator('.tutor-transcript').evaluate((element) => { element.scrollTop = 0 })
    await page.screenshot({ path: '.impeccable/review/direct-open-responses-desktop.png', fullPage: true })
    await page.locator('.tutor-transcript').evaluate((element) => { element.scrollTop = element.scrollHeight })
    await page.screenshot({ path: '.impeccable/review/direct-open-responses-desktop-action.png', fullPage: true })
  }
  await page.getByLabel('Bearer token').fill(token)
  await page.getByRole('button', { name: 'Use direct API' }).click()

  await expect(page.getByText('Direct API ready in this tab')).toBeVisible()
  const persisted = await page.evaluate(() => ({
    local: JSON.stringify(localStorage),
    session: JSON.stringify(sessionStorage),
  }))
  expect(persisted.local).not.toContain(token)
  expect(persisted.session).not.toContain(token)
  expect(persisted.local).toContain(endpoint)
  expect(persisted.local).toContain(model)

  await page.getByRole('button', { name: 'Disconnect' }).click()
  await expect(page.getByLabel('Bearer token')).toHaveValue('')
  await expect(page.getByLabel('Open Responses endpoint')).toHaveValue(endpoint)
  await expect(page.getByLabel('Model')).toHaveValue(model)

  await page.reload()
  await openTutor(page)
  await expect(page.getByLabel('Connection method')).toHaveValue('direct')
  await expect(page.getByLabel('Open Responses endpoint')).toHaveValue(endpoint)
  await expect(page.getByLabel('Model')).toHaveValue(model)
  await expect(page.getByLabel('Bearer token')).toHaveValue('')
})

test('the direct connection form remains usable at a phone viewport', async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 860 })
  await openTutor(page)
  await page.getByLabel('Connection method').selectOption('direct')

  await expect(page.getByLabel('Open Responses endpoint')).toBeVisible()
  await expect(page.getByLabel('Model')).toBeVisible()
  await expect(page.getByLabel('Bearer token')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Learn about Agent Connect' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(412)
  if (process.env.BOOKHAND_CAPTURE_DIRECT_UI) {
    await page.screenshot({ path: '.impeccable/review/direct-open-responses-mobile.png', fullPage: true })
    await page.locator('.tutor-transcript').evaluate((element) => { element.scrollTop = element.scrollHeight })
    await page.screenshot({ path: '.impeccable/review/direct-open-responses-mobile-action.png', fullPage: true })
  }
})
