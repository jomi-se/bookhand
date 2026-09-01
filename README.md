# WebMCP Study Reader

Working placeholder name for a local-first ebook reader that becomes an in-page
AI study environment through WebMCP. The repository name is deliberately easy
to replace once the product has a real name.

The first proof of concept will open an EPUB, preserve reading state, highlights
and notes locally, and expose precise reading/study capabilities as WebMCP
tools. An agent can use those capabilities to create explanations, worked
examples, diagrams, animations, mind maps, and formatting changes on an
integrated study board.

## Start

```sh
npm install
npm run dev
```

Run the complete local gate with:

```sh
./scripts/quiet-run.sh "verify" npm run verify
```

The product North Star is [`docs/product-north-star.md`](docs/product-north-star.md).
Agent and MCP setup is documented in [`docs/agent-setup.md`](docs/agent-setup.md).

