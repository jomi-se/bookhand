# Local persistence and retrieval for a browser-only ebook study app
### SQLite WASM + OPFS vs. IndexedDB — an adversarial technical review

**Prepared for:** José — Foliate.js ebook reader, WebMCP hackathon build
**Date:** 1 September 2026
**Scope:** one technical EPUB at a time, ~1,000–10,000 chunks, 384-dimensional embeddings from Transformers.js, desktop Chromium + Pixel 7-class Android Chrome, static hosting, no server.

---

## How to read the evidence labels

Throughout this report:

- **[Measured]** — I ran it. Real numbers from a real browser in this session. The exact hardware and method are in §6.
- **[Primary]** — stated by official documentation, source code, a package registry, or a project's own issue tracker, with a link.
- **[Inference]** — my reasoning from the above. Could be wrong.
- **[Unknown]** — I could not establish it and I am not going to guess.

I did not accept any performance claim from a blog post as a substitute for a measurement, and where I had no measurement for a platform (notably the Pixel 7 itself) I say so rather than extrapolating a fake number.

---

## 1. Executive verdict

**Your instinct about SQLite is right. Your instinct about `sqlite-vec` is wrong for this project.**

Concretely, my recommendation is **Option B**: SQLite WASM on OPFS via the `opfs-sahpool` VFS, FTS5 for lexical search, normalized 384-d vectors stored as `BLOB`s, an exact cosine scan in JavaScript inside the same worker, and reciprocal-rank fusion in TypeScript. Drop `sqlite-vec` entirely.

The three findings that drive this:

**First, `sqlite-vec` cannot be added to the official SQLite WASM build at all.** This is not a matter of difficulty. I checked the compile options of the shipping `@sqlite.org/sqlite-wasm@3.53.0-build1` package in a real runtime and it is compiled with `OMIT_LOAD_EXTENSION` **[Measured]**. sqlite-vec's own documentation confirms the consequence: *"It's not possibly [sic] to dynamically load a SQLite extension into a WASM build of SQLite. So `sqlite-vec` must be statically compiled into custom WASM builds."* **[Primary]** ([sqlite-vec WASM docs](https://alexgarcia.xyz/sqlite-vec/wasm.html)). So using sqlite-vec in a browser means abandoning the official distribution and adopting somebody else's WASM binary.

**Second, the artifacts you would have to adopt are in poor shape.** The one blessed by the sqlite-vec author, `sqlite-vec-wasm-demo@0.1.9`, **does not load at all** — it aborts during module initialization in both a worker and on the main thread, with `Aborted(Attempt to set Module.postRun after it has already been processed)` **[Measured]**. I read the generated bundle: it calls Emscripten's `run()` and *then* appends SQLite's post-JS block, which tries to push onto `Module.postRun` after Emscripten has sealed that property. It is a build-ordering bug baked into the published file, so no amount of client-side code works around it. The package is also explicitly labelled *"a demonstration and may change at any time"* **[Primary]**, is 4.4 MB of WASM (1.87 MB gzipped) **[Measured]**, has an empty README, and pins **SQLite 3.45.3** — roughly two years behind the current 3.53 **[Measured]**. Adoption matches: ~1,500 npm downloads and 358 jsDelivr hits in the last month, trending down **[Primary]**.

The one third-party build that *does* work is `sqlite-wasm-vec@0.1.11`, an unaffiliated fork with **zero GitHub stars**, ~513 npm downloads/month, and no publish since **12 October 2025** **[Primary]**. I got it running end to end — SQLite 3.51.0, sqlite-vec v0.1.7-alpha.2, FTS5, `vec0`, and OPFS in one worker **[Measured]**. It is a genuinely functional artifact. It is also a single-maintainer, zero-star, eleven-month-stale fork of two projects that both move, and it is the load-bearing dependency for your entire storage layer if you choose it.

