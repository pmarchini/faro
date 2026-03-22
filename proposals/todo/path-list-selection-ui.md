# Path List Selection UI

## Status

`todo`

## Problem

Faro can already list path summaries and switch the active path through the canonical app service and MCP surface, but the main extension UI is still centered on only the current path.

That leaves a practical navigation gap:

- a user can see the current path but not the rest of the available paths in the main UI
- switching paths depends on indirect surfaces instead of a first-class path picker
- comparing or resuming another path requires extra context switching
- the current path route does not expose the broader workspace path inventory

## Goal

Add a visible extension UX that lists available Faro paths and lets the user select one directly from the UI.

## Scope

In scope:

- one visible list of available paths in the Faro extension UI
- one direct selection action for any listed path
- clear visual distinction for the currently active path
- reuse of canonical `listPaths` and `setActivePath` behavior already present in the app/service layer
- coherent empty-state behavior when no paths exist

Out of scope:

- bulk path management
- search, sorting, or filtering in the first slice
- editing path metadata from the list
- branch-aware browsing beyond the current active-path model

## Proposed UX Direction

Preferred first shape:

1. expose an `Available Paths` section in the path route
2. render each path as a selectable row with title, short goal text, and active state
3. selecting a row makes that path active and refreshes the current beacon view

Secondary candidates to evaluate:

- a dedicated `Paths` route in the main shell
- an outline-first selection flow with less investment in the main view
- a quick-pick or command-palette surface for power users

The first version should keep selection simple and visible in the existing path route.

## Acceptance Criteria

- the extension exposes a visible list of available paths
- the currently active path is clearly indicated in the list
- selecting a listed path delegates to the canonical `setActivePath` workflow
- selecting a path refreshes the current-path and current-beacon panels from canonical state
- the list reuses canonical path summaries instead of duplicating path-selection business rules in the UI
- when no paths exist, Faro renders a clear empty-state message instead of an empty list shell
- selection of a missing path fails safely without corrupting workspace state

## Architectural Constraints

- path selection must continue to flow through the canonical store
- the UI must not reimplement active-path selection rules
- list data should come from existing app-layer summaries or equivalent derived state, not raw ad hoc projection in the adapter
- selection should preserve the existing one-active-path-at-a-time model

## Risks

- overcrowding the path route with too many responsibilities
- introducing duplicate path-summary shaping between UI layers
- unclear hierarchy between current-path details and the broader path list
- weak affordance if the selected path does not visibly refresh the current beacon state

## Next Step

Design the smallest path-list UI that makes switching paths obvious without fragmenting the existing path-reading flow.
