# VAL-READER-ADAPTER-CONTRACT: Serializable reader domain boundary

Surface: library.
Needs: VAL-READER-ENGINE and deterministic fixture.
Behavior: Metadata, nested TOC, current location, visible context, exact passage, section list, fresh section text/passage snapshots, and selection are fixture-grounded structured-clone-safe values. No DOM node, Range, Document, iframe, Foliate viewer, or live event crosses the public boundary; stale selection clears after navigation.
Evidence: Deterministic adapter contract suite with fixture comparisons and structured-clone checks; public-type/source scrutiny; stale-selection navigation test.
