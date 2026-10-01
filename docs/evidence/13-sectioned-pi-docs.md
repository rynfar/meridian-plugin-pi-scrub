# Sectioned Pi documentation regression

Issue #13, baseline main `23c98fac6c2a188ec2ab46c52942677b918d65f5` and
published scrub 0.2.2. Pi 0.87.1's canonical package is now
`@earendil-works/pi-coding-agent`; the old @mariozechner package namespace does
not publish that version. Installed the exact package and inspected its real
section renderer and extension contract.

Disposition: accept the internal transformation correction. The old legacy
pattern stops at a blank line, leaving later documentation and the closing tag.
Two new direct tests fail on unchanged source (15 pass / 2 fail). First remove
a complete <docs> section only when its leading content is the Pi documentation
header, then retain legacy matching. Corrected suite: 17 pass / 0 fail, including
idempotence, adjacent foreign docs, project context, tools and date/cwd.
No exported contract, adapter restriction or version metadata changed.

## Retained headless affected-client proof

```sh
npm run build
npm pack --pack-destination <disposable-output>
npm install --prefix <fresh-install> --ignore-scripts <produced-tarball>
E2E_MERIDIAN_ROOT=<built-Meridian-checkout> \
E2E_PI_CLI=<isolated-client>/node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js \
E2E_PLUGIN_PATH=<installed-scrub>/node_modules/@rynfar/meridian-plugin-pi-scrub/dist/index.js \
node scripts/e2e-pi-sectioned-docs.mjs
```

For the before control use independently registry-installed scrub 0.2.2 and
`E2E_EXPECT_LEAK=1`. The extension inserts one blank line into actual Pi-built
documentation; it does not replace the native client with a handcrafted HTTP
request. Actual project AGENTS.md supplies a synthetic instruction marker.
Each probe uses isolated client/proxy/session directories, no user config edits,
a fixed model and private logs. Only sanitized assertion outcomes are retained.

Actual client: Pi 0.87.1; model: Opus 5.5; Agent SDK 0.2.141;
Claude Code 2.1.284; built Meridian tree validated and merged in #1204;
Node 22.22.3, macOS arm64. Observed adapter=opencode for this Pi custom-provider
flow; the plugin's established content scope applies correctly on that adapter.

Before: real request contains Pi docs. After published scrub, later docs and
closing tag remain and project context remains. The client observed billing_error
and no successful tool execution. This confirms the transformation failure;
it does not establish universal billing causation or promise a billing remedy.

After independently installed fixed tarball: no opening/closing docs tags or
additional docs reach the SDK request boundary; project instructions remain on
every request. First turn: exit 0, one actual tool execution, two assistant
messages, zero errors. A random receipt known only to the client's file reaches
Meridian in a real tool-result message. Continued turn using the same Pi session
file: exit 0, one assistant message, zero errors. All three observed requests
have preserved project context and no documentation leftovers. Gate exits 0.

Build, standalone TypeScript check and pack dry run pass. Final exact-head CI
and merged behavior are recorded in the PR before closing #13. No package
publication is authorized; tarball verification is a local install proof.
