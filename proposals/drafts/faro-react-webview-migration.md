# Faro React Webview Migration

## Status

`draft`

This document is exploratory.

It is not yet an accepted pipeline proposal and should not be treated as committed implementation scope.

## Purpose

Evaluate what it would mean to migrate Faro's current VS Code webview UI from hand-authored HTML to React.

The immediate trigger is the future graph canvas proposal, but the decision should be framed more broadly:

- whether React should become the foundation for richer Faro webview surfaces
- how that UI should be bundled and shipped inside the VS Code extension
- how testing should evolve without discarding the current `node:test` approach
- how a small design system can improve consistency without becoming a platform of its own

## Problem

The current UI is small and direct, but the graph-canvas proposal raises the complexity of what the webview needs to render and coordinate:

- richer local state
- denser interactions
- custom node-card rendering
- inspectors, toolbars, and layered canvas controls

Continuing with hand-authored HTML may keep short-term cost low, but it risks making future UI work harder to scale and harder to reason about.

## Goal

Define a safe, incremental path for introducing React into Faro's VS Code webview adapter while preserving current behavior, keeping application semantics outside the UI framework, and maintaining a simple shipping and testing story.

## Non-Goals

- rewriting Faro's application/runtime logic into React
- introducing client-side routing as a new product abstraction
- building a large design system before the first migrated screens exist
- replacing `node:test` as the repository test runner
- requiring remote assets or post-install build steps for the extension

## Core Decision

React should be treated as a likely medium-term UI foundation for Faro's VS Code webview surfaces.

The migration should still begin conservatively:

- move the renderer first
- preserve the current product structure
- keep the existing runtime and view-model boundaries
- keep React confined to the adapter UI layer

If the first React slice cannot preserve those boundaries cleanly, the migration shape is wrong.

## Architectural Position

React belongs in `src/infra/vscode/ui`.

It must not absorb:

- path semantics
- beacon identity
- current-beacon rules
- reveal/navigation application logic
- runtime orchestration

Those concerns remain outside React and are passed into the UI as view-model data and explicit UI actions.

The first migration should reproduce the current `main` webview contract:

- same main surface
- same route model
- same message/intent names
- same loading and empty states
- same reveal and selection semantics

## Migration Strategy

### Phase 0: Freeze The Existing Contract

Before introducing React, explicitly document the current UI contract:

- current routes
- current message names
- view-model shapes
- loading, error, and empty-state semantics
- command and selection behavior

This phase exists to prevent behavioral drift during the renderer swap.

### Phase 1: Add A React Host Behind The Existing Boundary

Introduce a minimal React renderer for the current main webview without changing product structure.

Rules:

- one obvious React entrypoint for the main view
- React receives the same view-model data the HTML renderer uses today
- React emits the same intents/messages back to the host bridge
- the old renderer remains available behind a feature flag or alternate factory until parity is proven

### Phase 2: Migrate Route By Route

Migrate routes in this order:

1. `Home`
2. `Path`
3. `Setup`

Why:

- `Home` is mostly static and lowest risk
- `Path` is the core interaction surface and should shape the React patterns
- `Setup` has the most async and installation-oriented behavior and should move last

### Phase 3: Extract Repeated UI Primitives

Only after route parity is reached, extract small shared primitives.

This should be driven by repetition, not by framework enthusiasm.

### Phase 4: Evaluate React As The Default UI Foundation

After the main view is stable in React, decide whether:

- React remains only a renderer swap for the existing surface
- or Faro adopts React as the default foundation for future webview UIs such as the graph canvas

## Bundling And Shipping

### Recommended Tooling

Use `esbuild` for both targets:

- extension host bundle
- browser/webview bundle

Why:

- explicit control over separate Node and browser outputs
- fast incremental builds
- low tooling overhead for a VS Code extension
- no need to adopt a browser-first dev-server model as part of the migration

### Recommended Output Shape

- `dist/extension/extension.js`
- `dist/webviews/main/index.js`
- `dist/webviews/main/index.css`
- `dist/webviews/<future-webview>/...` as needed later

Do not introduce shared frontend runtime chunks until multiple substantial webviews actually justify them.

