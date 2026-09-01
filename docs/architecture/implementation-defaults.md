# Implementation defaults for the fast vertical slice

This document closes routine technical choices so implementation agents can
build instead of repeatedly redesigning the project. These are defaults, not a
promise to preserve an approach after evidence disproves it. Deviate only when
the hero flow is blocked, and record the reason in `docs/plan/current-work.md`.

## One-sentence architecture

A Vite/React client loads an EPUB with upstream Foliate.js, persists reader and
study state through Dexie/IndexedDB, indexes book passages in a Web Worker with
Transformers.js, exposes domain operations as WebMCP tools, and renders agent
artifacts as native study blocks or explicit sandboxed labs.

## Dependency defaults

Use direct dependencies rather than frameworks around frameworks:

- `foliate-js` from the upstream MIT project for EPUB parsing, rendering, CFI,
  and navigation;
- `dexie` for IndexedDB schema and transactions;
- `minisearch` for the small in-memory lexical index;
- `@huggingface/transformers` for local embeddings;
- `zod` only if it materially simplifies runtime validation shared by UI and
  tools; JSON Schema remains the WebMCP declaration format;
- `vitest` and Testing Library for narrow domain/component tests;
- Playwright only for the real hero flow.

Do not add Redux, a server framework, an ORM, SQLite/Turso WASM, a vector
database, LangChain, an agent SDK, or a general canvas framework in v0.

## Reader boundary

Create a `ReaderAdapter` around Foliate.js. UI components and WebMCP handlers
must not reach through it to arbitrary viewer internals. Its initial surface is:

```ts
interface ReaderAdapter {
  open(blob: Blob): Promise<BookMetadata>
  close(): Promise<void>
  getToc(): TocItem[]
  getLocation(): ReaderLocation
  getSelection(): ReaderSelection | null
  getVisibleContext(): Promise<Passage>
  getPassage(range: BookRange): Promise<Passage>
  listSections(): BookSection[]
  createSectionDocument(sectionIndex: number): Promise<Document>
  navigate(target: BookTarget): Promise<void>
  applyStyle(style: ReaderStyle): void
  resetStyle(): void
}
```

Use Foliate/EPUB CFI as the navigable anchor and keep section index plus a short
text fingerprint as diagnostic fallback data. Never expose viewer DOM nodes or
opaque iframe handles through the domain API.

## Persistence schema

Use one Dexie database with small, explicit records:

- `books`: content hash, metadata, original EPUB `Blob`, import time;
- `readingState`: book id, current CFI/location, style profile, timestamps;
- `annotations`: id, book id, CFI range, quote, color, note, timestamps;
- `boards`: id, book id, title, layout mode, timestamps;
- `studyItems`: id, board id, optional source range, kind, payload, order;
- `chunks`: id, book id, section, title breadcrumb, start/end CFI, order, text,
  text hash, index version;
- `embeddings`: chunk id, book id, model id, normalized `Float32Array`.

Hash imported EPUB bytes with SHA-256 for the book id. Keep application records
separate from the Foliate viewer so the reader engine can be replaced without a
data migration. Persist after meaningful transitions, not on every render.

## Text extraction and chunking

Index one section at a time using `ReaderAdapter.createSectionDocument()`.

1. Walk visible text nodes beneath the section body.
2. Skip `script`, `style`, `noscript`, `template`, hidden/inert content, and
   viewer-injected chrome.
3. Insert separators at block boundaries instead of concatenating paragraphs.
4. Preserve useful equation text from MathML and accessible labels when plain
   text would otherwise be empty. Preserve figure captions. Do not attempt OCR.
5. Group complete paragraphs toward 800 characters, allow roughly 400–1,200,
   and overlap one short paragraph or at most 100 characters.
6. Store start and end CFI, section index, chapter breadcrumb, global order, and
   the exact normalized text.
7. Round-trip each generated CFI against the section before committing it.

These numbers are tuning defaults, not doctrine. Prefer coherent source units
over perfectly uniform lengths. The embedding model accepts longer input than
we need; chunks remain small primarily so citations and explanations are
precise.

## Search ladder

Implement retrieval in this order:

1. Exact current selection and visible context.
2. Direct lookup by CFI and structural neighbors.
3. Exact/lexical search with MiniSearch.
4. Local semantic retrieval.
5. Simple hybrid fusion.

This order ensures the first WebMCP demo can work before the embedding layer is
finished and leaves a useful fallback if local inference fails.

### Local embedding worker

The UI communicates with one module Web Worker through a tiny protocol:

```ts
type EmbeddingWorkerRequest =
  | { type: 'load' }
  | { type: 'embed'; requestId: string; texts: string[] }
  | { type: 'cancel'; requestId: string }

type EmbeddingWorkerEvent =
  | { type: 'download-progress'; file: string; progress: number }
  | { type: 'ready'; modelId: string; dimensions: number }
  | { type: 'result'; requestId: string; vectors: Float32Array[] }
  | { type: 'error'; requestId?: string; message: string }
```

