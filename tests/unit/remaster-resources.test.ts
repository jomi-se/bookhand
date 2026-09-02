import { describe, expect, it } from 'vitest'
import { buildResourceMap, translateResources } from '../../src/remaster/resources.ts'

function parse(body: string): Document {
  return new DOMParser().parseFromString(
    `<!DOCTYPE html><html><body>${body}</body></html>`,
    'text/html',
  )
}

describe('translating an agent’s package-relative references', () => {
  it('learns what the loader made of each of the publisher’s references', () => {
    const raw = parse('<img src="images/fig4.svg"><a href="ch4.xhtml">next</a>')
    const loaded = parse('<img src="blob:x/1"><a href="blob:x/2">next</a>')

    const map = buildResourceMap(raw, loaded)

    expect(map.get('images/fig4.svg')).toBe('blob:x/1')
    expect(map.get('ch4.xhtml')).toBe('blob:x/2')
  })

  it('rewrites an agent’s markup with what the loader produced', () => {
    const raw = parse('<img src="images/fig4.svg">')
    const loaded = parse('<img src="blob:x/1">')
    const map = buildResourceMap(raw, loaded)

    const agent = parse('<figure><img src="images/fig4.svg" alt="Fig. 4"></figure>')
    translateResources(agent, map)

    expect(agent.querySelector('img')?.getAttribute('src')).toBe('blob:x/1')
  })

  it('translates every candidate of a srcset, not the string as a whole', () => {
    const raw = parse('<img srcset="images/a.png 1x, images/b.png 2x">')
    const loaded = parse('<img srcset="blob:x/a 1x, blob:x/b 2x">')
    const map = buildResourceMap(raw, loaded)

    const agent = parse('<img srcset="images/b.png 2x, images/a.png 1x">')
    translateResources(agent, map)

    expect(agent.querySelector('img')?.getAttribute('srcset')).toBe('blob:x/b 2x, blob:x/a 1x')
  })

  it('translates url() in both inline styles and stylesheets', () => {
    const raw = parse('<img src="images/rule.png">')
    const loaded = parse('<img src="blob:x/rule">')
    const map = buildResourceMap(raw, loaded)

    const agent = parse(
      '<style>.a { background: url(images/rule.png); }</style>' +
        '<p style="background: url(images/rule.png)">x</p>',
    )
    translateResources(agent, map)

    expect(agent.querySelector('style')?.textContent).toContain('blob:x/rule')
    expect(agent.querySelector('p')?.getAttribute('style')).toContain('blob:x/rule')
  })

  it('leaves a reference it does not recognise alone', () => {
    // An anchor, a data: image, or a genuine mistake — none is improved by
    // inventing a URL for it.
    const map = buildResourceMap(parse('<img src="a.png">'), parse('<img src="blob:x/a">'))
    const agent = parse('<a href="#section-2">jump</a><img src="unknown.png">')
    translateResources(agent, map)

    expect(agent.querySelector('a')?.getAttribute('href')).toBe('#section-2')
    expect(agent.querySelector('img')?.getAttribute('src')).toBe('unknown.png')
  })

  it('translates nothing rather than wrongly when the documents disagree', () => {
    // Different node counts mean the pairing is not trustworthy, and a wrong
    // translation is worse than an untranslated reference.
    const raw = parse('<img src="a.png"><img src="b.png">')
    const loaded = parse('<img src="blob:x/a">')
    expect(buildResourceMap(raw, loaded).size).toBe(0)
  })
})
