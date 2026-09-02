# ADR 0004: Canonical source excerpts and non-destructive deduplication

Date: 2026-09-02
Status: accepted

## Context

EPUB extraction can improve after a highlight or study block has been stored.
Keeping only flattened display text makes old mathematical and figure meaning
impossible to distinguish from authored text, while storing raw XHTML would
create a durable untrusted-rendering surface.

Annotations and quotation blocks can also point to the same passage. They may
look redundant, but they have different learner intent and deleting either one
silently would destroy user-owned structure.

## Decision

Source-linked records may store a bounded, versioned `SourceExcerpt`: book
identity, exact range, extraction version, canonical accessible text and
fingerprint, ordered text/math/figure segments, and chapter breadcrumb. Raw
EPUB markup is not part of the model.

Derived quotation text is refreshed from the canonical excerpt. Authored text
is linked to the excerpt but never rewritten by source repair. Legacy records
repair lazily while their book is mounted; an unresolved range preserves its
display text and becomes stale with Retry and Relink actions.

Identical annotation and quotation records remain separate durable records.
The later cohesive Study model may relate them by shared source identity and
offer an explicit merge or reference conversion, but it must not automatically
delete, collapse, or rewrite either record. Presentation may avoid repeating
the same full passage by rendering annotations as a compact index/reference.

W5 must derive its lexical-index extraction version from the canonical source
extraction version. A change must rebuild indexed chunks rather than mixing two
interpretations of book content; W5 owns implementing and proving that rule.

## Consequences

- Existing databases receive additive nullable source columns; migration does
  not guess at source text.
- Repair is a dedicated storage operation, not a learner edit, item revision,
  or action receipt.
- Stale records remain useful and recoverable.
- Deduplication is explicit and non-destructive; W7/W8 own its cohesive lesson
  relationship and presentation.
