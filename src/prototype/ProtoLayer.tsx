import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { AnimatePresence, animate, motion } from 'motion/react'
import {
  ArrowLeft,
  BookOpen,
  Check,
  Diamond,
  ExternalLink,
  History,
  MoreHorizontal,
  Sparkles,
  Trash2,
  EyeOff,
  X,
} from 'lucide-react'
import type { Annotation } from '../domain/index.ts'
import type { BookTarget, ReaderAdapter, ReaderAnnotationMark, ReaderSelection } from '../domain/reader.ts'
import { ArtifactFrame, type BridgeMessage, type FrameTheme } from './ArtifactFrame.tsx'
import { Conversation } from './Conversation.tsx'
import { Notebook } from './Notebook.tsx'
import { Poster } from './Posters.tsx'
import { Sheet, type SheetSnap } from './Sheet.tsx'
import { HUES, KIND_LABEL, type Artifact, type Conversation as ConversationModel, type Memory, type Message } from './model.ts'
import {
  CHAPTERS,
  LADDER_ANCHOR,
  LADDER_ARTIFACT,
  LADDER_REPLY,
  LADDER_REPLY_TEXT,
  keptHtml,
  noteHtml,
} from './seed.ts'
import { allArtifacts, allConversations, proto, useProto } from './store.ts'
import './prototype.css'

export interface ProtoController {
  openNotebook(): void
  openTutor(): void
  ask(selection: ReaderSelection): void
  note(selection: ReaderSelection): void
  activateMark(id: string): boolean
}

export interface ProtoLayerProps {
  readonly bookTitle: string
  readonly adapter: ReaderAdapter | undefined
  readonly readerReady: boolean
  readonly sectionIndex?: number
  readonly theme: FrameTheme
  readonly highlights: readonly Annotation[]
  readonly navigate: (target: BookTarget) => Promise<void>
  readonly onMarks: (marks: readonly ReaderAnnotationMark[]) => void
  readonly controller: MutableRefObject<ProtoController | undefined>
}

type SheetState =
  | { readonly type: 'artifact'; readonly id: string }
  | { readonly type: 'chat'; readonly id: string }
  | { readonly type: 'note'; readonly selection: ReaderSelection }
  | { readonly type: 'choose'; readonly ids: readonly string[] }

