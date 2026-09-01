import { useId, useState } from 'react'
import type { ReaderStyle, ReaderTheme } from '../domain/reader.ts'

export interface TextPanelProps {
  readonly style: ReaderStyle
  readonly onChange: (style: ReaderStyle) => void
  readonly onReset: () => void
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

export function TextPanel({ style, onChange, onReset, onClose }: TextPanelProps) {
  const [draftCss, setDraftCss] = useState(style.customCss ?? '')
  const cssId = useId()

  return (
    <aside className="reader-panel" aria-label="Text settings">
      <header className="panel-head">
        <h2>Text</h2>
        <button type="button" className="button button-icon" onClick={onClose} aria-label="Close text settings">
          ✕
        </button>
      </header>
      <div className="panel-body">
        <Slider
          label="Size"
          value={style.fontSizePercent}
          min={70}
          max={200}
          step={5}
          suffix="%"
          onChange={(fontSizePercent) => onChange({ ...style, fontSizePercent })}
        />
        <Slider
          label="Line height"
          value={style.lineHeight}
          min={1.1}
          max={2.2}
          step={0.05}
          suffix=""
          onChange={(lineHeight) => onChange({ ...style, lineHeight })}
        />
        <Slider
          label="Measure"
          value={style.measureCh}
          min={40}
          max={110}
          step={1}
          suffix="ch"
          onChange={(measureCh) => onChange({ ...style, measureCh })}
        />
        <Slider
          label="Paragraph spacing"
          value={style.paragraphSpacingEm}
          min={0}
          max={2}
          step={0.05}
          suffix="em"
          onChange={(paragraphSpacingEm) => onChange({ ...style, paragraphSpacingEm })}
        />

        <fieldset className="control control-themes">
          <legend>Theme</legend>
          <div className="theme-row">
            {THEMES.map((theme) => (
              <button
                key={theme.value}
                type="button"
                className="button button-quiet"
                aria-pressed={style.theme === theme.value}
                onClick={() => onChange({ ...style, theme: theme.value })}
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
            value={draftCss}
            placeholder="p { text-indent: 1.2em; }"
            onChange={(event) => setDraftCss(event.target.value)}
          />
          <div className="control-actions">
            <button
              type="button"
              className="button button-quiet"
              onClick={() => onChange({ ...style, customCss: draftCss })}
            >
              Preview
            </button>
            <button
              type="button"
              className="button button-text"
              onClick={() => {
                setDraftCss('')
                onReset()
              }}
            >
              Reset all text settings
            </button>
          </div>
        </div>
      </div>
    </aside>
  )
}
