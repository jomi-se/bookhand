# VAL-RE003-GROUNDING: Reader and WebMCP use the visible section

Surface: browser.
Needs: VAL-RE003-WINDOW.
Behavior: after natural scrolling and direct navigation, location, `get_reading_context`, `get_passage`, saved annotations, links, TOC/search destinations, and publisher-original/rewritten views resolve against the section actually visible to the reader.
Evidence: genuine WebMCP context-to-passage round trips, a saved visible-range annotation, navigation checks, and remaster switching after crossing a section boundary.
