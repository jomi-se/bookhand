import { useEffect, useRef, useState } from 'react'
import type { ReaderThemePalette } from '../reader/theme.ts'
import type { PaintedReaderTheme } from '../reader/theme.ts'

/** Requests an artifact may make. Bookhand decides what to do with each. */
export type BridgeMessage =
  | { readonly type: 'navigate'; readonly cfi?: string; readonly sectionIndex?: number; readonly text?: string }
  | { readonly type: 'open'; readonly id: string }
  | { readonly type: 'link'; readonly url: string }
  | { readonly type: 'remember'; readonly text: string }
  | { readonly type: 'keep'; readonly text: string; readonly html: string }
  | { readonly type: 'toast'; readonly text: string }

export interface FrameTheme {
  readonly name: PaintedReaderTheme
  readonly palette: ReaderThemePalette
}

export interface ArtifactFrameProps {
  readonly html: string
  readonly surface: 'artifact' | 'message' | 'preview'
  readonly theme: FrameTheme
  readonly artifact?: { readonly id: string; readonly title: string; readonly context?: unknown }
  readonly animate?: boolean
  readonly onBridge?: (message: BridgeMessage) => void
  readonly onRendered?: () => void
  readonly minHeight?: number
  readonly className?: string
  readonly title?: string
}

const FRAME_URL = `${import.meta.env.BASE_URL}artifact-frame.html`

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function ArtifactFrame({
  html,
  surface,
  theme,
  artifact,
  animate = true,
  onBridge,
  onRendered,
  minHeight = 80,
  className,
  title,
}: ArtifactFrameProps) {
  const frame = useRef<HTMLIFrameElement>(null)
  const [ready, setReady] = useState(false)
  const [rendered, setRendered] = useState(false)
  const [height, setHeight] = useState(minHeight)
  const bridge = useRef(onBridge)
  const renderedCallback = useRef(onRendered)
  useEffect(() => {
    bridge.current = onBridge
    renderedCallback.current = onRendered
  })

  const themeMessage = {
    name: theme.name,
    canvas: theme.palette.canvas,
    ink: theme.palette.ink,
    muted: theme.palette.muted,
    rule: theme.palette.rule,
    accent: theme.palette.accent,
    accentQuiet: theme.palette.accentQuiet,
    raised: theme.palette.raised,
  }

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow) return
      const data = event.data as { bh?: boolean; type?: string; height?: number }
      if (!data || data.bh !== true) return
      if (data.type === 'ready') setReady(true)
      else if (data.type === 'height' && typeof data.height === 'number') setHeight(Math.max(minHeight, data.height))
      else if (data.type === 'rendered') {
        setRendered(true)
        renderedCallback.current?.()
      } else bridge.current?.(data as unknown as BridgeMessage)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [minHeight])

  // Render whenever the frame becomes ready or the source changes.
  useEffect(() => {
    if (!ready) return
    frame.current?.contentWindow?.postMessage(
      {
        bh: true,
        type: 'render',
        html,
        surface,
        animate,
        artifact,
        theme: themeMessage,
        reducedMotion: reducedMotion(),
      },
      '*',
    )
    // The theme is sent separately below so a theme change never re-runs scripts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, html, surface])

  useEffect(() => {
    if (!ready) return
    frame.current?.contentWindow?.postMessage({ bh: true, type: 'theme', theme: themeMessage }, '*')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, theme.name, theme.palette.canvas])

  return (
    <div className={`artifact-frame ${className ?? ''}`} data-rendered={rendered || undefined}>
      <iframe
        ref={frame}
        src={FRAME_URL}
        sandbox="allow-scripts"
        title={title ?? artifact?.title ?? 'Artifact'}
        style={{ height }}
        loading="lazy"
      />
      {rendered ? null : <div className="artifact-frame-skeleton" aria-hidden="true"><span /><span /><span /></div>}
    </div>
  )
}
