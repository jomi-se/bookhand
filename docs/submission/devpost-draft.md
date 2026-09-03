# Devpost Submission

## Tagline
A hackable EPUB reader through WebMCP tools

## Short summary (Devpost "elevator pitch", ~180 characters)
Without WebMCP, Bookhand is an EPUB reader. With WebMCP, agents turn books into living study environments: finding context and building cited explanations, lessons and even fixing broken formatting.

---

## Inspiration

Using AI agents as helpers with technical books is awesome, but what if we could bring the agents into the book reader?

**What happens if the ebook reader itself tells the agent what it can do through native browser semantics?** Not scraping the DOM or clicking around like a blind monkey in Playwright, but genuine, typed WebMCP capabilities (`document.modelContext`). The agent spends its intelligence on actual teaching and assistance instead of reverse-engineering the browser.

But once you got an AI agent with direct access to your app, all kinds fo doors open. For example, **legacy ebooks look like crap.** In most technical public-domain EPUBs, every single mathematical variable ($x, y, dy/dx$) is a mess, You can't search it, you can't select it, and in dark mode it turns invisible. Instead of waiting 10 years for publishers to fix it, why not let an agent act like a coding harness, read the raw chapter XHTML, and rewrite it into native MathML?

Bookhand gives agents tools to do this

---

## What it does

* **A real reader first (100% local-first):**  
  No login, no cloud, no tracking. Your books, annotations, study boards, and search index live in an official SQLite database compiled to WASM and persisted directly to your browser's Origin Private File System (OPFS). If your Wi-Fi dies or you turn off AI, it’s still a fast, ~gorgeous~ mediocre EPUB reader.

* **21 Native WebMCP Capabilities:**  
  When opened in a compatible browser (like Chromium with WebMCP or ChatGPT Desktop), Bookhand exposes 21 distinct tools directly to the model: navigation, search, styling, passage focus, study cards, and document remastering.

* **The Book Fact-Checks the Agent:**  
  If an agent tries to save a highlight, quote, or study block, Bookhand resolves the exact CFI range, takes a SHA-256 text fingerprint, and compares the quote. If the agent hallucinates even a single word or references the wrong book, **the write is rejected and nothing touches storage.**. A small thing to keep agents from hallucinating quotes.

* **Surgical Document Remastering (The Coding Harness for Books):**  
  The agent doesn't just slap a CSS theme on top of broken markup. It can call `get_section_source` to read the raw XHTML, and use `edit_section` to apply atomic search-and-replace patches—transcompiling blurry formula images into native, scalable MathML.


* **Study surface:**  
  The agent can use tools to highlight passages, take notes, write small lessons, or even small quizes that get stored for future reference. 

---

## How I built it

React 19, TypeScript, and Vite. No backend.

* **Reader Engine:** Upstream `foliate-js` pinned to a commit.
* **Storage & Search:** Official `@sqlite.org/sqlite-wasm` running in a dedicated Web Worker on `opfs-sahpool`. Lexical search uses SQLite’s native **FTS5** with BM25 ranking
* **Agent Surface:** Genuine `document.modelContext`. Because the current Chromium runtime treats input schemas as hints rather than enforcing them, every handler independently validates its input and returns structured success and failure content.
* **Security & Containment:** Hardened Content Security Policy (CSP) and regex sanitizers strip scripts, event handlers, and remote tracking `url()` calls from untrusted EPUBs. Untrusted book content is isolated before reaching the agent.
* **Deployment:** Cloudflare Workers.

---

## Challenges I ran into

* **WebMCP in a test browser:** Getting a real `document.modelContext` under Playwright required the exact feature flag (`--enable-features=WebMCPTesting`) on a secure origin and doesn't act exactly like something like ChatGPTs in-app browser.
* **Quote verification normalization:** Finding the exact boundary for quote comparison (Unicode NFC, normalizing CRLF to LF, collapsing whitespace runs, and trimming) while keeping case, punctuation, and math symbols strictly significant.
* **The Invisible Calculus Bug:** In *Calculus Made Easy*, formulas were black-on-transparent PNGs. In dark mode, all the math completely vanished. Fixing this cleanly required transcompiling equations into real MathML instead of relying on fragile CSS inversion hacks.
* **Android Iframe Text Inflation:** Chrome on Android silently inflates text inside iframes without a viewport tag, which threw off Foliate's multi-column pagination math. Finnicky stuff

---

## Accomplishments I'm proud of

* **The Refusal:** An LLM can be confidently wrong about what a book says; Bookhand settles it against the actual text and refuses to write hallucinations to your storage.
* **The Coding-Harness Remaster:** Giving the model a genuine Read and Edit tool for XHTML, letting it transcompile broken legacy books into native MathML, and actually semantic HTML feels like the future.
* **Genuinely Local-First:** SQLite WASM over OPFS with zero accounts, zero telemetry, and zero servers.

---

## What I learned

* Publishing *capabilities* is totally different from publishing an API. The schema is easy; the hard part is describing effects, reversibility, and boundaries so clearly that an agent composes coherently on its first try.
* Let models **cook**. Read and edit can go a very long way for an agent to fix an EPUB.

---

## What's next

* **Embodied tutor presentation:** Anchored plain-text explanations beside transient source cues.
* **First-class study lessons:** Titled, organized, easy to follow lessons flows.
* **Local embeddings:** Implement vector search for even better agentic results

---

## Built with

`react` · `typescript` · `vite` · `webmcp` · `document.modelContext` · `foliate-js` · `epub` · `sqlite-wasm` · `opfs` · `fts5` · `web-workers` · `cloudflare-workers` · `playwright` · `vitest` · `local-first`

---

## Links

* **Live demo:** <https://bookhand.dev/>
* **Repo:** <https://github.com/jomi-se/bookhand>
* **Demo:** `<>`
