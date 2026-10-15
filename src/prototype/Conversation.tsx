import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowUp, BookmarkPlus, Check, Diamond, Quote, Sparkles, X } from 'lucide-react'
import { ArtifactFrame, type BridgeMessage, type FrameTheme } from './ArtifactFrame.tsx'
import type { Artifact, Conversation as ConversationModel, Message } from './model.ts'
import { Poster } from './Posters.tsx'

export interface ConversationProps {
  readonly conversation: ConversationModel
  readonly artifacts: readonly Artifact[]
  readonly theme: FrameTheme
  readonly draft: string
  readonly attachedPassage?: string
  readonly onDraft: (value: string) => void
  readonly onDetachPassage: () => void
  readonly onSend: (text: string) => void
  readonly onKeep: (message: Message, from: HTMLElement, part?: { text: string; html: string }) => void
  readonly onOpenArtifact: (id: string) => void
  readonly onAnswerMemory: (message: Message, save: boolean) => void
  readonly onBridge: (message: BridgeMessage) => void
  readonly busy: boolean
}

function Receipts({ receipts, live }: { readonly receipts: readonly string[]; readonly live: boolean }) {
  return (
    <div className="proto-receipts" aria-label="What the tutor did">
      <AnimatePresence initial={live}>
        {receipts.map((receipt) => (
          <motion.span
            key={receipt}
            className="proto-receipt"
            initial={{ opacity: 0, y: 6, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 420, damping: 26 }}
          >
            <Check size={11} aria-hidden="true" />
            {receipt}
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  )
}

function Thinking() {
  return (
    <div className="proto-thinking" aria-label="Thinking">
      <span /><span /><span />
    </div>
  )
}

function Building() {
  return (
    <motion.div
      className="proto-building"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
    >
      <div className="proto-building-poster"><Sparkles size={20} aria-hidden="true" /></div>
      <div>
        <strong>Building an artifact…</strong>
        <div className="proto-building-bar"><span /></div>
        <small>Sketching the ladder · wiring the drag · checking Thompson’s numbers</small>
      </div>
    </motion.div>
  )
}

function ArtifactLink({ artifact, onOpen, fresh }: { readonly artifact: Artifact; readonly onOpen: () => void; readonly fresh: boolean }) {
  return (
    <motion.button
      type="button"
      className="proto-artifact-link"
      data-hue={artifact.hue}
      onClick={onOpen}
      initial={fresh ? { opacity: 0, scale: 0.9, y: 12 } : false}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      <span className="proto-artifact-link-poster"><Poster id={artifact.poster} /></span>
      <span className="proto-artifact-link-text">
        <small><Sparkles size={11} aria-hidden="true" /> Made an artifact · on the page</small>
        <strong>{artifact.title}</strong>
        <span>{artifact.summary}</span>
      </span>
    </motion.button>
  )
}

function TutorTurn({
  message,
  props,
  live,
}: {
  readonly message: Message
  readonly props: ConversationProps
  readonly live: boolean
}) {
  const keepButton = useRef<HTMLButtonElement>(null)
  const artifact = message.artifactId ? props.artifacts.find((a) => a.id === message.artifactId) : undefined
  const status = message.status ?? 'done'
  return (
    <div className="proto-turn proto-turn-tutor">
      {message.receipts?.length ? <Receipts receipts={message.receipts} live={live} /> : null}
      {status === 'thinking' ? <Thinking /> : null}
      {status === 'streaming' ? <p className="proto-stream">{message.body}<span className="proto-caret" /></p> : null}
      {status !== 'thinking' && status !== 'streaming' ? (
        <ArtifactFrame
          html={message.body}
          surface="message"
          theme={props.theme}
          animate={!live}
          onBridge={(bridge) => {
            if (bridge.type === 'keep') props.onKeep(message, keepButton.current ?? document.body, bridge)
            else props.onBridge(bridge)
          }}
          minHeight={40}
          title="Tutor reply"
        />
      ) : null}
      <AnimatePresence>{status === 'building' ? <Building /> : null}</AnimatePresence>
      {artifact && status !== 'building' ? (
        <ArtifactLink artifact={artifact} onOpen={() => props.onOpenArtifact(artifact.id)} fresh={live} />
      ) : null}
      {message.remembered ? (
        <div className="proto-remembered"><Diamond size={11} aria-hidden="true" /> Remembered: {message.remembered}</div>
      ) : null}
      <AnimatePresence>
        {message.memoryAsk && !message.memoryAnswer ? (
          <motion.div
            className="proto-memory-ask"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Diamond size={13} aria-hidden="true" />
            <span>Can I remember that <em>{message.memoryAsk}</em>?</span>
            <div>
              <button type="button" className="proto-mini" onClick={() => props.onAnswerMemory(message, false)}>Not now</button>
              <button type="button" className="proto-mini proto-mini-primary" onClick={() => props.onAnswerMemory(message, true)}>Remember</button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      {message.memoryAnswer === 'saved' ? (
        <div className="proto-remembered"><Diamond size={11} aria-hidden="true" /> Remembered: {message.memoryAsk}</div>
      ) : null}
      {status === 'done' ? (
        <div className="proto-turn-actions">
          <button
            ref={keepButton}
            type="button"
            className="proto-keep"
            onClick={(event) => props.onKeep(message, event.currentTarget)}
          >
            <BookmarkPlus size={15} aria-hidden="true" />
            Keep
          </button>
          <span className="proto-hint">or select part of it</span>
        </div>
      ) : null}
    </div>
  )
}

export function Conversation(props: ConversationProps) {
  const { conversation } = props
  const end = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)
  const [initialCount] = useState(conversation.messages.length)
  const last = conversation.messages[conversation.messages.length - 1]

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [conversation.messages.length, last?.status, last?.body.length])

  useEffect(() => {
    if (!input.current) return
    input.current.style.height = 'auto'
    input.current.style.height = `${Math.min(140, input.current.scrollHeight)}px`
  }, [props.draft])

  const send = () => {
    const text = props.draft.trim()
    if (!text || props.busy) return
    props.onSend(text)
  }

  return (
    <div className="proto-conversation">
      {conversation.messages.map((message, index) =>
        message.role === 'reader' ? (
          <motion.div
            key={message.id}
            className="proto-turn proto-turn-reader"
            initial={index >= initialCount ? { opacity: 0, y: 14, scale: 0.96 } : false}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 380, damping: 26 }}
          >
            {message.passage ? (
              <div className="proto-passage-chip"><Quote size={12} aria-hidden="true" /><span>{message.passage}</span></div>
            ) : null}
            <p className="proto-bubble">{message.body}</p>
          </motion.div>
        ) : (
          <TutorTurn key={message.id} message={message} props={props} live={index >= initialCount} />
        ),
      )}
      <div ref={end} className="proto-conversation-end" />
      <div className="proto-composer" data-busy={props.busy || undefined}>
        <AnimatePresence>
          {props.attachedPassage ? (
            <motion.div
              className="proto-passage-chip proto-passage-attached"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
            >
              <Quote size={12} aria-hidden="true" />
              <span>{props.attachedPassage}</span>
              <button type="button" aria-label="Remove passage" onClick={props.onDetachPassage}><X size={13} /></button>
            </motion.div>
          ) : null}
        </AnimatePresence>
        <div className="proto-composer-row">
          <textarea
            ref={input}
            rows={1}
            value={props.draft}
            placeholder={props.busy ? 'Your tutor is working…' : 'Ask about this…'}
            onChange={(event) => props.onDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                send()
              }
            }}
          />
          <button type="button" className="proto-send" aria-label="Send" disabled={!props.draft.trim() || props.busy} onClick={send}>
            <ArrowUp size={18} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  )
}
