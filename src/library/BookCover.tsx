import { useEffect, useState } from 'react'
import type { BookMetadata } from '../domain/reader.ts'

export interface BookCoverProps {
  readonly metadata: BookMetadata
  readonly size: 'shelf' | 'feature'
}

/**
 * Shows the book's own cover art. A book without one keeps its hierarchy
 * through a ruled spine plate rather than a decorative placeholder image.
 */
export function BookCover({ metadata, size }: BookCoverProps) {
  const [url, setUrl] = useState<string>()
  const cover = metadata.cover

  useEffect(() => {
    if (!cover) {
      setUrl(undefined)
      return
    }
    const objectUrl = URL.createObjectURL(
      new Blob([cover.bytes as unknown as BlobPart], { type: cover.mediaType }),
    )
    setUrl(objectUrl)
    return () => {
      URL.revokeObjectURL(objectUrl)
      setUrl(undefined)
    }
  }, [cover])

  if (url) {
    return (
      <img
        className={`cover cover-${size}`}
        src={url}
        alt=""
        loading="lazy"
        decoding="async"
      />
    )
  }

  return (
    <span className={`cover cover-${size} cover-fallback`} aria-hidden="true">
      <span className="cover-fallback-title">{metadata.title}</span>
    </span>
  )
}
