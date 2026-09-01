# VAL-READER-SECTION-ERROR: Recover from section load failure

Surface: browser.
Needs: VAL-READER-OPEN and test-only section-failure injection.
Behavior: A forced section failure keeps the last safe reader/library surface, names the failed chapter, and offers Retry and Back to library. Removing the injected fault and choosing Retry loads the requested real section without duplicate viewer state.
Evidence: Browser trace and screenshots before failure, failure, successful Retry, and return; console and adapter-state observations.

