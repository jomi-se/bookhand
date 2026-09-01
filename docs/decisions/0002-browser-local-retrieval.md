# ADR 0002: Browser-local retrieval with one pinned embedding model

## Status

Accepted on 2026-09-01 for the hackathon proof of concept.

## Context

The tutor needs exact and conceptual lookup over an imported book, but the
application is client-side and should not upload book content to a retrieval
service. A mature reader can justify SQLite, vector extensions, multiple model
providers, background synchronization, and elaborate index migrations. This
project first needs one reliable, judgeable book-to-lesson path.

## Decision

- Store application data, chunks, and vectors in IndexedDB through Dexie.
- Extract section text through the Foliate.js adapter and retain navigable EPUB
  CFI ranges with every chunk.
- Provide structural lookup and lexical search before semantic indexing exists.
- Run embeddings off the UI thread with Transformers.js in a Web Worker.
- Pin `mixedbread-ai/mxbai-embed-xsmall-v1`, mean pooling and normalized output.
  Start with quantized WASM for broad browser and phone compatibility. Treat
  WebGPU as a measured optimization, not a second required path.
- Download the model only when semantic search is first enabled or requested,
  expose progress, and rely on the browser cache thereafter.
- Use brute-force cosine similarity over the current book's normalized vectors.
  Fuse the vector and lexical top results in application code.
- Record the model id and index schema version. Re-index rather than migrate
  vectors when either changes.

## Consequences

No book text or embeddings need to leave the device. First use requires a model
download, and indexing a large book consumes CPU, battery, and browser storage.
The UI must therefore make indexing explicit and abortable.

Brute-force search has an obvious ceiling, but an ordinary technical EPUB is
expected to yield only hundreds or low thousands of chunks. Do not add a vector
database or approximate-nearest-neighbor index without a measured failure on the
hero book and target phone.

The model is English-focused. Multilingual retrieval is a future model-choice
decision, not a reason to add provider routing now.

## Revisit when

- cosine search exceeds 100 ms at p95 on the target phone;
- the hero book demonstrates unacceptable retrieval quality;
- the model download or indexing time damages the demo;
- multilingual material becomes part of the committed scope; or
- the application expands from one local book to a large library-wide index.
