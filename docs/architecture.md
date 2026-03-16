# Faro Architecture

This document is the technical companion to the main [README](../README.md).

The README is the onboarding entrypoint for new users.
This file is the engineering-facing overview.

## Overview

Faro is organized around one canonical comprehension model and a thin set of delivery layers around it.

At a high level:

1. the agent authors or revises a Faro path
2. Faro stores that path in canonical state
3. the VS Code extension renders and navigates that state
4. MCP is the contract between the agent and the extension runtime

## Main Layers

### Core Model

The canonical schema lives in:

- `src/core/model/document.ts`

This is the source of truth for Faro documents, paths, beacons, and current-position state.

## App Layer

The app layer builds pure projections over the canonical state.

Examples:

- `src/app/views/navigator-view-model.ts`
- `src/app/views/home-view-model.ts`
- `src/app/views/setup-view-model.ts`

These modules should stay free of VS Code APIs.

## VS Code UI Layer

The VS Code integration lives under:

- `src/infra/vscode/`

The current main webview route composition lives under:

- `src/infra/vscode/ui/main-view/`

This layer is responsible for:

- rendering the sidebar UI
- wiring button/message interactions
- editor reveal/highlight behavior
- extension commands
- workspace-scoped UI state

## Setup / Tooling Layer

Setup-related installation logic is kept outside the core model.

Examples:

- `src/infra/tooling/setup-integration-service.ts`
- `src/infra/tooling/agent-instruction-sync.ts`

This keeps agent/skill installation concerns separate from Faro path state.

## MCP Layer

The agent-facing contract lives in:

- `src/infra/mcp/`

This layer exposes Faro operations through MCP so an agent can:

- list paths
- read paths
- upsert paths
- set the active path
- set the current beacon

## Runtime Principle

Faro should keep one canonical state flow.

That means:

- the UI should not invent parallel document state
- MCP should not invent parallel document state
- setup/install tooling should not be mixed into the path runtime

## Design Rules

When changing the codebase:

- keep core state canonical
- keep app/view-model code pure
- keep VS Code logic in infra/adapters
- prefer modular slices over broad rewrites
- protect user-visible behavior with focused tests

## Related Docs

- [README](../README.md)
- [Implementation Plan](./faro-plan.md)
- [MVP Spec](../proposals/in-progress/faro-mvp-spec.md)
