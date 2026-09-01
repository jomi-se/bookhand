# Spike harness — SQLite WASM vs IndexedDB for local ebook retrieval

Everything here was used to produce the [Measured] numbers in the report.
No build step; plain ES modules served by a 15-line static server.

## Layout

    pub/data.js      seeded corpus + normalized 384-d Float32 vector generator
    pub/worker.js    the benchmark. Variants:
                       'B'  official @sqlite.org/sqlite-wasm + FTS5 + BLOB vectors + JS cosine
                       'A'  sqlite-vec-wasm-demo   (fails to initialize — kept as evidence)
                       'A2' sqlite-wasm-vec fork   (SQLite 3.51 + sqlite-vec 0.1.7-alpha.2)
                       'C'  Dexie + MiniSearch + typed-array vectors + JS cosine
    pub/index.html   exposes window.runBench(kind, N, phase)
    pub/serve.js     static server; 4th arg 'coop' adds COOP/COEP headers
    pub/lockw2.js    multi-tab / reload-during-write drill worker
    pub/lock2.html   drill page
    run.mjs          main benchmark driver (Playwright)
    runlock4.mjs     reload-recovery drill driver
    results.json     measured output, variants B and C
    resultsA2.json   measured output, variant A2

## Setup

    npm init -y
    npm install @sqlite.org/sqlite-wasm sqlite-vec-wasm-demo sqlite-wasm-vec \
                minisearch dexie
    npm install -D playwright

    mkdir -p pub/vendor/official pub/vendor/vec pub/vendor/vec2 pub/vendor/lib
    cp node_modules/@sqlite.org/sqlite-wasm/dist/*                 pub/vendor/official/
    cp node_modules/sqlite-vec-wasm-demo/sqlite3.{mjs,wasm}        pub/vendor/vec/
    cp node_modules/sqlite-wasm-vec/sqlite-wasm/jswasm/sqlite3.{mjs,wasm} \
       node_modules/sqlite-wasm-vec/sqlite-wasm/jswasm/sqlite3-opfs-async-proxy.js \
                                                                   pub/vendor/vec2/
    cp -r node_modules/minisearch/dist/es                          pub/vendor/lib/minisearch
    cp node_modules/dexie/dist/modern/dexie.mjs                    pub/vendor/lib/

## Run

    node run.mjs        # benchmark: B, A, C at N = 2000 and 10000, build + reopen
    node runlock4.mjs   # drills: reload while idle / during a short txn / during a long txn

Set `executablePath` in the driver scripts if Playwright's bundled Chromium
is not where it expects.

## Adapting it for the Pixel 7 (report §10)

`pub/index.html` is the only page you need on the phone. Add three buttons that
call `window.runBench('B'|'C', N, 'build'|'reopen')` and print the returned JSON
into the DOM. Serve it over HTTPS or a trusted origin — OPFS needs a secure
context. Then run the three failure drills by hand: reload mid-index, background
the tab for 30 s during indexing, and open a second tab.
