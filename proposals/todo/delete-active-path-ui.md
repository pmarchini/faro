# Delete Active Path UI

## Status

`todo`

## Problem

Faro can already delete a path through the canonical service and MCP surface, but the extension does not expose a direct user-facing way to delete the current path.

That leaves a gap in the product loop:

- a user can create or receive a path but cannot remove it from the extension UI
- stale or low-value paths linger in workspace state
- replacing a path is currently easier than explicitly removing one
- deleting the active path requires indirect tooling instead of a first-class UI action

## Goal

Add a visible extension UX for deleting the active Faro path safely.

## Scope

In scope:

- one delete entrypoint for the current/active path in the Faro extension UI
- explicit confirmation before the delete is committed
- clear post-delete behavior for active-path selection and empty states
- reuse of the canonical `deletePath` behavior already present in the app/service layer
- visible success or failure feedback in the extension UX

Out of scope:

- bulk delete for many paths in the first slice
- undo/history beyond what the current store already supports
- changing the canonical delete semantics in core or MCP unless the UI workflow proves a real gap

## Proposed UX Direction

Preferred first shape:

1. expose a `Delete Path` action from the path route for the active path
2. require an explicit confirmation step
3. after delete:
   - if another path exists, make it active
   - if no path remains, show the normal empty path state

Secondary candidates to evaluate:

- an outline context action on path nodes
- a command-palette action targeting the active path

The first version should keep deletion scoped to the current path to reduce ambiguity.

## Acceptance Criteria

- the extension exposes a visible delete action for the active path
- deleting a path requires explicit user confirmation
- the action delegates to the canonical `deletePath` workflow instead of duplicating delete rules
- when the deleted path was active and another path exists, Faro selects the next active path consistently
- when no paths remain, Faro renders the normal empty-state UX
- outline, main view, and any active-path projections refresh from the canonical store after deletion
- deleting a missing path fails safely without corrupting workspace state

## Architectural Constraints

- delete behavior must continue to flow through the canonical store
- VS Code UI must not implement its own path-removal business rules
- the adapter should treat deletion as a UX concern over existing app-layer behavior
- empty-state rendering after delete must reuse existing view-model semantics where possible

## Risks

- making deletion too easy without enough confirmation
- inconsistent active-path fallback across views after deletion
- adding UI-only delete semantics that drift from the app service
- mixing deletion confirmation state into unrelated navigation concerns

## Next Step

Design the smallest extension UX that can delete the active path while preserving a coherent post-delete empty/fallback state.
