# VAL-READER-ENGINE: Use the pinned upstream Foliate reader

Surface: browser and library.
Needs: deterministic EPUB and official upstream source baseline.
Behavior: Bookhand uses `johnfactotum/foliate-js` commit `78914aef4466eb960965702401634c2cb348e9b1` exclusively behind `ReaderAdapter`. Real package metadata, nested navigation, XHTML text, packaged images/captions, and accessible image names render; no viewer DOM, iframe, event, or Foliate object escapes to UI/domain callers.
Evidence: Lockfile/source ref with exact commit; browser comparison with package metadata and a real Chapter X figure/accessible name; adapter boundary tests; source scrutiny proving UI does not access Foliate internals.
Oracle: <https://github.com/johnfactotum/foliate-js/tree/78914aef4466eb960965702401634c2cb348e9b1>.

