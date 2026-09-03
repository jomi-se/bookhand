/**
 * Keep Foliate's paginator on one same-origin iframe.
 *
 * Browser-controlled ChatGPT tabs reject post-load `blob:` subframe
 * navigations. Foliate normally destroys its current iframe and points a new
 * one at a generated section blob on every chapter change. This compatibility
 * patch instead loads a same-origin empty frame once, fetches Foliate's local
 * blob in the parent, parses it with its declared MIME type, and replaces the
 * existing frame document in place.
 *
 * The dependency is pinned. Exact source matches make an upstream change fail
 * the build instead of silently restoring the blocked transport.
 */
export function foliatePersistentFrame() {
  return {
    name: 'bookhand-foliate-persistent-frame',
    enforce: 'pre',
    transform(code, id) {
      const path = id.split('?', 1)[0].replaceAll('\\', '/')
      if (!path.endsWith('/node_modules/foliate-js/paginator.js')) return

      const iframeField = "    #iframe = document.createElement('iframe')"
      const constructorEnd = "        this.#iframe.setAttribute('scrolling', 'no')"
      const originalLoad = `    async load(src, afterLoad, beforeRender) {
        if (typeof src !== 'string') throw new Error(\`\${src} is not string\`)
        return new Promise(resolve => {
            this.#iframe.addEventListener('load', () => {
                const doc = this.document
                afterLoad?.(doc)

                // it needs to be visible for Firefox to get computed style
                this.#iframe.style.display = 'block'
                const { vertical, rtl } = getDirection(doc)
                const background = getBackground(doc)
                this.#iframe.style.display = 'none'

                this.#vertical = vertical
                this.#rtl = rtl

                this.#contentRange.selectNodeContents(doc.body)
                const layout = beforeRender?.({ vertical, rtl, background })
                this.#iframe.style.display = 'block'
                this.render(layout)
                this.#observer.observe(doc.body)

                // the resize observer above doesn't work in Firefox
                // (see https://bugzilla.mozilla.org/show_bug.cgi?id=1832939)
                // until the bug is fixed we can at least account for font load
                doc.fonts.ready.then(() => this.expand())

                resolve()
            }, { once: true })
            this.#iframe.src = src
        })
    }`
      const persistentLoad = `    async load(src, afterLoad, beforeRender) {
        if (typeof src !== 'string') throw new Error(\`\${src} is not string\`)
        const response = await fetch(src)
        if (!response.ok) throw new Error(\`Could not read EPUB section: \${response.status}\`)
        const source = await response.text()
        const contentType = response.headers.get('content-type') ?? ''
        const parserType = contentType.includes('xhtml')
            ? 'application/xhtml+xml'
            : 'text/html'
        const parsed = new DOMParser().parseFromString(source, parserType)
        if (parsed.querySelector('parsererror')) throw new Error('Could not parse EPUB section')

        await this.#frameReady
        const previous = this.document
        if (previous?.body) this.#observer.unobserve(previous.body)
        const root = previous.importNode(parsed.documentElement, true)
        previous.replaceChild(root, previous.documentElement)
        const doc = this.document
        afterLoad?.(doc)

        // it needs to be visible for Firefox to get computed style
        this.#iframe.style.display = 'block'
        const { vertical, rtl } = getDirection(doc)
        const background = getBackground(doc)
        this.#iframe.style.display = 'none'

        this.#vertical = vertical
        this.#rtl = rtl

        this.#contentRange.selectNodeContents(doc.body)
        const layout = beforeRender?.({ vertical, rtl, background })
        this.#iframe.style.display = 'block'
        this.render(layout)
        this.#observer.observe(doc.body)
        doc.fonts.ready.then(() => this.expand())

        const loads = Number(this.container.getAttribute('data-bookhand-frame-loads') ?? 0)
        this.container.setAttribute('data-bookhand-frame-transport', 'persistent-same-origin')
        this.container.setAttribute('data-bookhand-frame-loads', String(loads + 1))
    }`
      const originalCreateView = `    #createView() {
        if (this.#view) {
            this.#view.destroy()
            this.#container.removeChild(this.#view.element)
        }
        this.#view = new View({
            container: this,
            onExpand: () => this.#scrollToAnchor(this.#anchor),
        })
        this.#container.append(this.#view.element)
        return this.#view
    }`
      const persistentCreateView = `    #createView() {
        if (this.#view) return this.#view
        this.#view = new View({
            container: this,
            onExpand: () => this.#scrollToAnchor(this.#anchor),
        })
        this.#container.append(this.#view.element)
        return this.#view
    }`
      const originalOverlayer = `    set overlayer(overlayer) {
        this.#overlayer = overlayer
        this.#element.append(overlayer.element)
    }`
      const persistentOverlayer = `    set overlayer(overlayer) {
        this.#overlayer?.element.remove()
        this.#overlayer = overlayer
        this.#element.append(overlayer.element)
    }`

      const needles = [iframeField, constructorEnd, originalLoad, originalCreateView, originalOverlayer]
      if (needles.some((needle) => !code.includes(needle))) {
        throw new Error('Pinned Foliate paginator changed; persistent-frame patch was not applied')
      }

      return {
        code: code
          .replace(iframeField, `${iframeField}\n    #frameReady`)
          .replace(
            constructorEnd,
            `${constructorEnd}\n        this.#frameReady = new Promise((resolve, reject) => {\n            this.#iframe.addEventListener('load', resolve, { once: true })\n            this.#iframe.addEventListener('error', reject, { once: true })\n        })\n        this.#iframe.src = new URL('reader-frame.html', document.baseURI).href`,
          )
          .replace(originalLoad, persistentLoad)
          .replace(originalCreateView, persistentCreateView)
          .replace(originalOverlayer, persistentOverlayer),
        map: null,
      }
    },
  }
}
