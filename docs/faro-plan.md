# Faro Implementation Plan

## Product framing

**Faro** is a VS Code extension that lets an agent turn codebase understanding into a persistent, navigable sequence of annotated code landmarks.

For the first implementation, Faro should stay narrow:

- one workspace-local path store
- one active path at a time
- one active beacon at a time
- linear navigation only
- agent writes and updates paths through MCP
- users navigate paths from the VS Code UI without needing the chat thread

## Scope decisions

### In scope for MVP

- VS Code extension with a dedicated `Faro` view container
- `Navigator` view for current beacon details and `Prev` / `Next`
- `Outline` TreeView for paths and beacons
- workspace-scoped persistence
- editor navigation to beacon file/range
- active beacon highlighting
- local `stdio` MCP server
- minimal MCP tool surface for path CRUD and navigation

### Out of scope for MVP

- graph or branch visualization
- extension-side code analysis
- collaborative editing
- automatic healing of moved ranges beyond best-effort fallback
- chat-embedded MCP App UI

## Target architecture

### Extension host

Owns:

- VS Code contributions and commands
- TreeView and WebviewView
- navigation and decorations
- persistence lifecycle
- synchronization with the MCP server

### Local MCP server

Owns:

- tool handlers
- resource handlers
- validation of agent writes
- read/write access to the canonical state

### Shared schema and store

Owns:

- versioned path document schema
- serialization and validation
- workspace-local storage adapter
- state update rules

## Proposed repository layout

```text
faro/
  docs/
    faro-plan.md
  package.json
  tsconfig.json
  src/
    extension/
      extension.ts
      commands/
      views/
      navigation/
      decorations/
      state/
    mcp/
      server.ts
      tools/
      resources/
    shared/
      schema.ts
      types.ts
      validation.ts
```

If the extension and server become too coupled, split them later into `packages/extension`, `packages/mcp`, and `packages/shared`. For the first pass, one package is simpler.

## Delivery plan

Execution rule:

- create one commit after each completed slice
- run `npm run check` and `npm test` before each slice commit

Current execution status:

- Phase 1 is implemented and verified
- Phase 6 is partially implemented through `AGENTS.md` and the Faro authoring skill
- the next active delivery target is Phase 3, starting with the minimal agent contract and MCP bootstrap

## Phase 0: Bootstrap

Goal: establish a runnable VS Code extension project and the core document model.

Deliverables:

- initialize extension scaffold in TypeScript
- define the Faro schema with `schemaVersion`
- create sample in-memory state and fixtures
- add lint, typecheck, and basic test runner
- decide whether persistence uses `ExtensionContext.workspaceState` only or a file-backed store under workspace storage

Exit criteria:

- extension launches in the Extension Development Host
- shared schema compiles and validates example path data

## Phase 1: Local-first UX shell

Goal: make Faro usable without MCP so the UI and state model stabilize first.

Deliverables:

- contributed `Faro` activity bar container
- `Outline` TreeView showing paths and beacons
- `Navigator` WebviewView rendering current beacon
- commands:
  - `faro.nextBeacon`
  - `faro.previousBeacon`
  - `faro.revealCurrentBeacon`
  - `faro.setActivePath`
- editor navigation and active-range highlighting
- workspace persistence for paths and current pointer
- empty states for no paths / no beacons / invalid beacon

Implementation notes:

- keep state updates centralized in a store service
- make both views reactive to store events rather than each owning state
- navigation should always tolerate missing files or invalid ranges

Exit criteria:

- a hardcoded or locally seeded path can be opened, browsed, and highlighted reliably
- closing and reopening the workspace preserves the current path and position

## Phase 2: Canonical store and resilience

Goal: make state durable and safe before exposing it to an agent.

Deliverables:

- persistent JSON document adapter with load/save semantics
- validation on read and write
- stable IDs for paths and beacons
- best-effort range fallback when the exact range is invalid
- warning surface for stale files or ranges
- import/export command for debugging and future team sharing

Implementation notes:

- keep one canonical serialized shape
- treat UI-only state as derived where possible
- reject writes that point outside workspace roots

Exit criteria:

- corrupted or partial state fails safely
- navigation degrades gracefully when code has shifted

## Phase 3: MCP integration

Goal: let agents create and update Faro paths through a minimal contract.

Deliverables:

- local `stdio` MCP server bootstrapped by the extension
- shared access to the canonical store
- tools:
  - `faro.upsertPath`
  - `faro.appendBeacons`
  - `faro.getPath`
  - `faro.listPaths`
  - `faro.setActivePath`
  - `faro.setCurrentBeacon`
  - `faro.navigate`
  - `faro.deletePath`
- resources:
  - `faro://paths`
  - `faro://paths/{pathId}`
  - `faro://paths/{pathId}/current`
- tool metadata marking read-only operations appropriately

Implementation notes:

