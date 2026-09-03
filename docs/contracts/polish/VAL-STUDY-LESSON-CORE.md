# VAL-STUDY-LESSON-CORE

Surface: Study storage, WebMCP, docked/expanded/mobile Study, and reload.

Needs: native Study blocks, canonical design context, mutation visibility, and SQLite worker ownership.

Behavior: `create_study_lesson` accepts one non-empty title and one to twelve ordered native blocks with unique caller-supplied block IDs. It requires the current design-context version. Optional source claims use the existing exact book/range/quote verification. One call creates exactly one stable lesson ID derived from its action token and persists the title, block order, stable block IDs, provenance, and shared source in one SQLite transaction; an identical retry returns the first result without duplication and a conflicting retry changes nothing. Study renders the result as one semantic titled article, not an action-group feed, with addressable lesson and block DOM IDs. Lessons lead; legacy standalone blocks appear separately as Notes. Expanded desktop gives Study the primary readable measure and compact Study becomes a full surface. A person can return to source and remove the whole lesson. This target does not claim lesson updates, persisted deletion undo, plots, Mermaid, differing per-block sources, or completion of the broader W7 lifecycle contract.

Evidence: request/result protocol rejection tests; repository atomicity and retry tests; genuine WebMCP create/reload trace; semantic DOM and stable-ID assertions; docked, expanded, 390px, and 320px screenshots with computed overflow and control-size checks; deliberate storage fault leaving zero partial lesson records and a visible recoverable error; theme and keyboard inspection. Full W7 remains open against `VAL-STUDY-EXPERIENCE-LIFECYCLE`, `VAL-STUDY-SAFE-REMOVAL`, and `VAL-INTERACTIVE-PLOT`.
