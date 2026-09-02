# VAL-STUDY-MATH-RENDERING: Safe accessible mathematical study content

Surface: study domain parser, native renderer, and browser.
Needs: `VAL-STUDY-SCHEMA-SECURITY` and semantic theme roles.
Behavior: Equation blocks explicitly declare `tex` or `plain`; strict trust-disabled TeX renders centered display math with readable spacing, a secondary caption, and accessible source text. Unsupported, malformed, oversized, URL-bearing, HTML-bearing, or dangerous input cannot execute or fetch resources and produces a visible bounded plain-text fallback instead of an empty or broken card. Light, sepia, dark, publisher, and safe custom themes remain legible; reduced motion changes no meaning.
Evidence: Accepted calculus fixtures plus malformed and hostile corpus; accessibility-tree and screenshot evidence under every shipped theme and mobile/desktop widths; CSP/network trace; fallback text and error semantics; renderer/source scan excluding trust-enabled HTML paths.
