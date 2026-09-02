/**
 * A bounded LaTeX subset compiled to MathML, deterministically.
 *
 * This exists because *Calculus Made Easy* — like most TeX-derived EPUBs from
 * Project Gutenberg — ships every variable and every equation as an image with
 * the real LaTeX parked in `data-tex`. The ground truth is already in the file.
 * Recovering it is a compilation, not an inference, so nothing here calls a
 * model, touches the network, or varies between runs.
 *
 * Two rules govern the whole module:
 *
 * 1. **Unknown input fails loudly and locally.** An unsupported command throws
 *    `TexUnsupportedError` naming itself. The caller keeps the original image
 *    for that one element and counts it. Guessing at mathematics is worse than
 *    declining to restore it.
 * 2. **Output is built, never parsed.** MathML is constructed node by node
 *    through `createElementNS`. No book-authored or agent-authored string is
 *    ever assigned to `innerHTML`, so a hostile `data-tex` is a parse failure
 *    rather than an injection.
 */

export const MATHML_NS = 'http://www.w3.org/1998/Math/MathML'

/** Bounds. A book is untrusted input; so is an agent's proposal. */
const MAX_INPUT = 4000
const MAX_NODES = 4000
const MAX_DEPTH = 32

export class TexUnsupportedError extends Error {
  readonly construct: string
  constructor(construct: string) {
    super(`Unsupported TeX construct: ${construct}`)
    this.name = 'TexUnsupportedError'
    this.construct = construct
  }
}

type Node =
  | { readonly t: 'row'; readonly items: readonly Node[] }
  | { readonly t: 'ident'; readonly v: string; readonly upright?: boolean }
  | { readonly t: 'num'; readonly v: string }
  | { readonly t: 'op'; readonly v: string; readonly named?: boolean }
  | { readonly t: 'text'; readonly v: string; readonly italic?: boolean }
  | { readonly t: 'frac'; readonly num: Node; readonly den: Node }
  | { readonly t: 'sqrt'; readonly radicand: Node; readonly index?: Node }
  | { readonly t: 'script'; readonly base: Node; readonly sup?: Node; readonly sub?: Node }
  | { readonly t: 'fenced'; readonly open: string; readonly close: string; readonly body: Node }
  | { readonly t: 'space'; readonly em: string }
  | { readonly t: 'accent'; readonly base: Node; readonly mark: string }
  | { readonly t: 'table'; readonly rows: readonly (readonly Node[])[]; readonly align: string }

/** Single-character commands that stand for one symbol. */
const SYMBOLS: Readonly<Record<string, string>> = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε',
  zeta: 'ζ', eta: 'η', theta: 'θ', vartheta: 'ϑ', iota: 'ι', kappa: 'κ',
  lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π', rho: 'ρ', sigma: 'σ',
  tau: 'τ', upsilon: 'υ', phi: 'φ', varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
  Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π',
  Sigma: 'Σ', Upsilon: 'Υ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
  partial: '∂', infty: '∞', ell: 'ℓ',
}

/** Commands that stand for one operator glyph. */
const OPERATORS: Readonly<Record<string, string>> = {
  times: '×', div: '÷', cdot: '⋅', pm: '±', mp: '∓', ast: '∗',
  circ: '∘', bullet: '∙', prime: '′', degree: '°',
  leq: '≤', le: '≤', geq: '≥', ge: '≥', neq: '≠', ne: '≠', approx: '≈',
  equiv: '≡', propto: '∝', sim: '∼', therefore: '∴', because: '∵',
  int: '∫', iint: '∬', iiint: '∭', oint: '∮', sum: '∑', prod: '∏',
  ldots: '…', dots: '…', cdots: '⋯', vdots: '⋮',
  to: '→', rightarrow: '→', leftarrow: '←', longrightarrow: '⟶',
  longleftarrow: '⟵', Rightarrow: '⇒', leftrightarrow: '↔',
  lvert: '|', rvert: '|', vert: '|', lVert: '‖', rVert: '‖',
  langle: '⟨', rangle: '⟩', lbrace: '{', rbrace: '}',
  triangleleft: '◁', triangleright: '▷', angle: '∠', nabla: '∇',
  in: '∈', notin: '∉', subset: '⊂', cup: '∪', cap: '∩',
}

