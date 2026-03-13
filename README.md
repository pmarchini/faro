# Faro

Faro is a VS Code extension for turning agent reasoning about a codebase into persistent, navigable code landmarks.

This repository currently contains a working local MVP of the extension:

- a canonical Faro document model
- validation and path navigation logic
- an in-memory store
- pure app-layer projections for outline and navigator views
- real VS Code host bindings for outline, navigator, commands, and editor reveal
- an agent-facing Faro service plus MCP tools/resources
- local stdio MCP server registration through the VS Code MCP provider API
- a verified protocol-level authoring loop from the registered Faro MCP server into the sidebar state
- `node:test` coverage and a real TypeScript check

## Prerequisites

- Node.js 23.x or newer
- npm
- VS Code 1.109 or newer

This project currently relies on Node's native TypeScript type stripping for local execution and tests.

## Install

```sh
npm install
```

## Validate

Run the TypeScript check:

```sh
npm run check
```

Run the test suite:

```sh
npm test
```

Or run both with `make` targets:

```sh
make check
make test
```

Watch mode for tests:

```sh
npm run test:watch
```

## Open In VS Code

Open the repository root in VS Code:

```sh
code .
```

## Install Into Your VS Code

Package the extension as a local VSIX:

```sh
make package-vsix
```

Install that VSIX into your normal VS Code profile:

```sh
make install-local
```

This writes [dist/faro.vsix](/Users/pietro.marchini/Projects/OSS/faro/dist/faro.vsix) and installs it with `code --install-extension --force`.

## Upsert Agent Instructions

Upsert the Faro instruction artifacts for Claude Code, GitHub Copilot, VS Code Copilot custom agents, and Codex:

```sh
make upsert-agent-instructions
```

That command uses [AGENTS.md](./AGENTS.md) and [skills/faro-author-paths/SKILL.md](./skills/faro-author-paths/SKILL.md) as the source of truth and upserts:

- `CLAUDE.md`
- `.github/copilot-instructions.md`
- `.github/agents/faro-path-author.agent.md`
- `${CODEX_HOME:-$HOME/.codex}/skills/faro-author-paths/SKILL.md`

If you only want the VS Code Copilot custom agent file:

```sh
make upsert-copilot-agent
```

That writes `.github/agents/faro-path-author.agent.md`.

## Use The Faro Copilot Agent In VS Code

After running `make upsert-copilot-agent` or `make upsert-agent-instructions`:

1. Open the repository in VS Code.
2. Open the Chat view.
3. Choose the `Faro Path Author` custom agent from the agent picker.
4. Ensure the local `Faro` MCP server is enabled for the workspace.

If the agent picker does not show the new custom agent immediately, run `Developer: Reload Window` once.

The custom agent definition is generated from the same [AGENTS.md](./AGENTS.md) and [skills/faro-author-paths/SKILL.md](./skills/faro-author-paths/SKILL.md) sources that drive the other instruction artifacts, so the Copilot agent stays aligned with the Faro authoring rules.

## Test The Extension In VS Code

The extension can be tried locally in an Extension Development Host on macOS or Linux.

```sh
make dev-host
```

That target will:

1. open [faro-dev.code-workspace](/Users/pietro.marchini/Projects/OSS/faro/faro-dev.code-workspace) in a new Extension Development Host window
2. load the extension from this repository with `--extensionDevelopmentPath`
3. enable `faro.autoFocusOnStartup` through the dev workspace settings
4. let the extension focus the `Faro` activity bar container on startup

Current expectation:

- the `Faro` activity bar container is visible
- `Outline` shows the seeded sample path
- `Navigator` shows the current beacon
- `Prev` / `Next` updates the current beacon in the sidebar
- `Reveal` opens seeded sample beacons in the local repository

If you want to launch the host manually instead of using the workspace shortcut:

```sh
code --new-window --extensionDevelopmentPath="$(pwd)" "$(pwd)"
```

Then either:

- run `Faro: Focus Sidebar` manually from the Command Palette
- or open [faro-dev.code-workspace](/Users/pietro.marchini/Projects/OSS/faro/faro-dev.code-workspace), which enables startup autofocusing

If you want the extension host run to stay aligned with repo quality gates, run these before launching:

```sh
make check
make test
```

## Repository Structure

```text
src/
  core/   canonical document model, validation, path movement, store logic
  app/    pure view-model/projection logic
  infra/  VS Code-facing adapters and extension runtime
test/
  core/   domain and store tests
  app/    projection tests
  infra/  adapter tests
docs/
  faro-plan.md
```

## Current MVP Boundary

Implemented:

- strict TypeScript setup
- ESM modules
- `npm run check`
- `node:test` suite
- typed core/app/infra boundaries
- real extension composition root
- outline tree provider registration
- navigator webview registration
- editor reveal/highlight wiring
- local command surface for navigating and focusing Faro
- agent-facing Faro contract (`listPaths`, `getPath`, `upsertPath`, `setActivePath`, `setCurrentBeacon`, `deletePath`)
- MCP tools/resources bootstrap over the canonical store
- VS Code MCP server definition registration for a local stdio Faro server
- protocol-level Faro authoring verified end to end against the registered stdio MCP bridge and sidebar state

Not implemented yet:

- manual VS Code chat-session validation over the Faro MCP server
- richer authoring operations such as append/branch editing
- import/export and stale-range handling polish

## Agent Authoring Contract

The repository now includes both the runtime contract and the agent instructions for path selection:

- [AGENTS.md](./AGENTS.md) constrains the beacon-selection agent role
- [skills/faro-author-paths/SKILL.md](./skills/faro-author-paths/SKILL.md) defines the pragmatic authoring workflow

When a Faro-aware agent runtime exposes the local `faro.*` tools, the expected workflow is:

1. `faro.listPaths`
2. `faro.getPath` when revising
3. `faro.upsertPath` as the main write
4. `faro.setActivePath` only if the new path should become primary
5. `faro.setCurrentBeacon` only if the starting step should move

## Next Steps

The immediate implementation path is:

1. Manually validate the chat-to-sidebar workflow inside VS Code over the registered Faro MCP server.
2. Add pragmatic authoring operations only where the workflow actually needs them.
3. Improve sample and empty-state UX around the first generated path.
4. Add import/export and stale-range handling polish.
