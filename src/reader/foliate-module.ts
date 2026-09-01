import type { FoliateModule, FoliateOverlayer } from './foliate-types.ts'

// Upstream intentionally ships browser-native JavaScript without TypeScript
// declarations. Keep the untyped imports confined to this adapter module.
// @ts-expect-error foliate-js does not publish declaration files
import { makeBook as upstreamMakeBook } from 'foliate-js/view.js'
// @ts-expect-error foliate-js does not publish declaration files
import { Overlayer as upstreamOverlayer } from 'foliate-js/overlayer.js'

export const makeBook = upstreamMakeBook as FoliateModule['makeBook']
export const Overlayer = upstreamOverlayer as FoliateOverlayer
