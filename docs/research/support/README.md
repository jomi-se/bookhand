# Research support artifacts

This directory preserves immutable inputs accompanying time-stamped research.
Runnable, inspectable copies belong under `experiments/`; original archives
remain here so their provenance can be checked independently.

## 2026-09-01 SQLite browser storage spike

- Report: `../2026-09-01-sqlite-wasm-vs-indexeddb-report.md`
- Original harness archive:
  `2026-09-01-sqlite-browser-spike-harness.tar.gz`
- Extracted working copy: `../../../experiments/sqlite-browser-storage-spike/`

The report and archive are exact copies of the artifacts produced by the
external research run. Their SHA-256 digests at import were:

```text
d7341cfea72e865e9fa75918270890d3f3169984d6e1a9f27746d8e6b976a88b  sqlitewasmvsindexeddbreport.md
93ffc09d30502f20a48730c68d93dc4006c919f24d8271613eb45bd11dc01854  spikeharness.tar.gz
```

The measurements were made in desktop Chromium. Pixel 7 performance,
backgrounding, and reload behavior remain unverified; the report's section 10
defines the follow-up drill rather than treating desktop results as phone
evidence.
