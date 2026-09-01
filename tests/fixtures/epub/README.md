# EPUB fixture corpus

These fixtures are authored by the Bookhand project and dedicated to the public
domain under CC0-1.0. They do not copy an upstream reader's security corpus.
Regenerate the binary files with:

```sh
npm run fixtures:generate
```

The generator fixes entry order, compression, timestamps, identifiers, and
content so hashes remain stable across runs.

- `tiny-book.epub`: valid EPUB 3 with two spine items, nested TOC, selectable
  prose, packaged CSS/SVG, figure caption, and MathML accessible text.
- `malicious-book.epub`: readable content plus distinct inline/packaged script,
  parent mutation, local/session storage, popup, top navigation, form, object,
  nested browsing, fetch, remote image, remote font, CSS import, CSS image, and
  privileged-bridge discovery sentinels. Every remote target uses the reserved
  controlled origin `https://bookhand.invalid`.
- `long-metadata.epub`: valid EPUB with deliberately oversized title and author.
- `missing-cover.epub`: valid EPUB with no declared or implicit cover resource.
- `corrupt-book.epub`: truncated ZIP signature and payload.
- `unsupported-book.txt`: ordinary text with a deliberately unsupported type.

`fixtures.test.ts` records and checks the expected SHA-256 hashes, EPUB ZIP
invariants, required entries, and sentinel URLs. Changing a fixture therefore
requires an explicit test review as well as regeneration.

