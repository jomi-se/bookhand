# VAL-DEVICE-PIXEL7: Complete physical Android reader flow

Surface: browser.
Needs: VAL-LIBRARY-IMPORT, VAL-READER-SHELL, VAL-READER-NAV, VAL-READER-SELECTION, VAL-READER-STYLE, VAL-READER-RESTORE, VAL-STUDY-SHELL, VAL-READER-ACCESSIBILITY, VAL-STORAGE-BACKEND, VAL-STORAGE-ROUNDTRIP, an HTTPS phone-accessible build, and the preserved storage-spike harness.
Behavior: On a physical Pixel 7 Chrome, a person enters Library, imports the deterministic EPUB with Android's file picker, verifies persistent `opfs-sahpool` mode, opens the bundled book, uses nested TOC and previous/next, opens/closes Text and Study, changes style, selects text, reloads and checksum-reopens the imported book, backgrounds for 30 seconds, resumes, and returns without lost source location, dead controls, clipped UI, database failure, or horizontal overflow.
Evidence: Device and Chrome versions; recording/screenshots; console capture where available; imported-byte checksum, source-location, and database-mode observations before/after reload and background/resume; physical-device output from the preserved storage-spike drills.
Fail: Device emulation does not satisfy this assertion; the Slice 1 completion gate remains blocked until physical evidence exists.