interface Toast {
  readonly id: number
  readonly text: string
  readonly tone?: 'memory' | 'kept' | 'plain' | 'made'
  readonly action?: { readonly label: string; readonly run: () => void }
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
const clip = (text: string, length: number) => (text.length > length ? `${text.slice(0, length - 1).trimEnd()}…` : text)
const plain = (html: string) =>
  html.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

const GENERIC_REPLY = (quote?: string) => `<p>I'd love to dig into this with you, but this prototype only has <strong>scripted</strong> answers for a couple of passages. It isn't connected to a model yet.</p>
${quote ? `<bh-quote cite="The passage you asked about">${quote.replace(/</g, '&lt;')}</bh-quote>` : ''}
<p>Try the ladder question in <a href="bookhand:artifact/ladder-flow">Chapter III</a> to watch a tutor build an artifact live. Or tap <strong>Keep</strong> below to see how saving a reply feels.</p>`

/** Where a marking is drawn, in viewport pixels (the book frames are same-origin). */
function markingOnScreen(cfi: string) {
  let found: { x: number; y: number; w: number; h: number } | undefined
  const walk = (root: Document | ShadowRoot, dx: number, dy: number) => {
    if (found) return
    for (const g of root.querySelectorAll<SVGGElement>('[data-marking]')) {
      if (g.getAttribute('data-cfi') !== cfi) continue
      const box = g.getBoundingClientRect()
      const x = dx + box.left
      // Pins draw only underlines, so their box starts below the first line of text.
      const underlined = g.getAttribute('data-marking') === 'pin'
      const y = dy + box.top - (underlined ? 18 : 0)
      if (box.width && x + box.width > 0 && x < window.innerWidth && y + box.height > 0 && y < window.innerHeight) {
        found = { x: Math.max(4, x), y, w: Math.min(box.width, window.innerWidth - 8 - Math.max(4, x)), h: box.height + (underlined ? 18 : 0) }
        return
      }
    }
    for (const el of root.querySelectorAll('*')) {
      if (el.shadowRoot) walk(el.shadowRoot, dx, dy)
      if (el instanceof HTMLIFrameElement && el.contentDocument) {
        const r = el.getBoundingClientRect()
        walk(el.contentDocument, dx + r.left, dy + r.top)
      }
    }
  }
  walk(document, 0, 0)
  return found
}

/** Visit every same-origin book document (the reader renders into iframes). */
function eachBookDocument(visit: (doc: Document, dx: number, dy: number) => void) {
  const walk = (root: Document | ShadowRoot, dx: number, dy: number) => {
    for (const el of root.querySelectorAll('*')) {
      if (el.shadowRoot) walk(el.shadowRoot, dx, dy)
      if (el instanceof HTMLIFrameElement && el.contentDocument && !el.sandbox.contains('allow-scripts')) {
        const r = el.getBoundingClientRect()
        visit(el.contentDocument, dx + r.left, dy + r.top)
        walk(el.contentDocument, dx + r.left, dy + r.top)
      }
    }
  }
  walk(document, 0, 0)
}

/** Where the reader's current selection is, before it is cleared. */
function selectionOnScreen() {
  let found: { x: number; y: number; w: number; h: number } | undefined
  eachBookDocument((doc, dx, dy) => {
    const selection = doc.getSelection()
    if (found || !selection?.rangeCount || selection.isCollapsed) return
    const box = selection.getRangeAt(0).getBoundingClientRect()
    if (box.width) found = { x: Math.max(4, dx + box.left), y: dy + box.top, w: Math.min(box.width, window.innerWidth - 8), h: box.height }
  })
  return found
}

function clearBookSelection() {
  eachBookDocument((doc) => doc.getSelection()?.removeAllRanges())
}

/**
 * Room for the anchored passage: a half height that stops just under it, and
 * how far to slide the page up when the passage sits too low to stay visible.
 */
function fitBelow(spot: { y: number; h: number }) {
  const vh = window.visualViewport?.height ?? window.innerHeight
  const bottom = spot.y + spot.h + 18
  const height = Math.round(Math.min(vh * 0.62, Math.max(vh * 0.5, vh - bottom)))
  const lift = Math.max(0, Math.min(spot.y - 70, bottom - (vh - height)))
  return { height, lift }
}

export function ProtoLayer(props: ProtoLayerProps) {
  const state = useProto()
  const artifacts = useMemo(() => allArtifacts(state), [state])
  const conversations = useMemo(() => allConversations(state), [state])
  const [stack, setStack] = useState<SheetState[]>([])
  const [sheetOpen, setSheetOpen] = useState(false)
  const [snap, setSnap] = useState<SheetSnap>('half')
  const [notebook, setNotebook] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [back, setBack] = useState<{ readonly id: string; readonly title: string }>()
  const [cfis, setCfis] = useState<Record<string, string>>({})
  const [draft, setDraft] = useState('')
  const [attached, setAttached] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [menu, setMenu] = useState(false)
  const [spot, setSpot] = useState<{ x: number; y: number; w: number; h: number }>()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const current = stack[stack.length - 1]
  const { adapter, readerReady, onMarks, navigate } = props

  // ——— toasts ————————————————————————————————————————————
  const toastId = useRef(0)
  const toast = useCallback((t: Omit<Toast, 'id'>, ms = 4200) => {
    const id = ++toastId.current
    setToasts((list) => [...list.slice(-2), { ...t, id }])
    setTimeout(() => setToasts((list) => list.filter((x) => x.id !== id)), ms)
  }, [])

  // ——— anchors and markings ————————————————————————————————
  useEffect(() => {
    if (!readerReady || !adapter?.locateText) return
    let alive = true
    void (async () => {
      const found: Record<string, string> = {}
      for (const artifact of artifacts) {
        const anchor = artifact.anchor
        if (!anchor || cfis[artifact.id]) continue
        const cfi = anchor.cfi ?? (await adapter.locateText!(anchor.sectionIndex, anchor.text).catch(() => undefined))
        if (cfi) found[artifact.id] = cfi
      }
      if (alive && Object.keys(found).length) setCfis((previous) => ({ ...previous, ...found }))
    })()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readerReady, adapter, artifacts])

  const dismissed = useMemo(() => new Set(state.dismissed), [state.dismissed])
  useEffect(() => {
    const palette = HUES[props.theme.name]
    // Foliate keys annotations by CFI, so artifacts that share a passage
    // share one marking: the first one's colour and a count.
    const byCfi = new Map<string, Artifact[]>()
    for (const artifact of artifacts) {
      const cfi = cfis[artifact.id]
      if (!cfi || dismissed.has(artifact.id)) continue
      byCfi.set(cfi, [...(byCfi.get(cfi) ?? []), artifact])
    }
    const marks: ReaderAnnotationMark[] = []
    for (const [cfi, group] of byCfi) {
      const primary = group[0]!
      const style = state.settings.marking === 'mixed' ? primary.marking : state.settings.marking
      marks.push({
        id: group.length > 1 ? `proto-many:${group.map((a) => a.id).join(',')}` : `proto:${primary.id}`,
        cfi,
        color: palette[primary.hue],
        style: group.length > 1 && style === 'margin' ? 'pin' : style,
        glyph: group.length > 1 ? String(group.length) : primary.glyph,
      })
    }
    onMarks(marks)
  }, [artifacts, cfis, dismissed, onMarks, props.theme.name, state.settings.marking])

  // ——— sheets ————————————————————————————————————————————
  const openSheet = useCallback((next: SheetState, options: { replace?: boolean; snap?: SheetSnap; spot?: { x: number; y: number; w: number; h: number } } = {}) => {
    setSpot(options.spot)
    setMenu(false)
    setConfirmDelete(false)
    setStack((list) => (options.replace ? [next] : [...list.filter((s) => JSON.stringify(s) !== JSON.stringify(next)), next]))
    setSnap(options.snap ?? (next.type === 'chat' ? 'full' : 'half'))
    setSheetOpen(true)
    if (next.type === 'artifact') proto.markSeen(next.id)
  }, [])

  const closeSheet = useCallback(() => {
    setMenu(false)
    setConfirmDelete(false)
    if (stack.length > 1) {
      const previous = stack[stack.length - 2]!
      setStack((list) => list.slice(0, -1))
      setSpot(undefined)
      setSnap(previous.type === 'chat' ? 'full' : 'half')
      return
    }
    setSheetOpen(false)
    setTimeout(() => setStack((list) => (list.length <= 1 ? [] : list)), 380)
  }, [stack])

  const closeAll = useCallback(() => {
    setSheetOpen(false)
    setNotebook(false)
    setTimeout(() => setStack([]), 380)
  }, [])

  const goTo = useCallback(
    async (target: { cfi?: string; sectionIndex?: number; text?: string }, from?: Artifact) => {
      let cfi = target.cfi
      if (!cfi && target.sectionIndex !== undefined && target.text && adapter?.locateText) {
        cfi = await adapter.locateText(target.sectionIndex, target.text).catch(() => undefined)
      }
      closeAll()
      await wait(120)
      if (cfi) await navigate({ kind: 'cfi', cfi })
      else if (target.sectionIndex !== undefined) await navigate({ kind: 'section', sectionIndex: target.sectionIndex })
      if (from) setBack({ id: from.id, title: from.title })
    },
    [adapter, closeAll, navigate],
  )

  // ——— artifact bridge ———————————————————————————————————————
  const remember = useCallback((text: string, sectionIndex?: number) => {
    const memory: Memory = {
      id: `m-${Date.now()}`,
      kind: 'understood',
      text,
      by: 'tutor',
      createdAt: new Date().toISOString(),
      ...(sectionIndex === undefined ? {} : { sectionIndex }),
    }
    proto.addMemory(memory)
    toast({ text: `Remembered: ${clip(text, 70)}`, tone: 'memory', action: { label: 'Undo', run: () => proto.removeMemory(memory.id) } })
  }, [toast])

  const flyToNotebook = useCallback((from: HTMLElement, label: string) => {
    const target = document.querySelector('[data-proto-notebook]')
    const start = from.getBoundingClientRect()
    const ghost = document.createElement('div')
    ghost.className = 'proto-fly'
    ghost.textContent = label
    document.body.append(ghost)
    const end = target?.getBoundingClientRect() ?? { left: window.innerWidth - 40, top: 20, width: 20, height: 20 }
    ghost.style.left = `${start.left + start.width / 2}px`
    ghost.style.top = `${start.top + start.height / 2}px`
    const dx = end.left + end.width / 2 - (start.left + start.width / 2)
    const dy = end.top + end.height / 2 - (start.top + start.height / 2)
    void animate(ghost, { x: [0, dx * 0.35, dx], y: [0, dy - 90, dy], scale: [1, 1.1, 0.3], opacity: [1, 1, 0.2] }, { duration: 0.75, ease: [0.3, 0, 0.2, 1] }).then(() => {
      ghost.remove()
      target?.classList.add('proto-pulse')
      setTimeout(() => target?.classList.remove('proto-pulse'), 700)
    })
  }, [])

  const keep = useCallback(
    (conversation: ConversationModel, message: Message, from: HTMLElement, part?: { text: string; html: string }) => {
      const text = plain(part?.html ?? message.body)
      const id = `kept-${Date.now()}`
      const artifact: Artifact = {
        id,
        title: `“${clip(part?.text ?? text, 42)}”`,
        summary: `Kept from “${conversation.title}”`,
        kind: 'kept',
        anchor: {
          sectionIndex: conversation.sectionIndex,
          text: conversation.anchorText ?? '',
          chapter: conversation.chapter,
          ...(conversation.anchorCfi ? { cfi: conversation.anchorCfi } : {}),
        },
        marking: 'pin',
        hue: 'moss',
        glyph: '❝',
        html: keptHtml(part?.html ? `<p>${part.html}</p>` : message.body, `${conversation.chapter} · with your tutor`),
        author: 'kept',
        createdAt: new Date().toISOString(),
        versions: 1,
        poster: 'kept',
        conversationId: conversation.id,
      }
      proto.addArtifact(artifact)
      flyToNotebook(from, part ? '❝ Kept that part' : '❝ Kept')
      setTimeout(() => toast({ text: `Kept to your Notebook · ${conversation.chapter}`, tone: 'kept', action: { label: 'Open', run: () => openSheet({ type: 'artifact', id }) } }), 500)
    },
    [flyToNotebook, openSheet, toast],
  )

  const onBridge = useCallback(
    (message: BridgeMessage, from?: Artifact) => {
      if (message.type === 'navigate') void goTo(message, from)
      else if (message.type === 'open') {
        if (message.id === 'ladder-flow') void tryLadder()
        else openSheet({ type: 'artifact', id: message.id })
      } else if (message.type === 'toast') toast({ text: message.text })
      else if (message.type === 'remember') {
        toast({
          text: `Remember that you ${message.text.charAt(0).toLowerCase()}${message.text.slice(1).replace(/\.$/, '')}?`,
          tone: 'memory',
          action: { label: 'Remember', run: () => remember(message.text, from?.anchor?.sectionIndex) },
        }, 7000)
      } else if (message.type === 'link') {
        const host = (() => { try { return new URL(message.url).host } catch { return message.url } })()
        toast({ text: `Open ${host}?`, action: { label: 'Open', run: () => window.open(message.url, '_blank', 'noopener,noreferrer') } }, 6000)
      } else if (message.type === 'keep' && from) {
        toast({ text: 'Kept that part to your Notebook', tone: 'kept' })
      }
    },
    // tryLadder is hoisted below; it reads only stable callbacks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [goTo, openSheet, remember, toast],
  )

  // ——— conversations and the scripted flows ————————————————————————
  const conversationFor = useCallback(
    (sectionIndex: number | undefined) => conversations.find((c) => c.sectionIndex === sectionIndex),
    [conversations],
  )

  const openChat = useCallback((conversation: ConversationModel, passage?: string, prefill?: string) => {
    setAttached(passage)
    setDraft(prefill ?? '')
    openSheet({ type: 'chat', id: conversation.id }, { snap: 'full' })
  }, [openSheet])

  const newConversation = useCallback((sectionIndex: number, anchor?: { text: string; cfi?: string }) => {
    const conversation: ConversationModel = {
      id: `c-${Date.now()}`,
      title: `About ${(CHAPTERS[sectionIndex] ?? 'this chapter').split(' · ')[1] ?? 'this passage'}`,
      sectionIndex,
      chapter: CHAPTERS[sectionIndex] ?? `Section ${sectionIndex}`,
      createdAt: new Date().toISOString(),
      messages: [],
      ...(anchor ? { anchorText: anchor.text, ...(anchor.cfi ? { anchorCfi: anchor.cfi } : {}) } : {}),
    }
    proto.addConversation(conversation)
    return conversation
  }, [])

  const ladderBuilt = artifacts.some((a) => a.id === 'ladder')

  async function tryLadder() {
    closeAll()
    await wait(200)
    const cfi = await adapter?.locateText?.(LADDER_ANCHOR.sectionIndex, LADDER_ANCHOR.text).catch(() => undefined)
    if (cfi) await navigate({ kind: 'cfi', cfi })
    await wait(350)
    const conversation = conversationFor(10) ?? newConversation(10, { text: LADDER_ANCHOR.text, ...(cfi ? { cfi } : {}) })
    openChat(conversation, LADDER_ANCHOR.text, 'wait, why does the top barely move when I pull it out a whole inch?')
  }

  const runFlow = useCallback(
    async (conversation: ConversationModel, text: string, passage?: string) => {
      const id = conversation.id
      setBusy(true)
      setDraft('')
      setAttached(undefined)
      proto.append(id, { id: `r-${Date.now()}`, role: 'reader', body: text, createdAt: new Date().toISOString(), ...(passage ? { passage: clip(passage, 160) } : {}) })
      await wait(450)
      const base: Message = { id: `t-${Date.now()}`, role: 'tutor', body: '', receipts: [], status: 'thinking', createdAt: new Date().toISOString() }
      proto.append(id, base)
      const update = (patch: Partial<Message>) => {
        const last = allConversations().find((c) => c.id === id)?.messages.at(-1)
        if (last) proto.replaceLast(id, { ...last, ...patch })
      }
      const ladder = conversation.sectionIndex === 10 && !allArtifacts().some((a) => a.id === 'ladder')
      const receipts = ladder
        ? ['Read Chapter III', 'Recalled: picture first', 'Looked at Fig. 5']
        : ['Read the passage', 'Recalled 2 memories']
      for (let i = 0; i < receipts.length; i++) {
        await wait(650)
        update({ receipts: receipts.slice(0, i + 1) })
      }
      await wait(450)
      if (!ladder) {
        update({ status: 'done', body: GENERIC_REPLY(passage) })
        setBusy(false)
        return
      }
      const words = LADDER_REPLY_TEXT.split(' ')
      for (let i = 1; i <= words.length; i += 2) {
        update({ status: 'streaming', body: words.slice(0, i).join(' ') })
        await wait(55)
      }
      update({ status: 'building', body: LADDER_REPLY })
      await wait(2600)
      proto.addArtifact({ ...LADDER_ARTIFACT, createdAt: new Date().toISOString() })
      update({ status: 'done', artifactId: 'ladder', receipts: [...receipts, 'Made an artifact'] })
      toast({ text: 'Marked in Chapter III. Look for the stroke in the margin.', tone: 'made', action: { label: 'Open', run: () => openSheet({ type: 'artifact', id: 'ladder' }) } }, 6000)
      await wait(1400)
      update({ memoryAsk: 'the top of a steep ladder barely moving surprised you' })
      setBusy(false)
    },
    [openSheet, toast],
  )

  const answerMemory = useCallback((conversation: ConversationModel, message: Message, save: boolean) => {
    proto.updateMessage(conversation.id, message.id, { memoryAnswer: save ? 'saved' : 'declined' })
    if (save && message.memoryAsk) {
      proto.addMemory({
        id: `m-${Date.now()}`,
        kind: 'struggled',
        text: `Was surprised that ${message.memoryAsk.replace(/ surprised you$/, '')}.`,
        sectionIndex: conversation.sectionIndex,
        by: 'tutor',
        createdAt: new Date().toISOString(),
      })
      toast({ text: 'Saved to memories. Every future tutor will know.', tone: 'memory' })
    }
  }, [toast])

  // ——— the controller ReaderScreen talks to ——————————————————————————
  useEffect(() => {
    props.controller.current = {
      openNotebook: () => setNotebook(true),
      openTutor: () => {
        const conversation = conversationFor(props.sectionIndex) ?? conversations[conversations.length - 1]
        if (conversation) openChat(conversation)
        else if (props.sectionIndex !== undefined) openChat(newConversation(props.sectionIndex))
      },
      ask: (selection) => {
        clearBookSelection()
        const section = selection.range.sectionIndex
        const conversation = conversationFor(section) ?? newConversation(section, { text: selection.quote.slice(0, 120), ...(selection.range.cfi ? { cfi: selection.range.cfi } : {}) })
        const prefill = section === 10 && !ladderBuilt ? 'wait, why does the top barely move when I pull it out a whole inch?' : ''
        openChat(conversation, selection.quote, prefill)
      },
      note: (selection) => {
        const rect = selectionOnScreen()
        clearBookSelection()
        openSheet({ type: 'note', selection }, { replace: true, snap: 'half', ...(rect ? { spot: rect } : {}) })
      },
      activateMark: (id) => {
        const ids = id.startsWith('proto-many:') ? id.slice(11).split(',') : id.startsWith('proto:') ? [id.slice(6)] : []
        if (!ids.length) return false
        setBack(undefined)
        const cfi = cfis[ids[0]!]
        const rect = cfi ? markingOnScreen(cfi) : undefined
        const sheetState: SheetState = ids.length > 1 ? { type: 'choose', ids } : { type: 'artifact', id: ids[0]! }
        openSheet(sheetState, { replace: true, snap: 'half', ...(rect ? { spot: rect } : {}) })
        return true
      },
    }
  })

  // Slide the page up so the passage stays in view above the sheet.
  const fit = spot && sheetOpen && snap === 'half' && current?.type !== 'chat' ? fitBelow(spot) : undefined
  const lift = fit?.lift ?? 0
  useEffect(() => {
    const area = document.querySelector<HTMLElement>('.reader-book-area')
    if (!area) return
    area.style.transition = 'transform 0.55s cubic-bezier(0.2, 0.8, 0.2, 1)'
    area.style.transform = lift ? `translateY(${-lift}px)` : ''
  }, [lift])

  // ——— render ————————————————————————————————————————————————
  const artifact = current?.type === 'artifact' ? artifacts.find((a) => a.id === current.id) : undefined
  const conversation = current?.type === 'chat' ? conversations.find((c) => c.id === current.id) : undefined
  const unseen = new Set(state.created.filter((a) => !state.seen.includes(a.id)).map((a) => a.id))

  useEffect(() => {
    const button = document.querySelector('[data-proto-notebook]')
    if (button) button.toggleAttribute('data-unseen', unseen.size > 0)
  })

  const chapterStates = useMemo(() => {
    const states: Record<number, string> = {}
    for (const memory of state.memories) {
      if (memory.sectionIndex === undefined) continue
      if (memory.kind === 'understood') states[memory.sectionIndex] = 'understood'
      else if (memory.kind === 'struggled' && !states[memory.sectionIndex]) states[memory.sectionIndex] = 'struggled'
    }
    return states
  }, [state.memories])
  const artifactCounts = useMemo(() => {
    const counts: Record<number, number> = {}
    for (const a of artifacts) if (a.anchor && !dismissed.has(a.id)) counts[a.anchor.sectionIndex] = (counts[a.anchor.sectionIndex] ?? 0) + 1
    return counts
  }, [artifacts, dismissed])

  let header: React.ReactNode = null
  let body: React.ReactNode = null
  let label = 'Artifact'

  if (artifact) {
    label = artifact.title
    header = (
      <div className="proto-sheet-head" data-hue={artifact.hue}>
        <div className="proto-sheet-row">
          <span className="proto-kind"><span className="proto-kind-glyph">{artifact.glyph}</span>{KIND_LABEL[artifact.kind]}</span>
          {artifact.versions > 1 ? (
            <button type="button" className="proto-versions" onClick={() => toast({ text: `${artifact.versions} versions kept. Restoring an older one is one tap (prototype).`, action: { label: 'v' + (artifact.versions - 1), run: () => toast({ text: `Restored version ${artifact.versions - 1}. The newer one is still kept.` }) } })}>
              <History size={12} aria-hidden="true" /> v{artifact.versions}
            </button>
          ) : null}
          <span className="proto-spacer" />
          {artifact.anchor ? (
            <button type="button" className="proto-icon" aria-label="Go to the passage" onClick={() => void goTo({ ...(cfis[artifact.id] ? { cfi: cfis[artifact.id] } : {}), sectionIndex: artifact.anchor!.sectionIndex, text: artifact.anchor!.text }, artifact)}>
              <BookOpen size={17} />
            </button>
          ) : null}
          <button type="button" className="proto-icon" aria-label="More" aria-expanded={menu} onClick={() => { setMenu(!menu); setConfirmDelete(false) }}>
            <MoreHorizontal size={18} />
          </button>
          <button type="button" className="proto-icon" aria-label="Close" onClick={closeSheet}>
            <X size={18} />
          </button>
        </div>
        <h2 className="proto-sheet-title">{artifact.title}</h2>
        {artifact.anchor ? (
          <p className="proto-anchor-line"><span>{artifact.anchor.chapter}</span> · “{clip(artifact.anchor.text, 70)}”</p>
        ) : (
          <p className="proto-anchor-line"><span>The whole book</span></p>
        )}
        <AnimatePresence>
          {menu ? (
            <motion.div className="proto-menu" initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.97 }}>
              {confirmDelete ? (
                <>
                  <p>Delete “{artifact.title}” for good? Dismiss keeps it findable; delete can’t be undone.</p>
                  <div className="proto-menu-row">
                    <button type="button" className="proto-mini" onClick={() => setConfirmDelete(false)}>Keep it</button>
                    <button type="button" className="proto-mini proto-mini-danger" onClick={() => { proto.remove(artifact.id); closeSheet(); toast({ text: 'Deleted.' }) }}>Delete forever</button>
                  </div>
                </>
              ) : (
                <>
                  <button type="button" onClick={() => { proto.dismiss(artifact.id); closeSheet(); toast({ text: `Dismissed. It’s in the Notebook under Dismissed.`, action: { label: 'Undo', run: () => proto.restore(artifact.id) } }) }}>
                    <EyeOff size={15} /> Dismiss <small>hide it and its marking</small>
                  </button>
                  <button type="button" onClick={() => { const conv = artifact.anchor ? conversationFor(artifact.anchor.sectionIndex) ?? newConversation(artifact.anchor.sectionIndex, { text: artifact.anchor.text }) : conversations[0]; if (conv) openChat(conv, `About “${artifact.title}”`) }}>
                    <Sparkles size={15} /> Ask the tutor to change it
                  </button>
                  <button type="button" className="proto-danger" onClick={() => setConfirmDelete(true)}>
                    <Trash2 size={15} /> Delete…
                  </button>
                </>
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    )
    body = (
      <ArtifactFrame
        key={artifact.id}
        html={artifact.html}
        surface="artifact"
        theme={props.theme}
        artifact={{
          id: artifact.id,
          title: artifact.title,
          context: artifact.kind === 'map' ? { sectionIndex: props.sectionIndex, chapterStates, artifactCounts } : undefined,
        }}
        onBridge={(message) => onBridge(message, artifact)}
        minHeight={300}
      />
    )
  } else if (conversation) {
    label = conversation.title
    header = (
      <div className="proto-sheet-head">
        <div className="proto-sheet-row">
          <span className="proto-kind proto-kind-chat"><span className="proto-kind-glyph">✧</span>Tutor · {conversation.chapter}</span>
          <span className="proto-spacer" />
          <button type="button" className="proto-icon" aria-label="Close" onClick={closeSheet}><X size={18} /></button>
        </div>
        <h2 className="proto-sheet-title">{conversation.title}</h2>
        <p className="proto-anchor-line"><Diamond size={10} aria-hidden="true" /> Knows {state.memories.length} memories and your voice</p>
      </div>
    )
    body = (
      <Conversation
        conversation={conversation}
        artifacts={artifacts}
        theme={props.theme}
        draft={draft}
        onDraft={setDraft}
        {...(attached ? { attachedPassage: attached } : {})}
        onDetachPassage={() => setAttached(undefined)}
        busy={busy}
        onSend={(text) => void runFlow(conversation, text, attached)}
        onKeep={(message, from, part) => keep(conversation, message, from, part)}
        onOpenArtifact={(id) => openSheet({ type: 'artifact', id })}
        onAnswerMemory={(message, save) => answerMemory(conversation, message, save)}
        onBridge={(message) => onBridge(message)}
      />
    )
  } else if (current?.type === 'choose') {
    const here = current.ids.map((id) => artifacts.find((a) => a.id === id)).filter((a): a is Artifact => Boolean(a))
    label = 'On this passage'
    header = (
      <div className="proto-sheet-head">
        <div className="proto-sheet-row">
          <span className="proto-kind"><span className="proto-kind-glyph">{here.length}</span>On this passage</span>
          <span className="proto-spacer" />
          <button type="button" className="proto-icon" aria-label="Close" onClick={closeSheet}><X size={18} /></button>
        </div>
        {here[0]?.anchor ? <p className="proto-anchor-line"><span>{here[0].anchor.chapter}</span> · “{clip(here[0].anchor.text, 70)}”</p> : null}
      </div>
    )
    body = (
      <div className="proto-choose">
        {here.map((a, index) => (
          <motion.button
            key={a.id}
            type="button"
            className="proto-artifact-link"
            data-hue={a.hue}
            onClick={() => openSheet({ type: 'artifact', id: a.id })}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06, type: 'spring', stiffness: 380, damping: 26 }}
          >
            <span className="proto-artifact-link-poster"><Poster id={a.poster} /></span>
            <span className="proto-artifact-link-text">
              <small>{a.glyph} {KIND_LABEL[a.kind]}</small>
              <strong>{a.title}</strong>
              <span>{a.summary}</span>
            </span>
          </motion.button>
        ))}
      </div>
    )
  } else if (current?.type === 'note') {
    label = 'New note'
    const selection = current.selection
    header = (
      <div className="proto-sheet-head" data-hue="amber">
        <div className="proto-sheet-row">
          <span className="proto-kind"><span className="proto-kind-glyph">✎</span>Your note</span>
          <span className="proto-spacer" />
          <button type="button" className="proto-icon" aria-label="Close" onClick={closeSheet}><X size={18} /></button>
        </div>
      </div>
    )
    body = <NoteComposer quote={selection.quote} onSave={(text) => {
      const section = selection.range.sectionIndex
      const id = `note-${Date.now()}`
      proto.addArtifact({
        id,
        title: clip(text.split(/[.!?\n]/)[0] || 'A note', 48),
        summary: clip(text, 90),
        kind: 'note',
        anchor: { sectionIndex: section, text: selection.quote.slice(0, 120), chapter: CHAPTERS[section] ?? `Section ${section}`, ...(selection.range.cfi ? { cfi: selection.range.cfi } : {}) },
        marking: 'pin',
        hue: 'amber',
        glyph: '✎',
        html: noteHtml(text.replace(/</g, '&lt;').replace(/\n/g, '<br>'), clip(selection.quote, 280), section, CHAPTERS[section] ?? 'The passage'),
        author: 'reader',
        createdAt: new Date().toISOString(),
        versions: 1,
        poster: 'note',
      })
      closeSheet()
      toast({ text: 'Note pinned to the page and kept in your Notebook', tone: 'kept', action: { label: 'Open', run: () => openSheet({ type: 'artifact', id }) } })
    }} />
  }

  return (
    <>
      <AnimatePresence>
        {notebook ? (
          <Notebook
            key="notebook"
            bookTitle={props.bookTitle}
            artifacts={artifacts}
            dismissed={state.dismissed}
            unseen={unseen}
            memories={state.memories}
            voice={state.voice}
            conversations={conversations}
            highlights={props.highlights}
            settings={state.settings}
            {...(props.sectionIndex === undefined ? {} : { sectionIndex: props.sectionIndex })}
            onClose={() => setNotebook(false)}
            onOpenArtifact={(id) => openSheet({ type: 'artifact', id }, { snap: 'full' })}
            onOpenConversation={(id) => { const c = conversations.find((x) => x.id === id); if (c) openChat(c) }}
            onGoToHighlight={(annotation) => void goTo({ ...(annotation.range.cfi ? { cfi: annotation.range.cfi } : {}), sectionIndex: annotation.range.sectionIndex })}
            onRestore={(id) => { proto.restore(id); toast({ text: 'Back on the page.' }) }}
            onEditMemory={(id, text) => { proto.editMemory(id, text); toast({ text: 'Memory updated. Future tutors will see the new version.', tone: 'memory' }) }}
            onDeleteMemory={(memory) => { proto.removeMemory(memory.id); toast({ text: 'Memory deleted.', action: { label: 'Undo', run: () => proto.addMemory(memory) } }) }}
            onVoice={(voice) => { proto.setVoice(voice); toast({ text: 'Voice saved. Every agent reads it before speaking.', tone: 'memory' }) }}
            onSettings={(patch) => proto.setSettings(patch)}
            onReset={() => { proto.reset(); setCfis({}); toast({ text: 'Prototype data reset.' }) }}
            onTryLadder={() => void tryLadder()}
          />
        ) : null}
      </AnimatePresence>

      <Sheet
        open={sheetOpen && Boolean(current)}
        snap={snap}
        onSnap={setSnap}
        onClose={closeSheet}
        header={header}
        label={label}
        layer={notebook ? 1 : 0}
        className={current?.type === 'chat' ? 'proto-sheet-chat' : undefined}
        {...(fit && spot ? { spotlight: { ...spot, y: spot.y - fit.lift }, halfHeight: fit.height } : {})}
      >
        {body}
      </Sheet>

      <AnimatePresence>
        {back && !sheetOpen && !notebook ? (
          <motion.div className="proto-back" initial={{ opacity: 0, y: -16, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -16, scale: 0.9 }} transition={{ type: 'spring', stiffness: 400, damping: 28 }}>
            <button type="button" onClick={() => { const id = back.id; setBack(undefined); openSheet({ type: 'artifact', id }, { replace: true }) }}>
              <ArrowLeft size={15} aria-hidden="true" />
              <span>Back to <strong>{back.title}</strong></span>
            </button>
            <button type="button" aria-label="Stay here" className="proto-back-x" onClick={() => setBack(undefined)}><X size={14} /></button>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="proto-toasts" aria-live="polite">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              className="proto-toast"
              data-tone={t.tone ?? 'plain'}
              initial={{ opacity: 0, y: 24, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 420, damping: 30 }}
            >
              <span className="proto-toast-icon">{t.tone === 'memory' ? <Diamond size={13} /> : t.tone === 'made' ? <Sparkles size={13} /> : t.tone === 'kept' ? <Check size={13} /> : <ExternalLink size={13} />}</span>
              <span className="proto-toast-text">{t.text}</span>
              {t.action ? (
                <button type="button" onClick={() => { t.action!.run(); setToasts((list) => list.filter((x) => x.id !== t.id)) }}>{t.action.label}</button>
              ) : null}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </>
  )
}

function NoteComposer({ quote, onSave }: { readonly quote: string; readonly onSave: (text: string) => void }) {
  const [text, setText] = useState('')
  return (
    <div className="proto-note">
      <blockquote>{clip(quote, 240)}</blockquote>
      <textarea
        autoFocus
        rows={5}
        value={text}
        placeholder="What do you want to remember about this?"
        onChange={(event) => setText(event.target.value)}
      />
      <div className="proto-note-actions">
        <span className="proto-hint">Notes are artifacts too. The tutor can read and build on them.</span>
        <button type="button" className="proto-primary" disabled={!text.trim()} onClick={() => onSave(text.trim())}>Pin note</button>
      </div>
    </div>
  )
}
