/**
 * Keep Foliate section documents inside the iframe it already created.
 *
 * Foliate normally points that iframe at a generated blob URL. Browser-control
 * hosts may block post-load blob subframe navigation, which makes an ordinary
 * cross-chapter jump destroy the visible reader. The EPUB loader has already
 * resolved every resource to a usable blob URL, so the parent can fetch the
 * document payload, assign it through `srcdoc`, and let Foliate continue its
 * normal load/render sequence without assigning the blob URL to `iframe.src`.
 *
 * The dependency is pinned to a commit. These exact replacements deliberately
 * fail the build if upstream changes its loader instead of silently losing the
 * compatibility boundary.
 */
export function foliateStableFrame() {
  return {
    name: 'bookhand-foliate-stable-frame',
    enforce: 'pre',
    transform(code, id) {
      const path = id.split('?', 1)[0].replaceAll('\\', '/')
      if (!path.endsWith('/node_modules/foliate-js/paginator.js')) return

      const promiseNeedle = 'return new Promise(resolve => {'
      const navigationNeedle = 'this.#iframe.src = src'
      if (!code.includes(promiseNeedle) || !code.includes(navigationNeedle)) {
        throw new Error('Pinned Foliate paginator loader changed; stable-frame patch was not applied')
      }

      const stableLoad = `if (src.startsWith('blob:')) {
                fetch(src)
                    .then(response => response.text())
                    .then(source => {
                        this.container.setAttribute('data-bookhand-frame-transport', 'stable-document')
                        const loads = Number(this.container.getAttribute('data-bookhand-stable-frame-loads') ?? 0)
                        this.container.setAttribute('data-bookhand-stable-frame-loads', String(loads + 1))
                        this.#iframe.srcdoc = source
                    })
                    .catch(reject)
            } else this.#iframe.src = src`

      return {
        code: code
          .replace(promiseNeedle, 'return new Promise((resolve, reject) => {')
          .replace(navigationNeedle, stableLoad),
        map: null,
      }
    },
  }
}
