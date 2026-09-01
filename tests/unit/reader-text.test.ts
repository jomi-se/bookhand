import { describe, expect, it } from 'vitest'
import {
  extractDocumentText,
  fingerprintText,
  normalizeBookText,
} from '../../src/reader/index.ts'

describe('reader text snapshots', () => {
  it('normalizes visible content while excluding active and hidden content', () => {
    const document = new DOMParser().parseFromString(
      `<html><body>
        <p> First\n paragraph. </p>
        <script>window.bad = true</script>
        <style>.bad { display: block }</style>
        <p hidden>Hidden sentence</p>
        <figure><img alt="An increasing curve"><figcaption>Figure 7</figcaption></figure>
      </body></html>`,
      'text/html',
    )
    expect(extractDocumentText(document)).toBe(
      'First paragraph. An increasing curve Figure 7',
    )
  })

  it('produces a stable short fingerprint from normalized text', () => {
    expect(normalizeBookText(' Alpha\n exact  ')).toBe('Alpha exact')
    expect(fingerprintText(' Alpha\n exact  ')).toBe(fingerprintText('Alpha exact'))
    expect(fingerprintText('Alpha exact')).not.toBe(fingerprintText('Beta exact'))
  })
})