Pin `mixedbread-ai/mxbai-embed-xsmall-v1`, request mean pooling and normalized
vectors, and index in small batches (start at eight). Use quantized WASM first.
The model has about 24 million parameters and is explicitly demonstrated by the
Transformers.js documentation for browser embeddings. Browser caching should
make subsequent use offline-capable after the first download.

Do not auto-download the model merely because a book opened. Start when the user
enables semantic search or an agent requests it, and show the cost honestly.
Indexing must be abortable and resume by reusing already committed chunks.

### Ranking

Normalize vectors at creation, then calculate dot products in the worker or a
non-blocking batch. Search the current book only. Take the top 20 lexical and top
20 semantic results, combine them with reciprocal-rank fusion, deduplicate
overlapping chunks, and return five by default.

Do not build ANN indexing. Measure before optimizing. A few thousand vectors of
384 floats are a small corpus by vector-search standards.

## WebMCP v0 surface

Keep registration behind `WebMcpAdapter`; domain handlers must also be directly
callable from tests and the ordinary UI. Pin the hackathon's current WebMCP API
shape inside that adapter rather than spreading draft browser types throughout
the application.

Start with these tools:

| Tool | Purpose |
| --- | --- |
| `get_reading_context` | Book metadata, current location, selected/visible passage, nearby structure, active board summary. |
| `get_table_of_contents` | Bounded TOC tree with stable navigation targets. |
| `get_passage` | Exact text and neighbors for a CFI/range or structural target. |
| `search_book` | Lexical or hybrid passage search with navigable citations. |
| `navigate_book` | Move to a returned CFI/heading/chapter target. |
| `save_annotation` | Create or update a highlight/note tied to an exact source range. |
| `set_reading_style` | Apply named settings plus bounded book CSS; always return the previous style and reset path. |
| `upsert_study_item` | Create/update one native block or one generated lab on the current board. |
| `set_study_board_view` | Dock, expand, focus, or close the board without deleting content. |

Prefer a small number of composable tools over separate tools for every study
block kind. Write operations use stable caller-provided ids when possible so a
retry updates rather than duplicates.

Every tool result that quotes the book returns `bookId`, `startCfi`, `endCfi`,
`sectionTitle`, and text. Every persistent mutation becomes visible in the UI
and can be undone or deleted by the user.

## Study-board content

Native v0 block kinds:

- rich text/Markdown;
- source quotation;
- equation;
- ordered worked steps;
- callout;
- question with revealable answer;
- Mermaid diagram;
- simple data plot.

Store structured payloads, not rendered HTML, for native blocks.

When these are insufficient, allow a `lab` item containing HTML, CSS, JavaScript,
and a JSON data payload. Render it in an iframe with `sandbox="allow-scripts"`
and no `allow-same-origin`. Pass initial data with `postMessage`; do not give the
lab IndexedDB, WebMCP, or parent-DOM access. A visible badge, reload, edit-source,
and delete controls are enough for the POC. This single browser primitive is the
right amount of containment; do not build a permissions platform around it.

## UI shape

- Desktop: reader plus resizable docked study board; board can expand to occupy
  the workspace while preserving reading location.
- Mobile: one primary surface at a time with a persistent, obvious switch
  between book and board. Do not squeeze two columns onto a phone.
- Selection action: a small “Study this” affordance creates/opens the board and
  makes the selected range the obvious agent context.
- Index state belongs near search/tutor controls, not in a settings labyrinth.

The board is not a chat transcript. Agent prose may appear, but durable learning
material is represented by study items tied back to sources.

## Validation floor

Keep the test suite proportional to a hackathon POC:

- unit-test chunk boundaries and CFI round trips on one small EPUB fixture;
- unit-test hybrid ranking and duplicate suppression;
- contract-test every WebMCP handler without a browser agent;
- test IndexedDB persistence with one reload scenario;
- run one Playwright hero path from selection to persisted study artifact;
- manually run the same path with the actual supported WebMCP agent before
  submission.

Do not create a cross-browser matrix, exhaustive visual snapshots, or elaborate
performance harness before the hero flow works. Capture three timings on the
target phone: first model load, full hero-book index, and semantic query.

## Complexity gates

The following require evidence recorded in `current-work.md`:

- SQLite/vector database: only after IndexedDB or brute-force retrieval fails a
  measured target.
- WebGPU: only after WASM is too slow and the target environment is confirmed.
- semantic chunk reranking: only after reviewing actual bad queries.
- OCR or image embeddings: only if the chosen hero passage cannot be extracted.
- multiple embedding models: only after committing to multilingual scope.
- custom Foliate.js fork: only after upstream APIs demonstrably block the hero
  flow.
- Agent Connect: only after the judgeable browser-native WebMCP path is complete.
