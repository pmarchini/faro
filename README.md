# Faro

Faro is a VS Code extension for turning agent reasoning about a codebase into persistent, navigable code landmarks.

This repository currently contains a working local MVP of the extension:

- a canonical Faro document model
- validation and path navigation logic
- an in-memory store
- pure app-layer projections for the Faro main view
- real VS Code host bindings for the main view, commands, setup integration, and editor reveal
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

## First Run

The right way to understand Faro is to follow the agentic loop inside VS Code.

Use this first-run path:

1. Install and validate the repository:

```sh
npm install
npm run check
npm test
```

2. Install the extension locally:

```sh
make install-local
```

3. Install the local Faro agent artifacts for this workspace:

```sh
make upsert-agent-local SCOPE=local
```

4. Open the repository in VS Code:

```sh
code .
```

5. Reload the window once if needed so VS Code picks up the local extension and the generated custom agent artifacts.

6. Open the Chat view and select the `Faro Path Author` custom agent.

7. Ensure the local `Faro` MCP server is enabled for the workspace.

8. Ask the agent to create or revise a path for a concrete code-reading goal.

Example:

```text
Create a Faro path that explains how the main VS Code view is built and wired.
```

9. Open the `Faro` activity bar container and inspect the result in the main view:
   - `Home` gives you the product entrypoint
   - `Path` shows the active path and current beacon
   - `Setup` shows local/global integration targets

10. Use `Prev`, `Next`, and `Reveal` to verify that the generated path is actually navigable in code.

That is the intended product loop: author in chat, inspect in Faro, reveal in code.

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

Use explicit local or global commands so the write scope is unambiguous.

Local workspace-scoped artifacts:

```sh
make upsert-agent-local SCOPE=local
```

That upserts:

- `CLAUDE.md`
- `.github/copilot-instructions.md`
- `.github/agents/faro-path-author.agent.md`
- `.codex/skills/faro-author-paths/SKILL.md`

Global user-level artifacts:

```sh
make upsert-agent-global SCOPE=global
```

That upserts:

- `${CLAUDE_HOME:-$HOME/.claude}/CLAUDE.md`
- `${COPILOT_HOME:-$HOME/.copilot}/instructions/faro.instructions.md`
- `${COPILOT_HOME:-$HOME/.copilot}/agents/faro-path-author.agent.md`
- `${CODEX_HOME:-$HOME/.codex}/skills/faro-author-paths/SKILL.md`

If the Faro-specific global Copilot files already exist and differ, the command refuses to overwrite them unless you opt in:

```sh
make upsert-agent-global SCOPE=global FORCE=1
```

If you intentionally want both scopes in one run:

```sh
make upsert-agent-all SCOPE=all
```

Add `FORCE=1` there too if you want the global Copilot Faro files replaced.

If you only want the VS Code Copilot custom agent file:

```sh
make upsert-copilot-agent-local SCOPE=local
```

That writes `.github/agents/faro-path-author.agent.md`.

For Codex, the local install writes to `.codex/skills/...` inside this repository. To make Codex consume that local skill home instead of your global one, start Codex with `CODEX_HOME="$(pwd)/.codex"`.

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
- the main Faro view opens with `Home`, `Path`, and `Setup` routes
- `Path` shows the seeded sample path and current beacon
- `Prev` / `Next` updates the current beacon in the view
- `Reveal` opens seeded sample beacons in the local repository
- `Setup` shows local/global integration targets for Claude, Copilot, and Codex

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

## What To Expect On First Run

If the setup is working, the first useful experience should look like this:

1. You ask the Faro agent in VS Code Chat for a path.
2. The agent uses the local Faro MCP surface made available by the extension.
3. Faro state updates inside the extension runtime.
4. The `Path` route in the Faro view reflects the new or revised path.
5. `Prev`, `Next`, and `Reveal` let you walk that path against real code.

The key mental model is:

- chat is the authoring surface
- Faro is the reading and navigation surface
- the editor is where the code is revealed

## Current MCP Boundary

For now, Faro's MCP surface is effectively local to VS Code.

That means:

- the extension registers one local `faro.local` MCP server definition for the workspace
- VS Code Chat can use that MCP surface when the workspace enables it
- Faro is not yet exposed as a standalone external MCP service meant to be consumed directly by tools outside VS Code

There is protocol-level coverage for the MCP authoring loop in tests, but the developer-facing story is still centered on VS Code Chat rather than an external Codex-to-Faro connection.

## What Is Happening Under The Hood

When Faro is running in VS Code:

1. the extension activates one runtime over one canonical store
2. the extension registers the local Faro MCP surface for the workspace
3. VS Code Chat can call Faro MCP operations against that runtime-backed store
4. the main Faro view renders derived state from the same store
5. command actions such as `Prev`, `Next`, and `Reveal` go through the same runtime loop

That is the main invariant in this repository:

- one canonical Faro document
- one runtime/store loop
- one VS Code-hosted local MCP surface

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
- one main webview with `Home`, `Path`, and `Setup` routes
- editor reveal/highlight wiring
- local command surface for navigating and focusing Faro
- setup integration flow for local/global agent artifacts
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
