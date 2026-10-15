import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  ChevronDown,
  Diamond,
  Highlighter,
  MessagesSquare,
  Mic2,
  Settings2,
  Sparkles,
  Trash2,
  Undo2,
  X,
} from 'lucide-react'
import type { Annotation } from '../domain/index.ts'
import type { Artifact, Conversation, Memory, Voice } from './model.ts'
import { KIND_LABEL, MEMORY_LABEL } from './model.ts'
import { CHAPTERS } from './seed.ts'
import { Poster } from './Posters.tsx'
import type { ProtoSettings } from './store.ts'

type Filter = 'all' | 'artifacts' | 'memories' | 'chats' | 'highlights'

export interface NotebookProps {
  readonly bookTitle: string
  readonly artifacts: readonly Artifact[]
  readonly dismissed: readonly string[]
  readonly unseen: ReadonlySet<string>
  readonly memories: readonly Memory[]
  readonly voice: Voice
  readonly conversations: readonly Conversation[]
  readonly highlights: readonly Annotation[]
  readonly settings: ProtoSettings
  readonly sectionIndex?: number
  readonly onClose: () => void
  readonly onOpenArtifact: (id: string) => void
  readonly onOpenConversation: (id: string) => void
  readonly onGoToHighlight: (annotation: Annotation) => void
  readonly onRestore: (id: string) => void
  readonly onEditMemory: (id: string, text: string) => void
  readonly onDeleteMemory: (memory: Memory) => void
  readonly onVoice: (voice: Voice) => void
  readonly onSettings: (patch: Partial<ProtoSettings>) => void
  readonly onReset: () => void
  readonly onTryLadder: () => void
}

