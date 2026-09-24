import { describe, expect, it } from "bun:test"
import plugin from "../index.js"
import type { RequestContext } from "../types.js"

describe("pi-scrub onRequest", () => {
  it("preserves a foreign adapter's context object and prompt bytes", () => {
    const ctx: RequestContext = {
      adapter: "opencode",
      systemContext: "Foreign prompt.\n\n\nKeep these sections.\n\n",
      metadata: { source: "client" },
    }

    expect(plugin.onRequest?.(ctx)).toBe(ctx)
    expect(ctx.systemContext).toBe("Foreign prompt.\n\n\nKeep these sections.\n\n")
  })

  it("changes a matching prompt while retaining request fields", () => {
    const ctx: RequestContext = {
      adapter: "pi",
      systemContext: "You are an expert coding assistant operating inside pi, a coding agent harness. Keep working.\n\n\nUser guidance.\n\n",
      metadata: { source: "client" },
      messages: [{ role: "user", content: "Help" }],
    }

    const result = plugin.onRequest?.(ctx)
    expect(result).not.toBe(ctx)
    expect(result?.systemContext).toStartWith("You are an expert coding assistant.")
    expect(result?.systemContext).toContain("User guidance.")
    expect(result?.systemContext).not.toContain("\n\n\n")
    expect(result?.metadata).toBe(ctx.metadata)
    expect(result?.messages).toBe(ctx.messages)
  })
})
