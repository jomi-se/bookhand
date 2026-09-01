// @vitest-environment node
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { strFromU8, unzipSync } from 'fflate'

const fixtureDirectory = resolve('tests/fixtures/epub')

const expectedHashes = {
  'corrupt-book.epub': '2bbf27dd476db948fd84f51c9ce1135f59070fcf6f8f5af4790e4e5d89de5477',
  'long-metadata.epub': '8c3bc64610b7d16020b5d558e8d181087da38f57638d2c2556c96344100d1d40',
  'malicious-book.epub': '9049415738827b41ff9f385a494d77178afd990b5eec4c9d4a877628e973a647',
  'missing-cover.epub': 'e96073304577789878b0b665af069f865a5d38c7791603e79f5470f75c0dd0d8',
  'tiny-book.epub': '9ad96f2624c1171ad697f77cfc5ab824c967e7b9d9a4b8d52fdc081c59575132',
  'unsupported-book.txt': '32dc86d9734b58896441ddc81e29a3687e096560d2de9ed9e370a5154246c676',
} as const

async function fixtureBytes(name: string) {
  return new Uint8Array(await readFile(resolve(fixtureDirectory, name)))
}

async function fixtureEntries(name: string) {
  return unzipSync(await fixtureBytes(name))
}

describe('EPUB fixture integrity', () => {
  it('pins every fixture byte-for-byte', async () => {
    for (const [name, expected] of Object.entries(expectedHashes)) {
      const hash = createHash('sha256').update(await fixtureBytes(name)).digest('hex')
      expect(hash, name).toBe(expected)
    }
  })

  it('stores the EPUB mimetype first and without compression', async () => {
    for (const name of [
      'tiny-book.epub',
      'malicious-book.epub',
      'long-metadata.epub',
      'missing-cover.epub',
    ]) {
      const bytes = await fixtureBytes(name)
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
      const fileNameLength = view.getUint16(26, true)
      const fileName = new TextDecoder().decode(bytes.slice(30, 30 + fileNameLength))

      expect(view.getUint32(0, true), name).toBe(0x04034b50)
      expect(view.getUint16(8, true), name).toBe(0)
      expect(fileName, name).toBe('mimetype')
      expect(strFromU8((await fixtureEntries(name)).mimetype), name).toBe(
        'application/epub+zip',
      )
    }
  })

  it('contains the tiny book nested TOC, selection anchor, SVG, MathML, and caption', async () => {
    const entries = await fixtureEntries('tiny-book.epub')
    const nav = strFromU8(entries['OEBPS/nav.xhtml'])
    const chapter = strFromU8(entries['OEBPS/chapter-1.xhtml'])

    expect(Object.keys(entries)).toEqual(
      expect.arrayContaining([
        'META-INF/container.xml',
        'OEBPS/package.opf',
        'OEBPS/nav.xhtml',
        'OEBPS/chapter-1.xhtml',
        'OEBPS/chapter-2.xhtml',
        'OEBPS/slope.svg',
        'OEBPS/style.css',
      ]),
    )
    expect(nav).toMatch(/<ol><li>.*<ol>/s)
    expect(chapter).toContain('id="selection-anchor"')
    expect(chapter).toContain('<math xmlns="http://www.w3.org/1998/Math/MathML"')
    expect(chapter).toContain('<figcaption>')
    expect(chapter).toContain('alt="A line rising two units')
  })

  it('contains every malicious capability and unique remote resource sentinel', async () => {
    const entries = await fixtureEntries('malicious-book.epub')
    const contents = Object.values(entries)
      .map((entry) => strFromU8(entry))
      .join('\n')
    const sentinels = [
      'inline-script',
      'packaged-script',
      'localStorage.setItem',
      'sessionStorage.setItem',
      '/window-open',
      '/top-navigation',
      '/nested-top-navigation',
      '/form',
      '/frame',
      '/object',
      '/fetch',
      '/packaged-fetch',
      '/image',
      '/font.woff2',
      '/import.css',
      '/css-image',
      '/bridge-discovered',
      'navigator?.modelContext',
      'parent.__BOOKHAND_WEBMCP__',
    ]

    for (const sentinel of sentinels) expect(contents, sentinel).toContain(sentinel)
    expect(contents).toContain('If this paragraph renders')
    expect(contents).toContain('src="safe.svg"')
  })

  it('keeps long metadata and missing-cover cases distinct', async () => {
    const longPackage = strFromU8(
      (await fixtureEntries('long-metadata.epub'))['OEBPS/package.opf'],
    )
    const missingCoverPackage = strFromU8(
      (await fixtureEntries('missing-cover.epub'))['OEBPS/package.opf'],
    )

    expect(longPackage.match(/for Responsive Overflow Testing/g)?.length).toBe(12)
    expect(longPackage.match(/With An Excessively Long Display Name/g)?.length).toBe(8)
    expect(missingCoverPackage).not.toMatch(/properties="cover-image"/i)
    expect(missingCoverPackage).not.toMatch(/media-type="image\//i)
  })

  it('keeps corrupt and unsupported fixtures outside the valid EPUB corpus', async () => {
    const corruptBytes = await fixtureBytes('corrupt-book.epub')
    expect(() => unzipSync(corruptBytes)).toThrow()
    expect(new TextDecoder().decode(await fixtureBytes('unsupported-book.txt'))).toContain(
      'not an EPUB',
    )
  })
})
