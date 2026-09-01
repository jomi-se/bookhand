# ADR 0002: SQLite WASM, FTS5, and exact in-worker vector search

## Status

Accepted on 2026-09-01 for the hackathon proof of concept.

Supersedes the earlier, unvalidated IndexedDB/Dexie decision recorded under the
same ADR. The replacement is based on the measured comparison in
`docs/research/2026-09-01-sqlite-wasm-vs-indexeddb-report.md` and its reproducible
harness under `experiments/sqlite-browser-storage-spike/`.

Pixel 7 performance and background/reload behavior remain an explicit open
validation item. Desktop Chromium evidence is sufficient to select the default,
not to claim phone validation.

## Context

The tutor needs exact and conceptual lookup over an imported book without
uploading book text or embeddings. The initial proposal chose Dexie/IndexedDB,
MiniSearch, and JavaScript cosine search because they appeared to minimize
browser-specific infrastructure. That choice was not discussed or measured.

A real-browser comparison evaluated three implementations with the published
npm artifacts at 2,000 and 10,000 chunks:

1. official SQLite WASM, OPFS, FTS5, vector BLOBs, and JavaScript cosine;
2. a custom SQLite WASM build with `sqlite-vec`;
3. Dexie, MiniSearch, packed typed-array vectors, and JavaScript cosine.

The official SQLite path was operationally coherent and competitive. The
official build includes FTS5 but is compiled with `OMIT_LOAD_EXTENSION`.
Browser `sqlite-vec` therefore requires a custom statically compiled SQLite
binary. The maintainer's published demo artifact failed to initialize; the only
working alternative found was an unaffiliated stale fork pinning an alpha
extension and older SQLite.

At 10,000 normalized 384-dimensional vectors, the working `sqlite-vec` build
and a JavaScript exact scan had effectively identical median latency (8.8 ms and
8.6 ms respectively), while `sqlite-vec` exhibited a much worse cold tail.
Both perform exact brute-force search; browser `sqlite-vec` provides no useful
algorithmic advantage at this corpus size.

## Decision

### Storage and lexical retrieval

- Use the official `@sqlite.org/sqlite-wasm` package.
- Run SQLite in one dedicated database worker using the synchronous `oo1` API
  inside that worker.
- Persist through the `opfs-sahpool` VFS. It fits the single-tab POC, avoids
  COOP/COEP and `SharedArrayBuffer`, and measured as the simplest high-throughput
  official path.
- Do not use the deprecated Worker1 or Promiser APIs.
- Use ordinary SQLite tables for books, reading state, annotations, boards,
  chunks, index metadata, and vectors.
- Use the FTS5 extension already present in the official build for lexical
  search and BM25 ranking.
- Maintain the external-content FTS5 table with SQLite triggers in the same
  transactions as its source chunk rows. Rebuild it explicitly when the FTS
  schema or tokenizer version changes.

### Vectors and semantic retrieval

- Do not use `sqlite-vec` in the browser POC.
- Store normalized vectors in ordinary packed BLOB batches, initially about
  1,000 vectors per row, with stable chunk-to-offset metadata.
- Load the current book's vector matrix lazily into one `Float32Array` owned by
  the database worker and perform exact dot-product search there.
- Fuse the small lexical and semantic result lists with reciprocal-rank fusion
  in TypeScript.
- Run Transformers.js in a separate embedding worker so local model inference
  cannot starve database queries and cancellation can terminate inference
  without interrupting the SQLite owner.
- Pin `mixedbread-ai/mxbai-embed-xsmall-v1`, mean pooling, normalized output,
  and quantized WASM initially. Treat the model choice as a separately
  replaceable boundary and WebGPU as a measured optimization.

### Reliability and lifecycle

- Commit indexing in batches of about 250 chunks and yield between batches.
  Short transactions bound OPFS handle recovery time after reload and make
  indexing cancellable and resumable.
- The database worker is the sole connection owner. A second-tab sahpool lock
  failure becomes an explicit “open in another tab” UI state, not a silent
  fallback or retry loop.
- Probe persistent storage on startup. If OPFS is unavailable, permit an
  in-memory SQLite session only with a visible non-persistent warning.
- Request persistent origin storage after first import and retain an explicit
  export path for the SQLite database.
- Record index schema and embedding-model versions. Re-index derived chunks and
  vectors rather than attempting elaborate migrations during the POC.

## Consequences

One inspectable SQLite file provides relational state, transactional consistency,
FTS5, derived retrieval data, and straightforward export. The application avoids
maintaining consistency among IndexedDB records, a serialized MiniSearch index,
and a separate vector cache.

The official SQLite runtime adds roughly half a megabyte compressed and requires
correct WASM/static-host integration. This is small beside the local embedding
model and is an accepted cost for the unified data model.

`opfs-sahpool` intentionally permits only one simultaneous connection. That is
the current product behavior. Expanding to cooperative multi-tab or multi-window
use requires revisiting the VFS and connection policy.

Exact vector search has a scale ceiling, but the measured 10,000-chunk workload
is comfortably interactive. Do not add ANN infrastructure or a vector extension
without a measured failure at the product's actual scale.

## Validation still required

Run the preserved spike on a Pixel 7 with both realistic and 10,000-chunk data:

- cold and warm initialization;
- indexing and query timings;
- vector-matrix memory pressure;
- reload during batched indexing;
- background the tab during indexing and resume it;
- second-tab lock behavior.

The exact acceptance thresholds and drill procedure are in section 10 of the
research report.

## Revisit when

- the Pixel 7 fails the recorded performance or lifecycle thresholds;
- exact vector search exceeds 100 ms at p95 on target hardware;
- multi-tab access becomes a real product requirement;
- the application grows toward hundreds of thousands of chunks;
- a maintained vector extension enters the canonical SQLite WASM build; or
- multilingual scope requires a different embedding model.
