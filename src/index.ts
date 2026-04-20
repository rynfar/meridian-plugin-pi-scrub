/**
 * Meridian plugin: strip pi-identifying fingerprints from the system prompt.
 *
 * Scoped to the `pi` adapter so it's a no-op for other agents. Runs on every
 * pi request — the scrub is idempotent, so even for already-scrubbed inputs
 * (e.g. fork/subagent replays) it produces identical output.
 */

import type { Transform, RequestContext } from "./types.js"
import { scrubPiFingerprints } from "./scrub.js"

// Re-export so consumers can import types without needing @rynfar/meridian
// installed. Once meridian 1.38.0+ is released these are structurally
// compatible with its exported types.
export type { Transform, RequestContext } from "./types.js"

const plugin: Transform = {
  name: "pi-scrub",
  version: "0.1.0",
  description: "Strip pi-identifying fingerprints from the system prompt before it reaches Claude",
  adapters: ["pi"],

  onRequest(ctx: RequestContext): RequestContext {
    if (!ctx.systemContext) return ctx
    const scrubbed = scrubPiFingerprints(ctx.systemContext)
    if (scrubbed === ctx.systemContext) return ctx
    return { ...ctx, systemContext: scrubbed }
  },
}

export default plugin
export { scrubPiFingerprints }
