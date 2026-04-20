# @rynfar/meridian-plugin-pi-scrub

A [Meridian](https://github.com/rynfar/meridian) plugin that strips pi-coding-agent's identifying fingerprints from the system prompt before it reaches Claude.

## Why

Pi's built-in default prompt opens with `"You are an expert coding assistant operating inside pi, a coding agent harness..."` and includes a multi-line "Pi documentation" block that references pi's SDK, extensions, themes, etc.

When Meridian routes pi → Claude Max with `codeSystemPrompt: true`, those pi-identity sections are:

1. **Redundant** — Claude Code's preset already owns identity, tone, safety, and general tool-use guidance.
2. **A detection fingerprint** — they give Anthropic's detection a clear "this isn't Claude Code" signal that can trigger Extra-Usage billing or rate-limit flags.

This plugin surgically removes those two blocks and replaces the identity paragraph with a neutral, generic coding-assistant framing. Everything else in pi's prompt (tools list, guidelines, date, cwd, any user- or harness-appended content, subagent-specific prompt body, project context, skills block) is preserved verbatim.

The scrub is **idempotent** — running it twice on the same string is a no-op.

## Install

### Option 1: Local clone (recommended for dev)

```bash
git clone https://github.com/rynfar/meridian-plugin-pi-scrub.git ~/repos/meridian-plugin-pi-scrub
cd ~/repos/meridian-plugin-pi-scrub
npm install
npm run build
```

Then point Meridian's plugin config at the built file:

```bash
mkdir -p ~/.config/meridian
cat > ~/.config/meridian/plugins.json <<'JSON'
{
  "plugins": [
    { "path": "/Users/YOU/repos/meridian-plugin-pi-scrub/dist/index.js", "enabled": true }
  ]
}
JSON
```

Restart Meridian (or `curl -X POST http://localhost:3456/plugins/reload`).

Verify at `http://localhost:3456/plugins` — you should see `pi-scrub` listed as **active**.

### Option 2: Drop-in file

If you prefer auto-discovery, symlink or copy `dist/index.js` into `~/.config/meridian/plugins/`:

```bash
ln -s ~/repos/meridian-plugin-pi-scrub/dist/index.js ~/.config/meridian/plugins/pi-scrub.js
```

## Behavior

| Input | Output |
|---|---|
| No system prompt | unchanged |
| System prompt without pi identity markers | unchanged (idempotent) |
| Pi's default system prompt | identity line swapped for generic, Pi docs block removed, spacing normalized |
| Pi prompt + harness/user additions | pi identity stripped, all additions preserved |

The plugin is scoped to `adapters: ["pi"]`, so it has no effect on requests from OpenCode, Crush, Droid, ForgeCode, or the passthrough adapter.

## Development

```bash
npm install
npm run build
```

The built plugin is a single ES module at `dist/index.js` with `dist/index.d.ts` for types.

## License

MIT
