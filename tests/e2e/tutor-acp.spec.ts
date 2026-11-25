import { devices, expect, test, type Page } from '@playwright/test'

const gateway = process.env.BOOKHAND_TUTOR_FIXTURE_GATEWAY
const passphrase = process.env.BOOKHAND_TUTOR_FIXTURE_PASSPHRASE
const mobile = process.env.BOOKHAND_TUTOR_FIXTURE_MOBILE === '1'

test.use({
  ...(mobile ? devices['Pixel 7'] : {}),
  trace: 'off',
  screenshot: 'off',
  video: 'off',
})

async function passkey(page: Page) {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('WebAuthn.enable')
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2', transport: 'internal', hasResidentKey: true,
      hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true,
    },
  })
  return { cdp, authenticatorId }
}

test('Tutor pairs, streams and reads the open book through an ACP gateway', async ({ page, context }) => {
  test.skip(!gateway || !passphrase, 'Run with the isolated Tutor gateway fixture.')
  if (!gateway || !passphrase) return
  test.setTimeout(90_000)
  const origin = new URL(gateway)
  expect(origin.hostname).toBe('localhost')
  const cspErrors: string[] = []
  await page.addInitScript(() => {
    const seen: string[] = []
    Object.defineProperty(window, '__bookhandTutorCsp', { value: seen })
    document.addEventListener('securitypolicyviolation', (event) => {
      seen.push(`${event.effectiveDirective} ${event.blockedURI === "eval" ? "eval" : "resource"}`)
    })
  })
  page.on('pageerror', (error) => cspErrors.push(error.name))

  const owner = await context.newPage()
  const ownerKey = await passkey(owner)
  await owner.goto(new URL('/agent-connect/owner', origin).href)
  await owner.getByLabel('Passphrase', { exact: true }).fill(passphrase)
  await owner.getByRole('button', { name: 'Continue', exact: true }).click()
  await owner.getByRole('button', { name: 'Create a passkey', exact: true }).click()
  await expect(owner).toHaveURL(/\/agent-connect\/owner$/)
  const { credentials } = await ownerKey.cdp.send('WebAuthn.getCredentials', {
    authenticatorId: ownerKey.authenticatorId,
  })
  expect(credentials).toHaveLength(1)
  await owner.close()

  await page.goto('/')
  await page.locator('.book-open', { hasText: 'Calculus Made Easy' }).click()
  await page.getByRole('button', { name: 'Tutor', exact: true }).click()
  const tutor = page.getByRole('complementary', { name: 'Tutor' })
  await tutor.getByLabel('Gateway address').fill(origin.origin)
  const connect = tutor.getByRole('button', { name: 'Connect with Agent Connect' })
  let approval = page
  if (mobile) {
    await connect.click()
  } else {
    const pending = page.waitForEvent('popup')
    await connect.click()
    approval = await pending
  }
  await expect(approval.getByRole('heading', { name: /Allow Bookhand/ })).toBeVisible()
  const consentKey = await passkey(approval)
  await consentKey.cdp.send('WebAuthn.addCredential', {
    authenticatorId: consentKey.authenticatorId,
    credential: credentials[0]!,
  })
  await approval.getByRole('button', { name: 'Approve', exact: true }).click()
  await expect(tutor.getByText('Gateway connected')).toBeVisible()
  expect(new URL(page.url()).searchParams.has('code')).toBe(false)
  expect(await tutor.locator('.tutor-message').count()).toBe(0)

  for (const question of ['Read the current book for the fixture.', 'Read it again in the same conversation.']) {
    await tutor.getByLabel('Ask about your book').fill(question)
    await tutor.getByRole('button', { name: 'Send', exact: true }).click()
    await expect(tutor.locator('[data-role="assistant"]').last()).toContainText('Fixture read Calculus Made Easy')
    await expect(tutor.getByRole('button', { name: 'New conversation' })).toBeEnabled()
  }
  expect(await tutor.locator('[data-role="user"]').count()).toBe(2)
  expect(await tutor.locator('[data-role="assistant"]').count()).toBe(2)
  expect(cspErrors).toEqual([])
  expect(await page.evaluate(() => Reflect.get(window, '__bookhandTutorCsp'))).toEqual([])

  await page.reload()
  await page.locator('.book-open', { hasText: 'Calculus Made Easy' }).click()
  await page.getByRole('button', { name: 'Tutor', exact: true }).click()
  await expect(tutor.getByText('Last conversation restored.')).toBeVisible()
  await expect(tutor.locator('.tutor-message')).toHaveCount(4)
  await expect(tutor.getByLabel('Ask about your book')).toHaveValue('')
  await tutor.getByRole('button', { name: 'Disconnect' }).click()
  await expect(tutor.getByLabel('Gateway address')).toHaveValue(origin.origin)
})
