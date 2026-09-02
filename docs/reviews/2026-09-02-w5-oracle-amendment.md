# W5 lexical-search oracle amendment

Date: 2026-09-02

Scope: `tests/fixtures/search/polish-oracle.json` during W5 implementation.
Both pinned EPUB byte hashes remained unchanged. This note records why the
manually frozen expectations changed rather than allowing the test diff to look
like an unexplained relaxation.

## Changes

1. The first calculus query's one-based `maxRank` changed from 1 to 2. The
   original threshold had never been measured against a complete-corpus index.
   Once the oracle indexed every spine section in authored order, generic FTS5
   BM25 consistently placed the independently located Chapter X passage second.
   Two complete-corpus runs reproduced rank 2. Production ranking remains
   `BM25, global chunk order, chunk id`; no query or expected phrase appears in
   production indexing/search code.
2. The second calculus query changed from `45 degrees dy dx equals one` to
   `curve sloping 45`. Canonical W4 extraction preserves the displayed TeX
   alternatives rather than flattening them to those English tokens, so the
   earlier query did not describe the indexed representation. The expected
   passage now freezes both exact preserved math strings as well as prose.
3. Every query now requires `sectionIndex`, because resolving an EPUB CFI in a
   fresh section document needs the section explicitly and the public result
   contract promises it.

## Evidence integrity after amendment

The oracle now indexes the complete calculus and tiny-book corpora, verifies
their unchanged SHA-256 hashes, searches through `LibraryRepository`, asserts
actual returned rank and book isolation, and resolves every produced chunk's
start/end CFIs against a fresh EPUB document. Each bounded result excerpt must
be contained in that resolved canonical passage and the citation fingerprint
must match. The mathematical query additionally asserts its exact TeX content.

The amendment was made before W5 acceptance because the initial oracle encoded
unmeasured and extraction-incompatible assumptions. Future changes require a
new dated review with independent corpus evidence; implementation convenience
is not sufficient.