/** Named operators that must render upright and keep a word boundary. */
const NAMED_OPERATORS = new Set([
  'log', 'ln', 'lg', 'exp', 'sin', 'cos', 'tan', 'sec', 'csc', 'cot',
  'arcsin', 'arccos', 'arctan', 'sinh', 'cosh', 'tanh', 'coth',
  'lim', 'max', 'min', 'sup', 'inf', 'det', 'gcd', 'deg', 'dim', 'mod',
])

const SPACES: Readonly<Record<string, string>> = {
  quad: '1em', qquad: '2em', ',': '0.167em', ':': '0.222em', ';': '0.278em',
  '!': '-0.167em', ' ': '0.25em', enspace: '0.5em', thinspace: '0.167em',
}

/** Characters that only exist in TeX as escapes. */
const LITERALS: Readonly<Record<string, string>> = {
  '%': '%', '$': '$', '#': '#', '&': '&', '_': '_', '{': '{', '}': '}',
}

/** Environments compiled to an `mtable`, with their column alignment. */
const ENVIRONMENTS: Readonly<Record<string, string>> = {
  aligned: 'right left',
  'aligned*': 'right left',
  align: 'right left',
  'align*': 'right left',
  gathered: 'center',
  array: 'center',
  cases: 'left',
  matrix: 'center',
}

const ACCENTS: Readonly<Record<string, string>> = {
  dot: '˙', ddot: '¨', hat: '^', bar: '¯', vec: '→', tilde: '~',
}

const OPEN_DELIMITERS = new Set(['(', '[', '{', '|', '⟨', '‖', '.'])
const CLOSE_DELIMITERS = new Set([')', ']', '}', '|', '⟩', '‖', '.'])

interface Token {
  readonly kind: 'command' | 'char' | 'open' | 'close' | 'sup' | 'sub' | 'amp'
  readonly value: string
}

function tokenize(source: string): readonly Token[] {
  const tokens: Token[] = []
  let index = 0
  while (index < source.length) {
    const char = source[index]!
    if (char === '\\') {
      const rest = source.slice(index + 1)
      const word = /^[a-zA-Z]+/.exec(rest)?.[0]
      if (word) {
        tokens.push({ kind: 'command', value: word })
        index += 1 + word.length
        continue
      }
      const symbol = rest[0]
      if (symbol === undefined) throw new TexUnsupportedError('trailing backslash')
      tokens.push({ kind: 'command', value: symbol })
      index += 2
      continue
    }
    index += 1
    if (char === '{') tokens.push({ kind: 'open', value: char })
    else if (char === '}') tokens.push({ kind: 'close', value: char })
    else if (char === '^') tokens.push({ kind: 'sup', value: char })
    else if (char === '_') tokens.push({ kind: 'sub', value: char })
    else if (char === '&') tokens.push({ kind: 'amp', value: char })
    else if (/\s/.test(char)) continue
    else tokens.push({ kind: 'char', value: char })
  }
  return tokens
}

class Parser {
  #tokens: readonly Token[]
  #index = 0
  #nodes = 0

  constructor(tokens: readonly Token[]) {
    this.#tokens = tokens
  }

  #count(): void {
    this.#nodes += 1
    if (this.#nodes > MAX_NODES) throw new TexUnsupportedError('expression too large')
  }

