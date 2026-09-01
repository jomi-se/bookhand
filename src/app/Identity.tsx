/** The Bookhand mark: an open book whose centre spine carries the accent. */
export function BookhandMark({ size = 22 }: { readonly size?: number }) {
  return (
    <svg
      className="mark"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M3 5.2c2.9-.9 5.4-.9 8 .55v13.1c-2.6-1.45-5.1-1.45-8-.55V5.2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M21 5.2c-2.9-.9-5.4-.9-8 .55v13.1c2.6-1.45 5.1-1.45 8-.55V5.2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M12 5.9v12.9" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export function Wordmark() {
  return (
    <span className="wordmark">
      <BookhandMark />
      <span className="wordmark-text">Bookhand</span>
    </span>
  )
}
