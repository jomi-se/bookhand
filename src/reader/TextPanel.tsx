import { useEffect, useId, useRef, useState } from 'react'
import type { ReaderStyle, ReaderTheme } from '../domain/reader.ts'
import type { PresentationView, StylePatch } from '../app/presentation.ts'

export interface TextPanelProps {
  readonly presentation: PresentationView
  /** Show a change without keeping it. */
  readonly onPreview: (patch: StylePatch) => void
  readonly onCancelPreview: () => void
  /** Keep it, and persist it. */
  readonly onApply: (patch: StylePatch) => void
  readonly onReset: () => void
  readonly onUndo: () => void
  readonly onClose: () => void
}

const THEMES: readonly { value: ReaderTheme; label: string }[] = [
  { value: 'publisher', label: 'Publisher' },
  { value: 'light', label: 'Light' },
  { value: 'sepia', label: 'Sepia' },
  { value: 'dark', label: 'Dark' },
]

function Slider({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  readonly label: string
  readonly value: number
  readonly min: number
  readonly max: number
  readonly step: number
  readonly suffix: string
  readonly onChange: (value: number) => void
}) {
  const id = useId()
  return (
    <div className="control">
      <label htmlFor={id}>
        {label}
        <output htmlFor={id}>
          {value}
          {suffix}
        </output>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  )
}

export function TextPanel({
  presentation,
  onPreview,
  onCancelPreview,
  onApply,
  onReset,
  onUndo,
  onClose,
}: TextPanelProps) {
  /**
   * Only the fields this person has touched since they opened the panel.
   *
   * Holding a whole style here would mean every Apply wrote back a snapshot
   * taken when the panel opened, silently reverting anything changed in
   * between — the exact race `VAL-STYLE-PARITY` names. A patch can only ever
   * change what was actually adjusted.
   */
  const [draft, setDraft] = useState<StylePatch>({})
  const cssId = useId()
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => heading.current?.focus(), [])

  const committed = presentation.committed
  const shown: ReaderStyle = { ...committed, ...draft }
  const dirty = Object.keys(draft).length > 0
  const agentChange = presentation.reversible?.origin === 'agent'

  /**
   * The last patch this panel actually put on screen. Typing CSS does not go on
   * screen until Preview is pressed, so it is deliberately not recorded here.
   */
  const previewed = useRef<StylePatch>(null)

  const preview = (patch: StylePatch) => {
    previewed.current = patch
    onPreview(patch)
  }

  const change = (patch: StylePatch) => {
    const next = { ...draft, ...patch }
    setDraft(next)
    preview(next)
  }

  const clearDraft = () => {
    previewed.current = null
    setDraft({})
  }

  // A commit from anywhere clears the preview, so a change made elsewhere —
  // by an agent, say — would drop this person's unapplied preview off the page
  // while the controls still showed it. Put it back over the new baseline.
  useEffect(() => {
    if (!presentation.previewing && previewed.current) onPreview(previewed.current)
  }, [onPreview, presentation.previewing])

  return (
    <aside id="reader-text-panel" className="reader-panel" aria-label="Text settings">
      <header className="panel-head">
        <h2 ref={heading} tabIndex={-1}>Text</h2>
        <button type="button" className="button button-icon" onClick={onClose} aria-label="Close text settings">
          ✕
        </button>
      </header>
      <div className="panel-body">
        {agentChange ? (
          <p className="control-note control-agent" role="status">
            An agent changed these settings.
            <button type="button" className="button button-text" onClick={onUndo}>
              Undo
            </button>
          </p>
        ) : null}

        <Slider
          label="Size"
          value={shown.fontSizePercent}
          min={70}
          max={200}
          step={5}
          suffix="%"
          onChange={(fontSizePercent) => change({ fontSizePercent })}
        />
        <Slider
          label="Line height"
          value={shown.lineHeight}
          min={1.1}
          max={2.2}
          step={0.05}
          suffix=""
          onChange={(lineHeight) => change({ lineHeight })}
        />
        <Slider
          label="Measure"
          value={shown.measureCh}
          min={40}
          max={110}
          step={1}
          suffix="ch"
          onChange={(measureCh) => change({ measureCh })}
        />
        <Slider
          label="Paragraph spacing"
          value={shown.paragraphSpacingEm}
          min={0}
          max={2}
          step={0.05}
          suffix="em"
          onChange={(paragraphSpacingEm) => change({ paragraphSpacingEm })}
        />

        <fieldset className="control control-themes">
          <legend>Theme</legend>
          <div className="theme-row">
            {THEMES.map((theme) => (
              <button
                key={theme.value}
                type="button"
                className="button button-quiet"
                aria-pressed={shown.theme === theme.value}
                onClick={() => change({ theme: theme.value })}
              >
                {theme.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="control">
          <label htmlFor={cssId}>Book CSS</label>
          <textarea
            id={cssId}
            className="css-editor"
            rows={5}
            spellCheck={false}
            value={shown.customCss ?? ''}
            placeholder="p { text-indent: 1.2em; }"
            onChange={(event) => setDraft((d) => ({ ...d, customCss: event.target.value }))}
          />
          <p className="control-note">Book CSS styles this book only, and stays on this device.</p>
        </div>

        <div className="control-actions" data-role="presentation-actions">
          <button
            type="button"
            className="button button-quiet"
            disabled={!dirty}
            onClick={() => preview(draft)}
          >
            Preview
          </button>
          <button
            type="button"
            className="button button-quiet"
            disabled={!dirty && !presentation.previewing}
            onClick={() => {
              clearDraft()
              onCancelPreview()
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            className="button button-primary"
            disabled={!dirty}
            onClick={() => {
              onApply(draft)
              clearDraft()
            }}
          >
            Apply
          </button>
          <button
            type="button"
            className="button button-text"
            onClick={() => {
              clearDraft()
              onReset()
            }}
          >
            Reset all text settings
          </button>
        </div>

        {presentation.previewing ? (
          <p className="control-note" role="status">
            Previewing. Apply to keep this, or Cancel to go back.
          </p>
        ) : null}
        {presentation.warnings.length > 0 ? (
          <p className="control-note" role="status">
            {presentation.warnings.join(' ')}
          </p>
        ) : null}
      </div>
    </aside>
  )
}