- `upsertPath` should support full replacement of one path in a single call
- keep navigation state changes idempotent
- do not let the MCP server perform code analysis; it only stores and serves structure

Exit criteria:

- an MCP client can create a path end-to-end and the extension updates without reload
- read tools and resources return consistent state with the UI

## Phase 4: End-to-end happy path

Goal: verify the intended user workflow from prompt to navigation.

Deliverables:

- one documented flow:
  - user asks agent to explain a subsystem
  - agent creates a Faro path
  - extension renders the path
  - user navigates beacons with UI commands
- smoke tests for store, navigation, and MCP writes
- demo fixture path for local validation

Exit criteria:

- Faro works reliably in the happy path without manual state editing

## Phase 5: Polish and v1 hardening

Goal: remove obvious friction before public use.

Deliverables:

- delete and reopen path flows
- clearer empty/error states
- command palette discoverability
- stale-range warning UX
- documentation for agent authors and users
- export/import workflow

Exit criteria:

- a new user can install Faro, create a path through an agent, and navigate it without extra setup guidance

## Phase 6: Agent Guidance

Goal: make Faro usable by a dedicated beacon/path authoring agent without creating schema drift.

Deliverables:

- root `AGENTS.md` that constrains the agent to beacon/path selection only
- explicit instruction that the agent must use the Faro skill
- pragmatic guidance grounded in cognitive science and psychology of programming
- rules for selecting low-cognitive-load, high-signal beacons

Exit criteria:

- the agent role is clearly separated from implementation work
- the agent uses the canonical Faro schema from `src/core/model/document.ts`
- the agent is guided to optimize for comprehension rather than raw exhaustiveness

## Workstreams

### 1. Extension shell

- scaffold extension manifest, activation events, and commands
- register view container, TreeView, and WebviewView
- set up extension-level logging for debugging

### 2. Shared schema

- define TypeScript types for path, beacon, pointer, and store document
- add validation helpers for file URIs, ranges, and workspace boundaries
- keep branch-ready fields in the schema even if unused in the UI

### 3. Store and persistence

- implement load, save, mutate, and subscribe APIs
- centralize schema upgrades behind `schemaVersion`
- keep write operations atomic from the caller perspective

### 4. Navigation and highlighting

- open documents and reveal target ranges
- maintain a single active decoration set
- handle missing files and invalid ranges without throwing

### 5. MCP server

- stand up the local server process
- expose tools/resources against the shared store
- validate writes and root boundaries

### 6. QA and examples

- add fixture paths for manual testing
- test range drift fallback and missing-file behavior
- document the expected agent payload shape

## Suggested implementation order

1. Scaffold the extension and shared schema.
2. Build the store service and local persistence.
3. Add TreeView and Navigator UI against seeded local data.
4. Add editor reveal and active-range decorations.
5. Harden invalid-state and stale-range behavior.
6. Add the local `stdio` MCP server and wire tools/resources.
7. Test the full agent-created-path workflow.
8. Add export/import and polish.

## MVP technical decisions

- Language: TypeScript
- Runtime: VS Code extension host with a local Node-based MCP server
- State format: versioned JSON
- Persistence: workspace-scoped storage first, file export second
- Transport: local `stdio` for MCP
- UI: TreeView for structure, WebviewView for the current beacon card

## Testing plan

### Unit tests

- schema validation
- store mutations
- pointer movement and bounds handling
- range fallback logic

### Integration tests

- extension activation
- view registration
- navigation opening the correct file/range
- MCP `upsertPath` updates reflected in the UI state

### Manual smoke tests

- open workspace with no Faro data
- import or create a path
- navigate across all beacons
- edit target files and verify fallback behavior
- reload window and confirm state persistence

## Risks and mitigations

### Range drift

Mitigation:

- validate on navigation
- fall back to nearest valid line when possible
- surface a warning instead of failing silently

### Store divergence between extension and MCP server

Mitigation:

- enforce one canonical store module
- avoid duplicate caches unless event-driven and clearly invalidated

### Multi-root workspace complexity

Mitigation:

- validate beacon URIs against known roots
- store enough root context to explain validation failures

### Weak agent-authored paths

Mitigation:

- make full replacement cheap
- support append and replace flows
- keep the UI useful even when summaries are terse

## Definition of MVP done

Faro is ready for its first external trial when all of the following are true:

- a path can be created by an MCP client without manual file edits
- the extension persists that path per workspace
- the user can browse beacons from the sidebar
- the active beacon reliably opens and highlights in the editor
- state survives reloads
- invalid files or ranges fail with visible, recoverable UX

## Immediate next steps

1. Scaffold the VS Code extension project.
2. Define `src/shared/schema.ts` and validation rules.
3. Implement the store with seeded sample data.
4. Build the `Faro` view container with `Outline` and `Navigator`.
5. Add reveal/highlight behavior before starting MCP integration.
