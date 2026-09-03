# Bundled judging books

Bookhand temporarily bundles three unmodified Project Gutenberg EPUBs for the
judging demo. They enter the ordinary local library through the same
checksum-verified import path as any other book. Remove these fixtures after the
judging period; user-imported EPUBs remain the product path.

## Calculus Made Easy — Project Gutenberg #33283

*Calculus Made Easy* by Silvanus P. Thompson is the primary reading, tutoring,
and document-remaster demonstration. Its mathematics relies heavily on SVG
equation images: the EPUB contains 3,687 equation images, making the contrast
between publisher markup and semantic MathML immediately visible.

- Catalog: <https://www.gutenberg.org/ebooks/33283>
- Official EPUB3 download: <https://www.gutenberg.org/ebooks/33283.epub3.images>
- Resolved download: <https://www.gutenberg.org/cache/epub/33283/pg33283-images-3.epub>
- Retrieved: 2026-09-01 UTC
- Source `Last-Modified`: `Sun, 30 Aug 2026 23:24:13 GMT`
- EPUB package modified: `2026-08-30T23:24:10Z`
- [`calculus-made-easy.epub`](./calculus-made-easy.epub): 13,214,664 bytes;
  SHA-256 `256371b889e29ab74fafd2efc1b75f0344438809d873ea76dd3231cf7d364dd0`
- [`calculus-made-easy-cover.jpg`](./calculus-made-easy-cover.jpg): 1,601 ×
  2,560 JPEG; SHA-256
  `4bea57823748945548ef3724f07369bbb197c7f762d28930faac6aef2b69457d`

The adjacent cover is a byte-for-byte extraction of the EPUB's
manifest-declared cover image, not a generated redesign.

## Relativity — Project Gutenberg #36114

Albert Einstein's *Relativity: The Special & the General Theory* (translated by
Robert W. Lawson) is the strongest second restoration corpus. The EPUB contains
744 images, including 738 `img[data-tex]` formula glyphs. Variables that look
like text to a reader are therefore images in the source, impairing search,
selection, accessibility, scaling, and dark-mode rendering until remastered.

- Catalog: <https://www.gutenberg.org/ebooks/36114>
- Official EPUB3 download: <https://www.gutenberg.org/ebooks/36114.epub3.images>
- Resolved download: <https://www.gutenberg.org/cache/epub/36114/pg36114-images-3.epub>
- Retrieved: 2026-09-03 UTC
- Source `Last-Modified`: `Sun, 30 Aug 2026 23:29:05 GMT`
- EPUB package modified: `2026-08-30T23:29:05Z`
- [`relativity.epub`](./relativity.epub): 1,091,398 bytes; SHA-256
  `bf06a8a83e08889277667c34b1d914fcd37d734646cbb44bb4da028bcbe65a39`

## Flatland — Project Gutenberg #201

Edwin A. Abbott's *Flatland* is a contrasting restoration target rather than
another formula-image stress test. It combines a large, mostly monolithic XHTML
document, legacy presentational classes and inline styles, and twelve raster
illustrations. It is useful for demonstrating structural hierarchy, responsive
layout, and semantic figure restoration while preserving the author's text.

- Catalog: <https://www.gutenberg.org/ebooks/201>
- Official EPUB3 download: <https://www.gutenberg.org/ebooks/201.epub3.images>
- Resolved download: <https://www.gutenberg.org/cache/epub/201/pg201-images-3.epub>
- Retrieved: 2026-09-03 UTC
- Source `Last-Modified`: `Tue, 01 Sep 2026 08:40:00 GMT`
- [`flatland.epub`](./flatland.epub): 300,202 bytes; SHA-256
  `56348c6910e42b672cf4c6a550033fdac361e652298c1ec5bf0403db9d396089`

## Artifact and license policy

All three EPUBs are the unmodified downloaded artifacts. Bookhand extracts
their manifest-declared metadata and covers during ordinary local import; no
book-specific UI representation is baked into the application.

Project Gutenberg marks these underlying works public domain in the United
States, but its trademark and redistribution terms still apply to these Project
Gutenberg editions. Each unmodified EPUB preserves the full Project Gutenberg
License. Users outside the United States must check their country's copyright
law. See <https://www.gutenberg.org/policy/license.html>.
