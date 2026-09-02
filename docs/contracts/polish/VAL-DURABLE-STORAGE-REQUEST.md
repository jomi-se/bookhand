# VAL-DURABLE-STORAGE-REQUEST: Real import requests durable storage once

Surface: browser.
Needs: `VAL-LIBRARY-IMPORT`, secure origin, and resettable test storage. Supersedes and repairs `VAL-STORAGE-PERSISTENCE-REQUEST` for the real post-Slice 3 import path.
Behavior: The first user-initiated successful import calls `navigator.storage.persist()` once, records the result, never prompts during passive bootstrap, and does not repeat after a recorded attempt; denial or unavailable API leaves import usable and storage status truthful.
Evidence: Real picker/import flow with API spy for granted, denied, and unavailable cases; reload and second-import trace; persisted attempt record and visible storage status.
