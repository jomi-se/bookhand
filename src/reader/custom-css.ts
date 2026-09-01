/**
 * Reader-supplied CSS is applied inside the book document, where a remote
 * `url()` would become a network request carrying reading activity off the
 * device. The production CSP already refuses those loads; this bound removes
 * them at the source so the feature cannot depend on a header to stay local,
 * and so a person editing CSS is not silently generating blocked requests.
 */
export const MAXIMUM_CUSTOM_CSS_LENGTH = 20_000

const REMOTE_URL = /url\(\s*(['"]?)\s*(?:[a-z][a-z0-9+.-]*:)?\/\/[^)]*\1\s*\)/gi
const IMPORT_RULE = /@import\b[^;{]*(;|(?=\{))/gi
const REMOTE_SCHEME_URL = /url\(\s*(['"]?)\s*(?!data:|blob:)[a-z][a-z0-9+.-]*:[^)]*\1\s*\)/gi

export interface BoundedCss {
  readonly css: string
  /** What was removed, so the panel can say so rather than silently editing. */
  readonly removed: readonly string[]
}

export function boundCustomCss(input: string): BoundedCss {
  const removed: string[] = []
  let css = input.slice(0, MAXIMUM_CUSTOM_CSS_LENGTH)
  if (input.length > MAXIMUM_CUSTOM_CSS_LENGTH) removed.push('over-long CSS')

  css = css.replace(IMPORT_RULE, () => {
    if (!removed.includes('@import')) removed.push('@import')
    return ''
  })

  const dropUrl = () => {
    if (!removed.includes('remote url()')) removed.push('remote url()')
    return 'none'
  }
  css = css.replace(REMOTE_URL, dropUrl).replace(REMOTE_SCHEME_URL, dropUrl)

  return { css, removed }
}
