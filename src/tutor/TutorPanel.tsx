import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { MessageCircle, X } from 'lucide-react'

import type { AiConnectionController } from '../ai/connection-controller.ts'
import type { AiFeatureIntent } from '../ai/pending-intent.ts'
import { StudyText } from '../study/StudyItemCard.tsx'
import type { ToolDefinition } from '../webmcp/model-context.ts'
import { TutorConversation, type TutorAttachment } from './conversation.ts'
import { formatTutorFailureDiagnostic } from './failure.ts'
import { bookhandToolDeclarations } from './tool-adapter.ts'
import './tutor.css'

export interface TutorPanelProps {
  readonly bookId: string
  readonly tools?: readonly ToolDefinition[]
  readonly connection: AiConnectionController
  readonly open: boolean
  readonly attachment?: TutorAttachment
  readonly pendingIntent?: AiFeatureIntent
  readonly onAuthorizationFinished?: () => void
  readonly onClose: () => void
  readonly onStudy: () => void
  readonly beforeRedirect?: () => Promise<void>
  readonly readerReady?: boolean
}

interface ConversationBundle {
  readonly conversation: TutorConversation
  readonly tools: readonly ToolDefinition[]
}

export function TutorPanel(props: TutorPanelProps) {
  const [bundle, setBundle] = useState<ConversationBundle>()
  const bundleRef = useRef<ConversationBundle | undefined>(undefined)
  const [localError, setLocalError] = useState<string>()
  const latestTools = useRef(props.tools)
  latestTools.current = props.tools
  const latestRedirect = useRef(props.beforeRedirect)
  latestRedirect.current = props.beforeRedirect
  const toolsReady = props.tools !== undefined

  useEffect(() => {
    bundleRef.current = undefined
    setBundle(undefined)
    return () => {
      bundleRef.current?.conversation.dispose()
      bundleRef.current = undefined
    }
  }, [props.bookId, props.connection])

  useEffect(() => {
    const initialTools = latestTools.current
    if (!initialTools || bundleRef.current) return
    // Freeze the exact declarations approved for this conversation while
    // dispatching to the current same-schema handler for this same book.
    const tools = initialTools.map((tool) => ({
      ...tool,
      execute: ((input, options) => {
        const current = latestTools.current?.find((candidate) => candidate.name === tool.name)
        if (
          !current
          || current.description !== tool.description
          || JSON.stringify(current.inputSchema) !== JSON.stringify(tool.inputSchema)
        ) {
          throw new Error('Bookhand tools changed. Reopen the book and connect again.')
        }
        return current.execute(input, options)
      }) as ToolDefinition['execute'],
    }))
    const conversation = new TutorConversation({
      bookId: props.bookId,
      tools,
      connection: props.connection,
    })
    const next = { conversation, tools }
    bundleRef.current = next
    setBundle(next)
  }, [props.bookId, props.connection, toolsReady])

  useEffect(() => {
    if (props.attachment) bundle?.conversation.attach(props.attachment)
  }, [bundle, props.attachment])

  useEffect(() => {
    if (
      !bundle
      || props.readerReady === false
      || props.pendingIntent?.feature !== 'tutor'
      || props.pendingIntent.bookId !== props.bookId
    ) return

    // Defer past StrictMode's setup/cleanup probe. The store owns callback
    // claiming and makes completion idempotent; this path never sends a turn.
    let current = true
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const intent = props.pendingIntent
          if (!current || !intent) return
          bundle.conversation.setDraft(intent.draft)
          bundle.conversation.attach(intent.attachment)
          await props.connection.finishAuthorization(bookhandToolDeclarations(bundle.tools))
        } catch {
          if (current && !props.connection.getSnapshot().error) setLocalError('Could not verify approval. Connect again.')
        } finally {
          if (current) props.onAuthorizationFinished?.()
        }
      })()
    }, 0)
    return () => {
      current = false
      window.clearTimeout(timer)
    }
  }, [bundle, props.bookId, props.connection, props.onAuthorizationFinished, props.pendingIntent, props.readerReady])

  if (!bundle) {
    return (
      <aside id="reader-tutor-panel" className="reader-panel tutor-panel" aria-label="Tutor" hidden={!props.open}>
        <header className="panel-head">
          <h2 tabIndex={-1}>Tutor</h2>
          <div className="tutor-actions">
            <button className="button button-text" type="button" onClick={props.onStudy}>View Study</button>
            <button className="button button-icon" type="button" aria-label="Close tutor" onClick={props.onClose}><X size={18} /></button>
          </div>
        </header>
        <p className="state-line" role="status">Preparing this book’s tools…</p>
      </aside>
    )
  }

  return (
    <TutorPanelContent
      {...props}
      bundle={bundle}
      localError={localError}
      clearLocalError={() => setLocalError(undefined)}
      reportLocalError={setLocalError}
    />
  )
}

