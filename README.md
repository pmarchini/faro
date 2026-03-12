# Faro

Faro is a VS Code extension for turning agent reasoning about a codebase into persistent, navigable code landmarks.

This repository currently contains the first TypeScript foundation for the extension:

- a canonical Faro document model
- validation and path navigation logic
- an in-memory store
- pure app-layer projections for outline and navigator views
- thin VS Code-facing adapter modules
- `node:test` coverage and a real TypeScript check

It is not yet a fully usable sidebar extension. The extension entrypoint exists, but the `Outline` TreeView, `Navigator` WebviewView, and editor reveal/highlight loop are the next implementation steps.

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

The extension manifest and activation entrypoint are already in place, so you can load it in an Extension Development Host.

1. Open this repository in VS Code.
2. Open the Run and Debug view.
3. Create a `launch.json` if VS Code does not offer one automatically.
4. Use the `Extension` debug target.
5. Start debugging to open an Extension Development Host window.

Current expectation:

- the extension should load without TypeScript or runtime errors
- the `Faro` activity contribution and extension entrypoint are present in the manifest
- the runtime is still a minimal shell, so the sidebar UI and end-to-end navigation flow are not fully wired yet

If you want the extension host run to stay aligned with repo quality gates, run these before launching:

```sh
npm run check
npm test
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

Not implemented yet:

- real extension composition root
- outline tree provider
- navigator webview
- editor reveal/highlight
- MCP server integration

## Next Steps

The immediate implementation path is:

1. Wire a real extension composition root around one canonical store instance.
2. Implement the `Outline` TreeView from the existing app projection.
3. Implement the `Navigator` WebviewView from the existing app projection.
4. Add editor reveal/highlight for the active beacon.
5. Add extension-host integration tests, then layer in MCP.
