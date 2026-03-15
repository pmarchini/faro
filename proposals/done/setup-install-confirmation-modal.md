# Setup Install Confirmation Modal

## Status

`done`

## Problem

The setup view will trigger real file writes for local or global agent/skill installation.

Even if the setup surface already shows target status, an install button is still easy to read as a lightweight UI action rather than a write operation with side effects.

That creates avoidable risk:

- accidental writes
- unclear overwrite intent
- weak distinction between inspection and execution

## Goal

Add an explicit confirmation step inside setup before Faro executes an install action.

## Scope

In scope:

- a confirmation modal shown before a setup install action executes
- confirmation for both `local` and `global` scope actions
- clear explanation of what Faro is about to write
- explicit indication when the action is a reinstall or overwrite-sensitive action

Out of scope:

- redesigning the underlying install service
- conflict-resolution diff views
- undo/uninstall
- changing install semantics outside the confirmation step

## Proposed UX Direction

When a user clicks `Install` or `Reinstall` in setup, Faro should open a lightweight confirmation modal that states:

- selected scope
- selected target
- whether Faro is installing or reinstalling
- that files will be written

The modal should provide:

- one cancel action
- one confirm action

If the action later grows into a force-overwrite flow, that flow should extend this confirmation surface rather than bypass it.

## Acceptance Criteria

- every setup install action requires explicit confirmation before files are written
- the modal identifies the selected target and scope clearly
- the user can cancel without side effects
- confirming the modal delegates to the existing install service
- install status refreshes after a confirmed action

## Architectural Constraints

- the confirmation step should live in the setup UI flow, not in the core Faro document/runtime model
- the modal must delegate to the existing canonical install service
- the setup route must not duplicate install logic just to support confirmation

## Risks

- users treating install buttons as reversible/no-op actions when they actually write files
- bolting confirmation directly into the install service instead of the UI flow
- conflating simple confirmation with richer future conflict-resolution UX

## Next Step

Implemented in the setup UI flow for both legacy and main sidebar setup surfaces while keeping the install service unchanged.
