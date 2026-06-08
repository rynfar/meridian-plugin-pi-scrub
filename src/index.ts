/**
 * Meridian plugin: strip pi-identifying fingerprints from the system prompt.
 *
 * CONTENT-SCOPED, not adapter-scoped: runs on EVERY adapter and self-scopes by
 * content. `scrubPiFingerprints` only rewrites the prompt when pi's identity
 * fingerprint (e.g. "operating inside pi, a coding agent harness") is actually
 * present, and is otherwise an exact no-op. This matters because pi's prompt can
 * arrive under a NON-pi adapter — Pylon, for instance, routes pi traffic as
 * `adapter=opencode`, so an adapter-scoped `["pi"]` filter would miss it and let
 * the fingerprint reach Claude (which Anthropic meters as agentic/Extra-Usage
 * traffic). Running everywhere + the idempotent regex is safe for genuine
 * Claude Code / OpenCode prompts (no match → unchanged).
 */

import type { Transform, RequestContext } from "./types.js"
import { scrubPiFingerprints } from "./scrub.js"

// Re-export so consumers can import types without needing @rynfar/meridian
// installed. Once meridian 1.38.0+ is released these are structurally
// compatible with its exported types.
export type { Transform, RequestContext } from "./types.js"

const plugin: Transform = {
  name: "pi-scrub",
  version: "0.2.0",
  description: "Strip pi-identifying fingerprints from the system prompt before it reaches Claude (all adapters; content-scoped)",
  // No `adapters` restriction — undefined means all adapters. The scrub is a
  // content-based no-op when no pi fingerprint is present.

  onRequest(ctx: RequestContext): RequestContext {
    if (!ctx.systemContext) return ctx
    const scrubbed = scrubPiFingerprints(ctx.systemContext)
    if (scrubbed === ctx.systemContext) return ctx
    return { ...ctx, systemContext: scrubbed }
  },
}

export default plugin
export { scrubPiFingerprints }
