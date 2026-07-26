import { describe, it, expect } from "bun:test"
import { scrubPiFingerprints } from "../scrub.js"

/**
 * Fixtures mirror buildSystemPrompt() in pi-coding-agent
 * packages/coding-agent/src/core/system-prompt.ts (verified against 0.80.6):
 * identity line, tools, guidelines, "Pi documentation" block, optional
 * <project_context>, then `\nCurrent date: ...\nCurrent working directory: ...`
 * appended with SINGLE newlines.
 */

const IDENTITY =
  "You are an expert coding assistant operating inside pi, a coding agent harness. You help users by reading files, executing commands, editing code, and writing new files.\n"

const BODY = `
Available tools:
- read: Read files
- bash: Execute commands

In addition to the tools above, you may have access to other custom tools depending on the project.

Guidelines:
- Be concise in your responses
- Show file paths clearly when working with files

`

const DOCS_BLOCK = `Pi documentation (read only when the user asks about pi itself, its SDK, extensions, themes, skills, or TUI):
- Main documentation: /home/user/.pi/node_modules/@earendil-works/pi-coding-agent/README.md
- Additional docs: /home/user/.pi/node_modules/@earendil-works/pi-coding-agent/docs
- Examples: /home/user/.pi/node_modules/@earendil-works/pi-coding-agent/examples (extensions, custom tools, SDK)
- When reading pi docs or examples, resolve docs/... under Additional docs and examples/... under Examples, not the current working directory
- When asked about: extensions (docs/extensions.md, examples/extensions/), themes (docs/themes.md), skills (docs/skills.md), prompt templates (docs/prompt-templates.md), TUI components (docs/tui.md), keybindings (docs/keybindings.md), SDK integrations (docs/sdk.md), custom providers (docs/custom-provider.md), adding models (docs/models.md), pi packages (docs/packages.md)
- When working on pi topics, read the docs and examples, and follow .md cross-references before implementing
- Always read pi .md files completely and follow links to related docs (e.g., tui.md for TUI API details)`

const PROJECT_CONTEXT = `

<project_context>

Project-specific instructions and guidelines:

<project_instructions path="/repo/AGENTS.md">
Follow the house style.
</project_instructions>

</project_context>
`

const TAIL = "\nCurrent date: 7/10/2026\nCurrent working directory: /repo"

/** No context files, no skills — docs block runs straight into the tail. */
const MINIMAL_PROMPT = IDENTITY + BODY + DOCS_BLOCK + TAIL

/** Common case — <project_context> (which starts with \n\n) follows the docs block. */
const FULL_PROMPT = IDENTITY + BODY + DOCS_BLOCK + PROJECT_CONTEXT + TAIL

describe("scrubPiFingerprints", () => {
  it("replaces the pi identity line with the generic one", () => {
    const out = scrubPiFingerprints(FULL_PROMPT)
    expect(out).not.toContain("operating inside pi, a coding agent harness")
    expect(out).toContain("You are an expert coding assistant.")
  })

  it("removes the Pi documentation block", () => {
    const out = scrubPiFingerprints(FULL_PROMPT)
    expect(out).not.toContain("Pi documentation")
    expect(out).not.toContain("pi-coding-agent")
  })

  it("preserves project context, guidelines, and tools", () => {
    const out = scrubPiFingerprints(FULL_PROMPT)
    expect(out).toContain("<project_context>")
    expect(out).toContain("Follow the house style.")
    expect(out).toContain("Be concise in your responses")
    expect(out).toContain("Available tools:")
  })

  it("preserves the date and cwd lines when nothing follows the docs block", () => {
    // Regression: with no context files/skills, the docs-block regex used to
    // fall through to $ and swallow the single-newline-separated tail.
    const out = scrubPiFingerprints(MINIMAL_PROMPT)
    expect(out).toContain("Current date: 7/10/2026")
    expect(out).toContain("Current working directory: /repo")
    expect(out).not.toContain("Pi documentation")
  })

  it("preserves the date and cwd lines in the common case too", () => {
    const out = scrubPiFingerprints(FULL_PROMPT)
    expect(out).toContain("Current date: 7/10/2026")
    expect(out).toContain("Current working directory: /repo")
  })

  it("is a no-op on prompts without pi fingerprints", () => {
    const clean = "You are Claude Code, Anthropic's official CLI for Claude.\n\nDo things well."
    expect(scrubPiFingerprints(clean)).toBe(clean)
  })

  // index.ts registers this plugin for every adapter, so a prompt with no pi
  // fingerprint must come back byte-identical. The fixture above happens to
  // contain neither a 3+ newline run nor trailing whitespace, so it could not
  // catch the unconditional cleanup passes.
  it("is a no-op on a foreign prompt containing runs of 3+ newlines", () => {
    const clean = "You are a helpful assistant.\n\n\n## Section\n\n\n\nBody text."
    expect(scrubPiFingerprints(clean)).toBe(clean)
  })

  it("is a no-op on a foreign prompt with trailing whitespace", () => {
    const clean = "You are a helpful assistant.\n\nBody text.\n\n"
    expect(scrubPiFingerprints(clean)).toBe(clean)
  })

  it("still normalizes whitespace when a pi fingerprint was removed", () => {
    // The cleanup passes exist to repair the gaps the removals leave behind,
    // so they must keep running whenever a removal actually happened.
    const out = scrubPiFingerprints(FULL_PROMPT)
    expect(out).not.toContain("\n\n\n")
    expect(out).not.toMatch(/\s$/)
    expect(out).not.toContain("operating inside pi")
  })

  it("is idempotent", () => {
    const once = scrubPiFingerprints(FULL_PROMPT)
    expect(scrubPiFingerprints(once)).toBe(once)
    const onceMinimal = scrubPiFingerprints(MINIMAL_PROMPT)
    expect(scrubPiFingerprints(onceMinimal)).toBe(onceMinimal)
  })

  it("returns empty input unchanged", () => {
    expect(scrubPiFingerprints("")).toBe("")
  })
})
