/**
 * Scrub pi-coding-agent's identifying fingerprints from a system prompt.
 *
 * Pi's built-in default prompt opens with a self-identifying line
 * ("You are an expert coding assistant operating inside pi...") and includes
 * a large "Pi documentation" block referencing pi's SDK, extensions, themes,
 * skills, TUI, etc. When the request also carries Claude Code's preset (added
 * by meridian when routing pi → Claude Max), those pi-identity sections are:
 *
 *   1. Redundant — Claude Code's preset already owns identity, tone, safety.
 *   2. A fingerprint Anthropic detection can use to flag pi traffic for
 *      Extra-Usage billing or rate-limit decisions.
 *
 * This removes those two blocks and replaces the identity paragraph with a
 * neutral, generic coding-assistant framing. All other parts of pi's prompt
 * (tools list, guidelines, date, cwd, any user or harness-appended additions)
 * are preserved verbatim.
 *
 * The scrub is idempotent — running it twice on the same string is a no-op.
 * That's important because the plugin may run multiple times across forks,
 * subagents, or reload cycles.
 */

/**
 * Pi's hard-coded opening identity paragraph. The exact text comes from
 * pi-coding-agent/dist/core/system-prompt.js `buildSystemPrompt` when no
 * customPrompt is provided.
 */
const PI_IDENTITY_LINE =
  /You are an expert coding assistant operating inside pi, a coding agent harness\.[^\n]*\n+/

/**
 * Pi's "Pi documentation" block. Starts with the header line and runs until
 * the next double-newline (section boundary) or end of string. Matches the
 * ~10-line block referencing pi SDK / extensions / themes / skills / TUI /
 * keybindings / prompt-templates / custom-provider / models / packages.
 */
const PI_DOCS_BLOCK = /Pi documentation \(read only when[\s\S]*?(?=\n\n|$)/

/**
 * Anthropic-preset-style `<env>` block + its preamble. Claude Code's preset
 * already injects this verbatim on the upstream side. If pi (or any harness
 * sitting above pi) appends another copy of the same text, Anthropic's
 * billing layer reads the duplicated preamble as a third-party-impersonation
 * signal and gates opus behind Extra Usage. The opencode-scrub plugin strips
 * the same block for the same reason; mirroring it here keeps pi flows safe
 * even if pi's prompt picks up the pattern in a future version.
 *
 * Defensive: pi as of today does not emit this exact preamble, so the regex
 * is a no-op on current pi prompts. Cheap insurance.
 */
const DUPLICATE_ENV_PREAMBLE_BLOCK =
  /\nHere is some useful information about the environment you are running in:\n<env>[\s\S]*?<\/env>\n/

/**
 * Replacement for the stripped identity line. Generic enough to work with any
 * provider (Anthropic's Claude Code preset covers identity upstream; for non-
 * Anthropic providers this line becomes the primary identity framing).
 */
const GENERIC_IDENTITY =
  "You are an expert coding assistant. You help users by reading files, executing commands, editing code, and writing new files.\n"

/**
 * Remove pi-identifying content from a system prompt string.
 *
 * - Replaces pi's opening identity paragraph with a generic one
 * - Removes the entire "Pi documentation" block
 * - Collapses runs of 3+ newlines to 2 so section spacing stays normal
 * - Trims trailing whitespace-only lines
 *
 * Preserves: tools list, guidelines, date/cwd, pylon/user-appended content,
 * subagent-specific prompt body, project context files, skills block.
 *
 * Idempotent — calling this on already-scrubbed input produces identical
 * output (the regexes no longer match once scrubbed).
 */
export function scrubPiFingerprints(systemPrompt: string): string {
  if (!systemPrompt) return systemPrompt
  return systemPrompt
    .replace(PI_IDENTITY_LINE, GENERIC_IDENTITY)
    .replace(PI_DOCS_BLOCK, "")
    .replace(DUPLICATE_ENV_PREAMBLE_BLOCK, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s+$/, "")
}
