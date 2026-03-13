# Faro

Faro is a VS Code extension for turning agent reasoning about a codebase into persistent, navigable code landmarks.

This repository currently contains a working local MVP of the extension:

- a canonical Faro document model
- validation and path navigation logic
- an in-memory store
- pure app-layer projections for outline and navigator views
- real VS Code host bindings for outline, navigator, commands, and editor reveal
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
- `Reveal` is wired, but the seeded sample currently points to placeholder `file:///workspace/...` URIs, so reveal is not yet meaningful against the local repo

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

Not implemented yet:

- MCP server integration
- agent-driven path creation through MCP
- real workspace-backed sample paths for meaningful local reveal flows

## Next Steps

The immediate implementation path is:

1. Bootstrap the minimal Faro MCP contract over the canonical store.
2. Let an agent create and replace paths end to end.
3. Replace the seeded placeholder URIs with real workspace-resolved sample data for local reveal testing.
4. Add import/export and stale-range handling polish.