  #peek(): Token | undefined {
    return this.#tokens[this.#index]
  }

  /** Parse a run of atoms until a closing brace or the end of input. */
  parseRow(depth: number, stopAtClose: boolean): Node {
    if (depth > MAX_DEPTH) throw new TexUnsupportedError('expression too deeply nested')
    const items: Node[] = []
    for (;;) {
      const token = this.#peek()
      if (!token) break
      if (token.kind === 'close') {
        if (stopAtClose) break
        throw new TexUnsupportedError('unbalanced }')
      }
      if (token.kind === 'sup' || token.kind === 'sub') {
        this.#index += 1
        const script = this.#parseAtom(depth + 1)
        const base = items.pop() ?? { t: 'row' as const, items: [] }
        items.push(this.#attachScript(base, token.kind, script))
        continue
      }
      items.push(this.#parseAtom(depth + 1))
    }
    this.#count()
    return items.length === 1 ? items[0]! : { t: 'row', items }
  }

  #attachScript(base: Node, kind: 'sup' | 'sub', script: Node): Node {
    if (base.t === 'script') {
      // `x^2_1` and `x_1^2` are the same object; merge rather than nest.
      if (kind === 'sup' && !base.sup) return { ...base, sup: script }
      if (kind === 'sub' && !base.sub) return { ...base, sub: script }
    }
    return kind === 'sup' ? { t: 'script', base, sup: script } : { t: 'script', base, sub: script }
  }

  /** Parse one group: `{...}` or a single atom. */
  #parseGroup(depth: number): Node {
    if (depth > MAX_DEPTH) throw new TexUnsupportedError('expression too deeply nested')
    const token = this.#peek()
    if (token?.kind === 'open') {
      this.#index += 1
      const row = this.parseRow(depth + 1, true)
      if (this.#peek()?.kind !== 'close') throw new TexUnsupportedError('unbalanced {')
      this.#index += 1
      return row
    }
    return this.#parseAtom(depth)
  }

  /** Read a `{...}` group as literal text, for `\text` and friends. */
  #parseTextGroup(): string {
    if (this.#peek()?.kind !== 'open') throw new TexUnsupportedError('\\text without a group')
    this.#index += 1
    let text = ''
    let nesting = 0
    for (;;) {
      const token = this.#tokens[this.#index]
      if (!token) throw new TexUnsupportedError('unterminated \\text')
      this.#index += 1
      if (token.kind === 'open') {
        nesting += 1
        continue
      }
      if (token.kind === 'close') {
        if (nesting === 0) break
        nesting -= 1
        continue
      }
      if (token.kind === 'command') {
        const space = SPACES[token.value]
        if (space) {
          text += ' '
          continue
        }
        throw new TexUnsupportedError(`\\${token.value} inside \\text`)
      }
      text += token.value === ' ' ? ' ' : token.value
    }
    return text
  }

  #parseAtom(depth: number): Node {
    if (depth > MAX_DEPTH) throw new TexUnsupportedError('expression too deeply nested')
    this.#count()
    const token = this.#tokens[this.#index]
    if (!token) throw new TexUnsupportedError('unexpected end of expression')
    this.#index += 1

    if (token.kind === 'open') {
      this.#index -= 1
      return this.#parseGroup(depth)
    }
    if (token.kind === 'amp') throw new TexUnsupportedError('alignment (&)')
    if (token.kind === 'char') return atomFromChar(token.value)
    if (token.kind === 'sup' || token.kind === 'sub') {
      throw new TexUnsupportedError('script without a base')
    }

    const command = token.value
    if (command === '(' || command === ')' || command === '[' || command === ']') {
      // The math-mode delimiters that wrap every Gutenberg `data-tex`.
      return { t: 'row', items: [] }
    }
    if (command === 'frac' || command === 'dfrac' || command === 'tfrac') {
      const num = this.#parseGroup(depth + 1)
      const den = this.#parseGroup(depth + 1)
      return { t: 'frac', num, den }
    }
    if (command === 'sqrt') {
      let index: Node | undefined
      if (this.#peek()?.kind === 'char' && this.#peek()?.value === '[') {
        this.#index += 1
        const items: Node[] = []
        while (this.#peek() && !(this.#peek()!.kind === 'char' && this.#peek()!.value === ']')) {
          items.push(this.#parseAtom(depth + 1))
        }
        if (!this.#peek()) throw new TexUnsupportedError('unterminated \\sqrt index')
        this.#index += 1
        index = items.length === 1 ? items[0]! : { t: 'row', items }
      }
      const radicand = this.#parseGroup(depth + 1)
      return index ? { t: 'sqrt', radicand, index } : { t: 'sqrt', radicand }
    }
    if (command === 'left' || command === 'right') {
      if (command === 'right') throw new TexUnsupportedError('\\right without \\left')
      const open = this.#readDelimiter(OPEN_DELIMITERS, '\\left')
      const body = this.#parseUntilRight(depth + 1)
      const close = this.#readDelimiter(CLOSE_DELIMITERS, '\\right')
      return { t: 'fenced', open, close, body }
    }
    if (command === 'text' || command === 'textrm' || command === 'textnormal') {
      return { t: 'text', v: this.#parseTextGroup() }
    }
    if (command === 'textit' || command === 'emph') {
      return { t: 'text', v: this.#parseTextGroup(), italic: true }
    }
    if (command === 'mathrm' || command === 'operatorname') {
      const value = this.#parseTextGroup()
      return { t: 'op', v: value, named: true }
    }
    if (command === 'begin') return this.#parseEnvironment(depth + 1)
    if (command === 'end') throw new TexUnsupportedError('\\end without \\begin')
    if (command in LITERALS) return { t: 'op', v: LITERALS[command]! }
    if (command in ACCENTS) {
      return { t: 'accent', base: this.#parseGroup(depth + 1), mark: ACCENTS[command]! }
    }
    if (command in SPACES) return { t: 'space', em: SPACES[command]! }
    if (command in SYMBOLS) return { t: 'ident', v: SYMBOLS[command]! }
    if (command in OPERATORS) return { t: 'op', v: OPERATORS[command]! }
    if (NAMED_OPERATORS.has(command)) return { t: 'op', v: command, named: true }
    throw new TexUnsupportedError(`\\${command}`)
  }

  /**
   * `\\begin{aligned} ... \\end{aligned}` and friends become an `mtable`.
   *
   * These are the multi-line derivations — the chained equalities that carry
   * the actual argument of a calculus chapter. Declining them would leave the
   * book's most important mathematics as images.
   */
  #parseEnvironment(depth: number): Node {
    if (depth > MAX_DEPTH) throw new TexUnsupportedError('expression too deeply nested')
    const name = this.#readEnvironmentName('\\begin')
    const align = ENVIRONMENTS[name]
    if (!align) throw new TexUnsupportedError(`\\begin{${name}}`)
    if (name === 'array') {
      // The column specification is decoration here; the cells carry the shape.
      if (this.#peek()?.kind === 'open') this.#parseTextGroup()
    }
    const rows: Node[][] = []
    let row: Node[] = []
    let cell: Node[] = []
    const endCell = () => {
      this.#count()
      row.push(cell.length === 1 ? cell[0]! : { t: 'row', items: cell })
      cell = []
    }
    for (;;) {
      const token = this.#peek()
      if (!token) throw new TexUnsupportedError(`\\begin{${name}} without \\end`)
      if (token.kind === 'command' && token.value === 'end') {
        this.#index += 1
        const closing = this.#readEnvironmentName('\\end')
        if (closing !== name) throw new TexUnsupportedError(`\\end{${closing}}`)
        break
      }
      if (token.kind === 'amp') {
        this.#index += 1
        endCell()
        continue
      }
      if (token.kind === 'command' && token.value === '\\') {
        this.#index += 1
        endCell()
        rows.push(row)
        row = []
        continue
      }
      if (token.kind === 'sup' || token.kind === 'sub') {
        this.#index += 1
        const script = this.#parseAtom(depth + 1)
        const base = cell.pop() ?? { t: 'row' as const, items: [] }
        cell.push(this.#attachScript(base, token.kind, script))
        continue
      }
      cell.push(this.#parseAtom(depth + 1))
    }
    endCell()
    rows.push(row)
    const kept = rows.filter((cells) => cells.some((node) => !isEmpty(node)))
    return { t: 'table', rows: kept, align }
  }

  #readEnvironmentName(context: string): string {
    if (this.#peek()?.kind !== 'open') throw new TexUnsupportedError(`${context} without a name`)
    return this.#parseTextGroup()
  }

  #readDelimiter(allowed: ReadonlySet<string>, context: string): string {
    const token = this.#tokens[this.#index]
    if (!token) throw new TexUnsupportedError(`${context} without a delimiter`)
    this.#index += 1
    const value = token.kind === 'command' ? (OPERATORS[token.value] ?? token.value) : token.value
    if (!allowed.has(value)) throw new TexUnsupportedError(`${context}${value}`)
    return value === '.' ? '' : value
  }

  #parseUntilRight(depth: number): Node {
    const items: Node[] = []
    for (;;) {
      const token = this.#peek()
      if (!token) throw new TexUnsupportedError('\\left without \\right')
      if (token.kind === 'command' && token.value === 'right') {
        this.#index += 1
        break
      }
      if (token.kind === 'close') throw new TexUnsupportedError('unbalanced } inside \\left')
      if (token.kind === 'sup' || token.kind === 'sub') {
        this.#index += 1
        const script = this.#parseAtom(depth + 1)
        const base = items.pop() ?? { t: 'row' as const, items: [] }
        items.push(this.#attachScript(base, token.kind, script))
        continue
      }
      items.push(this.#parseAtom(depth + 1))
    }
    return items.length === 1 ? items[0]! : { t: 'row', items }
  }
}

function isEmpty(node: Node): boolean {
  return node.t === 'row' && node.items.length === 0
}

function atomFromChar(char: string): Node {
  if (/[0-9]/.test(char)) return { t: 'num', v: char }
  if (/[a-zA-Z]/.test(char)) return { t: 'ident', v: char }
  return { t: 'op', v: char }
}

/** Merge adjacent digits so `120` is one `<mn>` rather than three. */
function coalesce(node: Node): Node {
  if (node.t === 'row') {
    const items: Node[] = []
    for (const raw of node.items) {
      const item = coalesce(raw)
      const previous = items.at(-1)
      if (item.t === 'num' && previous?.t === 'num') {
        items[items.length - 1] = { t: 'num', v: previous.v + item.v }
        continue
      }
      if (item.t === 'op' && item.v === '.' && previous?.t === 'num') {
        items[items.length - 1] = { t: 'num', v: `${previous.v}.` }
        continue
      }
      if (item.t === 'num' && previous?.t === 'num' && previous.v.endsWith('.')) {
        items[items.length - 1] = { t: 'num', v: previous.v + item.v }
        continue
      }
      if (item.t === 'row' && item.items.length === 0) continue
      items.push(item)
    }
    return items.length === 1 ? items[0]! : { t: 'row', items }
  }
  if (node.t === 'frac') return { t: 'frac', num: coalesce(node.num), den: coalesce(node.den) }
  if (node.t === 'sqrt') {
    return node.index
      ? { t: 'sqrt', radicand: coalesce(node.radicand), index: coalesce(node.index) }
      : { t: 'sqrt', radicand: coalesce(node.radicand) }
  }
  if (node.t === 'script') {
    const base = coalesce(node.base)
    return {
      t: 'script',
      base,
      ...(node.sup ? { sup: coalesce(node.sup) } : {}),
      ...(node.sub ? { sub: coalesce(node.sub) } : {}),
    }
  }
  if (node.t === 'fenced') return { ...node, body: coalesce(node.body) }
  if (node.t === 'accent') return { ...node, base: coalesce(node.base) }
  if (node.t === 'table') {
    return { ...node, rows: node.rows.map((cells) => cells.map((cell) => coalesce(cell))) }
  }
  return node
}

export function parseTex(source: string): Node {
  if (source.length > MAX_INPUT) throw new TexUnsupportedError('expression too long')
  const parser = new Parser(tokenize(source))
  return coalesce(parser.parseRow(0, false))
}

// --- MathML emission ---------------------------------------------------------

function element(document_: Document, name: string, text?: string): Element {
  const node = document_.createElementNS(MATHML_NS, name)
  if (text !== undefined) node.appendChild(document_.createTextNode(text))
  return node
}

function wrapRow(document_: Document, children: readonly Element[]): Element {
  if (children.length === 1) return children[0]!
  const row = element(document_, 'mrow')
  for (const child of children) row.appendChild(child)
  return row
}

function emit(document_: Document, node: Node): Element {
  switch (node.t) {
    case 'row':
      return wrapRow(document_, node.items.map((item) => emit(document_, item)))
    case 'ident': {
      const mi = element(document_, 'mi', node.v)
      if (node.upright || node.v.length > 1) mi.setAttribute('mathvariant', 'normal')
      return mi
    }
    case 'num':
      return element(document_, 'mn', node.v)
    case 'op': {
      const mo = element(document_, 'mo', node.named ? node.v : node.v)
      if (node.named) {
        const mi = element(document_, 'mi', node.v)
        mi.setAttribute('mathvariant', 'normal')
        return mi
      }
      return mo
    }
    case 'text': {
      const mtext = element(document_, 'mtext', node.v)
      if (node.italic) mtext.setAttribute('mathvariant', 'italic')
      return mtext
    }
    case 'frac': {
      const frac = element(document_, 'mfrac')
      frac.appendChild(emit(document_, node.num))
      frac.appendChild(emit(document_, node.den))
      return frac
    }
    case 'sqrt': {
      if (node.index) {
        const root = element(document_, 'mroot')
        root.appendChild(emit(document_, node.radicand))
        root.appendChild(emit(document_, node.index))
        return root
      }
      const sqrt = element(document_, 'msqrt')
      sqrt.appendChild(emit(document_, node.radicand))
      return sqrt
    }
    case 'script': {
      const name = node.sup && node.sub ? 'msubsup' : node.sup ? 'msup' : 'msub'
      const script = element(document_, name)
      script.appendChild(emit(document_, node.base))
      if (node.sub) script.appendChild(emit(document_, node.sub))
      if (node.sup) script.appendChild(emit(document_, node.sup))
      return script
    }
    case 'fenced': {
      const children: Element[] = []
      if (node.open) {
        const open = element(document_, 'mo', node.open)
        open.setAttribute('fence', 'true')
        open.setAttribute('stretchy', 'true')
        children.push(open)
      }
      children.push(emit(document_, node.body))
      if (node.close) {
        const close = element(document_, 'mo', node.close)
        close.setAttribute('fence', 'true')
        close.setAttribute('stretchy', 'true')
        children.push(close)
      }
      const row = element(document_, 'mrow')
      for (const child of children) row.appendChild(child)
      return row
    }
    case 'space': {
      const space = element(document_, 'mspace')
      space.setAttribute('width', node.em)
      return space
    }
    case 'table': {
      const table = element(document_, 'mtable')
      table.setAttribute('columnalign', node.align)
      for (const cells of node.rows) {
        const tr = element(document_, 'mtr')
        for (const cell of cells) {
          const td = element(document_, 'mtd')
          td.appendChild(emit(document_, cell))
          tr.appendChild(td)
        }
        table.appendChild(tr)
      }
      return table
    }
    case 'accent': {
      const over = element(document_, 'mover')
      over.setAttribute('accent', 'true')
      over.appendChild(emit(document_, node.base))
      over.appendChild(element(document_, 'mo', node.mark))
      return over
    }
  }
}

/**
 * A compact linear form of the expression, for the search index and for any
 * surface that needs one line of text rather than markup.
 *
 * This is what makes the restoration visible to FTS5: before it, a passage
 * carried the literal string `\({\dfrac{dy}{dx}}\)` and a reader searching for
 * `dy/dx` found nothing.
 */
function linear(node: Node, parenthesize = false): string {
  switch (node.t) {
    case 'row': {
      const text = node.items.map((item) => linear(item)).join('')
      // Parenthesize only where precedence is actually at stake. `dy/dx` needs
      // no brackets; `(x+1)/2` does.
      const contested = node.items.some((item) => item.t === 'op')
      return parenthesize && contested ? `(${text})` : text
    }
    case 'ident':
    case 'num':
      return node.v
    case 'op':
      return node.named ? ` ${node.v} ` : node.v
    case 'text':
      return node.v
    case 'frac':
      return `${linear(node.num, true)}/${linear(node.den, true)}`
    case 'sqrt':
      return node.index ? `root${linear(node.index)}(${linear(node.radicand)})` : `√(${linear(node.radicand)})`
    case 'script': {
      const base = linear(node.base, true)
      const sub = node.sub ? `_${linear(node.sub, true)}` : ''
      const sup = node.sup ? `^${linear(node.sup, true)}` : ''
      return `${base}${sub}${sup}`
    }
    case 'fenced':
      return `${node.open}${linear(node.body)}${node.close}`
    case 'space':
      return ' '
    case 'table':
      return node.rows.map((cells) => cells.map((cell) => linear(cell)).join(' ')).join('; ')
    case 'accent':
      return `${linear(node.base)}${node.mark}`
  }
}

export interface CompiledMath {
  /** The MathML `<math>` element, built node by node. */
  readonly element: Element
  /** A compact one-line rendering, used as `alttext` and by the index. */
  readonly text: string
}

/**
 * Compile one `data-tex` value into MathML.
 *
 * The TeX is preserved verbatim in an `<annotation encoding="application/x-tex">`
 * inside `<semantics>`, so the restoration is lossless: the original notation
 * can always be read back out of the restored document.
 */
export function compileTex(
  source: string,
  options: { readonly document: Document; readonly display?: boolean },
): CompiledMath {
  const trimmed = source.trim()
  const parsed = parseTex(trimmed)
  const document_ = options.document
  const math = element(document_, 'math')
  math.setAttribute('display', (options.display ?? isDisplayTex(trimmed)) ? 'block' : 'inline')
  const semantics = element(document_, 'semantics')
  semantics.appendChild(emit(document_, parsed))
  const annotation = element(document_, 'annotation', trimmed)
  annotation.setAttribute('encoding', 'application/x-tex')
  semantics.appendChild(annotation)
  math.appendChild(semantics)
  const text = collapse(linear(parsed))
  math.setAttribute('alttext', text)
  return { element: math, text }
}

/**
 * `\\[ ... \\]` is TeX for a display equation; `\\( ... \\)` is inline. The
 * distinction is the author's, and losing it would set a chapter's centred
 * derivations in the middle of a sentence.
 */
export function isDisplayTex(source: string): boolean {
  const trimmed = source.trim()
  return trimmed.startsWith('\\[') || trimmed.startsWith('$$')
}

function collapse(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}
