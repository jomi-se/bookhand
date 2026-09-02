/**
 * How an element is named when something outside the document refers to it.
 *
 * A path of child-element indices from `<body>`, e.g. `4/1/0`. It is derived
 * from the document's own shape rather than from an id the publisher may not
 * have set, so it means the same thing in the copy an agent inspected and the
 * copy Bookhand renders.
 */
export type ElementTarget = string

export function targetOf(element: Element): ElementTarget {
  const path: number[] = []
  let node: Element | null = element
  while (node?.parentElement && node.tagName.toLowerCase() !== 'body') {
    path.unshift(Array.prototype.indexOf.call(node.parentElement.children, node))
    node = node.parentElement
  }
  return path.join('/')
}

export function resolveTarget(document_: Document, target: ElementTarget): Element | undefined {
  const root = document_.body ?? document_.documentElement
  if (!root) return undefined
  const steps = target.split('/').filter((step) => step.length > 0)
  if (steps.length === 0) return undefined
  let node: Element | undefined = root
  for (const step of steps) {
    const index = Number(step)
    if (!Number.isInteger(index) || index < 0) return undefined
    node = node?.children[index]
    if (!node) return undefined
  }
  return node
}