### VS Code Webview Constraints

- use `webview.asWebviewUri` for all local assets
- keep `localResourceRoots` limited to the webview dist directory
- ship no remote JS, fonts, images, or styles
- externalize `vscode` in the extension-host bundle only
- keep the React bundle lazy-loaded when the webview is resolved, not during extension activation

### Packaging

The VSIX should be self-contained.

That means:

- built webview assets are checked into the packaged extension output
- there are no post-install build steps
- `.vscodeignore` should exclude unnecessary frontend source artifacts while preserving runtime assets

## Testing Strategy

### Runner

Keep `node:test` as the only repository test runner.

There is no clear benefit in replacing the runner just to support React tests.

### React UI Tests

Add:

- `@testing-library/react`
- `jsdom`

Use them only for React component tests.

### Boundary Between Test Styles

Keep the current style for:

- application logic
- composition
- adapters
- fake webview/provider tests
- host command and message wiring

Use React Testing Library only for:

- rendered route components
- presentational primitives
- user interactions at the DOM boundary

### Practical Constraint

The current repository uses `--test-isolation=none`.

That means the spec should assume one of two safe approaches:

1. explicit per-file `jsdom` setup and cleanup for UI tests
2. a separate UI-oriented `node:test` command with isolated setup

Without that guardrail, DOM leakage will make the suite unreliable.

### Testing Principle

Prefer parity and intent tests over markup-heavy snapshots.

Test:

- route switching
- beacon selection
- reveal actions
- setup scope changes
- install success/failure states

Do not over-test React implementation details.

## Small Design System

The first React slice should introduce only a thin and naive design system.

### Token Strategy

Use a short semantic layer mapped onto VS Code tokens.

Initial token families:

- `color`
- `space`
- `radius`
- `border`
- `font`
- `shadow`

Examples:

- `surface.default`
- `surface.muted`
- `text.default`
- `text.muted`
- `border.default`
- `accent.default`

These should map to `--vscode-*` tokens in one place, with local fallbacks only where necessary.

### Initial Component Scope

Build only repeated primitives:

- `AppShell`
- `Panel`
- `Stack`
- `Inline`
- `Tabs`
- `Button`
- `IconButton`
- `Badge`
- `List`
- `ListItem`
- `EmptyState`
- `Notice`
- `SectionHeader`

Feature-specific pieces such as beacon cards, graph nodes, inspectors, and route panels should remain feature-local until repetition is proven.

### What Not To Build

Do not build:

- a heavy variant engine
- a polymorphic component library
- a token compiler
- a custom icon platform
- a broad motion system
- a form framework

The design system should improve consistency, not create a second platform to maintain.

## Recommended Repository Shape

The first React slice should aim toward a structure like:

```text
src/infra/vscode/ui/
  main/
    entry/
    routes/
    components/
    styles/
    bridge/
```

The exact names can change, but the shape should preserve three truths:

- one obvious UI entrypoint
- one obvious place for route components
- one obvious bridge back to host/runtime actions

## Risks

- introducing React and accidentally moving application semantics into components
- creating two competing UI architectures during the migration and never removing the old one
- over-building a design system before repeated patterns exist
- letting bundling complexity grow faster than actual UI needs
- mixing `jsdom`, RTL, and `node:test` without isolation discipline
- treating the graph canvas as the only target and underestimating the broader migration cost

## Open Questions

- should the first React slice replace the current renderer immediately after parity, or remain behind a flag until the graph view also lands
- should the first webview bundle cover only the existing main view, or should it include the future graph route from the start
- should UI tests run in the main `node:test` command or in a separate script with stricter isolation
- when does a feature-local component become design-system material in this repository

## Draft Recommendation

The most defensible path is:

1. accept React as a likely medium-term UI foundation
2. migrate the existing main webview first, without changing product structure
3. standardize on `esbuild` with separate extension-host and webview bundles
4. keep `node:test` as the runner and add RTL plus `jsdom` only for rendered React UI
5. introduce only a thin semantic token layer and a minimal set of reusable primitives
6. decide on React as the default UI foundation only after the first migrated webview proves the boundary is clean
