# VAL-TUTOR-PRESENTATION-SAFETY: Temporary explanations stay small and inert

Surface: tutor command schema, native overlay/callout renderer, genuine WebMCP, and browser.
Needs: `VAL-TUTOR-PASSAGE-FOCUS`.
Behavior: `present_explanation` attaches one optional temporary explanation to the active verified source cue. Version zero requires non-empty plain text of at most 2,000 UTF-16 code units. If temporary math ships, it must reuse the strict validated display renderer from `VAL-STUDY-MATH-RENDERING`; math is not required for this target. The call accepts no HTML, Markdown links, URLs, CSS, JavaScript, iframe, image, Mermaid, plot, or resource reference. New presentation supersedes the old one, Stop removes it, and reload leaves no trace. Rich diagrams and interaction require an explicitly durable study lesson.
Evidence: Valid text calls; conditional math evidence if shipped; hostile and oversized corpus; CSP/network/storage traces; supersession, Stop, reload, accessibility, mobile placement, and no-active-cue rejection.
