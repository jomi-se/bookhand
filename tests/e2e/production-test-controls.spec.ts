import { expect, test } from '@playwright/test'

const testControlNames = [
  'force-opfs-initialization-failure',
  'delay-stale-open',
  'leave-book-open-unresolved',
  'leave-library-list-unresolved',
  'fail-library-list-immediately',
  'fail-section-load',
  'dump-raw-state',
] as const

test('production cannot activate validation-only controls', async ({ page }) => {
  const consoleErrors: string[] = []
  const offOriginRequests: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('request', (request) => {
    if (!request.url().startsWith('http://127.0.0.1:4173')) {
      offOriginRequests.push(request.url())
    }
  })

  const response = await page.goto(
    `/?${testControlNames.map((name) => `${name}=1`).join('&')}`,
  )
  await expect(page.getByRole('heading', { name: 'Let the page become the lesson.' })).toBeVisible()

  const policy = response?.headers()['content-security-policy'] ?? ''
  expect(policy).toContain("default-src 'self'")
  expect(policy).toContain("script-src 'self' 'wasm-unsafe-eval'")
  expect(policy).toContain("connect-src 'self'")
  expect(policy).toContain("object-src 'none'")
  expect(policy).toContain("form-action 'none'")
  expect(policy).toContain("frame-ancestors 'none'")

  const result = await page.evaluate((names) => {
    for (const name of names) {
      window.postMessage({ type: name, enabled: true }, location.origin)
      window.dispatchEvent(new CustomEvent(name, { detail: { enabled: true } }))
    }
    const testWindow = window as typeof window & {
      __BOOKHAND_TEST_CONTROLS__?: unknown
    }
    return {
      global: testWindow.__BOOKHAND_TEST_CONTROLS__,
      dataset: { ...document.documentElement.dataset },
    }
  }, testControlNames)

  expect(result.global).toBeUndefined()
  expect(result.dataset).toEqual({})
  expect(offOriginRequests).toEqual([])
  expect(consoleErrors).toEqual([])
})