const when = (iso: string) => {
  const days = Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000)
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`
}

const roman = (section: number | undefined) => {
  if (section === undefined) return '∞'
  const label = CHAPTERS[section] ?? ''
  return label.includes(' · ') ? label.split(' · ')[0] : '¶'
}
const chapterTitle = (section: number | undefined) =>
  section === undefined ? 'The whole book' : (CHAPTERS[section] ?? `Section ${section}`).split(' · ')[1] ?? CHAPTERS[section]

type Entry =
  | { readonly type: 'artifact'; readonly at: string; readonly section?: number; readonly artifact: Artifact }
  | { readonly type: 'memory'; readonly at: string; readonly section?: number; readonly memory: Memory }
  | { readonly type: 'chat'; readonly at: string; readonly section?: number; readonly conversation: Conversation }
  | { readonly type: 'highlight'; readonly at: string; readonly section?: number; readonly annotation: Annotation }

const matches = (filter: Filter, entry: Entry) =>
  filter === 'all' ||
  (filter === 'artifacts' && entry.type === 'artifact') ||
  (filter === 'memories' && entry.type === 'memory') ||
  (filter === 'chats' && entry.type === 'chat') ||
  (filter === 'highlights' && entry.type === 'highlight')

function ArtifactCard({ artifact, fresh, onOpen }: { readonly artifact: Artifact; readonly fresh: boolean; readonly onOpen: () => void }) {
  return (
    <motion.button
      layout
      type="button"
      className="nb-artifact"
      data-hue={artifact.hue}
      data-kind={artifact.kind}
      onClick={onOpen}
      whileTap={{ scale: 0.97 }}
    >
      <span className="nb-poster"><Poster id={artifact.poster} /></span>
      <span className="nb-artifact-text">
        <span className="nb-kind">
          <span className="nb-glyph">{artifact.glyph}</span>
          {KIND_LABEL[artifact.kind]}
          {fresh ? <span className="nb-new">new</span> : null}
        </span>
        <strong>{artifact.title}</strong>
        <span className="nb-summary">{artifact.summary}</span>
        <span className="nb-meta">
          {artifact.versions > 1 ? `v${artifact.versions} · ` : ''}
          {artifact.author === 'reader' ? 'you' : artifact.author === 'kept' ? 'kept' : 'tutor'} · {when(artifact.createdAt)}
        </span>
      </span>
    </motion.button>
  )
}

function MemoryRow({ memory, onEdit, onDelete }: { readonly memory: Memory; readonly onEdit: (text: string) => void; readonly onDelete: () => void }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(memory.text)
  return (
    <motion.div layout className="nb-memory" data-kind={memory.kind}>
      <Diamond size={13} className="nb-memory-icon" aria-hidden="true" />
      <div className="nb-memory-body">
        <span className="nb-memory-kind">{MEMORY_LABEL[memory.kind]} · {memory.by === 'reader' ? 'you said' : 'tutor noted'} {when(memory.createdAt)}</span>
        {editing ? (
          <>
            <textarea value={text} onChange={(event) => setText(event.target.value)} rows={3} autoFocus />
            <div className="nb-memory-actions">
              <button type="button" className="proto-mini" onClick={onDelete}><Trash2 size={12} /> Delete</button>
              <span />
              <button type="button" className="proto-mini" onClick={() => { setText(memory.text); setEditing(false) }}>Cancel</button>
              <button type="button" className="proto-mini proto-mini-primary" onClick={() => { onEdit(text); setEditing(false) }}>Save</button>
            </div>
          </>
        ) : (
          <button type="button" className="nb-memory-text" onClick={() => setEditing(true)}>{memory.text}</button>
        )}
      </div>
    </motion.div>
  )
}

function ChatRow({ conversation, onOpen }: { readonly conversation: Conversation; readonly onOpen: () => void }) {
  const last = [...conversation.messages].reverse().find((m) => m.role === 'reader')
  return (
    <motion.button layout type="button" className="nb-chat" onClick={onOpen} whileTap={{ scale: 0.98 }}>
      <MessagesSquare size={16} className="nb-chat-icon" aria-hidden="true" />
      <span>
        <strong>{conversation.title}</strong>
        <span className="nb-summary">“{last?.body ?? '…'}”</span>
        <span className="nb-meta">{conversation.messages.length} messages · {when(conversation.createdAt)}</span>
      </span>
    </motion.button>
  )
}

function HighlightRow({ annotation, onOpen }: { readonly annotation: Annotation; readonly onOpen: () => void }) {
  return (
    <motion.button layout type="button" className="nb-highlight" data-color={annotation.color} onClick={onOpen} whileTap={{ scale: 0.98 }}>
      <Highlighter size={14} aria-hidden="true" />
      <span className="nb-highlight-quote">{annotation.quote}</span>
    </motion.button>
  )
}

function VoiceCard({ voice, onVoice, bookTitle }: { readonly voice: Voice; readonly onVoice: (voice: Voice) => void; readonly bookTitle: string }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(voice)
  return (
    <motion.section layout className="nb-voice" data-open={open || undefined}>
      <button type="button" className="nb-voice-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="nb-voice-icon"><Mic2 size={16} aria-hidden="true" /></span>
        <span>
          <strong>Your tutor’s voice</strong>
          <span className="nb-summary">{voice.global}</span>
        </span>
        <ChevronDown size={16} className="nb-chevron" aria-hidden="true" />
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            className="nb-voice-edit"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            <label>
              <span>Everywhere</span>
              <textarea rows={4} value={draft.global} onChange={(event) => setDraft({ ...draft, global: event.target.value })} />
            </label>
            <label>
              <span>For {bookTitle}</span>
              <textarea rows={3} value={draft.book} onChange={(event) => setDraft({ ...draft, book: event.target.value })} />
            </label>
            <p className="nb-fine">Every agent reads this before it speaks, in the app or through WebMCP.</p>
            <div className="nb-memory-actions">
              <span />
              <button type="button" className="proto-mini proto-mini-primary" onClick={() => { onVoice(draft); setOpen(false) }}>Save voice</button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.section>
  )
}

export function Notebook(props: NotebookProps) {
  const [filter, setFilter] = useState<Filter>('all')
  const [view, setView] = useState<'chapters' | 'recent'>('chapters')
  const [showDismissed, setShowDismissed] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const dismissed = new Set(props.dismissed)
  const map = props.artifacts.find((a) => a.kind === 'map' && !dismissed.has(a.id))

  const entries = useMemo<Entry[]>(() => {
    const list: Entry[] = [
      ...props.artifacts
        .filter((a) => a.kind !== 'map' && !dismissed.has(a.id))
        .map((artifact) => ({ type: 'artifact' as const, at: artifact.createdAt, section: artifact.anchor?.sectionIndex, artifact })),
      ...props.memories.map((memory) => ({ type: 'memory' as const, at: memory.createdAt, section: memory.sectionIndex, memory })),
      ...props.conversations.map((conversation) => ({ type: 'chat' as const, at: conversation.createdAt, section: conversation.sectionIndex, conversation })),
      ...props.highlights.map((annotation) => ({ type: 'highlight' as const, at: annotation.createdAt, section: annotation.range.sectionIndex, annotation })),
    ]
    return list.filter((entry) => matches(filter, entry))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.artifacts, props.memories, props.conversations, props.highlights, props.dismissed, filter])

  const groups = useMemo(() => {
    if (view === 'recent') return [{ key: 'recent', section: undefined as number | undefined, entries: [...entries].sort((a, b) => b.at.localeCompare(a.at)) }]
    const bySection = new Map<string, { section: number | undefined; entries: Entry[] }>()
    for (const entry of entries) {
      const key = entry.section === undefined ? 'book' : String(entry.section)
      const group = bySection.get(key) ?? { section: entry.section, entries: [] }
      group.entries.push(entry)
      bySection.set(key, group)
    }
    const order = (e: Entry) => ({ artifact: 0, chat: 1, highlight: 2, memory: 3 })[e.type]
    return [...bySection.entries()]
      .map(([key, group]) => ({ key, ...group, entries: group.entries.sort((a, b) => order(a) - order(b)) }))
      .sort((a, b) => (a.section ?? -1) - (b.section ?? -1))
  }, [entries, view])

  const counts = {
    artifacts: props.artifacts.filter((a) => a.kind !== 'map' && !dismissed.has(a.id)).length,
    memories: props.memories.length,
    chats: props.conversations.length,
    highlights: props.highlights.length,
  }
  const dismissedArtifacts = props.artifacts.filter((a) => dismissed.has(a.id))

  return (
    <motion.div
      className="nb"
      role="dialog"
      aria-label="Notebook"
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 320, damping: 34 }}
    >
      <header className="nb-head">
        <div>
          <p className="nb-eyebrow">Notebook</p>
          <h2>{props.bookTitle}</h2>
        </div>
        <button type="button" className="nb-icon" aria-label="Prototype settings" aria-expanded={showSettings} onClick={() => setShowSettings(!showSettings)}>
          <Settings2 size={18} />
        </button>
        <button type="button" className="nb-icon" aria-label="Close notebook" onClick={props.onClose}>
          <X size={20} />
        </button>
      </header>

      <div className="nb-scroll">
        <AnimatePresence>
          {showSettings ? (
            <motion.section className="nb-settings" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
              <p className="nb-fine">Prototype controls</p>
              <div className="nb-setting">
                <span>Markings on the book</span>
                <div className="nb-segment">
                  {(['mixed', 'wash', 'margin', 'pin'] as const).map((value) => (
                    <button key={value} type="button" aria-pressed={props.settings.marking === value} onClick={() => props.onSettings({ marking: value })}>
                      {value === 'mixed' ? 'Each its own' : value[0]!.toUpperCase() + value.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <button type="button" className="proto-mini" onClick={props.onReset}><Undo2 size={12} /> Reset prototype data</button>
            </motion.section>
          ) : null}
        </AnimatePresence>

        <section className="nb-try">
          <p className="nb-fine">Try a flow</p>
          <div className="nb-try-row">
            <button type="button" className="nb-try-card nb-try-wide" onClick={() => props.onOpenArtifact('warm-up-ch3')}>
              <span className="nb-try-clock" aria-hidden="true">◷</span>
              <strong>Tonight’s warm-up · 5 min</strong>
              <span>From bits to ratios, before Chapter III. A session your tutor put together from your memories.</span>
            </button>
            <button type="button" className="nb-try-card" onClick={props.onTryLadder}>
              <Sparkles size={16} aria-hidden="true" />
              <strong>Ask about the ladder</strong>
              <span>Watch the tutor build an artifact live in Chapter III</span>
            </button>
            <button type="button" className="nb-try-card" onClick={() => props.onOpenConversation('c-ch2')}>
              <MessagesSquare size={16} aria-hidden="true" />
              <strong>Keep a reply</strong>
              <span>Open a chat and tap Keep, or select part of a reply</span>
            </button>
          </div>
        </section>

        {map && (filter === 'all' || filter === 'artifacts') ? (
          <motion.button layout type="button" className="nb-map" data-hue={map.hue} onClick={() => props.onOpenArtifact(map.id)} whileTap={{ scale: 0.98 }}>
            <span className="nb-map-poster"><Poster id="map" /></span>
            <span>
              <span className="nb-kind"><span className="nb-glyph">{map.glyph}</span>Whole book · v{map.versions}</span>
              <strong>{map.title}</strong>
              <span className="nb-summary">{map.summary}</span>
            </span>
          </motion.button>
        ) : null}

        <VoiceCard voice={props.voice} onVoice={props.onVoice} bookTitle={props.bookTitle} />

        <div className="nb-filters" role="toolbar" aria-label="Filter">
          {([
            ['all', 'All'],
            ['artifacts', `Artifacts ${counts.artifacts}`],
            ['memories', `Memories ${counts.memories}`],
            ['chats', `Chats ${counts.chats}`],
            ['highlights', `Highlights ${counts.highlights}`],
          ] as const).map(([value, label]) => (
            <button key={value} type="button" className="nb-chip" aria-pressed={filter === value} onClick={() => setFilter(value)}>
              {label}
            </button>
          ))}
        </div>
        <div className="nb-view">
          <button type="button" aria-pressed={view === 'chapters'} onClick={() => setView('chapters')}>By chapter</button>
          <button type="button" aria-pressed={view === 'recent'} onClick={() => setView('recent')}>Recent</button>
        </div>

        {groups.map((group) => (
          <section key={group.key} className="nb-group" data-here={group.section === props.sectionIndex || undefined}>
            {view === 'chapters' ? (
              <header className="nb-chapter">
                <span className="nb-roman">{roman(group.section)}</span>
                <span className="nb-chapter-title">{chapterTitle(group.section)}</span>
                {group.section === props.sectionIndex ? <span className="nb-here">reading</span> : null}
              </header>
            ) : null}
            <div className="nb-items">
              {group.entries.map((entry) => {
                if (entry.type === 'artifact') {
                  return <ArtifactCard key={entry.artifact.id} artifact={entry.artifact} fresh={props.unseen.has(entry.artifact.id)} onOpen={() => props.onOpenArtifact(entry.artifact.id)} />
                }
                if (entry.type === 'memory') {
                  return <MemoryRow key={entry.memory.id} memory={entry.memory} onEdit={(text) => props.onEditMemory(entry.memory.id, text)} onDelete={() => props.onDeleteMemory(entry.memory)} />
                }
                if (entry.type === 'chat') {
                  return <ChatRow key={entry.conversation.id} conversation={entry.conversation} onOpen={() => props.onOpenConversation(entry.conversation.id)} />
                }
                return <HighlightRow key={entry.annotation.id} annotation={entry.annotation} onOpen={() => props.onGoToHighlight(entry.annotation)} />
              })}
            </div>
          </section>
        ))}

        {groups.length === 0 ? <p className="nb-empty">Nothing here yet.</p> : null}

        {dismissedArtifacts.length ? (
          <section className="nb-dismissed">
            <button type="button" className="nb-dismissed-toggle" onClick={() => setShowDismissed(!showDismissed)} aria-expanded={showDismissed}>
              {dismissedArtifacts.length} dismissed <ChevronDown size={14} aria-hidden="true" />
            </button>
            <AnimatePresence>
              {showDismissed ? (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                  {dismissedArtifacts.map((artifact) => (
                    <div key={artifact.id} className="nb-dismissed-row">
                      <span>{artifact.title}</span>
                      <button type="button" className="proto-mini" onClick={() => props.onRestore(artifact.id)}>Bring back</button>
                    </div>
                  ))}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </section>
        ) : null}
        <p className="nb-footnote">Nothing here disappears unless you dismiss or delete it.</p>
      </div>
    </motion.div>
  )
}
