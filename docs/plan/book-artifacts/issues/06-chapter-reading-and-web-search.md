# 06 — Chapter-scale reading and web search

Status: needs-triage
Blocked by: none for chapter reading; web search starts with a research spike

## Goal

The tutor can take in a whole chapter and, when allowed, search the web, as the
owner's current NotebookLM routine does.

## Scope

- A WebMCP tool that returns a whole chapter (or a bounded span of chapters) as
  clean text with code listings intact and stable anchors for citation.
- Research spike: whether the Agent Connect gateway and its configured agent
  support web search. Gateway changes belong in the Agent Connect repository.
- Bookhand asks the connection to allow web search and says plainly when it is
  unavailable. Agents link external material directly; no separate references
  feature.

## Done when

An agent answers a question that needs both a whole earlier chapter and a
current web source, citing the chapter passage and linking the web page, on at
least one connection the owner uses.
