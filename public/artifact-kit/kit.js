/* Bookhand artifact kit (ADR 0013).
 *
 * Runs inside the sandboxed, opaque-origin artifact frame. It receives an
 * artifact from Bookhand over postMessage, renders it (running its scripts),
 * and offers smart building blocks. Every request that reaches outside the
 * frame — navigating the book, opening a link, keeping a snippet, writing a
 * memory — is a message Bookhand decides to honour.
 */
;(() => {
  'use strict'

  const LIBRARIES = {
    katex: {
      css: 'https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/katex.min.css',
      js: 'https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/katex.min.js',
      global: 'katex',
    },
    d3: { js: 'https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js', global: 'd3' },
    rough: { js: 'https://cdn.jsdelivr.net/npm/roughjs@4.6.6/bundled/rough.js', global: 'rough' },
    confetti: {
      js: 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js',
      global: 'confetti',
    },
    gsap: { js: 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js', global: 'gsap' },
    hljs: {
      js: 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js',
      global: 'hljs',
    },
  }

  const loading = new Map()
  const listeners = { theme: new Set(), motion: new Set(), render: new Set() }

  function post(message) {
    window.parent.postMessage({ bh: true, ...message }, '*')
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = src
      script.onload = resolve
      script.onerror = () => reject(new Error(`Could not load ${src}`))
      document.head.append(script)
    })
  }

  function loadStyle(href) {
    return new Promise((resolve) => {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = href
      link.onload = resolve
      link.onerror = resolve
      document.head.append(link)
    })
  }

  /** Load a known library by name, or any trusted-CDN script by URL. */
  function load(...names) {
    return Promise.all(
      names.map((name) => {
        if (loading.has(name)) return loading.get(name)
        const lib = LIBRARIES[name]
        const promise = lib
          ? Promise.all([lib.css ? loadStyle(lib.css) : null, loadScript(lib.js)]).then(
              () => window[lib.global],
            )
          : loadScript(name)
        loading.set(name, promise)
        return promise
      }),
    ).then((values) => (values.length === 1 ? values[0] : values))
  }

  // ——— Theme and motion ————————————————————————————————

  const state = {
    theme: { name: 'light' },
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    artifact: undefined,
    anchors: [],
  }

  function applyTheme(theme) {
    state.theme = theme
    const root = document.documentElement
    root.dataset.theme = theme.name
    const map = {
      canvas: '--bh-canvas',
      ink: '--bh-ink',
      muted: '--bh-muted',
      rule: '--bh-rule',
      accent: '--bh-accent',
      accentQuiet: '--bh-accent-quiet',
      raised: '--bh-raised',
    }
    for (const [key, variable] of Object.entries(map)) {
      if (theme[key]) root.style.setProperty(variable, theme[key])
    }
    for (const listener of listeners.theme) listener(tokens())
  }

  function applyMotion(reduced) {
    state.reducedMotion = Boolean(reduced)
    document.documentElement.toggleAttribute('data-reduced-motion', state.reducedMotion)
    for (const listener of listeners.motion) listener(state.reducedMotion)
  }

  /** Resolved colours, for drawing code that cannot read CSS variables. */
  function tokens() {
    const style = getComputedStyle(document.documentElement)
    const read = (name) => style.getPropertyValue(name).trim()
    return {
      name: state.theme.name,
      dark: state.theme.name === 'dark',
      canvas: read('--bh-canvas'),
      ink: read('--bh-ink'),
      muted: read('--bh-muted'),
      rule: read('--bh-rule'),
      accent: read('--bh-accent'),
      raised: read('--bh-raised'),
      wash: read('--bh-wash'),
      terracotta: read('--bh-terracotta'),
      amber: read('--bh-amber'),
      sky: read('--bh-sky'),
      moss: read('--bh-moss'),
      plum: read('--bh-plum'),
      display: read('--bh-display'),
      serif: read('--bh-serif'),
      sans: read('--bh-sans'),
      mono: read('--bh-mono'),
      hand: read('--bh-hand'),
    }
  }

  // ——— Size reporting ——————————————————————————————————

  let lastHeight = 0
  const sizeObserver = new ResizeObserver(() => {
    const root = document.getElementById('bh-root')
    const height = Math.ceil(root.offsetTop + root.getBoundingClientRect().height)
    if (Math.abs(height - lastHeight) < 1) return
    lastHeight = height
    post({ type: 'height', height })
  })

  // ——— Rendering an artifact ———————————————————————————————

  async function runScripts(container) {
    for (const old of [...container.querySelectorAll('script')]) {
      const script = document.createElement('script')
      for (const { name, value } of [...old.attributes]) script.setAttribute(name, value)
      if (old.src) {
        await new Promise((resolve) => {
          script.onload = resolve
          script.onerror = resolve
          old.replaceWith(script)
        })
      } else {
        script.textContent = old.textContent
        old.replaceWith(script)
      }
    }
  }

  async function render(message) {
    const root = document.getElementById('bh-root')
    document.documentElement.dataset.surface = message.surface || 'artifact'
    state.artifact = message.artifact
    state.anchors = message.anchors || []
    if (message.theme) applyTheme(message.theme)
    applyMotion(message.reducedMotion)
    root.innerHTML = message.html
    root.classList.toggle('bh-enter', message.surface !== 'preview' && message.animate !== false)
    await runScripts(root)
    for (const listener of listeners.render) listener()
    sizeObserver.observe(document.documentElement)
    sizeObserver.observe(root)
    post({ type: 'rendered' })
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window.parent) return
    const message = event.data
    if (!message || message.bh !== true) return
    if (message.type === 'render') void render(message)
    if (message.type === 'theme') applyTheme(message.theme)
    if (message.type === 'motion') applyMotion(message.reducedMotion)
  })

  // ——— Links leave through Bookhand ————————————————————————

  document.addEventListener('click', (event) => {
    const link = event.target instanceof Element ? event.target.closest('a[href]') : null
    if (!link) return
    const href = link.getAttribute('href') || ''
    event.preventDefault()
    if (href.startsWith('#')) {
      document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' })
      return
    }
    if (href.startsWith('bookhand:artifact/')) return post({ type: 'open', id: href.slice(18) })
    if (href.startsWith('bookhand:cfi/')) return post({ type: 'navigate', cfi: decodeURIComponent(href.slice(13)) })
    if (/^https?:/i.test(href)) post({ type: 'link', url: href })
  })

  // ——— Keep a selected part ————————————————————————————————

  let pill
  function ensurePill() {
    if (pill) return pill
    pill = document.createElement('button')
    pill.type = 'button'
    pill.className = 'bh-keep-pill'
    pill.textContent = '＋ Keep this'
    pill.addEventListener('pointerdown', (event) => event.preventDefault())
    pill.addEventListener('click', () => {
      const selection = document.getSelection()
      const text = selection ? selection.toString().trim() : ''
      if (!text) return
      const range = selection.getRangeAt(0)
      const holder = document.createElement('div')
      holder.append(range.cloneContents())
      post({ type: 'keep', text, html: holder.innerHTML })
      selection.removeAllRanges()
      pill.removeAttribute('data-show')
    })
    document.body.append(pill)
    return pill
  }

  document.addEventListener('selectionchange', () => {
    if (document.documentElement.dataset.surface !== 'message') return
    const selection = document.getSelection()
    const text = selection ? selection.toString().trim() : ''
    const button = ensurePill()
    if (!text || !selection.rangeCount) {
      button.removeAttribute('data-show')
      return
    }
    const rect = selection.getRangeAt(0).getBoundingClientRect()
    button.style.left = `${Math.min(Math.max(rect.left + rect.width / 2, 60), innerWidth - 60)}px`
    button.style.top = `${Math.max(rect.top - 8, 40)}px`
    button.setAttribute('data-show', '')
  })

  // ——— Smart building blocks ———————————————————————————————

  /** <bh-quote cfi="…" cite="Chapter II">Words from the book</bh-quote> */
  class BhQuote extends HTMLElement {
    connectedCallback() {
      if (this.dataset.ready) return
      this.dataset.ready = '1'
      this.setAttribute('role', 'link')
      this.tabIndex = 0
      const source = document.createElement('span')
      source.className = 'bh-quote-source'
      source.textContent = this.getAttribute('cite') || 'In the book'
      this.append(source)
      const go = () => {
        const cfi = this.getAttribute('cfi')
        const section = this.getAttribute('section')
        const find = this.getAttribute('find') || this.firstChild?.textContent?.trim().slice(0, 80)
        if (cfi) post({ type: 'navigate', cfi })
        else if (section) post({ type: 'navigate', sectionIndex: Number(section), text: find })
      }
      this.addEventListener('click', go)
      this.addEventListener('keydown', (event) => event.key === 'Enter' && go())
    }
  }

  /** <bh-math>x^2</bh-math> or <bh-math block>…</bh-math> */
  class BhMath extends HTMLElement {
    connectedCallback() {
      if (this.dataset.ready) return
      this.dataset.ready = '1'
      const source = this.textContent
      this.setAttribute('aria-label', source)
      load('katex').then((katex) => {
        katex.render(source, this, {
          displayMode: this.hasAttribute('block'),
          throwOnError: false,
        })
        this.classList.add('bh-ready')
      })
    }
  }

  /** <bh-code lang="python">…</bh-code> */
  class BhCode extends HTMLElement {
    connectedCallback() {
      if (this.dataset.ready) return
      this.dataset.ready = '1'
      const lang = this.getAttribute('lang') || 'plaintext'
      const source = this.textContent.replace(/^\n/, '').replace(/\s+$/, '')
      this.textContent = ''
      const pre = document.createElement('pre')
      const code = document.createElement('code')
      code.textContent = source
      pre.append(code)
      const label = document.createElement('span')
      label.className = 'bh-code-lang'
      label.textContent = lang
      this.append(label, pre)
      load('hljs').then((hljs) => {
        code.innerHTML = hljs.highlight(source, { language: lang, ignoreIllegals: true }).value
      })
    }
  }

  /** <bh-scrub key="dx" min="0" max="1" step="0.01" value="0.1" digits="2"> */
  class BhScrub extends HTMLElement {
    connectedCallback() {
      if (this.dataset.ready) return
      this.dataset.ready = '1'
      const min = Number(this.getAttribute('min') ?? 0)
      const max = Number(this.getAttribute('max') ?? 100)
      const step = Number(this.getAttribute('step') ?? 1)
      const pixelsPerStep = Number(this.getAttribute('sensitivity') ?? 4)
      const digits = Number(this.getAttribute('digits') ?? (step < 1 ? 2 : 0))
      const prefix = this.getAttribute('prefix') ?? ''
      const suffix = this.getAttribute('suffix') ?? ''
      let value = Number(this.getAttribute('value') ?? min)
      const label = document.createElement('span')
      this.textContent = ''
      this.append(label)
      this.setAttribute('role', 'slider')
      this.setAttribute('aria-valuemin', String(min))
      this.setAttribute('aria-valuemax', String(max))
      this.tabIndex = 0
      const format = () => {
        const custom = this.format
        return typeof custom === 'function' ? custom(value) : `${prefix}${value.toFixed(digits)}${suffix}`
      }
      const set = (next, emit = true) => {
        value = Math.min(max, Math.max(min, Math.round(next / step) * step))
        label.textContent = format()
        this.setAttribute('aria-valuenow', String(value))
        if (emit) this.dispatchEvent(new CustomEvent('input', { detail: value, bubbles: true }))
      }
      Object.defineProperty(this, 'value', { get: () => value, set: (next) => set(next, false) })
      this.refresh = () => set(value, false)
      set(value, false)
      let startX = 0
      let startValue = 0
      this.addEventListener('pointerdown', (event) => {
        startX = event.clientX
        startValue = value
        this.setPointerCapture(event.pointerId)
        this.setAttribute('data-active', '')
      })
      this.addEventListener('pointermove', (event) => {
        if (!this.hasAttribute('data-active')) return
        set(startValue + Math.round((event.clientX - startX) / pixelsPerStep) * step)
      })
      const end = () => this.removeAttribute('data-active')
      this.addEventListener('pointerup', end)
      this.addEventListener('pointercancel', end)
      this.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowRight' || event.key === 'ArrowUp') set(value + step)
        if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') set(value - step)
      })
    }
  }

  /** <bh-reveal prompt="Question?">Answer</bh-reveal> */
  class BhReveal extends HTMLElement {
    connectedCallback() {
      if (this.dataset.ready) return
      this.dataset.ready = '1'
      const answer = [...this.childNodes]
      const inner = document.createElement('div')
      inner.className = 'bh-reveal-inner'
      const front = document.createElement('div')
      front.className = 'bh-reveal-face bh-reveal-front'
      const prompt = document.createElement('div')
      prompt.className = 'bh-reveal-prompt'
      prompt.textContent = this.getAttribute('prompt') || 'What do you think?'
      front.append(prompt)
      const back = document.createElement('div')
      back.className = 'bh-reveal-face bh-reveal-back'
      back.append(...answer)
      inner.append(front, back)
      this.append(inner)
      this.setAttribute('role', 'button')
      this.tabIndex = 0
      const toggle = () => this.toggleAttribute('open')
      this.addEventListener('click', toggle)
      this.addEventListener('keydown', (event) => event.key === 'Enter' && toggle())
    }
  }

  /** <bh-steps><bh-step>…</bh-step>…</bh-steps> */
  class BhSteps extends HTMLElement {
    connectedCallback() {
      if (this.dataset.ready) return
      this.dataset.ready = '1'
      const steps = [...this.querySelectorAll(':scope > bh-step')]
      const track = document.createElement('div')
      track.className = 'bh-steps-track'
      track.append(...steps)
      const nav = document.createElement('div')
      nav.className = 'bh-steps-nav'
      const back = document.createElement('button')
      back.className = 'bh-button quiet'
      back.textContent = 'Back'
      const dots = document.createElement('div')
      dots.className = 'bh-steps-dots'
      const dotEls = steps.map(() => dots.appendChild(document.createElement('span')))
      const next = document.createElement('button')
      next.className = 'bh-button'
      nav.append(back, dots, next)
      this.append(track, nav)
      let index = 0
      const show = (to) => {
        index = Math.max(0, Math.min(steps.length - 1, to))
        steps.forEach((step, i) => {
          step.dataset.state = i < index ? 'past' : i === index ? 'current' : 'future'
        })
        dotEls.forEach((dot, i) => dot.toggleAttribute('data-on', i === index))
        back.style.visibility = index === 0 ? 'hidden' : 'visible'
        next.textContent = index === steps.length - 1 ? 'Again' : 'Next'
        this.dispatchEvent(new CustomEvent('step', { detail: index }))
      }
      back.addEventListener('click', () => show(index - 1))
      next.addEventListener('click', () => show(index === steps.length - 1 ? 0 : index + 1))
      show(0)
    }
  }

  /**
   * <bh-choice><button data-option data-correct>…<span class="bh-why">…</span></button></bh-choice>
   */
  class BhChoice extends HTMLElement {
    connectedCallback() {
      if (this.dataset.ready) return
      this.dataset.ready = '1'
      for (const option of this.querySelectorAll('[data-option]')) {
        const why = option.querySelector('.bh-why')
        if (why) why.hidden = true
        option.addEventListener('click', () => {
          const right = option.hasAttribute('data-correct')
          option.dataset.result = right ? 'right' : 'wrong'
          if (why) why.hidden = false
          if (right) celebrate(option)
        })
      }
    }
  }

  customElements.define('bh-quote', BhQuote)
  customElements.define('bh-math', BhMath)
  customElements.define('bh-code', BhCode)
  customElements.define('bh-scrub', BhScrub)
  customElements.define('bh-reveal', BhReveal)
  customElements.define('bh-steps', BhSteps)
  customElements.define('bh-choice', BhChoice)
  customElements.define('bh-callout', class extends HTMLElement {})
  customElements.define('bh-margin', class extends HTMLElement {})

  /** A small burst of confetti from an element (quiet under reduced motion). */
  function celebrate(element) {
    if (state.reducedMotion) return
    load('confetti').then((confetti) => {
      const rect = element ? element.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 2, width: 0, height: 0 }
      const t = tokens()
      confetti({
        particleCount: 70,
        spread: 70,
        startVelocity: 32,
        scalar: 0.8,
        ticks: 160,
        origin: {
          x: (rect.left + rect.width / 2) / innerWidth,
          y: (rect.top + rect.height / 2) / innerHeight,
        },
        colors: [t.terracotta, t.amber, t.sky, t.moss, t.plum],
        disableForReducedMotion: true,
      })
    })
  }

  /** Spring toward a target; returns a stop function. */
  function spring(from, to, onUpdate, { stiffness = 170, damping = 18 } = {}) {
    if (state.reducedMotion) {
      onUpdate(to)
      return () => {}
    }
    let x = from
    let v = 0
    let last = performance.now()
    let frame = requestAnimationFrame(function tick(now) {
      const dt = Math.min(0.032, (now - last) / 1000)
      last = now
      const force = -stiffness * (x - to) - damping * v
      v += force * dt
      x += v * dt
      onUpdate(x)
      if (Math.abs(v) < 0.001 && Math.abs(x - to) < 0.0005) {
        onUpdate(to)
        return
      }
      frame = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(frame)
  }

  window.bh = {
    load,
    tokens,
    celebrate,
    spring,
    get reducedMotion() {
      return state.reducedMotion
    },
    get artifact() {
      return state.artifact
    },
    get anchors() {
      return state.anchors
    },
    onTheme(listener) {
      listeners.theme.add(listener)
      return () => listeners.theme.delete(listener)
    },
    onMotion(listener) {
      listeners.motion.add(listener)
      return () => listeners.motion.delete(listener)
    },
    /** Navigate the book: a CFI, or a section index and some text in it. */
    navigate(target, text) {
      if (typeof target === 'number') post({ type: 'navigate', sectionIndex: target, text })
      else post({ type: 'navigate', cfi: target })
    },
    open(id) {
      post({ type: 'open', id })
    },
    link(url) {
      post({ type: 'link', url })
    },
    remember(text) {
      post({ type: 'remember', text })
    },
    keep(text, html) {
      post({ type: 'keep', text, html: html ?? text })
    },
    toast(text) {
      post({ type: 'toast', text })
    },
  }

  post({ type: 'ready' })
})()