**Third — and this is the part that actually settles it — `sqlite-vec` buys you no speed here.** In the browser, `vec0` does an exact brute-force scan; the ANN index is still an open tracking issue and the maintainer states plainly that *"sqlite-vec as of v0.1.0 will be brute-force search only"* **[Primary]** ([issue #25](https://github.com/asg017/sqlite-vec/issues/25)). A brute-force scan is exactly what thirty lines of JavaScript over a `Float32Array` does. And the measurement bears that out — at 10,000 chunks, `vec0` top-10 took a median of **8.8 ms** and a plain JS dot-product scan took a median of **8.6 ms** **[Measured]**. At 2,000 chunks it was 2.4 ms versus 1.7 ms. The JS version has *better* tail latency, because `vec0`'s worst case included cold reads from OPFS shadow tables (up to 876 ms on a first query after reload) whereas the JS path pays its I/O once, visibly, at load.

So the trade you are being offered is: take on a stale zero-star dependency and a bespoke WASM binary, in exchange for identical latency and slightly worse tails. That is not a trade.

**Two things to be equally clear about:**

- **The IndexedDB/Dexie option is not bad.** It works, it is smaller on first load (64 KB gzipped of library versus 542 KB), and MiniSearch serializes and reloads properly. It is a legitimate choice. But it is *three* stores you keep consistent by hand (records, lexical index, vectors), its lexical index is a 5.2 MB JSON blob at 10k chunks that must be parsed on every cold start, and it gives up SQL — which for a study app that will grow annotations, chapters, and study artifacts is the thing you will miss most.
- **The whole SQLite path really is simpler than the IndexedDB composition** — *once you delete sqlite-vec from it*. One dependency, one file, one schema, one query language, transactional consistency for free. §4 works through why.

**The honest summary for a three-day build:** your preference is correct in its architecture (SQLite, OPFS, FTS5, one worker owns the DB) and incorrect in exactly one component. Cut sqlite-vec, keep everything else, and you have the fastest reliable route.

---

## 2. Decision matrix

Effort figures are my estimate for a strong coding agent working from a clear spec, and are labelled inference. Latency figures are measured on desktop headless Chromium (see §6 for the caveat that this is not a Pixel 7).

| Criterion | **A. SQLite + sqlite-vec** | **B. SQLite + FTS5 + BLOB vectors** | **C. Dexie + MiniSearch** |
|---|---|---|---|
| Works today on official artifacts | **No** — official demo build fails to initialize [Measured]; official sqlite-wasm has `OMIT_LOAD_EXTENSION` [Measured] | **Yes** [Measured] | **Yes** [Measured] |
| Best available artifact | `sqlite-wasm-vec@0.1.11`, 0 stars, stale since Oct 2025 [Primary] | `@sqlite.org/sqlite-wasm@3.53.0-build1`, official, Apr 2026 [Primary] | `dexie@4.4.5` + `minisearch@7.2.0`, both mainstream [Primary] |
| Implementation effort | ~4–6 h [Inference] | **~3–5 h** [Inference] | ~6–9 h [Inference] |
| Dependency risk | **High** — single-maintainer fork of two moving projects | **Low** — one official package | **Low** — two popular packages |
| Deployment risk | Medium — bespoke binary, must self-host WASM | **Low** — `optimizeDeps.exclude` and correct WASM MIME type | **Lowest** — ordinary JS bundling |
| First load (gzipped library) | ~794 KB [Measured] | **~542 KB** [Measured] | **~64 KB** [Measured] |
| First load in context | 3.5% of a 22 MB quantized MiniLM download [Measured] | 2.4% of it | 0.3% of it |
| Index 10k chunks | ~3.6 s [Measured] | **~3.2 s** [Measured] | ~3.6 s (packed vectors) / ~6.9 s (per-row) [Measured] |
| DB size at 10k chunks | 26.2 MB [Measured] | 26.6 MB [Measured] | see §6 — origin-wide figure only |
| FTS query, 10k, median | 19.8 ms [Measured] | 16.7 ms [Measured] | **37.6 ms cold / 16.3 ms warm** [Measured] |
| Vector top-10, 10k, median | 8.8 ms [Measured] | **8.6 ms** [Measured] | 8.5 ms [Measured] |
| Vector top-10, 10k, worst | 876 ms (cold OPFS reads) [Measured] | 12.6 ms [Measured] | 11.1 ms [Measured] |
| Memory | WASM heap + vec0 shadow tables | WASM heap + 15 MB vector matrix | JS heap + 15 MB matrix + parsed MiniSearch index |
| Failure/recovery | Same OPFS hazards as B, plus alpha-extension migration risk | OPFS lock hazards, well-understood; clean rollback [Measured] | IndexedDB is forgiving; but 3 stores can drift apart |
| Inspectability | Full SQL; export the `.sqlite` file | **Full SQL; export the `.sqlite` file** | DevTools IndexedDB pane; ad-hoc export code |
| Replaceability later | Painful — schema tied to `vec0` virtual tables | **Easy — vectors are ordinary BLOBs in an ordinary table** | Moderate — must migrate three stores |
| Vector search quality | Exact [Measured] | Exact [Measured] | Exact [Measured] |

**Verdict: B.** A is dominated on every axis that matters. C is a reasonable second place and the right answer only if OPFS itself turns out to be broken on your Pixel 7.

---

## 3. SQLite WASM findings

### 3.1 What ships today

The official package is [`@sqlite.org/sqlite-wasm`](https://github.com/sqlite/sqlite-wasm), currently **3.53.0-build1**, Apache-2.0, published around 21 April 2026 **[Primary]**. It contains eight files, 2.83 MB unpacked. The parts you actually ship:

| File | Raw | Gzipped |
|---|---|---|
| `sqlite3.wasm` | 864,752 B | 400,537 B |
| `index.mjs` | 578,559 B | 154,816 B |
| **Total on the wire** | **1.41 MB** | **~542 KB** |

**[Measured]** — `stat` and `gzip -9` on the published npm artifact.

For perspective, the quantized `all-MiniLM-L6-v2` ONNX weights that Transformers.js will pull are **22,972,370 bytes** **[Primary]** ([model file listing](https://huggingface.co/Xenova/all-MiniLM-L6-v2)). Your database engine is 2.4% of your embedding model. Bundle size is not a real argument in this comparison, and I would ignore anyone who makes it.

### 3.2 The three OPFS options, and which one you want

SQLite's own persistence documentation now describes three OPFS-backed VFSes **[Primary]** ([persistence.md](https://sqlite.org/wasm/doc/trunk/persistence.md)):

**`opfs`** — the original. Requires the `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` headers and therefore `SharedArrayBuffer`. Supports several concurrent connections. Notably, the docs were revised after testing in **March 2026** to raise the practical concurrency guidance: *"historically these docs have suggested very low limits, e.g. 3, but more detailed testing in 2026-03 was consistently able to handle 8-10 concurrent workers."*

**`opfs-sahpool`** — the SyncAccessHandle Pool. **No COOP/COEP headers, no `SharedArrayBuffer`.** The documentation calls it *"easily the highest OPFS performance of the options described in this documentation"* and states the trade directly: it *"does not support multiple simultaneous connections."* It works in all major browsers since March 2023.

**`opfs-wl`** — new in SQLite **3.53.0**, uses the Web Locks API and `Atomics.waitAsync()` instead of the bespoke locking protocol, no COOP/COEP required, performance *"on par with the 'opfs' VFS"*, and fairer lock queueing.

The documentation's own guidance: *"Clients which value performance more than concurrency, or are unable to set the COOP/COEP response headers, should use the 'opfs-sahpool' VFS."*

**That is you.** A single-tab local reader, deployed as an ordinary static site, wants **`opfs-sahpool`**. Choosing it means:

- **No COOP/COEP.** This matters more than it sounds. Setting `require-corp` cross-origin-isolates your page, which breaks any cross-origin resource that does not send CORP/CORS headers — and Transformers.js pulling model weights from the Hugging Face CDN is exactly such a resource. Avoiding cross-origin isolation removes a whole category of hackathon-day debugging. **[Inference]**, but a well-founded one.
- **No `SharedArrayBuffer` dependency**, so no interaction with header requirements on whatever static host you use.
- **Highest write throughput** of the three, which is what indexing 10k chunks needs.
- **Worker-only**, which you already planned for. This is a hard platform constraint, not a SQLite one: `createSyncAccessHandle()` is *"only available in Dedicated Web Workers"* **[Primary]** ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/FileSystemFileHandle/createSyncAccessHandle)).

### 3.3 The API you should use — and the one you should not

This is the single most out-of-date thing in the ecosystem, so it is worth stating loudly.

**The Worker1 and Promiser APIs are deprecated as of 15 April 2026.** The official documentation says: *"The Worker1 and Promiser APIs are, as of 2026-04-15, deprecated. They will not be removed, but they also will not be extended further."* It goes further: they are *"too fragile, too imperformant, and too limited for any non-toy software, and their use is actively discouraged."* The recommended replacement is to *"load the module and interact with it as a library"* **[Primary]** ([api-worker1.md](https://sqlite.org/wasm/doc/trunk/api-worker1.md)).

Almost every tutorial you will find — including [Chrome's own article](https://developer.chrome.com/blog/sqlite-wasm-in-the-browser-backed-by-the-origin-private-file-system), **last updated 11 January 2023** — teaches the promiser API and the COOP/COEP `?vfs=opfs` setup. That guidance is now three and a half years old and points at a deprecated API and the header-requiring VFS. Do not follow it. If a coding agent generates promiser-based code for you, that is a signal it is pattern-matching on stale material.

The correct 2026 shape is exactly what you proposed: **one dedicated worker owns the database, uses the `oo1` object-oriented API synchronously inside that worker, and exposes your own small message protocol to the UI thread.** You are already on the recommended path.

### 3.4 What is in the build

I verified the shipping build's feature set by running `PRAGMA compile_options` **[Measured]**:

```
ENABLE_FTS5           ← full-text search: present
ENABLE_RTREE
ENABLE_MATH_FUNCTIONS
ENABLE_SESSION
ENABLE_COLUMN_METADATA
OMIT_LOAD_EXTENSION   ← runtime extensions: impossible
OMIT_UTF16
OMIT_SHARED_CACHE
THREADSAFE=0
DEFAULT_PAGE_SIZE=8192
```

**FTS5 works out of the box**, including `bm25()` ranking — I created an FTS5 table, inserted, and ranked in the official build with no custom compilation **[Measured]**. This is the fact that makes Option B viable and it is worth knowing precisely, because a fair amount of internet advice assumes you need a custom build for FTS5. You do not.

`OMIT_LOAD_EXTENSION` is the fact that kills sqlite-vec. It is not a policy you can flip at runtime; it is compiled in.

### 3.5 Persistence, quota, eviction, private browsing

OPFS and IndexedDB **share one quota per origin** and are **evicted together, all or nothing** — *"When an origin's data is evicted by the browser, all of its data, not parts of it, is deleted at the same time"* **[Primary]** ([MDN storage quotas](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)). So "IndexedDB is safer from eviction than OPFS" is false; they are the same risk.

Chromium allows an origin up to **60% of total disk** in both best-effort and persistent modes. Eviction of best-effort origins happens under storage pressure on a least-recently-used basis. MDN's own summary is reassuring: *"data is very rarely deleted by the browser. If a user visits a website regularly, there is very little chance that its stored data, even in best-effort mode, will get evicted."*

You should still call `navigator.storage.persist()` on first import — it is one line, and in Chrome it is granted or denied automatically based on engagement rather than prompting the user.

**Private/incognito is the sharp edge.** Stored data is normally discarded when the private session ends, and quotas differ. PowerSync's field report notes that **Chrome incognito enforces a 100 MB limit with "unexpected errors when this limit is reached"**, and that **Safari private browsing has no OPFS at all** **[Primary]** ([The Current State Of SQLite Persistence On The Web, updated 15 May 2026](https://powersync.com/blog/sqlite-persistence-on-the-web)). For a hackathon demo, the practical mitigation is a startup probe: try to open the database, and if OPFS is unavailable fall back to an in-memory SQLite database with a visible "this session will not be saved" banner. That is about fifteen lines.

**Corruption and export.** SQLite's ordinary durability machinery applies. I confirmed it: I killed a worker in the middle of an uncommitted insert transaction, reopened, and got `PRAGMA integrity_check` → `ok` with a clean full rollback and zero partial rows **[Measured]**. Export is trivially easy and is one of the underrated wins of this option — `sqlite3_js_db_export()` hands you the whole database as a byte array you can offer as a download, and `OpfsDb.importDb()` reads one back **[Primary]** ([oo1 API](https://sqlite.org/wasm/doc/trunk/api-oo1.md)). Your user can hand you a corrupt file and you can open it in the `sqlite3` CLI on your laptop. Nothing in the IndexedDB option comes close to that.

### 3.6 Reloads, multiple tabs, and the one hazard that will bite you

I tested this directly rather than reasoning about it, because it is the failure mode most likely to ruin a live demo. All results **[Measured]**, headless Chromium 141, `opfs-sahpool`:

| Scenario | Result |
|---|---|
| Second tab opens the same pool while tab 1 holds it | **Immediate hard failure**: `Access Handles cannot be created if there is another open Access Handle or Writable stream associated with the same file` |
| Close tab 1, retry in tab 2 | Succeeds; `integrity_check` → `ok` |
| Reload the page while the DB is idle | Succeeds in **39 ms**, first attempt |
| Reload *during* a ~1.2 s, 10k-row transaction | Succeeds in **132 ms**, first attempt; transaction had committed; integrity `ok` |
| Reload *during* a multi-second, 300k-row transaction | **Fails** — 40 retries over 10 s all rejected with the same access-handle error |

Three things follow.

**First, the multi-tab failure is loud, immediate, and easy to handle.** It fails at `installOpfsSAHPoolVfs()` time, before you have a database object, with a distinctive error string. Catch it and show "This book is open in another tab." That is the correct product behavior anyway, and it is roughly five lines. This is not a reason to avoid sahpool; it is a reason to write one error branch.

**Second, ordinary reloads are completely fine.** The scenario people worry about — user hits refresh — recovers in tens of milliseconds when the database is idle, which it is >99% of the time.

**Third, the real hazard is holding a single very long write transaction.** If the user reloads mid-way through a multi-second synchronous write, the sync access handles are not released and the new page cannot reacquire the pool for at least ten seconds. This is the same class of problem as the open Emscripten bug where *"OPFS leaves AccessHandles open when my app crashes"*, reported 2 July 2025 and **still unresolved** **[Primary]** ([emscripten#24648](https://github.com/emscripten-core/emscripten/issues/24648)).

**The mitigation is a design rule, and you should adopt it regardless of which option you pick:** commit the indexing pass in batches of a few hundred chunks and `await` a macrotask between batches. This bounds any single transaction to a few hundred milliseconds, keeps the worker responsive to a cancel message, gives you resumable indexing for free, and — per my measurements — puts you firmly in the "reload recovers in 132 ms" regime rather than the "locked out for 10 s" regime. It costs about ten lines.

Also add a retry-with-backoff around `installOpfsSAHPoolVfs()` (three attempts, 250 ms apart). It will not save you from a stuck multi-second write, but it does cover ordinary teardown races.

**Service workers / PWA:** you need nothing here for a hackathon. If you later add a service worker for offline caching, note that **SharedWorkers cannot access OPFS**, so cross-tab coordination has to go through a dedicated worker plus messaging, and Chrome's tab suspension can disconnect a database worker (PowerSync works around it with a Web Lock) **[Primary]** (PowerSync, May 2026). None of that applies to a single-tab reader.

### 3.7 Android Chrome and Safari

**Android Chrome is fine.** OPFS including `FileSystemSyncAccessHandle` shipped on Android in **Chrome 107 (2022)** **[Primary]** ([Intent to Ship](https://groups.google.com/a/chromium.org/g/blink-dev/c/GyxqF8ZDK5Q)). A Pixel 7 running current Chrome is many versions past that. `createSyncAccessHandle` is marked *Baseline widely available* since March 2023 **[Primary]** (MDN).

I did **not** measure on a Pixel 7 **[Unknown]** — see §6 and the spike plan in §10, which exists precisely to close this gap in about twenty minutes.

**Safari traps, relevant even though it is not your target:**

- **Safari before 17 cannot use the `opfs` VFS at all** — *"Safari versions less than version 17 are incompatible with the current OPFS VFS implementation because of a bug in the browser's storage handling from sub-workers"*, with no workaround; the documented answer is to use `opfs-sahpool` **[Primary]** (SQLite persistence docs). Another point for sahpool.
- Safari private browsing has no OPFS **[Primary]** (PowerSync).
- Safari proactively deletes script-created storage for origins with **no user interaction in 7 days** **[Primary]** (MDN). For a study app people return to weekly, that is a genuine data-loss vector on iOS. Worth a mention in your README; not a hackathon problem.

### 3.8 Vite and static hosting

Two lines of configuration, from the official README **[Primary]**:

```js
// vite.config.js
export default {
  optimizeDeps: { exclude: ['@sqlite.org/sqlite-wasm'] },
};
```

The README also shows COOP/COEP `server.headers` — **you do not need those if you use `opfs-sahpool`**, and you are better off without them (see §3.2). Beyond that, make sure your host serves `.wasm` as `application/wasm`; every mainstream static host already does.

### 3.9 A note on what is coming (do not use it yet)

The SQLite team is building its own vector extension, **vec1**, by Dan Kennedy — IVFADC with OPQ, approximate nearest-neighbour, L2 and cosine, currently **version 0.7 and unreleased**, announced on the forum 30 March 2026 **[Primary]** ([vec1 docs](https://sqlite.org/vec1), [forum thread](https://sqlite.org/forum/info/c9d69d74c6644dd19614851e46e2bd29615b922407fdb730529a755e2630d652)). It is a loadable extension, not in the WASM build, its roadmap still lists *"Add support for SIMD on wasm"* as future work, and Nuno Cruces has only just gotten it compiling for WASM as a shared module.

This is not usable for your hackathon. It is, however, a reason to keep your vectors in a plain table: if the SQLite team's own ANN extension lands in the canonical WASM build in 2027, migrating BLOB vectors into it is a `INSERT ... SELECT`. Migrating out of a third-party `vec0` virtual table is not.

---

## 4. `sqlite-vec` in browser WASM — maturity assessment

You asked me to test your assumption that sqlite-vec is heavily used, and to keep native adoption strictly separate from browser-WASM adoption. Here is that separation.

### 4.1 The project overall is healthy — natively

sqlite-vec is real, actively maintained, and widely used **on native platforms**. The npm package `sqlite-vec` — which ships **precompiled native loadable extensions for Node.js**, not WASM — recorded **7,805,496 downloads** between 31 July and 29 August 2026 **[Primary]**. Releases are frequent: v0.1.7 (17 Mar 2026), v0.1.8 (30 Mar), v0.1.9 (31 Mar), then alphas through **v0.1.10-alpha.4 on 18 May 2026** **[Primary]** ([releases](https://github.com/asg017/sqlite-vec/releases)). There are maintained bindings for Python, Ruby, Go, Rust, Datasette, rqlite. Licensing is clean: **MIT OR Apache-2.0** **[Primary]**.

**None of that is evidence about the browser.** Those 7.8 million downloads are `.so`/`.dylib`/`.dll` files loaded via `sqlite3_load_extension` in Node. That code path does not exist in a browser.

### 4.2 The three usage contexts, kept separate

**(1) Native / server / mobile SQLite.** Mature. Dynamic extension loading works, the precompiled binaries are the distribution, adoption is in the millions per month. **Not relevant to you.**

**(2) Electron / Tauri.** Also effectively native — both run a real SQLite with `load_extension` available in the main/Node process. Anyone reporting "sqlite-vec works great in my desktop app" is almost certainly in this bucket. **Not relevant to you.**

**(3) Actual browser WASM.** This is a different, much thinner story, and it is the only one that counts here.

### 4.3 What browser WASM actually requires

Runtime loading is impossible — the official documentation states it: *"It's not possibly to dynamically load a SQLite extension into a WASM build of SQLite. So `sqlite-vec` must be statically compiled into custom WASM builds"* **[Primary]** ([wasm.html](https://alexgarcia.xyz/sqlite-vec/wasm.html)). I confirmed the mechanism independently: `PRAGMA compile_options` on `@sqlite.org/sqlite-wasm@3.53.0-build1` includes `OMIT_LOAD_EXTENSION` **[Measured]**.

So the answer to *"does it work with the current official `@sqlite.org/sqlite-wasm` distribution?"* is a flat **no**. You must use a different WASM binary. There are exactly two candidates.

### 4.4 Candidate 1 — `sqlite-vec-wasm-demo` (the author's own): broken

This is the package the official docs point at, described there as *"a **demonstration** of `sqlite-vec` in WASM"* with the warning *"This package is a demonstration and may change at any time. It doesn't follow the Semantic version of `sqlite-vec`"* **[Primary]**.

I installed `sqlite-vec-wasm-demo@0.1.9` and tried to initialize it **[Measured]**:

- **In a module worker:** `RuntimeError: Aborted(Attempt to set 'Module.postRun' after it has already been processed. This can happen, for example, when code is injected via '--post-js' rather than '--pre-js')`
- **On the main thread, with and without a config object:** identical failure.

I read the bundle to find the cause. At line 5907 the Emscripten postamble calls `run()`; Emscripten then seals `Module.postRun` with a setter that aborts. At line 5912 SQLite's `post-js-header.js` block begins with `if(!Module.postRun) Module.postRun = [];` — which trips that setter. The `--post-js` content is being concatenated after the runtime has already started, which is precisely what the error message describes. This is a defect in the published artifact, not in how it is used.

Other facts about it **[Measured]** unless noted:

- `sqlite3.wasm` is **4,431,116 bytes** (1,865,269 gzipped) — 5× the official build, consistent with an unoptimized `-O0`/debug-symbol build.
- It embeds **SQLite 3.45.3** and **sqlite-vec v0.1.9**. SQLite 3.45.3 predates `opfs-wl`, the 3.50 sahpool pause/unpause, and two years of fixes.
- Its README file is **4 bytes long**.
- Downloads: **1,523/month on npm**, **358 hits/month on jsDelivr** and falling (465 the prior month) **[Primary]**.

**Assessment: this is an example artifact, not a dependency.** It is not production-ready; as published, it is not *usable*.

### 4.5 Candidate 2 — `sqlite-wasm-vec` (community fork): works, but thin

The alternative is [`yangbooom/sqlite-wasm-vec`](https://github.com/yangbooom/sqlite-wasm-vec), a fork of the official sqlite-wasm with sqlite-vec statically compiled in.

**Credit where due — it genuinely works.** I ran it end to end in a worker **[Measured]**:

- SQLite **3.51.0**, sqlite-vec **v0.1.7-alpha.2**
- `ENABLE_FTS5` present → **FTS5 and `vec0` coexist in one build**, which answers your compatibility question affirmatively
- `OMIT_LOAD_EXTENSION` present → confirming the static-compilation route
- `installOpfsSAHPoolVfs()` works → **persistent OPFS databases with sqlite-vec are possible**
- `distance_metric=cosine`, `partition key` columns, and plain metadata columns all accepted
- `sqlite3.wasm` is 1,555,262 B (616,290 gzipped) — a sane size
- **Correctness:** `vec0` top-10 on 2,000 normalized 384-d vectors returned the *identical ranked list* to an exact JavaScript cosine scan. It is exact search, as expected.

**And now the maturity picture [Primary]:**

- **0 GitHub stars.**
- **513 npm downloads in the last month.**
- Latest version **0.1.11, published 12 October 2025** — no release in ~11 months.
- It pins **sqlite-vec v0.1.7-alpha.2**, an alpha that is already three releases behind, and SQLite 3.51 rather than 3.53.
- It is a fork, so every upstream SQLite security or correctness fix and every sqlite-vec release requires this one maintainer to rebuild.

### 4.6 Adoption evidence, tested rather than assumed

Your suspicion was that sqlite-vec is heavily used in the wild. It is — natively. In browsers, the evidence points the other way:

| Signal | Value |
|---|---|
| `sqlite-vec` npm (native Node bindings) | 7,805,496/month **[Primary]** |
| `sqlite-vec-wasm-demo` npm (browser) | 1,523/month **[Primary]** |
| `sqlite-vec-wasm-demo` jsDelivr | 358/month, declining **[Primary]** |
| `sqlite-wasm-vec` npm (browser fork) | 513/month **[Primary]** |
| `@sqlite.org/sqlite-wasm` (the plain browser build) | 3,018,012/month **[Primary]** |

Browser usage of sqlite-vec is roughly **0.06%** of the browser usage of plain SQLite WASM, and roughly **0.03%** of sqlite-vec's own native usage. GitHub code search would sharpen this further but requires authentication I do not have here **[Unknown]** — though the npm and CDN numbers are consistent and independent.

I also looked for failure reports rather than only demos. The sqlite-vec repository has an **open, zero-comment issue from 15 September 2024** titled *"sqlite wasm build: `oo1.OpfsDb()` Memory out of bounds error"* **[Primary]** ([#105](https://github.com/asg017/sqlite-vec/issues/105)) — that is, a report of the WASM build failing on exactly the persistent-OPFS path you need, unanswered for two years. Issue #135 asking for Pyodide support has been open since November 2024. WASM is not where the project's attention is.

### 4.7 Capabilities, indexing, and migration risk

- **Vector types:** float32, int8, binary **[Primary]**.
- **Distance:** L2 and cosine; I verified `distance_metric=cosine` is accepted in the working browser build **[Measured]**. On unit-normalized vectors, L2 ordering and cosine ordering are equivalent, so the default is fine for your data.
- **Filtering:** partition keys, metadata columns, and auxiliary columns are supported **[Primary]**, and I confirmed the DDL is accepted in the browser build **[Measured]**.
- **Indexing:** **exact brute force only.** *"sqlite-vec as of v0.1.0 will be brute-force search only, which slows down on large datasets (>1M w/ large dimensions)"* **[Primary]** ([#25](https://github.com/asg017/sqlite-vec/issues/25), open since 21 June 2024). DiskANN work appears in the 0.1.10 alphas but has not shipped in a stable release, and certainly not in either browser build **[Primary]**.
- **Upgrade/migration risk:** the README says *"sqlite-vec is a pre-v1, so expect breaking changes"* **[Primary]**. `vec0` is a virtual table, so its on-disk shadow-table format is an implementation detail of the extension version. A breaking change means a rebuild of the WASM binary *and* a data migration, gated on a zero-star fork's maintainer.
- **Licensing:** MIT OR Apache-2.0 for sqlite-vec, Apache-2.0 for the fork **[Primary]**. No redistribution obstacle.

### 4.8 Bottom line on sqlite-vec

**The evidence supports SQLite in browsers but does not support `sqlite-vec` in browsers.** Stating that explicitly as you asked:

> Use SQLite WASM. Do **not** use sqlite-vec in the browser for this project. Store normalized `Float32` vectors as ordinary `BLOB`s in an ordinary table and scan them exactly in JavaScript. At 1k–10k chunks this is the same algorithm at the same speed with none of the dependency risk.

The threshold where this changes: sqlite-vec's brute force becomes attractive somewhere around a million vectors, where its C SIMD inner loop and its ability to stream from disk without materializing everything in the JS heap start to matter. You are two orders of magnitude below that. If you later build a multi-book library of 500k+ chunks, revisit — and by then vec1 may be in the canonical build anyway.

---

## 5. IndexedDB findings

I evaluated this option by building and measuring it, not by reasoning about it.

### 5.1 It works, and the ergonomics are decent

Dexie 4.4.5 (Apache-2.0) and MiniSearch 7.2.0 (MIT) together are **65,505 bytes gzipped** **[Measured]** — about an eighth of the SQLite bundle. Setup is three lines of schema declaration and no worker requirement, no headers, no WASM MIME types. For pure time-to-first-working-thing, this is the fastest option.

### 5.2 Storing `Float32Array` and blobs

IndexedDB uses structured clone, so typed arrays round-trip natively — no base64, no manual serialization. **I verified this end to end**: I stored 10,000 per-row `Float32Array(384)` values, closed the database, reloaded the page, read them back and reassembled a 15 MB matrix that produced correct top-k results **[Measured]**.

**But how you store them matters a great deal.** Two layouts, same data **[Measured]**:

| Layout | Write 10k vectors | Read back 10k vectors |
|---|---|---|
| One record per chunk (`{id, v: Float32Array}`) | **3,544 ms** | 427 ms cold / 229 ms warm |
| One packed `ArrayBuffer` for the whole book | **271 ms** | 123 ms cold / 64 ms warm |

That is a **13× write difference and a 3.5× read difference** for what looks like the same design. Per-row storage is the obvious thing to write and the wrong thing to write; each record is a separate structured-clone and key-index operation. If you take this option, pack the vectors into a single buffer and keep an id→row-offset map. This is a real, easy-to-miss trap **[Measured]**, and it is a good illustration of the general character of this option: nothing is hard, several things are quietly slow until you know.

### 5.3 MiniSearch serialization — the answer is yes, with caveats

You asked whether MiniSearch indexes must be rebuilt after reload. **They do not** — `toJSON()`/`MiniSearch.loadJSON()` exist and there is a `loadJSONAsync()` that *"loads the index in batches, leaving pauses between them to avoid blocking the main thread"* **[Primary]** ([API docs](https://lucaong.github.io/minisearch/classes/MiniSearch.MiniSearch.html)). The documented caveat: *"Upon deserialization, one must pass to loadJSON the same options used to create the original instance that was serialized"* — so your `fields`, `idField`, `tokenize` and `processTerm` options become part of your persisted format, and changing any of them silently invalidates every stored index. Version your index alongside your schema.

Measured cost **[Measured]**:

| | 2,000 chunks | 10,000 chunks |
|---|---|---|
| Build index from scratch | 175 ms | 872 ms |
| `JSON.stringify(toJSON())` | 38 ms | 105 ms |
| Serialized size | **1.01 MB** | **5.25 MB** |
| `loadJSON()` on reload | 21–34 ms | 91–108 ms |

So reloading is cheap. But note the shape of it: you are storing a **5.25 MB JSON string** as a single IndexedDB value and parsing it on every cold start, and MiniSearch's index does not hold your document text (unless you duplicate it via `storeFields`, which would roughly double that). Compare with SQLite, where FTS5 lives inside the same file as the rows, is memory-mapped by the pager, and costs **zero** milliseconds to "load" — you just open the database.

### 5.4 Transactions, migrations, consistency

Dexie gives real IndexedDB transactions with rollback: *"If modifying a database and an error occurs, every modification will be rolled back"* **[Primary]** ([Dexie design docs](https://dexie.org/docs/Tutorial/Design)). Migrations are declarative version bumps with optional upgrade functions, and are genuinely pleasant.

**The consistency problem is not transactional, it is architectural.** In this option your book's state lives in three places with three different update paths:

1. chunk rows in IndexedDB (transactional),
2. the packed vector buffer in IndexedDB (transactional, but a single opaque blob you must rewrite wholesale),
3. the MiniSearch index — **an in-memory object that is not transactional at all**, serialized to IndexedDB as a snapshot.

If indexing is interrupted after chunks are written but before the MiniSearch snapshot is saved, you have rows with no lexical index, and nothing in the system knows that. You must write the reconciliation logic yourself: a version/epoch stamp, a "index is stale" flag, a rebuild-on-mismatch path. It is not hard, but it is code that does not exist in the SQLite option, where `INSERT INTO chunks_fts ...` is inside the same transaction as the rows and either both happen or neither does.

That, more than any latency number, is why I do not recommend this option.

### 5.5 Quota, eviction, multi-tab

Quota and eviction are **identical to OPFS** — same shared per-origin budget, same all-or-nothing eviction **[Primary]** (MDN). There is no durability advantage here.

Multi-tab is genuinely better: IndexedDB allows concurrent connections from multiple tabs, so you do not get sahpool's hard lock. But a second tab holding its own MiniSearch index and its own copy of the vector matrix means two stale caches, and reconciling those by hand is worse than the "this book is open in another tab" message that sahpool forces you to write in five lines.

### 5.6 Inspectability and export

Chrome DevTools has an IndexedDB viewer, which is fine for browsing records and useless for querying — there is no ad-hoc query language, so "which chunks in chapter 7 mention arbitration" requires writing code. Export requires you to write a serializer for all three stores. This is the axis where SQLite wins hardest: a downloaded `.sqlite` file opens in any SQLite tool you own.

### 5.7 Would a vector-search library improve this option?

You asked what browser-native or WASM vector libraries exist. My assessment: **none of them are worth adding at your scale [Inference]**, and I want to be precise about why. Your measured exact-scan cost is **8.5 ms for 10,000 × 384-d vectors**. An approximate index (HNSW-in-WASM and similar) exists to turn an O(n) scan into O(log n) — but 8.5 ms is already imperceptible, the index build would cost more than the scan it replaces, you would sacrifice exact recall, and you would add a dependency of similar maturity to the one this report just recommended against. The right "vector library" for 10k vectors is the thirty-line dot-product loop in §11. That conclusion holds identically for Options B and C.

---

## 6. Performance evidence

### 6.1 Method, and its limits — read this before the numbers

**What I actually ran.** A reproducible harness in a real browser: deterministic synthetic corpus (500–1,000-character chunks from a fixed vocabulary with a seeded PRNG), 384-dimensional unit-normalized `Float32` vectors from a second seeded PRNG, all database work inside a dedicated module worker, `opfs-sahpool` for both SQLite variants, timings via `performance.now()`, medians and maxima over 10 queries per class. Each "reopen" row is a genuine fresh page navigation against previously persisted data, so it measures real cold-start-with-existing-database.

**Environment:** Chromium **141.0.7390.37** headless (Playwright), Linux x86-64, **2 vCPU**, 7 GB RAM, localhost HTTP.

**The honest caveats:**

1. **This is not a Pixel 7.** Every number below is desktop-class. §10's spike exists to close that gap.
2. **It is not your real corpus.** Synthetic text has different term distributions than a technical EPUB, so FTS5 and MiniSearch numbers will shift — probably modestly, and in the same direction for both.
3. **Localhost means no network.** Module init times exclude download; use the gzip sizes for that.
4. **2 vCPU is a modest desktop.** A developer laptop will beat these numbers.
5. **The `storageUsageBytes` figures from `navigator.storage.estimate()` are origin-wide**, and all three variants shared one origin, so they include the OPFS files from the SQLite runs. I have not used them as a clean per-option size and neither should you.

I found no published benchmark of a sufficiently similar browser workload — small-corpus hybrid retrieval in browser SQLite versus IndexedDB — to cite instead. That is why I ran it.

### 6.2 Indexing, 10,000 chunks

| Step | **B. SQLite + BLOB** | **A′. SQLite + sqlite-vec** | **C. Dexie + MiniSearch** |
|---|---|---|---|
| Insert chunk rows | 1,224 ms | 1,136 ms | 2,280 ms |
| Build lexical index | 309 ms (FTS5) | 398 ms (FTS5) | 872 ms (MiniSearch) |
| Store vectors | 1,671 ms (BLOBs) | 2,021 ms (`vec0`) | 271 ms packed / 3,544 ms per-row |
| Serialize lexical index | n/a — inside the DB | n/a | 105 ms (+64 ms store) |
| **Total** | **~3.2 s** | **~3.6 s** | **~3.6 s packed / ~6.9 s per-row** |
| Database size | 26,591,232 B | 26,214,400 B | see §6.1 caveat |

**[Measured]**, all of it. At 2,000 chunks everything scales down roughly linearly: B totals ~0.93 s, A′ ~0.83 s, C ~0.47 s packed.

Read that table with the right frame: **all three are within about 10% of each other at the size that matters, and all three are dominated by something not in the table** — computing 10,000 embeddings with Transformers.js, which will take tens of seconds to minutes on a Pixel 7. Indexing performance is not a differentiator between these options. Do not let anyone tell you otherwise.

### 6.3 Query latency

Median of 10 queries; worst case in parentheses **[Measured]**:

| Query | Corpus | **B** | **A′** | **C** |
|---|---|---|---|---|
| FTS, cold (just built) | 2k | 5.9 ms (9.8) | 7.2 ms (15.8) | 7.6 ms (12.6) |
| FTS, after reload | 2k | 12.5 ms (40.3) | 10.4 ms (65.2) | 2.6 ms (15.4) |
| FTS, cold | 10k | 16.7 ms (30.4) | 19.8 ms (36.0) | 37.6 ms (61.7) |
| FTS, after reload | 10k | 18.5 ms (100.1) | 24.4 ms (72.2) | 16.3 ms (22.6) |
| Vector top-10 | 2k | 1.7 ms (3.4) | 2.4 ms (4.6) | 1.9 ms (6.5) |
| Vector top-10 | 10k | **8.6 ms (10.7)** | **8.8 ms (112.4)** | 8.5 ms (14.3) |
| Vector top-10 after reload | 10k | 8.0 ms (12.6) | 9.0 ms (**875.8**) | 8.8 ms (11.1) |

**The headline: at 10,000 chunks, `sqlite-vec` (8.8 ms) and a hand-written JavaScript cosine scan (8.6 ms) are the same speed.** They are the same algorithm — an exact scan over every vector — so this is what should happen. The difference is in the tails: sqlite-vec's worst case reached **876 ms** on the first query after reload, because `vec0` pages its shadow tables in from OPFS lazily. Option B pays that cost once, explicitly, as a measured 511–934 ms "load vectors into RAM" step you can put behind a progress indicator, and thereafter every query is 8 ms with a 12 ms ceiling.

For a reader UI, a predictable 8 ms is worth more than an average 8 ms with an occasional 876 ms stall.

### 6.4 Cold start with an existing database, 10,000 chunks

**[Measured]**, warm HTTP cache, localhost:

| | **B** | **A′** | **C** |
|---|---|---|---|
| Module init | 77 ms | 79 ms | 24 ms |
| VFS install | 20 ms | 17 ms | — |
| Open database | 6 ms | 5 ms | 6 ms |
| **Ready to query (lexical)** | **~103 ms** | **~101 ms** | **~121 ms** (incl. 91 ms MiniSearch parse) |
| Load vectors into RAM | 934 ms | not needed | 64 ms (packed) |

Two observations. First, all three are fast enough that cold start is not a decision criterion. Second, Option B's 934 ms vector load is its one visible cost — and it is optional. You can defer it until the user's first semantic search, or stream it in the background while they read chapter one. If you want it faster, store the vectors as **a handful of packed BLOBs of ~1,000 vectors each rather than 10,000 individual rows** — Option C's packed-vs-per-row result (123 ms vs 427 ms) suggests the same batching win applies here **[Inference, by analogy with a measured result]**.

### 6.5 Transfer sizes

**[Measured]** — `gzip -9` on the actual published artifacts:

| Asset | Raw | Gzipped |
|---|---|---|
| `@sqlite.org/sqlite-wasm` wasm + js | 1,443,311 B | **555,353 B** |
| `sqlite-wasm-vec` wasm + js | 2,274,460 B | **812,840 B** |
| `sqlite-vec-wasm-demo` wasm (broken) | 4,431,116 B | 1,865,269 B |
| `dexie` + `minisearch` | 318,400 B | **65,505 B** |
| *`all-MiniLM-L6-v2` int8 ONNX weights* | *22,972,370 B* | *(already compressed)* |

Option B costs **490 KB more than Option C** on first load — about **2%** of the embedding model you are downloading anyway. If first-load size is the deciding factor, you have a bigger fish to fry, and it weighs 22 MB.

### 6.6 Pixel 7 expectations

**[Inference — flagged clearly, not measured.]** A Pixel 7's Cortex-X1 single-core performance is broadly in the same class as a mid-range desktop core, so I would expect the CPU-bound work — the cosine scan, FTS5 query execution, MiniSearch tokenizing — to land within roughly **1.5–3×** of these numbers. That would put a 10k vector scan somewhere around 13–26 ms and an FTS query around 25–50 ms: still comfortably interactive.

The parts I genuinely cannot predict are **OPFS write throughput on Android's storage stack** and **memory pressure** — a 15 MB `Float32Array` plus a WASM heap plus a loaded ONNX model on a phone that may background your tab is the real risk, and no amount of desktop measurement answers it. That is question one of the spike in §10.

---

## 7. Operational and browser risks

Ranked by how likely each is to actually hurt you during a three-day build, with the mitigation.

**1. Second tab hard-fails on `opfs-sahpool`. [Measured] — near-certain to occur in demo.**
`installOpfsSAHPoolVfs()` throws `Access Handles cannot be created if there is another open Access Handle...` if another tab holds the pool. It happens before you have a database object, so it is trivially catchable. **Mitigation:** catch it by error-string match, show "This book is open in another tab," offer a retry button. ~5 lines. Applies to A′ and B.

**2. Long write transactions can lock you out across a reload. [Measured] — likely if you index in one transaction.**
A reload during a multi-second synchronous write left the pool unopenable across 40 retries over 10 seconds. A reload during a ~1.2 s transaction recovered in 132 ms. **Mitigation:** batch commits every ~250 chunks and yield to the event loop between batches. This also gives you cancellable, resumable indexing. ~10 lines, and you want it anyway. Applies to A′ and B.

**3. First-run OPFS unavailability (incognito, exotic browser, corporate policy). [Primary] — moderate.**
Chrome incognito caps at ~100 MB with reports of *"unexpected errors when this limit is reached"*, and Safari private browsing has no OPFS at all (PowerSync, May 2026). **Mitigation:** probe at startup; fall back to an in-memory SQLite database with a visible "this session won't be saved" banner. ~15 lines. Applies to A′ and B; Option C has an analogous but milder problem.

**4. Storage eviction. [Primary] — low.**
Best-effort origins can be evicted LRU under disk pressure, and eviction takes *everything* for the origin at once. **Mitigation:** `await navigator.storage.persist()` on first import. One line. Identical risk for all three options — this is not a reason to prefer IndexedDB.

**5. Leaked access handles after a crash. [Primary] — low but nasty.**
The open Emscripten issue ([#24648](https://github.com/emscripten-core/emscripten/issues/24648), 2 Jul 2025, unresolved) reports handles surviving a crash such that only a full browser restart recovers. **Mitigation:** retry-with-backoff on VFS install; if it still fails, offer a "reset local database" button that deletes the OPFS directory and re-imports. ~20 lines, and it doubles as your corruption escape hatch.

**6. sqlite-vec supply chain. [Primary] — high, and specific to Option A.**
A zero-star, eleven-month-stale fork pinning an alpha extension is your storage engine. If it breaks or the maintainer stops, you are compiling Emscripten yourself. **Mitigation: do not take this risk.** This is the whole argument of §4.

**7. Following stale documentation. [Primary] — moderate, and cheap to avoid.**
Chrome's OPFS article (last updated January 2023) and most tutorials teach the promiser API, deprecated 15 April 2026 and *"actively discouraged"*, plus the COOP/COEP `?vfs=opfs` setup you do not need. A coding agent trained on that corpus will reproduce it. **Mitigation:** state in your prompt/spec that the code must use `oo1` directly in a worker with `installOpfsSAHPoolVfs`, and no promiser, no COOP/COEP. One sentence, saves an hour.

**8. Cross-origin isolation breaking Transformers.js. [Inference] — avoided entirely by choosing sahpool.**
Setting `Cross-Origin-Embedder-Policy: require-corp` isolates your page and blocks cross-origin subresources lacking CORP headers, which is a plausible way to break model downloads from a CDN. Using `opfs-sahpool` means you never set those headers. Worth knowing *why* you are avoiding them.

**9. Three stores drifting out of sync. [Inference] — moderate, specific to Option C.**
See §5.4. Mitigate with an epoch/version stamp and a rebuild-on-mismatch path.

**10. Android tab backgrounding closing access handles. [Primary] — unknown severity for you.**
PowerSync reports that on Ionic Capacitor, *"access handles close when apps enter background, causing resumption errors."* Whether plain Chrome on a Pixel 7 does this to a plain web page is **[Unknown]** and is question two of the spike.

---

## 8. Recommended architecture for the hackathon

**Option B, with one worker owning everything.**

```
UI thread (React + Foliate.js)
   │  postMessage / Comlink
   ▼
db-worker.ts  ─── owns the SQLite connection for its whole lifetime
   ├─ @sqlite.org/sqlite-wasm, oo1 API, opfs-sahpool VFS
   ├─ chunks            (id, section, ord, cfi, text)
   ├─ chunks_fts        (FTS5, external content over chunks)
   ├─ vectors           (id, dim, data BLOB — packed batches of ~1000)
   ├─ vectorMatrix      (a Float32Array cached in the worker's heap)
   └─ annotations, bookmarks, study artifacts — ordinary tables

embed-worker.ts ─── separate worker, Transformers.js
   └─ posts {id, Float32Array} batches to db-worker
```

**Why two workers rather than one.** Keep Transformers.js and SQLite in separate workers. Embedding is a long CPU-bound job; if it shares a thread with the database, a search query issued while indexing runs will queue behind it. Two workers also means you can terminate and restart the embedding worker to cancel indexing without touching the database connection — which, per §7, is exactly the thing you must not interrupt carelessly.

**The seven design decisions that matter:**

1. **`opfs-sahpool`, not `opfs`.** No COOP/COEP, best write throughput, works on Safari 16.4+, and single-tab is your actual product.
2. **`oo1` directly, no promiser.** It is deprecated and discouraged; write a ~40-line typed message protocol, or use Comlink.
3. **FTS5 external-content table over `chunks`.** No duplicated text, one source of truth, `bm25()` ranking built in. Measured 309 ms to build over 10k chunks.
4. **Vectors as packed BLOBs, ~1,000 per row, not one row per chunk.** Cheaper to write, much cheaper to read back.
5. **Load the vector matrix into a single `Float32Array` in the worker on demand**, then scan it. One 15 MB allocation at 10k chunks; ~8.6 ms per query after that.
6. **Batch the indexing transaction** — commit every ~250 chunks, `await new Promise(r => setTimeout(r, 0))` between batches. Buys you cancellation, resumability, a progress bar, and reload safety.
7. **RRF in TypeScript, not SQL.** You are fusing two lists of ≤50 items. A ten-line function is clearer, easier to tune during a demo, and does not need a CTE.

**What to explicitly skip for the hackathon:** sqlite-vec; approximate indexes; `opfs-wl`; multi-tab coordination beyond one error message; service workers; WAL mode (the docs note it *"does not provide any concurrency benefits in this environment"*); custom FTS5 tokenizers.

**Effort estimate for a strong coding agent [Inference]:** 3–5 hours to a working indexed-and-searchable book, of which maybe 45 minutes is the worker message plumbing and 30 minutes is fighting Vite over the WASM asset. The retrieval logic itself is small.

---

## 9. Recommended architecture if the project continues

Almost the same, which is the point — Option B does not paint you into a corner.

**Keep as-is:** SQLite WASM, OPFS, FTS5, one worker, RRF in TypeScript. None of this is throwaway.

**Add when the pain appears, in this order:**

1. **Multi-book library.** Now you need multi-tab, and the choice becomes `opfs-wl` (SQLite 3.53+, Web Locks, no COOP/COEP) or `opfs` with COOP/COEP. `opfs-wl` is the better bet: same performance as `opfs`, fairer locking, no header requirement. Migration is a VFS name change plus `SQLITE_BUSY` retry handling.
2. **Vectors outgrowing the JS heap** (roughly 200k+ chunks, where a packed matrix passes ~300 MB). Two paths: quantize to int8 first — a 4× memory cut for negligible recall loss at this dimensionality, and it keeps the architecture identical — or move to an on-disk vector index. Quantization is the cheaper win; do it first.
3. **Only then reconsider a vector extension.** By that point, check whether **vec1** has landed in the canonical WASM build. It is the SQLite team's own extension with real ANN (IVFADC+OPQ), which makes it a far better long-term bet than a third-party fork. Because your vectors are ordinary BLOBs, adopting it is an `INSERT INTO ... SELECT`.
4. **Sync/multi-device.** This is where you would evaluate PowerSync or similar, and where their VFS work becomes directly relevant.
5. **Chunk-level scale-out for lexical search.** FTS5 will not be your bottleneck for a long time.

**The strategic point:** Option B's schema is boring on purpose. Ordinary tables and ordinary BLOBs can migrate into anything. A `vec0` virtual table cannot.

---

## 10. Two-hour empirical spike

I have already run most of the desktop half of this in preparing the report, so the spike below is scoped to **the questions I could not answer** — chiefly Pixel 7 behavior — plus a re-run on your real EPUB. Budget: **~100 minutes**, leaving slack.

### Setup (20 min)

A single static page, no build step, served over HTTPS (Android Chrome needs a secure context; `vite preview --host` over your LAN plus `chrome://flags/#unsafely-treat-insecure-origin-as-secure`, or a quick tunnel, both work).

- Corpus: **your actual EPUB**, chunked with your real chunker, plus a synthetic corpus padded to **10,000** chunks so you test both 2,000 and 10,000.
- Vectors: real Transformers.js output if you have the pipeline, otherwise seeded random unit-normalized `Float32Array(384)`. For timing purposes random vectors are fine; for recall they are not, and recall is not what this spike measures.
- Three buttons: **Run B**, **Run C**, **Reopen & Query**. All work inside a dedicated module worker. Log every timing as JSON to the page so you can screenshot it from the phone.

### Measurements (40 min: 20 desktop, 20 on the Pixel 7)

For each of N ∈ {2000, 10000} and each option:

1. Cold init: module load → VFS install → open → schema ready.
2. Insert rows; build lexical index; store vectors — timed separately.
3. Database size (`page_count × page_size`) and `navigator.storage.estimate()`.
4. FTS/MiniSearch query latency: 10 fixed queries, median and max.
5. Vector top-10 latency: 10 fixed query vectors, median and max.
6. Hybrid query latency end to end, including RRF.
7. Reload the page; re-open; time to first successful query.
8. **Peak memory** during a 10k vector scan (`performance.measureUserAgentSpecificMemory()` where available, else Android Chrome remote DevTools).

### The three failure drills (25 min) — do not skip these

These are the ones that will actually decide the demo.

9. **Reload mid-indexing.** Hit refresh at ~50% through the 10k index build. Does the page reopen the database? Within how long? What does `PRAGMA integrity_check` say? Repeat with batched commits enabled and disabled — you should see the difference I measured on desktop (recovers in ~130 ms vs. locked out past 10 s).
10. **Background the tab on the Pixel 7** during indexing — switch apps for 30 seconds, come back. Does the worker survive? Do the OPFS access handles survive? This directly tests the PowerSync-reported Capacitor failure mode against plain Chrome.
11. **Second tab.** Open the app in a second Android Chrome tab. Confirm the error is the catchable `Access Handles cannot be created...` string and not something silent.

### Report and decide (15 min)

One JSON blob per (option × N × device), pasted into a table.

### Decision rules — commit to these before you run it

- **Choose B if:** it indexes 10k chunks on the Pixel 7 in under ~15 s (excluding embedding), hybrid query median is under ~150 ms, peak memory stays under ~250 MB, and drills 9–11 behave as they did on desktop. **This is the expected outcome; treat B as the default and the spike as a check, not a coin flip.**
- **Choose C if and only if** OPFS on your Pixel 7 fails a drill in a way you cannot mitigate in under an hour — handles do not survive backgrounding, the database will not reopen after a mid-index reload even with batched commits, or writes are pathologically slow (10k-chunk indexing beyond ~60 s). These are real possibilities; they are why you run the spike. C is your escape hatch, not your plan.
- **Choose A only if** — and I do not expect this — B's vector scan on the Pixel 7 exceeds ~200 ms median while `sqlite-wasm-vec`'s `vec0` comes in dramatically lower. Given that the two are the same algorithm and measured within 0.2 ms of each other on desktop, I would treat such a result as a bug in the harness before I treated it as a reason to adopt a zero-star fork.
- **If B and C are within ~2× of each other on everything** (the likely outcome), **choose B** for the SQL, the single file, the transactional consistency, and the export story.

**A caution about the spike's authority:** it measures speed and crash-recovery. It does not measure retrieval quality, and the two options have identical vector recall (both exact) but *different lexical behavior* — FTS5's `bm25` and MiniSearch's scoring will not return the same lists. If retrieval quality matters more than latency to you, that is a separate evaluation with a labelled query set, and it is the one I would run next.

---

## 11. Exact packages, versions, configuration, and initialization

### 11.1 Dependencies (recommended path)

```bash
npm install @sqlite.org/sqlite-wasm@3.53.0-build1
npm install comlink            # optional; ~2 KB, saves ~40 lines of message plumbing
```

That is the whole storage stack. Verified facts about it **[Measured/Primary]**: SQLite 3.53.0, Apache-2.0, `ENABLE_FTS5` present, `OMIT_LOAD_EXTENSION` present, 555 KB gzipped, `installOpfsSAHPoolVfs` available, `pauseVfs`/`unpauseVfs` available (SQLite 3.50+) if you ever need cooperative multi-tab.

For Option C, if the spike sends you there: `dexie@4.4.5` (Apache-2.0), `minisearch@7.2.0` (MIT).
For Option A, which I do not recommend: `sqlite-wasm-vec@0.1.11` (Apache-2.0, SQLite 3.51.0 + sqlite-vec v0.1.7-alpha.2). Do **not** use `sqlite-vec-wasm-demo` — it does not initialize.

### 11.2 Vite configuration

```js
// vite.config.js
import { defineConfig } from 'vite';
export default defineConfig({
  optimizeDeps: { exclude: ['@sqlite.org/sqlite-wasm'] },
  worker: { format: 'es' },
  // NOTE: deliberately NO COOP/COEP headers. opfs-sahpool does not need them,
  // and cross-origin isolation can break cross-origin model downloads.
});
```

Confirm your host serves `.wasm` as `application/wasm`.

### 11.3 Worker initialization

```ts
// src/workers/db-worker.ts  — this worker owns the database for its lifetime.
import sqlite3InitModule, { type Sqlite3Static, type Database } from '@sqlite.org/sqlite-wasm';

const DIM = 384;
let db: Database;
let matrix: Float32Array | null = null;   // lazily-loaded vector cache
let ids: Int32Array | null = null;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function open(): Promise<{ persistent: boolean }> {
  const sqlite3: Sqlite3Static = await sqlite3InitModule({
    print: () => {}, printErr: console.error,
  });

  // Retry: covers teardown races after a reload. See §7, risk 2 & 5.
  let pool: any = null;
  for (let i = 0; i < 3 && !pool; i++) {
    try {
      pool = await sqlite3.installOpfsSAHPoolVfs({
        name: 'study-pool',
        directory: '/study-pool',
        initialCapacity: 8,      // >= 2x expected files, per SQLite docs
      });
    } catch (e: any) {
      if (String(e?.message).includes('Access Handles cannot be created')) {
        if (i === 2) throw new Error('DB_LOCKED_BY_ANOTHER_TAB');
        await sleep(250);
      } else { throw e; }
    }
  }

  if (pool) {
    db = new pool.OpfsSAHPoolDb('/study.sqlite');
  } else {
    db = new sqlite3.oo1.DB(':memory:', 'ct');   // incognito / no-OPFS fallback
  }

  db.exec(`
    PRAGMA journal_mode = DELETE;
    PRAGMA synchronous  = NORMAL;
    CREATE TABLE IF NOT EXISTS chunks(
      id INTEGER PRIMARY KEY, section TEXT, ord INTEGER, cfi TEXT, text TEXT);
    CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts
      USING fts5(text, content='chunks', content_rowid='id');
    CREATE TABLE IF NOT EXISTS vec_batches(
      batch INTEGER PRIMARY KEY, first_id INTEGER, count INTEGER, data BLOB);
  `);

  return { persistent: !!pool };
}
```

### 11.4 Batched, cancellable indexing

```ts
const BATCH = 250;
let cancelled = false;
export function cancel() { cancelled = true; }

export async function indexChunks(
  chunks: { id: number; section: string; ord: number; cfi: string; text: string }[],
  vectors: Float32Array,          // chunks.length * DIM, unit-normalized
  onProgress: (done: number) => void,
) {
  cancelled = false;
  for (let start = 0; start < chunks.length; start += BATCH) {
    if (cancelled) return { cancelled: true, done: start };
    const end = Math.min(start + BATCH, chunks.length);

    db.transaction(() => {                       // short transaction: see §7 risk 2
      const st = db.prepare(
        'INSERT OR REPLACE INTO chunks(id,section,ord,cfi,text) VALUES (?,?,?,?,?)');
      for (let i = start; i < end; i++) {
        const c = chunks[i];
        st.bind([c.id, c.section, c.ord, c.cfi, c.text]).step();
        st.reset();
      }
      st.finalize();

      // One packed BLOB per batch — 13x faster to write than per-row. See §5.2.
      const bytes = new Uint8Array(
        vectors.buffer, start * DIM * 4, (end - start) * DIM * 4);
      db.exec({
        sql: 'INSERT OR REPLACE INTO vec_batches(batch,first_id,count,data) VALUES (?,?,?,?)',
        bind: [start / BATCH, chunks[start].id, end - start, bytes],
      });
    });

    onProgress(end);
    await sleep(0);              // yield: keeps the worker cancellable & reload-safe
  }

  db.exec(`INSERT INTO chunks_fts(chunks_fts) VALUES('rebuild')`);
  matrix = null;                 // invalidate the cache
  return { cancelled: false, done: chunks.length };
}
```

### 11.5 Search: FTS5, exact cosine, and RRF

```ts
function ensureMatrix() {
  if (matrix) return;
  const rows: { first_id: number; count: number; data: Uint8Array }[] = [];
  db.exec({ sql: 'SELECT first_id,count,data FROM vec_batches ORDER BY batch',
            rowMode: 'object', callback: (r: any) => rows.push(r) });
  const total = rows.reduce((n, r) => n + r.count, 0);
  matrix = new Float32Array(total * DIM);
  ids = new Int32Array(total);
  let off = 0;
  for (const r of rows) {
    matrix.set(new Float32Array(r.data.buffer, r.data.byteOffset, r.count * DIM), off * DIM);
    for (let i = 0; i < r.count; i++) ids[off + i] = r.first_id + i;
    off += r.count;
  }
}

export function lexicalSearch(query: string, k = 20) {
  const out: [number, number][] = [];
  db.exec({
    sql: `SELECT rowid, bm25(chunks_fts) AS s FROM chunks_fts
          WHERE chunks_fts MATCH ? ORDER BY s LIMIT ?`,
    bind: [query.trim().split(/\s+/).join(' OR '), k],
    rowMode: 'array', callback: (r: any) => out.push([r[0], r[1]]),
  });
  return out.map(([id]) => id);            // bm25 is ascending-better
}

export function vectorSearch(q: Float32Array, k = 20) {
  ensureMatrix();
  const n = ids!.length;
  const scored: [number, number][] = new Array(n);
  for (let i = 0; i < n; i++) {            // exact dot product == cosine on unit vectors
    let s = 0; const o = i * DIM;
    for (let d = 0; d < DIM; d++) s += matrix![o + d] * q[d];
    scored[i] = [ids![i], s];
  }
  scored.sort((a, b) => b[1] - a[1]);
  return scored.slice(0, k).map(([id]) => id);
}

/** Reciprocal-rank fusion. k=60 is the conventional constant. */
export function rrf(lists: number[][], k = 60, limit = 10) {
  const score = new Map<number, number>();
  for (const list of lists)
    list.forEach((id, rank) => score.set(id, (score.get(id) ?? 0) + 1 / (k + rank + 1)));
  return [...score.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([id]) => id);
}

export function hybridSearch(text: string, qvec: Float32Array, limit = 10) {
  const ids = rrf([lexicalSearch(text, 20), vectorSearch(qvec, 20)], 60, limit);
  const rows: any[] = [];
  db.exec({ sql: `SELECT id,section,cfi,text FROM chunks WHERE id IN (${ids.join(',')})`,
            rowMode: 'object', callback: (r) => rows.push(r) });
  const order = new Map(ids.map((id, i) => [id, i]));
  return rows.sort((a, b) => order.get(a.id)! - order.get(b.id)!);
}
```

### 11.6 Persistence, export, and reset

```ts
await navigator.storage?.persist?.();                       // ask once, on first import

// `sqlite3` here is the module-scope handle returned by sqlite3InitModule() in open()
export function exportDb(): Uint8Array {                    // hand the user a real .sqlite
  return sqlite3.capi.sqlite3_js_db_export(db);
}

export async function resetLocalDatabase() {                // escape hatch, see §7 risk 5
  db?.close();
  const root = await navigator.storage.getDirectory();
  await root.removeEntry('study-pool', { recursive: true });
}
```

---

## 12. Confidence and unresolved questions

### High confidence

- **`@sqlite.org/sqlite-wasm` ships FTS5 and cannot load extensions at runtime.** I ran `PRAGMA compile_options` against the published package and executed a real FTS5 `bm25()` query. This is not an inference.
- **`sqlite-vec-wasm-demo@0.1.9` does not initialize.** Reproduced in a worker and on the main thread, with the cause identified in the bundle's own source.
- **`sqlite-vec` in the browser is exact brute-force search with no latency advantage over a JS scan at 1k–10k vectors.** Measured on both, plus confirmed identical result ordering.
- **Worker1/Promiser are deprecated as of 2026-04-15** and the library-in-a-worker pattern is the current recommendation. Stated in the primary docs.
- **`opfs-sahpool` needs no COOP/COEP and does not permit two connections.** Documented, and I reproduced the exact failure.

### Moderate confidence

- **Interrupted indexing is safe, and reload recovery depends on transaction length.** Reproducible in my harness (`integrity_check` → `ok`, clean rollback; 132 ms recovery from a 1.2 s transaction, no recovery from a multi-second one), but only on desktop headless Chromium 141. The specific 10-second lockout duration may vary by Chrome version and platform.
- **Effort estimates (3–5 h for B, 6–9 h for C).** Reasoned from the number of moving parts, not from a stopwatch.
- **The packed-BLOB advantage transfers from IndexedDB to SQLite.** Measured 13× for Dexie; argued by analogy for SQLite BLOBs, where fewer, larger rows means fewer pager operations. I did not measure the SQLite packed variant directly.

### Low confidence / open

- **Pixel 7 performance and OPFS reliability.** Entirely unmeasured. My 1.5–3× CPU estimate is a guess from published core classes, and I have no basis at all for Android OPFS write throughput. **This is the single largest gap and the reason the spike exists.**
- **Does Android Chrome close OPFS access handles when a tab is backgrounded?** PowerSync reports this on Ionic Capacitor; whether it applies to plain Chrome is unknown to me. Drill 10.
- **Memory ceiling on the phone** with a 15 MB vector matrix, the SQLite WASM heap, and a loaded ONNX model resident simultaneously.
- **Retrieval quality difference between FTS5 `bm25` and MiniSearch.** Not measured; they will produce different lists. If quality matters more than latency, this needs its own evaluation.
- **Whether GitHub code search would change the sqlite-vec browser-adoption picture.** I could not query it without authentication. The npm and jsDelivr numbers agree with each other, so I doubt it, but I have not checked.
- **The exact publish date of `sqlite-vec-wasm-demo@0.1.9`.** The registry response was too large for reliable extraction. The version and its contents are confirmed; the date is not.

### The one thing that would change my recommendation

If the Pixel 7 spike shows OPFS is unreliable on your device — handles lost on backgrounding, or a database that will not reopen after a mid-index reload even with batched commits — switch to Option C and accept the three-store consistency work. Nothing in the sqlite-vec evidence would change my recommendation about it; that conclusion rests on the artifacts being broken or stale and offering no measured speedup, and none of those facts depend on your hardware.

---

## 13. Sources

**Primary — SQLite WASM**

- [Persistent Storage Options — sqlite.org/wasm](https://sqlite.org/wasm/doc/trunk/persistence.md) — the `opfs` / `opfs-sahpool` / `opfs-wl` comparison, COOP/COEP requirements, concurrency guidance revised March 2026, Safari <17 incompatibility, WAL notes.
- [Workers and Promises (Worker1 and Promiser) — sqlite.org/wasm](https://sqlite.org/wasm/doc/trunk/api-worker1.md) — the 2026-04-15 deprecation notice.
- [OO API #1 — sqlite.org/wasm](https://sqlite.org/wasm/doc/trunk/api-oo1.md) — `DB`, `OpfsDb`, `exec`, `transaction`, `importDb`.
- [API index — sqlite.org/wasm](https://sqlite.org/wasm/doc/trunk/api-index.md)
- [About the SQLite WASM subproject](https://sqlite.org/wasm/doc/trunk/about.md)
- [sqlite/sqlite-wasm on GitHub](https://github.com/sqlite/sqlite-wasm) and its [README](https://raw.githubusercontent.com/sqlite/sqlite-wasm/main/README.md) — install, worker usage, Vite config, deprecation notice.
- [`@sqlite.org/sqlite-wasm` npm registry metadata](https://registry.npmjs.org/@sqlite.org/sqlite-wasm/latest) — 3.53.0-build1, Apache-2.0.
- [Vec1 vector extension — sqlite.org/vec1](https://sqlite.org/vec1) and the [announcement thread](https://sqlite.org/forum/info/c9d69d74c6644dd19614851e46e2bd29615b922407fdb730529a755e2630d652) (Dan Kennedy, 30 March 2026).
- [SQLite forum: wasm custom builds](https://sqlite.org/forum/info/e57932e3ccdc2c9c) — `barebones=1`, `-Oz`, size reduction.

**Primary — sqlite-vec**

- [sqlite-vec in the Browser with WebAssembly](https://alexgarcia.xyz/sqlite-vec/wasm.html) — static-compilation requirement; the demo-package disclaimer.
- [sqlite-vec documentation home](https://alexgarcia.xyz/sqlite-vec/) — "work-in-progress", 0.1.10-alpha.4.
- [asg017/sqlite-vec on GitHub](https://github.com/asg017/sqlite-vec) — "pre-v1, so expect breaking changes", vector types, dual licence.
- [sqlite-vec releases](https://github.com/asg017/sqlite-vec/releases) — v0.1.9 (31 Mar 2026) through v0.1.10-alpha.4 (18 May 2026).
- [Issue #25 — ANN index tracking](https://github.com/asg017/sqlite-vec/issues/25) — "brute-force search only", open since 21 June 2024.
- [Issue #105 — WASM `oo1.OpfsDb()` memory out of bounds](https://github.com/asg017/sqlite-vec/issues/105) — open, unanswered since 15 September 2024.
- [sqlite-vec on PyPI](https://pypi.org/project/sqlite-vec/) — 0.1.9, 31 March 2026.
- [`sqlite-vec` npm downloads](https://api.npmjs.org/downloads/point/last-month/sqlite-vec) — 7,805,496 (native bindings).
- [`sqlite-vec-wasm-demo` npm downloads](https://api.npmjs.org/downloads/point/last-month/sqlite-vec-wasm-demo) — 1,523.
- [`sqlite-vec-wasm-demo` jsDelivr stats](https://data.jsdelivr.com/v1/stats/packages/npm/sqlite-vec-wasm-demo?period=month) — 358 hits, down from 465.
- [`sqlite-vec-wasm-demo` package metadata](https://registry.npmjs.org/sqlite-vec-wasm-demo/latest) — 0.1.9, 4 files.
- [yangbooom/sqlite-wasm-vec](https://github.com/yangbooom/sqlite-wasm-vec) — the working fork; 0 stars.
- [`sqlite-wasm-vec` registry metadata](https://registry.npmjs.org/sqlite-wasm-vec) — 0.1.11, published 12 October 2025, Apache-2.0.
- [`sqlite-wasm-vec` npm downloads](https://api.npmjs.org/downloads/point/last-month/sqlite-wasm-vec) — 513.

**Primary — browser platform**

- [Storage quotas and eviction criteria — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) — shared quota, all-or-nothing eviction, 60% of disk in Chromium, private-browsing behavior.
- [`FileSystemFileHandle.createSyncAccessHandle()` — MDN](https://developer.mozilla.org/en-US/docs/Web/API/FileSystemFileHandle/createSyncAccessHandle) — dedicated-worker-only, exclusive lock, lock modes, Baseline since March 2023.
- [Intent to Ship: OPFS on Android — blink-dev](https://groups.google.com/a/chromium.org/g/blink-dev/c/GyxqF8ZDK5Q) — shipped in Chrome 107 (2022).
- [emscripten-core/emscripten#24648 — OPFS leaves AccessHandles open when my app crashes](https://github.com/emscripten-core/emscripten/issues/24648) — opened 2 July 2025, unresolved.
- [`all-MiniLM-L6-v2` ONNX file listing — Hugging Face](https://huggingface.co/Xenova/all-MiniLM-L6-v2) — 22,972,370 B quantized.

**Primary — IndexedDB option**

- [MiniSearch API reference](https://lucaong.github.io/minisearch/classes/MiniSearch.MiniSearch.html) — `toJSON` / `loadJSON` / `loadJSONAsync` and the same-options requirement.
- [Dexie design documentation](https://dexie.org/docs/Tutorial/Design) — transactions, rollback, versioning and upgrades.

**Secondary — field experience**

- [The Current State Of SQLite Persistence On The Web: May 2026 Update — PowerSync](https://powersync.com/blog/sqlite-persistence-on-the-web) (published 11 Nov 2025, updated 15 May 2026) — Chrome incognito 100 MB limit, Safari private-mode has no OPFS, SharedWorkers cannot access OPFS, tab-suspension disconnects, Capacitor background handle closure, VFS recommendations.
- [SQLite Wasm in the browser backed by OPFS — Chrome for Developers](https://developer.chrome.com/blog/sqlite-wasm-in-the-browser-backed-by-the-origin-private-file-system) — **cited as an example of stale guidance**; last updated 11 January 2023, teaches the now-deprecated promiser API and the COOP/COEP setup.

**Measurements taken for this report**

All numbers labelled [Measured] were produced in this session on Chromium 141.0.7390.37 (headless, Playwright), Linux x86-64, 2 vCPU / 7 GB RAM, against the actual published npm artifacts. The harness — corpus generator, benchmark worker, lock/reload drill, and static server — is included alongside this report as `spike-harness/` and is directly reusable as the starting point for §10.
