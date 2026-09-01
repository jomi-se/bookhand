import type { FoliateModule } from './foliate-types.ts'

// Upstream intentionally ships browser-native JavaScript without TypeScript
// declarations. Keep the one untyped import confined to this adapter module.
// @ts-expect-error foliate-js does not publish declaration files
import { makeBook as upstreamMakeBook } from 'foliate-js/view.js'

export const makeBook = upstreamMakeBook as FoliateModule['makeBook']

