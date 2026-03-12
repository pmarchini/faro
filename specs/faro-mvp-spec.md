# Faro MVP Spec

## Purpose

This document is the working spec and status tracker for Faro's first usable MVP.

Use it to answer three questions:

1. What is in scope for the MVP?
2. What is already implemented?
3. What is the next slice to build?

This file should be updated whenever a milestone or acceptance criterion changes state.

## Status Legend

- `done`: implemented and verified
- `in_progress`: currently being built
- `planned`: accepted scope, not started
- `blocked`: cannot proceed without resolving a dependency or decision
- `out_of_scope`: explicitly excluded from this MVP

## Product Definition

Faro is a VS Code extension that lets an agent turn codebase understanding into a persistent, navigable sequence of annotated code landmarks.

## MVP Outcome

The first usable MVP is done when all of the following are true:

- a user can load the extension in VS Code
- the extension exposes a real `Faro` sidebar experience
- an outline of paths and beacons is visible in the sidebar
- a navigator view shows the current beacon and supports `Prev` / `Next`
- selecting or navigating a beacon reveals the target code range in the editor
- Faro state is stored per workspace
- the canonical schema, navigation logic, and adapters pass `npm run check` and `npm test`

## Scope

### In Scope

- one workspace-local store
- one active path at a time
- one active beacon at a time
- linear `mainPath` navigation only
- VS Code extension host integration
- `Outline` TreeView
- `Navigator` WebviewView
- editor reveal for the active beacon
- active beacon highlight
- workspace-scoped persistence
- a minimal agent-facing contract later
- a Faro skill later, once the agent contract is stable

### Out Of Scope

- graph or branch UI
- collaborative editing
- extension-side code analysis
- complex stale-range healing
- inline MCP App UI

## Architecture Constraints

- `src/core/**` is the canonical model and state layer
- `src/app/**` is pure projection/use-case logic
- `src/infra/**` is the only VS Code or transport adapter layer
- all UI and future MCP writes must go through one canonical store
- views must render derived state, not own business rules
- `npm run check` and `npm test` are required verification gates for each slice
- commit after every completed slice

## Current Repository Status

### Foundation

Status: `done`

- TypeScript project using ESM
- `node:test` test suite
- `npm run check`
- canonical document model
- validation logic
- path navigation logic
- in-memory store
- workspace-state persistence adapter
- app-layer outline projection
- app-layer navigator projection
- real extension composition root
- runtime command surface
- outline adapter
- navigator adapter
- editor navigation adapter
- Faro skill scaffold

Verification:

- `npm run check`
- `npm test`

### Current Limitation

Status: `in_progress`

The extension still lacks the real VS Code user loop:

- no concrete VS Code TreeView registration yet
- no concrete WebviewView registration yet
- editor navigation adapter is not yet wired into the runtime
- runtime refresh is not yet connected to concrete UI instances

## Implementation Status

### Slice 0: Foundation

Status: `done`

Acceptance criteria:

- canonical Faro document types exist
- validation exists for document, URI, and range integrity
- path movement exists for next/previous/current selection
- store supports load, replace, subscribe, upsert, selection, and delete
- tests cover core, app projections, and infra adapters

### Slice 1: Extension Composition Root

Status: `done`

Acceptance criteria:

- `activate()` constructs one canonical store instance
- runtime owns subscriptions and refresh lifecycle
- command/controller wiring exists in one place
- no business logic moves into extension entrypoint
- runtime exposes `setCurrentBeacon`

### Slice 2: Outline TreeView

Status: `in_progress`

Acceptance criteria:

- outline adapter exists and renders paths and beacons from store state
- emitted command payloads route through the runtime command surface
- `Faro` container shows a concrete VS Code outline view
- active path/beacon state is reflected visually

### Slice 3: Navigator WebviewView

Status: `in_progress`

Acceptance criteria:

- navigator adapter renders current beacon title, summary, explanation, and position
- webview message bridge supports `Prev`, `Next`, and `Reveal`
- navigator re-renders from runtime refresh events
- empty states are handled explicitly
- concrete VS Code WebviewView registration exists

### Slice 4: Editor Reveal And Highlight

Status: `in_progress`

Acceptance criteria:

- editor navigation adapter exists
- current beacon opens the target document
- target range is revealed in the editor
- one active beacon highlight is applied
- invalid file/range cases fail without throwing

### Slice 5: Workspace Persistence Integration

Status: `done`

Acceptance criteria:

- extension uses workspace-scoped persistence in the real runtime
- reload preserves active path and current beacon
- invalid persisted state falls back safely

### Slice 6: Agent Enablement

Status: `in_progress`

Acceptance criteria:

- minimal agent-facing Faro contract is defined
- Faro skill exists and explains how an agent should create/update paths
- skill uses the canonical Faro document shape, not a parallel schema
- root `AGENTS.md` constrains the beacon/path-selection agent role
- the agent is explicitly instructed to use the Faro skill pragmatically

### Slice 7: MCP Integration

Status: `planned`

Acceptance criteria:

- MCP tools reuse the same store and validation rules as the UI
- read/write operations are consistent with extension state
- happy-path agent flow works end to end

## Immediate Next Slice

### Next Slice

`Concrete VS Code UI wiring`

Deliverables:

- register the outline adapter as a real VS Code TreeView
- register the navigator adapter as a real VS Code WebviewView
- connect runtime refresh to concrete UI instances
- wire the editor adapter into reveal flows
- keep one refresh owner in the runtime

Why this next:

- the runtime and generic adapters now exist
- the missing gap is concrete VS Code registration and end-to-end UI flow
- this is the shortest path to a genuinely usable extension MVP

## Open Risks

- type drift between layers if local types are reintroduced outside `src/core/model/document.ts`
- accidental business logic leaking into VS Code adapters
- duplicated state if future MCP wiring bypasses the canonical store
- overbuilding branch support before the linear MVP loop works

## Update Rules

When finishing a slice:

1. update the slice status
2. update the acceptance criteria if scope changed
3. record any new blocker or risk
4. keep `Current Repository Status` aligned with reality
5. run `npm run check` and `npm test`
6. create a commit for that slice

## Related Documents

- [README.md](/Users/pietro.marchini/Projects/OSS/faro/README.md)
- [docs/faro-plan.md](/Users/pietro.marchini/Projects/OSS/faro/docs/faro-plan.md)
