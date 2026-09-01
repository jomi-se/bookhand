# VAL-STORAGE-LOCK: Explicit second-tab ownership and Retry

Surface: browser and data.
Needs: VAL-STORAGE-BACKEND and two-tab orchestration.
Behavior: While one tab owns sahpool, a second tab shows `This library is open in another tab` with Retry, does not spin or fall back to memory, and cannot mutate a shadow library. After the owner closes, Retry acquires persistence and shows the existing library.
Evidence: Synchronized two-tab trace/screenshots plus worker/VFS mode observations before lock, during lock, and after successful Retry.

