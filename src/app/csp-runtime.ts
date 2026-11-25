import { config } from 'zod/v4/core'

// Configure the shared Zod runtime before the bundled ACP schemas initialize.
// The browser CSP blocks dynamic code generation, including Zod's eval probe.
config({ jitless: true })