function TutorPanelContent({
  bundle,
  connection,
  open,
  onClose,
  onStudy,
  bookId,
  readerReady = true,
  beforeRedirect,
  localError,
  clearLocalError,
  reportLocalError,
}: TutorPanelProps & {
  readonly bundle: ConversationBundle
  readonly localError?: string
  readonly clearLocalError: () => void
  readonly reportLocalError: (message: string | undefined) => void
}) {
  const { conversation, tools } = bundle
  const connectionState = useSyncExternalStore(connection.subscribe, connection.getSnapshot)
  const state = useSyncExternalStore(conversation.subscribe, conversation.getSnapshot)
  const heading = useRef<HTMLHeadingElement>(null)
  const transcript = useRef<HTMLDivElement>(null)
  const followScroll = useRef(true)

  useEffect(() => { if (open) heading.current?.focus() }, [open])
  useEffect(() => {
    if (!open || !readerReady) return
    void connection.resume(bookhandToolDeclarations(tools))
    if (connectionState.phase === 'connected') conversation.restoreLastConversation()
  }, [connection, connectionState.phase, conversation, open, readerReady, tools])
  useEffect(() => {
    if (open && state.messages.length && followScroll.current && transcript.current) {
      transcript.current.scrollTop = transcript.current.scrollHeight
    }
  }, [open, state.messages])

  const busy = connectionState.phase === 'connecting' || !readerReady
  const running = state.status === 'running'
  const problem = localError ?? connectionState.error ?? state.error

  const authorize = async () => {
    clearLocalError()
    try {
      await connection.authorize({
        tools: bookhandToolDeclarations(tools),
        intent: {
          feature: 'tutor',
          bookId,
          draft: state.draft,
          ...(state.attachment ? { attachment: state.attachment } : {}),
        },
        beforeRedirect: async () => { await beforeRedirect?.() },
      })
    } catch (error) {
      reportLocalError(describeError(error))
    }
  }

  return (
    <aside id="reader-tutor-panel" className="reader-panel tutor-panel" aria-label="Tutor" hidden={!open}>
      <header className="panel-head">
        <h2 ref={heading} tabIndex={-1}>Tutor</h2>
        <div className="tutor-actions">
          <button className="button button-text" type="button" onClick={onStudy}>View Study</button>
          <button className="button button-icon" type="button" aria-label="Close tutor" onClick={onClose}><X size={18} /></button>
        </div>
      </header>

      <div className="tutor-transcript" ref={transcript} onScroll={() => {
        const element = transcript.current
        if (element) followScroll.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80
      }}>
        {connectionState.phase !== 'connected' ? (
          <section className="tutor-connect" aria-label="Connect your AI">
            <MessageCircle size={24} aria-hidden="true" />
            <h3>Connect your tutor</h3>
            <p className="tutor-hint">Your gateway receives questions and book passages when you ask Tutor.</p>

            <label htmlFor="tutor-provider">Gateway address</label>
            <input
              id="tutor-provider"
              type="text"
              inputMode="url"
              value={connectionState.providerUrl}
              disabled={busy}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder="https://gateway.example"
              onChange={(event) => {
                clearLocalError()
                connection.setProviderUrl(event.target.value)
              }}
            />
            <button
              className="button button-primary"
              type="button"
              disabled={busy || !connectionState.providerUrl.trim()}
              onClick={() => { void authorize() }}
            >
              {!readerReady ? 'Waiting for the book…' : busy ? 'Connecting…' : 'Connect with Agent Connect'}
            </button>
            {problem ? <p className="tutor-error" role="alert">{problem}</p> : null}
          </section>
        ) : (
          <>
            <div className="tutor-connection-line">
              <span title={connectionState.providerUrl}>Gateway connected</span>
              <button className="button button-text" type="button" disabled={running} onClick={() => conversation.newConversation()}>New conversation</button>
              <button className="button button-text" type="button" onClick={() => { void connection.disconnect().catch(() => undefined) }}>Disconnect</button>
            </div>
            {state.restored ? <p className="tutor-hint" role="status">Last conversation restored.</p> : null}
          </>
        )}

        {state.messages.map((message) => (
          <section key={message.id} className="tutor-message" data-role={message.role}>
            <h3>{message.role === 'user' ? 'You' : 'Tutor'}</h3>
            <p className="tutor-message-text">
              <StudyText text={message.text} />
            </p>
            {message.activity ? <p className="tutor-hint">{message.activity}</p> : null}
            {message.status === 'interrupted' ? <p className="tutor-hint">Turn interrupted</p> : null}
          </section>
        ))}
      </div>

      {connectionState.phase === 'connected' ? (
        <div className="tutor-compose">
          {problem ? <p className="tutor-error" role="alert">{problem}</p> : null}
          {state.diagnostic ? (
            <p className="tutor-hint" role="status">
              Technical detail: {formatTutorFailureDiagnostic(state.diagnostic)}
            </p>
          ) : null}
          {state.partialEffectsWarning ? (
            <p className="tutor-error" role="status">{state.partialEffectsWarning}</p>
          ) : null}
          {state.status === 'interrupted' ? (
            <div className="tutor-recovery">
              <p className="tutor-hint">This conversation has ended.</p>
              <button className="button button-quiet" type="button" disabled={busy} onClick={() => conversation.newConversation()}>Start new conversation</button>
            </div>
          ) : null}
          {state.attachment ? (
            <div className="tutor-attachment">
              <blockquote><StudyText text={state.attachment.selection.quote} /></blockquote>
              <button className="button button-icon" aria-label="Remove selected passage" type="button" onClick={() => conversation.attach(undefined)}><X size={16} /></button>
            </div>
          ) : null}
          <form onSubmit={(event) => {
            event.preventDefault()
            followScroll.current = true
            void conversation.send()
          }}>
            <label htmlFor="tutor-question">Ask about your book</label>
            <textarea
              id="tutor-question"
              rows={3}
              value={state.draft}
              placeholder="Explain this passage, and save a worked example in Study…"
              onChange={(event) => conversation.setDraft(event.target.value)}
            />
            <div className="tutor-actions tutor-send-actions">
              {running ? (
                <button type="button" className="button button-quiet" onClick={() => { void conversation.stop() }}>Stop response</button>
              ) : (
                <button type="submit" className="button button-primary" disabled={!readerReady || connectionState.phase !== 'connected' || !state.canSend || !state.draft.trim()}>Send</button>
              )}
              <span className="tutor-hint" role="status">{running ? 'Tutor is working…' : state.attachment ? 'Selected passage attached' : 'Uses this book’s tools'}</span>
            </div>
          </form>
        </div>
      ) : null}
    </aside>
  )
}

function describeError(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : 'Bookhand could not start this connection. Check the address and try again.'
}
