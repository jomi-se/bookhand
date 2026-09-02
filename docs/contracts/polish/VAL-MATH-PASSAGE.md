# VAL-MATH-PASSAGE: Math-faithful exact passage extraction

Surface: reader adapter and browser.
Needs: `VAL-READER-ADAPTER-CONTRACT`, `VAL-READER-SELECTION`, and the Chapter X plus authored MathML/SVG fixtures.
Behavior: Visible, selected, exact-range, and indexed passage serialization preserves ordered prose, inline `data-tex`, MathML `alttext`, TeX annotations and `aria-label`, image alternatives, useful SVG title/description and figure captions, exact start/end CFI, section label, book identity, and fingerprint without duplicating hidden or decorative text. Image-only visible context is not treated as empty.
Evidence: Deterministic DOM serialization cases; real adapter range round trips for figure-only and mixed-math ranges; Chapter X outputs containing expected `dy`, `dx`, and `dy/dx`; Chapter XIX Fig. 52 output containing `AB`, `x`, `P`, `Q`, `OM=x_1`, `PM=y_1`, description, and caption; authored figure/MathML cases; browser comparison to the rendered source.
