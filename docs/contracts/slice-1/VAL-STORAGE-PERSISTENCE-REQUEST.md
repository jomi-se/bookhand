# VAL-STORAGE-PERSISTENCE-REQUEST: Request durable origin storage honestly

Surface: browser and data.
Needs: VAL-LIBRARY-IMPORT and VAL-STORAGE-ROUNDTRIP.
Behavior: After the first successfully persisted user import and within the user-activated flow, Bookhand requests origin storage persistence once. Granted and denied results neither corrupt nor duplicate the import, and the UI never claims persistence was granted when it was denied.
Evidence: Browser API call/result instrumentation and database/library state for granted and denied paths; repeat-import trace proving the request is not spammed.

