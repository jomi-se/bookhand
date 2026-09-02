# VAL-MATH-PASSAGE: Math-faithful exact passage extraction

Surface: reader adapter and browser.
Needs: `VAL-READER-ADAPTER-CONTRACT`, `VAL-READER-SELECTION`, and the Chapter X plus authored MathML/SVG fixtures.
Behavior: Visible, selected, exact-range, and indexed passage serialization preserves ordered prose, inline `data-tex` then `alt` fallbacks, useful figure captions/descriptions, exact start/end CFI, section label, book identity, and fingerprint without duplicating hidden or decorative text.
Evidence: Deterministic DOM serialization cases; adapter range round trip; Chapter X outputs containing expected `dy`, `dx`, and `dy/dx`; authored figure/MathML cases; browser comparison to the rendered source.

